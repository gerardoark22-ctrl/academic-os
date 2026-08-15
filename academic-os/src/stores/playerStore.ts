import { create } from 'zustand';
import { db } from '../utils/db';
import { persistPlayer } from '../utils/persist';
import type { Player } from '../types';
import {
  calculateLevel,
  getGerardexStage,
  epicTitles,
  todayISO,
  underworldDays,
  daysBetween,
  generateId,
  getEffectiveTodayStudyMinutes,
} from '../utils/gamification';
import { INTERFACE_SKINS, GERARDEX_SKINS, type ChestReward, getActiveSkinDef, getSkinXpMultiplier } from '../utils/cosmetics';
import { sanitizePlayer } from '../utils/appSanity';
import { createDefaultPlayer } from '../utils/defaultPlayer';
import { syncBrowserNotificationPolicy } from '../utils/notificationPolicy';
import { clearBrowserNotifTag } from '../utils/notificationGate';
import { heraldMessages, createNotification } from '../utils/notifications';
import { ensureDaySnapshot, restoreDayProgressOnly, hasDaySnapshot } from '../utils/daySnapshot';
import {
  getDailyGoalMinutes,
  getScaledDailyBonusXp,
  formatGoalHoursMinutes,
  clampDailyGoalMinutes,
} from '../utils/dailyGoal';
import type { NotificationMessage, BlockCompletionGrant } from '../types';
import { PLAYER_CONFIG, GERARDEX_COMIC } from '../utils/playerConfig';
import { hadesShieldsPenalty, getWeekKey } from '../utils/hadesShield';
import { patchForHadesSlot } from '../utils/hadesSlotTracking';
import { applyPendingHadesEmailConfig } from '../utils/hadesEmailConfig';
import {
  type ActiveCelebration,
  type GeneralCelebration,
  type LevelUpCelebration,
  levelUpsBetween,
} from '../utils/celebrationPipeline';
const STREAK_7_TITLE = 'Domador de la Racha Épica';
const STREAK_7_SKIN = 'golden';
const STREAK_7_BADGE = '🔥 Racha 7';

let underworldPenaltyInFlight = false;
let goalBonusGrantInFlight = false;
let rolloverPromise: Promise<void> | null = null;
const pendingCelebrations: GeneralCelebration[] = [];
const pendingLevelUps: LevelUpCelebration[] = [];

function advanceCelebrationPipeline(get: () => PlayerState, set: (partial: Partial<PlayerState>) => void): void {
  const { xpCelebrations, celebration } = get();
  if (xpCelebrations.length > 0 || celebration) return;

  const nextGeneral = pendingCelebrations.shift();
  if (nextGeneral) {
    set({ celebration: nextGeneral });
    return;
  }

  const nextLevel = pendingLevelUps.shift();
  if (nextLevel) {
    set({ celebration: nextLevel });
  }
}

function enqueueGeneral(item: GeneralCelebration, _get: () => PlayerState, _set: (partial: Partial<PlayerState>) => void): void {
  pendingCelebrations.push(item);
}

function enqueueLevelUps(items: LevelUpCelebration[], _get: () => PlayerState, _set: (partial: Partial<PlayerState>) => void): void {
  if (items.length === 0) return;
  pendingLevelUps.push(...items);
}

export function clearCelebrationQueues(): void {
  pendingCelebrations.length = 0;
  pendingLevelUps.length = 0;
}

function defaultPlayer(): Player {
  return createDefaultPlayer();
}

interface PlayerState {
  player: Player | null;
  notifications: NotificationMessage[];
  loading: boolean;
  load: () => Promise<void>;
  addXP: (amount: number, reason?: string) => Promise<void>;
  loseXP: (amount: number, reason?: string) => Promise<void>;
  completeStudyBlock: (opts?: { grantXp?: boolean }) => Promise<import('../types').BlockCompletionGrant>;
  revertStudyBlock: (grant: import('../types').BlockCompletionGrant) => Promise<void>;
  ensureDailyRollover: () => Promise<void>;
  recordStudy: () => Promise<void>;
  recordStudyMinutes: (minutes: number) => Promise<void>;
  subtractStudyMinutes: (minutes: number) => Promise<void>;
  unlockTitle: (title: string) => Promise<void>;
  unlockSkin: (skin: string) => Promise<void>;
  unlockBadge: (badge: string) => Promise<void>;
  setSkin: (skin: string) => Promise<void>;
  setPanelTheme: (theme: import('../utils/progressGradients').PanelTheme) => Promise<void>;
  setActiveTitle: (title: string) => Promise<void>;
  setShowAnimations: (on: boolean) => Promise<void>;
  setInterfaceSkin: (id: string) => Promise<void>;
  claimChest: (reward: import('../utils/cosmetics').ChestReward) => Promise<void>;
  markChestOpened: () => Promise<void>;
  syncUnlockables: () => Promise<void>;
  addNotification: (n: NotificationMessage) => void;
  markNotificationRead: (id: string) => void;
  getStage: () => ReturnType<typeof getGerardexStage> | null;
  getEpicTitles: () => typeof epicTitles;
  getInterfaceSkins: () => Array<(typeof INTERFACE_SKINS)[number] & { unlocked: boolean }>;
  getTodayStudyMinutes: () => number;
  isDailyGoalMet: () => boolean;
  isDirty: () => boolean;
  celebration: ActiveCelebration | null;
  xpCelebrations: Array<{ id: string; amount: number; reason?: string }>;
  pushXpCelebration: (amount: number, reason?: string) => void;
  dismissXpCelebration: (id: string) => void;
  clearXpCelebrations: () => void;
  triggerCelebration: (type: 'perfect-day', data: { xpBonus: number; nightBonus: number }) => void;
  triggerLevelDownCelebration: (level: number, title: string) => void;
  triggerAchievementCelebration: (name: string, emoji: string) => void;
  clearCelebration: () => void;
  advanceCelebrationPipeline: () => void;
  forgeFlash: number;
  triggerForgeFlash: () => void;
  markPerfectDay: () => Promise<void>;
  markNightBonusClaimed: () => Promise<void>;
  setAutoOracle: (on: boolean) => Promise<void>;
  updateOracleProfile: (patch: Partial<import('../types').OracleProfile>) => Promise<void>;
  markVerdadRevealed: () => Promise<void>;
  markOracleBriefing: () => Promise<void>;
  markShameEmailSent: () => Promise<void>;
  applyUnderworldPenalty: (amount: number, reason: string) => Promise<void>;
  markHadesEmailSlot: (slot: import('../utils/hadesRules').HadesEmailSlot) => Promise<void>;
  markNinePmNotify: () => Promise<void>;
  touchAppOpen: () => Promise<void>;
  touchActivity: () => Promise<void>;
  syncTopicBacklogEscalation: (active: boolean) => Promise<number>;
  resetCompleteDay: () => Promise<boolean>;
  resetTodayDailyProgress: () => Promise<void>;
  applyTodayStudyBaseline: () => Promise<void>;
  setDailyGoalMinutes: (minutes: number) => Promise<void>;
  ensureHadesEmailConfig: () => Promise<void>;
  updateBlockSchedule: (start: string, end: string) => Promise<void>;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  player: null,
  notifications: [],
  loading: true,
  celebration: null,
  xpCelebrations: [],
  forgeFlash: 0,

  load: async () => {
    let player = await db.player.get('gerardex');
    if (!player) {
      player = defaultPlayer();
      await persistPlayer(player);
    } else {
      player = { ...defaultPlayer(), ...player };
      if (player.hadesEmailEnabled !== false) {
        player.browserNotificationsEnabled = true;
      }
      await persistPlayer(player);
    }
    set({ player, loading: false, notifications: [] });
    syncBrowserNotificationPolicy(player.browserNotificationsEnabled);
    await get().ensureHadesEmailConfig();
    await get().ensureDailyRollover();
    const { player: sanitized, report } = sanitizePlayer(get().player ?? player);
    if (report.fixed.length > 0) {
      await persistPlayer(sanitized);
      set({ player: sanitized });
      syncBrowserNotificationPolicy(sanitized.browserNotificationsEnabled);
    }
  },

  ensureHadesEmailConfig: async () => {
    const { player } = get();
    if (!player) return;
    const { player: merged, applied } = applyPendingHadesEmailConfig(player);
    if (!applied) return;
    await persistPlayer(merged);
    set({ player: merged });
  },

  ensureDailyRollover: async () => {
    await get().ensureHadesEmailConfig();
    if (rolloverPromise) return rolloverPromise;
    rolloverPromise = (async () => {
      try {
        const { player, notifications } = get();
        if (!player) return;

        const today = todayISO();

        if (player.lastActiveDate === today) {
          await ensureDaySnapshot(today);
          return;
        }

        const yMinutes = player.todayStudyMinutes ?? 0;
        const daysMissed = player.lastActiveDate
          ? daysBetween(player.lastActiveDate, today)
          : 0;
        const updates: Partial<Player> = {
          yesterdayStudyMinutes: daysMissed === 1 ? yMinutes : 0,
          todayStudyMinutes: 0,
          consecutiveBlocks: 0,
          lastActiveDate: today,
          dailyBonusActive: true,
          goalMetDate: undefined,
        };

        const newNotifications = [...notifications];

        if (player.lastActiveDate && player.lastActiveDate !== today) {
          if (daysMissed > 1) {
            updates.studyStreak = 0;
            updates.dailyBonusActive = false;
            newNotifications.push(
              createNotification('hades', `⚰️ ${daysMissed - 1} días de ausencia — racha reiniciada`),
            );
          } else if (yMinutes === 0) {
            updates.studyStreak = 0;
            updates.dailyBonusActive = false;
            newNotifications.push(
              createNotification('herald', '📜 Ayer no estudiaste — racha reiniciada'),
            );
          } else if (yMinutes < getDailyGoalMinutes(player)) {
            updates.studyStreak = 0;
            updates.dailyBonusActive = false;
            const hades = hadesShieldsPenalty(player, today, yMinutes);
            if (hades.useWeeklyShield) {
              updates.hadesWeeklyShieldWeek = getWeekKey(today);
            }
            if (!hades.skip && player.lastPenaltyDate !== today) {
              const penalty = PLAYER_CONFIG.xpPenaltyInactive;
              updates.xp = Math.max(0, player.xp - penalty);
              updates.level = calculateLevel(updates.xp ?? player.xp);
              updates.lastPenaltyDate = today;
              newNotifications.push(createNotification('zeus', GERARDEX_COMIC.zeusFail));
              newNotifications.push(createNotification('herald', GERARDEX_COMIC.xpLoss));
            } else if (hades.skip) {
              newNotifications.push(
                createNotification('herald', '💀 Skin Inframundo — penalización XP anulada'),
              );
            }
          } else if (yMinutes >= getDailyGoalMinutes(player) && player.goalMetDate === player.lastActiveDate) {
            const newStreak = (player.studyStreak ?? 0) + 1;
            updates.studyStreak = newStreak;
            newNotifications.push(
              createNotification('herald', GERARDEX_COMIC.streak(newStreak)),
            );
            if (newStreak === PLAYER_CONFIG.streakMilestone7) {
              if (!player.titles.includes(STREAK_7_TITLE)) {
                updates.titles = [...player.titles, STREAK_7_TITLE];
              }
              if (!player.skins.includes(STREAK_7_SKIN)) {
                updates.skins = [...player.skins, STREAK_7_SKIN];
              }
              if (!player.badges?.includes(STREAK_7_BADGE)) {
                updates.badges = [...(player.badges ?? []), STREAK_7_BADGE];
              }
              newNotifications.push(
                createNotification('herald', '🏆 ¡7 días! Título exclusivo + skin dorada + badge desbloqueados'),
              );
            }
          }
        }

        const updated = { ...player, ...updates };
        await persistPlayer(updated);
        set({ player: updated, notifications: newNotifications, celebration: null, xpCelebrations: [] });
        clearCelebrationQueues();

        await ensureDaySnapshot(today);

        const { syncDailyMissions } = await import('./dailyMissionsStore');
        syncDailyMissions();
      } finally {
        rolloverPromise = null;
      }
    })();
    return rolloverPromise;
  },

  addXP: async (amount, reason) => {
    await get().ensureDailyRollover();
    await get().touchActivity();
    const { player, notifications } = get();
    if (!player) return;

    const oldLevel = calculateLevel(player.xp);
    const newXp = player.xp + amount;
    const newLevel = calculateLevel(newXp);
    const updated: Player = { ...player, xp: newXp, level: newLevel };
    const newNotifications = [...notifications];
    let queuedLevelUps = false;

    if (newLevel > oldLevel) {
      newNotifications.push(createNotification('herald', heraldMessages.levelUp(newLevel)));
      const lastCelebrated = player.lastLevelCelebrated ?? 0;
      if (lastCelebrated < newLevel) {
        const levelUps = levelUpsBetween(oldLevel, newLevel, lastCelebrated);
        enqueueLevelUps(levelUps, get, set);
        queuedLevelUps = levelUps.length > 0;
        if (queuedLevelUps) {
          updated.lastLevelCelebrated = newLevel;
        }
      }
    }
    if (reason) {
      newNotifications.push(createNotification('herald', `📜 +${amount} XP — ${reason}`));
    }

    if (amount > 0) {
      get().pushXpCelebration(amount, reason);
    }

    await persistPlayer(updated);
    set({ player: updated, notifications: newNotifications });

    if (queuedLevelUps) {
      advanceCelebrationPipeline(get, set);
    }

    if (newLevel > oldLevel) {
      window.setTimeout(() => void get().syncUnlockables(), 120);
    }
  },

  loseXP: async (amount, reason) => {
    const { player, notifications } = get();
    if (!player) return;

    const oldLevel = calculateLevel(player.xp);
    const newXp = Math.max(0, player.xp - amount);
    const newLevel = calculateLevel(newXp);
    const updated: Player = { ...player, xp: newXp, level: newLevel };
    if (newLevel < oldLevel) {
      updated.lastLevelCelebrated = newLevel;
    }
    await persistPlayer(updated);

    const newNotifications = [...notifications];
    if (newLevel < oldLevel) {
      const stage = getGerardexStage(newLevel);
      newNotifications.push(createNotification('hades', heraldMessages.levelDown(newLevel)));
      get().triggerLevelDownCelebration(newLevel, stage.title);
    }
    if (reason) {
      newNotifications.push(createNotification('hades', `⚰️ −${amount} XP — ${reason}`));
    }
    set({ player: updated, notifications: newNotifications });
  },

  applyUnderworldPenalty: async (amount, reason) => {
    const today = todayISO();
    const { player } = get();
    if (!player || player.lastUnderworldPenaltyDate === today) return;
    if (player.lastStudyDate === today) return;
    if (underworldPenaltyInFlight) return;

    underworldPenaltyInFlight = true;
    try {
      await get().loseXP(amount, reason);
      const current = get().player;
      if (!current) return;

      const updated: Player = {
        ...current,
        lastUnderworldPenaltyDate: today,
        lastXpPenaltyAmount: amount,
        studyStreak: 0,
      };
      await persistPlayer(updated);
      set({ player: updated });
    } finally {
      underworldPenaltyInFlight = false;
    }
  },

  markHadesEmailSlot: async (slot) => {
    const { player } = get();
    if (!player) return;
    const updated = { ...player, ...patchForHadesSlot(slot) };
    await persistPlayer(updated);
    set({ player: updated });
  },

  markNinePmNotify: async () => {
    const { player } = get();
    if (!player) return;
    const updated = { ...player, lastNinePmNotifyDate: todayISO() };
    await persistPlayer(updated);
    set({ player: updated });
  },

  touchActivity: async () => {
    const { player } = get();
    if (!player) return;
    const now = new Date().toISOString();
    const today = todayISO();
    const updated = { ...player, lastActivityAt: now, lastAppOpenDate: today };
    await persistPlayer(updated);
    set({ player: updated });
  },

  touchAppOpen: async () => {
    await get().ensureDailyRollover();
    await get().touchActivity();
    const { useDailyMissionsStore } = await import('./dailyMissionsStore');
    await useDailyMissionsStore.getState().ensureToday();
    await get().syncUnlockables();
  },

  syncTopicBacklogEscalation: async (active) => {
    const { player } = get();
    if (!player) return 0;
    const today = todayISO();

    if (!active) {
      if ((player.topicBacklogEscalation ?? 0) === 0 && !player.topicBacklogSince) return 0;
      if ((player.topicBacklogEscalation ?? 0) > 0 || player.topicBacklogSince) {
        const updated = { ...player, topicBacklogEscalation: 0, topicBacklogSince: undefined };
        await persistPlayer(updated);
        set({ player: updated });
      }
      return 0;
    }

    if (!player.topicBacklogSince) {
      const updated = { ...player, topicBacklogSince: today, topicBacklogEscalation: 1 };
      await persistPlayer(updated);
      set({ player: updated });
      return 1;
    }

    const since = new Date(player.topicBacklogSince);
    const now = new Date(today);
    since.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const daysSince = Math.floor((now.getTime() - since.getTime()) / (1000 * 60 * 60 * 24));
    const level = Math.min(5, 1 + daysSince);

    if (level === (player.topicBacklogEscalation ?? 0)) return level;

    const updated = { ...player, topicBacklogEscalation: level };
    await persistPlayer(updated);
    set({ player: updated });
    return level;
  },

  completeStudyBlock: async (opts?: { grantXp?: boolean }): Promise<BlockCompletionGrant> => {
    await get().ensureDailyRollover();
    const { player } = get();
    if (!player) return { blockXp: 0, goalBonus: 0, minutes: 0 };

    const grantXp = opts?.grantXp !== false;
    const today = todayISO();
    const consecutive = (player.lastActiveDate === today ? (player.consecutiveBlocks ?? 0) : 0) + 1;
    let comboBonus =
      consecutive > 1 ? (consecutive - 1) * PLAYER_CONFIG.consecutiveBlockBonus : 0;
    const skin = getActiveSkinDef(player);
    if (skin.mechanic === 'combo' && comboBonus > 0) comboBonus *= 2;
    const xpGain = grantXp
      ? Math.round((PLAYER_CONFIG.xpPerBlock + comboBonus) * getSkinXpMultiplier(player))
      : 0;

    const baseMinutes = player.lastActiveDate === today ? (player.todayStudyMinutes ?? 0) : 0;
    const todayMinutes = baseMinutes + PLAYER_CONFIG.blockMinutes;

    const updated: Player = {
      ...player,
      todayStudyMinutes: todayMinutes,
      consecutiveBlocks: consecutive,
      totalBlocksCompleted: (player.totalBlocksCompleted ?? 0) + 1,
      lastStudyDate: today,
      lastActiveDate: today,
    };
    await persistPlayer(updated);
    set({ player: updated });
    clearBrowserNotifTag(`underworld-penalty-${today}`);

    if (grantXp && xpGain > 0) {
      await get().addXP(xpGain, `Bloque de estudio${comboBonus ? ` (+${comboBonus} combo)` : ''}`);
    }

    let goalBonus = 0;
    const goalMinutes = getDailyGoalMinutes(updated);
    if (todayMinutes >= goalMinutes && updated.goalMetDate !== today && !goalBonusGrantInFlight) {
      goalBonusGrantInFlight = true;
      try {
        const freshGoal = get().player;
        if (freshGoal && freshGoal.goalMetDate !== today) {
          const goalPlayer: Player = { ...freshGoal, goalMetDate: today };
          await persistPlayer(goalPlayer);
          set({ player: goalPlayer });

          goalBonus = getScaledDailyBonusXp(goalMinutes);
          await get().addXP(goalBonus, `Meta diaria ${formatGoalHoursMinutes(goalMinutes)} cumplida`);
          set({
            notifications: [
              ...get().notifications,
              createNotification('herald', GERARDEX_COMIC.studyGoalMet),
            ],
          });
        }
      } finally {
        goalBonusGrantInFlight = false;
      }
    }

    return { blockXp: xpGain, goalBonus, minutes: PLAYER_CONFIG.blockMinutes };
  },

  revertStudyBlock: async (grant) => {
    const { player } = get();
    if (!player || (grant.blockXp <= 0 && grant.goalBonus <= 0 && grant.minutes <= 0)) return;

    const totalXp = grant.blockXp + grant.goalBonus;
    if (totalXp > 0) {
      await get().loseXP(totalXp, 'Bloque desmarcado — XP revertida');
    }

    if (grant.minutes > 0) {
      await get().subtractStudyMinutes(grant.minutes);
    }

    const today = todayISO();
    const fresh = get().player;
    if (!fresh) return;

    const afterMinutes = fresh.todayStudyMinutes ?? 0;
    const goalMinutes = getDailyGoalMinutes(fresh);
    const updates: Partial<Player> = {
      consecutiveBlocks: Math.max(0, (fresh.consecutiveBlocks ?? 1) - 1),
      totalBlocksCompleted: Math.max(0, (fresh.totalBlocksCompleted ?? 1) - 1),
    };

    if (grant.goalBonus > 0 || (fresh.goalMetDate === today && afterMinutes < goalMinutes)) {
      updates.goalMetDate = undefined;
    }

    const reverted = { ...fresh, ...updates };
    await persistPlayer(reverted);
    set({ player: reverted });
  },

  recordStudy: async () => {
    const { player } = get();
    if (!player) return;
    const today = todayISO();
    const updated = { ...player, lastStudyDate: today };
    await persistPlayer(updated);
    set({ player: updated });
  },

  recordStudyMinutes: async (minutes: number) => {
    await get().touchActivity();
    await get().ensureDailyRollover();
    const { player } = get();
    if (!player || minutes <= 0) return;

    const today = todayISO();
    const todayMinutes = (player.todayStudyMinutes ?? 0) + minutes;
    const updated: Player = {
      ...player,
      todayStudyMinutes: todayMinutes,
      lastStudyDate: today,
    };
    await persistPlayer(updated);
    set({ player: updated });

    const goalMinutes = getDailyGoalMinutes(updated);
    if (todayMinutes >= goalMinutes && updated.goalMetDate !== today && !goalBonusGrantInFlight) {
      goalBonusGrantInFlight = true;
      try {
        const fresh = get().player;
        if (fresh && fresh.goalMetDate !== today) {
          const goalPlayer: Player = { ...fresh, goalMetDate: today };
          await persistPlayer(goalPlayer);
          set({ player: goalPlayer });
          const bonusXp = getScaledDailyBonusXp(goalMinutes);
          await get().addXP(bonusXp, `Meta diaria ${formatGoalHoursMinutes(goalMinutes)} cumplida`);
          set({
            notifications: [
              ...get().notifications,
              createNotification('herald', GERARDEX_COMIC.studyGoalMet),
            ],
          });
        }
      } finally {
        goalBonusGrantInFlight = false;
      }
    }
  },

  subtractStudyMinutes: async (minutes: number) => {
    const { player } = get();
    if (!player || minutes <= 0) return;
    const todayMinutes = Math.max(0, (player.todayStudyMinutes ?? 0) - minutes);
    const updated: Player = { ...player, todayStudyMinutes: todayMinutes };
    await persistPlayer(updated);
    set({ player: updated });
  },

  unlockTitle: async (title) => {
    const { player } = get();
    if (!player || player.titles.includes(title)) return;
    const updated = { ...player, titles: [...player.titles, title] };
    await persistPlayer(updated);
    set({ player: updated });
  },

  unlockSkin: async (skin) => {
    const { player } = get();
    if (!player || player.skins.includes(skin)) return;
    const updated = { ...player, skins: [...player.skins, skin] };
    await persistPlayer(updated);
    set({ player: updated });
  },

  unlockBadge: async (badge) => {
    const { player } = get();
    if (!player || player.badges?.includes(badge)) return;
    const updated = { ...player, badges: [...(player.badges ?? []), badge] };
    await persistPlayer(updated);
    set({ player: updated });
  },

  setSkin: async (skin) => {
    const { player } = get();
    if (!player || !player.skins.includes(skin)) return;
    const updated = { ...player, currentSkin: skin };
    await persistPlayer(updated);
    set({ player: updated });
    get().triggerForgeFlash();
  },

  setPanelTheme: async (theme) => {
    const { player } = get();
    if (!player) return;
    const { isPanelThemeUnlocked } = await import('../utils/progressGradients');
    if (!isPanelThemeUnlocked(theme, player.level)) return;
    const updated = { ...player, panelTheme: theme };
    await persistPlayer(updated);
    set({ player: updated });
    get().triggerForgeFlash();
  },

  setActiveTitle: async (title) => {
    const { player } = get();
    if (!player) return;
    const updated = { ...player, activeTitle: title };
    await persistPlayer(updated);
    set({ player: updated });
    get().triggerForgeFlash();
  },

  setShowAnimations: async (on) => {
    const { player } = get();
    if (!player) return;
    const updated = { ...player, showAnimations: on };
    await persistPlayer(updated);
    set({ player: updated });
  },

  addNotification: (n) =>
    set((s) => {
      const today = todayISO();
      const dup = s.notifications.some(
        (x) => x.message === n.message && x.type === n.type && x.timestamp.startsWith(today),
      );
      if (dup) return s;
      return { notifications: [n, ...s.notifications].slice(0, 80) };
    }),
  markNotificationRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    })),

  getStage: () => {
    const { player } = get();
    return player ? getGerardexStage(player.level) : null;
  },

  getEpicTitles: () => {
    const { player } = get();
    return epicTitles.map((t) => ({
      ...t,
      unlocked: player?.titles.includes(t.name) ?? false,
    }));
  },

  getInterfaceSkins: () => {
    const { player } = get();
    const level = player?.level ?? 1;
    return INTERFACE_SKINS.map((s) => ({
      ...s,
      unlocked: level >= s.minLevel,
    }));
  },

  getTodayStudyMinutes: () => getEffectiveTodayStudyMinutes(get().player),

  isDailyGoalMet: () => {
    const player = get().player;
    if (!player) return false;
    return getEffectiveTodayStudyMinutes(player) >= getDailyGoalMinutes(player);
  },

  isDirty: () => {
    const player = get().player;
    if (!player) return false;
    const uw = underworldDays(player.lastStudyDate);
    if (uw > 0) return true;
    const todayMin = getEffectiveTodayStudyMinutes(player);
    if (!player.dailyBonusActive && todayMin < getDailyGoalMinutes(player)) return true;
    return false;
  },

  triggerCelebration: (type, data) => {
    enqueueGeneral({ type, ...data }, get, set);
  },
  triggerLevelDownCelebration: (level, title) => {
    enqueueGeneral({ type: 'level-down', level, title }, get, set);
  },
  triggerAchievementCelebration: (name, emoji) => {
    enqueueGeneral({ type: 'achievement', name, emoji }, get, set);
  },
  clearCelebration: () => {
    set({ celebration: null });
    advanceCelebrationPipeline(get, set);
  },
  advanceCelebrationPipeline: () => advanceCelebrationPipeline(get, set),
  pushXpCelebration: (amount, reason) =>
    set((s) => ({
      xpCelebrations: [
        ...s.xpCelebrations,
        { id: generateId(), amount, reason },
      ].slice(-8),
    })),
  dismissXpCelebration: (id) =>
    set((s) => ({
      xpCelebrations: s.xpCelebrations.filter((x) => x.id !== id),
    })),
  clearXpCelebrations: () => {
    set({ xpCelebrations: [] });
    advanceCelebrationPipeline(get, set);
  },
  triggerForgeFlash: () => set({ forgeFlash: Date.now() }),

  markPerfectDay: async () => {
    const { player } = get();
    if (!player) return;
    const updated = {
      ...player,
      perfectDayDate: todayISO(),
      perfectDaysCount: (player.perfectDaysCount ?? 0) + 1,
    };
    await persistPlayer(updated);
    set({ player: updated });
  },

  markNightBonusClaimed: async () => {
    const { player } = get();
    if (!player) return;
    const updated = { ...player, nightBonusClaimedDate: todayISO() };
    await persistPlayer(updated);
    set({ player: updated });
  },

  setAutoOracle: async (on) => {
    const { player } = get();
    if (!player) return;
    const updated = { ...player, autoOracleEnabled: on };
    await persistPlayer(updated);
    set({ player: updated });
  },

  updateOracleProfile: async (patch) => {
    const { player } = get();
    if (!player) return;
    const updated = {
      ...player,
      oracleProfile: { ...(player.oracleProfile ?? {}), ...patch },
    };
    await persistPlayer(updated);
    set({ player: updated });
  },

  markVerdadRevealed: async () => {
    const { player } = get();
    if (!player) return;
    const updated = { ...player, lastVerdadAt: new Date().toISOString() };
    await persistPlayer(updated);
    set({ player: updated });
  },

  markOracleBriefing: async () => {
    const { player } = get();
    if (!player) return;
    const updated = { ...player, lastOracleBriefingDate: todayISO() };
    await persistPlayer(updated);
    set({ player: updated });
  },

  markShameEmailSent: async () => {
    const { player } = get();
    if (!player) return;
    const updated = { ...player, lastShameEmailDate: todayISO() };
    await persistPlayer(updated);
    set({ player: updated });
  },

  setInterfaceSkin: async (id) => {
    const { player } = get();
    if (!player) return;
    const skin = INTERFACE_SKINS.find((s) => s.id === id);
    if (skin && player.level < skin.minLevel) return;
    const updated = { ...player, currentInterfaceSkin: id };
    await persistPlayer(updated);
    set({ player: updated });
    get().triggerForgeFlash();
  },

  claimChest: async (reward: ChestReward) => {
    const { player } = get();
    if (!player) return;
    const now = new Date().toISOString();
    const chestDate = todayISO();
    if (reward.type === 'xp') {
      const updated = { ...player, lastChestDate: chestDate, lastChestAt: now };
      await persistPlayer(updated);
      set({ player: updated });
      await get().addXP(reward.amount, 'Cofre de guerra');
      return;
    }
    let updated = { ...player, lastChestDate: chestDate, lastChestAt: now };
    if (reward.type === 'skin' && !player.skins.includes(reward.skinId)) {
      updated = { ...updated, skins: [...player.skins, reward.skinId] };
    }
    if (reward.type === 'title' && !player.titles.includes(reward.title)) {
      updated = { ...updated, titles: [...player.titles, reward.title] };
    }
    await persistPlayer(updated);
    set({ player: updated });
  },

  markChestOpened: async () => {
    const { player } = get();
    if (!player) return;
    const now = new Date().toISOString();
    const updated = { ...player, lastChestDate: todayISO(), lastChestAt: now };
    await persistPlayer(updated);
    set({ player: updated });
  },

  syncUnlockables: async () => {
    const { player } = get();
    if (!player) return;

    const { useCoursesStore } = await import('./coursesStore');
    const { useMissionsStore } = await import('./missionsStore');
    const { computeUnlockExtras } = await import('../utils/cosmetics');
    const courses = useCoursesStore.getState().courses;
    const missions = useMissionsStore.getState().missions;
    const extras = computeUnlockExtras(player, courses, missions);

    const newSkins = [...player.skins];
    const unlockedNow: typeof GERARDEX_SKINS = [];
    for (const skin of GERARDEX_SKINS) {
      if (!newSkins.includes(skin.id) && skin.checkUnlock(player, extras)) {
        newSkins.push(skin.id);
        unlockedNow.push(skin);
      }
    }
    if (newSkins.length !== player.skins.length) {
      const updated = { ...player, skins: newSkins };
      await persistPlayer(updated);
      set({ player: updated });
      const latest = unlockedNow[unlockedNow.length - 1];
      if (latest) {
        get().triggerAchievementCelebration(latest.label, latest.emoji);
      }
    }

    const current = get().player ?? player;
    const { getEffectivePanelTheme, isPanelThemeUnlocked } = await import('../utils/progressGradients');
    const selected = current.panelTheme ?? 'bronze';
    if (!isPanelThemeUnlocked(selected, current.level)) {
      const fallback = getEffectivePanelTheme(current.level, selected);
      const updated = { ...current, panelTheme: fallback };
      await persistPlayer(updated);
      set({ player: updated });
    }
  },

  resetCompleteDay: async () => {
    const today = todayISO();
    if (!(await hasDaySnapshot(today))) return false;

    const ok = await restoreDayProgressOnly(today);
    if (!ok) return false;

    const { useCoursesStore } = await import('./coursesStore');
    const { useMissionsStore } = await import('./missionsStore');
    const { useTimeStore } = await import('./timeStore');
    const { resetTodayQuestProgress } = await import('./dailyMissionsStore');

    await Promise.all([
      get().load(),
      useCoursesStore.getState().load(),
      useMissionsStore.getState().load(),
      useTimeStore.getState().load(today),
    ]);
    await resetTodayQuestProgress();

    clearCelebrationQueues();
    set({ celebration: null, xpCelebrations: [] });

    get().addNotification(
      createNotification(
        'zeus',
        '⏪ Día reiniciado — XP, progreso, bloques y bonus revertidos (estructura intacta)',
      ),
    );
    return true;
  },

  applyTodayStudyBaseline: async () => {
    const { player } = get();
    if (!player) return;
    const today = todayISO();
    const updated: Player = {
      ...player,
      todayStudyMinutes: 0,
      goalMetDate: undefined,
      consecutiveBlocks: 0,
      lastActiveDate: today,
    };
    await persistPlayer(updated);
    set({ player: updated });
  },

  resetTodayDailyProgress: async () => {
    const { resetTodayDailyProgress: runReset } = await import('../utils/studyProgressReset');
    await runReset();
    clearCelebrationQueues();
    set({ celebration: null, xpCelebrations: [] });
  },

  setDailyGoalMinutes: async (minutes: number) => {
    const { player } = get();
    if (!player) return;

    const next = clampDailyGoalMinutes(minutes);
    if (next !== getDailyGoalMinutes(player)) {
      const updated: Player = { ...player, dailyGoalMinutes: next };
      await persistPlayer(updated);
      set({ player: updated });
    }

    const { useDailyMissionsStore } = await import('./dailyMissionsStore');
    await useDailyMissionsStore.getState().regenerateAllQuests();
  },

  updateBlockSchedule: async (start, end) => {
    const { player } = get();
    if (!player) return;
    const updated = { ...player, dayBlockStart: start, dayBlockEnd: end };
    await persistPlayer(updated);
    set({ player: updated });
    const { useTimeStore } = await import('./timeStore');
    await useTimeStore.getState().load(useTimeStore.getState().selectedDate);
  },
}));

export { PLAYER_CONFIG };
