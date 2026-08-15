import { useEffect } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { useCoursesStore } from '../stores/coursesStore';
import {
  getScheduledNotificationMessage,
  checkHadesNotification,
  checkAngerNotification,
  createNotification,
} from '../utils/notifications';
import { godAnger } from '../utils/gamification';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useTimeStore } from '../stores/timeStore';
import {
  ensureNotifPermission,
  isNative,
  rescheduleAll,
} from '../utils/localNotifications';
import { runPenaltyCycle } from '../utils/penaltyCycle';

const CHECK_INTERVAL_MS = 5 * 60_000;
const STARTUP_DELAY_MS = 2500;

/**
 * Avisos in-app + notificaciones LOCALES de Android.
 *
 * Con la app cerrada avisa Android, no un servidor: las alarmas se reprograman
 * con datos frescos de Dexie cada vez que la app pasa a primer plano.
 */
export function useNotifications(): void {
  useEffect(() => {
    const runFullChecks = async () => {
      await runPenaltyCycle();
      void rescheduleAll();

      const player = usePlayerStore.getState().player;
      if (!player) return;

      const addNotification = usePlayerStore.getState().addNotification;
      const courses = useCoursesStore.getState().courses;

      const hades = checkHadesNotification(player.lastStudyDate);
      if (hades) addNotification(hades);

      let completed = 0;
      let total = 0;
      for (const course of courses) {
        for (const unit of course.units) {
          for (const topic of unit.topics) {
            total++;
            if (topic.completed) completed++;
          }
        }
      }

      const nearestExam = courses
        .flatMap((c) => c.units)
        .filter((u) => u.examDate)
        .sort((a, b) => (a.examDate! > b.examDate! ? 1 : -1))[0];

      if (nearestExam?.examDate) {
        const daysLeft = Math.max(
          0,
          Math.ceil(
            (new Date(nearestExam.examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          ),
        );
        const anger = godAnger(daysLeft, completed, total);
        const angerNotif = checkAngerNotification(anger);
        if (angerNotif) addNotification(angerNotif);
      }

      const scheduled = getScheduledNotificationMessage();
      if (scheduled) {
        addNotification(createNotification('herald', `📜 ${scheduled}`));
      }
    };

    const onVisible = () => {
      // Al ocultarse conviene reprogramar: es justo el momento en que Android
      // pasa a ser el único que puede avisar.
      void rescheduleAll();
      if (document.visibilityState === 'visible') void runFullChecks();
    };
    const onOnline = () => void runFullChecks();

    const startup = window.setTimeout(() => void runFullChecks(), STARTUP_DELAY_MS);
    const interval = window.setInterval(() => void runFullChecks(), CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);

    // Android: permiso + reprogramación al volver a primer plano, y el [Sí] de
    // la notificación de fin de bloque marca el bloque como completado.
    const nativo = isNative
      ? Promise.all([
          ensureNotifPermission().then(() => rescheduleAll()),
          App.addListener('appStateChange', ({ isActive }) => {
            void rescheduleAll();
            if (isActive) void runFullChecks();
          }),
          LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
            const blockId = e.notification.extra?.blockId as string | undefined;
            if (blockId && e.actionId === 'done') {
              void useTimeStore.getState().completeBlock(blockId).then(() => rescheduleAll());
            }
          }),
        ])
      : null;

    return () => {
      window.clearTimeout(startup);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      void nativo?.then(([, ...handles]) => handles.forEach((h) => void h.remove()));
    };
  }, []);
}
