import { create } from 'zustand';
import { db } from '../utils/db';
import {
  persistDailyMissionsRecord,
  persistWeeklyMissionsRecord,
  persistSetting,
  persistPlayer,
} from '../utils/persist';
import type {
  DailyMission,
  DailyMissionDayRecord,
  DailyMissionHistoryEntry,
  Player,
  WeeklyMission,
  WeeklyMissionWeekRecord,
} from '../types';
import { todayISO } from '../utils/gamification';
import { generateDailyMissions, buildGenContext } from '../utils/dailyMissionGenerator';
import {
  applyProgressToMission,
  computeMissionProgress,
  dailyMissionPenalty,
  allMissionsComplete,
  syncDailyGoalMissionMeta,
} from '../utils/dailyMissionSync';
import { generateWeeklyMissions, currentWeekKey } from '../utils/weeklyMissionGenerator';
import {
  applyWeeklyProgress,
  computeWeeklyMissionProgress,
  weeklyMissionPenalty,
  allWeeklyComplete,
  countCompletedTopics,
} from '../utils/weeklyMissionSync';
import { getWeekKey } from '../utils/hadesShield';
import { getWeekDateRange } from '../utils/weekRange';
import { usePlayerStore } from './playerStore';
import { useCoursesStore } from './coursesStore';
import { useMissionsStore } from './missionsStore';
import { createNotification } from '../utils/notifications';
import { PLAYER_CONFIG, GERARDEX_COMIC } from '../utils/playerConfig';
import { rollChestReward, type ChestReward, canAwardChest } from '../utils/cosmetics';
import { getDailyGoalMinutes } from '../utils/dailyGoal';
import {
  QUEST_GENERATOR_VERSION,
  dailyRecordNeedsCreativeRegen,
  weeklyRecordNeedsCreativeRegen,
  mergeDailyMissionProgress,
  mergeWeeklyMissionProgress,
} from '../utils/questRegen';
import { enumerateDatesUntil, enumerateWeekKeysUntil } from '../utils/calendarRanges';
import type { Course, Mission } from '../types';

const HISTORY_KEY = 'dailyMissionHistory';
const DAILY_MISSION_STREAK_BADGE = '📜 Racha diaria 7';
const DAILY_MISSION_STREAK_TITLE = 'Guardián del Pergamino';

let refreshInFlight = false;
let refreshPending = false;
let ensureInFlight = false;
let ensurePending = false;

function trimDailyRecord(record: DailyMissionDayRecord): DailyMissionDayRecord {
  const max = PLAYER_CONFIG.dailyMissionCount;
  if (record.missions.length <= max) return record;
  const required = record.missions.filter((m) => m.required);
  const optional = record.missions.filter((m) => !m.required);
  return { ...record, missions: [...required, ...optional].slice(0, max) };
}

function patchWeeklyBaselines(
  record: WeeklyMissionWeekRecord,
  missions: Mission[],
  courses: Course[],
  player?: Player | null,
): WeeklyMissionWeekRecord {
  const missionsCompletedBaseline =
    record.missionsCompletedBaseline ?? missions.filter((m) => m.completed).length;
  const topicsBaseline = record.topicsBaseline ?? countCompletedTopics(courses);
  const xpBaseline = record.xpBaseline ?? player?.xp ?? 0;
  if (
    record.missionsCompletedBaseline !== undefined
    && record.topicsBaseline !== undefined
    && record.xpBaseline !== undefined
  ) {
    return record;
  }
  return {
    ...record,
    missionsCompletedBaseline,
    topicsBaseline,
    xpBaseline,
  };
}

async function loadHistory(): Promise<DailyMissionHistoryEntry[]> {
  const row = await db.settings.get(HISTORY_KEY);
  return (row?.value as DailyMissionHistoryEntry[] | undefined) ?? [];
}

async function saveHistory(entries: DailyMissionHistoryEntry[]): Promise<void> {
  await persistSetting({ key: HISTORY_KEY, value: entries.slice(-90) });
}

async function appendHistory(entry: DailyMissionHistoryEntry): Promise<void> {
  const history = await loadHistory();
  if (history.some((h) => h.date === entry.date)) return;
  await saveHistory([...history, entry]);
}

interface DailyMissionsState {
  record: DailyMissionDayRecord | null;
  weeklyRecord: WeeklyMissionWeekRecord | null;
  history: DailyMissionHistoryEntry[];
  loading: boolean;
  panelOpen: boolean;
  pendingChest: ChestReward | null;
  load: () => Promise<void>;
  ensureToday: () => Promise<void>;
  processYesterday: (previousDate: string) => Promise<void>;
  processLastWeek: (previousWeekKey: string) => Promise<void>;
  refreshProgress: () => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  toggleWeeklyComplete: (id: string) => Promise<void>;
  regenerateAllQuests: () => Promise<void>;
  setPanelOpen: (open: boolean) => void;
  claimPendingChest: () => Promise<void>;
  clearPendingChest: () => void;
  getMissions: () => DailyMission[];
  getWeeklyMissions: () => WeeklyMission[];
  getCompletedCount: () => number;
  getWeeklyCompletedCount: () => number;
}

function queueChest(
  set: (partial: Partial<DailyMissionsState> | ((s: DailyMissionsState) => Partial<DailyMissionsState>)) => void,
  get: () => DailyMissionsState,
  reward: ChestReward,
): boolean {
  const player = usePlayerStore.getState().player;
  if (!player || !canAwardChest(player)) return false;
  if (get().pendingChest) return false;
  set({ pendingChest: reward });
  return true;
}

export async function resetTodayQuestProgress(): Promise<void> {
  const today = todayISO();
  const record = await db.dailyMissions.get(today);
  if (record) {
    const missions = record.missions.map((m) => ({
      ...m,
      progress: 0,
      completed: false,
      completedAt: undefined,
      xpGranted: undefined,
      manualComplete: false,
      autoCompleteBlocked: false,
    }));
    await persistDailyMissionsRecord({ ...record, missions, allCompleteBonusGranted: false });
  }
  await useDailyMissionsStore.getState().load();
}

async function getTodayBlocks() {
  const today = todayISO();
  return db.timeblocks.filter((b) => b.date === today).toArray();
}

async function getWeekBlocks(weekKey: string) {
  const dates = getWeekDateRange(weekKey);
  const chunks = await Promise.all(
    dates.map((d) => db.timeblocks.filter((b) => b.date === d).toArray()),
  );
  return chunks.flat();
}

async function generateAndPersistAllQuests(
  player: Player,
  courses: ReturnType<typeof useCoursesStore.getState>['courses'],
  missions: ReturnType<typeof useMissionsStore.getState>['missions'],
): Promise<{ dailyRecord: DailyMissionDayRecord; weeklyRecord: WeeklyMissionWeekRecord }> {
  const today = todayISO();
  const weekKey = currentWeekKey();
  const todayBlocks = await getTodayBlocks();
  const weekBlocks = await getWeekBlocks(weekKey);
  const goalMinutes = getDailyGoalMinutes(player);

  const dailyRecord: DailyMissionDayRecord = {
    date: today,
    missions: generateDailyMissions(buildGenContext(courses, missions, todayBlocks, player)),
    generatedAt: new Date().toISOString(),
    generatorVersion: QUEST_GENERATOR_VERSION,
    xpBaseline: player.xp,
  };
  await persistDailyMissionsRecord(dailyRecord);

  const weeklyRecord: WeeklyMissionWeekRecord = {
    weekKey,
    missions: generateWeeklyMissions({
      courses,
      missions,
      weekBlocks,
      goalMinutes,
      weekKey,
      player,
    }),
    generatedAt: new Date().toISOString(),
    generatorVersion: QUEST_GENERATOR_VERSION,
    missionsCompletedBaseline: missions.filter((m) => m.completed).length,
    topicsBaseline: countCompletedTopics(courses),
    xpBaseline: player.xp,
  };
  await persistWeeklyMissionsRecord(weeklyRecord);

  const updatedPlayer: Player = {
    ...player,
    lastDailyMissionGeneratedDate: today,
    lastWeeklyMissionGeneratedWeek: weekKey,
  };
  await persistPlayer(updatedPlayer);
  usePlayerStore.setState({ player: updatedPlayer });

  return { dailyRecord, weeklyRecord };
}

export const useDailyMissionsStore = create<DailyMissionsState>((set, get) => ({
  record: null,
  weeklyRecord: null,
  history: [],
  loading: true,
  panelOpen: false,
  pendingChest: null,

  load: async () => {
    const today = todayISO();
    const weekKey = currentWeekKey();
    const [record, weeklyRecord, history] = await Promise.all([
      db.dailyMissions.get(today),
      db.weeklyMissions.get(weekKey),
      loadHistory(),
    ]);
    set({ record: record ?? null, weeklyRecord: weeklyRecord ?? null, history, loading: false });
  },

  ensureToday: async () => {
    if (ensureInFlight) {
      ensurePending = true;
      return;
    }
    ensureInFlight = true;
    try {
      do {
        ensurePending = false;
        const beforePlayer = usePlayerStore.getState().player;
        const previousDate = beforePlayer?.lastActiveDate;
        const previousWeekKey = beforePlayer?.lastActiveDate
          ? getWeekKey(beforePlayer.lastActiveDate)
          : undefined;
        const today = todayISO();
        const weekKey = currentWeekKey();

        await usePlayerStore.getState().ensureDailyRollover();
        const player = usePlayerStore.getState().player;
        if (!player) break;

        if (previousDate && previousDate !== today) {
          for (const d of enumerateDatesUntil(previousDate, today)) {
            await get().processYesterday(d);
          }
        }

        if (previousWeekKey && previousWeekKey !== weekKey) {
          for (const wk of enumerateWeekKeysUntil(previousWeekKey, weekKey)) {
            await get().processLastWeek(wk);
          }
        }

        const courses = useCoursesStore.getState().courses;
        const missions = useMissionsStore.getState().missions;
        const todayBlocks = await getTodayBlocks();

        if (player.lastDailyMissionGeneratedDate !== today) {
          const ctx = buildGenContext(courses, missions, todayBlocks, player);
          const generated = generateDailyMissions(ctx);
          const record: DailyMissionDayRecord = {
            date: today,
            missions: generated,
            generatedAt: new Date().toISOString(),
            generatorVersion: QUEST_GENERATOR_VERSION,
            xpBaseline: player.xp,
          };
          await persistDailyMissionsRecord(record);
          const updatedPlayer: Player = { ...player, lastDailyMissionGeneratedDate: today };
          await persistPlayer(updatedPlayer);
          usePlayerStore.setState({ player: updatedPlayer });
          set({ record });
        } else {
          const existing = await db.dailyMissions.get(today);
          if (existing) {
            let record = trimDailyRecord(existing);
            if (dailyRecordNeedsCreativeRegen(record.missions, record.generatorVersion)) {
              const ctx = buildGenContext(courses, missions, todayBlocks, player);
              const fresh = generateDailyMissions(ctx);
              const versionBump = (record.generatorVersion ?? 0) < QUEST_GENERATOR_VERSION;
              record = {
                ...record,
                missions: versionBump ? fresh : mergeDailyMissionProgress(record.missions, fresh),
                generatedAt: new Date().toISOString(),
                generatorVersion: QUEST_GENERATOR_VERSION,
                xpBaseline: versionBump ? player.xp : (record.xpBaseline ?? player.xp),
                allCompleteBonusGranted: false,
              };
              await persistDailyMissionsRecord(record);
            } else if (record.missions.length !== existing.missions.length) {
              await persistDailyMissionsRecord(record);
            }
            set({ record });
          }
        }

        const freshPlayer = usePlayerStore.getState().player ?? player;
        if (freshPlayer.lastWeeklyMissionGeneratedWeek !== weekKey) {
          const weekBlocks = await getWeekBlocks(weekKey);
          const weeklyGenerated = generateWeeklyMissions({
            courses,
            missions,
            weekBlocks,
            goalMinutes: getDailyGoalMinutes(freshPlayer),
            weekKey,
            player: freshPlayer,
          });
          const weeklyRecord: WeeklyMissionWeekRecord = {
            weekKey,
            missions: weeklyGenerated,
            generatedAt: new Date().toISOString(),
            generatorVersion: QUEST_GENERATOR_VERSION,
            missionsCompletedBaseline: missions.filter((m) => m.completed).length,
            topicsBaseline: countCompletedTopics(courses),
            xpBaseline: freshPlayer.xp,
          };
          await persistWeeklyMissionsRecord(weeklyRecord);
          const updatedPlayer: Player = { ...freshPlayer, lastWeeklyMissionGeneratedWeek: weekKey };
          await persistPlayer(updatedPlayer);
          usePlayerStore.setState({ player: updatedPlayer });
          set({ weeklyRecord });
        } else {
          const existing = await db.weeklyMissions.get(weekKey);
          if (existing) {
            let weeklyRecord = patchWeeklyBaselines(existing, missions, courses, freshPlayer);
            if (weeklyRecordNeedsCreativeRegen(weeklyRecord.missions, weeklyRecord.generatorVersion)) {
              const weekBlocks = await getWeekBlocks(weekKey);
              const fresh = generateWeeklyMissions({
                courses,
                missions,
                weekBlocks,
                goalMinutes: getDailyGoalMinutes(freshPlayer),
                weekKey,
                player: freshPlayer,
              });
              const versionBump = (weeklyRecord.generatorVersion ?? 0) < QUEST_GENERATOR_VERSION;
              weeklyRecord = {
                ...weeklyRecord,
                missions: versionBump ? fresh : mergeWeeklyMissionProgress(weeklyRecord.missions, fresh),
                generatedAt: new Date().toISOString(),
                generatorVersion: QUEST_GENERATOR_VERSION,
                xpBaseline: versionBump ? freshPlayer.xp : (weeklyRecord.xpBaseline ?? freshPlayer.xp),
                allCompleteBonusGranted: false,
              };
              await persistWeeklyMissionsRecord(weeklyRecord);
            } else if (weeklyRecord !== existing) {
              await persistWeeklyMissionsRecord(weeklyRecord);
            }
            set({ weeklyRecord });
          }
        }

        await get().refreshProgress();
      } while (ensurePending);
    } finally {
      ensureInFlight = false;
    }
  },

  processYesterday: async (previousDate: string) => {
    const yesterdayRecord = await db.dailyMissions.get(previousDate);
    if (!yesterdayRecord || yesterdayRecord.penaltyApplied) return;

    const incomplete = yesterdayRecord.missions.filter((m) => !m.completed);
    let totalPenalty = 0;
    for (const m of incomplete) {
      const pen = dailyMissionPenalty(m);
      totalPenalty += pen;
      await usePlayerStore.getState().loseXP(pen, `Misión diaria no cumplida: ${m.title}`);
      usePlayerStore.getState().addNotification(
        createNotification('hades', `⚰️ "${m.title}" caducó — −${pen} XP`),
      );
    }

    const player = usePlayerStore.getState().player;
    const allComplete = allMissionsComplete(yesterdayRecord.missions);
    let streak = player?.dailyMissionStreak ?? 0;

    if (allComplete) {
      streak += 1;
      if (player && player.lastDailyMissionAllCompleteDate !== previousDate) {
        const streakBonus = PLAYER_CONFIG.dailyMissionStreakBonusXp * Math.min(streak, 7);
        await usePlayerStore.getState().addXP(streakBonus, `Racha misiones diarias ×${streak}`);
        if (streak === 7) {
          await usePlayerStore.getState().unlockTitle(DAILY_MISSION_STREAK_TITLE);
          await usePlayerStore.getState().unlockBadge(DAILY_MISSION_STREAK_BADGE);
        }
      }
    } else if (incomplete.length > 0) {
      streak = 0;
    }

    if (player) {
      const patch: Partial<Player> = { dailyMissionStreak: streak };
      if (allComplete) patch.lastDailyMissionAllCompleteDate = previousDate;
      const updated = { ...player, ...patch };
      await persistPlayer(updated);
      usePlayerStore.setState({ player: updated });
    }

    await appendHistory({
      date: previousDate,
      total: yesterdayRecord.missions.length,
      completed: yesterdayRecord.missions.filter((m) => m.completed).length,
      allComplete,
      streakAfter: streak,
      penaltyXp: totalPenalty,
    });

    await db.dailyMissions.delete(previousDate);
    set({ history: await loadHistory() });
  },

  processLastWeek: async (previousWeekKey: string) => {
    const lastWeek = await db.weeklyMissions.get(previousWeekKey);
    if (!lastWeek || lastWeek.penaltyApplied) return;

    const incomplete = lastWeek.missions.filter((m) => !m.completed);
    let totalPenalty = 0;
    for (const m of incomplete) totalPenalty += weeklyMissionPenalty(m);

    if (totalPenalty > 0) {
      await usePlayerStore.getState().loseXP(totalPenalty, `Metas semanales caducadas (${incomplete.length})`);
      usePlayerStore.getState().addNotification(
        createNotification('hades', `⚰️ ${incomplete.length} meta(s) semanal(es) caducaron — −${totalPenalty} XP`),
      );
    }

    await persistWeeklyMissionsRecord({ ...lastWeek, penaltyApplied: true });
  },

  refreshProgress: async () => {
    if (refreshInFlight) {
      refreshPending = true;
      return;
    }
    refreshInFlight = true;
    try {
      do {
        refreshPending = false;
        const { record, weeklyRecord } = get();
        const player = usePlayerStore.getState().player;
        const missions = useMissionsStore.getState().missions;
        const courses = useCoursesStore.getState().courses;
        const todayBlocks = await getTodayBlocks();

        if (record) {
          const ctx = { player, missions, courses, todayBlocks, xpBaseline: record.xpBaseline ?? player?.xp ?? 0 };
          const goalMinutes = getDailyGoalMinutes(player);
          let changed = false;
          const updatedMissions = record.missions.map((m) => {
            const synced = syncDailyGoalMissionMeta(m, goalMinutes);
            if (synced.target !== m.target || synced.description !== m.description) changed = true;
            if (synced.manualComplete && synced.completed) return synced;
            const raw = computeMissionProgress(synced, ctx);
            let next = applyProgressToMission(synced, raw);
            if (synced.autoCompleteBlocked && raw < synced.target) {
              next = { ...next, autoCompleteBlocked: false };
            }
            if (
              next.progress !== synced.progress
              || next.completed !== synced.completed
              || next.autoCompleteBlocked !== synced.autoCompleteBlocked
            ) {
              changed = true;
            }
            return next;
          });

          if (changed) {
            const newlyCompleted = updatedMissions.filter(
              (m, i) => m.completed && !record.missions[i].completed && !m.manualComplete,
            );

            for (const m of newlyCompleted) {
              await usePlayerStore.getState().addXP(m.xpReward, `Misión diaria: ${m.title}`);
            }

            const missionsWithXp = updatedMissions.map((m, i) => {
              const wasNew = m.completed && !record.missions[i].completed && !m.manualComplete;
              return wasNew ? { ...m, xpGranted: m.xpReward } : m;
            });

            let nextRecord: DailyMissionDayRecord = { ...record, missions: missionsWithXp };
            const allDone = allMissionsComplete(missionsWithXp);
            if (allDone && !record.allCompleteBonusGranted) {
              await usePlayerStore.getState().addXP(
                PLAYER_CONFIG.dailyMissionAllCompleteBonusXp,
                `¡Las ${PLAYER_CONFIG.dailyMissionCount} misiones diarias completadas!`,
              );
              const p = usePlayerStore.getState().player;
              if (p && queueChest(set, get, rollChestReward(p))) {
                usePlayerStore.getState().addNotification(createNotification('herald', GERARDEX_COMIC.lootChest));
              }
              nextRecord = { ...nextRecord, allCompleteBonusGranted: true };
            }

            await persistDailyMissionsRecord(nextRecord);
            set({ record: nextRecord });
          }
        }

        if (weeklyRecord) {
          const patchedWeekly = patchWeeklyBaselines(weeklyRecord, missions, courses, player);
          const weekBlocks = await getWeekBlocks(patchedWeekly.weekKey);
          const weekCtx = {
            player,
            missions,
            courses,
            weekBlocks,
            weekKey: patchedWeekly.weekKey,
            missionsCompletedBaseline: patchedWeekly.missionsCompletedBaseline ?? 0,
            topicsBaseline: patchedWeekly.topicsBaseline ?? 0,
            xpBaseline: patchedWeekly.xpBaseline ?? player?.xp ?? 0,
          };

          let weekChanged = false;
          const updatedWeekly = patchedWeekly.missions.map((m) => {
            if (m.manualComplete && m.completed) return m;
            const raw = computeWeeklyMissionProgress(m, weekCtx);
            let next = applyWeeklyProgress(m, raw);
            if (m.autoCompleteBlocked && raw < m.target) {
              next = { ...next, autoCompleteBlocked: false };
            }
            if (next.progress !== m.progress || next.completed !== m.completed || next.autoCompleteBlocked !== m.autoCompleteBlocked) {
              weekChanged = true;
            }
            return next;
          });

          if (weekChanged || patchedWeekly !== weeklyRecord) {
            const newlyCompleted = updatedWeekly.filter(
              (m, i) => m.completed && !patchedWeekly.missions[i].completed && !m.manualComplete,
            );

            for (const m of newlyCompleted) {
              await usePlayerStore.getState().addXP(m.xpReward, `Meta semanal: ${m.title}`);
            }

            const weeklyWithXp = updatedWeekly.map((m, i) => {
              const wasNew = m.completed && !patchedWeekly.missions[i].completed && !m.manualComplete;
              return wasNew ? { ...m, xpGranted: m.xpReward } : m;
            });

            let nextWeekly: WeeklyMissionWeekRecord = { ...patchedWeekly, missions: weeklyWithXp };
            if (allWeeklyComplete(weeklyWithXp) && !patchedWeekly.allCompleteBonusGranted) {
              await usePlayerStore.getState().addXP(
                PLAYER_CONFIG.weeklyMissionAllCompleteBonusXp,
                '¡Todas las metas semanales completadas!',
              );
              usePlayerStore.getState().addNotification(
                createNotification('herald', '🏆 Semana conquistada — bonus épico'),
              );
              const p = usePlayerStore.getState().player;
              if (p && queueChest(set, get, rollChestReward(p))) {
                usePlayerStore.getState().addNotification(createNotification('herald', GERARDEX_COMIC.lootChest));
              }
              nextWeekly = { ...nextWeekly, allCompleteBonusGranted: true };
            }

            await persistWeeklyMissionsRecord(nextWeekly);
            set({ weeklyRecord: nextWeekly });
          }
        }
      } while (refreshPending);
    } finally {
      refreshInFlight = false;
    }
  },

  toggleComplete: async (id: string) => {
    const { record } = get();
    if (!record) return;

    const idx = record.missions.findIndex((m) => m.id === id);
    if (idx < 0) return;

    const m = record.missions[idx];
    if (m.completed) {
      if (m.xpGranted && m.xpGranted > 0) {
        await usePlayerStore.getState().loseXP(m.xpGranted, `Misión diaria revertida: ${m.title}`);
      }
      const wasAllComplete = allMissionsComplete(record.missions);
      const reverted: DailyMission = {
        ...m,
        completed: false,
        progress: Math.min(m.target - 1, m.progress),
        completedAt: undefined,
        xpGranted: undefined,
        manualComplete: false,
        autoCompleteBlocked: true,
      };
      const missions = [...record.missions];
      missions[idx] = reverted;
      const stillAllComplete = allMissionsComplete(missions);
      if (wasAllComplete && !stillAllComplete && record.allCompleteBonusGranted) {
        await usePlayerStore.getState().loseXP(
          PLAYER_CONFIG.dailyMissionAllCompleteBonusXp,
          'Bonus diario revertido — ya no están las 3 completas',
        );
      }
      const nextRecord = {
        ...record,
        missions,
        allCompleteBonusGranted: stillAllComplete ? record.allCompleteBonusGranted : false,
      };
      await persistDailyMissionsRecord(nextRecord);
      set({ record: nextRecord });
      return;
    }

    const completed: DailyMission = {
      ...m,
      completed: true,
      progress: m.target,
      completedAt: new Date().toISOString(),
      manualComplete: true,
      autoCompleteBlocked: false,
      xpGranted: m.xpReward,
    };
    await usePlayerStore.getState().addXP(m.xpReward, `Misión diaria: ${m.title}`);
    const missions = [...record.missions];
    missions[idx] = completed;
    let nextRecord: DailyMissionDayRecord = { ...record, missions };

    if (allMissionsComplete(missions) && !record.allCompleteBonusGranted) {
      await usePlayerStore.getState().addXP(
        PLAYER_CONFIG.dailyMissionAllCompleteBonusXp,
        `¡Las ${PLAYER_CONFIG.dailyMissionCount} misiones diarias completadas!`,
      );
      const p = usePlayerStore.getState().player;
      if (p && queueChest(set, get, rollChestReward(p))) {
        usePlayerStore.getState().addNotification(createNotification('herald', GERARDEX_COMIC.lootChest));
      }
      nextRecord = { ...nextRecord, allCompleteBonusGranted: true };
    }

    await persistDailyMissionsRecord(nextRecord);
    set({ record: nextRecord });
  },

  toggleWeeklyComplete: async (id: string) => {
    const { weeklyRecord } = get();
    if (!weeklyRecord) return;

    const idx = weeklyRecord.missions.findIndex((m) => m.id === id);
    if (idx < 0) return;

    const m = weeklyRecord.missions[idx];
    if (m.completed) {
      if (m.xpGranted && m.xpGranted > 0) {
        await usePlayerStore.getState().loseXP(m.xpGranted, `Meta semanal revertida: ${m.title}`);
      }
      const wasAllComplete = allWeeklyComplete(weeklyRecord.missions);
      const reverted: WeeklyMission = {
        ...m,
        completed: false,
        progress: Math.min(m.target - 1, m.progress),
        completedAt: undefined,
        xpGranted: undefined,
        manualComplete: false,
        autoCompleteBlocked: true,
      };
      const missions = [...weeklyRecord.missions];
      missions[idx] = reverted;
      const stillAllComplete = allWeeklyComplete(missions);
      if (wasAllComplete && !stillAllComplete && weeklyRecord.allCompleteBonusGranted) {
        await usePlayerStore.getState().loseXP(
          PLAYER_CONFIG.weeklyMissionAllCompleteBonusXp,
          'Bonus semanal revertido — metas incompletas',
        );
      }
      const nextWeekly = {
        ...weeklyRecord,
        missions,
        allCompleteBonusGranted: stillAllComplete ? weeklyRecord.allCompleteBonusGranted : false,
      };
      await persistWeeklyMissionsRecord(nextWeekly);
      set({ weeklyRecord: nextWeekly });
      return;
    }

    const completed: WeeklyMission = {
      ...m,
      completed: true,
      progress: m.target,
      completedAt: new Date().toISOString(),
      manualComplete: true,
      autoCompleteBlocked: false,
      xpGranted: m.xpReward,
    };
    await usePlayerStore.getState().addXP(m.xpReward, `Meta semanal: ${m.title}`);
    const missions = [...weeklyRecord.missions];
    missions[idx] = completed;
    let nextWeekly: WeeklyMissionWeekRecord = { ...weeklyRecord, missions };

    if (allWeeklyComplete(missions) && !weeklyRecord.allCompleteBonusGranted) {
      await usePlayerStore.getState().addXP(
        PLAYER_CONFIG.weeklyMissionAllCompleteBonusXp,
        '¡Todas las metas semanales completadas!',
      );
      const p = usePlayerStore.getState().player;
      if (p && queueChest(set, get, rollChestReward(p))) {
        usePlayerStore.getState().addNotification(createNotification('herald', GERARDEX_COMIC.lootChest));
      }
      nextWeekly = { ...nextWeekly, allCompleteBonusGranted: true };
    }

    await persistWeeklyMissionsRecord(nextWeekly);
    set({ weeklyRecord: nextWeekly });
  },

  setPanelOpen: (open) => set({ panelOpen: open }),

  claimPendingChest: async () => {
    const { pendingChest } = get();
    if (!pendingChest) return;
    await usePlayerStore.getState().claimChest(pendingChest);
    set({ pendingChest: null });
  },

  clearPendingChest: () => set({ pendingChest: null }),

  getMissions: () => get().record?.missions ?? [],

  getWeeklyMissions: () => get().weeklyRecord?.missions ?? [],

  getCompletedCount: () => get().record?.missions.filter((m) => m.completed).length ?? 0,

  getWeeklyCompletedCount: () => get().weeklyRecord?.missions.filter((m) => m.completed).length ?? 0,

  regenerateAllQuests: async () => {
    const player = usePlayerStore.getState().player;
    if (!player) return;
    const courses = useCoursesStore.getState().courses;
    const missions = useMissionsStore.getState().missions;
    const { dailyRecord, weeklyRecord } = await generateAndPersistAllQuests(player, courses, missions);
    set({ record: dailyRecord, weeklyRecord });
    await get().refreshProgress();
  },
}));

export function syncDailyMissions(): void {
  scheduleRefreshProgress();
}

let syncMissionTimer: number | null = null;

function scheduleRefreshProgress(): void {
  if (syncMissionTimer !== null) window.clearTimeout(syncMissionTimer);
  syncMissionTimer = window.setTimeout(() => {
    syncMissionTimer = null;
    void useDailyMissionsStore.getState().refreshProgress();
  }, 250);
}
