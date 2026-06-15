"""Cursos — Academic OS v2."""

import customtkinter as ctk
from tkinter import messagebox

import database as db
from ai.openai_client import AcademicAI
from config import COLORS, CURSO_COLORES_PALETA, FUENTE_LABELS, SEMAFORO_COLORS, SEMAFORO_EMOJI
from modules.components import ColorPalette, DatePicker, DominioSelector, TimeBlockPicker


class CursosFrame(ctk.CTkFrame):
    def __init__(self, master, app, **kwargs):
        super().__init__(master, fg_color=COLORS["bg"], **kwargs)
        self.app = app
        self.ai = AcademicAI(db.get_ai_api_key())
        self.curso_id: int | None = None
        self._active_unidad_id: int | None = None
        self._build()
        self.show_list()

    def _build(self):
        self.container = ctk.CTkFrame(self, fg_color=COLORS["bg"])
        self.container.pack(fill="both", expand=True)

    def _clear(self):
        for w in self.container.winfo_children():
            w.destroy()

    def refresh(self):
        if self.curso_id:
            self.show_curso(self.curso_id, keep_unidad_id=self._active_unidad_id)
        else:
            self.show_list()

    def show_list(self):
        self.curso_id = None
        self._active_unidad_id = None
        self._clear()
        scroll = ctk.CTkScrollableFrame(self.container, fg_color=COLORS["bg"])
        scroll.pack(fill="both", expand=True, padx=16, pady=16)

        ctk.CTkLabel(scroll, text="📚 MIS CURSOS", font=ctk.CTkFont(size=26, weight="bold")).pack(anchor="w", pady=(0, 16))

        grid = ctk.CTkFrame(scroll, fg_color="transparent")
        grid.pack(fill="both", expand=True)
        grid.grid_columnconfigure((0, 1), weight=1)

        cursos = db.get_cursos()
        for i, c in enumerate(cursos):
            self._curso_card(grid, c, i // 2, i % 2)

        fab = ctk.CTkButton(
            self.container, text="+ Nuevo Curso", width=140, height=44,
            fg_color=COLORS["accent"], corner_radius=22,
            command=self._modal_curso,
        )
        fab.place(relx=1.0, rely=1.0, x=-20, y=-20, anchor="se")

    def _curso_card(self, parent, curso: dict, row: int, col: int):
        dom, tot, av = db.avance_curso(curso["id"])
        prox = db.proximo_examen_curso(curso["id"])
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
        ctk.CTkLabel(hdr, text=curso["nombre"], font=ctk.CTkFont(size=18, weight="bold")).pack(padx=12, pady=10, anchor="w")

        ctk.CTkLabel(card, text=f"{SEMAFORO_EMOJI.get(sem,'🟢')} {int(av*100)}% dominado ({dom}/{tot} temas)").pack(anchor="w", padx=14)
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
        ctk.CTkButton(btns, text="Ver Curso", width=90, command=lambda: self.show_curso(curso["id"])).pack(side="left", padx=3)
        ctk.CTkButton(btns, text="Editar", width=70, fg_color=COLORS["surface_elevated"], command=lambda: self._modal_curso(curso)).pack(side="left", padx=3)
        ctk.CTkButton(btns, text="Archivar", width=80, fg_color=COLORS["red"], command=lambda: self._archivar(curso["id"])).pack(side="left", padx=3)

    def show_curso(self, curso_id: int, keep_unidad_id: int | None = None):
        self.curso_id = curso_id
        if keep_unidad_id:
            self._active_unidad_id = keep_unidad_id
        self._clear()
        curso = db.get_curso(curso_id)
        if not curso:
            self.show_list()
            return

        scroll = ctk.CTkScrollableFrame(self.container, fg_color=COLORS["bg"])
        scroll.pack(fill="both", expand=True, padx=16, pady=16)

        hdr = ctk.CTkFrame(scroll, fg_color=curso["color"], corner_radius=14)
        hdr.pack(fill="x", pady=(0, 12))
        top = ctk.CTkFrame(hdr, fg_color="transparent")
        top.pack(fill="x", padx=14, pady=14)
        ctk.CTkButton(top, text="←", width=40, fg_color=COLORS["surface_elevated"], command=self.show_list).pack(side="left")
        ctk.CTkLabel(top, text=curso["nombre"], font=ctk.CTkFont(size=24, weight="bold")).pack(side="left", padx=12)
        dom, tot, av = db.avance_curso(curso_id)
        bar = ctk.CTkProgressBar(hdr, progress_color=COLORS["green"])
        bar.pack(fill="x", padx=14, pady=(0, 14))
        bar.set(av)
        ctk.CTkLabel(hdr, text=f"Progreso general: {int(av*100)}%", font=ctk.CTkFont(size=12)).pack(padx=14, pady=(0, 10), anchor="w")

        tab_row = ctk.CTkFrame(scroll, fg_color="transparent")
        tab_row.pack(fill="x", pady=8)
        unidades = db.get_unidades(curso_id)
        if not unidades:
            ctk.CTkLabel(scroll, text="Sin unidades. Agrega una.", text_color=COLORS["text_sec"]).pack()
            ctk.CTkButton(scroll, text="+ Agregar Unidad", command=self._modal_unidad).pack(pady=8)
            return

        self.tabs = ctk.CTkTabview(scroll, fg_color=COLORS["surface"], command=self._on_tab_change)
        self.tabs.pack(fill="both", expand=True)
        ctk.CTkButton(tab_row, text="+ Agregar Unidad", fg_color=COLORS["accent2"], command=self._modal_unidad).pack(side="right")

        tab_names: dict[int, str] = {}
        for u in unidades:
            name = u["nombre"][:20]
            tab = self.tabs.add(name)
            tab_names[u["id"]] = name
            self._render_unidad(tab, u, curso)

        restore_id = keep_unidad_id or self._active_unidad_id
        if restore_id and restore_id in tab_names:
            self.tabs.set(tab_names[restore_id])
            self._active_unidad_id = restore_id
        elif unidades:
            self._active_unidad_id = unidades[0]["id"]

    def _on_tab_change(self, tab_name: str):
        if not self.curso_id:
            return
        for u in db.get_unidades(self.curso_id):
            if u["nombre"][:20] == tab_name:
                self._active_unidad_id = u["id"]
                break

    def _render_unidad(self, tab, unidad: dict, curso: dict):
        dom, tot, av = db.avance_unidad(unidad["id"])
        dias = db.dias_restantes(unidad.get("fecha_examen"))
        sem = db.calcular_semaforo(dias, av)

        info = ctk.CTkFrame(tab, fg_color=COLORS["surface_elevated"], corner_radius=12)
        info.pack(fill="x", pady=8)
        ctk.CTkLabel(info, text=unidad["nombre"], font=ctk.CTkFont(size=16, weight="bold")).pack(anchor="w", padx=12, pady=(10, 2))
        fecha_txt = ctk.CTkLabel(info, text=f"Examen: {unidad.get('fecha_examen') or 'Sin fecha'} ({dias}d)", text_color=SEMAFORO_COLORS.get(sem, COLORS["text_sec"]))
        fecha_txt.pack(anchor="w", padx=12)
        ctk.CTkButton(
            info, text="📅 Cambiar fecha", width=120, fg_color=COLORS["surface"],
            command=lambda uid=unidad["id"]: DatePicker(
                self, lambda d, u=uid: self._set_fecha_examen(u, d), None,
            ),
        ).pack(anchor="w", padx=12, pady=8)
        bar = ctk.CTkProgressBar(info, progress_color=curso["color"])
        bar.pack(fill="x", padx=12, pady=4)
        bar.set(av)
        ctk.CTkLabel(info, text=f"{int(av*100)}% — {SEMAFORO_EMOJI.get(sem,'')}", font=ctk.CTkFont(size=11)).pack(anchor="w", padx=12, pady=(0, 10))

        for tema in db.get_temas(unidad["id"]):
            self._tema_card(tab, tema, curso)

        ctk.CTkButton(tab, text="+ Agregar Tema", command=lambda u=unidad, c=curso: self._modal_tema(u, c)).pack(pady=8, anchor="w")
        ctk.CTkButton(
            tab, text="📋 Cargar temario con IA", fg_color=COLORS["accent2"],
            command=lambda u=unidad, c=curso: self._modal_ia(u, c),
        ).pack(pady=4, anchor="w")

    def _tema_card(self, parent, tema: dict, curso: dict):
        card = ctk.CTkFrame(parent, fg_color=COLORS["surface"], corner_radius=12, border_width=1, border_color=COLORS["border"])
        card.pack(fill="x", pady=6)

        row = ctk.CTkFrame(card, fg_color="transparent")
        row.pack(fill="x", padx=12, pady=10)
        ctk.CTkLabel(row, text=tema["nombre"], font=ctk.CTkFont(size=14, weight="bold")).pack(side="left", fill="x", expand=True)
        ctk.CTkButton(
            row, text="⏰ TB", width=52, height=28, fg_color=COLORS["blue"],
            command=lambda t=tema, c=curso: self._abrir_tb(t["nombre"], t["id"], c["id"]),
        ).pack(side="right", padx=2)

        meta = ctk.CTkFrame(card, fg_color="transparent")
        meta.pack(fill="x", padx=12)
        fuente_m = ctk.CTkOptionMenu(
            meta, values=list(FUENTE_LABELS.values()), width=100,
            command=lambda v, tid=tema["id"]: self._upd_tema(tid, fuente=self._fuente_key(v)),
        )
        fuente_m.set(FUENTE_LABELS.get(tema["fuente"], "PPT"))
        fuente_m.pack(side="left", padx=4)
        prior_m = ctk.CTkOptionMenu(
            meta, values=["Alta", "Media", "Baja"], width=90,
            command=lambda v, tid=tema["id"]: self._upd_tema(tid, prioridad=v.lower()),
        )
        prior_m.set(tema["prioridad"].capitalize())
        prior_m.pack(side="left", padx=4)

        dom = DominioSelector(
            card, tema["dominio"],
            lambda k, tid=tema["id"]: self._upd_tema(tid, dominio=k),
        )
        dom.pack(fill="x", padx=12, pady=8)

        btns = ctk.CTkFrame(card, fg_color="transparent")
        btns.pack(fill="x", padx=12, pady=(0, 10))
        ctk.CTkButton(btns, text="▼ Subtemas", width=100, fg_color=COLORS["surface_elevated"],
                      command=lambda: self._toggle_sub(card, tema, curso)).pack(side="left")
        ctk.CTkButton(btns, text="Eliminar", width=80, fg_color=COLORS["red"],
                      command=lambda tid=tema["id"]: self._del_tema(tid)).pack(side="right")
        card._sub_frame = ctk.CTkFrame(card, fg_color=COLORS["surface_elevated"], corner_radius=8)
        card._sub_open = False

    def _upd_tema(self, tid, **kwargs):
        db.actualizar_tema(tid, **kwargs)

    def _abrir_tb(self, titulo: str, tema_id: int, curso_id: int):
        TimeBlockPicker(
            self, titulo, curso_id, tema_id,
            on_done=lambda: self.app.navigate("timeblocking"),
        )

    def _fuente_key(self, label: str) -> str:
        return {v: k for k, v in FUENTE_LABELS.items()}.get(label, "ppt")

    def _toggle_sub(self, card, tema: dict, curso: dict):
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
                r, text=st["nombre"], variable=var,
                command=lambda sid=st["id"], v=var: db.actualizar_subtema(sid, completado=int(v.get())),
            ).pack(side="left", fill="x", expand=True)
            ctk.CTkButton(
                r, text="⏰", width=36, height=26, fg_color=COLORS["blue"],
                command=lambda s=st, t=tema, c=curso: self._abrir_tb(
                    f"{t['nombre']}: {s['nombre']}", t["id"], c["id"],
                ),
            ).pack(side="right", padx=4)
        add = ctk.CTkFrame(sf, fg_color="transparent")
        add.pack(fill="x", padx=8, pady=6)
        e = ctk.CTkEntry(add, placeholder_text="Nuevo subtema", width=180)
        e.pack(side="left")
        ctk.CTkButton(
            add, text="+", width=30,
            command=lambda tid=tema["id"], ent=e: self._add_sub(tid, ent),
        ).pack(side="left", padx=4)
        sf.pack(fill="x", padx=12, pady=(0, 10))
        card._sub_open = True

    def _add_sub(self, tema_id, entry):
        n = entry.get().strip()
        if n:
            db.crear_subtema(tema_id, n)
            entry.delete(0, "end")
            self.refresh()

    def _del_tema(self, tid):
        if messagebox.askyesno("Eliminar", "¿Eliminar tema?"):
            db.eliminar_tema(tid)
            self.refresh()

    def _set_fecha_examen(self, uid, fecha):
        db.actualizar_unidad(uid, fecha_examen=fecha)
        self.refresh()

    def _modal_curso(self, curso: dict | None = None):
        m = ctk.CTkToplevel(self)
        m.title("Curso")
        m.geometry("420x380")
        m.grab_set()
        m.configure(fg_color=COLORS["surface"])
        ctk.CTkLabel(m, text="Nombre").pack(anchor="w", padx=20, pady=(16, 2))
        ne = ctk.CTkEntry(m, width=380)
        ne.pack(padx=20)
        if curso:
            ne.insert(0, curso["nombre"])
        ctk.CTkLabel(m, text="Tipo").pack(anchor="w", padx=20, pady=(8, 2))
        te = ctk.CTkOptionMenu(m, values=["Académico", "Personal", "Investigación"], width=380)
        te.pack(padx=20)
        ctk.CTkLabel(m, text="Color").pack(anchor="w", padx=20, pady=(8, 2))
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
        ctk.CTkLabel(m, text="Nombre").pack(anchor="w", padx=20, pady=(16, 2))
        ne = ctk.CTkEntry(m, width=360)
        ne.pack(padx=20)
        fecha = [None]
        ctk.CTkButton(m, text="📅 Fecha examen", command=lambda: DatePicker(m, lambda d: fecha.__setitem__(0, d))).pack(pady=8)
        ctk.CTkLabel(m, text="Descripción").pack(anchor="w", padx=20)
        de = ctk.CTkTextbox(m, width=360, height=60)
        de.pack(padx=20)

        def save():
            if ne.get().strip():
                db.crear_unidad(self.curso_id, ne.get().strip(), fecha_examen=fecha[0], descripcion=de.get("1.0", "end").strip())
                m.destroy()
                self.refresh()
        ctk.CTkButton(m, text="Guardar", command=save).pack(pady=16)

    def _modal_tema(self, unidad, curso):
        m = ctk.CTkToplevel(self)
        m.title("Tema")
        m.geometry("380x200")
        m.grab_set()
        ne = ctk.CTkEntry(m, placeholder_text="Nombre del tema", width=340)
        ne.pack(padx=20, pady=30)

        def save():
            if ne.get().strip():
                db.crear_tema(unidad["id"], curso["id"], ne.get().strip())
                m.destroy()
                self.refresh()
        ctk.CTkButton(m, text="Guardar", command=save).pack()

    def _modal_ia(self, unidad, curso):
        m = ctk.CTkToplevel(self)
        m.title("IA — Temario")
        m.geometry("500x400")
        m.grab_set()
        tb = ctk.CTkTextbox(m, width=460, height=280)
        tb.pack(padx=20, pady=20)

        def run():
            self.ai.set_api_key(db.get_ai_api_key())
            try:
                temas = self.ai.extraer_temas_syllabus(tb.get("1.0", "end"))
                for t in temas:
                    db.crear_tema(unidad["id"], curso["id"], t.get("nombre", "Tema"),
                                  fuente=t.get("fuente", "ppt"), prioridad=t.get("prioridad", "media"))
                messagebox.showinfo("OK", f"{len(temas)} temas importados")
                m.destroy()
                self.refresh()
            except Exception as e:
                messagebox.showerror("Error", str(e))
        ctk.CTkButton(m, text="Extraer con IA (DeepSeek)", command=run).pack()

    def _archivar(self, cid):
        if messagebox.askyesno("Archivar", "¿Archivar curso?"):
            db.archivar_curso(cid)
            self.show_list()
