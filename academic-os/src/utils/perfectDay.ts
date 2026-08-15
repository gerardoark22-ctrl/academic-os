import { db } from './db';
import { todayISO } from './gamification';
import { getLocalParts } from './localTime';
import { PLAYER_CONFIG } from './playerConfig';
import { getDailyGoalMinutes } from './dailyGoal';
import { resolveTodayStudyMinutes } from './studyProgress';
import { usePlayerStore } from '../stores/playerStore';
import { getActiveSkinDef } from './cosmetics';

const PERFECT_SKIN_NIGHT_BONUS = 25;
let perfectDayEvaluating = false;

export async function evaluatePerfectDay(): Promise<{ perfect: boolean; nightBonus: number }> {
  if (perfectDayEvaluating) return { perfect: false, nightBonus: 0 };
  perfectDayEvaluating = true;

  try {
    const player = usePlayerStore.getState().player;
    if (!player) return { perfect: false, nightBonus: 0 };

    const today = todayISO();
    if (player.perfectDayDate === today) return { perfect: false, nightBonus: 0 };

    const blocks = await db.timeblocks.where('date').equals(today).toArray();
    const minutes = resolveTodayStudyMinutes(player, blocks);
    if (minutes < getDailyGoalMinutes(player)) return { perfect: false, nightBonus: 0 };

    const scheduled = blocks.filter((b) => b.title && b.type !== 'rest');
    const allScheduledDone = scheduled.length === 0 || scheduled.every((b) => b.completed);

    if (!allScheduledDone) return { perfect: false, nightBonus: 0 };

    const fresh = usePlayerStore.getState().player;
    if (!fresh || fresh.perfectDayDate === today) return { perfect: false, nightBonus: 0 };

    await usePlayerStore.getState().markPerfectDay();

    let nightBonus = 0;
    const hour = getLocalParts().hours;
    if (hour >= PLAYER_CONFIG.nightBonusHourStart && fresh.nightBonusClaimedDate !== today) {
      nightBonus = PLAYER_CONFIG.nightBonusXp;
      const skin = getActiveSkinDef(fresh);
      if (skin.mechanic === 'perfect' && fresh.skins.includes('perfect')) {
        nightBonus += PERFECT_SKIN_NIGHT_BONUS;
      }
      await usePlayerStore.getState().addXP(nightBonus, 'Bonus nocturno — los dioses recompensan');
      await usePlayerStore.getState().markNightBonusClaimed();
    }

    await usePlayerStore.getState().addXP(PLAYER_CONFIG.perfectDayBonusXp, 'Día perfecto conquistado');

    return { perfect: true, nightBonus };
  } finally {
    perfectDayEvaluating = false;
  }
}

export function triggerPerfectDayCheck() {
  evaluatePerfectDay().then((r) => {
    if (r.perfect) {
      usePlayerStore.getState().triggerCelebration('perfect-day', {
        xpBonus: PLAYER_CONFIG.perfectDayBonusXp,
        nightBonus: r.nightBonus,
      });
    }
  });
}
