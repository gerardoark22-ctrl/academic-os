"""Prueba del sync laptop ↔ Android. Correr: python test_sync.py

Usa una base temporal aparte, no toca tus datos.
"""

import os
import sys
import tempfile
from pathlib import Path

TMP = tempfile.mkdtemp(prefix="aos_test_")
os.environ["ACADEMIC_OS_DATA"] = TMP
os.environ["ACADEMICOS_TOKEN"] = "token-de-prueba"
os.environ["ACADEMICOS_OWNER_EMAIL"] = "dueno@test.com"

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi.testclient import TestClient  # noqa: E402

import database  # noqa: E402  (importarlo dispara load_env_file() -> carga el .env real)
from api.server import create_app  # noqa: E402

# Nos interesa probar la ruta "SMTP no configurado", no mandar un correo real.
for _var in ("ACADEMICOS_SMTP_HOST", "ACADEMICOS_SMTP_USER", "ACADEMICOS_SMTP_PASS"):
    os.environ.pop(_var, None)

database.init_db()  # crea las tablas: fuera de uvicorn nadie dispara el startup
c = TestClient(create_app())
H = {"X-Token": "token-de-prueba"}


def test_sync() -> None:
    assert c.get("/api/health").status_code == 200, "health no debe pedir token"
    assert c.get("/api/state").status_code == 401, "sin token no se entra"

    vacio = c.get("/api/state", headers=H).json()
    assert vacio["updated_at"] == 0 and vacio["data"] is None

    r = c.put("/api/state", headers=H, json={"base": 0, "data": {"courses": [{"id": "c1"}]}})
    v1 = r.json()["updated_at"]
    assert r.json()["ok"] and v1 > 0

    bajado = c.get("/api/state", headers=H).json()
    assert bajado["data"]["courses"][0]["id"] == "c1"
    assert bajado["updated_at"] == v1

    # El otro equipo sube creyendo una versión vieja -> conflicto, no pisa.
    r = c.put("/api/state", headers=H, json={"base": 1, "data": {"courses": []}})
    assert r.status_code == 409 and r.json()["conflict"]
    assert c.get("/api/state", headers=H).json()["data"]["courses"], "no debió borrarse"

    # Con la versión correcta sí entra.
    r = c.put("/api/state", headers=H, json={"base": v1, "data": {"courses": [{"id": "c2"}]}})
    assert r.json()["ok"]

    # force pisa aunque la base esté mal (resolución manual de conflicto).
    r = c.put("/api/state", headers=H, json={"base": 999, "force": True, "data": {"courses": [{"id": "c3"}]}})
    assert r.json()["ok"]
    assert c.get("/api/state", headers=H).json()["data"]["courses"][0]["id"] == "c3"


def test_entradas_invalidas() -> None:
    """Datos basura del cliente = 400, no un 500 ni una columna pisada."""
    r = c.post("/api/tareas", headers=H, json={})
    assert r.status_code == 400, f"tarea vacía debió dar 400, dio {r.status_code}"

    r = c.post("/api/bloques", headers=H, json={})
    assert r.status_code == 400, f"bloque sin horas debió dar 400, dio {r.status_code}"

    # Campo inventado: se ignora en vez de reventar el SQL.
    r = c.post("/api/tareas", headers=H, json={"titulo": "Estudiar", "campo_raro": "x"})
    assert r.status_code == 200, r.text
    tid = r.json()["id"]

    # Intentar pisar la clave primaria no debe funcionar.
    c.patch(f"/api/tareas/{tid}", headers=H, json={"id": 99999, "titulo": "Editada"})
    assert c.get(f"/api/tareas/{tid}", headers=H).json()["titulo"] == "Editada"


def test_login_por_codigo() -> None:
    # Correo no autorizado: rechazado, sin ni intentar mandar nada.
    r = c.post("/api/auth/solicitar-codigo", json={"email": "intruso@test.com"})
    assert r.status_code == 403, r.text

    # Correo correcto, pero sin SMTP en el entorno: error claro, no un 500 mudo.
    r = c.post("/api/auth/solicitar-codigo", json={"email": "dueno@test.com"})
    assert r.status_code == 500, "sin SMTP debería avisar, no fallar en silencio"

    # Simulamos que sí llegó el código (sin depender de un SMTP real en el test).
    database.set_config("auth_codigo", "123456")
    database.set_config("auth_codigo_vence", str(int(__import__("time").time()) + 300))
    database.set_config("auth_codigo_intentos", "0")

    r = c.post("/api/auth/verificar-codigo", json={"email": "dueno@test.com", "codigo": "000000"})
    assert r.status_code == 401, "código incorrecto debe rechazarse"

    r = c.post("/api/auth/verificar-codigo", json={"email": "dueno@test.com", "codigo": "123456"})
    assert r.status_code == 200 and r.json()["token"] == "token-de-prueba"

    # Un solo uso: el mismo código no vuelve a servir.
    r = c.post("/api/auth/verificar-codigo", json={"email": "dueno@test.com", "codigo": "123456"})
    assert r.status_code == 401, "el código ya usado no debe funcionar de nuevo"


if __name__ == "__main__":
    test_sync()
    test_entradas_invalidas()
    test_login_por_codigo()
    print("OK — sync, token, conflictos, validación de entradas y login por correo funcionan")
