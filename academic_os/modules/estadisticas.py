"""Estadísticas — Academic OS v2."""

import hashlib
import json
from datetime import date, timedelta

import customtkinter as ctk
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure

import database as db
from ai.openai_client import AcademicAI
from config import COLORS
from modules.components import MetricCard
from modules.theme_engine import font, lbl


class EstadisticasFrame(ctk.CTkFrame):
    def __init__(self, master, app, **kwargs):
        super().__init__(master, fg_color=COLORS["bg"], **kwargs)
        self.app = app
        self.ai = AcademicAI(db.get_ai_api_key())
        self._charts_fp: str | None = None
        self._build()
        self.refresh()

    def _build(self):
        scroll = ctk.CTkScrollableFrame(self, fg_color=COLORS["bg"])
        scroll.pack(fill="both", expand=True, padx=16, pady=16)

        lbl(scroll, "📊 ESTADÍSTICAS", style="display").pack(anchor="w", pady=(0, 16))

        metrics = ctk.CTkFrame(scroll, fg_color="transparent")
        metrics.pack(fill="x", pady=8)
        metrics.grid_columnconfigure((0, 1, 2, 3), weight=1)
        self.m_hoy = MetricCard(metrics, "⏱️", "HORAS HOY")
        self.m_hoy.grid(row=0, column=0, sticky="nsew", padx=4)
        self.m_sem = MetricCard(metrics, "📅", "HORAS SEMANA")
        self.m_sem.grid(row=0, column=1, sticky="nsew", padx=4)
        self.m_racha = MetricCard(metrics, "🔥", "RACHA")
        self.m_racha.grid(row=0, column=2, sticky="nsew", padx=4)
        self.m_tareas = MetricCard(metrics, "✅", "TAREAS HOY")
        self.m_tareas.grid(row=0, column=3, sticky="nsew", padx=4)

        charts = ctk.CTkFrame(scroll, fg_color="transparent")
        charts.pack(fill="x", pady=12)
        charts.grid_columnconfigure((0, 1), weight=1)
        self.chart_hosts = [ctk.CTkFrame(charts, fg_color=COLORS["surface"], corner_radius=14) for _ in range(4)]
        for i, h in enumerate(self.chart_hosts):
            h.grid(row=i // 2, column=i % 2, sticky="nsew", padx=6, pady=6, ipady=8)
        charts.grid_rowconfigure(0, weight=1)
        charts.grid_rowconfigure(1, weight=1)

        ctk.CTkLabel(scroll, text="💀 TEMAS SIN TOCAR — ACCIÓN REQUERIDA", font=ctk.CTkFont(size=15, weight="bold"),
                     text_color=COLORS["red"]).pack(anchor="w", pady=(16, 8))
        self.criticos_box = ctk.CTkFrame(scroll, fg_color="transparent")
        self.criticos_box.pack(fill="x")

        ctk.CTkButton(scroll, text="📊 Ver Reporte Semanal", fg_color=COLORS["accent2"], height=44,
                      command=self._reporte).pack(pady=16, anchor="w")

    def _style(self, fig: Figure):
        fig.patch.set_facecolor(COLORS["surface"])
        for ax in fig.axes:
            ax.set_facecolor(COLORS["surface_elevated"])
            ax.tick_params(colors=COLORS["text_sec"])
            ax.title.set_color(COLORS["text"])
            for sp in ax.spines.values():
                sp.set_color(COLORS["border"])
            ax.grid(True, alpha=0.15, color=COLORS["text_sec"])

    def _embed(self, host, fig: Figure):
        for w in host.winfo_children():
            w.destroy()
        self._style(fig)
        fig.tight_layout()
        c = FigureCanvasTkAgg(fig, host)
        c.draw()
        c.get_tk_widget().pack(fill="both", expand=True, padx=8, pady=8)

    def _charts_fingerprint(self) -> str:
        hoy = date.today().isoformat()
        _, c_map, _ = db.get_avance_maps()
        with db.get_connection() as conn:
            dom_rows = conn.execute(
                "SELECT dominio, COUNT(*) as n FROM temas GROUP BY dominio",
            ).fetchall()
        payload = {
            "horas_semana": db.get_horas_semana(),
            "avance_cursos": {str(k): v for k, v in c_map.items()},
            "cumplimiento": db.get_cumplimiento_semana(),
            "dominio": {r["dominio"]: r["n"] for r in dom_rows},
            "criticos": len(db.get_temas_cero_pista()),
        }
        raw = json.dumps(payload, sort_keys=True, default=str)
        return hashlib.md5(raw.encode()).hexdigest()

    def refresh(self):
        hoy = date.today().isoformat()
        ayer = (date.today() - timedelta(1)).isoformat()
        hrs_hoy = db.get_horas_dia(hoy)
        hrs_ayer = db.get_horas_dia(ayer)
        diff = hrs_hoy - hrs_ayer
        self.m_hoy.set(f"{hrs_hoy:.1f}h", f"{'+' if diff >= 0 else ''}{diff:.1f}h vs ayer")

        sem = sum(db.get_horas_semana().values())
        meta = float(db.get_config("meta_horas_semanal", "20"))
        self.m_sem.set(f"{sem:.1f}h", f"Meta: {meta}h")
        self.m_racha.set(str(db.get_racha_dias()), "días consecutivos")
        done, total = db.tareas_completadas_hoy()
        self.m_tareas.set(f"{done}/{total}", "completadas hoy")

        fp = self._charts_fingerprint()
        if fp == self._charts_fp:
            return
        self._charts_fp = fp

        self._chart_horas()
        self._chart_cursos()
        self._chart_cumplimiento()
        self._chart_dominio()
        self._refresh_criticos()

    def _refresh_criticos(self):
        for w in self.criticos_box.winfo_children():
            w.destroy()
        criticos = db.get_temas_cero_pista()
        if not criticos:
            ctk.CTkLabel(self.criticos_box, text="¡Sin temas críticos!", text_color=COLORS["green"]).pack(anchor="w")
        for t in criticos[:12]:
            card = ctk.CTkFrame(self.criticos_box, fg_color=COLORS["row_overdue"], corner_radius=8)
            card.pack(fill="x", pady=3)
            row = ctk.CTkFrame(card, fg_color="transparent")
            row.pack(fill="x", padx=10, pady=8)
            dias = db.dias_restantes(t.get("fecha_examen"))
            ctk.CTkLabel(row, text=f"{t['nombre']} — {t['curso_nombre']}", font=font("subtitle"), text_color=COLORS["text"]).pack(side="left")
            ctk.CTkLabel(row, text=f"Examen en {dias}d", text_color=COLORS["red"]).pack(side="left", padx=8)
            ctk.CTkButton(row, text="📅 Agendar TB", width=100,
                          command=lambda tid=t["id"], cid=t["curso_id"]: self._agendar(t["nombre"], cid)).pack(side="right")

    def _chart_horas(self):
        data = db.get_horas_semana()
        dias = [k[5:] for k in data]
        vals = list(data.values())
        fig = Figure(figsize=(5.5, 3.2), dpi=100)
        ax = fig.add_subplot(111)
        colors = [COLORS["blue"], COLORS["accent2"]] * 4
        ax.bar(dias, vals, color=colors[:len(vals)], edgecolor=COLORS["border"])
        ax.axhline(y=2, color=COLORS["red"], linestyle="--", alpha=0.7, label="Meta 2h")
        ax.set_title("Horas estudiadas (7 días)")
        ax.legend(facecolor=COLORS["surface_elevated"], labelcolor=COLORS["text"])
        self._embed(self.chart_hosts[0], fig)

    def _chart_cursos(self):
        cursos = db.get_cursos()
        _, c_map, _ = db.get_avance_maps()
        ranked = sorted(cursos, key=lambda x: c_map.get(x["id"], (0, 0, 0.0))[2])
        nombres, vals, cols = [], [], []
        for c in ranked:
            _, _, av = c_map.get(c["id"], (0, 0, 0.0))
            nombres.append(c["nombre"][:14])
            vals.append(av * 100)
            cols.append(c["color"])
        fig = Figure(figsize=(5.5, 3.2), dpi=100)
        ax = fig.add_subplot(111)
        bars = ax.barh(nombres, vals, color=cols)
        for bar, v in zip(bars, vals):
            ax.text(v + 1, bar.get_y() + bar.get_height() / 2, f"{int(v)}%", va="center", color=COLORS["text"], fontsize=9)
        ax.set_title("Progreso de dominio por curso")
        ax.set_xlim(0, 110)
        self._embed(self.chart_hosts[1], fig)

    def _chart_cumplimiento(self):
        dias, plan, real = db.get_cumplimiento_semana()
        fig = Figure(figsize=(5.5, 3.2), dpi=100)
        ax = fig.add_subplot(111)
        ax.plot(dias, plan, "--", color=COLORS["accent"], label="Planeado", linewidth=2)
        ax.plot(dias, real, "-", color=COLORS["green"], label="Real", linewidth=2)
        ax.fill_between(dias, plan, real, alpha=0.2,
                        color=COLORS["green"] if sum(real) >= sum(plan) else COLORS["red"])
        ax.set_title("Tiempo real vs planeado")
        ax.legend(facecolor=COLORS["surface_elevated"], labelcolor=COLORS["text"])
        self._embed(self.chart_hosts[2], fig)

    def _chart_dominio(self):
        from config import DOMINIO_LABELS
        with db.get_connection() as conn:
            rows = conn.execute(
                "SELECT dominio, COUNT(*) as n FROM temas GROUP BY dominio"
            ).fetchall()
        dist = {r["dominio"]: r["n"] for r in rows} if rows else {"cero_pista": 1}
        labels = [DOMINIO_LABELS.get(k, k) for k in dist.keys()]
        sizes = list(dist.values())
        colors_pie = [COLORS["red"], COLORS["yellow"], COLORS["blue"], COLORS["green"]]
        fig = Figure(figsize=(5.5, 3.2), dpi=100)
        ax = fig.add_subplot(111)
        ax.pie(
            sizes, labels=labels, autopct="%1.0f%%",
            colors=colors_pie[: len(sizes)],
            textprops={"color": COLORS["text"], "fontsize": 8},
        )
        ax.set_title("Distribución de dominio")
        self._embed(self.chart_hosts[3], fig)

    def _agendar(self, titulo: str, curso_id: int):
        from datetime import datetime
        from config import TB_SLOT_MIN
        now = datetime.now()
        h, m = now.hour, ((now.minute // 30) + 1) * 30
        if m >= 60:
            h, m = h + 1, 0
        hi = f"{h:02d}:{m:02d}:00"
        hf = (datetime.strptime(hi, "%H:%M:%S") + timedelta(minutes=TB_SLOT_MIN)).strftime("%H:%M:%S")
        db.crear_bloque(fecha=date.today().isoformat(), hora_inicio=hi, hora_fin=hf,
                        titulo=titulo, curso_id=curso_id, tipo="estudio")
        self.app.navigate("timeblocking")

    def _reporte(self):
        self.ai.set_api_key(db.get_ai_api_key())
        datos = db.get_datos_reporte_semanal()
        m = ctk.CTkToplevel(self)
        m.title("Reporte Semanal")
        m.geometry("560x480")
        m.grab_set()
        m.configure(fg_color=COLORS["surface"])
        tb = ctk.CTkTextbox(m, width=520, height=420)
        tb.pack(padx=20, pady=20)
        tb.insert("1.0", "⏳ Generando reporte con IA…")
        tb.configure(state="disabled")

        if not self.ai.api_key:
            tb.configure(state="normal")
            tb.delete("1.0", "end")
            tb.insert("1.0", "⚠️ Configura tu API Key de DeepSeek en ⚙️ Configuración")
            tb.configure(state="disabled")
            return

        def work():
            return self.ai.generar_reporte_semanal(datos)

        def on_ok(txt):
            tb.configure(state="normal")
            tb.delete("1.0", "end")
            tb.insert("1.0", txt)

        def on_err(err: Exception):
            tb.configure(state="normal")
            tb.delete("1.0", "end")
            tb.insert("1.0", f"⚠️ {err}")

        self.ai.run_async(m, work, on_ok, on_err)
