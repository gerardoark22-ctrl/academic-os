"""Academic OS v2 — Entry point."""

import sys
from datetime import date
from pathlib import Path

import customtkinter as ctk

sys.path.insert(0, str(Path(__file__).parent))

import database as db
from config import COLORS
from modules.examen_mode import auto_priorizar_tareas, is_active as exam_mode_active
from modules.notifications import NotificationScheduler
from modules.perf import measure, perf_enabled
from modules.theme_engine import apply_theme, font, is_light_mode


class AcademicOSApp(ctk.CTk):
    SIDEBAR_W = 200
    NAV = [
        ("dashboard", "🏠", "Dashboard"),
        ("cursos", "📚", "Cursos"),
        ("timeblocking", "⏰", "TimeBlocking"),
        ("gestor_tareas", "📋", "Gestor de Tareas"),
        ("riesgo", "🚨", "Riesgo"),
        ("estadisticas", "📊", "Estadísticas"),
        ("configuracion", "⚙️", "Configuración"),
    ]

    def __init__(self):
        super().__init__()
        with measure("init_db"):
            db.init_db()
        with measure("purga_diaria"):
            db.auto_purga_completadas_diaria()
        with measure("apply_theme"):
            apply_theme(is_light_mode())
        self.after(0, auto_priorizar_tareas)

        self.title("Academic OS")
        self.geometry("1280x820")
        self.minsize(1100, 720)
        self.configure(fg_color=COLORS["bg"])

        self._frames: dict = {}
        self._nav_btns: dict = {}
        self._badges: dict = {}
        self._current = None
        self._exam_banner = None
        self._app_date = date.today()
        self._notifier = NotificationScheduler(self)

        self._build()
        with measure("first_navigate"):
            with db.db_burst():
                self.navigate("dashboard")
                self.update_badges()
                self._update_exam_banner()
        if perf_enabled():
            from modules.perf import perf_log
            total = sum(ms for _, ms in perf_log())
            print(f"[AcademicOS perf] startup total: {total:.1f} ms")
        self._schedule_day_check()
        self._notifier.start()
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    def _build(self):
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        sidebar = ctk.CTkFrame(
            self, width=self.SIDEBAR_W, fg_color=COLORS["surface"],
            corner_radius=0, border_width=2, border_color=COLORS.get("card_border", COLORS["accent"]),
        )
        sidebar.grid(row=0, column=0, sticky="ns")
        sidebar.grid_propagate(False)
        self._sidebar = sidebar

        def _stop_scroll(_event):
            return "break"

        for seq in ("<MouseWheel>", "<Button-4>", "<Button-5>"):
            sidebar.bind(seq, _stop_scroll)

        logo = ctk.CTkLabel(
            sidebar, text="Academic\nOS",
            font=font("display"),
            text_color=COLORS["accent"],
        )
        logo.pack(pady=(28, 8))
        ctk.CTkLabel(sidebar, text="v2.0", text_color=COLORS["text_sec"], font=font("small")).pack()
        ctk.CTkFrame(sidebar, height=2, fg_color=COLORS["border"]).pack(fill="x", padx=16, pady=20)

        for key, icon, label in self.NAV:
            row = ctk.CTkFrame(sidebar, fg_color="transparent")
            row.pack(fill="x", padx=10, pady=3)
            btn = ctk.CTkButton(
                row, text=f"{icon}  {label}", anchor="w",
                fg_color="transparent", hover_color=COLORS["nav_hover"],
                text_color=COLORS["text"], height=42,
                font=ctk.CTkFont(size=13),
                command=lambda k=key: self.navigate(k),
            )
            btn.pack(side="left", fill="x", expand=True)
            btn.bind("<MouseWheel>", _stop_scroll)
            self._nav_btns[key] = btn
            if key in ("gestor_tareas", "riesgo"):
                badge = ctk.CTkLabel(
                    row, text="0", width=22, height=20, corner_radius=10,
                    fg_color=COLORS["red"] if key == "gestor_tareas" else COLORS["orange"],
                    font=ctk.CTkFont(size=10, weight="bold"),
                )
                badge.pack(side="right", padx=4)
                self._badges[key] = badge

        self.content = ctk.CTkFrame(self, fg_color=COLORS["bg"], corner_radius=0)
        self.content.grid(row=0, column=1, sticky="nsew")
        self.content.grid_columnconfigure(0, weight=1)
        self.content.grid_rowconfigure(1, weight=1)

        self.exam_banner = ctk.CTkFrame(
            self.content, fg_color=COLORS["red"], corner_radius=0, height=0,
        )
        self.exam_banner.grid(row=0, column=0, sticky="ew")
        self.exam_banner.grid_remove()
        self.exam_banner_lbl = ctk.CTkLabel(
            self.exam_banner, text="", font=font("subtitle"), text_color=COLORS["text_on_accent"],
        )
        self.exam_banner_lbl.pack(padx=16, pady=8, anchor="w")

        self.frame_host = ctk.CTkFrame(self.content, fg_color=COLORS["bg"], corner_radius=0)
        self.frame_host.grid(row=1, column=0, sticky="nsew")
        self.frame_host.grid_columnconfigure(0, weight=1)
        self.frame_host.grid_rowconfigure(0, weight=1)

    def navigate(self, key: str):
        for k, btn in self._nav_btns.items():
            if k == key:
                btn.configure(
                    fg_color=COLORS["accent"], hover_color=COLORS["accent_hover"],
                    text_color=COLORS["text_on_accent"],
                )
            else:
                btn.configure(
                    fg_color="transparent", hover_color=COLORS["nav_hover"],
                    text_color=COLORS["text"],
                )

        if key not in self._frames:
            self._frames[key] = self._create(key)
        if self._current and self._current in self._frames:
            self._frames[self._current].grid_forget()
        self._frames[key].grid(row=0, column=0, sticky="nsew")
        self._current = key
        with db.db_burst():
            with measure(f"refresh:{key}"):
                if hasattr(self._frames[key], "refresh"):
                    self._frames[key].refresh()
            self._update_exam_banner()

    def _create(self, key: str):
        if key == "dashboard":
            from modules.dashboard import DashboardFrame
            return DashboardFrame(self.frame_host, self)
        if key == "cursos":
            from modules.cursos import CursosFrame
            return CursosFrame(self.frame_host, self)
        if key == "timeblocking":
            from modules.timeblocking import TimeBlockingFrame
            return TimeBlockingFrame(self.frame_host, self)
        if key == "gestor_tareas":
            from modules.gestor_tareas import GestorTareasFrame
            return GestorTareasFrame(self.frame_host, self)
        if key == "riesgo":
            from modules.riesgo import RiesgoFrame
            return RiesgoFrame(self.frame_host, self)
        if key == "estadisticas":
            from modules.estadisticas import EstadisticasFrame
            return EstadisticasFrame(self.frame_host, self)
        if key == "configuracion":
            from modules.configuracion import ConfiguracionFrame
            return ConfiguracionFrame(self.frame_host, self)
        raise KeyError(key)

    def _update_exam_banner(self):
        if exam_mode_active():
            from modules.examen_mode import get_examenes_activos
            ex = get_examenes_activos()
            n = len(ex)
            prox = ex[0] if ex else {}
            dias = prox.get("dias_restantes", "?")
            txt = f"🚨 MODO EXAMEN INMINENTE — {n} examen(es) en ≤14 días. Próximo: {prox.get('nombre', '')} ({dias}d)"
            self.exam_banner_lbl.configure(text=txt)
            self.exam_banner.grid()
        else:
            self.exam_banner.grid_remove()

    def apply_visual_theme(self):
        apply_theme(is_light_mode())
        self.configure(fg_color=COLORS["bg"])
        self._rebuild_ui()

    def _rebuild_ui(self):
        current = self._current
        for f in self._frames.values():
            f.destroy()
        self._frames.clear()
        self._nav_btns.clear()
        self._badges.clear()
        for w in self.winfo_children():
            w.destroy()
        self._notifier = NotificationScheduler(self)
        self._build()
        if current:
            self.navigate(current)
        self.update_badges()
        self._update_exam_banner()
        self._notifier.start()

    def update_badges(self):
        with db.db_burst():
            if "gestor_tareas" in self._badges:
                n = db.contar_tareas_pendientes()
                self._badges["gestor_tareas"].configure(text=str(n))
                self._badges["gestor_tareas"].pack_forget()
                if n > 0:
                    self._badges["gestor_tareas"].pack(side="right", padx=4)
            if "riesgo" in self._badges:
                a = db.curso_en_alerta()
                self._badges["riesgo"].configure(text=str(a))
                self._badges["riesgo"].pack_forget()
                if a > 0:
                    self._badges["riesgo"].pack(side="right", padx=4)

    def _on_close(self):
        try:
            db.flush_database()
            db.backup_database("cierre")
        except Exception:
            pass
        self.destroy()

    def refresh_all(self):
        self.after(0, auto_priorizar_tareas)
        with db.db_burst():
            self.update_badges()
            self._update_exam_banner()
            if self._current and self._current in self._frames:
                f = self._frames[self._current]
                if hasattr(f, "refresh"):
                    f.refresh()

    def _schedule_day_check(self):
        self._check_new_day()
        self.after(60_000, self._schedule_day_check)

    def _check_new_day(self):
        hoy = date.today()
        if hoy == self._app_date:
            return
        self._app_date = hoy
        try:
            db.auto_purga_completadas_diaria()
            auto_priorizar_tareas()
        except Exception:
            pass
        for frame in self._frames.values():
            if hasattr(frame, "on_new_day"):
                try:
                    frame.on_new_day()
                except Exception:
                    if hasattr(frame, "refresh"):
                        frame.refresh()
            elif hasattr(frame, "refresh"):
                try:
                    frame.refresh()
                except Exception:
                    pass
        self.update_badges()
        self._update_exam_banner()
        if self._current and self._current in self._frames:
            f = self._frames[self._current]
            if hasattr(f, "refresh"):
                try:
                    f.refresh()
                except Exception:
                    pass


def main():
    app = AcademicOSApp()
    app.mainloop()


if __name__ == "__main__":
    main()
