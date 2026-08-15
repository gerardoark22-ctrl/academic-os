"""Motor de tema visual — dark/light + estilo gamer."""

import json

import customtkinter as ctk

import config as cfg

PALETTE_DARK = {
    "bg": "#0d0d1a",
    "surface": "#1a1a2e",
    "surface_elevated": "#16213e",
    "accent": "#e94560",
    "accent_hover": "#c73a52",
    "accent2": "#7c3aed",
    "green": "#00b894",
    "yellow": "#fdcb6e",
    "red": "#d63031",
    "orange": "#e17055",
    "blue": "#0984e3",
    "text": "#ffffff",
    "text_sec": "#b2bec3",
    "text_on_accent": "#ffffff",
    "border": "#2d3a5a",
    "glow_green": "#4d00b894",
    "glow_red": "#4dd63031",
    "glow_accent": "#4de94560",
    "kanban_progress_bg": "#1a2e1a",
    "card_border": "#e94560",
    "btn_border": "#7c3aed",
    "progress_track": "#16213e",
    "nav_hover": "#16213e",
    "slot_empty_bg": "#1a1a2e",
    "slot_empty_hover": "#16213e",
    "slot_empty_text": "#b2bec3",
    "input_bg": "#16213e",
    "scrollbar": "#2d3a5a",
    "scrollbar_hover": "#e94560",
    "dropdown_bg": "#1a1a2e",
    "tab_unselected": "#1a1a2e",
    "row_bg": "#16213e",
    "row_overdue": "#2a1515",
    "row_done": "#1a2a1a",
    "cal_busy_1": "#152a20",
    "cal_busy_3": "#1a2a3d",
}

PALETTE_LIGHT = {
    "bg": "#dce3ef",
    "surface": "#ffffff",
    "surface_elevated": "#f1f5f9",
    "accent": "#c1121f",
    "accent_hover": "#9b0f19",
    "accent2": "#5b21b6",
    "green": "#047857",
    "yellow": "#b45309",
    "red": "#b91c1c",
    "orange": "#c2410c",
    "blue": "#1d4ed8",
    "text": "#0f172a",
    "text_sec": "#475569",
    "text_on_accent": "#ffffff",
    "border": "#94a3b8",
    "glow_green": "#059669",
    "glow_red": "#dc2626",
    "glow_accent": "#c1121f",
    "kanban_progress_bg": "#ecfdf5",
    "card_border": "#c1121f",
    "btn_border": "#5b21b6",
    "progress_track": "#cbd5e1",
    "nav_hover": "#e2e8f0",
    "slot_empty_bg": "#f8fafc",
    "slot_empty_hover": "#e2e8f0",
    "slot_empty_text": "#475569",
    "input_bg": "#ffffff",
    "scrollbar": "#94a3b8",
    "scrollbar_hover": "#c1121f",
    "dropdown_bg": "#ffffff",
    "tab_unselected": "#e2e8f0",
    "row_bg": "#f8fafc",
    "row_overdue": "#fee2e2",
    "row_done": "#ecfdf5",
    "cal_busy_1": "#d1fae5",
    "cal_busy_3": "#dbeafe",
}

DOMINIO_DARK = [
    ("cero_pista", "💀 CERO PISTA", "#3d1515"),
    ("entendiendo", "🌱 ENTENDIENDO", "#3d3510"),
    ("casi_listo", "⚡ CASI LISTO", "#102a3d"),
    ("lo_tengo", "🔥 LO TENGO", "#103d2a"),
]

DOMINIO_LIGHT = [
    ("cero_pista", "💀 CERO PISTA", "#fecaca"),
    ("entendiendo", "🌱 ENTENDIENDO", "#fde68a"),
    ("casi_listo", "⚡ CASI LISTO", "#bfdbfe"),
    ("lo_tengo", "🔥 LO TENGO", "#a7f3d0"),
]

FONT_SPECS = {
    "display": ("Segoe UI", 30, "bold"),
    "title": ("Segoe UI", 20, "bold"),
    "subtitle": ("Segoe UI", 14, "bold"),
    "body": ("Segoe UI", 12, "normal"),
    "small": ("Segoe UI", 10, "normal"),
    "mono": ("Consolas", 11, "normal"),
    "badge": ("Segoe UI", 10, "bold"),
    "game": ("Segoe UI", 13, "bold"),
}


def font(key: str) -> ctk.CTkFont:
    fam, size, weight = FONT_SPECS.get(key, FONT_SPECS["body"])
    return ctk.CTkFont(family=fam, size=size, weight=weight)


def lbl(parent, text: str = "", style: str = "body", **kwargs) -> ctk.CTkLabel:
    """Etiqueta con color de texto garantizado según tema activo."""
    styles = {
        "display": ("display", "text"),
        "title": ("title", "text"),
        "section": ("subtitle", "text"),
        "body": ("body", "text"),
        "muted": ("small", "text_sec"),
        "accent": ("body", "accent"),
        "on_color": ("subtitle", "text_on_accent"),
        "danger": ("subtitle", "red"),
    }
    fk, ck = styles.get(style, styles["body"])
    kwargs.setdefault("font", font(fk))
    kwargs.setdefault("text_color", cfg.COLORS[ck])
    return ctk.CTkLabel(parent, text=text, **kwargs)


def lane_header_text(lane_key: str) -> str:
    """Texto legible sobre fondos de cuadrantes de la matriz."""
    return cfg.COLORS["text"] if lane_key == "despues" else cfg.COLORS["text_on_accent"]


def styled_entry(parent, **kwargs) -> ctk.CTkEntry:
    kwargs.setdefault("fg_color", cfg.COLORS["input_bg"])
    kwargs.setdefault("border_color", cfg.COLORS["border"])
    kwargs.setdefault("text_color", cfg.COLORS["text"])
    kwargs.setdefault("border_width", 2)
    kwargs.setdefault("font", font("body"))
    return ctk.CTkEntry(parent, **kwargs)


def styled_option(parent, **kwargs) -> ctk.CTkOptionMenu:
    kwargs.setdefault("fg_color", cfg.COLORS["input_bg"])
    kwargs.setdefault("button_color", cfg.COLORS["accent"])
    kwargs.setdefault("button_hover_color", cfg.COLORS["accent_hover"])
    kwargs.setdefault("text_color", cfg.COLORS["text"])
    return ctk.CTkOptionMenu(parent, **kwargs)


def styled_switch(parent, **kwargs) -> ctk.CTkSwitch:
    kwargs.setdefault("text_color", cfg.COLORS["text"])
    kwargs.setdefault("fg_color", cfg.COLORS["progress_track"])
    kwargs.setdefault("progress_color", cfg.COLORS["accent2"])
    return ctk.CTkSwitch(parent, **kwargs)


def _pair(dark: str, light: str) -> list[str]:
    return [dark, light]


def sync_ctk_theme() -> None:
    """Escribe theme.json con colores distintos para dark [0] y light [1]."""
    d, l = PALETTE_DARK, PALETTE_LIGHT
    theme = {
        "CTk": {"fg_color": _pair(d["bg"], l["bg"])},
        "CTkToplevel": {"fg_color": _pair(d["surface"], l["surface"])},
        "CTkFrame": {
            "corner_radius": 12,
            "border_width": 0,
            "fg_color": _pair(d["surface"], l["surface"]),
            "top_fg_color": _pair(d["surface_elevated"], l["surface_elevated"]),
            "border_color": _pair(d["border"], l["border"]),
        },
        "CTkButton": {
            "corner_radius": 8,
            "border_width": 0,
            "fg_color": _pair(d["accent"], l["accent"]),
            "hover_color": _pair(d["accent_hover"], l["accent_hover"]),
            "border_color": _pair(d["border"], l["border"]),
            "text_color": _pair(d["text_on_accent"], l["text"]),
            "text_color_disabled": _pair(d["text_sec"], l["text_sec"]),
        },
        "CTkLabel": {
            "corner_radius": 0,
            "fg_color": "transparent",
            "text_color": _pair(d["text"], l["text"]),
        },
        "CTkEntry": {
            "corner_radius": 8,
            "border_width": 2,
            "fg_color": _pair(d["input_bg"], l["input_bg"]),
            "border_color": _pair(d["border"], l["border"]),
            "text_color": _pair(d["text"], l["text"]),
            "placeholder_text_color": _pair(d["text_sec"], l["text_sec"]),
        },
        "CTkCheckBox": {
            "corner_radius": 6,
            "border_width": 3,
            "fg_color": _pair(d["accent"], l["accent"]),
            "border_color": _pair(d["border"], l["border"]),
            "hover_color": _pair(d["accent_hover"], l["accent_hover"]),
            "checkmark_color": _pair(d["text_on_accent"], l["text_on_accent"]),
            "text_color": _pair(d["text"], l["text"]),
            "text_color_disabled": _pair(d["text_sec"], l["text_sec"]),
        },
        "CTkSwitch": {
            "corner_radius": 1000,
            "border_width": 3,
            "button_length": 0,
            "fg_color": _pair(d["border"], l["progress_track"]),
            "progress_color": _pair(d["accent2"], l["accent2"]),
            "button_color": _pair(d["text_on_accent"], l["surface"]),
            "button_hover_color": _pair(d["text_sec"], l["border"]),
            "text_color": _pair(d["text"], l["text"]),
            "text_color_disabled": _pair(d["text_sec"], l["text_sec"]),
        },
        "CTkRadioButton": {
            "corner_radius": 1000,
            "border_width_checked": 6,
            "border_width_unchecked": 3,
            "fg_color": _pair(d["accent"], l["accent"]),
            "border_color": _pair(d["border"], l["border"]),
            "hover_color": _pair(d["accent_hover"], l["accent_hover"]),
            "text_color": _pair(d["text"], l["text"]),
            "text_color_disabled": _pair(d["text_sec"], l["text_sec"]),
        },
        "CTkProgressBar": {
            "corner_radius": 1000,
            "border_width": 0,
            "fg_color": _pair(d["progress_track"], l["progress_track"]),
            "progress_color": _pair(d["green"], l["green"]),
            "border_color": _pair(d["border"], l["border"]),
        },
        "CTkSlider": {
            "corner_radius": 1000,
            "button_corner_radius": 1000,
            "border_width": 6,
            "button_length": 0,
            "fg_color": _pair(d["progress_track"], l["progress_track"]),
            "progress_color": _pair(d["accent2"], l["accent2"]),
            "button_color": _pair(d["accent"], l["accent"]),
            "button_hover_color": _pair(d["accent_hover"], l["accent_hover"]),
        },
        "CTkOptionMenu": {
            "corner_radius": 8,
            "fg_color": _pair(d["input_bg"], l["input_bg"]),
            "button_color": _pair(d["accent"], l["accent"]),
            "button_hover_color": _pair(d["accent_hover"], l["accent_hover"]),
            "text_color": _pair(d["text"], l["text"]),
            "text_color_disabled": _pair(d["text_sec"], l["text_sec"]),
        },
        "CTkComboBox": {
            "corner_radius": 8,
            "border_width": 2,
            "fg_color": _pair(d["input_bg"], l["input_bg"]),
            "border_color": _pair(d["border"], l["border"]),
            "button_color": _pair(d["accent"], l["accent"]),
            "button_hover_color": _pair(d["accent_hover"], l["accent_hover"]),
            "text_color": _pair(d["text"], l["text"]),
            "text_color_disabled": _pair(d["text_sec"], l["text_sec"]),
        },
        "CTkScrollbar": {
            "corner_radius": 1000,
            "border_spacing": 4,
            "fg_color": "transparent",
            "button_color": _pair(d["scrollbar"], l["scrollbar"]),
            "button_hover_color": _pair(d["scrollbar_hover"], l["scrollbar_hover"]),
        },
        "CTkSegmentedButton": {
            "corner_radius": 8,
            "border_width": 2,
            "fg_color": _pair(d["surface_elevated"], l["surface_elevated"]),
            "selected_color": _pair(d["accent"], "#93c5fd"),
            "selected_hover_color": _pair(d["accent_hover"], "#60a5fa"),
            "unselected_color": _pair(d["tab_unselected"], l["tab_unselected"]),
            "unselected_hover_color": _pair(d["nav_hover"], l["nav_hover"]),
            "text_color": _pair(d["text_on_accent"], l["text"]),
            "text_color_disabled": _pair(d["text_sec"], l["text_sec"]),
        },
        "CTkTextbox": {
            "corner_radius": 8,
            "border_width": 2,
            "fg_color": _pair(d["input_bg"], l["input_bg"]),
            "border_color": _pair(d["border"], l["border"]),
            "text_color": _pair(d["text"], l["text"]),
            "scrollbar_button_color": _pair(d["scrollbar"], l["scrollbar"]),
            "scrollbar_button_hover_color": _pair(d["scrollbar_hover"], l["scrollbar_hover"]),
        },
        "CTkScrollableFrame": {
            "label_fg_color": _pair(d["surface"], l["surface"]),
        },
        "CTkTabview": {
            "corner_radius": 10,
            "border_width": 2,
            "fg_color": _pair(d["surface"], l["surface"]),
            "segmented_button_fg_color": _pair(d["surface_elevated"], l["surface_elevated"]),
            "segmented_button_selected_color": _pair(d["accent"], l["blue"]),
            "segmented_button_selected_hover_color": _pair(d["accent_hover"], l["blue"]),
            "segmented_button_unselected_color": _pair(d["tab_unselected"], l["tab_unselected"]),
            "segmented_button_unselected_hover_color": _pair(d["nav_hover"], l["nav_hover"]),
            "text_color": _pair(d["text_on_accent"], l["text"]),
            "text_color_disabled": _pair(d["text_sec"], l["text_sec"]),
        },
        "DropdownMenu": {
            "fg_color": _pair(d["dropdown_bg"], l["dropdown_bg"]),
            "hover_color": _pair(d["nav_hover"], l["nav_hover"]),
            "text_color": _pair(d["text"], l["text"]),
        },
        "CTkFont": {
            "Windows": {"family": "Segoe UI", "size": 13, "weight": "normal"},
            "macOS": {"family": "SF Display", "size": 13, "weight": "normal"},
            "Linux": {"family": "Roboto", "size": 13, "weight": "normal"},
        },
    }
    cfg.THEME_PATH.parent.mkdir(parents=True, exist_ok=True)
    cfg.THEME_PATH.write_text(json.dumps(theme, indent=2), encoding="utf-8")


def _apply_dominio_palette(light: bool) -> None:
    opciones = DOMINIO_LIGHT if light else DOMINIO_DARK
    cfg.DOMINIO_OPCIONES.clear()
    cfg.DOMINIO_OPCIONES.extend(opciones)
    cfg.DOMINIO_LABELS.clear()
    cfg.DOMINIO_LABELS.update({k: v for k, v, _ in opciones})
    cfg.DOMINIO_BG.clear()
    cfg.DOMINIO_BG.update({k: c for k, _, c in opciones})


def apply_theme(light: bool = False) -> None:
    palette = PALETTE_LIGHT if light else PALETTE_DARK
    cfg.COLORS.clear()
    cfg.COLORS.update(palette)
    cfg.SEMAFORO_COLORS.update({
        "VERDE": palette["green"],
        "AMARILLO": palette["yellow"],
        "ROJO": palette["red"],
        "ROJO_CRITICO": palette["red"],
    })
    cfg.PRIORIDAD_COLORS.update({
        "urgente": palette["red"],
        "importante": palette["yellow"],
        "normal": palette["green"],
    })
    _apply_dominio_palette(light)
    sync_ctk_theme()
    ctk.set_appearance_mode("light" if light else "dark")
    if cfg.THEME_PATH.exists():
        ctk.set_default_color_theme(str(cfg.THEME_PATH))


def is_light_mode() -> bool:
    import database as db
    return db.get_config("tema_claro", "0") == "1"
