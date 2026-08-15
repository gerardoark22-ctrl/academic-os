"""Lógica del modo examen inminente."""

from datetime import date, timedelta

import database as db


def is_active() -> bool:
    if db.get_config("modo_examen_inminente", "0") != "1":
        return False
    return len(get_examenes_activos()) > 0


def get_examenes_activos() -> list[dict]:
    out = []
    for ex in db.get_examenes_proximos():
        dias = ex.get("dias_restantes")
        if dias is not None and dias <= 14:
            out.append(ex)
    return out


def get_temas_pendientes_criticos() -> list[dict]:
    """Temas sin dominar de unidades con examen <= 14 días."""
    crit_ids = {ex["id"] for ex in get_examenes_activos()}
    out = []
    for c in db.get_cursos():
        for u in db.get_unidades(c["id"]):
            if u["id"] not in crit_ids:
                continue
            for t in db.get_temas(u["id"]):
                if t["dominio"] != "lo_tengo":
                    out.append({**t, "curso_nombre": c["nombre"], "unidad_nombre": u["nombre"]})
    return out


def get_plan_foco_hoy() -> list[str]:
    """Acciones sugeridas para el día en modo examen."""
    acciones = []
    for ex in get_examenes_activos()[:3]:
        dias = ex.get("dias_restantes", "?")
        pct = int(ex.get("avance", 0) * 100)
        acciones.append(f"📅 {ex['curso_nombre']} — {ex['nombre']}: {dias}d, {pct}% listo")
    for t in get_temas_pendientes_criticos()[:5]:
        acciones.append(f"📚 Repasar: {t['nombre']} ({t['curso_nombre']})")
    tareas = [t for t in db.get_tareas() if t["estado"] != "completada"
              and t.get("prioridad") in ("urgente", "importante")]
    for t in tareas[:3]:
        acciones.append(f"✅ Tarea: {t['titulo']}")
    if not acciones:
        acciones.append("Sin urgencias — mantén el ritmo de repaso.")
    return acciones


def auto_priorizar_tareas() -> int:
    """Marca urgentes las tareas ligadas a exámenes <= 7 días."""
    n = 0
    curso_ids = {ex["curso_id"] for ex in get_examenes_activos() if ex.get("dias_restantes", 99) <= 7}
    for t in db.get_tareas():
        if t["estado"] == "completada":
            continue
        if t.get("curso_id") in curso_ids and t.get("prioridad") != "urgente":
            db.actualizar_tarea(t["id"], prioridad="urgente")
            n += 1
    return n
