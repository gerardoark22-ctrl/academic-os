"""Configuración global y paleta visual Academic OS v2."""

import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent

# Carga academic_os/.env pase lo que pase: config.py lo importa todo el mundo
# (escritorio, web, Docker), así ningún punto de arranque se queda sin claves.
try:
    from env_loader import load_env_file

    load_env_file()
except ImportError:  # arranques que no tienen academic_os/ en sys.path
    pass


def resolve_data_dir() -> Path:
    """Ubicación única y permanente de datos (exe y python usan la misma)."""
    custom = os.environ.get("ACADEMIC_OS_DATA") or os.environ.get("DATA_DIR")
    if custom:
        return Path(custom)
    if sys.platform == "win32":
        root = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    else:
        root = Path.home() / ".local" / "share"
    return root / "AcademicOS"


DATA_DIR = resolve_data_dir()
DB_PATH = DATA_DIR / "academic_os.db"
BACKUP_DIR = DATA_DIR / "backups"
ASSETS_DIR = BASE_DIR / "assets"
THEME_PATH = ASSETS_DIR / "theme.json"
DB_VERSION = "2.0"

# Rutas antiguas (migración automática al arrancar)
LEGACY_DB_CANDIDATES = [
    BASE_DIR / "academic_os.db",
    BASE_DIR.parent / "dist" / "academic_os.db",
]
if getattr(sys, "frozen", False):
    LEGACY_DB_CANDIDATES.insert(0, Path(sys.executable).parent / "academic_os.db")
# Paleta Spotify + Gamer/HUD
COLORS = {
    "bg": "#0d0d1a",
    "surface": "#1a1a2e",
    "surface_elevated": "#16213e",
    "accent": "#e94560",
    "accent_hover": "#c73a52",
    "accent2": "#7c3aed",
    "green": "#00b894",
    "yellow": "#fdcb6e",
    "red": "#d63031",
    "orange": "#e17055",
    "blue": "#0984e3",
    "text": "#ffffff",
    "text_sec": "#b2bec3",
    "border": "#2d3a5a",
    "glow_green": "#4d00b894",
    "glow_red": "#4dd63031",
    "glow_accent": "#4de94560",
    "kanban_progress_bg": "#1a2e1a",
}

DOMINIO_SCORE = {
    "cero_pista": 0,
    "entendiendo": 33,
    "casi_listo": 66,
    "lo_tengo": 100,
}

DOMINIO_OPCIONES = [
    ("cero_pista", "💀 CERO PISTA", "#3d1515"),
    ("entendiendo", "🌱 ENTENDIENDO", "#3d3510"),
    ("casi_listo", "⚡ CASI LISTO", "#102a3d"),
    ("lo_tengo", "🔥 LO TENGO", "#103d2a"),
]

DOMINIO_LABELS = {k: v for k, v, _ in DOMINIO_OPCIONES}
DOMINIO_BG = {k: c for k, _, c in DOMINIO_OPCIONES}

SEMAFORO_COLORS = {
    "VERDE": COLORS["green"],
    "AMARILLO": COLORS["yellow"],
    "ROJO": COLORS["red"],
    "ROJO_CRITICO": COLORS["red"],
}

SEMAFORO_EMOJI = {
    "VERDE": "🟢",
    "AMARILLO": "🟡",
    "ROJO": "🔴",
    "ROJO_CRITICO": "🔴",
}

PRIORIDADES = ["urgente", "importante", "normal"]
PRIORIDAD_LABELS = {"urgente": "🔴 URGENTE", "importante": "🟡 IMPORTANTE", "normal": "🟢 NORMAL"}
PRIORIDAD_COLORS = {"urgente": COLORS["red"], "importante": COLORS["yellow"], "normal": COLORS["green"]}

FUENTES = ["ppt", "libro", "ambos"]
FUENTE_LABELS = {"ppt": "PPT", "libro": "Libro", "ambos": "Ambos"}

TIPOS_TAREA = ["estudio", "lectura", "video", "practica", "entrega", "presentacion", "personal"]
TIPOS_BLOQUE = ["estudio", "tarea", "descanso", "clase", "libre"]
TIPO_BLOQUE_ICON = {"estudio": "📚", "tarea": "📝", "descanso": "☕", "clase": "🎓", "libre": "✨"}

TB_HORA_INICIO = 6
TB_HORA_FIN = 23
TB_SLOT_MIN = 30

CURSO_COLORES_PALETA = [
    "#e94560", "#7c3aed", "#00b894", "#0984e3", "#fdcb6e",
    "#6c5ce7", "#e17055", "#00cec9", "#fab1a0", "#74b9ff",
]

DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEEPSEEK_MODEL = "deepseek-chat"
# Clave de DeepSeek: se lee de academic_os/.env (ignorado por git) o de una
# variable de entorno. NUNCA la escribas acá: este archivo se sube a GitHub.
# También puedes cargarla desde ⚙️ Configuración dentro de la app.
DEEPSEEK_BUILTIN_KEY = os.environ.get("DEEPSEEK_API_KEY", "")

CONFIG_DEFAULTS = {
    "deepseek_api_key": "",
    "openai_api_key": "",
    "nombre_usuario": "Estudiante",
    "tema_claro": "0",
    "modo_examen_inminente": "1",
    "notif_hora_tarde": "14:00",
    "notif_hora_noche": "21:00",
    "meta_horas_semanal": "20",
}

MOTIVACION = {
    "critico": [
        "Hoy es el día para dar la vuelta. Tú puedes. 💪",
        "La presión crea diamantes. Enfócate en lo esencial.",
    ],
    "medio": [
        "Cada bloque cuenta. Sigue construyendo momentum.",
        "No necesitas ser perfecto, necesitas ser constante.",
    ],
    "alto": [
        "Estás en modo élite. Mantén el ritmo campeón.",
        "Dominas el juego. Ahora consolida victorias.",
    ],
}

Vida_ZONAS = [
    (0, 30, COLORS["red"], "⚠️ ZONA CRÍTICA — Necesitas acción inmediata"),
    (31, 60, COLORS["yellow"], "📈 EN PROGRESO — Vas bien pero no bajes la guardia"),
    (61, 85, COLORS["blue"], "🔥 BUEN RITMO — Mantén el impulso"),
    (86, 100, COLORS["green"], "💎 ÉLITE — Estás dominando esto"),
]
