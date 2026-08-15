/**
 * Penalizaciones automáticas del juego (antes las corría hadesAutomation.ts,
 * borrado junto con los correos). Son lógica de gamificación, no de email:
 * viven en el cliente porque tocan playerStore/Dexie.
 *
 * Se ejecuta en el ciclo periódico de useNotifications (cada 5 min con la app
 * abierta). Los tres guardas de "una vez al día" están dentro del store.
 */

import { usePlayerStore } from '../stores/playerStore';
import { useCoursesStore } from '../stores/coursesStore';
import { computeCondemnation } from './condemnationEngine';
import { getTopicBacklogs } from './hadesRules';
import { todayISO, underworldDays } from './gamification';
import { getDailyGoalMinutes } from './dailyGoal';
import { getLocalParts, minutesFromHHMM } from './localTime';
import { getPushTimes } from './pushClient';

export async function runPenaltyCycle(): Promise<void> {
  const store = usePlayerStore.getState();
  const player = store.player;
  if (!player) return;

  const courses = useCoursesStore.getState().courses;

  // Regla 3: temas pendientes en curso con examen ≤14d — escala 1 nivel/día.
  await store.syncTopicBacklogEscalation(getTopicBacklogs(courses).length > 0);

  // Inframundo: −XP y racha rota. applyUnderworldPenalty ya ignora el llamado
  // si hoy estudió o si la penalización de hoy ya se aplicó.
  const uw = underworldDays(player.lastStudyDate);
  if (uw >= 1) {
    const condena = computeCondemnation(uw, player);
    await store.applyUnderworldPenalty(
      condena.xpToLoseNow,
      `Inframundo: ${uw} día(s) sin estudiar`,
    );
  }

  // Regla 7 (antes 21:00): marca del cierre nocturno si la meta no se cumplió.
  if (player.lastNinePmNotifyDate !== todayISO()) {
    const { night } = await getPushTimes();
    const goalMet = (player.todayStudyMinutes ?? 0) >= getDailyGoalMinutes(player);
    if (!goalMet && minutesFromHHMM(getLocalParts().timeHHMM) >= minutesFromHHMM(night)) {
      await store.markNinePmNotify();
    }
  }
}
