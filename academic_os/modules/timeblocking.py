"""TimeBlocking — Academic OS v2."""

from datetime import date, datetime, timedelta

import customtkinter as ctk
from tkinter import filedialog, messagebox

import database as db
from ai.openai_client import AcademicAI
from config import COLORS, TB_HORA_FIN, TB_HORA_INICIO, TB_SLOT_MIN, TIPO_BLOQUE_ICON, TIPOS_BLOQUE
from modules.components import GlowFrame, TimeSelector, game_button
from modules.pdf_export import export_timeblocking_pdf
from modules.theme_engine import font, lbl


class TimeBlockingFrame(ctk.CTkFrame):
    def __init__(self, master, app, **kwargs):
        super().__init__(master, fg_color=COLORS["bg"], **kwargs)
        self.app = app
        self.ai = AcademicAI(db.get_ai_api_key())
        self.fecha = date.today()
        self._pinned_today = True
        self._slot_rows: dict[str, ctk.CTkFrame] = {}
        self._bloques_cache: dict[str, dict] = {}
        self._build()
        self.refresh()

    def on_new_day(self):
        if self._pinned_today:
            self.fecha = date.today()
            self.refresh()

    def _build(self):
        hdr = ctk.CTkFrame(self, fg_color=COLORS["surface"], corner_radius=0)
        hdr.pack(fill="x", padx=0, pady=0)

        nav = ctk.CTkFrame(hdr, fg_color="transparent")
        nav.pack(fill="x", padx=16, pady=12)
        ctk.CTkButton(nav, text="◀", width=44, fg_color=COLORS["surface_elevated"], text_color=COLORS["text"], command=lambda: self._shift(-1)).pack(side="left")
        self.fecha_lbl = ctk.CTkLabel(nav, text="", font=font("title"), text_color=COLORS["text"])
        self.fecha_lbl.pack(side="left", expand=True)
        ctk.CTkButton(nav, text="Hoy", width=60, fg_color=COLORS["accent2"], text_color=COLORS["text_on_accent"], command=self._today).pack(side="left", padx=4)
        ctk.CTkButton(nav, text="▶", width=44, fg_color=COLORS["surface_elevated"], text_color=COLORS["text"], command=lambda: self._shift(1)).pack(side="left")

        stats = ctk.CTkFrame(hdr, fg_color="transparent")
        stats.pack(fill="x", padx=16, pady=(0, 8))
        self.prog_bar = ctk.CTkProgressBar(stats, height=14, progress_color=COLORS["green"], fg_color=COLORS["progress_track"])
        self.prog_bar.pack(side="left", fill="x", expand=True, padx=(0, 12))
        self.prog_lbl = ctk.CTkLabel(stats, text="", font=font("subtitle"), text_color=COLORS["text"])
        self.prog_lbl.pack(side="left")
        self.racha_lbl = ctk.CTkLabel(stats, text="", text_color=COLORS["accent"], font=font("body"))
        self.racha_lbl.pack(side="right", padx=8)

        btns = ctk.CTkFrame(hdr, fg_color="transparent")
        btns.pack(fill="x", padx=16, pady=(0, 12))
        ctk.CTkButton(btns, text="✓ Completar bloque actual", fg_color=COLORS["green"], text_color=COLORS["text_on_accent"], command=self._complete_now).pack(side="left", padx=4)
        self._replan_btn = ctk.CTkButton(
            btns, text="🔄 Replanificar desde ahora", fg_color=COLORS["accent"],
            text_color=COLORS["text_on_accent"], command=self._replan,
        )
        self._replan_btn.pack(side="left", padx=4)
        game_button(
            btns, text="📄 Exportar PDF", fg_color=COLORS["accent2"],
            command=self._export_pdf,
        ).pack(side="left", padx=4)

        self.timeline = ctk.CTkScrollableFrame(self, fg_color=COLORS["bg"])
        self.timeline.pack(fill="both", expand=True, padx=16, pady=12)

    def _shift(self, d: int):
        self._pinned_today = False
        self.fecha += timedelta(days=d)
        self.refresh()

    def _today(self):
        self.fecha = date.today()
        self._pinned_today = True
        self.refresh()

    def refresh(self):
        self._refresh_header()
        self._bloques_cache = {
            b["hora_inicio"][:5]: b for b in db.get_bloques(self.fecha.isoformat())
        }
        for w in self.timeline.winfo_children():
            w.destroy()
        self._slot_rows.clear()

        actual = db.get_bloque_actual() if self.fecha == date.today() else None
        slot = datetime.combine(self.fecha, datetime.min.time().replace(hour=TB_HORA_INICIO))
        end = datetime.combine(self.fecha, datetime.min.time().replace(hour=TB_HORA_FIN, minute=30))

        while slot <= end:
            hs = slot.strftime("%H:%M")
            row = ctk.CTkFrame(self.timeline, fg_color="transparent", height=36)
            row.pack(fill="x", pady=1)
            row.pack_propagate(False)
            self._slot_rows[hs] = row
            self._fill_slot_row(row, hs, actual)
            slot += timedelta(minutes=TB_SLOT_MIN)

    def _refresh_header(self):
        self.fecha_lbl.configure(text=self.fecha.strftime("%A %d/%m/%Y").capitalize())
        done, total, pct = db.progreso_dia(self.fecha.isoformat())
        self.prog_bar.set(pct / 100 if total else 0)
        self.prog_lbl.configure(text=f"⚡ {done}/{total} — {int(pct)}%")
        self.racha_lbl.configure(text=f"🔥 {db.get_racha_dias()} días")

    def _fill_slot_row(self, row: ctk.CTkFrame, hs: str, actual: dict | None):
        for w in row.winfo_children():
            w.destroy()
        ctk.CTkLabel(row, text=hs, width=52, text_color=COLORS["text_sec"], font=font("mono")).pack(side="left")

        b = self._bloques_cache.get(hs)
        if b:
            is_now = actual and actual["id"] == b["id"]
            color = b.get("curso_color") or COLORS["accent2"]
            icon = TIPO_BLOQUE_ICON.get(b.get("tipo", "estudio"), "📚")
            done = b["estado"] == "completado"
            chk_var = ctk.BooleanVar(value=done)
            ctk.CTkCheckBox(
                row, text="", variable=chk_var, width=28,
                fg_color=COLORS["green"], hover_color=COLORS["green"],
                border_color=COLORS["border"],
                command=lambda bl=b, v=chk_var: self._toggle_bloque(bl, v),
            ).pack(side="left", padx=(0, 4))
            if is_now:
                frame = GlowFrame(
                    row, fg_color=COLORS["surface"], glow_color=color,
                    corner_radius=8, height=32,
                )
            else:
                frame = ctk.CTkFrame(
                    row, fg_color=COLORS["surface"], corner_radius=8,
                    border_width=2 if not done else 1,
                    border_color=color if not done else COLORS["green"],
                    height=32,
                )
            frame.pack(side="left", fill="x", expand=True, padx=4)
            frame.pack_propagate(False)
            txt = f"{'✓ ' if done else ''}{icon} {b.get('titulo', 'Bloque')}"
            if is_now:
                txt += "  ▶ AHORA"
            ctk.CTkButton(
                frame, text=txt, height=28, anchor="w",
                fg_color="transparent", hover_color=COLORS["nav_hover"],
                text_color=COLORS["text"], font=font("body"),
                command=lambda bl=b: self._modal_edit(bl),
            ).pack(fill="both", expand=True, padx=4, pady=2)
        else:
            ctk.CTkButton(
                row, text="+ Crear bloque", anchor="w", height=28,
                fg_color=COLORS["slot_empty_bg"], hover_color=COLORS["slot_empty_hover"],
                text_color=COLORS["slot_empty_text"],
                border_width=1, border_color=COLORS["border"],
                command=lambda h=hs: self._modal_create(h),
            ).pack(side="left", fill="x", expand=True, padx=4, pady=2)

    def _reload_bloques_cache(self):
        self._bloques_cache = {
            b["hora_inicio"][:5]: b for b in db.get_bloques(self.fecha.isoformat())
        }

    def _refresh_slot(self, hs: str):
        row = self._slot_rows.get(hs)
        if not row or not row.winfo_exists():
            return
        actual = db.get_bloque_actual() if self.fecha == date.today() else None
        self._fill_slot_row(row, hs, actual)

    def _refresh_slots_after_change(self, hs: str):
        self._reload_bloques_cache()
        self._refresh_header()
        self._refresh_slot(hs)
        if self.fecha == date.today():
            actual = db.get_bloque_actual()
            if actual:
                act_hs = actual["hora_inicio"][:5]
                if act_hs != hs:
                    self._refresh_slot(act_hs)

    def _toggle_bloque(self, bloque: dict, var: ctk.BooleanVar):
        if var.get():
            db.completar_bloque(bloque["id"])
            if bloque.get("tarea_id"):
                db.completar_tarea(bloque["tarea_id"])
            db.crear_sesion(
                fecha=self.fecha.isoformat(), bloque_id=bloque["id"],
                duracion_real_min=TB_SLOT_MIN,
            )
        else:
            db.actualizar_bloque(bloque["id"], estado="pendiente")
        hs = bloque["hora_inicio"][:5]
        self._refresh_slots_after_change(hs)
        self.app.update_badges()

    def _modal_create(self, hora: str):
        self._modal(None, hora)

    def _modal_edit(self, bloque: dict):
        self._modal(bloque, bloque["hora_inicio"][:5])

    def _modal(self, bloque: dict | None, hora_inicio: str):
        m = ctk.CTkToplevel(self)
        m.title("Bloque")
        m.geometry("440x520")
        m.grab_set()
        m.configure(fg_color=COLORS["surface"])

        lbl(m, "Título").pack(anchor="w", padx=20, pady=(14, 2))
        te = ctk.CTkEntry(m, width=400)
        te.pack(padx=20)
        if bloque:
            te.insert(0, bloque.get("titulo", ""))

        lbl(m, "Tipo").pack(anchor="w", padx=20, pady=(8, 2))
        tipo_m = ctk.CTkOptionMenu(m, values=[t.capitalize() for t in TIPOS_BLOQUE], width=400)
        tipo_m.pack(padx=20)
        if bloque:
            tipo_m.set(bloque.get("tipo", "estudio").capitalize())

        cursos = db.get_cursos()
        lbl(m, "Curso").pack(anchor="w", padx=20, pady=(8, 2))
        curso_m = ctk.CTkOptionMenu(m, values=["Ninguno"] + [c["nombre"] for c in cursos], width=400)
        curso_m.pack(padx=20)

        tareas = [t for t in db.get_tareas() if t["estado"] != "completada"]
        lbl(m, "Tarea").pack(anchor="w", padx=20, pady=(8, 2))
        tarea_m = ctk.CTkOptionMenu(m, values=["Ninguna"] + [t["titulo"][:40] for t in tareas], width=400)
        tarea_m.pack(padx=20)

        row_t = ctk.CTkFrame(m, fg_color="transparent")
        row_t.pack(fill="x", padx=20, pady=8)
        hi_sel = TimeSelector(row_t, "Inicio")
        hi_sel.pack(side="left", padx=(0, 16))
        hi_sel.set(hora_inicio + ":00" if bloque else hora_inicio)
        hf = datetime.strptime(hora_inicio, "%H:%M") + timedelta(minutes=TB_SLOT_MIN)
        hf_sel = TimeSelector(row_t, "Fin")
        hf_sel.pack(side="left")
        hf_sel.set(bloque["hora_fin"][:5] + ":00" if bloque else hf.strftime("%H:%M"))

        lbl(m, "Notas").pack(anchor="w", padx=20)
        ne = ctk.CTkTextbox(m, width=400, height=70)
        ne.pack(padx=20, pady=4)

        bf = ctk.CTkFrame(m, fg_color="transparent")
        bf.pack(pady=16)

        def save():
            titulo = te.get().strip() or "Bloque"
            tipo = tipo_m.get().lower()
            curso_id = next((c["id"] for c in cursos if c["nombre"] == curso_m.get()), None)
            tarea_id = None
            if tarea_m.get() != "Ninguna":
                tarea_id = next((t["id"] for t in tareas if t["titulo"][:40] == tarea_m.get()), None)
            data = dict(titulo=titulo, tipo=tipo, curso_id=curso_id, tarea_id=tarea_id,
                        hora_inicio=hi_sel.get(), hora_fin=hf_sel.get(),
                        notas=ne.get("1.0", "end").strip())
            if bloque:
                db.actualizar_bloque(bloque["id"], **data)
            else:
                db.crear_bloque(fecha=self.fecha.isoformat(), **data)
            m.destroy()
            self.refresh()
            self.app.update_badges()

        ctk.CTkButton(bf, text="Guardar", command=save).pack(side="left", padx=4)
        if bloque:
            ctk.CTkButton(bf, text="Completar", fg_color=COLORS["green"],
                          command=lambda: (db.completar_bloque(bloque["id"]), db.crear_sesion(
                              fecha=self.fecha.isoformat(), bloque_id=bloque["id"],
                              duracion_real_min=TB_SLOT_MIN), m.destroy(), self.refresh(), self.app.update_badges())).pack(side="left", padx=4)
            ctk.CTkButton(bf, text="Eliminar", fg_color=COLORS["red"],
                          command=lambda: (db.eliminar_bloque(bloque["id"]), m.destroy(), self.refresh())).pack(side="left", padx=4)

    def _complete_now(self):
        b = db.get_bloque_actual()
        if not b:
            messagebox.showinfo("Info", "No hay bloque activo ahora")
            return
        db.completar_bloque(b["id"])
        db.crear_sesion(fecha=date.today().isoformat(), bloque_id=b["id"], duracion_real_min=TB_SLOT_MIN)
        self._refresh_slots_after_change(b["hora_inicio"][:5])
        self.app.update_badges()

    def _replan(self):
        if getattr(self, "_replan_busy", False):
            return
        self.ai.set_api_key(db.get_ai_api_key())
        if not self.ai.api_key:
            messagebox.showerror("Error", "Configura tu API Key de DeepSeek en ⚙️ Configuración")
            return
        pend = db.get_bloques_pendientes_hoy()
        hrs = max(0.5, (datetime.now().replace(hour=23, minute=59) - datetime.now()).seconds / 3600)
        self._replan_busy = True
        self._replan_btn.configure(state="disabled", text="⏳ Replanificando…")

        def work():
            return self.ai.redistribuir_plan_completo(pend, hrs)

        def _done():
            self._replan_busy = False
            if hasattr(self, "_replan_btn") and self._replan_btn.winfo_exists():
                self._replan_btn.configure(state="normal", text="🔄 Replanificar desde ahora")

        def on_ok(result):
            txt, bloques = result
            _done()
            messagebox.showinfo("Replanificación IA", txt[:2500])
            for b in bloques:
                db.crear_bloque(
                    fecha=date.today().isoformat(),
                    hora_inicio=b.get("hora_inicio", "14:00") + ":00",
                    hora_fin=b.get("hora_fin", "15:00") + ":00",
                    titulo=b.get("titulo", "Estudio"),
                    tipo=b.get("tipo", "estudio"),
                )
            self.refresh()

        def on_err(err: Exception):
            _done()
            messagebox.showerror("Error", str(err))

        self.ai.run_async(self, work, on_ok, on_err)

    def _export_pdf(self):
        path = filedialog.asksaveasfilename(
            defaultextension=".pdf",
            initialfile=f"TimeBlocking_{self.fecha.isoformat()}.pdf",
            filetypes=[("PDF", "*.pdf")],
        )
        if not path:
            return
        try:
            export_timeblocking_pdf(self.fecha.isoformat(), path)
            messagebox.showinfo("PDF", f"Exportado a:\n{path}")
        except Exception as e:
            messagebox.showerror("Error PDF", str(e))
