"""Capa de datos SQLite — Academic OS v2."""

import json
import shutil
import sqlite3
import threading
from contextlib import contextmanager
from datetime import date, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable, Iterator, Optional, TypeVar

from config import (
    BACKUP_DIR,
    CONFIG_DEFAULTS,
    DB_PATH,
    DB_VERSION,
    DEEPSEEK_BUILTIN_KEY,
    DOMINIO_SCORE,
    LEGACY_DB_CANDIDATES,
    TB_HORA_FIN,
    TB_HORA_INICIO,
    TB_SLOT_MIN,
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS cursos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    tipo TEXT DEFAULT 'academico',
    color TEXT DEFAULT '#4A90D9',
    activo INTEGER DEFAULT 1,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS unidades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    curso_id INTEGER REFERENCES cursos(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    orden INTEGER DEFAULT 0,
    fecha_examen DATE,
    descripcion TEXT
);

CREATE TABLE IF NOT EXISTS temas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unidad_id INTEGER REFERENCES unidades(id) ON DELETE CASCADE,
    curso_id INTEGER REFERENCES cursos(id),
    nombre TEXT NOT NULL,
    fuente TEXT DEFAULT 'ppt',
    dominio TEXT DEFAULT 'cero_pista',
    prioridad TEXT DEFAULT 'media',
    orden INTEGER DEFAULT 0,
    notas TEXT
);

CREATE TABLE IF NOT EXISTS subtemas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tema_id INTEGER REFERENCES temas(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    dominio TEXT DEFAULT 'cero_pista',
    completado INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tareas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    curso_id INTEGER REFERENCES cursos(id),
    unidad_id INTEGER REFERENCES unidades(id),
    tema_id INTEGER REFERENCES temas(id),
    tipo TEXT DEFAULT 'tarea',
    fecha_limite DATE,
    hora_limite TIME,
    duracion_min INTEGER DEFAULT 30,
    prioridad TEXT DEFAULT 'normal',
    estado TEXT DEFAULT 'pendiente',
    recurrente INTEGER DEFAULT 0,
    frecuencia TEXT,
    depende_de INTEGER REFERENCES tareas(id),
    notas TEXT,
    recordatorio INTEGER DEFAULT 0,
    recordatorio_hora TIME,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bloques (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    tipo TEXT DEFAULT 'estudio',
    titulo TEXT,
    tarea_id INTEGER REFERENCES tareas(id),
    tema_id INTEGER REFERENCES temas(id),
    curso_id INTEGER REFERENCES cursos(id),
    estado TEXT DEFAULT 'pendiente',
    notas TEXT
);

CREATE TABLE IF NOT EXISTS sesiones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha DATE NOT NULL,
    bloque_id INTEGER REFERENCES bloques(id),
    tema_id INTEGER REFERENCES temas(id),
    duracion_real_min INTEGER,
    dominio_antes TEXT,
    dominio_despues TEXT,
    notas TEXT
);

CREATE TABLE IF NOT EXISTS config (
    clave TEXT PRIMARY KEY,
    valor TEXT
);
"""


T = TypeVar("T")

_cache_gen = 0
_cache_lock = threading.Lock()
_cache_store: dict[str, tuple[int, Any]] = {}

_burst_lock = threading.Lock()
_burst_depth = 0
_burst_conn: sqlite3.Connection | None = None
_pragmas_applied = False


class _ManagedConnection:
    """Wrapper: no cierra la conexión compartida del burst."""

    def __init__(self, conn: sqlite3.Connection, *, owned: bool):
        self._conn = conn
        self._owned = owned

    def __enter__(self) -> sqlite3.Connection:
        return self._conn

    def __exit__(self, exc_type, exc, tb) -> None:
        if self._owned:
            self._conn.close()

    def __getattr__(self, name: str):
        return getattr(self._conn, name)


def invalidate_cache() -> None:
    """Invalida caches en memoria (avance, exámenes, badges, tareas)."""
    global _cache_gen
    with _cache_lock:
        _cache_gen += 1


def _commit(conn: sqlite3.Connection) -> None:
    conn.commit()
    invalidate_cache()


def _cache_get(key: str, builder: Callable[[], T]) -> T:
    global _cache_gen
    with _cache_lock:
        gen = _cache_gen
        hit = _cache_store.get(key)
        if hit and hit[0] == gen:
            return hit[1]
    value = builder()
    with _cache_lock:
        _cache_store[key] = (_cache_gen, value)
    return value


@contextmanager
def db_burst() -> Iterator[sqlite3.Connection]:
    """Reutiliza una conexión SQLite durante un burst de lecturas UI."""
    global _burst_conn, _burst_depth
    with _burst_lock:
        _burst_depth += 1
        if _burst_conn is None:
            _burst_conn = _open_connection()
        conn = _burst_conn
    try:
        yield conn
    finally:
        with _burst_lock:
            _burst_depth -= 1
            if _burst_depth <= 0:
                _burst_depth = 0
                if _burst_conn is not None:
                    try:
                        _burst_conn.close()
                    except sqlite3.Error:
                        pass
                    _burst_conn = None


def _apply_connection_pragmas(conn: sqlite3.Connection) -> None:
    global _pragmas_applied
    conn.execute("PRAGMA foreign_keys = ON")
    if not _pragmas_applied:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL")
        conn.execute("PRAGMA temp_store = MEMORY")
        _pragmas_applied = True


def _open_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=30)
    conn.row_factory = sqlite3.Row
    _apply_connection_pragmas(conn)
    return conn


def get_connection() -> _ManagedConnection:
    if _burst_depth > 0 and _burst_conn is not None:
        return _ManagedConnection(_burst_conn, owned=False)
    return _ManagedConnection(_open_connection(), owned=True)


@lru_cache(maxsize=None)
def _columnas_tabla(tabla: str) -> frozenset:
    with get_connection() as conn:
        return frozenset(r["name"] for r in conn.execute(f"PRAGMA table_info({tabla})"))


def solo_columnas(tabla: str, datos: dict, *, permitir_id: bool = False) -> dict:
    """Descarta claves que no son columnas reales de la tabla.

    Los endpoints arman el SQL con los nombres de campo que manda el cliente.
    Sin este filtro, un campo inventado revienta con un 500 y un `id` enviado a
    mano puede pisar la clave primaria.
    """
    cols = _columnas_tabla(tabla)
    return {
        k: v for k, v in datos.items()
        if k in cols and (permitir_id or k != "id")
    }


def _db_entity_count(path: Path) -> int:
    try:
        conn = sqlite3.connect(str(path))
        total = 0
        for table in ("cursos", "unidades", "temas", "tareas"):
            row = conn.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,),
            ).fetchone()
            if row:
                total += conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        conn.close()
        return total
    except sqlite3.Error:
        return 0


def _legacy_db_candidates() -> list[Path]:
    seen: set[str] = set()
    out: list[Path] = []
    for p in LEGACY_DB_CANDIDATES:
        try:
            resolved = p.resolve()
        except OSError:
            continue
        key = str(resolved).lower()
        if key in seen or not resolved.is_file():
            continue
        seen.add(key)
        out.append(resolved)
    return out


def _pick_richest_db(candidates: list[Path]) -> Path | None:
    if not candidates:
        return None
    return max(candidates, key=lambda p: (p.stat().st_size, p.stat().st_mtime))


def bootstrap_database_location() -> Path:
    """Unifica datos en AppData; importa la BD más completa de rutas legacy."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    target = DB_PATH.resolve()
    legacy = _legacy_db_candidates()
    legacy = [p for p in legacy if p.resolve() != target]

    if not DB_PATH.exists():
        best = _pick_richest_db(legacy)
        if best:
            shutil.copy2(best, DB_PATH)
        return DB_PATH

    best_legacy = _pick_richest_db(legacy)
    if best_legacy:
        legacy_n = _db_entity_count(best_legacy)
        current_n = _db_entity_count(DB_PATH)
        if legacy_n > current_n + 1:
            backup_database("antes_importar_legacy")
            shutil.copy2(best_legacy, DB_PATH)
            invalidate_cache()
    return DB_PATH


def backup_database(tag: str = "manual") -> Path | None:
    if not DB_PATH.exists():
        return None
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = BACKUP_DIR / f"academic_os_{tag}_{ts}.db"
    shutil.copy2(DB_PATH, dest)
    backups = sorted(BACKUP_DIR.glob("academic_os_*.db"), key=lambda p: p.stat().st_mtime)
    for old in backups[:-15]:
        try:
            old.unlink()
        except OSError:
            pass
    return dest


def backup_database_if_needed(tag: str = "inicio") -> Path | None:
    """Backup al inicio solo una vez por día (cierre y manual siguen siempre)."""
    if tag != "inicio":
        return backup_database(tag)
    if not DB_PATH.exists():
        return None
    hoy = date.today().isoformat()
    if get_config("ultimo_backup_inicio", "") == hoy:
        return None
    dest = backup_database(tag)
    if dest:
        set_config("ultimo_backup_inicio", hoy)
    return dest


def flush_database() -> None:
    """Fuerza escritura a disco (al cerrar la app)."""
    if not DB_PATH.exists():
        return
    with get_connection() as conn:
        conn.execute("PRAGMA wal_checkpoint(FULL)")
        conn.commit()


def get_data_info() -> dict:
    bootstrap_database_location()
    info = {
        "db_path": str(DB_PATH.resolve()),
        "backup_dir": str(BACKUP_DIR.resolve()),
        "exists": DB_PATH.exists(),
        "size_kb": DB_PATH.stat().st_size // 1024 if DB_PATH.exists() else 0,
    }
    if DB_PATH.exists():
        with get_connection() as conn:
            info["cursos"] = conn.execute(
                "SELECT COUNT(*) FROM cursos WHERE activo = 1"
            ).fetchone()[0]
            info["unidades"] = conn.execute("SELECT COUNT(*) FROM unidades").fetchone()[0]
            info["temas"] = conn.execute("SELECT COUNT(*) FROM temas").fetchone()[0]
    return info


def init_db() -> None:
    bootstrap_database_location()
    with get_connection() as conn:
        conn.executescript(SCHEMA)
        for k, v in CONFIG_DEFAULTS.items():
            conn.execute("INSERT OR IGNORE INTO config (clave, valor) VALUES (?, ?)", (k, v))
        _seed_if_empty(conn)
        _run_safe_migrations(conn)
        _ensure_ai_key(conn)
        conn.execute(
            "INSERT OR REPLACE INTO config (clave, valor) VALUES ('db_version', ?)",
            (DB_VERSION,),
        )
        conn.commit()
    backup_database_if_needed("inicio")


def _ensure_ai_key(conn: sqlite3.Connection) -> None:
    """Activa DeepSeek: migra clave OpenAI o usa la integrada."""
    row = conn.execute("SELECT valor FROM config WHERE clave = 'deepseek_api_key'").fetchone()
    if row and row["valor"]:
        return
    row2 = conn.execute("SELECT valor FROM config WHERE clave = 'openai_api_key'").fetchone()
    if row2 and row2["valor"]:
        conn.execute(
            "INSERT OR REPLACE INTO config (clave, valor) VALUES ('deepseek_api_key', ?)",
            (row2["valor"],),
        )
        return
    if DEEPSEEK_BUILTIN_KEY:
        conn.execute(
            "INSERT OR REPLACE INTO config (clave, valor) VALUES ('deepseek_api_key', ?)",
            (DEEPSEEK_BUILTIN_KEY,),
        )


def _run_safe_migrations(conn: sqlite3.Connection) -> None:
    """Migraciones incrementales — nunca borra datos existentes."""
    if _table_exists(conn, "cursos") and not _table_exists(conn, "unidades"):
        conn.executescript(SCHEMA)
    _apply_schema_patches(conn)


def _apply_schema_patches(conn: sqlite3.Connection) -> None:
    """Añade columnas nuevas sin borrar datos."""
    if not _table_exists(conn, "tareas"):
        return
    cols = {r[1] for r in conn.execute("PRAGMA table_info(tareas)").fetchall()}
    if "recordatorio" not in cols:
        conn.execute("ALTER TABLE tareas ADD COLUMN recordatorio INTEGER DEFAULT 0")
    if "recordatorio_hora" not in cols:
        conn.execute("ALTER TABLE tareas ADD COLUMN recordatorio_hora TIME")
    _apply_indexes(conn)


def _apply_indexes(conn: sqlite3.Connection) -> None:
    """Índices idempotentes para consultas frecuentes."""
    for sql in (
        "CREATE INDEX IF NOT EXISTS idx_temas_unidad ON temas(unidad_id)",
        "CREATE INDEX IF NOT EXISTS idx_temas_curso ON temas(curso_id)",
        "CREATE INDEX IF NOT EXISTS idx_tareas_estado_fecha ON tareas(estado, fecha_limite)",
        "CREATE INDEX IF NOT EXISTS idx_bloques_fecha ON bloques(fecha)",
        "CREATE INDEX IF NOT EXISTS idx_unidades_curso ON unidades(curso_id)",
        "CREATE INDEX IF NOT EXISTS idx_sesiones_fecha ON sesiones(fecha)",
    ):
        conn.execute(sql)


def _table_exists(conn: sqlite3.Connection, name: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone()
    return row is not None


def _needs_migration(conn: sqlite3.Connection) -> bool:
    if not DB_PATH.exists():
        return False
    version = _get_stored_version()
    if version != DB_VERSION:
        return True
    # Schema v1 no tenía tabla unidades
    if _table_exists(conn, "cursos") and not _table_exists(conn, "unidades"):
        return True
    return False


def _migrate_schema(conn: sqlite3.Connection) -> None:
    """DEPRECATED — destructivo (DROP tablas). Usar _run_safe_migrations()."""
    config_backup: list[dict] = []
    if _table_exists(conn, "config"):
        config_backup = [dict(r) for r in conn.execute("SELECT clave, valor FROM config").fetchall()]

    conn.execute("PRAGMA foreign_keys = OFF")
    for tabla in ("sesiones", "bloques", "tareas", "subtemas", "temas", "unidades", "cursos"):
        conn.execute(f"DROP TABLE IF EXISTS {tabla}")
    conn.executescript(SCHEMA)
    for row in config_backup:
        if row["clave"] != "db_version":
            conn.execute(
                "INSERT OR REPLACE INTO config (clave, valor) VALUES (?, ?)",
                (row["clave"], row["valor"]),
            )
    conn.execute("PRAGMA foreign_keys = ON")


def _get_stored_version() -> str:
    if not DB_PATH.exists():
        return ""
    try:
        with get_connection() as conn:
            row = conn.execute(
                "SELECT valor FROM config WHERE clave = 'db_version'"
            ).fetchone()
            return row["valor"] if row else ""
    except sqlite3.Error:
        return ""


def _seed_if_empty(conn: sqlite3.Connection) -> None:
    if conn.execute("SELECT COUNT(*) FROM cursos").fetchone()[0] > 0:
        return
    cursos = [
        ("Epidemiología", "academico", "#e94560"),
        ("Psiquiatría", "academico", "#6c5ce7"),
        ("Cirugía", "academico", "#00b894"),
    ]
    for nombre, tipo, color in cursos:
        conn.execute(
            "INSERT INTO cursos (nombre, tipo, color) VALUES (?, ?, ?)",
            (nombre, tipo, color),
        )
    unidades_epi = [
        (1, "Unidad 1 — Fundamentos", 1, "2026-06-25", "Conceptos base de epidemiología"),
        (1, "Unidad 2 — Epidemiología Analítica", 2, "2026-07-01", "Estudios analíticos y causalidad"),
    ]
    for curso_id, nombre, orden, fecha, desc in unidades_epi:
        conn.execute(
            """INSERT INTO unidades (curso_id, nombre, orden, fecha_examen, descripcion)
               VALUES (?, ?, ?, ?, ?)""",
            (curso_id, nombre, orden, fecha, desc),
        )
    temas = [
        (1, 1, "Tipos de estudios epidemiológicos", "ppt", "cero_pista", "alta"),
        (1, 1, "Sesgos y confusores", "libro", "cero_pista", "alta"),
        (1, 1, "Medidas de frecuencia", "ambos", "entendiendo", "media"),
        (2, 1, "Diseño de cohortes", "ppt", "cero_pista", "alta"),
        (2, 2, "Odds ratio y riesgo relativo", "libro", "entendiendo", "alta"),
    ]
    for unidad_id, curso_id, nombre, fuente, dominio, prioridad in temas:
        conn.execute(
            """INSERT INTO temas (unidad_id, curso_id, nombre, fuente, dominio, prioridad)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (unidad_id, curso_id, nombre, fuente, dominio, prioridad),
        )
    conn.execute(
        """INSERT INTO tareas (titulo, curso_id, unidad_id, fecha_limite, prioridad, duracion_min)
           VALUES ('Repasar medidas de frecuencia', 1, 1, ?, 'urgente', 45)""",
        (date.today().isoformat(),),
    )
    conn.execute(
        """INSERT INTO tareas (titulo, curso_id, unidad_id, fecha_limite, prioridad, duracion_min)
           VALUES ('Leer capítulo de sesgos', 1, 1, ?, 'importante', 60)""",
        ((date.today() + timedelta(days=2)).isoformat(),),
    )


# ── Config ──────────────────────────────────────────────────────────────────

def get_config(clave: str, default: str = "") -> str:
    with get_connection() as conn:
        row = conn.execute("SELECT valor FROM config WHERE clave = ?", (clave,)).fetchone()
        return row["valor"] if row else default


def set_config(clave: str, valor: str) -> None:
    with get_connection() as conn:
        conn.execute("INSERT OR REPLACE INTO config (clave, valor) VALUES (?, ?)", (clave, valor))
        _commit(conn)


def get_ai_api_key() -> str:
    return get_config("deepseek_api_key") or get_config("openai_api_key") or ""


# ── Cursos ──────────────────────────────────────────────────────────────────

def get_cursos(activos_only: bool = True) -> list[dict]:
    q = "SELECT * FROM cursos"
    if activos_only:
        q += " WHERE activo = 1"
    q += " ORDER BY nombre"
    with get_connection() as conn:
        return [dict(r) for r in conn.execute(q).fetchall()]


def get_curso(curso_id: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM cursos WHERE id = ?", (curso_id,)).fetchone()
        return dict(row) if row else None


def crear_curso(nombre: str, tipo: str, color: str) -> int:
    with get_connection() as conn:
        cur = conn.execute(
            "INSERT INTO cursos (nombre, tipo, color) VALUES (?, ?, ?)",
            (nombre, tipo, color),
        )
        _commit(conn)
        return cur.lastrowid


def actualizar_curso(curso_id: int, **kwargs) -> None:
    if not kwargs:
        return
    cols = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [curso_id]
    with get_connection() as conn:
        conn.execute(f"UPDATE cursos SET {cols} WHERE id = ?", vals)
        _commit(conn)


def archivar_curso(curso_id: int) -> None:
    actualizar_curso(curso_id, activo=0)


# ── Unidades ────────────────────────────────────────────────────────────────

def get_unidades(curso_id: int) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM unidades WHERE curso_id = ? ORDER BY orden, id",
            (curso_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_unidad(unidad_id: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM unidades WHERE id = ?", (unidad_id,)).fetchone()
        return dict(row) if row else None


def crear_unidad(curso_id: int, nombre: str, orden: int = 0,
                 fecha_examen: str | None = None, descripcion: str = "") -> int:
    with get_connection() as conn:
        if orden == 0:
            orden = conn.execute(
                "SELECT COALESCE(MAX(orden), 0) + 1 FROM unidades WHERE curso_id = ?",
                (curso_id,),
            ).fetchone()[0]
        cur = conn.execute(
            """INSERT INTO unidades (curso_id, nombre, orden, fecha_examen, descripcion)
               VALUES (?, ?, ?, ?, ?)""",
            (curso_id, nombre, orden, fecha_examen, descripcion),
        )
        _commit(conn)
        return cur.lastrowid


def actualizar_unidad(unidad_id: int, **kwargs) -> None:
    if not kwargs:
        return
    cols = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [unidad_id]
    with get_connection() as conn:
        conn.execute(f"UPDATE unidades SET {cols} WHERE id = ?", vals)
        _commit(conn)


def eliminar_unidad(unidad_id: int) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM unidades WHERE id = ?", (unidad_id,))
        _commit(conn)


# ── Temas ───────────────────────────────────────────────────────────────────

def get_temas(unidad_id: int) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM temas WHERE unidad_id = ? ORDER BY orden, id",
            (unidad_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_temas_curso(curso_id: int) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM temas WHERE curso_id = ? ORDER BY unidad_id, orden",
            (curso_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_temas_cero_pista() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT t.*, c.nombre as curso_nombre, c.color as curso_color,
                      u.nombre as unidad_nombre, u.fecha_examen
               FROM temas t
               JOIN cursos c ON t.curso_id = c.id
               JOIN unidades u ON t.unidad_id = u.id
               WHERE t.dominio = 'cero_pista' AND c.activo = 1
               ORDER BY u.fecha_examen ASC, c.nombre""",
        ).fetchall()
        return [dict(r) for r in rows]


def crear_tema(unidad_id: int, curso_id: int, nombre: str, **kwargs) -> int:
    with get_connection() as conn:
        orden = conn.execute(
            "SELECT COALESCE(MAX(orden), 0) + 1 FROM temas WHERE unidad_id = ?",
            (unidad_id,),
        ).fetchone()[0]
        cur = conn.execute(
            """INSERT INTO temas (unidad_id, curso_id, nombre, fuente, dominio, prioridad, orden, notas)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                unidad_id, curso_id, nombre,
                kwargs.get("fuente", "ppt"),
                kwargs.get("dominio", "cero_pista"),
                kwargs.get("prioridad", "media"),
                orden,
                kwargs.get("notas", ""),
            ),
        )
        _commit(conn)
        return cur.lastrowid


def actualizar_tema(tema_id: int, **kwargs) -> None:
    kwargs = solo_columnas("temas", kwargs)
    if not kwargs:
        return
    cols = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [tema_id]
    with get_connection() as conn:
        conn.execute(f"UPDATE temas SET {cols} WHERE id = ?", vals)
        _commit(conn)


def eliminar_tema(tema_id: int) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM subtemas WHERE tema_id = ?", (tema_id,))
        conn.execute("DELETE FROM temas WHERE id = ?", (tema_id,))
        _commit(conn)


# ── Subtemas ────────────────────────────────────────────────────────────────

def get_subtemas(tema_id: int) -> list[dict]:
    with get_connection() as conn:
        return [dict(r) for r in conn.execute(
            "SELECT * FROM subtemas WHERE tema_id = ? ORDER BY id", (tema_id,)
        ).fetchall()]


def crear_subtema(tema_id: int, nombre: str) -> int:
    with get_connection() as conn:
        cur = conn.execute(
            "INSERT INTO subtemas (tema_id, nombre) VALUES (?, ?)", (tema_id, nombre)
        )
        _commit(conn)
        return cur.lastrowid


def actualizar_subtema(subtema_id: int, **kwargs) -> None:
    if not kwargs:
        return
    cols = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [subtema_id]
    with get_connection() as conn:
        conn.execute(f"UPDATE subtemas SET {cols} WHERE id = ?", vals)
        _commit(conn)


# ── Lógica de dominio / semáforo ────────────────────────────────────────────

def dias_restantes(fecha: str | None) -> Optional[int]:
    if not fecha:
        return None
    try:
        return (datetime.strptime(fecha, "%Y-%m-%d").date() - date.today()).days
    except ValueError:
        return None


def calcular_semaforo(dias: Optional[int], avance: float) -> str:
    if dias is None:
        return "VERDE"
    if dias <= 3:
        return "ROJO_CRITICO"
    if dias <= 7:
        return "ROJO"
    if dias <= 10 and avance < 0.6:
        return "AMARILLO"
    if dias <= 14 and avance < 0.4:
        return "AMARILLO"
    return "VERDE"


def peso_dominio(dominio: str | None) -> float:
    """Peso 0–1: cero=0, entendiendo=⅓, casi listo=⅔, lo tengo=1."""
    return DOMINIO_SCORE.get(dominio or "cero_pista", 0) / 100.0


def _stats_dominios(dominios: list[str]) -> tuple[int, int, float]:
    total = len(dominios)
    if not total:
        return 0, 0, 0.0
    dominados = sum(1 for d in dominios if d == "lo_tengo")
    pct = sum(peso_dominio(d) for d in dominios) / total
    return dominados, total, pct


def get_avance_maps() -> tuple[dict[int, tuple[int, int, float]], dict[int, tuple[int, int, float]], dict[int, dict[str, int]]]:
    """Una sola lectura de temas → avance por unidad/curso y conteos de dominio."""
    return _cache_get("avance_maps", _compute_avance_maps)


def _compute_avance_maps() -> tuple[dict[int, tuple[int, int, float]], dict[int, tuple[int, int, float]], dict[int, dict[str, int]]]:
    by_unidad: dict[int, list[str]] = {}
    by_curso: dict[int, list[str]] = {}
    dominio_unidad: dict[int, dict[str, int]] = {}
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT unidad_id, curso_id, dominio FROM temas",
        ).fetchall()
    for r in rows:
        uid, cid = r["unidad_id"], r["curso_id"]
        dom = r["dominio"] or "cero_pista"
        by_unidad.setdefault(uid, []).append(dom)
        by_curso.setdefault(cid, []).append(dom)
        bucket = dominio_unidad.setdefault(uid, {})
        bucket[dom] = bucket.get(dom, 0) + 1
    u_map = {uid: _stats_dominios(doms) for uid, doms in by_unidad.items()}
    c_map = {cid: _stats_dominios(doms) for cid, doms in by_curso.items()}
    return u_map, c_map, dominio_unidad


def avance_unidad(unidad_id: int, u_map: dict[int, tuple[int, int, float]] | None = None) -> tuple[int, int, float]:
    if u_map is not None:
        return u_map.get(unidad_id, (0, 0, 0.0))
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT dominio FROM temas WHERE unidad_id = ?", (unidad_id,),
        ).fetchall()
    return _stats_dominios([r["dominio"] or "cero_pista" for r in rows])


def avance_curso(curso_id: int, c_map: dict[int, tuple[int, int, float]] | None = None) -> tuple[int, int, float]:
    if c_map is not None:
        return c_map.get(curso_id, (0, 0, 0.0))
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT dominio FROM temas WHERE curso_id = ?", (curso_id,),
        ).fetchall()
    return _stats_dominios([r["dominio"] or "cero_pista" for r in rows])


def contar_dominio_unidad(
    unidad_id: int,
    dominio_map: dict[int, dict[str, int]] | None = None,
) -> dict[str, int]:
    if dominio_map is not None:
        return dominio_map.get(unidad_id, {})
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT dominio, COUNT(*) as n FROM temas WHERE unidad_id = ? GROUP BY dominio",
            (unidad_id,),
        ).fetchall()
    return {r["dominio"]: r["n"] for r in rows}


def indice_dominio_global() -> int:
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT t.dominio, t.prioridad FROM temas t
               JOIN cursos c ON t.curso_id = c.id WHERE c.activo = 1"""
        ).fetchall()
    if not rows:
        return 0
    peso_prior = {"alta": 1.5, "media": 1.0, "baja": 0.7}
    total_peso = 0.0
    suma = 0.0
    for r in rows:
        p = peso_prior.get(r["prioridad"], 1.0)
        total_peso += p
        suma += DOMINIO_SCORE.get(r["dominio"], 0) * p
    return int(suma / total_peso) if total_peso else 0


def resumen_dominio_global() -> dict:
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT t.dominio, COUNT(*) as n FROM temas t
               JOIN cursos c ON t.curso_id = c.id WHERE c.activo = 1
               GROUP BY t.dominio"""
        ).fetchall()
        total = conn.execute(
            """SELECT COUNT(*) FROM temas t
               JOIN cursos c ON t.curso_id = c.id WHERE c.activo = 1"""
        ).fetchone()[0]
    por = {r["dominio"]: r["n"] for r in rows}
    dominados = por.get("lo_tengo", 0)
    return {
        "total": total,
        "dominados": dominados,
        "sin_dominar": max(0, total - dominados),
        "por_dominio": por,
        "porcentaje": indice_dominio_global(),
        "cero_pista": por.get("cero_pista", 0),
        "entendiendo": por.get("entendiendo", 0),
        "casi_listo": por.get("casi_listo", 0),
        "lo_tengo": dominados,
    }


INACTIVO_UMBRAL_H = 4.0   # horas sin bloque completado (8:00–23:00)
PESO_TIMEBLOCKING = 0.85  # 85% del score
PESO_TAREAS = 0.15        # 15% del score
MAX_SCORE_TB = int(PESO_TIMEBLOCKING * 100)


def _horas_ventana_dia() -> tuple[float, float]:
    """Horas transcurridas desde 8:00 y horas restantes hasta 23:00."""
    now = datetime.now()
    h, m = now.hour, now.minute
    if h < 8:
        return 0.0, 15.0
    if h >= 23:
        return 15.0, 0.0
    transcurridas = (h - 8) + m / 60.0
    restantes = (23 - h) - m / 60.0
    return transcurridas, max(0.0, restantes)


def _horas_sin_bloque_completado(hoy: str) -> float:
    """Horas dentro de la ventana 8:00–23:00 sin completar ningún bloque."""
    now = datetime.now()
    if now.hour < 8:
        return 0.0
    bloques = get_bloques(hoy)
    completados = [b for b in bloques if b.get("estado") == "completado"]
    inicio_ventana = datetime.combine(now.date(), datetime.min.time().replace(hour=8))

    if not completados:
        ref = inicio_ventana
    else:
        ultimo = max(completados, key=lambda b: b.get("hora_fin") or "00:00:00")
        try:
            parts = (ultimo.get("hora_fin") or "08:00:00")[:8].split(":")
            ref = datetime.combine(
                now.date(),
                datetime.min.time().replace(hour=int(parts[0]), minute=int(parts[1])),
            )
        except (ValueError, IndexError):
            ref = inicio_ventana
        if ref < inicio_ventana:
            ref = inicio_ventana

    limite = min(now, datetime.combine(now.date(), datetime.min.time().replace(hour=23)))
    if limite <= ref:
        return 0.0
    return (limite - ref).total_seconds() / 3600.0


def get_rendimiento_hoy() -> dict:
    """Métricas de ejecución del día — TimeBlocking pesa ~85% del score."""
    hoy = date.today().isoformat()
    done_b, total_b, pct_bloques = progreso_dia(hoy)
    tareas_hoy = get_tareas_por_fecha(hoy)
    tareas_done = sum(1 for t in tareas_hoy if t["estado"] == "completada")
    tareas_pend_hoy = sum(1 for t in tareas_hoy if t["estado"] != "completada")
    tareas_total_hoy = tareas_done + tareas_pend_hoy
    pendientes = contar_tareas_pendientes()
    bloques = get_bloques(hoy)
    sin_bloque = sum(
        1 for t in get_tareas()
        if t["estado"] != "completada" and t.get("fecha_limite") == hoy
        and not any(b.get("tarea_id") == t["id"] for b in bloques)
    )
    hora = datetime.now().hour
    horas_ventana, horas_restantes = _horas_ventana_dia()
    horas_inactivas = _horas_sin_bloque_completado(hoy)
    en_ventana = 8 <= hora < 23

    # Score: 85% TimeBlocking · 15% tareas
    if total_b > 0:
        score_tb = pct_bloques * PESO_TIMEBLOCKING
    else:
        score_tb = 0.0
        if en_ventana and horas_ventana >= 2:
            score_tb = -20.0

    if tareas_total_hoy > 0:
        score_tareas = (tareas_done / tareas_total_hoy) * (PESO_TAREAS * 100)
    else:
        score_tareas = min(8.0, tareas_done * 4.0)

    score = int(max(0, min(100, score_tb + score_tareas)))

    inactivo_critico = en_ventana and horas_inactivas >= INACTIVO_UMBRAL_H
    if inactivo_critico:
        score = min(score, 10)
    if en_ventana and total_b == 0 and horas_ventana >= 4:
        score = min(score, 20)
    if sin_bloque >= 2 and hora >= 10:
        score = max(0, score - min(15, sin_bloque * 4))
    if en_ventana and pct_bloques < 20 and total_b >= 3 and hora >= 14:
        score = max(0, score - 20)

    return {
        "bloques_done": done_b,
        "bloques_total": total_b,
        "pct_bloques": pct_bloques,
        "tareas_done": tareas_done,
        "tareas_pend_hoy": tareas_pend_hoy,
        "pendientes_total": pendientes,
        "sin_agendar_hoy": sin_bloque,
        "score": score,
        "score_tb": int(score_tb),
        "score_tareas": int(score_tareas),
        "max_score_tb": MAX_SCORE_TB,
        "inactivo": inactivo_critico,
        "inactivo_4h": inactivo_critico,
        "inactivo_umbral": INACTIVO_UMBRAL_H,
        "horas_inactivas": round(horas_inactivas, 1),
        "horas_ventana": round(horas_ventana, 1),
        "horas_restantes": round(horas_restantes, 1),
        "hora": hora,
    }


def mensaje_rendimiento(rend: dict) -> tuple[str, str, str]:
    """Retorna (titulo, mensaje, color_key) — tono duro, prioriza TimeBlocking."""
    s = rend["score"]
    hi = rend.get("horas_inactivas", 0)
    pct = int(rend["pct_bloques"])
    bd, bt = rend["bloques_done"], rend["bloques_total"]

    if rend.get("inactivo_4h") or rend.get("inactivo"):
        max_tb = rend.get("max_score_tb", MAX_SCORE_TB)
        return (
            "💀 4+ HORAS MUERTAS",
            f"Llevas {hi:.0f}h sin completar UN bloque (8:00–23:00). "
            f"Cuatro horas evaporadas. Eso no es descanso — es autosabotaje. "
            f"TimeBlocking AHORA: agenda el siguiente bloque y complétalo. "
            f"Score TB: {rend.get('score_tb', 0)}/{max_tb}.",
            "red",
        )

    if rend["bloques_total"] == 0 and rend["hora"] >= 10:
        return (
            "🚨 CERO BLOQUES HOY",
            "No tienes NADA agendado en TimeBlocking. Sin bloques no hay plan; sin plan no hay nota. "
            "Agenda mínimo 3 bloques para hoy y ejecútalos. Ahora.",
            "red",
        )

    if s < 20:
        return (
            "⛔ RENDIMIENTO PATHÉTICO",
            f"{pct}% de bloques ({bd}/{bt}). TimeBlocking manda: sin bloques completados "
            f"tu día académico no cuenta. Deja de posponer — 30 minutos de foco, ya.",
            "red",
        )

    if s < 40:
        return (
            "🔥 ESTÁS FALLANDO HOY",
            f"Solo {bd}/{bt} bloques ({pct}%). Te quedan ~{rend.get('horas_restantes', 0):.0f}h "
            f"en ventana activa y {rend['sin_agendar_hoy']} tarea(s) sin bloquear. "
            "Recupera el día en TimeBlocking o mañana pagas doble.",
            "orange",
        )

    if s < 60:
        return (
            "⚠️ MEDIOCRE",
            f"TimeBlocking al {pct}% — aceptable no es suficiente. "
            f"Cierra {rend['tareas_pend_hoy']} tarea(s) y completa al menos "
            f"{max(1, bt - bd)} bloque(s) más.",
            "yellow",
        )

    if s < 80:
        return (
            "🟡 CASI BIEN",
            f"Bloques {bd}/{bt} ({pct}%). Falta remate: bloquea lo pendiente "
            f"y sube tu score de TB ({rend.get('score_tb', 0)}/{rend.get('max_score_tb', MAX_SCORE_TB)}).",
            "yellow",
        )

    return (
        "✅ EN EJECUCIÓN",
        f"TimeBlocking {pct}% · {bd}/{bt} bloques · {rend['tareas_done']} tareas. "
        "Mantén el ritmo; no aflojes antes de las 23:00.",
        "green",
    )


def get_resumen_riesgo() -> dict:
    u_map, _, _ = get_avance_maps()
    examenes = get_examenes_proximos(u_map)
    criticos = [
        e for e in examenes
        if e.get("dias_restantes") is not None and e["dias_restantes"] <= 7
    ]
    vencidas = get_tareas_vencidas()
    urgentes = [
        t for t in get_tareas()
        if t["estado"] != "completada" and t.get("prioridad") == "urgente"
    ]
    res = resumen_dominio_global()
    return {
        "nivel": indice_riesgo_global(u_map),
        "examenes_criticos": criticos,
        "examenes_proximos": examenes[:6],
        "tareas_vencidas": vencidas,
        "tareas_urgentes": urgentes,
        "temas_sin_dominar": res["cero_pista"] + res["entendiendo"],
        "cero_pista": res["cero_pista"],
    }


def indice_riesgo_global(u_map: dict[int, tuple[int, int, float]] | None = None) -> int:
    if u_map is None:
        u_map, _, _ = get_avance_maps()
    cursos = get_cursos()
    if not cursos:
        return 0
    scores = []
    for c in cursos:
        unidades = get_unidades(c["id"])
        if not unidades:
            scores.append(20)
            continue
        for u in unidades:
            _, _, av = avance_unidad(u["id"], u_map)
            dias = dias_restantes(u.get("fecha_examen"))
            sem = calcular_semaforo(dias, av)
            if sem == "ROJO_CRITICO":
                scores.append(95)
            elif sem == "ROJO":
                scores.append(80)
            elif sem == "AMARILLO":
                scores.append(55)
            else:
                scores.append(15)
    return int(sum(scores) / len(scores))


def get_examenes_proximos(u_map: dict[int, tuple[int, int, float]] | None = None) -> list[dict]:
    if u_map is not None:
        return _build_examenes_proximos(u_map)
    return _cache_get("examenes_proximos", lambda: _build_examenes_proximos(get_avance_maps()[0]))


def _build_examenes_proximos(u_map: dict[int, tuple[int, int, float]]) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT u.*, c.nombre as curso_nombre, c.color as curso_color
               FROM unidades u JOIN cursos c ON u.curso_id = c.id
               WHERE c.activo = 1 AND u.fecha_examen IS NOT NULL
               ORDER BY u.fecha_examen ASC"""
        ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        dom, tot, av = avance_unidad(d["id"], u_map)
        dias = dias_restantes(d.get("fecha_examen"))
        d["dias_restantes"] = dias
        d["avance"] = av
        d["dominados"] = dom
        d["total_temas"] = tot
        d["semaforo"] = calcular_semaforo(dias, av)
        result.append(d)
    return result


def proximo_examen_curso(curso_id: int, examenes: list[dict] | None = None) -> Optional[dict]:
    if examenes is None:
        examenes = get_examenes_proximos()
    for e in examenes:
        if e["curso_id"] == curso_id:
            return e
    return None


def curso_en_alerta(u_map: dict[int, tuple[int, int, float]] | None = None) -> int:
    if u_map is not None:
        return _compute_curso_en_alerta(u_map)
    return _cache_get("curso_alerta", lambda: _compute_curso_en_alerta(get_avance_maps()[0]))


def _compute_curso_en_alerta(u_map: dict[int, tuple[int, int, float]]) -> int:
    count = 0
    for c in get_cursos():
        for u in get_unidades(c["id"]):
            _, _, av = avance_unidad(u["id"], u_map)
            sem = calcular_semaforo(dias_restantes(u.get("fecha_examen")), av)
            if sem in ("ROJO", "ROJO_CRITICO", "AMARILLO"):
                count += 1
                break
    return count


# ── Tareas ──────────────────────────────────────────────────────────────────

def get_tareas(estado: str | None = None) -> list[dict]:
    q = """SELECT t.*, c.nombre as curso_nombre, c.color as curso_color,
                  u.nombre as unidad_nombre
           FROM tareas t
           LEFT JOIN cursos c ON t.curso_id = c.id
           LEFT JOIN unidades u ON t.unidad_id = u.id"""
    params: list = []
    if estado:
        q += " WHERE t.estado = ?"
        params.append(estado)
    q += " ORDER BY CASE WHEN t.fecha_limite IS NULL THEN 1 ELSE 0 END, t.fecha_limite, t.prioridad"
    with get_connection() as conn:
        return [dict(r) for r in conn.execute(q, params).fetchall()]


def get_tarea(tarea_id: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute(
            """SELECT t.*, c.nombre as curso_nombre, c.color as curso_color
               FROM tareas t LEFT JOIN cursos c ON t.curso_id = c.id WHERE t.id = ?""",
            (tarea_id,),
        ).fetchone()
        return dict(row) if row else None


def crear_tarea(**kwargs) -> int:
    kwargs = solo_columnas("tareas", kwargs)
    if not kwargs.get("titulo"):
        raise ValueError("La tarea necesita un título")
    keys = list(kwargs.keys())
    with get_connection() as conn:
        cur = conn.execute(
            f"INSERT INTO tareas ({', '.join(keys)}) VALUES ({', '.join('?' * len(keys))})",
            list(kwargs.values()),
        )
        _commit(conn)
        return cur.lastrowid


def actualizar_tarea(tarea_id: int, **kwargs) -> None:
    kwargs = solo_columnas("tareas", kwargs)
    if not kwargs:
        return
    cols = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [tarea_id]
    with get_connection() as conn:
        conn.execute(f"UPDATE tareas SET {cols} WHERE id = ?", vals)
        _commit(conn)


def eliminar_tarea(tarea_id: int) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM tareas WHERE id = ?", (tarea_id,))
        _commit(conn)


def completar_tarea(tarea_id: int) -> None:
    actualizar_tarea(tarea_id, estado="completada")
    with get_connection() as conn:
        conn.execute(
            "UPDATE bloques SET estado = 'completado' WHERE tarea_id = ? AND estado != 'completado'",
            (tarea_id,),
        )
        _commit(conn)


def contar_tareas_pendientes() -> int:
    def _count():
        with get_connection() as conn:
            return conn.execute(
                "SELECT COUNT(*) FROM tareas WHERE estado != 'completada'"
            ).fetchone()[0]
    return _cache_get("tareas_pendientes", _count)


def get_misiones_hoy() -> list[dict]:
    hoy = date.today().isoformat()
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT t.*, c.nombre as curso_nombre, c.color as curso_color
               FROM tareas t LEFT JOIN cursos c ON t.curso_id = c.id
               WHERE t.estado != 'completada'
               AND (t.fecha_limite = ? OR t.prioridad IN ('urgente', 'importante'))
               ORDER BY CASE t.prioridad WHEN 'urgente' THEN 0 WHEN 'importante' THEN 1 ELSE 2 END,
                        t.fecha_limite""",
            (hoy,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_tareas_vencidas() -> list[dict]:
    hoy = date.today().isoformat()
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT t.*, c.nombre as curso_nombre, c.color as curso_color
               FROM tareas t LEFT JOIN cursos c ON t.curso_id = c.id
               WHERE t.fecha_limite < ? AND t.estado != 'completada'""",
            (hoy,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_tareas_por_fecha(fecha: str, incluir_completadas: bool = False) -> list[dict]:
    with get_connection() as conn:
        q = """SELECT t.*, c.nombre as curso_nombre, c.color as curso_color
               FROM tareas t LEFT JOIN cursos c ON t.curso_id = c.id
               WHERE t.fecha_limite = ?"""
        if not incluir_completadas:
            q += " AND t.estado != 'completada'"
        q += " ORDER BY t.estado, t.prioridad"
        rows = conn.execute(q, (fecha,)).fetchall()
        return [dict(r) for r in rows]


def purgar_tareas_completadas() -> int:
    with get_connection() as conn:
        cur = conn.execute("DELETE FROM tareas WHERE estado = 'completada'")
        _commit(conn)
        return cur.rowcount


def auto_purga_completadas_diaria() -> int:
    """Purge completadas una vez al día (al abrir app en día nuevo)."""
    hoy = date.today().isoformat()
    if get_config("ultima_purga_completadas", "") == hoy:
        return 0
    n = purgar_tareas_completadas()
    set_config("ultima_purga_completadas", hoy)
    return n


def contar_tareas_completadas() -> int:
    with get_connection() as conn:
        return conn.execute(
            "SELECT COUNT(*) FROM tareas WHERE estado = 'completada'"
        ).fetchone()[0]


def get_recordatorios_activos() -> list[dict]:
    """Tareas con recordatorio que deben alertar ahora (±1 min)."""
    ahora = datetime.now()
    hoy = ahora.date().isoformat()
    hm = ahora.strftime("%H:%M")
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT t.*, c.nombre as curso_nombre
               FROM tareas t LEFT JOIN cursos c ON t.curso_id = c.id
               WHERE t.recordatorio = 1 AND t.estado != 'completada'
               AND t.recordatorio_hora IS NOT NULL
               AND (t.fecha_limite IS NULL OR t.fecha_limite = ?)
               AND substr(t.recordatorio_hora, 1, 5) = ?""",
            (hoy, hm),
        ).fetchall()
        return [dict(r) for r in rows]


# ── Bloques ─────────────────────────────────────────────────────────────────

def get_bloques(fecha: str) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT b.*, c.nombre as curso_nombre, c.color as curso_color
               FROM bloques b LEFT JOIN cursos c ON b.curso_id = c.id
               WHERE b.fecha = ? ORDER BY b.hora_inicio""",
            (fecha,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_bloque(bloque_id: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM bloques WHERE id = ?", (bloque_id,)).fetchone()
        return dict(row) if row else None


def get_slots_dia(fecha: str) -> list[dict]:
    """Slots de 30 min del día con estado libre/ocupado."""
    d = date.fromisoformat(fecha)
    bloques = {b["hora_inicio"][:5]: b for b in get_bloques(fecha)}
    slot_dt = datetime.combine(d, datetime.min.time().replace(hour=TB_HORA_INICIO))
    end_dt = datetime.combine(d, datetime.min.time().replace(hour=TB_HORA_FIN, minute=30))
    slots = []
    while slot_dt <= end_dt:
        hs = slot_dt.strftime("%H:%M")
        hf_dt = slot_dt + timedelta(minutes=TB_SLOT_MIN)
        hf = hf_dt.strftime("%H:%M")
        b = bloques.get(hs)
        slots.append({
            "hora_inicio": hs + ":00",
            "hora_fin": hf + ":00",
            "label_hs": hs,
            "libre": b is None,
            "bloque": dict(b) if b else None,
        })
        slot_dt = hf_dt
    return slots


def asignar_tema_a_slots(
    fecha: str, tema_id: int, curso_id: int, titulo: str, slots: list[dict],
) -> int:
    """Coloca tema en bloques elegidos (crea o actualiza)."""
    n = 0
    for s in slots:
        if s["libre"]:
            crear_bloque(
                fecha=fecha,
                hora_inicio=s["hora_inicio"],
                hora_fin=s["hora_fin"],
                titulo=titulo,
                tipo="estudio",
                tema_id=tema_id,
                curso_id=curso_id,
            )
            n += 1
        elif s.get("bloque"):
            bloque = s["bloque"]
            prev = bloque.get("titulo") or ""
            nuevo = titulo if not prev else f"{prev} · {titulo}"
            actualizar_bloque(
                bloque["id"],
                titulo=nuevo[:140],
                tema_id=tema_id,
                curso_id=curso_id,
                tipo="estudio",
            )
            n += 1
    return n


def crear_bloque(**kwargs) -> int:
    kwargs = solo_columnas("bloques", kwargs)
    if not (kwargs.get("hora_inicio") and kwargs.get("hora_fin")):
        raise ValueError("El bloque necesita hora de inicio y fin")
    keys = list(kwargs.keys())
    with get_connection() as conn:
        cur = conn.execute(
            f"INSERT INTO bloques ({', '.join(keys)}) VALUES ({', '.join('?' * len(keys))})",
            list(kwargs.values()),
        )
        _commit(conn)
        return cur.lastrowid


def actualizar_bloque(bloque_id: int, **kwargs) -> None:
    if not kwargs:
        return
    cols = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [bloque_id]
    with get_connection() as conn:
        conn.execute(f"UPDATE bloques SET {cols} WHERE id = ?", vals)
        _commit(conn)


def eliminar_bloque(bloque_id: int) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM bloques WHERE id = ?", (bloque_id,))
        _commit(conn)


def completar_bloque(bloque_id: int) -> None:
    bloque = get_bloque(bloque_id)
    if not bloque:
        return
    actualizar_bloque(bloque_id, estado="completado")
    if bloque.get("tarea_id"):
        completar_tarea(bloque["tarea_id"])


def get_bloque_actual() -> Optional[dict]:
    ahora = datetime.now()
    hoy = ahora.date().isoformat()
    hora = ahora.strftime("%H:%M:%S")
    with get_connection() as conn:
        row = conn.execute(
            """SELECT b.*, c.color as curso_color, c.nombre as curso_nombre
               FROM bloques b LEFT JOIN cursos c ON b.curso_id = c.id
               WHERE b.fecha = ? AND b.hora_inicio <= ? AND b.hora_fin > ?
               AND b.estado != 'completado' LIMIT 1""",
            (hoy, hora, hora),
        ).fetchone()
        return dict(row) if row else None


def get_bloques_pendientes_hoy() -> list[dict]:
    hoy = date.today().isoformat()
    hora = datetime.now().strftime("%H:%M:%S")
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT b.*, c.color as curso_color
               FROM bloques b LEFT JOIN cursos c ON b.curso_id = c.id
               WHERE b.fecha = ? AND b.hora_inicio >= ? AND b.estado = 'pendiente'
               ORDER BY b.hora_inicio""",
            (hoy, hora),
        ).fetchall()
        return [dict(r) for r in rows]


def progreso_dia(fecha: str) -> tuple[int, int, float]:
    bloques = get_bloques(fecha)
    total = len(bloques)
    done = sum(1 for b in bloques if b["estado"] == "completado")
    pct = (done / total * 100) if total else 0.0
    return done, total, pct


# ── Sesiones / estadísticas ─────────────────────────────────────────────────

def crear_sesion(**kwargs) -> int:
    keys = list(kwargs.keys())
    with get_connection() as conn:
        cur = conn.execute(
            f"INSERT INTO sesiones ({', '.join(keys)}) VALUES ({', '.join('?' * len(keys))})",
            list(kwargs.values()),
        )
        _commit(conn)
        return cur.lastrowid


def get_horas_dia(fecha: str) -> float:
    with get_connection() as conn:
        mins = conn.execute(
            "SELECT COALESCE(SUM(duracion_real_min), 0) FROM sesiones WHERE fecha = ?",
            (fecha,),
        ).fetchone()[0]
    return mins / 60.0


def get_horas_semana() -> dict[str, float]:
    result = {}
    for i in range(6, -1, -1):
        d = (date.today() - timedelta(days=i)).isoformat()
        result[d] = get_horas_dia(d)
    return result


def get_racha_dias() -> int:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT DISTINCT fecha FROM sesiones ORDER BY fecha DESC"
        ).fetchall()
    if not rows:
        return 0
    racha = 0
    esperado = date.today()
    for r in rows:
        f = datetime.strptime(r["fecha"], "%Y-%m-%d").date()
        if f == esperado:
            racha += 1
            esperado -= timedelta(days=1)
        elif f < esperado:
            break
    return racha


def get_cumplimiento_semana() -> tuple[list[str], list[float], list[float]]:
    dias, planeado, real = [], [], []
    for i in range(6, -1, -1):
        d = date.today() - timedelta(days=i)
        d_str = d.isoformat()
        dias.append(d.strftime("%d/%m"))
        with get_connection() as conn:
            n_bloques = conn.execute(
                "SELECT COUNT(*) FROM bloques WHERE fecha = ?", (d_str,)
            ).fetchone()[0]
        planeado.append(n_bloques * 0.5)
        real.append(get_horas_dia(d_str))
    return dias, planeado, real


def tareas_completadas_hoy() -> tuple[int, int]:
    hoy = date.today().isoformat()
    with get_connection() as conn:
        total = conn.execute(
            "SELECT COUNT(*) FROM tareas WHERE fecha_limite = ?", (hoy,)
        ).fetchone()[0]
        done = conn.execute(
            "SELECT COUNT(*) FROM tareas WHERE fecha_limite = ? AND estado = 'completada'",
            (hoy,),
        ).fetchone()[0]
    return done, max(total, done)


def get_datos_reporte_semanal() -> dict:
    inicio = (date.today() - timedelta(days=7)).isoformat()
    fin = date.today().isoformat()
    with get_connection() as conn:
        horas = conn.execute(
            "SELECT COALESCE(SUM(duracion_real_min), 0) FROM sesiones WHERE fecha >= ?",
            (inicio,),
        ).fetchone()[0] / 60.0
        tareas_c = conn.execute(
            "SELECT COUNT(*) FROM tareas WHERE estado = 'completada' AND creado_en >= ?",
            (inicio,),
        ).fetchone()[0]
        tareas_n = conn.execute(
            "SELECT COUNT(*) FROM tareas WHERE creado_en >= ?", (inicio,)
        ).fetchone()[0]
        dominados = conn.execute(
            "SELECT COUNT(*) FROM temas WHERE dominio = 'lo_tengo'"
        ).fetchone()[0]
    cursos = get_cursos()
    avances = {c["nombre"]: avance_curso(c["id"])[2] for c in cursos}
    return {
        "horas_totales": round(horas, 1),
        "tareas_completadas": tareas_c,
        "tareas_creadas": tareas_n,
        "temas_dominados": dominados,
        "avance_por_curso": avances,
    }


# ── Export / Import ─────────────────────────────────────────────────────────

def exportar_datos(path: str) -> None:
    tablas = ["cursos", "unidades", "temas", "subtemas", "tareas", "bloques", "sesiones", "config"]
    data: dict[str, Any] = {}
    with get_connection() as conn:
        for t in tablas:
            data[t] = [dict(r) for r in conn.execute(f"SELECT * FROM {t}").fetchall()]
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)


def importar_datos(path: str) -> None:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    orden = ["config", "cursos", "unidades", "temas", "subtemas", "tareas", "bloques", "sesiones"]
    with get_connection() as conn:
        for t in reversed(orden):
            conn.execute(f"DELETE FROM {t}")
        for t in orden:
            for row in data.get(t, []):
                cols = ", ".join(row.keys())
                conn.execute(
                    f"INSERT INTO {t} ({cols}) VALUES ({', '.join('?' * len(row))})",
                    list(row.values()),
                )
        _commit(conn)


def borrar_todos_datos() -> None:
    tablas = ["sesiones", "bloques", "tareas", "subtemas", "temas", "unidades", "cursos"]
    with get_connection() as conn:
        for t in tablas:
            conn.execute(f"DELETE FROM {t}")
        _commit(conn)
    with get_connection() as conn:
        _seed_if_empty(conn)
        _commit(conn)


def get_contexto_ia() -> dict:
    return {
        "fecha": date.today().isoformat(),
        "indice_dominio": indice_dominio_global(),
        "indice_riesgo": indice_riesgo_global(),
        "examenes": get_examenes_proximos(),
        "misiones": get_misiones_hoy(),
        "tareas_pendientes": [t for t in get_tareas() if t["estado"] != "completada"],
        "bloques_hoy": get_bloques(date.today().isoformat()),
    }
