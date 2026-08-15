"""Riesgo y Alarmas — Academic OS v2."""

from datetime import date, datetime

import customtkinter as ctk
from tkinter import messagebox

import database as db
from ai.openai_client import AcademicAI
from config import COLORS, PRIORIDAD_LABELS, SEMAFORO_COLORS, SEMAFORO_EMOJI
from modules.components import MetricCard, PulseBorder, safe_color
from modules.theme_engine import font, lbl

DEFCON = [
    (0, 25, "🟢 SEGURO", COLORS["green"], "Riesgo bajo — mantén el ritmo"),
    (26, 50, "🟡 ALERTA", COLORS["yellow"], "Hay presión académica — revisa prioridades"),
    (51, 75, "🟠 PELIGRO", COLORS["orange"], "Exámenes o tareas críticas muy cerca"),
    (76, 100, "🔴 EMERGENCIA", COLORS["red"], "Acción inmediata requerida"),
]


class RiesgoFrame(ctk.CTkFrame):
    def __init__(self, master, app, **kwargs):
        super().__init__(master, fg_color=COLORS["bg"], **kwargs)
        self.app = app
        self.ai = AcademicAI(db.get_ai_api_key())
        self._semaforos: dict[int, str] = {}
        self._build()
        self.refresh()

    def _build(self):
        scroll = ctk.CTkScrollableFrame(self, fg_color=COLORS["bg"])
        scroll.pack(fill="both", expand=True, padx=16, pady=16)
        self._scroll = scroll

        ctk.CTkLabel(
            scroll, text="⚡ CENTRO DE RENDIMIENTO",
            font=ctk.CTkFont(size=28, weight="bold"),
            text_color=COLORS["accent"],
        ).pack(anchor="w", pady=(0, 4))
        ctk.CTkLabel(
            scroll,
            text="Tu ejecución diaria: bloques, tareas agendadas y acción real",
            text_color=COLORS["text_sec"], font=ctk.CTkFont(size=12),
        ).pack(anchor="w", pady=(0, 12))

        self.perf_banner = ctk.CTkFrame(scroll, fg_color=COLORS["surface"], corner_radius=16)
        self.perf_banner.pack(fill="x", pady=8)

        self.perf_actions = ctk.CTkFrame(scroll, fg_color="transparent")
        self.perf_actions.pack(fill="x", pady=(0, 8))

        self.alert_banner = ctk.CTkFrame(scroll, fg_color=COLORS["surface"], corner_radius=16)
        self.alert_banner.pack(fill="x", pady=8)

        self.threat_box = ctk.CTkFrame(scroll, fg_color="transparent")
        self.threat_box.pack(fill="x", pady=8)
        self.threat_box.grid_columnconfigure((0, 1, 2, 3), weight=1)

        lbl(scroll, "⏳ CUENTA REGRESIVA — EXÁMENES", style="section").pack(anchor="w", pady=(12, 8))
        self.exam_scroll = ctk.CTkScrollableFrame(scroll, fg_color="transparent", orientation="horizontal", height=200)
        self.exam_scroll.pack(fill="x", pady=(0, 8))

        lbl(scroll, "📉 PRESIÓN ACADÉMICA", style="section").pack(anchor="w", pady=(12, 8))
        self.amenazas_box = ctk.CTkFrame(scroll, fg_color="transparent")
        self.amenazas_box.pack(fill="x")

        lbl(scroll, "📚 ESTADO POR CURSO", style="section").pack(anchor="w", pady=(16, 8))
        self.cursos_box = ctk.CTkFrame(scroll, fg_color="transparent")
        self.cursos_box.pack(fill="x")

    def on_new_day(self):
        today = date.today().isoformat()
        self._notified = {k for k in self._notified if today in k}
        self.refresh()

    def refresh(self):
        rend = db.get_rendimiento_hoy()
        titulo, msg, color_key = db.mensaje_rendimiento(rend)
        color = COLORS.get(color_key, COLORS["accent"])

        for w in self.perf_banner.winfo_children():
            w.destroy()
        critico = rend.get("inactivo_4h") or rend.get("inactivo") or rend["score"] < 35
        inner_cls = PulseBorder if critico else ctk.CTkFrame
        inner = inner_cls(
            self.perf_banner, fg_color=COLORS["surface_elevated"],
            corner_radius=14, border_width=3 if critico else 2, border_color=color,
        )
        inner.pack(fill="x", padx=4, pady=4)
        top = ctk.CTkFrame(inner, fg_color="transparent")
        top.pack(fill="x", padx=18, pady=(14, 6))
        ctk.CTkLabel(
            top, text=titulo, font=font("title"), text_color=color,
        ).pack(side="left")
        ctk.CTkLabel(
            top, text=f"{rend['score']}/100",
            font=ctk.CTkFont(size=40, weight="bold"), text_color=color,
        ).pack(side="right")
        ctk.CTkLabel(
            inner, text=msg, text_color=COLORS["text"],
            wraplength=900, justify="left", font=font("body"),
        ).pack(anchor="w", padx=18, pady=(0, 8))
        metrics = ctk.CTkFrame(inner, fg_color="transparent")
        metrics.pack(fill="x", padx=18, pady=(0, 14))
        for label, val in [
            (f"⏰ TB {rend['bloques_done']}/{rend['bloques_total']}", f"{int(rend['pct_bloques'])}%"),
            (f"Score TB", f"{rend.get('score_tb', 0)}/{rend.get('max_score_tb', 85)}"),
            (f"Horas sin bloque", f"{rend.get('horas_inactivas', 0):.1f}h"),
            (f"Tareas hoy", f"{rend['tareas_done']}/{rend['tareas_done'] + rend['tareas_pend_hoy']}"),
        ]:
            box = ctk.CTkFrame(metrics, fg_color=COLORS["surface"], corner_radius=10)
            box.pack(side="left", padx=4, expand=True, fill="x")
            ctk.CTkLabel(box, text=label, font=font("small"), text_color=COLORS["text_sec"]).pack(pady=(8, 0))
            ctk.CTkLabel(box, text=val, font=font("subtitle"), text_color=COLORS["text"]).pack(pady=(0, 8))

        for w in self.perf_actions.winfo_children():
            w.destroy()
        ctk.CTkButton(
            self.perf_actions, text="⏰ Abrir TimeBlocking",
            fg_color=COLORS["accent"], text_color=COLORS["text_on_accent"],
            height=40, command=lambda: self.app.navigate("timeblocking"),
        ).pack(side="left", padx=4, expand=True, fill="x")
        ctk.CTkButton(
            self.perf_actions, text="📋 Agendar tareas hoy",
            fg_color=COLORS["accent2"], text_color=COLORS["text_on_accent"],
            height=40, command=lambda: self.app.navigate("gestor_tareas"),
        ).pack(side="left", padx=4, expand=True, fill="x")
        if rend.get("inactivo_4h") or rend.get("inactivo"):
            ctk.CTkButton(
                self.perf_actions,
                text=f"💀 {rend['horas_inactivas']:.0f}h sin ejecutar — IR A TB",
                fg_color=COLORS["red"], height=44,
                font=font("subtitle"),
                command=lambda: self.app.navigate("timeblocking"),
            ).pack(side="left", padx=4, expand=True, fill="x")
        elif rend["sin_agendar_hoy"] > 0:
            ctk.CTkButton(
                self.perf_actions,
                text=f"🚨 {rend['sin_agendar_hoy']} sin bloque",
                fg_color=COLORS["red"], height=40,
                command=lambda: self.app.navigate("timeblocking"),
            ).pack(side="left", padx=4, expand=True, fill="x")

        res = db.get_resumen_riesgo()
        nivel = res["nivel"]

        for w in self.alert_banner.winfo_children():
            w.destroy()

        defcon_lbl, defcon_color, defcon_msg = DEFCON[0][2], DEFCON[0][3], DEFCON[0][4]
        for lo, hi, lbl, col, msg in DEFCON:
            if lo <= nivel <= hi:
                defcon_lbl, defcon_color, defcon_msg = lbl, col, msg
                break

        critico = nivel >= 51
        parent = PulseBorder if critico else ctk.CTkFrame
        inner = parent(
            self.alert_banner, fg_color=COLORS["surface_elevated"],
            corner_radius=14, border_width=3 if critico else 1,
            border_color=defcon_color,
        )
        inner.pack(fill="x", padx=4, pady=4)

        row = ctk.CTkFrame(inner, fg_color="transparent")
        row.pack(fill="x", padx=20, pady=16)
        ctk.CTkLabel(
            row, text=defcon_lbl,
            font=ctk.CTkFont(size=22, weight="bold"),
            text_color=defcon_color,
        ).pack(side="left")
        ctk.CTkLabel(
            row, text=f"NIVEL {nivel}/100",
            font=ctk.CTkFont(size=42, weight="bold"),
            text_color=defcon_color,
        ).pack(side="right")
        ctk.CTkLabel(
            inner, text=defcon_msg,
            text_color=COLORS["text_sec"], wraplength=900, justify="left",
        ).pack(anchor="w", padx=20, pady=(0, 16))

        metrics = [
            ("📛 Vencidas", len(res["tareas_vencidas"]), COLORS["red"]),
            ("⚡ Urgentes", len(res["tareas_urgentes"]), COLORS["orange"]),
            ("📅 Exámenes <7d", len(res["examenes_criticos"]), COLORS["yellow"]),
            ("💀 Sin dominar", res["temas_sin_dominar"], COLORS["accent2"]),
        ]
        for w in self.threat_box.winfo_children():
            w.destroy()
        for i, (title, val, color) in enumerate(metrics):
            card = ctk.CTkFrame(
                self.threat_box, fg_color=COLORS["surface_elevated"],
                corner_radius=12, border_width=2, border_color=color,
            )
            card.grid(row=0, column=i, sticky="nsew", padx=4, pady=4)
            ctk.CTkLabel(card, text=title, font=ctk.CTkFont(size=11), text_color=COLORS["text_sec"]).pack(pady=(10, 0))
            ctk.CTkLabel(card, text=str(val), font=ctk.CTkFont(size=32, weight="bold"), text_color=color).pack(pady=(4, 12))

        for w in self.exam_scroll.winfo_children():
            w.destroy()
        examenes = res["examenes_proximos"]
        if not examenes:
            ctk.CTkLabel(self.exam_scroll, text="Sin exámenes programados", text_color=COLORS["text_sec"]).pack()
        for ex in examenes:
            self._exam_countdown(ex)

        for w in self.amenazas_box.winfo_children():
            w.destroy()
        amenazas = []
        for t in res["tareas_vencidas"]:
            amenazas.append(("VENCIDA", t["titulo"], t.get("curso_nombre", "—"), COLORS["red"]))
        venc_ids = {x["id"] for x in res["tareas_vencidas"]}
        for t in res["tareas_urgentes"][:5]:
            if t["id"] not in venc_ids:
                amenazas.append(("URGENTE", t["titulo"], t.get("curso_nombre", "—"), COLORS["orange"]))
        for ex in res["examenes_criticos"][:3]:
            amenazas.append((
                f"EXAMEN {ex.get('dias_restantes')}d",
                f"{ex['curso_nombre']} — {ex['nombre']}",
                f"{int(ex['avance']*100)}% listo",
                COLORS["yellow"],
            ))
        if not amenazas:
            ctk.CTkLabel(
                self.amenazas_box, text="✅ Sin amenazas críticas ahora mismo",
                text_color=COLORS["green"], font=ctk.CTkFont(size=13),
            ).pack(anchor="w", pady=8)
        for badge, titulo, sub, color in amenazas:
            self._amenaza_row(badge, titulo, sub, color)

        for w in self.cursos_box.winfo_children():
            w.destroy()
        for c in db.get_cursos():
            self._curso_card(c)

    def _amenaza_row(self, badge: str, titulo: str, sub: str, color: str):
        card = ctk.CTkFrame(
            self.amenazas_box, fg_color=COLORS["surface_elevated"],
            corner_radius=10, border_width=2, border_color=color,
        )
        card.pack(fill="x", pady=4)
        row = ctk.CTkFrame(card, fg_color="transparent")
        row.pack(fill="x", padx=12, pady=10)
        ctk.CTkLabel(
            row, text=badge, fg_color=color, corner_radius=6,
            font=font("badge"), text_color=COLORS["text_on_accent"], width=90,
        ).pack(side="left")
        body = ctk.CTkFrame(row, fg_color="transparent")
        body.pack(side="left", fill="x", expand=True, padx=10)
        ctk.CTkLabel(body, text=titulo, font=font("subtitle"), text_color=COLORS["text"], anchor="w").pack(anchor="w")
        ctk.CTkLabel(body, text=sub, text_color=COLORS["text_sec"], font=ctk.CTkFont(size=11)).pack(anchor="w")

    def _exam_countdown(self, ex: dict):
        dias = ex.get("dias_restantes")
        sem = ex.get("semaforo", "VERDE")
        color = SEMAFORO_COLORS.get(sem, COLORS["border"])
        critico = dias is not None and dias <= 7
        cls = PulseBorder if critico and dias <= 3 else ctk.CTkFrame
        card = cls(
            self.exam_scroll, fg_color=COLORS["surface_elevated"],
            corner_radius=14, border_width=3 if critico else 2,
            border_color=color, width=200,
        )
        card.pack(side="left", padx=6, pady=4)
        ctk.CTkLabel(
            card, text=ex["curso_nombre"],
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color=safe_color(ex.get("curso_color"), COLORS["text"]),
        ).pack(padx=12, pady=(10, 0), anchor="w")
        ctk.CTkLabel(card, text=ex["nombre"], text_color=COLORS["text_sec"], font=ctk.CTkFont(size=10)).pack(padx=12, anchor="w")
        ctk.CTkLabel(
            card, text=str(dias) if dias is not None else "—",
            font=ctk.CTkFont(size=40, weight="bold"), text_color=color,
        ).pack(pady=2)
        ctk.CTkLabel(card, text="DÍAS", font=ctk.CTkFont(size=10, weight="bold"), text_color=color).pack()
        pct = int(ex["avance"] * 100)
        bar = ctk.CTkProgressBar(card, width=170, progress_color=safe_color(ex.get("curso_color"), COLORS["accent"]))
        bar.pack(padx=12, pady=6)
        bar.set(ex["avance"])
        ctk.CTkLabel(card, text=f"{pct}% dominado", font=font("small"), text_color=COLORS["text_sec"]).pack(pady=(0, 10))
        if critico:
            ctk.CTkLabel(
                card, text="⚠️ PELIGRO CERCANO",
                text_color=COLORS["red"], font=ctk.CTkFont(size=9, weight="bold"),
            ).pack(pady=(0, 8))

    def _estado_label(self, sem: str) -> str:
        return {"VERDE": "ESTABLE", "AMARILLO": "ALERTA", "ROJO": "CRÍTICO", "ROJO_CRITICO": "CRÍTICO"}.get(sem, "—")

    def _curso_card(self, curso: dict):
        unidades = db.get_unidades(curso["id"])
        if not unidades:
            return
        worst_sem = "VERDE"
        prox_dias = 999
        for u in unidades:
            _, _, av = db.avance_unidad(u["id"])
            dias = db.dias_restantes(u.get("fecha_examen"))
            sem = db.calcular_semaforo(dias, av)
            if dias is not None and dias < prox_dias:
                prox_dias = dias
            if sem in ("ROJO_CRITICO", "ROJO") or (sem == "AMARILLO" and worst_sem == "VERDE"):
                worst_sem = sem

        border = SEMAFORO_COLORS.get(worst_sem, COLORS["border"])
        critico = worst_sem in ("ROJO", "ROJO_CRITICO")
        cls = PulseBorder if critico else ctk.CTkFrame
        card = cls(
            self.cursos_box, fg_color=COLORS["surface"], corner_radius=16,
            border_width=2, border_color=border,
        )
        card.pack(fill="x", pady=6)

        row = ctk.CTkFrame(card, fg_color="transparent")
        row.pack(fill="x", padx=16, pady=14)

        left = ctk.CTkFrame(row, fg_color="transparent", width=140)
        left.pack(side="left")
        circ = ctk.CTkFrame(left, width=80, height=80, corner_radius=40, fg_color=SEMAFORO_COLORS.get(worst_sem, COLORS["green"]))
        circ.pack()
        ctk.CTkLabel(circ, text=self._estado_label(worst_sem), font=font("badge"), text_color=COLORS["text_on_accent"]).place(relx=0.5, rely=0.5, anchor="center")
        ctk.CTkLabel(left, text=f"{prox_dias if prox_dias < 999 else '—'} días", font=font("title"), text_color=COLORS["text"]).pack(pady=4)

        right = ctk.CTkFrame(row, fg_color="transparent")
        right.pack(side="left", fill="x", expand=True, padx=16)
        ctk.CTkLabel(right, text=curso["nombre"], font=ctk.CTkFont(size=18, weight="bold"), text_color=curso["color"]).pack(anchor="w")
        dom, tot, av = db.avance_curso(curso["id"])
        bar = ctk.CTkProgressBar(right, progress_color=curso["color"])
        bar.pack(fill="x", pady=6)
        bar.set(av)
        counts = {}
        for u in unidades:
            for k, v in db.contar_dominio_unidad(u["id"]).items():
                counts[k] = counts.get(k, 0) + v
        ctk.CTkLabel(
            right,
            text=f"💀 {counts.get('cero_pista', 0)} sin pista  |  🔥 {counts.get('lo_tengo', 0)} dominados",
            text_color=COLORS["text_sec"], font=ctk.CTkFont(size=11),
        ).pack(anchor="w")
        pred = int(av * 100)
        ctk.CTkLabel(
            right, text=f"Preparación actual: {pred}% — examen en {prox_dias if prox_dias < 999 else '?'} días",
            text_color=COLORS["text_sec"],
        ).pack(anchor="w")

        if worst_sem in ("ROJO", "ROJO_CRITICO"):
            ctk.CTkButton(
                card, text="🆘 PLAN DE RESCATE (IA)", fg_color=COLORS["red"], height=40,
                font=ctk.CTkFont(weight="bold"),
                command=lambda c=curso: self._rescate(c),
            ).pack(fill="x", padx=16, pady=(0, 14))

    def _rescate(self, curso: dict):
        m = ctk.CTkToplevel(self)
        m.title("Plan de Rescate")
        m.geometry("420x300")
        m.grab_set()
        lbl(m, f"¿Cuántas horas tienes para {curso['nombre']}?").pack(pady=20)
        he = ctk.CTkEntry(m, width=200, placeholder_text="Ej: 6")
        he.pack()
        result = ctk.CTkTextbox(m, width=380, height=120)
        result.pack(padx=20, pady=12)
        gen_btn = ctk.CTkButton(m, text="Generar con DeepSeek")
        gen_btn.pack(pady=8)

        def gen():
            if getattr(m, "_gen_busy", False):
                return
            try:
                horas = float(he.get())
            except ValueError:
                result.delete("1.0", "end")
                result.insert("1.0", "⚠️ Indica un número válido de horas (ej: 6)")
                return
            self.ai.set_api_key(db.get_ai_api_key())
            if not self.ai.api_key:
                result.delete("1.0", "end")
                result.insert("1.0", "⚠️ Configura tu API Key de DeepSeek en ⚙️ Configuración")
                return
            m._gen_busy = True
            gen_btn.configure(state="disabled", text="⏳ Generando…")
            result.delete("1.0", "end")
            result.insert("1.0", "⏳ Generando plan de rescate…")

            def work():
                temas = [t for t in db.get_temas_curso(curso["id"]) if t["dominio"] != "lo_tengo"]
                return self.ai.generar_plan_rescate(curso, horas, temas)

            def _done():
                m._gen_busy = False
                if gen_btn.winfo_exists():
                    gen_btn.configure(state="normal", text="Generar con DeepSeek")

            def on_ok(plan):
                _done()
                result.delete("1.0", "end")
                result.insert("1.0", plan)

            def on_err(err: Exception):
                _done()
                result.delete("1.0", "end")
                result.insert("1.0", f"⚠️ {err}")

            self.ai.run_async(m, work, on_ok, on_err)

        gen_btn.configure(command=gen)
