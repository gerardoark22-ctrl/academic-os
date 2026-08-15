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
import { browserNotificationsAllowed } from '../utils/notificationPolicy';
import { ensurePushSubscription, pushDaySnapshot } from '../utils/pushClient';
import { runPenaltyCycle } from '../utils/penaltyCycle';

const CHECK_INTERVAL_MS = 5 * 60_000;
const STARTUP_DELAY_MS = 2500;

/**
 * Avisos in-app + Web Push.
 *
 * Los avisos con la app CERRADA los manda el backend (scheduler in-process);
 * acá solo se registra la suscripción y se le empuja el snapshot del día para
 * que pueda redactarlos.
 */
export function useNotifications(): void {
  useEffect(() => {
    if (browserNotificationsAllowed()) {
      void ensurePushSubscription();
    }

    const runFullChecks = async () => {
      await runPenaltyCycle();
      void pushDaySnapshot();

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
      // Al ocultarse conviene mandar el snapshot: es justo el momento en que
      // el servidor pasa a ser el único que puede avisar.
      void pushDaySnapshot();
      if (document.visibilityState === 'visible') void runFullChecks();
    };
    const onOnline = () => void runFullChecks();

    const startup = window.setTimeout(() => void runFullChecks(), STARTUP_DELAY_MS);
    const interval = window.setInterval(() => void runFullChecks(), CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);

    return () => {
      window.clearTimeout(startup);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, []);
}
