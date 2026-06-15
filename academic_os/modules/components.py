"""Componentes UI reutilizables — Academic OS v2."""

import calendar
from datetime import date, datetime, timedelta

import customtkinter as ctk

from config import COLORS, DOMINIO_BG, DOMINIO_LABELS, DOMINIO_OPCIONES, Vida_ZONAS

def safe_color(color: str | None, fallback: str = COLORS["accent"]) -> str:
    """Evita None en widgets CustomTkinter."""
    return color if color else fallback


class PulseBorder(ctk.CTkFrame):
    """Frame con borde pulsante para alertas críticas."""

    def __init__(self, master, pulse_color=COLORS["red"], **kwargs):
        super().__init__(master, **kwargs)
        self._pulse_color = safe_color(pulse_color, COLORS["red"])
        self._on = True
        self._animate()

    def _animate(self):
        if not self.winfo_exists():
            return
        color = self._pulse_color if self._on else COLORS["border"]
        self.configure(border_color=color, border_width=3)
        self._on = not self._on
        self.after(600, self._animate)


class GlowFrame(ctk.CTkFrame):
    """Frame con efecto glow alternante."""

    def __init__(self, master, glow_color=COLORS["accent"], **kwargs):
        kwargs.setdefault("border_width", 2)
        super().__init__(master, **kwargs)
        glow = safe_color(glow_color, COLORS["accent"])
        self._colors = [glow, COLORS["border"]]
        self._i = 0
        self._animate()

    def _animate(self):
        if not self.winfo_exists():
            return
        color = self._colors[self._i % 2] or COLORS["border"]
        self.configure(border_color=color)
        self._i += 1
        self.after(800, self._animate)


class LifeBarWidget(ctk.CTkFrame):
    """Barra de vida académica estilo videojuego."""

    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        self._build()

    def _build(self):
        top = ctk.CTkFrame(self, fg_color="transparent")
        top.pack(fill="x")
        ctk.CTkLabel(
            top, text="ÍNDICE DE DOMINIO",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color=COLORS["text_sec"],
        ).pack(side="left")
        self.val_label = ctk.CTkLabel(
            top, text="0",
            font=ctk.CTkFont(size=42, weight="bold"),
            text_color=COLORS["accent"],
        )
        self.val_label.pack(side="right")

        self.bar = ctk.CTkProgressBar(self, height=22, corner_radius=11)
        self.bar.pack(fill="x", pady=(8, 4))
        self.bar.set(0)

        self.msg_label = ctk.CTkLabel(
            self, text="",
            font=ctk.CTkFont(size=13),
            text_color=COLORS["text_sec"],
        )
        self.msg_label.pack(anchor="w")

    def set_value(self, value: int):
        value = max(0, min(100, value))
        self.bar.set(value / 100)
        self.val_label.configure(text=str(value))
        color, msg = Vida_ZONAS[0][2], Vida_ZONAS[0][3]
        for lo, hi, c, m in Vida_ZONAS:
            if lo <= value <= hi:
                color, msg = c, m
                break
        self.val_label.configure(text_color=color)
        self.bar.configure(progress_color=color)
        self.msg_label.configure(text=msg)


class MetricCard(ctk.CTkFrame):
    """Card de métrica con estilo HUD."""

    def __init__(self, master, icon: str, title: str, **kwargs):
        super().__init__(
            master, fg_color=COLORS["surface"],
            corner_radius=14, border_width=1, border_color=COLORS["border"],
            **kwargs,
        )
        ctk.CTkLabel(
            self, text=f"{icon} {title}",
            font=ctk.CTkFont(size=12),
            text_color=COLORS["text_sec"],
        ).pack(anchor="w", padx=14, pady=(12, 0))
        self.value_label = ctk.CTkLabel(
            self, text="—",
            font=ctk.CTkFont(size=32, weight="bold"),
            text_color=COLORS["text"],
        )
        self.value_label.pack(anchor="w", padx=14, pady=(4, 4))
        self.sub_label = ctk.CTkLabel(
            self, text="",
            font=ctk.CTkFont(size=11),
            text_color=COLORS["text_sec"],
        )
        self.sub_label.pack(anchor="w", padx=14, pady=(0, 12))

    def set(self, value: str, sub: str = ""):
        self.value_label.configure(text=value)
        self.sub_label.configure(text=sub)


class DatePicker(ctk.CTkToplevel):
    """Calendario clickeable con atajos rápidos."""

    def __init__(self, master, callback, initial: date | None = None):
        super().__init__(master)
        self.callback = callback
        self.title("Seleccionar fecha")
        self.geometry("340x380")
        self.resizable(False, False)
        self.configure(fg_color=COLORS["surface"])
        self.transient(master.winfo_toplevel())
        self.grab_set()

        self.current = initial or date.today()
        self._build()

    def _build(self):
        shortcuts = ctk.CTkFrame(self, fg_color="transparent")
        shortcuts.pack(fill="x", padx=10, pady=10)
        for label, delta in [("Hoy", 0), ("Mañana", 1), ("+3 días", 3), ("+1 semana", 7)]:
            ctk.CTkButton(
                shortcuts, text=label, width=70, height=28,
                fg_color=COLORS["surface_elevated"],
                command=lambda d=delta: self._pick(date.today() + timedelta(days=d)),
            ).pack(side="left", padx=3)

        nav = ctk.CTkFrame(self, fg_color="transparent")
        nav.pack(fill="x", padx=10)
        ctk.CTkButton(nav, text="◀", width=40, command=self._prev_month).pack(side="left")
        self.month_label = ctk.CTkLabel(
            nav, text="",
            font=ctk.CTkFont(size=16, weight="bold"),
        )
        self.month_label.pack(side="left", expand=True)
        ctk.CTkButton(nav, text="▶", width=40, command=self._next_month).pack(side="right")
        self.grid_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.grid_frame.pack(fill="both", expand=True, padx=10, pady=10)
        self._render()

    def _prev_month(self):
        m, y = self.current.month - 1, self.current.year
        if m < 1:
            m, y = 12, y - 1
        self.current = self.current.replace(year=y, month=m, day=1)
        self._render()

    def _next_month(self):
        m, y = self.current.month + 1, self.current.year
        if m > 12:
            m, y = 1, y + 1
        self.current = self.current.replace(year=y, month=m, day=1)
        self._render()

    def _render(self):
        for w in self.grid_frame.winfo_children():
            w.destroy()
        self.month_label.configure(
            text=self.current.strftime("%B %Y").capitalize()
        )
        for d in ["L", "M", "X", "J", "V", "S", "D"]:
            ctk.CTkLabel(self.grid_frame, text=d, width=40).grid(row=0, column=["L","M","X","J","V","S","D"].index(d))
        cal = calendar.Calendar(firstweekday=0)
        row = 1
        for week in cal.monthdayscalendar(self.current.year, self.current.month):
            for col, day in enumerate(week):
                if day == 0:
                    ctk.CTkFrame(self.grid_frame, width=40, height=36, fg_color="transparent").grid(row=row, column=col, padx=1, pady=1)
                    continue
                d = date(self.current.year, self.current.month, day)
                is_today = d == date.today()
                fg = COLORS["accent"] if is_today else COLORS["surface_elevated"]
                ctk.CTkButton(
                    self.grid_frame, text=str(day), width=40, height=36,
                    fg_color=fg,
                    command=lambda dd=d: self._pick(dd),
                ).grid(row=row, column=col, padx=1, pady=1)
            row += 1

    def _pick(self, d: date):
        self.callback(d.isoformat())
        self.destroy()


class TimeSelector(ctk.CTkFrame):
    """Selector de hora con dropdown."""

    HORAS = [f"{h:02d}:{m:02d}" for h in range(24) for m in (0, 30)]

    def __init__(self, master, label: str = "Hora", **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        ctk.CTkLabel(self, text=label, text_color=COLORS["text_sec"]).pack(anchor="w")
        self.menu = ctk.CTkOptionMenu(self, values=self.HORAS, width=120)
        self.menu.pack(anchor="w", pady=4)

    def get(self) -> str:
        return self.menu.get() + ":00"

    def set(self, value: str):
        if value:
            self.menu.set(value[:5])


class ColorPalette(ctk.CTkFrame):
    """Selector visual de colores."""

    def __init__(self, master, colors: list[str], on_select, **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        self._selected = colors[0]
        self._on_select = on_select
        self._buttons = []
        for i, c in enumerate(colors):
            btn = ctk.CTkButton(
                self, text="", width=36, height=36,
                fg_color=c, hover_color=c,
                corner_radius=18,
                command=lambda col=c: self._select(col),
            )
            btn.grid(row=i // 5, column=i % 5, padx=4, pady=4)
            self._buttons.append(btn)

    def _select(self, color: str):
        self._selected = color
        self._on_select(color)

    def get(self) -> str:
        return self._selected


class DominioSelector(ctk.CTkFrame):
    """4 botones de dominio con glow en activo."""

    def __init__(self, master, valor: str, on_change, **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        self._on_change = on_change
        self._active = valor
        self._btns: dict[str, ctk.CTkButton] = {}
        for key, label, bg in DOMINIO_OPCIONES:
            btn = ctk.CTkButton(
                self, text=label, height=36,
                fg_color=bg,
                hover_color=bg,
                border_width=2,
                border_color=COLORS["green"] if key == valor else COLORS["border"],
                command=lambda k=key: self._set(k),
            )
            btn.pack(side="left", padx=3, expand=True, fill="x")
            self._btns[key] = btn

    def _set(self, key: str):
        self._active = key
        for k, btn in self._btns.items():
            btn.configure(
                border_color=COLORS["green"] if k == key else COLORS["border"],
                border_width=3 if k == key else 1,
            )
        self._on_change(key)


def hora_saludo() -> str:
    h = datetime.now().hour
    if h < 12:
        return "Buenos días"
    if h < 19:
        return "Buenas tardes"
    return "Buenas noches"


class DominioStatusWidget(ctk.CTkFrame):
    """Barra de preparación académica con métricas claras (no solo un número)."""

    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        self._build()

    def _build(self):
        top = ctk.CTkFrame(self, fg_color="transparent")
        top.pack(fill="x")
        ctk.CTkLabel(
            top, text="PREPARACIÓN PARA EXÁMENES",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color=COLORS["text_sec"],
        ).pack(side="left")
        self.pct_label = ctk.CTkLabel(
            top, text="0%",
            font=ctk.CTkFont(size=36, weight="bold"),
            text_color=COLORS["accent"],
        )
        self.pct_label.pack(side="right")

        self.main_label = ctk.CTkLabel(
            self, text="0 de 0 temas dominados",
            font=ctk.CTkFont(size=15, weight="bold"),
            anchor="w",
        )
        self.main_label.pack(anchor="w", pady=(6, 2))

        self.bar = ctk.CTkProgressBar(self, height=20, corner_radius=10)
        self.bar.pack(fill="x", pady=(4, 8))
        self.bar.set(0)

        chips = ctk.CTkFrame(self, fg_color="transparent")
        chips.pack(fill="x", pady=(0, 4))
        self.chip_cero = ctk.CTkLabel(chips, text="💀 0 sin pista", font=ctk.CTkFont(size=11), text_color=COLORS["red"])
        self.chip_cero.pack(side="left", padx=(0, 12))
        self.chip_medio = ctk.CTkLabel(chips, text="🌱 0 en progreso", font=ctk.CTkFont(size=11), text_color=COLORS["yellow"])
        self.chip_medio.pack(side="left", padx=(0, 12))
        self.chip_listo = ctk.CTkLabel(chips, text="🔥 0 dominados", font=ctk.CTkFont(size=11), text_color=COLORS["green"])
        self.chip_listo.pack(side="left")

        self.msg_label = ctk.CTkLabel(
            self, text="",
            font=ctk.CTkFont(size=13),
            text_color=COLORS["text_sec"],
            wraplength=700,
            justify="left",
        )
        self.msg_label.pack(anchor="w", pady=(4, 0))

    def set_resumen(self, resumen: dict):
        total = resumen.get("total", 0)
        dominados = resumen.get("dominados", 0)
        pct = resumen.get("porcentaje", 0)
        self.pct_label.configure(text=f"{pct}%")
        self.main_label.configure(
            text=f"{dominados} de {total} temas con dominio completo (LO TENGO)"
        )
        self.bar.set(pct / 100 if total else 0)
        self.chip_cero.configure(text=f"💀 {resumen.get('cero_pista', 0)} sin pista")
        self.chip_medio.configure(
            text=f"🌱 {resumen.get('entendiendo', 0) + resumen.get('casi_listo', 0)} en progreso"
        )
        self.chip_listo.configure(text=f"🔥 {dominados} dominados")

        color, msg = Vida_ZONAS[0][2], Vida_ZONAS[0][3]
        for lo, hi, c, m in Vida_ZONAS:
            if lo <= pct <= hi:
                color, msg = c, m
                break
        sin = resumen.get("sin_dominar", 0)
        if sin > 0:
            msg = f"{msg} — Te faltan {sin} tema(s) por dominar antes de los exámenes."
        self.pct_label.configure(text_color=color)
        self.bar.configure(progress_color=color)
        self.msg_label.configure(text=msg)


class TimeBlockPicker(ctk.CTkToplevel):
    """Elige bloques del día para colocar un tema o subtema en TimeBlocking."""

    def __init__(self, master, titulo: str, curso_id: int, tema_id: int, on_done=None):
        super().__init__(master)
        self.titulo = titulo
        self.curso_id = curso_id
        self.tema_id = tema_id
        self.on_done = on_done
        self.fecha = date.today().isoformat()
        self._checks: list[tuple[ctk.BooleanVar, dict]] = []

        self.title("Colocar en TimeBlocking")
        self.geometry("480x560")
        self.resizable(False, False)
        self.configure(fg_color=COLORS["surface"])
        self.transient(master.winfo_toplevel())
        self.grab_set()
        self._build()
        self._load_slots()

    def _build(self):
        ctk.CTkLabel(
            self, text="⏰ ASIGNAR A BLOQUES",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color=COLORS["accent"],
        ).pack(anchor="w", padx=16, pady=(14, 4))
        ctk.CTkLabel(
            self, text=self.titulo, font=ctk.CTkFont(size=13, weight="bold"),
            wraplength=440, justify="left",
        ).pack(anchor="w", padx=16, pady=(0, 8))

        df = ctk.CTkFrame(self, fg_color="transparent")
        df.pack(fill="x", padx=16, pady=4)
        self.fecha_lbl = ctk.CTkLabel(df, text="", text_color=COLORS["accent"])
        self.fecha_lbl.pack(side="left")
        ctk.CTkButton(
            df, text="📅 Cambiar día", width=110, height=28,
            fg_color=COLORS["surface_elevated"],
            command=self._pick_date,
        ).pack(side="right")

        ctk.CTkLabel(
            self, text="Marca uno o más bloques (libres u ocupados):",
            text_color=COLORS["text_sec"], font=ctk.CTkFont(size=11),
        ).pack(anchor="w", padx=16, pady=(8, 4))

        self.slots_scroll = ctk.CTkScrollableFrame(self, fg_color=COLORS["bg"], height=340)
        self.slots_scroll.pack(fill="both", expand=True, padx=16, pady=4)

        bf = ctk.CTkFrame(self, fg_color="transparent")
        bf.pack(fill="x", padx=16, pady=12)
        ctk.CTkButton(
            bf, text="✅ Colocar en bloques", fg_color=COLORS["green"],
            command=self._assign,
        ).pack(side="left", padx=4)
        ctk.CTkButton(bf, text="Cancelar", fg_color=COLORS["surface_elevated"], command=self.destroy).pack(side="left", padx=4)

    def _pick_date(self):
        import database as db
        DatePicker(self, lambda d: (setattr(self, "fecha", d), self._load_slots()), date.fromisoformat(self.fecha))

    def _load_slots(self):
        import database as db
        for w in self.slots_scroll.winfo_children():
            w.destroy()
        self._checks.clear()
        self.fecha_lbl.configure(
            text=date.fromisoformat(self.fecha).strftime("%A %d/%m/%Y").capitalize()
        )
        for slot in db.get_slots_dia(self.fecha):
            row = ctk.CTkFrame(self.slots_scroll, fg_color=COLORS["surface_elevated"], corner_radius=8)
            row.pack(fill="x", pady=2)
            var = ctk.BooleanVar(value=False)
            if slot["libre"]:
                estado = "🟢 Libre"
                color = COLORS["green"]
            else:
                tit = (slot["bloque"] or {}).get("titulo", "Ocupado")[:30]
                estado = f"📌 {tit}"
                color = COLORS["blue"]
            ctk.CTkCheckBox(
                row, text=f"{slot['label_hs']} — {estado}",
                variable=var, text_color=color,
            ).pack(anchor="w", padx=10, pady=8)
            self._checks.append((var, slot))

    def _assign(self):
        import database as db
        from tkinter import messagebox
        selected = [s for v, s in self._checks if v.get()]
        if not selected:
            messagebox.showwarning("TimeBlocking", "Selecciona al menos un bloque")
            return
        n = db.asignar_tema_a_slots(self.fecha, self.tema_id, self.curso_id, self.titulo, selected)
        messagebox.showinfo("TimeBlocking", f"Tema colocado en {n} bloque(s)")
        if self.on_done:
            self.on_done()
        self.destroy()
