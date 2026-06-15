"""API REST — Academic OS (web + Android PWA)."""

import sys
from datetime import date
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import database as db
from ai.openai_client import AcademicAI


def _web_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS) / "web"
    return Path(__file__).parent.parent / "web"


WEB_DIR = _web_dir()


def create_app() -> FastAPI:
    app = FastAPI(title="Academic OS API", version="2.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

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

    @app.get("/")
    def index():
        index_path = WEB_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        return {"message": "Academic OS API"}

    if WEB_DIR.exists():
        app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")

    @app.get("/manifest.json")
    def manifest():
        p = WEB_DIR / "manifest.json"
        if p.exists():
            return FileResponse(p, media_type="application/manifest+json")
        raise HTTPException(404)

    @app.get("/sw.js")
    def service_worker():
        p = WEB_DIR / "sw.js"
        if p.exists():
            return FileResponse(p, media_type="application/javascript")
        raise HTTPException(404)

    return app


app = create_app()
