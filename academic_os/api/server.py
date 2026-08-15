"""API REST — Academic OS (web + Android PWA)."""

import json
import logging
import os
import smtplib
import sys
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import date
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# `database` vive un nivel arriba. Sin esto el import solo funciona si quien
# arranca el server ya puso academic_os/ en sys.path (uvicorn CLI lo hace por
# casualidad; gunicorn o un IDE no).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import database as db  # noqa: E402
from ai.openai_client import AcademicAI  # noqa: E402


def _odyssey_dir() -> Path:
    """Build de la PWA React (Odyssey of Gerardex)."""
    candidates = [
        Path(__file__).parent.parent.parent / "academic-os" / "dist",
        Path(__file__).parent.parent / "odyssey",
    ]
    if getattr(sys, "frozen", False):
        candidates.insert(0, Path(sys._MEIPASS) / "odyssey")
    for dist in candidates:
        if dist.exists() and (dist / "index.html").exists():
            return dist
    return candidates[0]


def _web_dir() -> Path:
    odyssey = _odyssey_dir()
    if odyssey.exists() and (odyssey / "index.html").exists():
        return odyssey
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS) / "web"
    return Path(__file__).parent.parent / "web"


WEB_DIR = _web_dir()

# Evita que el navegador/PWA sirva index.html o SW obsoletos tras un nuevo build.
_NO_CACHE_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
}


def _file_response(path: Path, *, no_cache: bool = False) -> FileResponse:
    headers = _NO_CACHE_HEADERS if no_cache else None
    return FileResponse(path, headers=headers)


def _enviar_correo(destinatario: str, asunto: str, cuerpo: str, html: str | None = None) -> bool:
    """Envía por el SMTP de .env. Devuelve False (sin lanzar) si no está configurado."""
    smtp_host = os.environ.get("ACADEMICOS_SMTP_HOST")
    smtp_user = os.environ.get("ACADEMICOS_SMTP_USER")
    smtp_pass = os.environ.get("ACADEMICOS_SMTP_PASS")
    smtp_from = os.environ.get("ACADEMICOS_SMTP_FROM", smtp_user or "academic-os@localhost")
    if not (smtp_host and smtp_user and smtp_pass):
        return False

    if html:
        msg = MIMEMultipart("alternative")
        msg.attach(MIMEText(cuerpo, "plain", "utf-8"))
        html_part = MIMEText(html, "html", "utf-8")
        html_part.set_charset("utf-8")
        msg.attach(html_part)
    else:
        msg = MIMEText(cuerpo, "plain", "utf-8")
    msg["Subject"] = asunto
    msg["From"] = smtp_from
    msg["To"] = destinatario
    msg["MIME-Version"] = "1.0"
    port = int(os.environ.get("ACADEMICOS_SMTP_PORT", "587"))
    with smtplib.SMTP(smtp_host, port, timeout=15) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_from, [destinatario], msg.as_string())
    return True


def create_app() -> FastAPI:
    app = FastAPI(title="Academic OS API", version="2.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Con el túnel de Cloudflare la URL queda expuesta a internet. Si defines
    # ACADEMICOS_TOKEN, la API exige ese token; sin la variable no pide nada
    # (uso local en tu WiFi, sin fricción). CORS no protege de un curl: el
    # token sí.
    @app.middleware("http")
    async def exigir_token(request: Request, call_next):
        token = os.environ.get("ACADEMICOS_TOKEN", "")
        ruta = request.url.path
        rutas_publicas = {"/api/health", "/api/auth/solicitar-codigo", "/api/auth/verificar-codigo"}
        if token and ruta.startswith("/api/") and ruta not in rutas_publicas:
            enviado = request.headers.get("X-Token") or request.query_params.get("t", "")
            if enviado != token:
                return JSONResponse({"detail": "Token inválido"}, status_code=401)
        return await call_next(request)

    @app.exception_handler(ValueError)
    async def datos_invalidos(_request: Request, exc: ValueError):
        # Falta un campo obligatorio: es culpa del pedido, no del servidor.
        return JSONResponse({"detail": str(exc)}, status_code=400)

    @app.on_event("startup")
    def startup():
        db.init_db()
        db.auto_purga_completadas_diaria()

    @app.get("/api/health")
    def health():
        return {"ok": True, "version": "2.0"}

    @app.get("/api/dashboard")
    def dashboard():
        hoy = date.today().isoformat()
        done, total, pct = db.progreso_dia(hoy)
        return {
            "saludo": db.get_config("nombre_usuario", "Estudiante"),
            "fecha": hoy,
            "dominio": db.resumen_dominio_global(),
            "examenes": db.get_examenes_proximos()[:6],
            "misiones": db.get_misiones_hoy(),
            "bloques": db.get_bloques(hoy),
            "bloque_actual": db.get_bloque_actual(),
            "progreso_dia": {"done": done, "total": total, "pct": pct},
            "tareas_pendientes": db.contar_tareas_pendientes(),
            "racha": db.get_racha_dias(),
        }

    @app.get("/api/tareas")
    def listar_tareas(estado: Optional[str] = None):
        return db.get_tareas(estado)

    @app.get("/api/tareas/{tarea_id}")
    def obtener_tarea(tarea_id: int):
        t = db.get_tarea(tarea_id)
        if not t:
            raise HTTPException(404, "Tarea no encontrada")
        return t

    @app.post("/api/tareas")
    def crear_tarea(body: dict[str, Any]):
        tid = db.crear_tarea(**{k: v for k, v in body.items() if v is not None})
        return db.get_tarea(tid)

    @app.patch("/api/tareas/{tarea_id}")
    def actualizar_tarea(tarea_id: int, body: dict[str, Any]):
        if not db.get_tarea(tarea_id):
            raise HTTPException(404, "Tarea no encontrada")
        db.actualizar_tarea(tarea_id, **body)
        return db.get_tarea(tarea_id)

    @app.delete("/api/tareas/{tarea_id}")
    def borrar_tarea(tarea_id: int):
        db.eliminar_tarea(tarea_id)
        return {"ok": True}

    @app.post("/api/tareas/{tarea_id}/completar")
    def completar_tarea(tarea_id: int):
        db.completar_tarea(tarea_id)
        return {"ok": True}

    @app.get("/api/cursos")
    def listar_cursos():
        out = []
        for c in db.get_cursos():
            dom, tot, av = db.avance_curso(c["id"])
            out.append({**c, "dominados": dom, "total_temas": tot, "avance": av})
        return out

    @app.get("/api/cursos/{curso_id}")
    def curso_detalle(curso_id: int):
        c = db.get_curso(curso_id)
        if not c:
            raise HTTPException(404, "Curso no encontrado")
        unidades = []
        for u in db.get_unidades(curso_id):
            dom, tot, av = db.avance_unidad(u["id"])
            temas = db.get_temas(u["id"])
            unidades.append({
                **u,
                "dominados": dom,
                "total_temas": tot,
                "avance": av,
                "dias_examen": db.dias_restantes(u.get("fecha_examen")),
                "temas": temas,
            })
        dom, tot, av = db.avance_curso(curso_id)
        return {**c, "unidades": unidades, "dominados": dom, "total_temas": tot, "avance": av}

    @app.patch("/api/temas/{tema_id}")
    def actualizar_tema(tema_id: int, body: dict[str, Any]):
        db.actualizar_tema(tema_id, **body)
        return {"ok": True}

    @app.get("/api/bloques")
    def listar_bloques(fecha: Optional[str] = None):
        f = fecha or date.today().isoformat()
        done, total, pct = db.progreso_dia(f)
        return {
            "fecha": f,
            "bloques": db.get_bloques(f),
            "bloque_actual": db.get_bloque_actual() if f == date.today().isoformat() else None,
            "progreso": {"done": done, "total": total, "pct": pct},
            "racha": db.get_racha_dias(),
        }

    @app.post("/api/bloques")
    def crear_bloque(body: dict[str, Any]):
        if "fecha" not in body:
            body["fecha"] = date.today().isoformat()
        bid = db.crear_bloque(**body)
        return db.get_bloque(bid)

    @app.post("/api/bloques/{bloque_id}/completar")
    def completar_bloque(bloque_id: int):
        db.completar_bloque(bloque_id)
        return {"ok": True}

    @app.get("/api/riesgo")
    def riesgo():
        return db.get_resumen_riesgo()

    @app.get("/api/config")
    def obtener_config():
        return {
            "nombre_usuario": db.get_config("nombre_usuario", "Estudiante"),
            "notif_hora_tarde": db.get_config("notif_hora_tarde", "14:00"),
            "notif_hora_noche": db.get_config("notif_hora_noche", "21:00"),
            "meta_horas_semanal": db.get_config("meta_horas_semanal", "20"),
            "ia_configurada": bool(db.get_ai_api_key()),
        }

    class ConfigBody(BaseModel):
        nombre_usuario: Optional[str] = None
        deepseek_api_key: Optional[str] = None
        notif_hora_tarde: Optional[str] = None
        notif_hora_noche: Optional[str] = None
        meta_horas_semanal: Optional[str] = None

    @app.post("/api/config")
    def guardar_config(body: ConfigBody):
        data = body.model_dump(exclude_none=True)
        for k, v in data.items():
            db.set_config(k, str(v))
        return {"ok": True}

    @app.post("/api/ai/priorizar")
    def ai_priorizar():
        ai = AcademicAI(db.get_ai_api_key())
        tareas = [t for t in db.get_tareas() if t["estado"] != "completada"]
        done, total, _ = db.progreso_dia(date.today().isoformat())
        hrs = max(1, (total - done) * 0.5)
        try:
            msg = ai.priorizar_tareas(tareas, hrs)
            return {"ok": True, "mensaje": msg}
        except Exception as e:
            raise HTTPException(500, str(e)) from e

    class ShameNotifyBody(BaseModel):
        email: str
        subject: str
        body: str
        html: str | None = None
        days: int = 1

    @app.post("/api/shame-notify")
    def shame_notify(payload: ShameNotifyBody):
        """Envía email de vergüenza (HTML + texto plano) si SMTP está configurado."""
        enviado = _enviar_correo(payload.email, payload.subject, payload.body, payload.html)
        if enviado:
            return {"ok": True, "sent": True}
        logging.getLogger("academic_os.shame").warning(
            "Shame email (SMTP no configurado): to=%s days=%s", payload.email, payload.days,
        )
        return {"ok": True, "sent": False, "message": "SMTP no configurado — usa mailto en cliente"}

    # ── Login por código de correo (celular ↔ tu correo) ────────────────────
    # No usa contraseña ni Google: el servidor manda un código de 6 dígitos al
    # ÚNICO correo autorizado (ACADEMICOS_OWNER_EMAIL) por el mismo SMTP que ya
    # usa el email de "vergüenza". Acertar el código te da el token de sync.
    # ponytail: código en la tabla config con expiración, no una tabla nueva
    # ni JWT — alcanza para un dueño con un puñado de dispositivos.
    CODE_TTL_SEG = 5 * 60
    CODE_MAX_INTENTOS = 5

    class SolicitarCodigoBody(BaseModel):
        email: str

    class VerificarCodigoBody(BaseModel):
        email: str
        codigo: str

    @app.post("/api/auth/solicitar-codigo")
    def solicitar_codigo(payload: SolicitarCodigoBody):
        dueno = os.environ.get("ACADEMICOS_OWNER_EMAIL", "").strip().lower()
        if not dueno:
            raise HTTPException(500, "ACADEMICOS_OWNER_EMAIL no está configurado en el .env")
        if payload.email.strip().lower() != dueno:
            raise HTTPException(403, "Ese correo no está autorizado")

        import random

        codigo = f"{random.randint(0, 999999):06d}"
        vence = int(time.time()) + CODE_TTL_SEG
        db.set_config("auth_codigo", codigo)
        db.set_config("auth_codigo_vence", str(vence))
        db.set_config("auth_codigo_intentos", "0")

        enviado = _enviar_correo(
            dueno,
            "Tu código de Academic OS",
            f"Tu código para conectar este dispositivo es: {codigo}\n\nVence en 5 minutos.",
        )
        if not enviado:
            raise HTTPException(500, "No se pudo enviar el correo — revisa el SMTP en .env")
        return {"ok": True}

    @app.post("/api/auth/verificar-codigo")
    def verificar_codigo(payload: VerificarCodigoBody):
        dueno = os.environ.get("ACADEMICOS_OWNER_EMAIL", "").strip().lower()
        if not dueno or payload.email.strip().lower() != dueno:
            raise HTTPException(403, "Ese correo no está autorizado")

        guardado = db.get_config("auth_codigo", "")
        vence = int(db.get_config("auth_codigo_vence", "0") or 0)
        intentos = int(db.get_config("auth_codigo_intentos", "0") or 0)

        if not guardado or time.time() > vence:
            raise HTTPException(401, "Código vencido — pide uno nuevo")
        if intentos >= CODE_MAX_INTENTOS:
            raise HTTPException(401, "Demasiados intentos — pide un código nuevo")
        if payload.codigo.strip() != guardado:
            db.set_config("auth_codigo_intentos", str(intentos + 1))
            raise HTTPException(401, "Código incorrecto")

        db.set_config("auth_codigo", "")  # un solo uso
        token = os.environ.get("ACADEMICOS_TOKEN", "")
        return {"ok": True, "token": token}

    # ── Sync Odyssey (laptop ↔ Android) ─────────────────────────────────────
    # El frontend React guarda todo en IndexedDB (una copia por dispositivo).
    # Estos dos endpoints le dan un punto de encuentro: cada equipo sube su
    # snapshot con la hora en que lo generó, y baja el del otro si es más nuevo.
    # ponytail: last-write-wins sobre el snapshot completo. Alcanza para 1
    # usuario con 2 equipos que no edita en ambos a la vez; si algún día edita
    # en paralelo offline, el último en subir gana y el otro queda en
    # odyssey_state_prev. Merge por fila necesitaría updated_at por registro.

    class StateBody(BaseModel):
        base: int = 0  # versión que el dispositivo creía tener
        data: dict[str, Any]
        force: bool = False

    def _version_actual() -> int:
        return int(db.get_config("odyssey_state_at", "0") or 0)

    @app.get("/api/state")
    def get_state():
        raw = db.get_config("odyssey_state", "")
        if not raw:
            return {"updated_at": 0, "data": None}
        return {"updated_at": _version_actual(), "data": json.loads(raw)}

    @app.put("/api/state")
    def put_state(body: StateBody):
        actual = _version_actual()
        # Compare-and-swap: si el servidor cambió desde que este equipo bajó
        # (el otro dispositivo subió algo), avisamos en vez de pisar a ciegas.
        if actual and body.base != actual and not body.force:
            return JSONResponse(
                {"ok": False, "conflict": True, "updated_at": actual}, status_code=409,
            )
        previo = db.get_config("odyssey_state", "")
        if previo:
            db.set_config("odyssey_state_prev", previo)
            db.set_config("odyssey_state_prev_at", str(actual))
        # La versión la pone el reloj del servidor: así un celular con la hora
        # desfasada no rompe el orden de las versiones.
        nueva = int(time.time() * 1000)
        db.set_config("odyssey_state", json.dumps(body.data))
        db.set_config("odyssey_state_at", str(nueva))
        return {"ok": True, "updated_at": nueva}

    @app.get("/api/export")
    def export_snapshot():
        """Snapshot completo para migración a PWA Odyssey."""
        tablas = ["cursos", "unidades", "temas", "subtemas", "tareas", "bloques", "sesiones", "config"]
        data: dict[str, Any] = {}
        with db.get_connection() as conn:
            for t in tablas:
                data[t] = [dict(r) for r in conn.execute(f"SELECT * FROM {t}").fetchall()]
        return data

    @app.get("/")
    def index():
        index_path = WEB_DIR / "index.html"
        if index_path.exists():
            return _file_response(index_path, no_cache=True)
        return {"message": "Academic OS API"}

    @app.get("/manifest.json")
    def manifest():
        p = WEB_DIR / "manifest.json"
        if p.exists():
            return FileResponse(p, media_type="application/manifest+json", headers=_NO_CACHE_HEADERS)
        raise HTTPException(404)

    @app.get("/sw.js")
    def service_worker():
        p = WEB_DIR / "sw.js"
        if p.exists():
            return FileResponse(p, media_type="application/javascript", headers=_NO_CACHE_HEADERS)
        raise HTTPException(404)

    @app.get("/registerSW.js")
    def register_sw():
        p = WEB_DIR / "registerSW.js"
        if p.exists():
            return FileResponse(p, media_type="application/javascript", headers=_NO_CACHE_HEADERS)
        raise HTTPException(404)

    if WEB_DIR.exists():
        assets_dir = WEB_DIR / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
        icons_dir = WEB_DIR / "icons"
        if icons_dir.exists():
            app.mount("/icons", StaticFiles(directory=icons_dir), name="icons")
        # Legacy web estático
        legacy = Path(__file__).parent.parent / "web"
        if legacy.exists() and not (WEB_DIR / "assets").exists():
            app.mount("/static", StaticFiles(directory=legacy), name="static")

        @app.get("/{full_path:path}")
        def spa_fallback(full_path: str):
            if full_path.startswith("api/"):
                raise HTTPException(404)
            static = WEB_DIR / full_path
            if static.is_file():
                no_cache = static.suffix.lower() in {".html", ".json"} or static.name in {
                    "manifest.json",
                    "sw.js",
                    "registerSW.js",
                }
                return _file_response(static, no_cache=no_cache)
            index_path = WEB_DIR / "index.html"
            if index_path.exists():
                return _file_response(index_path, no_cache=True)
            raise HTTPException(404)

    return app


app = create_app()
