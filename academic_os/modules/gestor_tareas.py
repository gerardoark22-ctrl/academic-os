"""Gestor de Tareas — Academic OS v2."""

import calendar
from datetime import date, datetime, timedelta

import customtkinter as ctk
from tkinter import messagebox

import database as db
from ai.openai_client import AcademicAI
from config import COLORS, PRIORIDAD_COLORS, PRIORIDAD_LABELS, TB_SLOT_MIN, TIPOS_TAREA
from modules.components import DatePicker, TimeSelector, safe_color

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
        self._drag_data: dict = {}  # legacy, no usado en Matriz Foco
        self._build()
        self.refresh()

    def _build(self):
        hdr = ctk.CTkFrame(self, fg_color=COLORS["surface"], corner_radius=0)
        hdr.pack(fill="x")
        top = ctk.CTkFrame(hdr, fg_color="transparent")
        top.pack(fill="x", padx=16, pady=12)
        ctk.CTkLabel(top, text="📋 GESTOR DE TAREAS", font=ctk.CTkFont(size=22, weight="bold")).pack(side="left")
        ctk.CTkButton(top, text="+ Nueva Tarea", fg_color=COLORS["accent"], command=self._modal_tarea).pack(side="right", padx=4)
        ctk.CTkButton(top, text="🤖 Sugerencia IA", fg_color=COLORS["accent2"], command=self._sugerencia).pack(side="right", padx=4)

        filt = ctk.CTkFrame(hdr, fg_color="transparent")
        filt.pack(fill="x", padx=16, pady=(0, 12))
        self.agrup_m = ctk.CTkSegmentedButton(filt, values=self.AGRUPAMIENTOS, command=self._set_agrup)
        self.agrup_m.pack(side="left")
        self.agrup_m.set(self.agrup)

        self.tabs = ctk.CTkTabview(self, fg_color=COLORS["surface"])
        self.tabs.pack(fill="both", expand=True, padx=12, pady=12)
        self.tab_lista = self.tabs.add("Lista")
        self.tab_matriz = self.tabs.add("Matriz Foco")
        self.tab_cal = self.tabs.add("Calendario")

        self.lista_scroll = ctk.CTkScrollableFrame(self.tab_lista, fg_color=COLORS["bg"])
        self.lista_scroll.pack(fill="both", expand=True)

        # Matriz de Foco — 4 cuadrantes por urgencia temporal (reemplaza Kanban)
        self.matriz = ctk.CTkFrame(self.tab_matriz, fg_color=COLORS["bg"])
        self.matriz.pack(fill="both", expand=True)
        self.matriz.grid_rowconfigure(0, weight=1)
        self.matriz.grid_rowconfigure(1, weight=1)
        self.matriz.grid_columnconfigure(0, weight=1)
        self.matriz.grid_columnconfigure(1, weight=1)
        self.matriz_lanes: dict[str, ctk.CTkScrollableFrame] = {}
        lanes = [
            ("critico", "🔴 CRÍTICO\n(vencidas / urgentes)", COLORS["red"], 0, 0),
            ("hoy", "🟠 HOY Y MAÑANA", COLORS["orange"], 0, 1),
            ("semana", "🔵 ESTA SEMANA", COLORS["blue"], 1, 0),
            ("despues", "⚪ DESPUÉS / SIN FECHA", COLORS["surface_elevated"], 1, 1),
        ]
        for key, title, bg, row, col in lanes:
            cell = ctk.CTkFrame(self.matriz, fg_color=bg, corner_radius=14)
            cell.grid(row=row, column=col, sticky="nsew", padx=6, pady=6)
            hdr = ctk.CTkFrame(cell, fg_color="transparent")
            hdr.pack(fill="x", padx=8, pady=(10, 4))
            ctk.CTkLabel(hdr, text=title, font=ctk.CTkFont(size=12, weight="bold")).pack(side="left")
            if key == "critico":
                ctk.CTkButton(
                    hdr, text="🗑️ Purgar hechas", width=100, height=24,
                    font=ctk.CTkFont(size=10), fg_color=COLORS["red"],
                    command=self._purgar_completadas,
                ).pack(side="right")
            sf = ctk.CTkScrollableFrame(cell, fg_color="transparent")
            sf.pack(fill="both", expand=True, padx=6, pady=6)
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
            font=ctk.CTkFont(size=14, weight="bold"),
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

    def _set_agrup(self, val):
        self.agrup = val
        self._refresh_lista()

    def refresh(self):
        db.auto_purga_completadas_diaria()
        self._refresh_lista()
        self._refresh_matriz()
        self._refresh_cal()
        if self._cal_selected_date:
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

    def _refresh_lista(self):
        for w in self.lista_scroll.winfo_children():
            w.destroy()
        tareas = [t for t in db.get_tareas() if t["estado"] != "completada"]
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

        for title, items in groups.items():
            if not items:
                continue
            ctk.CTkLabel(self.lista_scroll, text=title, font=ctk.CTkFont(size=15, weight="bold")).pack(anchor="w", pady=(12, 4))
            for t in items:
                self._tarea_row(self.lista_scroll, t)

    def _tarea_row(self, parent, t: dict, compact: bool = False):
        vencida = t.get("fecha_limite") and t["fecha_limite"] < date.today().isoformat()
        completada = t.get("estado") == "completada"
        bg = "#2a1515" if vencida else ("#1a2a1a" if completada else COLORS["surface_elevated"])
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
            font=ctk.CTkFont(size=13, weight="bold"),
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
            font=ctk.CTkFont(size=11, weight="bold"),
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

    def _refresh_matriz(self):
        for lane in self.matriz_lanes.values():
            for w in lane.winfo_children():
                w.destroy()
        for t in db.get_tareas():
            if t.get("estado") == "completada":
                continue
            lane_key = self._clasificar_matriz(t)
            self._matriz_card(self.matriz_lanes[lane_key], t)

    def _matriz_card(self, parent, t: dict):
        urg = self._urgencia_color(t.get("fecha_limite"))
        card = ctk.CTkFrame(
            parent, fg_color=COLORS["surface"], corner_radius=10,
            border_width=2, border_color=urg,
        )
        card.pack(fill="x", pady=4, padx=2)
        top = ctk.CTkFrame(card, height=3, fg_color=safe_color(t.get("curso_color"), COLORS["accent"]))
        top.pack(fill="x")
        body = ctk.CTkFrame(card, fg_color="transparent")
        body.pack(fill="x", padx=8, pady=8)
        ctk.CTkLabel(
            body, text=t["titulo"], font=ctk.CTkFont(size=12, weight="bold"),
            wraplength=200, anchor="w",
        ).pack(anchor="w")
        fl = t.get("fecha_limite") or "Sin fecha"
        ctk.CTkLabel(
            body, text=f"{PRIORIDAD_LABELS.get(t.get('prioridad','normal'), '')} · 📅 {fl}",
            font=ctk.CTkFont(size=10), text_color=urg,
        ).pack(anchor="w")
        curso = t.get("curso_nombre") or "—"
        ctk.CTkLabel(body, text=f"📚 {curso} · {t.get('duracion_min', 30)}m", text_color=COLORS["text_sec"], font=ctk.CTkFont(size=9)).pack(anchor="w")
        bf = ctk.CTkFrame(card, fg_color="transparent")
        bf.pack(fill="x", padx=6, pady=(0, 6))
        self._action_btn(bf, "✓", BTN_DONE, lambda task=t: self._done(task))
        self._action_btn(bf, "TB", BTN_TB, lambda task=t: self._to_tb(task))
        self._action_btn(bf, "✏", BTN_EDIT, lambda task=t: self._modal_tarea(task))

    def _refresh_cal(self):
        for w in self.cal_body.winfo_children():
            w.destroy()
        for w in self.cal_week_strip.winfo_children():
            w.destroy()
        self._cal_day_buttons.clear()

        if not self.cal_nav.winfo_children():
            ctk.CTkButton(self.cal_nav, text="◀", width=40, fg_color=COLORS["accent2"], command=self._cal_prev).pack(side="left")
            self.cal_month_lbl = ctk.CTkLabel(
                self.cal_nav, text="",
                font=ctk.CTkFont(size=20, weight="bold"),
            )
            self.cal_month_lbl.pack(side="left", expand=True)
            ctk.CTkButton(self.cal_nav, text="Hoy", width=56, fg_color=COLORS["accent"], command=self._cal_today).pack(side="left", padx=4)
            ctk.CTkButton(self.cal_nav, text="▶", width=40, fg_color=COLORS["accent2"], command=self._cal_next).pack(side="right")
        self.cal_month_lbl.configure(text=f"{calendar.month_name[self.cal_month]} {self.cal_year}")

        # Franja semanal rápida
        hoy = date.today()
        lunes = hoy - timedelta(days=hoy.weekday())
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
                fg_color=fg, font=ctk.CTkFont(size=10, weight="bold"),
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
                inner, text=d, font=ctk.CTkFont(size=11, weight="bold"),
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
        self._refresh_cal()

    def _make_cal_day_btn(self, grid, day: int, d_str: str, cnt: int, tareas_dia: list, row: int, col: int) -> ctk.CTkButton:
        is_today = d_str == date.today().isoformat()
        is_sel = d_str == self._cal_selected_date
        if cnt >= 3:
            bg = "#1a2a3d"
        elif cnt >= 1:
            bg = "#152a20"
        else:
            bg = COLORS["surface"]
        if is_today:
            bg = COLORS["accent"]
        border = COLORS["accent2"] if is_sel else COLORS["border"]
        bw = 3 if is_sel else 1

        urgente = any(t.get("prioridad") == "urgente" for t in tareas_dia)
        dots = ""
        if cnt:
            dot_color = "🔴" if urgente else "🟢"
            dots = f"\n{dot_color} {cnt}"

        btn = ctk.CTkButton(
            grid, text=f"{day}{dots}",
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color=bg, hover_color=COLORS["accent2"],
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
            ctk.CTkLabel(
                self.cal_side_list, text="Completadas",
                font=ctk.CTkFont(size=11, weight="bold"),
                text_color=COLORS["text_sec"],
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
        self._refresh_cal()

    def _cal_next(self):
        self.cal_month += 1
        if self.cal_month > 12:
            self.cal_month, self.cal_year = 1, self.cal_year + 1
        self._refresh_cal()

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
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color=COLORS["accent"],
        ).pack(pady=(24, 20))

        form = ctk.CTkScrollableFrame(root, fg_color=COLORS["surface"], corner_radius=12)
        form.grid(row=0, column=1, sticky="nsew", padx=(0, 12), pady=12)

        ctk.CTkLabel(form, text="Título", font=ctk.CTkFont(size=14, weight="bold")).pack(anchor="w", padx=16, pady=(16, 2))
        te = ctk.CTkEntry(form, width=480, height=36)
        te.pack(padx=16, anchor="w")
        if tarea:
            te.insert(0, tarea["titulo"])

        cursos = db.get_cursos()
        ctk.CTkLabel(form, text="Curso").pack(anchor="w", padx=16, pady=(8, 2))
        curso_m = ctk.CTkOptionMenu(form, values=["Ninguno"] + [c["nombre"] for c in cursos], width=480)
        curso_m.pack(padx=16, anchor="w")

        ctk.CTkLabel(form, text="Unidad").pack(anchor="w", padx=16, pady=(8, 2))
        unidad_m = ctk.CTkOptionMenu(form, values=["Ninguna"], width=480)
        unidad_m.pack(padx=16, anchor="w")

        def upd_unidades(*_):
            unids = []
            if curso_m.get() != "Ninguno":
                cid = next(c["id"] for c in cursos if c["nombre"] == curso_m.get())
                unids = [u["nombre"] for u in db.get_unidades(cid)]
            unidad_m.configure(values=["Ninguna"] + unids)

        curso_m.configure(command=lambda v: upd_unidades())

        ctk.CTkLabel(form, text="Tipo").pack(anchor="w", padx=16, pady=(8, 2))
        tipo_m = ctk.CTkOptionMenu(form, values=[t.capitalize() for t in TIPOS_TAREA], width=480)
        tipo_m.pack(padx=16, anchor="w")

        fecha_val = [tarea.get("fecha_limite") if tarea else fecha_pre]
        ctk.CTkLabel(form, text="Fecha límite").pack(anchor="w", padx=16, pady=(8, 2))
        fecha_lbl = ctk.CTkLabel(form, text=fecha_val[0] or "Sin fecha", text_color=COLORS["accent"])
        fecha_lbl.pack(anchor="w", padx=16)
        ctk.CTkButton(form, text="📅 Elegir fecha", width=140, command=lambda: DatePicker(
            m, lambda d: (fecha_val.__setitem__(0, d), fecha_lbl.configure(text=d))
        )).pack(anchor="w", padx=16, pady=4)

        hora_sel = TimeSelector(form, "Hora límite")
        hora_sel.pack(anchor="w", padx=16, pady=4)

        ctk.CTkLabel(form, text="Duración (min)").pack(anchor="w", padx=16, pady=(8, 2))
        dur_slider = ctk.CTkSlider(form, from_=15, to=240, number_of_steps=15, width=480)
        dur_slider.pack(padx=16, anchor="w")
        dur_slider.set(tarea.get("duracion_min", 30) if tarea else 30)
        dur_lbl = ctk.CTkLabel(form, text="30 min")
        dur_lbl.pack(anchor="w", padx=16)
        dur_slider.configure(command=lambda v: dur_lbl.configure(text=f"{int(v)} min"))

        ctk.CTkLabel(form, text="Prioridad").pack(anchor="w", padx=16, pady=(8, 2))
        prior_f = ctk.CTkFrame(form, fg_color="transparent")
        prior_f.pack(padx=16, anchor="w")
        prior_val = [tarea.get("prioridad", "normal") if tarea else "normal"]
        for p, lbl in PRIORIDAD_LABELS.items():
            ctk.CTkButton(
                prior_f, text=lbl, width=120, fg_color=PRIORIDAD_COLORS[p],
                command=lambda pv=p: prior_val.__setitem__(0, pv),
            ).pack(side="left", padx=3)

        recurrente_var = ctk.BooleanVar(value=bool(tarea.get("recurrente")) if tarea else False)
        ctk.CTkSwitch(form, text="Recurrente", variable=recurrente_var).pack(anchor="w", padx=16, pady=4)

        ctk.CTkLabel(form, text="⏰ Recordatorio (alarma)", font=ctk.CTkFont(weight="bold")).pack(
            anchor="w", padx=16, pady=(8, 2),
        )
        recordatorio_var = ctk.BooleanVar(value=bool(tarea.get("recordatorio")) if tarea else False)
        ctk.CTkSwitch(form, text="Activar recordatorio", variable=recordatorio_var).pack(anchor="w", padx=16)
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

        ctk.CTkLabel(form, text="Notas").pack(anchor="w", padx=16)
        ne = ctk.CTkTextbox(form, width=480, height=80)
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
            command=m.destroy,
        ).pack(pady=4, padx=12)

    def _sugerencia(self):
        self.ai.set_api_key(db.get_ai_api_key())
        try:
            tareas = [t for t in db.get_tareas() if t["estado"] != "completada"]
            done, total, _ = db.progreso_dia(date.today().isoformat())
            hrs = max(1, (total - done) * 0.5)
            msg = self.ai.priorizar_tareas(tareas, hrs)
            messagebox.showinfo("Sugerencia IA", msg[:2500])
        except Exception as e:
            messagebox.showerror("Error", str(e))
