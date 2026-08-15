"""Gestor de Tareas — Academic OS v2."""

import calendar
from datetime import date, datetime, timedelta

import customtkinter as ctk
from tkinter import messagebox

import database as db
from ai.openai_client import AcademicAI
from config import COLORS, PRIORIDAD_COLORS, PRIORIDAD_LABELS, TB_SLOT_MIN, TIPOS_TAREA
from modules.components import DatePicker, TimeSelector, safe_color
from modules.theme_engine import font, is_light_mode, lbl, styled_entry, styled_option, styled_switch

# Colores botones de acción en filas de tarea
BTN_TB = COLORS["blue"]
BTN_DONE = COLORS["green"]
BTN_EDIT = COLORS["accent2"]
BTN_DEL = COLORS["red"]


class GestorTareasFrame(ctk.CTkFrame):
    AGRUPAMIENTOS = ["Por Urgencia", "Por Curso", "Por Tiempo", "Todas"]

    def __init__(self, master, app, **kwargs):
        super().__init__(master, fg_color=COLORS["bg"], **kwargs)
        self.app = app
        self.ai = AcademicAI(db.get_ai_api_key())
        self.agrup = "Por Urgencia"
        self.cal_year = date.today().year
        self.cal_month = date.today().month
        self._tareas_cache: list | None = None
        self._drag_data: dict = {}  # legacy, no usado en Matriz Foco
        self._build()
        self.refresh()

    def _build(self):
        hdr = ctk.CTkFrame(self, fg_color=COLORS["surface"], corner_radius=0)
        hdr.pack(fill="x")
        top = ctk.CTkFrame(hdr, fg_color="transparent")
        top.pack(fill="x", padx=16, pady=12)
        lbl(top, "📋 GESTOR DE TAREAS", style="title").pack(side="left")
        ctk.CTkButton(top, text="+ Nueva Tarea", fg_color=COLORS["accent"], text_color=COLORS["text_on_accent"], command=self._modal_tarea).pack(side="right", padx=4)
        ctk.CTkButton(top, text="🤖 Sugerencia IA", fg_color=COLORS["accent2"], text_color=COLORS["text_on_accent"], command=self._sugerencia).pack(side="right", padx=4)

        filt = ctk.CTkFrame(hdr, fg_color="transparent")
        filt.pack(fill="x", padx=16, pady=(0, 12))
        self.agrup_m = ctk.CTkSegmentedButton(filt, values=self.AGRUPAMIENTOS, command=self._set_agrup)
        self.agrup_m.pack(side="left")
        self.agrup_m.set(self.agrup)

        self.tabs = ctk.CTkTabview(self, fg_color=COLORS["surface"], command=self._on_tab_change)
        self.tabs.pack(fill="both", expand=True, padx=12, pady=12)
        self.tab_lista = self.tabs.add("Lista")
        self.tab_matriz = self.tabs.add("Matriz Foco")
        self.tab_cal = self.tabs.add("Calendario")

        self.lista_scroll = ctk.CTkScrollableFrame(self.tab_lista, fg_color=COLORS["bg"])
        self.lista_scroll.pack(fill="both", expand=True)

        # Matriz de Foco — diseño HUD con cuadrantes contrastados
        self.matriz = ctk.CTkFrame(self.tab_matriz, fg_color=COLORS["bg"])
        self.matriz.pack(fill="both", expand=True, padx=4, pady=4)
        self.matriz.grid_rowconfigure(0, weight=1)
        self.matriz.grid_rowconfigure(1, weight=1)
        self.matriz.grid_columnconfigure(0, weight=1)
        self.matriz.grid_columnconfigure(1, weight=1)
        self.matriz_lanes: dict[str, ctk.CTkScrollableFrame] = {}
        self.matriz_counts: dict[str, ctk.CTkLabel] = {}
        lanes = [
            ("critico", "🔴 CRÍTICO", "Vencidas · urgentes", COLORS["red"], "#1f0a0a", 0, 0),
            ("hoy", "🟠 HOY", "Hoy y mañana", COLORS["orange"], "#1f1208", 0, 1),
            ("semana", "🔵 SEMANA", "Próximos 7 días", COLORS["blue"], "#0a1220", 1, 0),
            ("despues", "⚪ DESPUÉS", "Sin fecha / lejanas", COLORS["text_sec"], COLORS["surface"], 1, 1),
        ]
        for key, title, sub, accent, bg, row, col in lanes:
            outer = ctk.CTkFrame(
                self.matriz, fg_color=bg, corner_radius=16,
                border_width=2, border_color=accent,
            )
            outer.grid(row=row, column=col, sticky="nsew", padx=8, pady=8)
            hdr = ctk.CTkFrame(outer, fg_color=accent, corner_radius=10, height=48)
            hdr.pack(fill="x", padx=8, pady=(8, 4))
            hdr.pack_propagate(False)
            ht = ctk.CTkFrame(hdr, fg_color="transparent")
            ht.pack(fill="both", expand=True, padx=10, pady=6)
            ctk.CTkLabel(
                ht, text=title, font=font("subtitle"),
                text_color=COLORS["text_on_accent"],
            ).pack(side="left")
            cnt_lbl = ctk.CTkLabel(
                ht, text="0", width=28, height=24, corner_radius=12,
                fg_color=COLORS["surface"], font=font("badge"),
                text_color=accent,
            )
            cnt_lbl.pack(side="right")
            self.matriz_counts[key] = cnt_lbl
            ctk.CTkLabel(
                outer, text=sub, font=font("small"),
                text_color=COLORS["text_sec"],
            ).pack(anchor="w", padx=12, pady=(0, 4))
            if key == "critico":
                ctk.CTkButton(
                    outer, text="🗑 Purgar completadas", width=130, height=24,
                    font=font("small"), fg_color=COLORS["red"],
                    text_color=COLORS["text_on_accent"],
                    command=self._purgar_completadas,
                ).pack(anchor="e", padx=10, pady=(0, 4))
            sf = ctk.CTkScrollableFrame(outer, fg_color="transparent")
            sf.pack(fill="both", expand=True, padx=8, pady=(0, 8))
            self.matriz_lanes[key] = sf

        self.cal_main = ctk.CTkFrame(self.tab_cal, fg_color=COLORS["bg"])
        self.cal_main.pack(fill="both", expand=True)
        self.cal_main.grid_columnconfigure(0, weight=3, uniform="calarea")
        self.cal_main.grid_columnconfigure(1, weight=1, minsize=260, uniform="calarea")
        self.cal_main.grid_rowconfigure(0, weight=1)

        self.cal_grid_frame = ctk.CTkFrame(self.cal_main, fg_color=COLORS["surface"])
        self.cal_grid_frame.grid(row=0, column=0, sticky="nsew", padx=8, pady=8)
        self.cal_grid_frame.grid_columnconfigure(0, weight=1)
        self.cal_grid_frame.grid_rowconfigure(2, weight=1)

        self.cal_week_strip = ctk.CTkFrame(self.cal_grid_frame, fg_color="transparent")
        self.cal_week_strip.grid(row=0, column=0, sticky="ew", padx=8, pady=(4, 0))

        self.cal_nav = ctk.CTkFrame(self.cal_grid_frame, fg_color="transparent")
        self.cal_nav.grid(row=1, column=0, sticky="ew", padx=8, pady=8)
        self.cal_body = ctk.CTkFrame(self.cal_grid_frame, fg_color="transparent")
        self.cal_body.grid(row=2, column=0, sticky="nsew", padx=4, pady=4)

        self.cal_side = ctk.CTkFrame(self.cal_main, fg_color=COLORS["surface_elevated"], corner_radius=16, width=280)
        self.cal_side.grid(row=0, column=1, sticky="nsew", padx=8, pady=8)
        self.cal_side.grid_propagate(False)
        self.cal_side.grid_rowconfigure(1, weight=1)
        self.cal_side_hdr = ctk.CTkFrame(self.cal_side, fg_color=COLORS["accent"], corner_radius=12, height=56)
        self.cal_side_hdr.grid(row=0, column=0, sticky="ew", padx=10, pady=10)
        self.cal_side_hdr.grid_propagate(False)
        self.cal_side_lbl = ctk.CTkLabel(
            self.cal_side_hdr, text="Selecciona un día",
            font=font("subtitle"), text_color=COLORS["text_on_accent"],
        )
        self.cal_side_lbl.place(relx=0.5, rely=0.5, anchor="center")
        self.cal_side_list = ctk.CTkScrollableFrame(self.cal_side, fg_color="transparent")
        self.cal_side_list.grid(row=1, column=0, sticky="nsew", padx=8, pady=4)
        self.cal_add_btn = ctk.CTkButton(
            self.cal_side, text="+ Agregar tarea para este día",
            fg_color=COLORS["accent"], command=self._cal_add_task,
        )
        self.cal_add_btn.grid(row=2, column=0, sticky="ew", padx=12, pady=12)
        self._cal_selected_date: str | None = date.today().isoformat()
        self._cal_day_buttons: dict[str, ctk.CTkButton] = {}
        self._style_tabs()
        self._style_filters()
        self.after(80, self._style_chrome)

    def _style_chrome(self):
        self._style_tabs()
        self._style_filters()

    def _style_tabs(self):
        if not hasattr(self, "tabs"):
            return
        light = is_light_mode()
        self.tabs.configure(
            fg_color=COLORS["surface"],
            segmented_button_fg_color=COLORS["surface_elevated"],
            segmented_button_selected_color=COLORS["accent"] if not light else "#fca5a5",
            segmented_button_selected_hover_color=COLORS["accent_hover"] if not light else "#f87171",
            segmented_button_unselected_color=COLORS["tab_unselected"],
            segmented_button_unselected_hover_color=COLORS["nav_hover"],
            text_color=COLORS["text_on_accent"] if not light else COLORS["text"],
        )

    def _style_filters(self):
        if not hasattr(self, "agrup_m"):
            return
        light = is_light_mode()
        self.agrup_m.configure(
            fg_color=COLORS["surface_elevated"],
            selected_color=COLORS["accent"] if not light else "#fca5a5",
            selected_hover_color=COLORS["accent_hover"] if not light else "#f87171",
            unselected_color=COLORS["tab_unselected"],
            unselected_hover_color=COLORS["nav_hover"],
            text_color=COLORS["text_on_accent"] if not light else COLORS["text"],
        )

    def _active_tab(self) -> str:
        return self.tabs.get() if hasattr(self, "tabs") else "Lista"

    def _on_tab_change(self, *_args):
        tareas = self._tareas_cache
        if tareas is None:
            tareas = db.get_tareas()
            self._tareas_cache = tareas
        tab = self._active_tab()
        if tab == "Lista":
            self._refresh_lista(tareas)
        elif tab == "Matriz Foco":
            self._refresh_matriz(tareas)
        elif tab == "Calendario":
            self._refresh_cal(tareas)
            if self._cal_selected_date:
                self._update_cal_side(self._cal_selected_date)

    def on_new_day(self):
        hoy = date.today()
        self.cal_year = hoy.year
        self.cal_month = hoy.month
        self._cal_selected_date = hoy.isoformat()
        self.refresh(all_tabs=True)

    def _set_agrup(self, val):
        self.agrup = val
        tareas = self._tareas_cache or db.get_tareas()
        self._refresh_lista(tareas)

    def refresh(self, all_tabs: bool = False):
        db.auto_purga_completadas_diaria()
        tareas = db.get_tareas()
        self._tareas_cache = tareas
        if all_tabs:
            self._refresh_lista(tareas)
            self._refresh_matriz(tareas)
            self._refresh_cal(tareas)
        else:
            tab = self._active_tab()
            if tab == "Lista":
                self._refresh_lista(tareas)
            elif tab == "Matriz Foco":
                self._refresh_matriz(tareas)
            elif tab == "Calendario":
                self._refresh_cal(tareas)
        if self._cal_selected_date and (all_tabs or self._active_tab() == "Calendario"):
            self._update_cal_side(self._cal_selected_date)

    def _urgencia_color(self, fl: str | None) -> str:
        if not fl:
            return COLORS["green"]
        try:
            d = (date.fromisoformat(fl) - date.today()).days
            if d < 0:
                return COLORS["red"]
            if d <= 1:
                return COLORS["red"]
            if d <= 3:
                return COLORS["yellow"]
            return COLORS["green"]
        except ValueError:
            return COLORS["text_sec"]

    def _refresh_lista(self, tareas: list | None = None):
        for w in self.lista_scroll.winfo_children():
            w.destroy()
        if tareas is None:
            tareas = db.get_tareas()
        tareas = [t for t in tareas if t["estado"] != "completada"]
        hoy = date.today()

        if self.agrup == "Por Urgencia":
            fuego, importante, normal, backlog = [], [], [], []
            for t in tareas:
                fl = t.get("fecha_limite")
                pr = t.get("prioridad", "normal")
                if (fl and fl <= hoy.isoformat()) or pr == "urgente":
                    fuego.append(t)
                elif not fl:
                    backlog.append(t)
                elif pr == "importante":
                    importante.append(t)
                elif fl:
                    try:
                        if (date.fromisoformat(fl) - hoy).days <= 3:
                            importante.append(t)
                        else:
                            normal.append(t)
                    except ValueError:
                        normal.append(t)
                else:
                    normal.append(t)
            groups = {"🔴 FUEGO": fuego, "🟡 IMPORTANTE": importante, "🟢 NORMAL": normal, "📦 BACKLOG": backlog}
        elif self.agrup == "Por Curso":
            groups = {}
            for t in tareas:
                k = t.get("curso_nombre") or "Sin curso"
                groups.setdefault(k, []).append(t)
        elif self.agrup == "Por Tiempo":
            groups = {"Hoy": [], "Mañana": [], "Esta semana": [], "Próximas": [], "Sin fecha": []}
            for t in tareas:
                fl = t.get("fecha_limite")
                if not fl:
                    groups["Sin fecha"].append(t)
                elif fl == hoy.isoformat():
                    groups["Hoy"].append(t)
                elif fl == (hoy + timedelta(1)).isoformat():
                    groups["Mañana"].append(t)
                elif fl <= (hoy + timedelta(days=7 - hoy.weekday())).isoformat():
                    groups["Esta semana"].append(t)
                else:
                    groups["Próximas"].append(t)
        else:
            groups = {"Todas": tareas}

        total = sum(len(v) for v in groups.values())
        if not total:
            empty = ctk.CTkFrame(self.lista_scroll, fg_color=COLORS["surface_elevated"], corner_radius=12)
            empty.pack(fill="x", pady=24, padx=8)
            lbl(empty, "Sin tareas pendientes", style="title").pack(padx=20, pady=(20, 6))
            lbl(
                empty,
                "Pulsa «+ Nueva Tarea» para crear una o revisa el filtro activo.",
                style="muted",
            ).pack(padx=20, pady=(0, 20))
            return

        for title, items in groups.items():
            if not items:
                continue
            lbl(self.lista_scroll, title, style="section").pack(anchor="w", pady=(12, 4))
            for t in items:
                self._tarea_row(self.lista_scroll, t)

    def _tarea_row(self, parent, t: dict, compact: bool = False):
        vencida = t.get("fecha_limite") and t["fecha_limite"] < date.today().isoformat()
        completada = t.get("estado") == "completada"
        bg = COLORS["row_overdue"] if vencida else (COLORS["row_done"] if completada else COLORS["row_bg"])
        card = ctk.CTkFrame(parent, fg_color=bg, corner_radius=8, height=48 if compact else 52)
        card.pack(fill="x", pady=2)
        card.pack_propagate(False)

        stripe = ctk.CTkFrame(card, width=4, fg_color=safe_color(t.get("curso_color"), COLORS["accent"]))
        stripe.pack(side="left", fill="y")

        body = ctk.CTkFrame(card, fg_color="transparent")
        body.pack(side="left", fill="both", expand=True, padx=(8, 4), pady=4)

        row1 = ctk.CTkFrame(body, fg_color="transparent")
        row1.pack(fill="x")
        ctk.CTkLabel(
            row1, text=t["titulo"],
            font=font("subtitle"),
            text_color=COLORS["text"],
            anchor="w",
        ).pack(side="left")

        pr = PRIORIDAD_LABELS.get(t.get("prioridad", "normal"), "🟢 NORMAL")
        fl = t.get("fecha_limite") or "Sin fecha"
        curso = t.get("curso_nombre") or "—"
        rec = " ⏰" if t.get("recordatorio") else ""
        meta = f"{pr} | 📅 {fl} | {t.get('duracion_min', 30)}m | {curso}{rec}"
        if completada:
            meta = f"✅ Completada | {meta}"
        ctk.CTkLabel(
            body, text=meta,
            text_color=COLORS["text_sec"], font=ctk.CTkFont(size=10),
            anchor="w",
        ).pack(anchor="w")
        if vencida and not completada:
            ctk.CTkLabel(body, text="VENCIDA", text_color=COLORS["red"], font=ctk.CTkFont(size=9, weight="bold")).pack(anchor="w")

        if not completada:
            btns = ctk.CTkFrame(card, fg_color="transparent")
            btns.pack(side="right", padx=4, pady=4)
            self._action_btn(btns, "TB", BTN_TB, lambda task=t: self._to_tb(task))
            self._action_btn(btns, "✓", BTN_DONE, lambda task=t: self._done(task))
            self._action_btn(btns, "✏", BTN_EDIT, lambda task=t: self._modal_tarea(task))
            self._action_btn(btns, "✕", BTN_DEL, lambda task=t: self._del(task))

    def _action_btn(self, parent, text, color, command):
        ctk.CTkButton(
            parent, text=text, width=32, height=28,
            fg_color=color, hover_color=color,
            text_color=COLORS["text_on_accent"],
            font=font("badge"),
            command=command,
        ).pack(side="left", padx=2)

    def _clasificar_matriz(self, t: dict) -> str:
        if t.get("estado") == "completada":
            return "despues"
        hoy = date.today()
        fl = t.get("fecha_limite")
        pr = t.get("prioridad", "normal")
        if (fl and fl < hoy.isoformat()) or pr == "urgente":
            return "critico"
        if fl:
            try:
                d = date.fromisoformat(fl)
                delta = (d - hoy).days
                if delta <= 1:
                    return "hoy"
                if delta <= 7:
                    return "semana"
            except ValueError:
                pass
        if not fl:
            return "despues"
        return "despues"

    def _refresh_matriz(self, tareas: list | None = None):
        lane_items: dict[str, list] = {k: [] for k in self.matriz_lanes}
        if tareas is None:
            tareas = db.get_tareas()
        for t in tareas:
            if t.get("estado") == "completada":
                continue
            lane_items[self._clasificar_matriz(t)].append(t)
        for key, lane in self.matriz_lanes.items():
            for w in lane.winfo_children():
                w.destroy()
            items = lane_items[key]
            if key in self.matriz_counts:
                self.matriz_counts[key].configure(text=str(len(items)))
            if not items:
                lbl(
                    lane, "Sin tareas aquí",
                    style="muted",
                ).pack(pady=20, padx=8)
                continue
            for t in items:
                self._matriz_card(lane, t)

    def _matriz_card(self, parent, t: dict):
        urg = self._urgencia_color(t.get("fecha_limite"))
        curso_c = safe_color(t.get("curso_color"), COLORS["accent"])
        card = ctk.CTkFrame(
            parent, fg_color=COLORS["surface"], corner_radius=12,
            border_width=2, border_color=urg,
        )
        card.pack(fill="x", pady=5, padx=2)
        stripe = ctk.CTkFrame(card, height=4, fg_color=curso_c, corner_radius=0)
        stripe.pack(fill="x")
        body = ctk.CTkFrame(card, fg_color="transparent")
        body.pack(fill="x", padx=10, pady=8)
        ctk.CTkLabel(
            body, text=t["titulo"], font=font("subtitle"),
            text_color=COLORS["text"], wraplength=220, anchor="w",
        ).pack(anchor="w")
        fl = t.get("fecha_limite") or "Sin fecha"
        meta_row = ctk.CTkFrame(body, fg_color="transparent")
        meta_row.pack(fill="x", pady=(4, 0))
        ctk.CTkLabel(
            meta_row, text=PRIORIDAD_LABELS.get(t.get("prioridad", "normal"), ""),
            font=font("small"), text_color=urg,
        ).pack(side="left")
        ctk.CTkLabel(
            meta_row, text=f"📅 {fl}",
            font=font("small"), text_color=COLORS["text_sec"],
        ).pack(side="left", padx=8)
        ctk.CTkLabel(
            body, text=f"📚 {t.get('curso_nombre') or '—'} · {t.get('duracion_min', 30)}m",
            text_color=COLORS["text_sec"], font=font("small"), anchor="w",
        ).pack(anchor="w", pady=(2, 0))
        bf = ctk.CTkFrame(card, fg_color=COLORS["surface_elevated"], corner_radius=8)
        bf.pack(fill="x", padx=8, pady=(0, 8))
        self._action_btn(bf, "✓", BTN_DONE, lambda task=t: self._done(task))
        self._action_btn(bf, "TB", BTN_TB, lambda task=t: self._to_tb(task))
        self._action_btn(bf, "✏", BTN_EDIT, lambda task=t: self._modal_tarea(task))

    def _refresh_cal(self, tareas: list | None = None):
        for w in self.cal_body.winfo_children():
            w.destroy()
        for w in self.cal_week_strip.winfo_children():
            w.destroy()
        self._cal_day_buttons.clear()

        if not self.cal_nav.winfo_children():
            ctk.CTkButton(self.cal_nav, text="◀", width=40, fg_color=COLORS["accent2"], command=self._cal_prev).pack(side="left")
            self.cal_month_lbl = lbl(self.cal_nav, "", style="title")
            self.cal_month_lbl.pack(side="left", expand=True)
            ctk.CTkButton(self.cal_nav, text="Hoy", width=56, fg_color=COLORS["accent"], command=self._cal_today).pack(side="left", padx=4)
            ctk.CTkButton(self.cal_nav, text="▶", width=40, fg_color=COLORS["accent2"], command=self._cal_next).pack(side="right")
        self.cal_month_lbl.configure(text=f"{calendar.month_name[self.cal_month]} {self.cal_year}")

        # Franja semanal rápida
        hoy = date.today()
        lunes = hoy - timedelta(days=hoy.weekday())
        if tareas is None:
            tareas = db.get_tareas()
        by_day: dict[str, list] = {}
        for t in tareas:
            if t.get("fecha_limite") and t["estado"] != "completada":
                by_day.setdefault(t["fecha_limite"], []).append(t)
        for i in range(7):
            d = lunes + timedelta(days=i)
            d_str = d.isoformat()
            cnt = len(by_day.get(d_str, []))
            is_today = d == hoy
            is_sel = d_str == self._cal_selected_date
            fg = COLORS["accent"] if is_today else (COLORS["accent2"] if is_sel else COLORS["surface_elevated"])
            txt = f"{d.strftime('%a')}\n{d.day}"
            if cnt:
                txt += f"\n●{cnt}"
            ctk.CTkButton(
                self.cal_week_strip, text=txt, width=72, height=64,
                fg_color=fg, font=font("badge"),
                text_color=COLORS["text_on_accent"] if fg in (COLORS["accent"], COLORS["accent2"]) else COLORS["text"],
                command=lambda ds=d_str: self._cal_select(ds),
            ).pack(side="left", padx=2, pady=4)

        grid = ctk.CTkFrame(self.cal_body, fg_color=COLORS["surface_elevated"], corner_radius=12)
        grid.pack(fill="both", expand=True, padx=4, pady=4)
        inner = ctk.CTkFrame(grid, fg_color="transparent")
        inner.pack(fill="both", expand=True, padx=8, pady=8)
        for c in range(7):
            inner.grid_columnconfigure(c, weight=1, uniform="calcol", minsize=72)
        for r in range(7):
            inner.grid_rowconfigure(r, weight=1, uniform="calrow", minsize=62)

        dias_hdr = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
        for i, d in enumerate(dias_hdr):
            ctk.CTkLabel(
                inner, text=d, font=font("badge"),
                text_color=COLORS["accent2"],
            ).grid(row=0, column=i, sticky="nsew", padx=2, pady=2)

        cal = calendar.Calendar(firstweekday=0)
        for ri, week in enumerate(cal.monthdayscalendar(self.cal_year, self.cal_month), 1):
            for ci, day in enumerate(week):
                if day == 0:
                    ctk.CTkFrame(inner, fg_color="transparent", height=62).grid(
                        row=ri, column=ci, sticky="nsew", padx=2, pady=2,
                    )
                    continue
                d_str = date(self.cal_year, self.cal_month, day).isoformat()
                cnt = len(by_day.get(d_str, []))
                btn = self._make_cal_day_btn(inner, day, d_str, cnt, by_day.get(d_str, []), ri, ci)
                self._cal_day_buttons[d_str] = btn

    def _cal_today(self):
        hoy = date.today()
        self.cal_year, self.cal_month = hoy.year, hoy.month
        self._cal_select(hoy.isoformat())
        tareas = self._tareas_cache or db.get_tareas()
        self._refresh_cal(tareas)

    def _make_cal_day_btn(self, grid, day: int, d_str: str, cnt: int, tareas_dia: list, row: int, col: int) -> ctk.CTkButton:
        is_today = d_str == date.today().isoformat()
        is_sel = d_str == self._cal_selected_date
        if cnt >= 3:
            bg = COLORS["cal_busy_3"]
        elif cnt >= 1:
            bg = COLORS["cal_busy_1"]
        else:
            bg = COLORS["surface"]
        if is_today:
            bg = COLORS["accent"]
        border = COLORS["accent2"] if is_sel else COLORS["border"]
        bw = 3 if is_sel else 1
        txt_color = COLORS["text_on_accent"] if (is_today or bg in (COLORS["accent"], COLORS["accent2"])) else COLORS["text"]

        urgente = any(t.get("prioridad") == "urgente" for t in tareas_dia)
        dots = ""
        if cnt:
            dot_color = "🔴" if urgente else "🟢"
            dots = f"\n{dot_color} {cnt}"

        btn = ctk.CTkButton(
            grid, text=f"{day}{dots}",
            font=font("body"),
            fg_color=bg, hover_color=COLORS["accent2"],
            text_color=txt_color,
            border_width=bw, border_color=border,
            height=62, corner_radius=10,
            command=lambda ds=d_str: self._cal_select(ds),
        )
        btn.grid(row=row, column=col, sticky="nsew", padx=3, pady=3)
        return btn

    def _update_cal_side(self, d_str: str):
        d = date.fromisoformat(d_str)
        self.cal_side_lbl.configure(text=d.strftime("%A %d/%m/%Y").capitalize())
        tareas = db.get_tareas_por_fecha(d_str, incluir_completadas=True)
        pendientes = [t for t in tareas if t["estado"] != "completada"]
        completadas = [t for t in tareas if t["estado"] == "completada"]
        self.cal_side_hdr.configure(
            fg_color=COLORS["red"] if any(
                t.get("prioridad") == "urgente" for t in pendientes
            ) else COLORS["accent"],
        )
        for w in self.cal_side_list.winfo_children():
            w.destroy()
        if not tareas:
            ctk.CTkLabel(
                self.cal_side_list, text="Sin tareas este día",
                text_color=COLORS["text_sec"],
            ).pack(anchor="w", pady=8)
        for t in pendientes:
            self._tarea_row(self.cal_side_list, t, compact=True)
        if completadas:
            lbl(
                self.cal_side_list, "Completadas",
                style="muted",
            ).pack(anchor="w", pady=(8, 2))
            for t in completadas:
                self._tarea_row(self.cal_side_list, t, compact=True)

    def _highlight_cal_selection(self):
        for d_str, btn in self._cal_day_buttons.items():
            is_sel = d_str == self._cal_selected_date
            is_today = d_str == date.today().isoformat()
            btn.configure(
                border_width=3 if is_sel else 1,
                border_color=COLORS["accent2"] if is_sel else COLORS["border"],
            )
            if is_today and not is_sel:
                btn.configure(fg_color=COLORS["accent"])

    def _cal_prev(self):
        self.cal_month -= 1
        if self.cal_month < 1:
            self.cal_month, self.cal_year = 12, self.cal_year - 1
        tareas = self._tareas_cache or db.get_tareas()
        self._refresh_cal(tareas)

    def _cal_next(self):
        self.cal_month += 1
        if self.cal_month > 12:
            self.cal_month, self.cal_year = 1, self.cal_year + 1
        tareas = self._tareas_cache or db.get_tareas()
        self._refresh_cal(tareas)

    def _cal_select(self, d_str: str):
        self._cal_selected_date = d_str
        self._update_cal_side(d_str)
        self._highlight_cal_selection()

    def _cal_add_task(self):
        if self._cal_selected_date:
            self._modal_tarea(fecha_pre=self._cal_selected_date)
        else:
            messagebox.showinfo("Calendario", "Selecciona un día primero")

    def _purgar_completadas(self):
        n = db.contar_tareas_completadas()
        if n == 0:
            messagebox.showinfo("Matriz Foco", "No hay tareas completadas para purgar")
            return
        if messagebox.askyesno("Purgar", f"¿Eliminar {n} tarea(s) completada(s)?"):
            db.purgar_tareas_completadas()
            self.refresh()
            self.app.update_badges()
            messagebox.showinfo("Matriz Foco", f"{n} tarea(s) purgada(s)")

    def _to_tb(self, t: dict):
        now = datetime.now()
        h, m = now.hour, ((now.minute // 30) + 1) * 30
        if m >= 60:
            h, m = h + 1, 0
        hi = f"{h:02d}:{m:02d}:00"
        hf = (datetime.strptime(hi, "%H:%M:%S") + timedelta(minutes=TB_SLOT_MIN)).strftime("%H:%M:%S")
        db.crear_bloque(fecha=date.today().isoformat(), hora_inicio=hi, hora_fin=hf,
                        titulo=t["titulo"], tarea_id=t["id"], curso_id=t.get("curso_id"), tipo="tarea")
        self.app.navigate("timeblocking")

    def _done(self, t: dict):
        db.completar_tarea(t["id"])
        self.refresh()
        self.app.update_badges()

    def _del(self, t: dict):
        if messagebox.askyesno("Eliminar", "¿Eliminar tarea?"):
            db.eliminar_tarea(t["id"])
            self.refresh()
            self.app.update_badges()

    def _modal_tarea(self, tarea: dict | None = None, fecha_pre: str | None = None):
        m = ctk.CTkToplevel(self)
        m.title("Editar Tarea" if tarea else "Nueva Tarea")
        m.geometry("720x640")
        m.minsize(680, 580)
        m.grab_set()
        m.configure(fg_color=COLORS["bg"])

        root = ctk.CTkFrame(m, fg_color=COLORS["bg"])
        root.pack(fill="both", expand=True)
        root.grid_columnconfigure(1, weight=1)
        root.grid_rowconfigure(0, weight=1)

        # Barra lateral con acciones
        sidebar = ctk.CTkFrame(root, width=160, fg_color=COLORS["surface_elevated"], corner_radius=0)
        sidebar.grid(row=0, column=0, sticky="ns")
        sidebar.grid_propagate(False)
        ctk.CTkLabel(
            sidebar, text="TAREA",
            font=font("title"),
            text_color=COLORS["accent"],
        ).pack(pady=(24, 20))

        form = ctk.CTkScrollableFrame(root, fg_color=COLORS["surface"], corner_radius=12)
        form.grid(row=0, column=1, sticky="nsew", padx=(0, 12), pady=12)

        lbl(form, "Título", style="section").pack(anchor="w", padx=16, pady=(16, 2))
        te = styled_entry(form, width=480, height=36)
        te.pack(padx=16, anchor="w")
        if tarea:
            te.insert(0, tarea["titulo"])

        cursos = db.get_cursos()
        lbl(form, "Curso").pack(anchor="w", padx=16, pady=(8, 2))
        curso_m = styled_option(form, values=["Ninguno"] + [c["nombre"] for c in cursos], width=480)
        curso_m.pack(padx=16, anchor="w")

        lbl(form, "Unidad").pack(anchor="w", padx=16, pady=(8, 2))
        unidad_m = styled_option(form, values=["Ninguna"], width=480)
        unidad_m.pack(padx=16, anchor="w")

        def upd_unidades(*_):
            unids = []
            if curso_m.get() != "Ninguno":
                cid = next(c["id"] for c in cursos if c["nombre"] == curso_m.get())
                unids = [u["nombre"] for u in db.get_unidades(cid)]
            unidad_m.configure(values=["Ninguna"] + unids)

        curso_m.configure(command=lambda v: upd_unidades())

        lbl(form, "Tipo").pack(anchor="w", padx=16, pady=(8, 2))
        tipo_m = styled_option(form, values=[t.capitalize() for t in TIPOS_TAREA], width=480)
        tipo_m.pack(padx=16, anchor="w")

        fecha_val = [tarea.get("fecha_limite") if tarea else fecha_pre]
        lbl(form, "Fecha límite").pack(anchor="w", padx=16, pady=(8, 2))
        fecha_lbl = ctk.CTkLabel(form, text=fecha_val[0] or "Sin fecha", text_color=COLORS["accent"])
        fecha_lbl.pack(anchor="w", padx=16)
        ctk.CTkButton(form, text="📅 Elegir fecha", width=140, command=lambda: DatePicker(
            m, lambda d: (fecha_val.__setitem__(0, d), fecha_lbl.configure(text=d))
        )).pack(anchor="w", padx=16, pady=4)

        hora_sel = TimeSelector(form, "Hora límite")
        hora_sel.pack(anchor="w", padx=16, pady=4)

        lbl(form, "Duración (min)").pack(anchor="w", padx=16, pady=(8, 2))
        dur_slider = ctk.CTkSlider(form, from_=15, to=240, number_of_steps=15, width=480)
        dur_slider.pack(padx=16, anchor="w")
        dur_slider.set(tarea.get("duracion_min", 30) if tarea else 30)
        dur_lbl = lbl(form, "30 min", style="muted")
        dur_lbl.pack(anchor="w", padx=16)
        dur_slider.configure(command=lambda v: dur_lbl.configure(text=f"{int(v)} min"))

        lbl(form, "Prioridad").pack(anchor="w", padx=16, pady=(8, 2))
        prior_f = ctk.CTkFrame(form, fg_color="transparent")
        prior_f.pack(padx=16, anchor="w")
        prior_val = [tarea.get("prioridad", "normal") if tarea else "normal"]
        for p, prior_lbl in PRIORIDAD_LABELS.items():
            ctk.CTkButton(
                prior_f, text=prior_lbl, width=120, fg_color=PRIORIDAD_COLORS[p],
                text_color=COLORS["text_on_accent"],
                command=lambda pv=p: prior_val.__setitem__(0, pv),
            ).pack(side="left", padx=3)

        recurrente_var = ctk.BooleanVar(value=bool(tarea.get("recurrente")) if tarea else False)
        styled_switch(form, text="Recurrente", variable=recurrente_var).pack(anchor="w", padx=16, pady=4)

        lbl(form, "⏰ Recordatorio (alarma)", style="section").pack(
            anchor="w", padx=16, pady=(8, 2),
        )
        recordatorio_var = ctk.BooleanVar(value=bool(tarea.get("recordatorio")) if tarea else False)
        styled_switch(form, text="Activar recordatorio", variable=recordatorio_var).pack(anchor="w", padx=16)
        rec_hora = TimeSelector(form, "Hora del recordatorio")
        rec_hora.pack(anchor="w", padx=16, pady=4)
        if tarea and tarea.get("recordatorio_hora"):
            rec_hora.set(tarea["recordatorio_hora"])
        elif tarea and tarea.get("hora_limite"):
            rec_hora.set(tarea["hora_limite"])
        ctk.CTkLabel(
            form, text="Se integra con Riesgo y Alarmas el día de la fecha límite",
            text_color=COLORS["text_sec"], font=ctk.CTkFont(size=10),
        ).pack(anchor="w", padx=16, pady=(0, 4))

        lbl(form, "Notas").pack(anchor="w", padx=16)
        ne = ctk.CTkTextbox(
            form, width=480, height=80,
            fg_color=COLORS["input_bg"], text_color=COLORS["text"],
            border_color=COLORS["border"], border_width=2,
        )
        ne.pack(padx=16, pady=(4, 20), anchor="w")

        def save():
            titulo = te.get().strip()
            if not titulo:
                messagebox.showwarning("Tarea", "El título es obligatorio")
                return
            curso_id = unidad_id = None
            if curso_m.get() != "Ninguno":
                curso_id = next(c["id"] for c in cursos if c["nombre"] == curso_m.get())
                if unidad_m.get() != "Ninguna":
                    unidad_id = next(u["id"] for u in db.get_unidades(curso_id) if u["nombre"] == unidad_m.get())
            data = dict(
                titulo=titulo, curso_id=curso_id, unidad_id=unidad_id,
                tipo=tipo_m.get().lower(), fecha_limite=fecha_val[0],
                hora_limite=hora_sel.get(), duracion_min=int(dur_slider.get()),
                prioridad=prior_val[0], recurrente=int(recurrente_var.get()),
                recordatorio=int(recordatorio_var.get()),
                recordatorio_hora=rec_hora.get() if recordatorio_var.get() else None,
                notas=ne.get("1.0", "end").strip(),
            )
            if tarea:
                db.actualizar_tarea(tarea["id"], **data)
            else:
                db.crear_tarea(**data)
            m.destroy()
            self.refresh()
            self.app.update_badges()

        ctk.CTkButton(
            sidebar, text="✅\nACEPTAR", height=72, width=130,
            font=ctk.CTkFont(size=14, weight="bold"),
            fg_color=COLORS["green"], hover_color="#00a383",
            command=save,
        ).pack(pady=8, padx=12)
        ctk.CTkButton(
            sidebar, text="💾\nGUARDAR", height=56, width=130,
            fg_color=COLORS["accent"], command=save,
        ).pack(pady=4, padx=12)
        ctk.CTkButton(
            sidebar, text="✕\nCancelar", height=56, width=130,
            fg_color=COLORS["surface"], hover_color=COLORS["border"],
            text_color=COLORS["text"],
            command=m.destroy,
        ).pack(pady=4, padx=12)

    def _sugerencia(self):
        self.ai.set_api_key(db.get_ai_api_key())
        tareas = [t for t in db.get_tareas() if t["estado"] != "completada"]
        done, total, _ = db.progreso_dia(date.today().isoformat())
        hrs = max(1, (total - done) * 0.5)
        local = self.ai.priorizar_tareas_local(tareas, hrs)

        dlg = ctk.CTkToplevel(self)
        dlg.title("Sugerencia IA")
        dlg.geometry("560x420")
        dlg.minsize(480, 320)
        dlg.grab_set()
        dlg.configure(fg_color=COLORS["bg"])
        lbl(dlg, "🤖 Sugerencia de prioridades", style="title").pack(anchor="w", padx=16, pady=(16, 8))
        box = ctk.CTkTextbox(
            dlg, fg_color=COLORS["surface"], text_color=COLORS["text"],
            border_color=COLORS["border"], border_width=1,
        )
        box.pack(fill="both", expand=True, padx=16, pady=(0, 8))
        box.insert("1.0", local)
        status = lbl(dlg, "", style="muted")
        status.pack(anchor="w", padx=16, pady=(0, 4))

        btn_row = ctk.CTkFrame(dlg, fg_color="transparent")
        btn_row.pack(fill="x", padx=16, pady=(0, 16))

        def close_dlg():
            dlg.destroy()

        ctk.CTkButton(btn_row, text="Cerrar", fg_color=COLORS["surface_elevated"], text_color=COLORS["text"], command=close_dlg).pack(side="right")

        if not self.ai.api_key:
            status.configure(text="Sugerencia instantánea (sin API). Configura DeepSeek para refinar con IA.")
            return

        status.configure(text="Refinando con DeepSeek en segundo plano…")
        box.configure(state="disabled")

        def on_ai(msg: str):
            if not dlg.winfo_exists():
                return
            box.configure(state="normal")
            box.delete("1.0", "end")
            box.insert("1.0", local + "\n\n── Refinado con IA ──\n" + msg[:2000])
            status.configure(text="Listo — combinado con sugerencia rápida local.")

        def on_err(err: Exception):
            if not dlg.winfo_exists():
                return
            box.configure(state="normal")
            status.configure(text=f"IA no disponible: {err}. Se muestra solo la sugerencia rápida.")

        self.ai.run_async(
            dlg,
            lambda: self.ai.priorizar_tareas(tareas, hrs),
            on_ai,
            on_err,
        )
