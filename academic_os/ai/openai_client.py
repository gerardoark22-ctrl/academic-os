"""Cliente DeepSeek (API compatible con OpenAI) — Academic OS v2."""

import json
import threading
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from datetime import date
from typing import Any, Callable

try:
    from openai import OpenAI
    _OPENAI_OK = True
except ImportError:
    _OPENAI_OK = False

from config import DEEPSEEK_BASE_URL, DEEPSEEK_MODEL, PRIORIDAD_LABELS

TIMEOUT = 30
_executor = ThreadPoolExecutor(max_workers=6)
_worker = threading.local()

def _compact_tarea(t: dict) -> dict:
    """Payload mínimo para la API — menos tokens, respuesta más rápida."""
    return {
        "titulo": (t.get("titulo") or "")[:80],
        "fecha": t.get("fecha_limite"),
        "prioridad": t.get("prioridad", "normal"),
        "min": t.get("duracion_min", 30),
        "curso": (t.get("curso_nombre") or "")[:40],
    }


def priorizar_tareas_local(tareas: list[dict], horas_disponibles: float) -> str:
    """Priorización instantánea sin API — siempre disponible."""
    hoy = date.today()
    scored: list[tuple[int, dict]] = []

    for t in tareas:
        if t.get("estado") == "completada":
            continue
        score = 0
        pr = t.get("prioridad", "normal")
        if pr == "urgente":
            score += 100
        elif pr == "importante":
            score += 50

        fl = t.get("fecha_limite")
        if fl:
            try:
                delta = (date.fromisoformat(fl) - hoy).days
                if delta < 0:
                    score += 200
                elif delta == 0:
                    score += 80
                elif delta == 1:
                    score += 60
                elif delta <= 3:
                    score += 40
                elif delta <= 7:
                    score += 20
            except ValueError:
                pass
        else:
            score += 5

        scored.append((score, t))

    if not scored:
        return "✅ No hay tareas pendientes. ¡Buen trabajo!"

    scored.sort(key=lambda x: (-x[0], x[1].get("duracion_min", 30)))
    mins_disp = max(30, int(horas_disponibles * 60))
    used = 0
    lines = [
        f"⚡ Sugerencia rápida ({int(horas_disponibles)}h ≈ {mins_disp} min)\n",
        "Orden recomendado para hoy:\n",
    ]

    for i, (_, t) in enumerate(scored[:12], 1):
        dur = int(t.get("duracion_min", 30))
        if used + dur > mins_disp and i > 1:
            restantes = len(scored) - i + 1
            lines.append(f"\n⏸ Sin cupo hoy: {restantes} tarea(s) más — reprograma o reduce duración.")
            break
        pr_lbl = PRIORIDAD_LABELS.get(t.get("prioridad", "normal"), "🟢 NORMAL")
        fl_txt = t.get("fecha_limite") or "sin fecha"
        curso = t.get("curso_nombre") or "—"
        lines.append(f"{i}. {t['titulo']} ({dur}m)")
        lines.append(f"   {pr_lbl} · 📅 {fl_txt} · {curso}")
        used += dur

    lines.append(f"\n💡 Tiempo planificado: ~{used} min de {mins_disp} min disponibles.")
    if len(scored) > 1:
        top = scored[0][1]["titulo"]
        lines.append(f"\n🎯 Empieza por: «{top[:50]}»")
    return "\n".join(lines)


class AcademicAI:
    MODEL = DEEPSEEK_MODEL
    BASE_URL = DEEPSEEK_BASE_URL

    def __init__(self, api_key: str = ""):
        self.api_key = api_key
        self._client = None

    def set_api_key(self, key: str):
        self.api_key = key
        self._client = None

    def _client_or_raise(self):
        if not _OPENAI_OK:
            raise RuntimeError("Instala openai: pip install openai")
        if not self.api_key:
            raise RuntimeError("Configura tu API Key de DeepSeek en ⚙️ Configuración")
        if self._client is None:
            self._client = OpenAI(api_key=self.api_key, base_url=self.BASE_URL, timeout=TIMEOUT)
        return self._client

    def _http_completion(
        self, system: str, user: str, *, max_tokens: int = 900, temperature: float = 0.4,
    ) -> str:
        client = self._client_or_raise()
        r = client.chat.completions.create(
            model=self.MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return r.choices[0].message.content or ""

    def run_async(        self,
        widget,
        fn: Callable[[], Any],
        on_success: Callable[[Any], None],
        on_error: Callable[[Exception], None] | None = None,
        poll_ms: int = 120,
    ) -> None:
        """Ejecuta fn en background sin bloquear la UI de CustomTkinter."""
        future = _executor.submit(fn)

        def poll():
            if not widget.winfo_exists():
                return
            if future.done():
                try:
                    on_success(future.result())
                except Exception as e:
                    if on_error:
                        on_error(e)
                return
            widget.after(poll_ms, poll)

        widget.after(poll_ms, poll)

    def _call(self, system: str, user: str, *, max_tokens: int = 900, temperature: float = 0.4) -> str:
        if getattr(_worker, "active", False):
            try:
                return self._http_completion(
                    system, user, max_tokens=max_tokens, temperature=temperature,
                )
            except Exception as e:
                raise RuntimeError(f"Error de API DeepSeek: {e}") from e

        def _do():
            _worker.active = True
            try:
                return self._http_completion(
                    system, user, max_tokens=max_tokens, temperature=temperature,
                )
            finally:
                _worker.active = False

        future = _executor.submit(_do)
        try:
            return future.result(timeout=TIMEOUT)
        except FuturesTimeout:
            raise RuntimeError("La IA tardó demasiado (>30s). Usa la sugerencia rápida local.")
        except Exception as e:
            raise RuntimeError(f"Error de API DeepSeek: {e}") from e
    def _call_json(self, system: str, user: str) -> Any:
        text = self._call(system + "\nResponde SOLO con JSON válido.", user, max_tokens=600, temperature=0.2)
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        return json.loads(text)

    def generar_plan_dia(self, tareas_pendientes, bloques_disponibles, examenes_proximos) -> str:
        plan, _ = self.generar_plan_dia_completo(
            tareas_pendientes, bloques_disponibles, examenes_proximos,
        )
        return plan

    def generar_plan_dia_bloques(self, contexto: dict) -> list[dict]:
        _, bloques = self.generar_plan_dia_completo(
            contexto.get("tareas_pendientes", []),
            contexto.get("bloques_hoy", []),
            contexto.get("examenes", []),
            horas_disponibles=contexto.get("horas_disponibles", 4),
        )
        return bloques

    def generar_plan_dia_completo(
        self,
        tareas_pendientes,
        bloques_disponibles,
        examenes_proximos,
        *,
        horas_disponibles: float = 4,
    ) -> tuple[str, list[dict]]:
        system = (
            "Coach académico. Plan de estudio para HOY en español. "
            'JSON: {"plan":"texto con viñetas y horarios (máx 12 líneas)",'
            '"bloques":[{"hora_inicio":"HH:MM","hora_fin":"HH:MM","titulo":"...",'
            '"tipo":"estudio","curso_nombre":"..."}]}'
        )
        payload = {
            "tareas": [_compact_tarea(t) for t in tareas_pendientes[:15]],
            "bloques_libres": len(bloques_disponibles),
            "horas": horas_disponibles,
            "examenes": [
                {"curso": e.get("curso_nombre"), "dias": e.get("dias_restantes")}
                for e in (examenes_proximos or [])[:5]
            ],
        }
        try:
            data = self._call_json(system, json.dumps(payload, ensure_ascii=False, default=str))
            plan = data.get("plan") or data.get("texto") or ""
            bloques = data.get("bloques") or []
            if plan or bloques:
                return plan, bloques
        except (json.JSONDecodeError, RuntimeError):
            pass
        plan = self._call(
            "Coach académico. Plan de estudio para HOY en español, máx 12 viñetas.",
            json.dumps(payload, ensure_ascii=False, default=str),
            max_tokens=700,
        )
        try:
            bloques = self._call_json(
                'Genera bloques. JSON: {"bloques":[{"hora_inicio":"HH:MM","hora_fin":"HH:MM","titulo":"...","tipo":"estudio"}]}',
                json.dumps({"horas": horas_disponibles, "tareas": payload["tareas"][:10]}, default=str),
            ).get("bloques", [])
        except (json.JSONDecodeError, RuntimeError):
            bloques = []
        return plan, bloques

    def priorizar_tareas(self, tareas, horas_disponibles) -> str:
        system = (
            "Prioriza tareas académicas. Español, lista numerada corta (máx 8 ítems). "
            "Indica por qué y cuánto tiempo dedicar."
        )
        compact = [_compact_tarea(t) for t in tareas if t.get("estado") != "completada"][:20]
        user = f"Horas disponibles: {horas_disponibles}\n{json.dumps(compact, ensure_ascii=False)}"
        return self._call(system, user, max_tokens=500, temperature=0.3)

    def priorizar_tareas_local(self, tareas, horas_disponibles) -> str:
        return priorizar_tareas_local(tareas, horas_disponibles)

    def redistribuir_plan(self, bloques_pendientes, horas_restantes) -> str:
        plan, _ = self.redistribuir_plan_completo(bloques_pendientes, horas_restantes)
        return plan

    def redistribuir_plan_bloques(self, bloques_pendientes, horas_restantes) -> list[dict]:
        _, bloques = self.redistribuir_plan_completo(bloques_pendientes, horas_restantes)
        return bloques

    def redistribuir_plan_completo(
        self, bloques_pendientes, horas_restantes,
    ) -> tuple[str, list[dict]]:
        system = (
            "Reorganiza bloques pendientes para el tiempo restante del día. Español. "
            'JSON: {"plan":"texto breve","bloques":[{"hora_inicio":"HH:MM","hora_fin":"HH:MM",'
            '"titulo":"...","tipo":"estudio"}]}'
        )
        payload = {"horas": horas_restantes, "bloques": bloques_pendientes[:12]}
        try:
            data = self._call_json(system, json.dumps(payload, ensure_ascii=False, default=str))
            plan = data.get("plan") or data.get("texto") or ""
            bloques = data.get("bloques") or []
            if plan or bloques:
                return plan, bloques
        except (json.JSONDecodeError, RuntimeError):
            pass
        plan = self._call(
            "Reorganiza bloques pendientes para el tiempo restante del día. Español, plan breve.",
            json.dumps(payload, ensure_ascii=False, default=str),
            max_tokens=500,
        )
        try:
            bloques = self._call_json(
                'JSON: {"bloques":[{"hora_inicio":"HH:MM","hora_fin":"HH:MM","titulo":"...","tipo":"estudio"}]}',
                json.dumps(payload, default=str),
            ).get("bloques", [])
        except (json.JSONDecodeError, RuntimeError):
            bloques = []
        return plan, bloques

    def extraer_temas_syllabus(self, texto_syllabus: str) -> list[dict]:
        system = 'Extrae temas de syllabus. JSON: {"temas":[{"nombre":"...","prioridad":"alta|media|baja","fuente":"ppt|libro|ambos"}]}'
        try:
            return self._call_json(system, texto_syllabus[:8000]).get("temas", [])
        except (json.JSONDecodeError, RuntimeError):
            return []

    def feedback_nocturno(self, resumen_dia, curso_critico: str) -> str:
        system = "Coach académico nocturno. Feedback breve (máx 6 líneas), motivador, en español."
        user = json.dumps({"resumen": resumen_dia, "curso_critico": curso_critico}, default=str)
        return self._call(system, user, max_tokens=350)

    def estimar_tiempo_tarea(self, descripcion: str) -> int:
        system = 'Estima minutos. JSON: {"minutos": 30}'
        try:
            return int(self._call_json(system, descripcion[:500]).get("minutos", 30))
        except (json.JSONDecodeError, RuntimeError, ValueError):
            return 30

    def generar_plan_rescate(self, curso, horas_disponibles, temas_pendientes) -> str:
        system = (
            "Plan de rescate de emergencia para curso en riesgo. "
            "Horas limitadas. Español, acciones concretas por bloques (máx 10 líneas)."
        )
        user = json.dumps({
            "curso": curso,
            "horas": horas_disponibles,
            "temas": (temas_pendientes or [])[:8],
        }, ensure_ascii=False, default=str)
        return self._call(system, user, max_tokens=600)

    def generar_reporte_semanal(self, datos_semana: dict) -> str:
        system = (
            "Reporte semanal académico breve: logros, áreas débiles, 3 recomendaciones. Español."
        )
        return self._call(system, json.dumps(datos_semana, ensure_ascii=False, default=str), max_tokens=800)
