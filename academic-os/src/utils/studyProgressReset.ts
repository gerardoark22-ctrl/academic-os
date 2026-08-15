import { db } from './db';
import { usePlayerStore } from '../stores/playerStore';
import { useTimeStore } from '../stores/timeStore';
import { syncDailyMissions } from '../stores/dailyMissionsStore';
import { syncTodayStudyMinutesFromBlocks } from './studyProgress';

/** Incrementar para forzar reset de meta diaria en todos los clientes (sin borrar cursos/misiones). */
export const STUDY_PROGRESS_SYNC_VERSION = 1;

export async function resetTodayDailyProgress(): Promise<void> {
  await usePlayerStore.getState().ensureDailyRollover();
  await useTimeStore.getState().resetTodayBlockProgress();
  await usePlayerStore.getState().applyTodayStudyBaseline();
  await syncTodayStudyMinutesFromBlocks();
  syncDailyMissions();
}

export async function ensureStudyProgressSync(): Promise<boolean> {
  const row = await db.settings.get('studyProgressSyncVersion');
  const current = row?.value as number | undefined;
  if (current === STUDY_PROGRESS_SYNC_VERSION) return false;

  await usePlayerStore.getState().resetTodayDailyProgress();
  await db.settings.put({
    key: 'studyProgressSyncVersion',
    value: STUDY_PROGRESS_SYNC_VERSION,
  });
  return true;
}
