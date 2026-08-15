"""Web Push (VAPID) + scheduler in-process.

El plan Starter de Render no duerme, así que el proceso FastAPI está vivo 24/7
y puede disparar las notificaciones solo: nada de cron externo ni pings.

La fuente de verdad de los datos es Dexie EN EL CELULAR; la PWA sube un
"snapshot del día" (POST /api/push/snapshot) y este módulo solo lo redacta.

Persistencia: tabla `config` de la SQLite existente (vive en /var/data en
Render), así no hay tablas ni archivos nuevos que mantener.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import database as db  # noqa: E402

log = logging.getLogger("academic_os.push")

# Perú no tiene horario de verano: un offset fijo evita depender de tzdata.
LIMA = timezone(timedelta(hours=-5))

K_SUBS = "push_subs"
K_SNAPSHOT = "push_snapshot"
K_SENT = "push_sent"
K_ACKS = "push_acks"

DEFAULT_MORNING = "07:00"
DEFAULT_NIGHT = "22:00"
EXAM_HOUR = "09:00"
OVERDUE_HOUR = "13:00"

# Ventana de catch-up tras un reinicio (o tras un rato sin red): si el evento
# venció hace más de esto, simplemente NO se manda (se pierde ese día). Mejor
# perder un aviso que recibir el briefing matutino a las 4pm.
CATCHUP_MIN = {
    "morning": 120,
    "night": 120,
    "exam": 90,
    "overdue": 90,
    "block-start": 5,
    "block-end": 10,
}


# ── Almacenamiento ──────────────────────────────────────────────────────────

def _load(key: str, default: Any) -> Any:
    try:
        raw = db.get_config(key, "")
    except Exception:  # noqa: BLE001 — sin BD (self-check) no es motivo de caída
        return default
    if not raw:
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return default


def _save(key: str, value: Any) -> None:
    db.set_config(key, json.dumps(value, ensure_ascii=False))


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def vapid_keys() -> tuple[str, str]:
    """(privada, pública) en base64url. Env manda; si no hay, se genera y se
    guarda en la BD (disco persistente) — rotarlas invalida las suscripciones."""
    priv = os.environ.get("VAPID_PRIVATE_KEY", "").strip() or db.get_config("push_vapid_priv")
    pub = os.environ.get("VAPID_PUBLIC_KEY", "").strip() or db.get_config("push_vapid_pub")
    if priv and pub:
        return priv, pub

    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec

    key = ec.generate_private_key(ec.SECP256R1())
    priv = _b64(key.private_numbers().private_value.to_bytes(32, "big"))
    pub = _b64(
        key.public_key().public_bytes(
            serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint,
        ),
    )
    db.set_config("push_vapid_priv", priv)
    db.set_config("push_vapid_pub", pub)
    log.info("VAPID generado y guardado en la BD (public=%s…)", pub[:12])
    return priv, pub


# ── Envío ───────────────────────────────────────────────────────────────────

def _vapid_claims() -> dict[str, str]:
    correo = os.environ.get("ACADEMICOS_OWNER_EMAIL", "").strip() or "academic-os@localhost"
    return {"sub": f"mailto:{correo}"}


def _send_one(sub: dict, payload: dict) -> bool:
    from pywebpush import WebPushException, webpush

    priv, _ = vapid_keys()
    try:
        webpush(
            subscription_info=sub,
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=priv,
            vapid_claims=_vapid_claims(),
            ttl=3600,
        )
        return True
    except WebPushException as e:
        code = getattr(getattr(e, "response", None), "status_code", None)
        if code in (404, 410):
            log.info("Suscripción muerta (%s) — se elimina", code)
            return False
        log.warning("Fallo al enviar push (%s): %s", code, e)
        return True  # error transitorio: no borres la suscripción
    except Exception as e:  # noqa: BLE001
        log.warning("Fallo al enviar push: %s", e)
        return True


def broadcast(payload: dict) -> int:
    subs: list[dict] = _load(K_SUBS, [])
    if not subs:
        log.info("Push sin destinatarios: %s", payload.get("title"))
        return 0
    vivos = [s for s in subs if _send_one(s, payload)]
    if len(vivos) != len(subs):
        _save(K_SUBS, vivos)
    return len(vivos)


# ── Redacción de los avisos ─────────────────────────────────────────────────

def _mins(hhmm: str | None) -> int | None:
    try:
        h, m = str(hhmm).split(":")[:2]
        return int(h) * 60 + int(m)
    except (ValueError, AttributeError):
        return None


def _ack_url(block_id: str) -> str:
    token = os.environ.get("ACADEMICOS_TOKEN", "")
    q = f"?t={token}" if token else ""
    return f"/api/push/ack/{block_id}{q}"


def _morning_body(snap: dict) -> str:
    r = snap.get("report") or {}
    bloques = [b for b in snap.get("blocks", []) if not b.get("completed")]
    lineas = []
    pend = r.get("dueTodayMissions") or []
    venc = r.get("overdueMissions") or []
    if pend:
        lineas.append(f"📌 {len(pend)} para hoy: " + ", ".join(m["title"] for m in pend[:3]))
    if venc:
        lineas.append(f"🔥 {len(venc)} vencida(s)")
    if bloques:
        primero = min(bloques, key=lambda b: b.get("startTime", "99:99"))
        lineas.append(
            f"⏱️ {len(bloques)} bloque(s) — arranca {primero.get('startTime')} {primero.get('title')}",
        )
    examen = snap.get("nextExam")
    if examen:
        lineas.append(f"🎯 {examen['name']} en {examen['daysLeft']}d")
    if not lineas:
        lineas.append("Día limpio: sin pendientes ni bloques cargados. Carga tu plan.")
    return "\n".join(lineas)


def _night_body(snap: dict) -> str:
    r = snap.get("report") or {}
    acks = set(_load(K_ACKS, {}).get("blocks", []))
    sin_hacer = [
        b for b in snap.get("blocks", [])
        if not b.get("completed") and b.get("id") not in acks
    ]
    lineas = []
    hechos = r.get("completedBlocksToday", 0)
    total = r.get("totalScheduledBlocksToday", 0)
    mins = r.get("todayStudyMinutes", 0)
    meta = r.get("dailyGoalMinutes", 0)
    lineas.append(f"Bloques {hechos}/{total} · {mins}/{meta} min de meta")
    if sin_hacer:
        lineas.append("❌ Sin marcar: " + ", ".join(b["title"] for b in sin_hacer[:4]))
    venc = r.get("overdueMissions") or []
    if venc:
        lineas.append(f"⚠️ Mañana arrastras {len(venc)} misión(es) vencida(s)")
    if not sin_hacer and r.get("dailyGoalMet"):
        lineas.append("✅ Día cumplido. Duerme tranquilo.")
    return "\n".join(lineas)


def _overdue_body(venc: list[dict]) -> tuple[str, str]:
    peor = max((m.get("daysOverdue", 0) for m in venc), default=0)
    titulos = ", ".join(m["title"] for m in venc[:3])
    if peor >= 7:
        return (f"☠️ {len(venc)} misiones podridas (+{peor}d)", f"{titulos}. Ya no es olvido, es abandono.")
    if peor >= 3:
        return (f"🔥 {len(venc)} vencidas hace {peor} días", f"{titulos}. Cada día que pasa cuesta más.")
    return (f"⏳ {len(venc)} misión(es) vencida(s)", f"{titulos}. Márcala o muévela, pero no la ignores.")


def _exam_body(examen: dict) -> tuple[str, str]:
    d = examen["daysLeft"]
    if d <= 1:
        return ("🚨 EXAMEN MAÑANA" if d == 1 else "🚨 EXAMEN HOY", examen["name"])
    if d <= 3:
        return (f"⚔️ {examen['name']}: {d} días", "Ya no hay margen. Hoy toca repasar sí o sí.")
    return (f"🎯 {examen['name']}: {d} días", "Sigue empujando temas: en 3 días esto se pone feo.")


def due_events(snap: dict, sent: set[str], now: datetime) -> list[tuple[str, dict]]:
    """Eventos que toca mandar en este minuto. Pura: el self-check la usa."""
    hoy = now.date().isoformat()
    ahora = now.hour * 60 + now.minute
    r = snap.get("report") or {}
    fresco = snap.get("date") == hoy
    times = snap.get("times") or {}
    out: list[tuple[str, dict]] = []

    def at(key: str, hhmm: str | None, kind: str, payload: dict) -> None:
        t = _mins(hhmm)
        if t is None or key in sent:
            return
        atraso = ahora - t
        if atraso < 0 or atraso > CATCHUP_MIN[kind]:
            return
        out.append((key, payload))

    at(
        f"{hoy}:morning",
        times.get("morning", DEFAULT_MORNING),
        "morning",
        {
            "title": "☀️ Briefing del día",
            "body": _morning_body(snap) if fresco else "Abre Academic OS: no tengo datos de hoy.",
            "tag": "aos-morning",
            "url": "/?tab=agora",
        },
    )

    at(
        f"{hoy}:night",
        times.get("night", DEFAULT_NIGHT),
        "night",
        {
            "title": "🌙 Cierre del día",
            "body": _night_body(snap) if fresco else "Abre Academic OS y cierra el día.",
            "tag": "aos-night",
            "url": "/?tab=time",
        },
    )

    if not fresco:
        return out

    for b in snap.get("blocks", []):
        if b.get("completed"):
            continue
        bid = b.get("id", "")
        at(
            f"{hoy}:start:{bid}",
            b.get("startTime"),
            "block-start",
            {
                "title": f"▶️ {b.get('title')}",
                "body": f"Bloque {b.get('startTime')}–{b.get('endTime')}. Empieza ahora.",
                "tag": f"aos-start-{bid}",
                "url": "/?tab=time",
            },
        )
        at(
            f"{hoy}:end:{bid}",
            b.get("endTime"),
            "block-end",
            {
                "title": f"⏱️ ¿Completaste {b.get('title')}?",
                "body": f"El bloque {b.get('startTime')}–{b.get('endTime')} terminó.",
                "tag": f"aos-end-{bid}",
                "url": "/?tab=time",
                "requireInteraction": True,
                "ackUrl": _ack_url(bid),
                "actions": [
                    {"action": "done", "title": "Sí"},
                    {"action": "later", "title": "Después"},
                ],
            },
        )

    venc = r.get("overdueMissions") or []
    if venc:
        titulo, cuerpo = _overdue_body(venc)
        at(f"{hoy}:overdue", OVERDUE_HOUR, "overdue",
           {"title": titulo, "body": cuerpo, "tag": "aos-overdue", "url": "/?tab=missions"})

    examen = snap.get("nextExam")
    if examen and 0 <= examen.get("daysLeft", 99) <= 7:
        titulo, cuerpo = _exam_body(examen)
        at(f"{hoy}:exam", EXAM_HOUR, "exam",
           {"title": titulo, "body": cuerpo, "tag": "aos-exam", "url": "/?tab=courses"})

    return out


# ── Scheduler ───────────────────────────────────────────────────────────────

def tick(now: datetime | None = None) -> int:
    now = now or datetime.now(LIMA)
    hoy = now.date().isoformat()
    registro = _load(K_SENT, {})
    if registro.get("date") != hoy:
        registro = {"date": hoy, "keys": []}
        _save(K_ACKS, {"date": hoy, "blocks": []})
    enviados = set(registro["keys"])

    snap = _load(K_SNAPSHOT, {})
    if not snap:
        return 0

    n = 0
    for key, payload in due_events(snap, enviados, now):
        broadcast(payload)
        enviados.add(key)
        n += 1
    if n:
        registro["keys"] = sorted(enviados)
        _save(K_SENT, registro)
    return n


async def _loop() -> None:
    while True:
        try:
            await asyncio.to_thread(tick)
        except Exception:  # noqa: BLE001
            log.exception("Fallo en el tick del scheduler de push")
        await asyncio.sleep(60)


async def start_scheduler() -> None:
    asyncio.create_task(_loop())
    log.info("Scheduler de push arrancado (tick 60s, zona Lima UTC-5)")


# ── API ─────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/api/push", tags=["push"])


@router.get("/public-key")
def public_key():
    _, pub = vapid_keys()
    return {"key": pub}


@router.post("/subscribe")
async def subscribe(request: Request):
    sub = await request.json()
    endpoint = sub.get("endpoint")
    if not endpoint:
        raise ValueError("Falta 'endpoint' en la suscripción")
    subs = [s for s in _load(K_SUBS, []) if s.get("endpoint") != endpoint]
    subs.append(sub)
    _save(K_SUBS, subs)
    return {"ok": True, "count": len(subs)}


@router.post("/snapshot")
async def snapshot(request: Request):
    data = await request.json()
    _save(K_SNAPSHOT, data)
    return {"ok": True}


@router.post("/ack/{block_id}")
def ack(block_id: str):
    """El [Sí] de la notificación de fin de bloque: el servidor deja de contarlo
    como pendiente en el cierre nocturno. El XP se marca en la app."""
    hoy = datetime.now(LIMA).date().isoformat()
    acks = _load(K_ACKS, {})
    if acks.get("date") != hoy:
        acks = {"date": hoy, "blocks": []}
    if block_id not in acks["blocks"]:
        acks["blocks"].append(block_id)
    _save(K_ACKS, acks)
    return {"ok": True}


@router.post("/test")
def test():
    """Verificación manual: dispara un push ahora, sin esperar a las 7am."""
    n = broadcast({
        "title": "🔔 Prueba de Academic OS",
        "body": "Si ves esto con la app cerrada, el push funciona.",
        "tag": "aos-test",
        "url": "/",
        "actions": [{"action": "later", "title": "Ok"}],
    })
    return {"ok": True, "enviados": n}


@router.get("/status")
def status():
    snap = _load(K_SNAPSHOT, {})
    now = datetime.now(LIMA)
    return {
        "suscripciones": len(_load(K_SUBS, [])),
        "ahora_lima": now.isoformat(timespec="minutes"),
        "snapshot_date": snap.get("date"),
        "snapshot_savedAt": snap.get("savedAt"),
        "horarios": snap.get("times"),
        "enviados_hoy": _load(K_SENT, {}),
        "acks_hoy": _load(K_ACKS, {}),
    }


# ── Self-check ──────────────────────────────────────────────────────────────

def _demo() -> None:
    """python academic_os/api/push.py — verifica el disparo horario sin red."""
    snap = {
        "date": "2026-08-15",
        "times": {"morning": "07:00", "night": "22:00"},
        "report": {
            "overdueMissions": [{"title": "Seminario", "courseName": "Neuro", "daysOverdue": 4}],
            "dueTodayMissions": [{"title": "Leer cap 3", "courseName": "Neuro"}],
            "completedBlocksToday": 1,
            "totalScheduledBlocksToday": 3,
            "todayStudyMinutes": 60,
            "dailyGoalMinutes": 180,
            "dailyGoalMet": False,
        },
        "blocks": [
            {"id": "b1", "title": "Neuro", "startTime": "08:00", "endTime": "08:30", "completed": False},
        ],
        "nextExam": {"name": "Neuro — U2", "date": "2026-08-18", "daysLeft": 3},
    }

    def keys(hhmm: str, sent=frozenset()):
        h, m = map(int, hhmm.split(":"))
        now = datetime(2026, 8, 15, h, m, tzinfo=LIMA)
        return [k for k, _ in due_events(snap, set(sent), now)]

    assert keys("07:00") == ["2026-08-15:morning"], keys("07:00")
    assert keys("07:30") == ["2026-08-15:morning"], "catch-up dentro de 2h"
    assert "2026-08-15:morning" not in keys("10:00"), "briefing viejo NO se manda a las 10"
    ya = {"2026-08-15:morning"}
    assert keys("08:00", ya) == ["2026-08-15:start:b1"], keys("08:00", ya)
    assert keys("08:30", ya) == ["2026-08-15:end:b1"], keys("08:30", ya)
    assert keys("08:45", ya) == [], "el fin de bloque no revive 15 min después"
    assert keys("09:00", ya) == ["2026-08-15:exam"], keys("09:00", ya)
    assert keys("13:00") == ["2026-08-15:overdue"], keys("13:00")
    assert keys("22:00") == ["2026-08-15:night"], keys("22:00")
    assert keys("22:00", {"2026-08-15:night"}) == [], "no se repite lo ya enviado"

    stale = dict(snap, date="2026-08-14")
    now = datetime(2026, 8, 15, 8, 0, tzinfo=LIMA)
    ks = [k for k, _ in due_events(stale, ya, now)]
    assert ks == [], f"snapshot viejo no dispara bloques ni datos de ayer: {ks}"

    body = _morning_body(snap)
    assert "Leer cap 3" in body and "en 3d" in body, body
    print("ok — due_events y redacción")


if __name__ == "__main__":
    _demo()
