"""Exportar TimeBlocking a PDF."""

from datetime import date
from pathlib import Path

import database as db
from config import TB_HORA_FIN, TB_HORA_INICIO, TB_SLOT_MIN


def export_timeblocking_pdf(fecha: str | None = None, path: str | None = None) -> str:
    try:
        from fpdf import FPDF
    except ImportError:
        raise RuntimeError("Instala fpdf2: pip install fpdf2")

    fecha = fecha or date.today().isoformat()
    bloques = {b["hora_inicio"][:5]: b for b in db.get_bloques(fecha)}
    done, total, pct = db.progreso_dia(fecha)

    if not path:
        path = str(Path.home() / "Downloads" / f"TimeBlocking_{fecha}.pdf")

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 12, "Academic OS - TimeBlocking", ln=True)
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 8, f"Fecha: {fecha}  |  Progreso: {done}/{total} ({int(pct)}%)", ln=True)
    pdf.ln(4)

    from datetime import datetime, timedelta
    d = date.fromisoformat(fecha)
    slot = datetime.combine(d, datetime.min.time().replace(hour=TB_HORA_INICIO))
    end = datetime.combine(d, datetime.min.time().replace(hour=TB_HORA_FIN, minute=30))

    pdf.set_font("Helvetica", "B", 10)
    pdf.set_fill_color(230, 230, 240)
    pdf.cell(30, 8, "Hora", border=1, fill=True)
    pdf.cell(100, 8, "Bloque", border=1, fill=True)
    pdf.cell(30, 8, "Estado", border=1, fill=True, ln=True)
    pdf.set_font("Helvetica", "", 10)

    while slot <= end:
        hs = slot.strftime("%H:%M")
        b = bloques.get(hs)
        if b:
            titulo = b.get("titulo", "Bloque")
            estado = "Completado" if b["estado"] == "completado" else "Pendiente"
            tipo = b.get("tipo", "")
            titulo = f"{titulo} ({tipo})"
        else:
            titulo = "-"
            estado = "Libre"
        pdf.cell(30, 7, hs, border=1)
        pdf.cell(100, 7, titulo[:48], border=1)
        pdf.cell(30, 7, estado, border=1, ln=True)
        slot += timedelta(minutes=TB_SLOT_MIN)

    pdf.ln(6)
    pdf.set_font("Helvetica", "I", 9)
    pdf.cell(0, 6, "Generado por Academic OS", ln=True)
    pdf.output(path)
    return path
