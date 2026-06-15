"""Dashboard — Academic OS v2."""

import random
from datetime import date

import customtkinter as ctk

import database as db
from ai.openai_client import AcademicAI
from config import COLORS, MOTIVACION, PRIORIDAD_LABELS, SEMAFORO_COLORS
from modules.components import GlowFrame, DominioStatusWidget, PulseBorder, hora_saludo, safe_color


class DashboardFrame(ctk.CTkFrame):
    def __init__(self, master, app, **kwargs):
        super().__init__(master, fg_color=COLORS["bg"], **kwargs)
        self.app = app
        self.ai = AcademicAI(db.get_ai_api_key())
        self._plan_bloques: list = []
        self._build()
        self.refresh()

    def _build(self):
        self.scroll = ctk.CTkScrollableFrame(self, fg_color=COLORS["bg"])
        self.scroll.pack(fill="both", expand=True, padx=16, pady=16)

        self.greeting = ctk.CTkLabel(
            self.scroll, text="",
            font=ctk.CTkFont(size=30, weight="bold"),
            text_color=COLORS["text"],
        )
        self.greeting.pack(anchor="w")
        self.date_lbl = ctk.CTkLabel(self.scroll, text="", text_color=COLORS["text_sec"])
        self.date_lbl.pack(anchor="w", pady=(0, 4))
        self.motiv_lbl = ctk.CTkLabel(
            self.scroll, text="",
            font=ctk.CTkFont(size=14, slant="italic"),
            text_color=COLORS["accent2"],
        )
        self.motiv_lbl.pack(anchor="w", pady=(0, 16))

        life_frame = ctk.CTkFrame(
            self.scroll, fg_color=COLORS["surface"],
            corner_radius=16, border_width=1, border_color=COLORS["border"],
        )
        life_frame.pack(fill="x", pady=(0, 16))
        ctk.CTkLabel(
            life_frame, text="📊 TU PREPARACIÓN ACADÉMICA",
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color=COLORS["text_sec"],
        ).pack(anchor="w", padx=16, pady=(14, 0))
        self.life_bar = DominioStatusWidget(life_frame)
        self.life_bar.pack(fill="x", padx=16, pady=(8, 16))

        ctk.CTkLabel(
            self.scroll, text="📅 PRÓXIMOS EXÁmenes",
            font=ctk.CTkFont(size=16, weight="bold"),
        ).pack(anchor="w", pady=(0, 8))
        self.exam_scroll = ctk.CTkScrollableFrame(
            self.scroll, fg_color="transparent", orientation="horizontal", height=180,
        )
        self.exam_scroll.pack(fill="x", pady=(0, 16))

        cols = ctk.CTkFrame(self.scroll, fg_color="transparent")
        cols.pack(fill="both", expand=True)
        cols.grid_columnconfigure((0, 1), weight=1)

        left = ctk.CTkFrame(cols, fg_color=COLORS["surface"], corner_radius=16)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        ctk.CTkLabel(
            left, text="⚡ MISIONES DE HOY",
            font=ctk.CTkFont(size=15, weight="bold"),
        ).pack(anchor="w", padx=14, pady=(14, 8))
        self.misiones_box = ctk.CTkFrame(left, fg_color="transparent")
        self.misiones_box.pack(fill="both", expand=True, padx=10, pady=(0, 14))

        right = ctk.CTkFrame(cols, fg_color=COLORS["surface"], corner_radius=16)
        right.grid(row=0, column=1, sticky="nsew", padx=(8, 0))
        ctk.CTkLabel(
            right, text="⏰ BLOQUES DE HOY",
            font=ctk.CTkFont(size=15, weight="bold"),
        ).pack(anchor="w", padx=14, pady=(14, 8))
        self.bloques_box = ctk.CTkFrame(right, fg_color="transparent")
        self.bloques_box.pack(fill="both", expand=True, padx=10)
        self.prog_bloques = ctk.CTkProgressBar(right, height=10)
        self.prog_bloques.pack(fill="x", padx=14, pady=4)
        self.prog_lbl = ctk.CTkLabel(right, text="", text_color=COLORS["text_sec"], font=ctk.CTkFont(size=11))
        self.prog_lbl.pack(anchor="w", padx=14)
        ctk.CTkButton(
            right, text="+ Crear bloque", fg_color=COLORS["accent2"],
            command=lambda: self.app.navigate("timeblocking"),
        ).pack(padx=14, pady=14, anchor="w")

        ia = ctk.CTkFrame(
            self.scroll, fg_color=COLORS["surface_elevated"],
            corner_radius=16, border_width=1, border_color=COLORS["accent"],
        )
        ia.pack(fill="x", pady=16)
        ctk.CTkButton(
            ia, text="🤖 GENERAR PLAN DEL DÍA CON IA",
            font=ctk.CTkFont(size=15, weight="bold"),
            height=48, fg_color=COLORS["accent"],
            command=self._plan_ia,
        ).pack(fill="x", padx=16, pady=(16, 8))
        self.ia_text = ctk.CTkTextbox(ia, height=130, fg_color=COLORS["surface"])
        self.ia_text.pack(fill="x", padx=16, pady=4)
        self.ia_text.insert("1.0", "Tu plan personalizado aparecerá aquí...")
        self.ia_text.configure(state="disabled")
        btns = ctk.CTkFrame(ia, fg_color="transparent")
        btns.pack(fill="x", padx=16, pady=(4, 16))
        ctk.CTkButton(btns, text="✅ Aplicar al TimeBlocking", command=self._aplicar).pack(side="left", padx=4)
        ctk.CTkButton(btns, text="✏️ Hacerlo yo", fg_color=COLORS["surface"], command=lambda: self.app.navigate("timeblocking")).pack(side="left", padx=4)

    def refresh(self):
        nombre = db.get_config("nombre_usuario", "Estudiante")
        self.greeting.configure(text=f"{hora_saludo()}, {nombre}")
        self.date_lbl.configure(text=date.today().strftime("%A, %d de %B de %Y").capitalize())

        resumen = db.resumen_dominio_global()
        self.life_bar.set_resumen(resumen)
        idx = resumen["porcentaje"]
        if idx <= 30:
            pool = MOTIVACION["critico"]
        elif idx <= 60:
            pool = MOTIVACION["medio"]
        else:
            pool = MOTIVACION["alto"]
        self.motiv_lbl.configure(text=random.choice(pool))

        for w in self.exam_scroll.winfo_children():
            w.destroy()
        examenes = db.get_examenes_proximos()
        if not examenes:
            ctk.CTkLabel(self.exam_scroll, text="Sin exámenes programados", text_color=COLORS["text_sec"]).pack()
        for ex in examenes:
            self._exam_card(ex)

        for w in self.misiones_box.winfo_children():
            w.destroy()
        misiones = db.get_misiones_hoy()
        if not misiones:
            ctk.CTkLabel(
                self.misiones_box,
                text="🎯 Sin misiones críticas — ¡Aprovecha para adelantar!",
                text_color=COLORS["green"], wraplength=320,
            ).pack(anchor="w", pady=8)
        for m in misiones:
            self._mision_card(m)

        for w in self.bloques_box.winfo_children():
            w.destroy()
        bloques = db.get_bloques(date.today().isoformat())
        actual = db.get_bloque_actual()
        for b in bloques:
            is_now = actual and actual["id"] == b["id"]
            color = safe_color(b.get("curso_color"), COLORS["accent"])
            parent = GlowFrame(self.bloques_box, glow_color=color) if is_now else ctk.CTkFrame(
                self.bloques_box, fg_color=COLORS["surface_elevated"], corner_radius=8,
            )
            parent.pack(fill="x", pady=3)
            icon = "✓" if b["estado"] == "completado" else ("▶" if is_now else "○")
            ctk.CTkLabel(
                parent,
                text=f"{icon} {b['hora_inicio'][:5]} — {b.get('titulo', 'Bloque')}",
                text_color=color,
            ).pack(anchor="w", padx=10, pady=6)
        done, total, pct = db.progreso_dia(date.today().isoformat())
        self.prog_bloques.set(pct / 100 if total else 0)
        self.prog_lbl.configure(text=f"{done}/{total} bloques completados — {int(pct)}%")

    def _exam_card(self, ex: dict):
        sem = ex["semaforo"]
        border = SEMAFORO_COLORS.get(sem, COLORS["border"])
        dias = ex.get("dias_restantes")
        critico = dias is not None and dias <= 3
        parent_cls = PulseBorder if critico else ctk.CTkFrame
        card = parent_cls(
            self.exam_scroll, fg_color=COLORS["surface_elevated"],
            corner_radius=14, border_width=2, border_color=border, width=220,
        )
        card.pack(side="left", padx=6, pady=4)
        ctk.CTkLabel(
            card, text=ex["curso_nombre"],
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color=safe_color(ex.get("curso_color"), COLORS["text"]),
        ).pack(padx=12, pady=(10, 0), anchor="w")
        ctk.CTkLabel(card, text=ex["nombre"], text_color=COLORS["text_sec"], font=ctk.CTkFont(size=11)).pack(padx=12, anchor="w")
        ctk.CTkLabel(
            card, text=str(dias) if dias is not None else "—",
            font=ctk.CTkFont(size=36, weight="bold"),
            text_color=border,
        ).pack(pady=4)
        ctk.CTkLabel(card, text="días restantes", text_color=COLORS["text_sec"], font=ctk.CTkFont(size=10)).pack()
        pct = int(ex["avance"] * 100)
        bar = ctk.CTkProgressBar(card, width=180, progress_color=safe_color(ex.get("curso_color"), COLORS["accent"]))
        bar.pack(padx=12, pady=6)
        bar.set(ex["avance"])
        ctk.CTkLabel(card, text=f"{pct}% dominado", font=ctk.CTkFont(size=10)).pack(pady=(0, 10))
        if critico:
            ctk.CTkLabel(card, text="¡EXAMEN INMINENTE!", text_color=COLORS["red"], font=ctk.CTkFont(weight="bold")).pack(pady=(0, 8))

    def _mision_card(self, t: dict):
        card = ctk.CTkFrame(
            self.misiones_box, fg_color=COLORS["surface_elevated"],
            corner_radius=10, border_width=0,
        )
        card.pack(fill="x", pady=4)
        stripe = ctk.CTkFrame(card, width=4, fg_color=safe_color(t.get("curso_color"), COLORS["accent"]))
        stripe.pack(side="left", fill="y")
        body = ctk.CTkFrame(card, fg_color="transparent")
        body.pack(side="left", fill="x", expand=True, padx=8, pady=8)
        ctk.CTkLabel(body, text=t["titulo"], font=ctk.CTkFont(weight="bold"), anchor="w").pack(anchor="w")
        meta = PRIORIDAD_LABELS.get(t.get("prioridad", "normal"), "🟢 NORMAL")
        hora = f" | {t['hora_limite'][:5]}" if t.get("hora_limite") else ""
        ctk.CTkLabel(body, text=f"{meta}{hora}", text_color=COLORS["text_sec"], font=ctk.CTkFont(size=11)).pack(anchor="w")
        ctk.CTkButton(
            card, text="✓", width=36, fg_color=COLORS["green"],
            command=lambda tid=t["id"]: self._completar(tid),
        ).pack(side="right", padx=8)

    def _completar(self, tid: int):
        db.completar_tarea(tid)
        self.app.update_badges()
        self.refresh()

    def _plan_ia(self):
        self.ai.set_api_key(db.get_ai_api_key())
        try:
            ctx = db.get_contexto_ia()
            plan = self.ai.generar_plan_dia(ctx["tareas_pendientes"], ctx["bloques_hoy"], ctx["examenes"])
            self._plan_bloques = self.ai.generar_plan_dia_bloques(ctx)
            self.ia_text.configure(state="normal")
            self.ia_text.delete("1.0", "end")
            self.ia_text.insert("1.0", plan)
            self.ia_text.configure(state="disabled")
        except Exception as e:
            self.ia_text.configure(state="normal")
            self.ia_text.delete("1.0", "end")
            self.ia_text.insert("1.0", f"⚠️ {e}")
            self.ia_text.configure(state="disabled")

    def _aplicar(self):
        if not self._plan_bloques:
            self._plan_ia()
        hoy = date.today().isoformat()
        cursos = {c["nombre"]: c["id"] for c in db.get_cursos()}
        for b in self._plan_bloques:
            hi = b.get("hora_inicio", "09:00")
            hf = b.get("hora_fin", "09:30")
            db.crear_bloque(
                fecha=hoy,
                hora_inicio=hi + ":00" if len(hi) == 5 else hi,
                hora_fin=hf + ":00" if len(hf) == 5 else hf,
                titulo=b.get("titulo", "Estudio"),
                tipo=b.get("tipo", "estudio"),
                curso_id=cursos.get(b.get("curso_nombre")),
            )
        self.app.navigate("timeblocking")
