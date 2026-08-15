"""Cursos — Academic OS v2."""

import customtkinter as ctk
from tkinter import messagebox

import database as db
from ai.openai_client import AcademicAI
from config import COLORS, CURSO_COLORES_PALETA, FUENTE_LABELS, SEMAFORO_COLORS, SEMAFORO_EMOJI
from modules.components import ColorPalette, DatePicker, DominioSelector, TimeBlockPicker, game_button
from modules.theme_engine import font, is_light_mode, lbl, styled_entry, styled_option


class CursosFrame(ctk.CTkFrame):
    def __init__(self, master, app, **kwargs):
        super().__init__(master, fg_color=COLORS["bg"], **kwargs)
        self.app = app
        self.ai = AcademicAI(db.get_ai_api_key())
        self.curso_id: int | None = None
        self._active_unidad_id: int | None = None
        self._tab_to_unidad: dict[str, int] = {}
        self._tab_frames: dict[int, ctk.CTkFrame] = {}
        self._unidad_cache: dict[int, dict] = {}
        self._rendered_tabs: set[int] = set()
        self._curso_data: dict | None = None
        self._curso_bar = None
        self._curso_prog_lbl = None
        self._fab = None
        self._temas_by_unidad: dict[int, list] = {}
        self._build()
        self.show_list()

    def _build(self):
        self.container = ctk.CTkFrame(self, fg_color=COLORS["bg"])
        self.container.pack(fill="both", expand=True)

    def _clear(self):
        for w in self.container.winfo_children():
            w.destroy()
        self._fab = None

    def _load_temas_cache(self, curso_id: int):
        self._temas_by_unidad = {}
        for t in db.get_temas_curso(curso_id):
            self._temas_by_unidad.setdefault(t["unidad_id"], []).append(t)

    def _ensure_tab_rendered(self, unidad_id: int | None):
        if not unidad_id or unidad_id in self._rendered_tabs:
            return
        if not self._curso_data or unidad_id not in self._tab_frames:
            return
        u = self._unidad_cache.get(unidad_id) or db.get_unidad(unidad_id)
        if not u:
            return
        self._unidad_cache[unidad_id] = u
        self._render_unidad(self._tab_frames[unidad_id], u, self._curso_data)
        self._rendered_tabs.add(unidad_id)

    def _reload_curso(self, unidad_id: int | None = None, partial: bool = False):
        uid = unidad_id or self._active_unidad_id
        if partial and self.curso_id and hasattr(self, "tabs") and uid in self._tab_frames:
            self._load_temas_cache(self.curso_id)
            tab = self._tab_frames[uid]
            for w in tab.winfo_children():
                w.destroy()
            u = self._unidad_cache.get(uid) or db.get_unidad(uid)
            if u and self._curso_data:
                self._rendered_tabs.discard(uid)
                self._render_unidad(tab, u, self._curso_data)
                self._rendered_tabs.add(uid)
            self._refresh_header_progress()
            return
        if self.curso_id:
            self.show_curso(self.curso_id, keep_unidad_id=uid)

    def _refresh_header_progress(self):
        if not self.curso_id or not self._curso_bar:
            return
        _, tot, av = db.avance_curso(self.curso_id)
        self._curso_bar.set(av)
        if self._curso_prog_lbl:
            self._curso_prog_lbl.configure(
                text=f"Progreso general: {int(av * 100)}% ({tot} temas · dominio ponderado)",
            )

    def refresh(self):
        if self.curso_id:
            self.show_curso(self.curso_id, keep_unidad_id=self._active_unidad_id)
        else:
            self.show_list()

    def _btn_secondary(self, parent, **kwargs) -> ctk.CTkButton:
        light = is_light_mode()
        kwargs.pop("text_color", None)
        return ctk.CTkButton(
            parent,
            fg_color=kwargs.pop("fg_color", COLORS["surface"] if light else COLORS["surface_elevated"]),
            hover_color=kwargs.pop("hover_color", COLORS["nav_hover"]),
            text_color=COLORS["text"],
            border_width=kwargs.pop("border_width", 2),
            border_color=kwargs.pop("border_color", COLORS["blue"] if light else COLORS["border"]),
            font=kwargs.pop("font", font("body")),
            **kwargs,
        )

    def _btn_primary(self, parent, **kwargs) -> ctk.CTkButton:
        kwargs.pop("text_color", None)
        return ctk.CTkButton(
            parent,
            text_color=COLORS["text_on_accent"],
            font=kwargs.pop("font", font("game")),
            **kwargs,
        )

    def _style_tabs(self):
        if not hasattr(self, "tabs"):
            return
        light = is_light_mode()
        self.tabs.configure(
            fg_color=COLORS["surface"],
            segmented_button_fg_color=COLORS["surface_elevated"],
            segmented_button_selected_color="#93c5fd" if light else COLORS["accent"],
            segmented_button_selected_hover_color="#60a5fa" if light else COLORS["accent_hover"],
            segmented_button_unselected_color=COLORS["tab_unselected"],
            segmented_button_unselected_hover_color=COLORS["nav_hover"],
            text_color=COLORS["text"] if light else COLORS["text_on_accent"],
        )

    def _tab_label(self, unidad: dict) -> str:
        nombre = (unidad.get("nombre") or "").strip()
        if nombre.startswith(f"#{unidad['orden']}"):
            return nombre[:26]
        return f"U{unidad['orden']} {nombre[:20]}"

    def show_list(self):
        self.curso_id = None
        self._active_unidad_id = None
        self._clear()
        scroll = ctk.CTkScrollableFrame(self.container, fg_color=COLORS["bg"])
        scroll.pack(fill="both", expand=True, padx=16, pady=16)

        lbl(scroll, "📚 MIS CURSOS", style="display").pack(anchor="w", pady=(0, 16))

        grid = ctk.CTkFrame(scroll, fg_color="transparent")
        grid.pack(fill="both", expand=True)
        grid.grid_columnconfigure((0, 1), weight=1)

        cursos = db.get_cursos()
        u_map, avance_curso_map, _ = db.get_avance_maps()
        examenes = db.get_examenes_proximos(u_map)
        for i, c in enumerate(cursos):
            self._curso_card(grid, c, i // 2, i % 2, examenes, avance_curso_map)

        if self._fab:
            self._fab.destroy()
        self._fab = ctk.CTkButton(
            self.container, text="+ Nuevo Curso", width=140, height=44,
            fg_color=COLORS["accent"], corner_radius=22,
            command=self._modal_curso,
        )
        self._fab.place(relx=1.0, rely=1.0, x=-20, y=-20, anchor="se")

    def _curso_card(
        self, parent, curso: dict, row: int, col: int,
        examenes: list | None = None,
        avance_curso_map: dict | None = None,
    ):
        dom, tot, av = db.avance_curso(curso["id"], avance_curso_map)
        prox = db.proximo_examen_curso(curso["id"], examenes)
        dias = db.dias_restantes(prox["fecha_examen"]) if prox else None
        sem = db.calcular_semaforo(dias, av) if prox else "VERDE"

        card = ctk.CTkFrame(
            parent, fg_color=COLORS["surface"], corner_radius=16,
            border_width=2, border_color=curso["color"],
        )
        card.grid(row=row, column=col, sticky="nsew", padx=8, pady=8)

        hdr = ctk.CTkFrame(card, fg_color=curso["color"], corner_radius=12, height=50)
        hdr.pack(fill="x", padx=10, pady=10)
        hdr.pack_propagate(False)
        ctk.CTkLabel(hdr, text=curso["nombre"], font=font("title"), text_color=COLORS["text_on_accent"]).pack(padx=12, pady=10, anchor="w")

        ctk.CTkLabel(card, text=f"{SEMAFORO_EMOJI.get(sem,'🟢')} {int(av*100)}% avance ({dom}/{tot} dominados)", text_color=COLORS["text"]).pack(anchor="w", padx=14)
        unidades = db.get_unidades(curso["id"])
        ctk.CTkLabel(card, text=f"{len(unidades)} unidades", text_color=COLORS["text_sec"]).pack(anchor="w", padx=14, pady=2)
        if prox:
            ctk.CTkLabel(
                card, text=f"Próximo examen: {prox['nombre']} — {dias}d",
                text_color=SEMAFORO_COLORS.get(sem, COLORS["text_sec"]),
            ).pack(anchor="w", padx=14, pady=2)

        bar = ctk.CTkProgressBar(card, progress_color=curso["color"])
        bar.pack(fill="x", padx=14, pady=8)
        bar.set(av)

        btns = ctk.CTkFrame(card, fg_color="transparent")
        btns.pack(fill="x", padx=10, pady=(0, 12))
        ctk.CTkButton(btns, text="Ver Curso", width=90, text_color=COLORS["text_on_accent"], command=lambda: self.show_curso(curso["id"])).pack(side="left", padx=3)
        ctk.CTkButton(btns, text="Editar", width=70, fg_color=COLORS["surface_elevated"], text_color=COLORS["text"], command=lambda: self._modal_curso(curso)).pack(side="left", padx=3)
        ctk.CTkButton(btns, text="Archivar", width=80, fg_color=COLORS["red"], command=lambda: self._archivar(curso["id"])).pack(side="left", padx=3)

    def show_curso(self, curso_id: int, keep_unidad_id: int | None = None):
        self.curso_id = curso_id
        if keep_unidad_id:
            self._active_unidad_id = keep_unidad_id
        self._clear()
        if self._fab:
            self._fab.place_forget()
        curso = db.get_curso(curso_id)
        if not curso:
            self.show_list()
            return
        self._curso_data = curso

        shell = ctk.CTkFrame(self.container, fg_color=COLORS["bg"])
        shell.pack(fill="both", expand=True, padx=16, pady=16)
        shell.grid_rowconfigure(2, weight=1)
        shell.grid_columnconfigure(0, weight=1)

        hdr = ctk.CTkFrame(shell, fg_color=curso["color"], corner_radius=14)
        hdr.grid(row=0, column=0, sticky="ew", pady=(0, 8))
        top = ctk.CTkFrame(hdr, fg_color="transparent")
        top.pack(fill="x", padx=14, pady=14)
        ctk.CTkButton(
            top, text="←", width=40, fg_color=COLORS["surface_elevated"],
            text_color=COLORS["text"], command=self.show_list,
        ).pack(side="left")
        ctk.CTkLabel(
            top, text=curso["nombre"], font=font("title"), text_color=COLORS["text_on_accent"],
        ).pack(side="left", padx=12)
        _, tot, av = db.avance_curso(curso_id)
        self._curso_bar = ctk.CTkProgressBar(hdr, progress_color=COLORS["green"], fg_color=COLORS["progress_track"])
        self._curso_bar.pack(fill="x", padx=14, pady=(0, 6))
        self._curso_bar.set(av)
        self._curso_prog_lbl = ctk.CTkLabel(
            hdr, text=f"Progreso general: {int(av*100)}% ({tot} temas · dominio ponderado)",
            font=font("small"), text_color=COLORS["text_on_accent"],
        )
        self._curso_prog_lbl.pack(padx=14, pady=(0, 10), anchor="w")

        tab_row = ctk.CTkFrame(shell, fg_color="transparent")
        tab_row.grid(row=1, column=0, sticky="ew", pady=(0, 4))
        unidades = db.get_unidades(curso_id)
        self._unidad_cache = {u["id"]: u for u in unidades}
        self._load_temas_cache(curso_id)
        if not unidades:
            ctk.CTkLabel(shell, text="Sin unidades. Agrega una.", text_color=COLORS["text_sec"]).pack()
            self._btn_primary(shell, text="+ Agregar Unidad", fg_color=COLORS["accent"], command=self._modal_unidad).pack(pady=8)
            return

        self._btn_primary(
            tab_row, text="+ Agregar Unidad", fg_color=COLORS["accent2"], command=self._modal_unidad,
        ).pack(side="right")

        light = is_light_mode()
        self.tabs = ctk.CTkTabview(
            shell, fg_color=COLORS["surface"], command=self._on_tab_change,
            segmented_button_fg_color=COLORS["surface_elevated"],
            segmented_button_selected_color="#93c5fd" if light else COLORS["accent"],
            segmented_button_selected_hover_color="#60a5fa" if light else COLORS["accent_hover"],
            segmented_button_unselected_color=COLORS["tab_unselected"],
            segmented_button_unselected_hover_color=COLORS["nav_hover"],
            text_color=COLORS["text"] if light else COLORS["text_on_accent"],
        )
        self.tabs.grid(row=2, column=0, sticky="nsew")

        self._tab_to_unidad.clear()
        self._tab_frames.clear()
        self._rendered_tabs.clear()
        tab_names: dict[int, str] = {}
        for u in unidades:
            name = self._tab_label(u)
            tab = self.tabs.add(name)
            tab_names[u["id"]] = name
            self._tab_to_unidad[name] = u["id"]
            self._tab_frames[u["id"]] = tab

        restore_id = keep_unidad_id or self._active_unidad_id or unidades[0]["id"]
        if restore_id not in self._unidad_cache:
            restore_id = unidades[0]["id"]
        self._active_unidad_id = restore_id
        if restore_id in tab_names:
            self.tabs.set(tab_names[restore_id])
        self._ensure_tab_rendered(restore_id)
        self._style_tabs()

    def _on_tab_change(self, *_args):
        tab_name = self.tabs.get() if hasattr(self, "tabs") else (_args[0] if _args else "")
        uid = self._tab_to_unidad.get(tab_name)
        if uid:
            self._active_unidad_id = uid
            self._ensure_tab_rendered(uid)

    def _render_unidad(self, tab, unidad: dict, curso: dict):
        for w in tab.winfo_children():
            w.destroy()

        body = ctk.CTkScrollableFrame(tab, fg_color=COLORS["bg"])
        body.pack(fill="both", expand=True)

        dom, tot, av = db.avance_unidad(unidad["id"])
        dias = db.dias_restantes(unidad.get("fecha_examen"))
        sem = db.calcular_semaforo(dias, av)
        sem_color = SEMAFORO_COLORS.get(sem, COLORS["text_sec"])

        info = ctk.CTkFrame(
            body, fg_color=COLORS["surface_elevated"], corner_radius=12,
            border_width=1, border_color=COLORS["border"],
        )
        info.pack(fill="x", pady=8)
        hdr_row = ctk.CTkFrame(info, fg_color="transparent")
        hdr_row.pack(fill="x", padx=12, pady=(10, 4))
        lbl(hdr_row, unidad["nombre"], style="section").pack(side="left", anchor="w")
        btns_u = ctk.CTkFrame(hdr_row, fg_color="transparent")
        btns_u.pack(side="right")
        self._btn_secondary(
            btns_u, text="✏️ Renombrar", width=96, height=28,
            command=lambda u=unidad: self._edit_unidad(u),
        ).pack(side="left", padx=2)
        self._btn_primary(
            btns_u, text="🗑 Eliminar", width=88, height=28, fg_color=COLORS["red"],
            command=lambda u=unidad: self._del_unidad(u),
        ).pack(side="left", padx=2)

        exam_banner = ctk.CTkFrame(info, fg_color=sem_color, corner_radius=10, height=72)
        exam_banner.pack(fill="x", padx=12, pady=6)
        exam_banner.pack_propagate(False)
        eb = ctk.CTkFrame(exam_banner, fg_color="transparent")
        eb.pack(fill="both", expand=True, padx=14, pady=8)
        ctk.CTkLabel(
            eb, text="📅 EXAMEN DE UNIDAD",
            font=font("badge"), text_color=COLORS["text_on_accent"],
        ).pack(anchor="w")
        fecha_str = unidad.get("fecha_examen") or "Sin fecha asignada"
        dias_txt = f"{dias} días" if dias is not None else "—"
        ctk.CTkLabel(
            eb, text=f"{fecha_str}  ·  {dias_txt}",
            font=font("title"), text_color=COLORS["text_on_accent"],
        ).pack(anchor="w")
        self._btn_secondary(
            info, text="📅 Cambiar fecha", width=130,
            command=lambda uid=unidad["id"]: DatePicker(
                self, lambda d, u=uid: self._set_fecha_examen(u, d), None,
            ),
        ).pack(anchor="w", padx=12, pady=(0, 8))

        bar = ctk.CTkProgressBar(info, progress_color=curso["color"], fg_color=COLORS["progress_track"])
        bar.pack(fill="x", padx=12, pady=4)
        bar.set(av)
        sem_lbl = SEMAFORO_EMOJI.get(sem, "")
        prog_lbl = lbl(
            info,
            f"{int(av*100)}% avance · {dom}/{tot} dominados · {sem_lbl} "
            f"(🌱=33% ⚡=66% 🔥=100%)",
            style="body",
        )
        prog_lbl.pack(anchor="w", padx=12, pady=(0, 10))
        tab._progress = (bar, prog_lbl, unidad["id"])

        temas_box = ctk.CTkFrame(body, fg_color="transparent")
        temas_box.pack(fill="x")
        tab._temas_box = temas_box
        temas = self._temas_by_unidad.get(unidad["id"], [])
        self._render_temas_chunk(temas_box, temas, curso, unidad)

        foot = ctk.CTkFrame(body, fg_color="transparent")
        foot.pack(fill="x", pady=8)
        self._btn_primary(
            foot, text="+ Agregar Tema", fg_color=COLORS["accent"],
            command=lambda u=unidad, c=curso: self._modal_tema(u, c),
        ).pack(pady=4, anchor="w")
        self._btn_primary(
            foot, text="📋 Cargar temario con IA", fg_color=COLORS["accent2"],
            command=lambda u=unidad, c=curso: self._modal_ia(u, c),
        ).pack(pady=4, anchor="w")

    def _render_temas_chunk(self, parent, temas: list, curso: dict, unidad: dict, start: int = 0):
        end = min(start + 6, len(temas))
        for t in temas[start:end]:
            self._tema_card(parent, t, curso, unidad)
        if end < len(temas):
            self.after(1, lambda: self._render_temas_chunk(parent, temas, curso, unidad, end))

    def _tema_card(self, parent, tema: dict, curso: dict, unidad: dict):
        card = ctk.CTkFrame(
            parent, fg_color=COLORS["surface"], corner_radius=12,
            border_width=2, border_color=COLORS.get("card_border", COLORS["border"]),
        )
        card.pack(fill="x", pady=6)

        row = ctk.CTkFrame(card, fg_color="transparent")
        row.pack(fill="x", padx=12, pady=(10, 6))
        lbl(row, tema["nombre"], style="section").pack(side="left", anchor="w")
        self._btn_secondary(
            row, text="✏️ Editar", width=88, height=28,
            command=lambda t=tema, u=unidad: self._edit_tema(t, u),
        ).pack(side="right", padx=2)
        self._btn_primary(
            row, text="⏰ TB", width=52, height=28, fg_color=COLORS["blue"],
            command=lambda t=tema, c=curso: self._abrir_tb(t["nombre"], t["id"], c["id"]),
        ).pack(side="right", padx=2)

        meta = ctk.CTkFrame(card, fg_color="transparent")
        meta.pack(fill="x", padx=12)
        fuente_m = styled_option(
            meta, values=list(FUENTE_LABELS.values()), width=100,
            command=lambda v, tid=tema["id"]: self._upd_tema(tid, fuente=self._fuente_key(v)),
        )
        fuente_m.set(FUENTE_LABELS.get(tema["fuente"], "PPT"))
        fuente_m.pack(side="left", padx=4)
        prior_m = styled_option(
            meta, values=["Alta", "Media", "Baja"], width=90,
            command=lambda v, tid=tema["id"]: self._upd_tema(tid, prioridad=v.lower()),
        )
        prior_m.set(tema["prioridad"].capitalize())
        prior_m.pack(side="left", padx=4)

        dom_sel = DominioSelector(
            card, tema["dominio"],
            lambda k, tid=tema["id"], card=card: self._upd_dominio(tid, k, card),
        )
        dom_sel.pack(fill="x", padx=12, pady=8)
        card._dom_sel = dom_sel

        btns = ctk.CTkFrame(card, fg_color="transparent")
        btns.pack(fill="x", padx=12, pady=(0, 10))
        self._btn_secondary(
            btns, text="▼ Subtemas", width=120, height=30,
            font=font("subtitle"),
            border_color=COLORS["accent"] if is_light_mode() else COLORS["border"],
            command=lambda: self._toggle_sub(card, tema, curso, unidad),
        ).pack(side="left")
        self._btn_primary(btns, text="Eliminar", width=80, fg_color=COLORS["red"],
                      command=lambda tid=tema["id"]: self._del_tema(tid)).pack(side="right")
        card._sub_frame = ctk.CTkFrame(
            card, fg_color=COLORS["surface_elevated"], corner_radius=8,
            border_width=1, border_color=COLORS["border"],
        )
        card._sub_open = False

    def _upd_tema(self, tid, **kwargs):
        db.actualizar_tema(tid, **kwargs)

    def _upd_dominio(self, tid: int, dominio: str, card=None):
        db.actualizar_tema(tid, dominio=dominio)
        self._refresh_header_progress()
        uid = self._active_unidad_id
        if uid and uid in self._tab_frames and hasattr(self._tab_frames[uid], "_progress"):
            bar, prog_lbl, _ = self._tab_frames[uid]._progress
            dom, tot, av = db.avance_unidad(uid)
            bar.set(av)
            prog_lbl.configure(text=f"{int(av*100)}% avance · {dom}/{tot} dominados · dominio guardado ✓")

    def _abrir_tb(self, titulo: str, tema_id: int, curso_id: int):
        TimeBlockPicker(
            self, titulo, curso_id, tema_id,
            on_done=lambda: self.app.navigate("timeblocking"),
        )

    def _fuente_key(self, label: str) -> str:
        return {v: k for k, v in FUENTE_LABELS.items()}.get(label, "ppt")

    def _toggle_sub(self, card, tema: dict, curso: dict, unidad: dict):
        sf = card._sub_frame
        if card._sub_open:
            sf.pack_forget()
            card._sub_open = False
            return
        for w in sf.winfo_children():
            w.destroy()
        for st in db.get_subtemas(tema["id"]):
            r = ctk.CTkFrame(sf, fg_color="transparent")
            r.pack(fill="x", padx=8, pady=2)
            var = ctk.BooleanVar(value=bool(st["completado"]))
            ctk.CTkCheckBox(
                r, text=st["nombre"], variable=var, font=font("body"),
                text_color=COLORS["text"],
                fg_color=COLORS["accent"],
                hover_color=COLORS["accent_hover"],
                border_color=COLORS["border"],
                command=lambda sid=st["id"], v=var: db.actualizar_subtema(sid, completado=int(v.get())),
            ).pack(side="left", anchor="w")
            self._btn_secondary(
                r, text="✏️", width=36, height=24,
                command=lambda s=st, u=unidad: self._edit_subtema(s, u),
            ).pack(side="right", padx=2)
            self._btn_primary(
                r, text="⏰ TB", width=52, height=24, fg_color=COLORS["blue"],
                command=lambda s=st, t=tema, c=curso: self._abrir_tb(
                    f"{t['nombre']}: {s['nombre']}", t["id"], c["id"],
                ),
            ).pack(side="right", padx=4)
        add = ctk.CTkFrame(sf, fg_color="transparent")
        add.pack(fill="x", padx=8, pady=6)
        lbl(add, "Nuevo subtema:", style="muted").pack(side="left", padx=(0, 6))
        e = styled_entry(add, placeholder_text="Nombre", width=160)
        e.pack(side="left")
        self._btn_primary(
            add, text="+", width=34, height=28, fg_color=COLORS["green"],
            command=lambda tid=tema["id"], ent=e, u=unidad: self._add_sub(tid, ent, u),
        ).pack(side="left", padx=4)
        sf.pack(fill="x", padx=12, pady=(0, 10))
        card._sub_open = True

    def _add_sub(self, tema_id, entry, unidad: dict):
        n = entry.get().strip()
        if n:
            db.crear_subtema(tema_id, n)
            entry.delete(0, "end")
            self._reload_curso(unidad["id"], partial=True)

    def _edit_tema(self, tema: dict, unidad: dict):
        m = ctk.CTkToplevel(self)
        m.title("Editar tema")
        m.geometry("400x160")
        m.grab_set()
        m.configure(fg_color=COLORS["surface"])
        ne = ctk.CTkEntry(m, width=360)
        ne.pack(padx=20, pady=24)
        ne.insert(0, tema["nombre"])

        def save():
            nombre = ne.get().strip()
            if nombre:
                db.actualizar_tema(tema["id"], nombre=nombre)
                m.destroy()
                self._reload_curso(unidad["id"], partial=True)

        game_button(m, text="Guardar", command=save).pack(pady=8)

    def _edit_subtema(self, subtema: dict, unidad: dict):
        m = ctk.CTkToplevel(self)
        m.title("Editar subtema")
        m.geometry("400x160")
        m.grab_set()
        m.configure(fg_color=COLORS["surface"])
        ne = ctk.CTkEntry(m, width=360)
        ne.pack(padx=20, pady=24)
        ne.insert(0, subtema["nombre"])

        def save():
            nombre = ne.get().strip()
            if nombre:
                db.actualizar_subtema(subtema["id"], nombre=nombre)
                m.destroy()
                self._reload_curso(unidad["id"], partial=True)

        game_button(m, text="Guardar", command=save).pack(pady=8)

    def _del_tema(self, tid):
        if messagebox.askyesno("Eliminar", "¿Eliminar tema?"):
            db.eliminar_tema(tid)
            self._reload_curso(self._active_unidad_id, partial=True)

    def _set_fecha_examen(self, uid, fecha):
        db.actualizar_unidad(uid, fecha_examen=fecha)
        self._unidad_cache[uid] = db.get_unidad(uid) or self._unidad_cache.get(uid, {})
        self._reload_curso(uid, partial=True)

    def _del_unidad(self, unidad: dict):
        n_temas = len(self._temas_by_unidad.get(unidad["id"], []))
        msg = f"¿Eliminar «{unidad['nombre']}»?"
        if n_temas:
            msg += f"\n\nSe borrarán también {n_temas} tema(s) y subtemas."
        if messagebox.askyesno("Eliminar unidad", msg):
            db.eliminar_unidad(unidad["id"])
            db.flush_database()
            restantes = [u["id"] for u in db.get_unidades(self.curso_id)]
            next_uid = restantes[0] if restantes else None
            self.show_curso(self.curso_id, keep_unidad_id=next_uid)

    def _edit_unidad(self, unidad: dict):
        m = ctk.CTkToplevel(self)
        m.title("Renombrar unidad")
        m.geometry("420x180")
        m.grab_set()
        m.configure(fg_color=COLORS["surface"])
        lbl(m, "Nombre de la unidad", style="section").pack(anchor="w", padx=20, pady=(16, 4))
        ne = styled_entry(m, width=360)
        ne.pack(padx=20)
        ne.insert(0, unidad["nombre"])
        uid = unidad["id"]

        def save():
            nombre = ne.get().strip()
            if nombre:
                db.actualizar_unidad(uid, nombre=nombre)
                self._unidad_cache[uid] = db.get_unidad(uid) or {}
                m.destroy()
                self.show_curso(self.curso_id, keep_unidad_id=uid)

        self._btn_primary(m, text="Guardar", fg_color=COLORS["accent"], command=save).pack(pady=16)

    def _modal_curso(self, curso: dict | None = None):
        m = ctk.CTkToplevel(self)
        m.title("Curso")
        m.geometry("420x380")
        m.grab_set()
        m.configure(fg_color=COLORS["surface"])
        lbl(m, "Nombre").pack(anchor="w", padx=20, pady=(16, 2))
        ne = ctk.CTkEntry(m, width=380)
        ne.pack(padx=20)
        if curso:
            ne.insert(0, curso["nombre"])
        lbl(m, "Tipo").pack(anchor="w", padx=20, pady=(8, 2))
        te = ctk.CTkOptionMenu(m, values=["Académico", "Personal", "Investigación"], width=380)
        te.pack(padx=20)
        lbl(m, "Color").pack(anchor="w", padx=20, pady=(8, 2))
        color = [curso["color"] if curso else CURSO_COLORES_PALETA[0]]
        ColorPalette(m, CURSO_COLORES_PALETA, lambda c: color.__setitem__(0, c)).pack(padx=20)

        def save():
            n = ne.get().strip()
            if not n:
                return
            tipo = {"Académico": "academico", "Personal": "personal", "Investigación": "investigacion"}.get(te.get(), "academico")
            if curso:
                db.actualizar_curso(curso["id"], nombre=n, tipo=tipo, color=color[0])
            else:
                db.crear_curso(n, tipo, color[0])
            m.destroy()
            self.show_list() if not self.curso_id else self.show_curso(self.curso_id, keep_unidad_id=self._active_unidad_id)

        ctk.CTkButton(m, text="Guardar", command=save).pack(pady=20)

    def _modal_unidad(self):
        if not self.curso_id:
            return
        m = ctk.CTkToplevel(self)
        m.title("Unidad")
        m.geometry("400x320")
        m.grab_set()
        lbl(m, "Nombre").pack(anchor="w", padx=20, pady=(16, 2))
        ne = ctk.CTkEntry(m, width=360)
        ne.pack(padx=20)
        fecha = [None]
        ctk.CTkButton(m, text="📅 Fecha examen", command=lambda: DatePicker(m, lambda d: fecha.__setitem__(0, d))).pack(pady=8)
        lbl(m, "Descripción").pack(anchor="w", padx=20)
        de = ctk.CTkTextbox(m, width=360, height=60)
        de.pack(padx=20)

        def save():
            if ne.get().strip():
                uid = db.crear_unidad(
                    self.curso_id, ne.get().strip(),
                    fecha_examen=fecha[0], descripcion=de.get("1.0", "end").strip(),
                )
                m.destroy()
                self.show_curso(self.curso_id, keep_unidad_id=uid)
        ctk.CTkButton(m, text="Guardar", command=save).pack(pady=16)

    def _modal_tema(self, unidad, curso):
        m = ctk.CTkToplevel(self)
        m.title("Tema")
        m.geometry("380x200")
        m.grab_set()
        ne = ctk.CTkEntry(m, placeholder_text="Nombre del tema", width=340)
        ne.pack(padx=20, pady=30)
        uid = unidad["id"]

        def save():
            if ne.get().strip():
                db.crear_tema(unidad["id"], curso["id"], ne.get().strip())
                m.destroy()
                self._reload_curso(uid, partial=True)
        ctk.CTkButton(m, text="Guardar", command=save).pack()

    def _modal_ia(self, unidad, curso):
        m = ctk.CTkToplevel(self)
        m.title("IA — Temario")
        m.geometry("620x520")
        m.grab_set()
        m.configure(fg_color=COLORS["bg"])
        lbl(m, "📋 Pega el temario / syllabus", style="section").pack(anchor="w", padx=16, pady=(12, 4))
        tb = ctk.CTkTextbox(
            m, width=580, height=140,
            fg_color=COLORS["input_bg"], text_color=COLORS["text"],
            border_color=COLORS["border"], border_width=1,
        )
        tb.pack(padx=16, pady=(0, 8))
        lbl(m, "Vista previa (editable antes de importar)", style="muted").pack(anchor="w", padx=16)
        preview = ctk.CTkTextbox(
            m, width=580, height=180,
            fg_color=COLORS["surface"], text_color=COLORS["text"],
            border_color=COLORS["accent2"], border_width=2,
        )
        preview.pack(padx=16, pady=8)
        preview.insert("1.0", "Pulsa «Analizar» para ver el esquema propuesto…")
        status = lbl(m, "", style="muted")
        status.pack(anchor="w", padx=16)
        uid = unidad["id"]
        btn_row = ctk.CTkFrame(m, fg_color="transparent")
        btn_row.pack(fill="x", padx=16, pady=8)
        temas_cache: list[dict] = []

        def fmt_temas(temas: list[dict]) -> str:
            lines = [f"📚 Esquema propuesto — {len(temas)} temas\n"]
            for i, t in enumerate(temas, 1):
                pr = t.get("prioridad", "media").upper()
                fu = t.get("fuente", "ppt").upper()
                lines.append(f"{i}. {t.get('nombre', 'Tema')}  [{pr} · {fu}]")
            lines.append("\n✏️ Edita nombres/prioridades arriba. Formato: «N. Nombre [ALTA · PPT]»")
            return "\n".join(lines)

        def analizar():
            self.ai.set_api_key(db.get_ai_api_key())
            status.configure(text="Analizando con IA…")
            preview.configure(state="normal")
            preview.delete("1.0", "end")
            preview.insert("1.0", "⏳ Generando esquema…")
            preview.configure(state="disabled")

            def work():
                return self.ai.extraer_temas_syllabus(tb.get("1.0", "end"))

            def ok(temas):
                temas_cache.clear()
                temas_cache.extend(temas)
                preview.configure(state="normal")
                preview.delete("1.0", "end")
                preview.insert("1.0", fmt_temas(temas))
                status.configure(text=f"Listo — {len(temas)} temas. Revisa y confirma.")

            def err(e):
                preview.configure(state="normal")
                preview.delete("1.0", "end")
                preview.insert("1.0", f"Error: {e}")
                status.configure(text="")

            if not self.ai.api_key:
                err(RuntimeError("Configura API Key en Configuración"))
                return
            self.ai.run_async(m, work, ok, err)

        def importar():
            if not temas_cache:
                messagebox.showwarning("IA", "Primero analiza el temario")
                return
            texto = preview.get("1.0", "end").strip()
            importados = 0
            for line in texto.splitlines():
                line = line.strip()
                if not line or line.startswith("📚") or line.startswith("✏️") or line.startswith("⏳"):
                    continue
                if line[0].isdigit() and "." in line:
                    body = line.split(".", 1)[1].strip()
                    pr, fu = "media", "ppt"
                    if "[" in body and "]" in body:
                        main, meta = body.rsplit("[", 1)
                        body = main.strip()
                        meta = meta.rstrip("]").strip()
                        parts = [p.strip().lower() for p in meta.split("·")]
                        if parts:
                            fu = parts[0] if parts[0] in ("ppt", "libro", "ambos") else "ppt"
                        if len(parts) > 1 and parts[1] in ("alta", "media", "baja"):
                            pr = parts[1]
                    if body:
                        db.crear_tema(unidad["id"], curso["id"], body, fuente=fu, prioridad=pr)
                        importados += 1
            if importados == 0:
                for t in temas_cache:
                    db.crear_tema(
                        unidad["id"], curso["id"], t.get("nombre", "Tema"),
                        fuente=t.get("fuente", "ppt"), prioridad=t.get("prioridad", "media"),
                    )
                    importados += 1
            messagebox.showinfo("OK", f"{importados} temas importados")
            m.destroy()
            self._reload_curso(uid, partial=True)

        self._btn_primary(btn_row, text="🔍 Analizar", fg_color=COLORS["accent2"], command=analizar).pack(side="left", padx=4)
        self._btn_primary(btn_row, text="✅ Importar esquema", fg_color=COLORS["green"], command=importar).pack(side="left", padx=4)
        self._btn_secondary(btn_row, text="Cancelar", command=m.destroy).pack(side="right", padx=4)

    def _archivar(self, cid):
        if messagebox.askyesno("Archivar", "¿Archivar curso?"):
            db.archivar_curso(cid)
            self.show_list()
