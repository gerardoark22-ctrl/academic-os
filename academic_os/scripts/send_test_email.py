"""Envía un correo de prueba Hades vía SMTP (.env). Uso: python scripts/send_test_email.py"""

import os
import smtplib
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from env_loader import load_env_file

load_env_file()

TO = "gerardoark22@gmail.com"
SUBJECT = "⚰️ PRUEBA Hades — Academic OS Odyssey"
BODY = """⚰️🔥 Informe de prueba — Academic OS

VEREDICTO: CORREO DE PRUEBA REGISTRADO EN EL INFRAMUNDO

Gerardo, ⚰️ este es un envío de prueba desde Academic OS Odyssey.

• ⚡ Si ves tablas y emojis en HTML, SMTP + plantilla OK
• ⏳ Los informes automáticos llegan a las 18:00, 21:00 y 22:00

— Hades, Registro del Inframundo (test)
"""

HTML = """<!DOCTYPE html>
<html lang="es"><body style="margin:0;background:#0a0606;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0606;"><tr><td align="center" style="padding:24px;">
<table width="600" cellpadding="0" cellspacing="0" style="border:3px solid #8b0000;background:#120808;">
<tr><td style="padding:20px;text-align:center;background:#3d0c0c;border-bottom:3px solid #ff4444;">
<div style="font-size:28px;">⚰️🔥⚔️</div>
<div style="color:#ffd700;font-size:22px;font-weight:bold;">HADES — PRUEBA</div>
</td></tr>
<tr><td style="padding:20px;color:#ebdcc3;">
<p style="color:#fff;background:#8b0000;padding:12px;text-align:center;font-weight:bold;">⚰️ VEREDICTO: CORREO DE PRUEBA</p>
<table width="100%" cellpadding="8" cellspacing="0" style="border:2px solid #8b0000;margin:16px 0;border-collapse:collapse;">
<tr style="background:#2d0a0a;color:#ffb347;"><td>📊 Métrica</td><td align="right">Valor</td></tr>
<tr style="background:#1a0f0f;color:#ffd700;"><td>⏳ Estudio</td><td align="right">PRUEBA OK</td></tr>
<tr style="background:#1a0f0f;color:#ff6b6b;"><td>⚠️ Amenaza</td><td align="right">HTML activo</td></tr>
</table>
<p style="color:#ffd700;font-weight:bold;text-align:center;">⚡ Abre Academic OS ⚡</p>
</td></tr>
</table></td></tr></table></body></html>"""


def main() -> int:
    host = os.environ.get("ACADEMICOS_SMTP_HOST")
    user = os.environ.get("ACADEMICOS_SMTP_USER")
    pwd = os.environ.get("ACADEMICOS_SMTP_PASS")
    from_addr = os.environ.get("ACADEMICOS_SMTP_FROM", user)
    port = int(os.environ.get("ACADEMICOS_SMTP_PORT", "587"))

    if not all([host, user, pwd]):
        print("ERROR: faltan variables ACADEMICOS_SMTP_* en academic_os/.env")
        return 1

    msg = MIMEMultipart("alternative")
    msg.attach(MIMEText(BODY, "plain", "utf-8"))
    msg.attach(MIMEText(HTML, "html", "utf-8"))
    msg["Subject"] = SUBJECT
    msg["From"] = from_addr
    msg["To"] = TO

    print(f"Enviando prueba HTML a {TO} via {host}:{port}...")
    with smtplib.SMTP(host, port, timeout=20) as server:
        server.starttls()
        server.login(user, pwd)
        server.sendmail(from_addr, [TO], msg.as_string())

    print("OK: correo de prueba enviado.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
