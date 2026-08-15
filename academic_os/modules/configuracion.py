"""Configuración — Academic OS v2."""

from tkinter import filedialog, messagebox

import customtkinter as ctk

import database as db
from config import COLORS
from modules.components import TimeSelector, game_button
from modules.theme_engine import (
    apply_theme,
    is_light_mode,
    lbl,
    styled_entry,
    styled_switch,
)


class ConfiguracionFrame(ctk.CTkFrame):
    def __init__(self, master, app, **kwargs):
        super().__init__(master, fg_color=COLORS["bg"], **kwargs)
        self.app = app
        self._build()

    def _card(self, parent) -> ctk.CTkFrame:
        return ctk.CTkFrame(
            parent, fg_color=COLORS["surface"], corner_radius=14,
            border_width=2, border_color=COLORS.get("card_border", COLORS["border"]),
        )

    def _build(self):
        scroll = ctk.CTkScrollableFrame(self, fg_color=COLORS["bg"])
        scroll.pack(fill="both", expand=True, padx=24, pady=24)

        lbl(scroll, "⚙️ CONFIGURACIÓN", style="display").pack(anchor="w", pady=(0, 20))

        self._field(scroll, "Nombre del usuario", "nombre_usuario")
        self._field(scroll, "DeepSeek API Key", "deepseek_api_key", show="*")

        tema_f = self._card(scroll)
        tema_f.pack(fill="x", pady=8)
        lbl(tema_f, "Apariencia", style="section").pack(anchor="w", padx=16, pady=(12, 4))
        lbl(
            tema_f, "Modo claro (fondo blanco) y estilo gamer con bordes",
            style="muted",
        ).pack(anchor="w", padx=16)
        self.tema_sw = styled_switch(tema_f, text="Tema claro")
        self.tema_sw.pack(anchor="w", padx=16, pady=(8, 14))
        if is_light_mode():
            self.tema_sw.select()

        notif = self._card(scroll)
        notif.pack(fill="x", pady=8)
        lbl(notif, "Notificaciones", style="section").pack(anchor="w", padx=16, pady=(12, 8))
        self.tarde_sel = TimeSelector(notif, "Hora tarde (default 14:00)")
        self.tarde_sel.pack(padx=16, anchor="w")
        self.tarde_sel.set(db.get_config("notif_hora_tarde", "14:00") + ":00")
        self.noche_sel = TimeSelector(notif, "Hora noche (default 21:00)")
        self.noche_sel.pack(padx=16, pady=(0, 12), anchor="w")
        self.noche_sel.set(db.get_config("notif_hora_noche", "21:00") + ":00")

        modo_f = self._card(scroll)
        modo_f.pack(fill="x", pady=8)
        lbl(modo_f, "Modo Examen Inminente", style="section").pack(anchor="w", padx=16, pady=(12, 2))
        lbl(
            modo_f,
            "Prioriza exámenes ≤14 días, banner de alerta y tareas urgentes automáticas",
            style="muted", wraplength=500, justify="left",
        ).pack(anchor="w", padx=16)
        row = ctk.CTkFrame(modo_f, fg_color="transparent")
        row.pack(fill="x", padx=16, pady=(4, 14))
        lbl(row, "Activar modo examen", style="body").pack(side="left")
        self.modo_sw = styled_switch(row, text="")
        self.modo_sw.pack(side="right")
        if db.get_config("modo_examen_inminente", "1") == "1":
            self.modo_sw.select()

        meta_f = self._card(scroll)
        meta_f.pack(fill="x", pady=8)
        lbl(meta_f, "Meta horas semanal", style="section").pack(anchor="w", padx=16, pady=(12, 2))
        self.meta_e = styled_entry(meta_f, width=120)
        self.meta_e.pack(padx=16, pady=(0, 12), anchor="w")
        self.meta_e.insert(0, db.get_config("meta_horas_semanal", "20"))

        datos_f = self._card(scroll)
        datos_f.pack(fill="x", pady=8)
        lbl(datos_f, "💾 Datos locales (permanentes)", style="section").pack(anchor="w", padx=16, pady=(12, 4))
        self.datos_lbl = lbl(
            datos_f,
            "",
            style="muted",
            wraplength=620,
            justify="left",
        )
        self.datos_lbl.pack(anchor="w", padx=16, pady=(0, 8))
        row_datos = ctk.CTkFrame(datos_f, fg_color="transparent")
        row_datos.pack(fill="x", padx=16, pady=(0, 14))
        game_button(
            row_datos, text="Copia de seguridad ahora",
            fg_color=COLORS["green"], command=self._backup_now,
        ).pack(side="left", padx=4)
        game_button(
            row_datos, text="Abrir carpeta de datos",
            fg_color=COLORS["surface_elevated"], command=self._open_data_folder,
        ).pack(side="left", padx=4)
        self._refresh_data_info()

        btns = ctk.CTkFrame(scroll, fg_color="transparent")
        btns.pack(fill="x", pady=20)
        game_button(btns, text="💾 Guardar", fg_color=COLORS["accent"], command=self._save).pack(side="left", padx=4)
        game_button(btns, text="Exportar JSON", fg_color=COLORS["surface_elevated"], command=self._export).pack(side="left", padx=4)
        game_button(btns, text="Importar JSON", fg_color=COLORS["surface_elevated"], command=self._import).pack(side="left", padx=4)
        game_button(btns, text="🗑️ Borrar todos los datos", fg_color=COLORS["red"], command=self._wipe).pack(side="left", padx=4)

    def _field(self, parent, label: str, key: str, show: str = ""):
        f = self._card(parent)
        f.pack(fill="x", pady=6)
        lbl(f, label, style="section").pack(anchor="w", padx=16, pady=(12, 2))
        e = styled_entry(f, width=400, show=show)
        e.pack(padx=16, pady=(0, 12), anchor="w")
        e.insert(0, db.get_config(key, ""))
        setattr(self, f"entry_{key}", e)

    def _save(self):
        for key in ("nombre_usuario", "deepseek_api_key"):
            db.set_config(key, getattr(self, f"entry_{key}").get().strip())
        db.set_config("notif_hora_tarde", self.tarde_sel.get()[:5])
        db.set_config("notif_hora_noche", self.noche_sel.get()[:5])
        db.set_config("tema_claro", "1" if self.tema_sw.get() else "0")
        db.set_config("modo_examen_inminente", "1" if self.modo_sw.get() else "0")
        db.set_config("meta_horas_semanal", self.meta_e.get().strip() or "20")
        apply_theme(is_light_mode())
        self.app.apply_visual_theme()
        messagebox.showinfo("Guardado", "Configuración actualizada")

    def _backup_now(self):
        path = db.backup_database("manual")
        if path:
            self._refresh_data_info()
            messagebox.showinfo("Copia de seguridad", f"Guardada en:\n{path}")
        else:
            messagebox.showwarning("Copia de seguridad", "No hay base de datos todavía.")

    def _open_data_folder(self):
        import os
        import subprocess
        folder = str(db.get_data_info()["backup_dir"])
        os.makedirs(folder, exist_ok=True)
        subprocess.Popen(["explorer", folder])

    def _refresh_data_info(self):
        if not hasattr(self, "datos_lbl"):
            return
        info = db.get_data_info()
        txt = (
            f"Base de datos: {info['db_path']}\n"
            f"Tamaño: {info['size_kb']} KB · "
            f"Cursos: {info.get('cursos', 0)} · "
            f"Unidades: {info.get('unidades', 0)} · "
            f"Temas: {info.get('temas', 0)}\n"
            f"Copias automáticas: {info['backup_dir']}"
        )
        self.datos_lbl.configure(text=txt)

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
            self.app.apply_visual_theme()

    def _wipe(self):
        if messagebox.askyesno("PELIGRO", "¿Borrar TODOS los datos? Esta acción no se puede deshacer."):
            db.borrar_todos_datos()
            messagebox.showinfo("OK", "Datos reiniciados con ejemplos")
            self.app.apply_visual_theme()

    def refresh(self):
        self._refresh_data_info()
