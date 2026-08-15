import { useEffect } from 'react';
import { db, ensureOdysseyResetVersion } from '../utils/db';
import { ensureStudyProgressSync } from '../utils/studyProgressReset';
import { usePlayerStore } from '../stores/playerStore';
import { useCoursesStore } from '../stores/coursesStore';
import { useMissionsStore } from '../stores/missionsStore';
import { useTimeStore } from '../stores/timeStore';
import { useDailyMissionsStore } from '../stores/dailyMissionsStore';

export function useAppInit() {
  const playerLoad = usePlayerStore((s) => s.load);
  const coursesLoad = useCoursesStore((s) => s.load);
  const missionsLoad = useMissionsStore((s) => s.load);
  const timeLoad = useTimeStore((s) => s.load);
  const checkNotifications = useMissionsStore((s) => s.checkNotifications);
  const dailyMissionsLoad = useDailyMissionsStore((s) => s.load);
  const dailyMissionsEnsure = useDailyMissionsStore((s) => s.ensureToday);

  useEffect(() => {
    async function init() {
      const wasReset = await ensureOdysseyResetVersion();
      const { seedDatabase } = await import('../utils/sampleData');
      await seedDatabase(db);
      await coursesLoad();
      await missionsLoad();
      await playerLoad();
      await timeLoad();
      const studyReset = await ensureStudyProgressSync();
      const { syncTodayStudyMinutesFromBlocks } = await import('../utils/studyProgress');
      await syncTodayStudyMinutesFromBlocks();
      await dailyMissionsLoad();
      await dailyMissionsEnsure();
      await usePlayerStore.getState().syncUnlockables();
      checkNotifications();
      if (wasReset) {
        console.info('[Odyssey] Reset v4 — datos limpios para empezar desde cero');
      }
      if (studyReset) {
        console.info('[Odyssey] Meta diaria de hoy reiniciada a 0 (sync v1)');
      }
    }
    init();
  }, [playerLoad, coursesLoad, missionsLoad, timeLoad, checkNotifications, dailyMissionsLoad, dailyMissionsEnsure]);
}
