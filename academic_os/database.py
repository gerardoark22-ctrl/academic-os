"""Capa de datos SQLite — Academic OS v2."""

import json
import sqlite3
from datetime import date, datetime, timedelta
from typing import Any, Optional

from config import CONFIG_DEFAULTS, DB_PATH, DB_VERSION, DOMINIO_SCORE, DEEPSEEK_BUILTIN_KEY, TB_HORA_FIN, TB_HORA_INICIO, TB_SLOT_MIN

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


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_connection() as conn:
        if _needs_migration(conn):
            _migrate_schema(conn)
        else:
            conn.executescript(SCHEMA)
        for k, v in CONFIG_DEFAULTS.items():
            conn.execute("INSERT OR IGNORE INTO config (clave, valor) VALUES (?, ?)", (k, v))
        conn.execute(
            "INSERT OR REPLACE INTO config (clave, valor) VALUES ('db_version', ?)",
            (DB_VERSION,),
        )
        _seed_if_empty(conn)
        _apply_schema_patches(conn)
        _ensure_ai_key(conn)
        conn.commit()


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


def _apply_schema_patches(conn: sqlite3.Connection) -> None:
    """Añade columnas nuevas sin borrar datos."""
    if not _table_exists(conn, "tareas"):
        return
    cols = {r[1] for r in conn.execute("PRAGMA table_info(tareas)").fetchall()}
    if "recordatorio" not in cols:
        conn.execute("ALTER TABLE tareas ADD COLUMN recordatorio INTEGER DEFAULT 0")
    if "recordatorio_hora" not in cols:
        conn.execute("ALTER TABLE tareas ADD COLUMN recordatorio_hora TIME")


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
    """Migra schema in-place sin borrar el archivo (evita WinError 32)."""
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
        conn.commit()


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
        conn.commit()
        return cur.lastrowid


def actualizar_curso(curso_id: int, **kwargs) -> None:
    if not kwargs:
        return
    cols = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [curso_id]
    with get_connection() as conn:
        conn.execute(f"UPDATE cursos SET {cols} WHERE id = ?", vals)
        conn.commit()


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
        conn.commit()
        return cur.lastrowid


def actualizar_unidad(unidad_id: int, **kwargs) -> None:
    if not kwargs:
        return
    cols = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [unidad_id]
    with get_connection() as conn:
        conn.execute(f"UPDATE unidades SET {cols} WHERE id = ?", vals)
        conn.commit()


def eliminar_unidad(unidad_id: int) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM unidades WHERE id = ?", (unidad_id,))
        conn.commit()


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
        conn.commit()
        return cur.lastrowid


def actualizar_tema(tema_id: int, **kwargs) -> None:
    if not kwargs:
        return
    cols = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [tema_id]
    with get_connection() as conn:
        conn.execute(f"UPDATE temas SET {cols} WHERE id = ?", vals)
        conn.commit()


def eliminar_tema(tema_id: int) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM subtemas WHERE tema_id = ?", (tema_id,))
        conn.execute("DELETE FROM temas WHERE id = ?", (tema_id,))
        conn.commit()


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
        conn.commit()
        return cur.lastrowid


def actualizar_subtema(subtema_id: int, **kwargs) -> None:
    if not kwargs:
        return
    cols = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [subtema_id]
    with get_connection() as conn:
        conn.execute(f"UPDATE subtemas SET {cols} WHERE id = ?", vals)
        conn.commit()


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


def avance_unidad(unidad_id: int) -> tuple[int, int, float]:
    with get_connection() as conn:
        total = conn.execute(
            "SELECT COUNT(*) FROM temas WHERE unidad_id = ?", (unidad_id,)
        ).fetchone()[0]
        dominados = conn.execute(
            "SELECT COUNT(*) FROM temas WHERE unidad_id = ? AND dominio = 'lo_tengo'",
            (unidad_id,),
        ).fetchone()[0]
    pct = dominados / total if total else 0.0
    return dominados, total, pct


def avance_curso(curso_id: int) -> tuple[int, int, float]:
    with get_connection() as conn:
        total = conn.execute(
            "SELECT COUNT(*) FROM temas WHERE curso_id = ?", (curso_id,)
        ).fetchone()[0]
        dominados = conn.execute(
            "SELECT COUNT(*) FROM temas WHERE curso_id = ? AND dominio = 'lo_tengo'",
            (curso_id,),
        ).fetchone()[0]
    pct = dominados / total if total else 0.0
    return dominados, total, pct


def contar_dominio_unidad(unidad_id: int) -> dict[str, int]:
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


def get_resumen_riesgo() -> dict:
    examenes = get_examenes_proximos()
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
        "nivel": indice_riesgo_global(),
        "examenes_criticos": criticos,
        "examenes_proximos": examenes[:6],
        "tareas_vencidas": vencidas,
        "tareas_urgentes": urgentes,
        "temas_sin_dominar": res["cero_pista"] + res["entendiendo"],
        "cero_pista": res["cero_pista"],
    }


def indice_riesgo_global() -> int:
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
            _, _, av = avance_unidad(u["id"])
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


def get_examenes_proximos() -> list[dict]:
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
        dom, tot, av = avance_unidad(d["id"])
        dias = dias_restantes(d.get("fecha_examen"))
        d["dias_restantes"] = dias
        d["avance"] = av
        d["dominados"] = dom
        d["total_temas"] = tot
        d["semaforo"] = calcular_semaforo(dias, av)
        result.append(d)
    return result


def proximo_examen_curso(curso_id: int) -> Optional[dict]:
    examenes = [e for e in get_examenes_proximos() if e["curso_id"] == curso_id]
    return examenes[0] if examenes else None


def curso_en_alerta() -> int:
    count = 0
    for c in get_cursos():
        for u in get_unidades(c["id"]):
            _, _, av = avance_unidad(u["id"])
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
    keys = list(kwargs.keys())
    with get_connection() as conn:
        cur = conn.execute(
            f"INSERT INTO tareas ({', '.join(keys)}) VALUES ({', '.join('?' * len(keys))})",
            list(kwargs.values()),
        )
        conn.commit()
        return cur.lastrowid


def actualizar_tarea(tarea_id: int, **kwargs) -> None:
    if not kwargs:
        return
    cols = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [tarea_id]
    with get_connection() as conn:
        conn.execute(f"UPDATE tareas SET {cols} WHERE id = ?", vals)
        conn.commit()


def eliminar_tarea(tarea_id: int) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM tareas WHERE id = ?", (tarea_id,))
        conn.commit()


def completar_tarea(tarea_id: int) -> None:
    actualizar_tarea(tarea_id, estado="completada")
    with get_connection() as conn:
        conn.execute(
            "UPDATE bloques SET estado = 'completado' WHERE tarea_id = ? AND estado != 'completado'",
            (tarea_id,),
        )
        conn.commit()


def contar_tareas_pendientes() -> int:
    with get_connection() as conn:
        return conn.execute(
            "SELECT COUNT(*) FROM tareas WHERE estado != 'completada'"
        ).fetchone()[0]


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
        conn.commit()
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
    keys = list(kwargs.keys())
    with get_connection() as conn:
        cur = conn.execute(
            f"INSERT INTO bloques ({', '.join(keys)}) VALUES ({', '.join('?' * len(keys))})",
            list(kwargs.values()),
        )
        conn.commit()
        return cur.lastrowid


def actualizar_bloque(bloque_id: int, **kwargs) -> None:
    if not kwargs:
        return
    cols = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [bloque_id]
    with get_connection() as conn:
        conn.execute(f"UPDATE bloques SET {cols} WHERE id = ?", vals)
        conn.commit()


def eliminar_bloque(bloque_id: int) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM bloques WHERE id = ?", (bloque_id,))
        conn.commit()


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
        conn.commit()
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
        conn.commit()


def borrar_todos_datos() -> None:
    tablas = ["sesiones", "bloques", "tareas", "subtemas", "temas", "unidades", "cursos"]
    with get_connection() as conn:
        for t in tablas:
            conn.execute(f"DELETE FROM {t}")
        conn.commit()
    with get_connection() as conn:
        _seed_if_empty(conn)
        conn.commit()


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
