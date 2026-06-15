"""Cliente DeepSeek (API compatible con OpenAI) — Academic OS v2."""

import json
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from typing import Any

try:
    from openai import OpenAI
    _OPENAI_OK = True
except ImportError:
    _OPENAI_OK = False

from config import DEEPSEEK_BASE_URL, DEEPSEEK_MODEL

TIMEOUT = 45
_executor = ThreadPoolExecutor(max_workers=2)


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
            self._client = OpenAI(api_key=self.api_key, base_url=self.BASE_URL)
        return self._client

    def _call(self, system: str, user: str) -> str:
        def _do():
            client = self._client_or_raise()
            r = client.chat.completions.create(
                model=self.MODEL,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=0.7,
            )
            return r.choices[0].message.content or ""

        future = _executor.submit(_do)
        try:
            return future.result(timeout=TIMEOUT)
        except FuturesTimeout:
            raise RuntimeError("La IA tardó demasiado (>45s). Intenta de nuevo.")
        except Exception as e:
            raise RuntimeError(f"Error de API DeepSeek: {e}") from e

    def _call_json(self, system: str, user: str) -> Any:
        text = self._call(system + "\nResponde SOLO con JSON válido.", user)
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        return json.loads(text)

    def generar_plan_dia(self, tareas_pendientes, bloques_disponibles, examenes_proximos) -> str:
        system = (
            "Eres coach académico elite. Genera plan de estudio para HOY en español. "
            "Formato: bloques horarios, prioridades, descansos. Motivador y concreto."
        )
        user = json.dumps({
            "tareas": tareas_pendientes,
            "bloques": bloques_disponibles,
            "examenes": examenes_proximos,
        }, ensure_ascii=False, indent=2, default=str)
        return self._call(system, user)

    def generar_plan_dia_bloques(self, contexto: dict) -> list[dict]:
        system = (
            'Genera bloques de estudio. JSON: {"bloques":[{"hora_inicio":"HH:MM","hora_fin":"HH:MM","titulo":"...","tipo":"estudio","curso_nombre":"..."}]}'
        )
        try:
            return self._call_json(system, json.dumps(contexto, ensure_ascii=False, default=str)).get("bloques", [])
        except (json.JSONDecodeError, RuntimeError):
            return []

    def priorizar_tareas(self, tareas, horas_disponibles) -> str:
        system = "Prioriza tareas académicas según urgencia y horas disponibles. Español, lista numerada."
        user = f"Horas: {horas_disponibles}\n{json.dumps(tareas, ensure_ascii=False, default=str)}"
        return self._call(system, user)

    def redistribuir_plan(self, bloques_pendientes, horas_restantes) -> str:
        system = "Reorganiza bloques pendientes para el tiempo restante del día. Español, plan claro."
        user = json.dumps({"horas": horas_restantes, "bloques": bloques_pendientes}, ensure_ascii=False, default=str)
        return self._call(system, user)

    def redistribuir_plan_bloques(self, bloques_pendientes, horas_restantes) -> list[dict]:
        system = 'JSON: {"bloques":[{"hora_inicio":"HH:MM","hora_fin":"HH:MM","titulo":"...","tipo":"estudio"}]}'
        try:
            return self._call_json(
                system,
                json.dumps({"horas": horas_restantes, "bloques": bloques_pendientes}, default=str),
            ).get("bloques", [])
        except (json.JSONDecodeError, RuntimeError):
            return []

    def extraer_temas_syllabus(self, texto_syllabus: str) -> list[dict]:
        system = 'Extrae temas de syllabus. JSON: {"temas":[{"nombre":"...","prioridad":"alta|media|baja","fuente":"ppt|libro|ambos"}]}'
        try:
            return self._call_json(system, texto_syllabus).get("temas", [])
        except (json.JSONDecodeError, RuntimeError):
            return []

    def feedback_nocturno(self, resumen_dia, curso_critico: str) -> str:
        system = "Coach académico nocturno. Feedback breve, motivador, en español."
        user = json.dumps({"resumen": resumen_dia, "curso_critico": curso_critico}, default=str)
        return self._call(system, user)

    def estimar_tiempo_tarea(self, descripcion: str) -> int:
        system = 'Estima minutos. JSON: {"minutos": 30}'
        try:
            return int(self._call_json(system, descripcion).get("minutos", 30))
        except (json.JSONDecodeError, RuntimeError, ValueError):
            return 30

    def generar_plan_rescate(self, curso, horas_disponibles, temas_pendientes) -> str:
        system = (
            "Genera plan de rescate de emergencia para curso en riesgo. "
            "Horas limitadas. Español, acciones concretas por bloques."
        )
        user = json.dumps({
            "curso": curso, "horas": horas_disponibles, "temas": temas_pendientes,
        }, ensure_ascii=False, default=str)
        return self._call(system, user)

    def generar_reporte_semanal(self, datos_semana: dict) -> str:
        system = (
            "Genera reporte semanal académico: logros, áreas débiles, recomendaciones. "
            "Español, formato estructurado con emojis moderados."
        )
        return self._call(system, json.dumps(datos_semana, ensure_ascii=False, default=str))
