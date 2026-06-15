"""Riesgo y Alarmas — Academic OS v2."""

import threading
from datetime import date, datetime

import customtkinter as ctk
from tkinter import messagebox

import database as db
from ai.openai_client import AcademicAI
from config import COLORS, PRIORIDAD_LABELS, SEMAFORO_COLORS, SEMAFORO_EMOJI
from modules.components import PulseBorder, safe_color

try:
    from plyer import notification
    _PLYER = True
except ImportError:
    _PLYER = False

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
        self._notified: set[str] = set()
        self._build()
        self.refresh()
        self._schedule_checks()

    def _build(self):
        scroll = ctk.CTkScrollableFrame(self, fg_color=COLORS["bg"])
        scroll.pack(fill="both", expand=True, padx=16, pady=16)
        self._scroll = scroll

        ctk.CTkLabel(
            scroll, text="🚨 CENTRO DE RIESGO",
            font=ctk.CTkFont(size=28, weight="bold"),
            text_color=COLORS["red"],
        ).pack(anchor="w", pady=(0, 4))
        ctk.CTkLabel(
            scroll, text="Monitoreo en tiempo real de exámenes, tareas y dominio",
            text_color=COLORS["text_sec"], font=ctk.CTkFont(size=12),
        ).pack(anchor="w", pady=(0, 12))

        self.alert_banner = ctk.CTkFrame(scroll, fg_color=COLORS["surface"], corner_radius=16)
        self.alert_banner.pack(fill="x", pady=8)

        self.threat_box = ctk.CTkFrame(scroll, fg_color="transparent")
        self.threat_box.pack(fill="x", pady=8)
        self.threat_box.grid_columnconfigure((0, 1, 2, 3), weight=1)

        ctk.CTkLabel(
            scroll, text="⏳ CUENTA REGRESIVA — EXÁMENES",
            font=ctk.CTkFont(size=16, weight="bold"),
        ).pack(anchor="w", pady=(12, 8))
        self.exam_scroll = ctk.CTkScrollableFrame(scroll, fg_color="transparent", orientation="horizontal", height=200)
        self.exam_scroll.pack(fill="x", pady=(0, 8))

        ctk.CTkLabel(
            scroll, text="🔥 AMENAZAS ACTIVAS",
            font=ctk.CTkFont(size=16, weight="bold"),
        ).pack(anchor="w", pady=(12, 8))
        self.amenazas_box = ctk.CTkFrame(scroll, fg_color="transparent")
        self.amenazas_box.pack(fill="x")

        ctk.CTkLabel(
            scroll, text="📚 ESTADO POR CURSO",
            font=ctk.CTkFont(size=16, weight="bold"),
        ).pack(anchor="w", pady=(16, 8))
        self.cursos_box = ctk.CTkFrame(scroll, fg_color="transparent")
        self.cursos_box.pack(fill="x")

    def refresh(self):
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
            font=ctk.CTkFont(size=10, weight="bold"), width=90,
        ).pack(side="left")
        body = ctk.CTkFrame(row, fg_color="transparent")
        body.pack(side="left", fill="x", expand=True, padx=10)
        ctk.CTkLabel(body, text=titulo, font=ctk.CTkFont(weight="bold"), anchor="w").pack(anchor="w")
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
        ctk.CTkLabel(card, text=f"{pct}% dominado", font=ctk.CTkFont(size=10)).pack(pady=(0, 10))
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
        ctk.CTkLabel(circ, text=self._estado_label(worst_sem), font=ctk.CTkFont(size=9, weight="bold")).place(relx=0.5, rely=0.5, anchor="center")
        ctk.CTkLabel(left, text=f"{prox_dias if prox_dias < 999 else '—'} días", font=ctk.CTkFont(size=28, weight="bold")).pack(pady=4)

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
        ctk.CTkLabel(m, text=f"¿Cuántas horas tienes para {curso['nombre']}?").pack(pady=20)
        he = ctk.CTkEntry(m, width=200, placeholder_text="Ej: 6")
        he.pack()
        result = ctk.CTkTextbox(m, width=380, height=120)
        result.pack(padx=20, pady=12)

        def gen():
            self.ai.set_api_key(db.get_ai_api_key())
            try:
                temas = [t for t in db.get_temas_curso(curso["id"]) if t["dominio"] != "lo_tengo"]
                plan = self.ai.generar_plan_rescate(curso, float(he.get()), temas)
                result.delete("1.0", "end")
                result.insert("1.0", plan)
            except Exception as e:
                result.insert("1.0", str(e))

        ctk.CTkButton(m, text="Generar con DeepSeek", command=gen).pack(pady=8)

    def _notify(self, title: str, msg: str):
        if not _PLYER:
            return
        try:
            notification.notify(title=title, message=msg, app_name="Academic OS", timeout=12)
        except Exception:
            pass

    def _schedule_checks(self):
        self._check_alerts()
        self._check_scheduled_notifs()
        self.after(60000, self._schedule_checks)

    def _check_scheduled_notifs(self):
        now = datetime.now()
        key = now.strftime("%Y-%m-%d %H:%M")[:16]
        tarde = db.get_config("notif_hora_tarde", "14:00")[:5]
        noche = db.get_config("notif_hora_noche", "21:00")[:5]
        hm = now.strftime("%H:%M")

        if hm == tarde and f"tarde_{key}" not in self._notified:
            self._notified.add(f"tarde_{key}")
            threading.Thread(target=self._notif_tarde, daemon=True).start()
        if hm == noche and f"noche_{key}" not in self._notified:
            self._notified.add(f"noche_{key}")
            threading.Thread(target=self._notif_noche, daemon=True).start()

    def _notif_tarde(self):
        b = db.get_bloque_actual()
        bloque = b.get("titulo", "Libre") if b else "Sin bloque"
        n = db.contar_tareas_pendientes()
        self._notify("🎯 Academic OS — Tarde", f"Tu bloque: {bloque}. {n} tareas pendientes hoy.")

    def _notif_noche(self):
        done, total, pct = db.progreso_dia(date.today().isoformat())
        examenes = db.get_examenes_proximos()
        crit = examenes[0]["curso_nombre"] if examenes else "—"
        self._notify("📊 Academic OS — Resumen", f"Completaste {int(pct)}% bloques. Mañana: {crit}")

    def _check_alerts(self):
        for t in db.get_recordatorios_activos():
            k = f"rec_{t['id']}_{date.today()}_{datetime.now().strftime('%H:%M')}"
            if k not in self._notified:
                self._notified.add(k)
                self._notify("⏰ Recordatorio de tarea", t["titulo"])
        for t in db.get_tareas_vencidas():
            k = f"vencida_{t['id']}_{date.today()}"
            if k not in self._notified:
                self._notified.add(k)
                self._notify("🚨 Tarea vencida", t["titulo"])
        for ex in db.get_examenes_proximos():
            dias = ex.get("dias_restantes")
            if dias is not None and dias <= 7:
                k = f"exam_{ex['id']}_{date.today()}"
                if k not in self._notified:
                    self._notified.add(k)
                    self._notify("⚠️ Examen próximo", f"{ex['curso_nombre']} en {dias} días — {int(ex['avance']*100)}% listo")
