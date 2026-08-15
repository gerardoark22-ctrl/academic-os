import type { Player } from '../types';
import { PLAYER_CONFIG } from './playerConfig';
import { xpThresholdForLevel } from './gamification';

export interface Condemnation {
  headline: string;
  punishment: string;
  detail: string;
  xpAtRisk: number;
  xpToLoseNow: number;
  streakBroken: boolean;
  levelDropPossible: boolean;
  condemnationPercent: number;
}

export function computeCondemnation(underworldDays: number, player: Player | null): Condemnation {
  const days = Math.max(1, underworldDays);
  const xp = player?.xp ?? 0;
  const level = player?.level ?? 1;
  const streak = player?.studyStreak ?? 0;
  const penaltyPerDay = PLAYER_CONFIG.xpPenaltyInactive;
  const xpToLoseNow = penaltyPerDay * Math.min(days, 3);
  const xpAtRisk = penaltyPerDay * days + (days >= 3 ? PLAYER_CONFIG.dailyBonusXp * 2 : 0);

  const prevLevelThreshold = xpThresholdForLevel(level);
  const levelDropPossible = xp - xpToLoseNow < prevLevelThreshold && level > 1;

  const streakBroken = streak > 0;

  const condemnationPercent = Math.min(100, days * 15);

  let headline = 'CONDENA REGISTRADA EN EL LIBRO DE HADES';
  if (days >= 7) headline = 'SENTENCIA DE DESTIERRO DEL OLIMPO';
  else if (days >= 3) headline = 'VEREDICTO: CÓMPLICE DE LA PEREZA';

  const punishments: string[] = [
    `−${xpToLoseNow} XP ejecutados al amanecer`,
    streakBroken ? `Racha de ${streak} días aniquilada` : 'Sin racha que protegerte',
  ];
  if (levelDropPossible) {
    punishments.push(`Peligro de caer al nivel ${level - 1}`);
  }
  if (days >= 2) {
    punishments.push('Bonus diario de 3h revocado');
  }
  if (days >= 5) {
    punishments.push('Gerardex pierde brillo y skins quedan opacas');
  }

  const punishment = punishments.join(' · ');

  const detail =
    days >= 7
      ? 'Cada hora sin bloque de estudio sella tu nombre más profundo en el Inframundo. No hay perdón automático.'
      : days >= 3
        ? 'Estudiar hoy reduce la sentencia. Ignorarlo multiplica el castigo mañana.'
        : 'Aún puedes apagar esta condena con 3 horas de estudio. Después, Hades cobra.';

  return {
    headline,
    punishment,
    detail,
    xpAtRisk,
    xpToLoseNow,
    streakBroken,
    levelDropPossible,
    condemnationPercent,
  };
}

export function condemnationNotifyTitle(days: number): string {
  return days === 1
    ? '⚰️ 1 día en el Inframundo — Academic OS'
    : `⚰️ ${days} días en el Inframundo — CASTIGO ACTIVO`;
}

export function condemnationNotifyBody(c: Condemnation): string {
  return `${c.punishment}. ${c.detail}`;
}
