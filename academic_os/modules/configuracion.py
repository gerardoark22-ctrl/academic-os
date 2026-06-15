"""Configuración — Academic OS v2."""

from tkinter import filedialog, messagebox

import customtkinter as ctk

import database as db
from config import COLORS
from modules.components import TimeSelector


class ConfiguracionFrame(ctk.CTkFrame):
    def __init__(self, master, app, **kwargs):
        super().__init__(master, fg_color=COLORS["bg"], **kwargs)
        self.app = app
        self._build()

    def _build(self):
        scroll = ctk.CTkScrollableFrame(self, fg_color=COLORS["bg"])
        scroll.pack(fill="both", expand=True, padx=24, pady=24)

        ctk.CTkLabel(scroll, text="⚙️ CONFIGURACIÓN", font=ctk.CTkFont(size=26, weight="bold")).pack(anchor="w", pady=(0, 20))

        self._field(scroll, "Nombre del usuario", "nombre_usuario")
        self._field(scroll, "DeepSeek API Key", "deepseek_api_key", show="*")

        notif = ctk.CTkFrame(scroll, fg_color=COLORS["surface"], corner_radius=14)
        notif.pack(fill="x", pady=8)
        ctk.CTkLabel(notif, text="Notificaciones", font=ctk.CTkFont(weight="bold")).pack(anchor="w", padx=16, pady=(12, 8))
        self.tarde_sel = TimeSelector(notif, "Hora tarde (default 14:00)")
        self.tarde_sel.pack(padx=16, anchor="w")
        self.tarde_sel.set(db.get_config("notif_hora_tarde", "14:00") + ":00")
        self.noche_sel = TimeSelector(notif, "Hora noche (default 21:00)")
        self.noche_sel.pack(padx=16, pady=(0, 12), anchor="w")
        self.noche_sel.set(db.get_config("notif_hora_noche", "21:00") + ":00")

        modo_f = ctk.CTkFrame(scroll, fg_color=COLORS["surface"], corner_radius=14)
        modo_f.pack(fill="x", pady=8)
        ctk.CTkLabel(modo_f, text="Modo Examen Inminente").pack(side="left", padx=16, pady=14)
        self.modo_sw = ctk.CTkSwitch(modo_f, text="")
        self.modo_sw.pack(side="right", padx=16, pady=14)
        if db.get_config("modo_examen_inminente", "1") == "1":
            self.modo_sw.select()

        meta_f = ctk.CTkFrame(scroll, fg_color=COLORS["surface"], corner_radius=14)
        meta_f.pack(fill="x", pady=8)
        ctk.CTkLabel(meta_f, text="Meta horas semanal").pack(anchor="w", padx=16, pady=(12, 2))
        self.meta_e = ctk.CTkEntry(meta_f, width=120)
        self.meta_e.pack(padx=16, pady=(0, 12), anchor="w")
        self.meta_e.insert(0, db.get_config("meta_horas_semanal", "20"))

        btns = ctk.CTkFrame(scroll, fg_color="transparent")
        btns.pack(fill="x", pady=20)
        ctk.CTkButton(btns, text="💾 Guardar", fg_color=COLORS["accent"], command=self._save).pack(side="left", padx=4)
        ctk.CTkButton(btns, text="Exportar JSON", fg_color=COLORS["surface_elevated"], command=self._export).pack(side="left", padx=4)
        ctk.CTkButton(btns, text="Importar JSON", fg_color=COLORS["surface_elevated"], command=self._import).pack(side="left", padx=4)
        ctk.CTkButton(btns, text="🗑️ Borrar todos los datos", fg_color=COLORS["red"], command=self._wipe).pack(side="left", padx=4)

    def _field(self, parent, label: str, key: str, show: str = ""):
        f = ctk.CTkFrame(parent, fg_color=COLORS["surface"], corner_radius=14)
        f.pack(fill="x", pady=6)
        ctk.CTkLabel(f, text=label).pack(anchor="w", padx=16, pady=(12, 2))
        e = ctk.CTkEntry(f, width=400, show=show)
        e.pack(padx=16, pady=(0, 12), anchor="w")
        e.insert(0, db.get_config(key, ""))
        setattr(self, f"entry_{key}", e)

    def _save(self):
        for key in ("nombre_usuario", "deepseek_api_key"):
            db.set_config(key, getattr(self, f"entry_{key}").get().strip())
        db.set_config("notif_hora_tarde", self.tarde_sel.get()[:5])
        db.set_config("notif_hora_noche", self.noche_sel.get()[:5])
        db.set_config("modo_examen_inminente", "1" if self.modo_sw.get() else "0")
        db.set_config("meta_horas_semanal", self.meta_e.get().strip() or "20")
        messagebox.showinfo("Guardado", "Configuración actualizada")

    def _export(self):
        path = filedialog.asksaveasfilename(defaultextension=".json", filetypes=[("JSON", "*.json")])
        if path:
            db.exportar_datos(path)
            messagebox.showinfo("OK", f"Exportado a {path}")

    def _import(self):
        path = filedialog.askopenfilename(filetypes=[("JSON", "*.json")])
        if path and messagebox.askyesno("Confirmar", "¿Reemplazar todos los datos?"):
            db.importar_datos(path)
            messagebox.showinfo("OK", "Datos importados")
            self.app.refresh_all()

    def _wipe(self):
        if messagebox.askyesno("PELIGRO", "¿Borrar TODOS los datos? Esta acción no se puede deshacer."):
            db.borrar_todos_datos()
            messagebox.showinfo("OK", "Datos reiniciados con ejemplos")
            self.app.refresh_all()

    def refresh(self):
        pass
