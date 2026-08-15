import type { Player } from '../types';
import { todayISO } from './gamification';

/** Jugador Gerardex en estado inicial — Odyssey independiente del Academic OS legacy */
export function createDefaultPlayer(): Player {
  return {
    id: 'gerardex',
    level: 1,
    xp: 0,
    titles: [],
    weapons: [],
    skins: ['default'],
    currentSkin: 'default',
    lastStudyDate: null,
    studyStreak: 0,
    todayStudyMinutes: 0,
    yesterdayStudyMinutes: 0,
    consecutiveBlocks: 0,
    lastActiveDate: todayISO(),
    lastActivityAt: new Date().toISOString(),
    badges: [],
    unlockedAnimations: [],
    dailyBonusActive: true,
    panelTheme: 'bronze',
    showAnimations: true,
    autoOracleEnabled: false,
    oracleProfile: {
      scheduleStart: '08:00',
      scheduleEnd: '22:00',
      blockMinutes: 30,
      coursePriorities: {},
      unitFocus: {},
    },
    hadesEmailEnabled: true,
    browserNotificationsEnabled: true,
    currentInterfaceSkin: 'default',
    perfectDaysCount: 0,
    totalBlocksCompleted: 0,
    dailyMissionStreak: 0,
  };
}

/** Versión de reset — incrementar para forzar arranque limpio en todos los clientes */
export const ODYSSEY_RESET_VERSION = 5;
