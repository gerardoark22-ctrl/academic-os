"""Academic OS v2 — Entry point."""

import sys
from pathlib import Path

import customtkinter as ctk

sys.path.insert(0, str(Path(__file__).parent))

import database as db
from config import COLORS, THEME_PATH
from modules.configuracion import ConfiguracionFrame
from modules.cursos import CursosFrame
from modules.dashboard import DashboardFrame
from modules.estadisticas import EstadisticasFrame
from modules.gestor_tareas import GestorTareasFrame
from modules.riesgo import RiesgoFrame
from modules.timeblocking import TimeBlockingFrame


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
        db.init_db()
        db.auto_purga_completadas_diaria()

        self.title("Academic OS")
        self.geometry("1280x820")
        self.minsize(1100, 720)
        self.configure(fg_color=COLORS["bg"])

        if THEME_PATH.exists():
            ctk.set_default_color_theme(str(THEME_PATH))
        ctk.set_appearance_mode("dark")

        self._frames: dict = {}
        self._nav_btns: dict = {}
        self._badges: dict = {}
        self._current = None

        self._build()
        self.navigate("dashboard")
        self.update_badges()

    def _build(self):
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        sidebar = ctk.CTkFrame(self, width=self.SIDEBAR_W, fg_color=COLORS["surface"], corner_radius=0)
        sidebar.grid(row=0, column=0, sticky="nsew")
        sidebar.grid_propagate(False)

        logo = ctk.CTkLabel(
            sidebar, text="Academic\nOS",
            font=ctk.CTkFont(size=26, weight="bold"),
            text_color=COLORS["accent"],
        )
        logo.pack(pady=(28, 8))
        ctk.CTkLabel(sidebar, text="v2.0", text_color=COLORS["text_sec"], font=ctk.CTkFont(size=10)).pack()
        ctk.CTkFrame(sidebar, height=2, fg_color=COLORS["border"]).pack(fill="x", padx=16, pady=20)

        for key, icon, label in self.NAV:
            row = ctk.CTkFrame(sidebar, fg_color="transparent")
            row.pack(fill="x", padx=10, pady=3)
            btn = ctk.CTkButton(
                row, text=f"{icon}  {label}", anchor="w",
                fg_color="transparent", hover_color=COLORS["surface_elevated"],
                text_color=COLORS["text"], height=42,
                font=ctk.CTkFont(size=13),
                command=lambda k=key: self.navigate(k),
            )
            btn.pack(side="left", fill="x", expand=True)
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
        self.content.grid_rowconfigure(0, weight=1)

    def navigate(self, key: str):
        for k, btn in self._nav_btns.items():
            if k == key:
                btn.configure(fg_color=COLORS["accent"], hover_color=COLORS["accent_hover"])
            else:
                btn.configure(fg_color="transparent", hover_color=COLORS["surface_elevated"])

        if key not in self._frames:
            self._frames[key] = self._create(key)
        if self._current and self._current in self._frames:
            self._frames[self._current].grid_forget()
        self._frames[key].grid(row=0, column=0, sticky="nsew")
        self._current = key
        if hasattr(self._frames[key], "refresh"):
            self._frames[key].refresh()

    def _create(self, key: str):
        mapping = {
            "dashboard": lambda: DashboardFrame(self.content, self),
            "cursos": lambda: CursosFrame(self.content, self),
            "timeblocking": lambda: TimeBlockingFrame(self.content, self),
            "gestor_tareas": lambda: GestorTareasFrame(self.content, self),
            "riesgo": lambda: RiesgoFrame(self.content, self),
            "estadisticas": lambda: EstadisticasFrame(self.content, self),
            "configuracion": lambda: ConfiguracionFrame(self.content, self),
        }
        return mapping[key]()

    def update_badges(self):
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

    def refresh_all(self):
        self.update_badges()
        if self._current and self._current in self._frames:
            f = self._frames[self._current]
            if hasattr(f, "refresh"):
                f.refresh()


def main():
    app = AcademicOSApp()
    app.mainloop()


if __name__ == "__main__":
    main()
