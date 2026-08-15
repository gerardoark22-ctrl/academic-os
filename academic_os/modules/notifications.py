"""Notificaciones de escritorio — scheduler a nivel app."""

import threading
from datetime import date, datetime

import database as db

try:
    from plyer import notification
    _PLYER = True
except ImportError:
    _PLYER = False


class NotificationScheduler:
    """Alertas periódicas independientes de la pestaña Riesgo."""

    def __init__(self, app):
        self.app = app
        self._notified: set[str] = set()

    def start(self):
        self._tick()

    def _tick(self):
        try:
            self._check_alerts()
            self._check_scheduled_notifs()
        except Exception:
            pass
        if self.app.winfo_exists():
            self.app.after(60_000, self._tick)

    def _notify(self, title: str, msg: str):
        if not _PLYER:
            return
        try:
            notification.notify(title=title, message=msg, app_name="Academic OS", timeout=12)
        except Exception:
            pass

    def _check_scheduled_notifs(self):
        now = datetime.now()
        key = now.strftime("%Y-%m-%d %H:%M")[:16]
        tarde = db.get_config("notif_hora_tarde", "14:00")[:5]
        noche = db.get_config("notif_hora_noche", "21:00")[:5]
        hm = now.strftime("%H:%M")

        if hm == tarde and f"tarde_{key}" not in self._notified:
            self._notified.add(f"tarde_{key}")
            threading.Thread(target=self._notif_tarde, daemon=True).start()
        if hm == noche and f"noche_{key}" not in self._notified:
            self._notified.add(f"noche_{key}")
            threading.Thread(target=self._notif_noche, daemon=True).start()

    def _notif_tarde(self):
        b = db.get_bloque_actual()
        bloque = b.get("titulo", "Libre") if b else "Sin bloque"
        n = db.contar_tareas_pendientes()
        self._notify("🎯 Academic OS — Tarde", f"Tu bloque: {bloque}. {n} tareas pendientes hoy.")

    def _notif_noche(self):
        done, total, pct = db.progreso_dia(date.today().isoformat())
        u_map, _, _ = db.get_avance_maps()
        examenes = db.get_examenes_proximos(u_map)
        crit = examenes[0]["curso_nombre"] if examenes else "—"
        self._notify("📊 Academic OS — Resumen", f"Completaste {int(pct)}% bloques. Mañana: {crit}")

    def _check_alerts(self):
        for t in db.get_recordatorios_activos():
            k = f"rec_{t['id']}_{date.today()}_{datetime.now().strftime('%H:%M')}"
            if k not in self._notified:
                self._notified.add(k)
                self._notify("⏰ Recordatorio de tarea", t["titulo"])
        for t in db.get_tareas_vencidas():
            k = f"vencida_{t['id']}_{date.today()}"
            if k not in self._notified:
                self._notified.add(k)
                self._notify("🚨 Tarea vencida", t["titulo"])
        u_map, _, _ = db.get_avance_maps()
        for ex in db.get_examenes_proximos(u_map):
            dias = ex.get("dias_restantes")
            if dias is not None and dias <= 7:
                k = f"exam_{ex['id']}_{date.today()}"
                if k not in self._notified:
                    self._notified.add(k)
                    self._notify(
                        "⚠️ Examen próximo",
                        f"{ex['curso_nombre']} en {dias} días — {int(ex['avance'] * 100)}% listo",
                    )
