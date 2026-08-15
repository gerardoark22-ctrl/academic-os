/** Configuración de gamificación personalizada — Gerardex */

export const PLAYER_CONFIG = {
  minStudyHours: 3,
  minStudyBlocks: 6, // 3h × 2 bloques/h
  blockMinutes: 30,
  xpPerBlock: 12,
  consecutiveBlockBonus: 5,
  xpPenaltyInactive: 50,
  dailyBonusXp: 40,
  perfectDayBonusXp: 150,
  nightBonusXp: 75,
  nightBonusHourStart: 20,
  legendaryMissionXp: 500,
  streakMilestone7: 7,
  streakMilestone3: 3,
  dailyMissionXp: { light: 20, medium: 40, heavy: 70 } as const,
  dailyMissionPenalty: { light: 12, medium: 25, heavy: 40 } as const,
  dailyMissionAllCompleteBonusXp: 65,
  dailyMissionStreakBonusXp: 30,
  dailyMissionCount: 5,
  dailyMissionMinCount: 5,
  weeklyMissionXp: { light: 55, medium: 110, heavy: 200 } as const,
  weeklyMissionPenalty: { light: 20, medium: 40, heavy: 65 } as const,
  weeklyMissionAllCompleteBonusXp: 120,
  weeklyMissionMinCount: 4,
  weeklyMissionMaxCount: 8,
  /** Mínimo entre cofres (ms) — máximo uno cada 8 horas */
  chestCooldownMs: 8 * 60 * 60 * 1000,
} as const;

/** Mensajes cómicos de Gerardex */
export const GERARDEX_COMIC = {
  streak: (days: number) =>
    days >= 14
      ? '🐕 Gerardex: "wow, much discipline, very warrior, am impress"'
      : days >= 7
        ? '🐕 Gerardex: "such streak, many focus, wow"'
        : days >= 3
          ? '🐕 Gerardex: "keep going hooman, treats incoming"'
          : '🐕 Gerardex: "one day at a time, best fren"',
  studyGoalMet: '🐕 Gerardex: "3 horas? u are officially based today"',
  studyGoalFail: '🐕 Gerardex: "only {min}h required... Gerardex is disappoint but still loves u"',
  perfectDay: '🐕 Gerardex: "PERFECT DAY! *does victory spin with tiny sword*"',
  xpLoss: '🐕 Gerardex: "Gerardex got muddy... study pls 🥺"',
  zeusFail: '⚡ Zeus: "GERARDEX ESTÁ SUCIO Y TÚ TAMBIÉN. LEVÁNTATE."',
  lootChest: '🎁 ¡Cofre saqueado! Gerardex found loot',
  vsYesterdayWin: '🐕 "yesterday u weak, today u STRONK"',
  vsYesterdayLose: '🐕 "yesterday was better... revenge time?"',
};

export type PanelState = 'radiant' | 'strong' | 'normal' | 'tired' | 'dirty';

export function getPanelState(opts: {
  streak: number;
  todayMinutes: number;
  minMinutes: number;
  underworldDays: number;
  dailyBonusLost: boolean;
}): PanelState {
  if (opts.underworldDays > 0 || (opts.todayMinutes < opts.minMinutes && opts.dailyBonusLost)) {
    return 'dirty';
  }
  if (opts.dailyBonusLost && opts.todayMinutes < opts.minMinutes) return 'tired';
  if (opts.streak >= 14) return 'radiant';
  if (opts.streak >= 7) return 'strong';
  if (opts.streak >= 3) return 'normal';
  return 'normal';
}

export function getStreakGlow(streak: number): string | undefined {
  if (streak >= 14) return '0 0 40px rgba(255, 215, 0, 0.7), 0 0 80px rgba(255, 140, 0, 0.4)';
  if (streak >= 7) return '0 0 30px rgba(255, 215, 0, 0.5), 0 0 50px rgba(205, 133, 63, 0.3)';
  if (streak >= 3) return '0 0 20px rgba(205, 133, 63, 0.45)';
  return undefined;
}

export function getStreakLabel(streak: number): string {
  if (streak >= 30) return '🔥🔥🔥 LEGENDARIO';
  if (streak >= 14) return '🔥🔥 ÉPICO';
  if (streak >= 7) return '🔥 EN LLAMAS';
  if (streak >= 3) return '⚡ ACTIVO';
  return '💤 INICIO';
}
