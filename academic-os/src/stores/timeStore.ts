import { create } from 'zustand';
import { db } from '../utils/db';
import { persistTimeBlock, persistTimeBlocksBulk, persistQueue } from '../utils/persist';
import type { TimeBlock, BlockType, BlockAssignPayload, OracleBlockPlanItem } from '../types';
import { slotsForDuration } from '../utils/oracleContext';
import { usePlayerStore } from './playerStore';
import { useCoursesStore } from './coursesStore';
import { useMissionsStore } from './missionsStore';
import { triggerPerfectDayCheck } from '../utils/perfectDay';
import { notifyBlockCompleted } from '../utils/blockCompleteNotify';
import { blockInPeriod, type DayPeriod } from '../utils/courseColors';
import { getBlockSchedule, parseHourMin, slotTimesForSchedule } from '../utils/blockSchedule';
import { dateForPlanDay, type ApplyPlanResult } from '../utils/weeklyPlanApply';
import type { WeeklyPlanDay } from '../utils/deepseekClient';
import { normalizeDayBlocks } from '../utils/timeBlocksNormalize';
import { todayLocalISO, getBlockLiveStatus, hasBlockSlotEnded } from '../utils/localTime';
import { PLAYER_CONFIG } from '../utils/playerConfig';
import { syncDailyMissions } from './dailyMissionsStore';
import { syncTodayStudyMinutesFromBlocks } from '../utils/studyProgress';
import { beginBlockCompletion, endBlockCompletion } from '../utils/blockCompletionGuard';
import {
  allLinkedBlocksComplete,
  getLinkedBlocksForTopic,
  getTopicCompletedVia,
  topicRefFromBlock,
} from '../utils/topicBlockSync';

async function shouldGrantBlockCompletionXp(block: TimeBlock): Promise<boolean> {
  const ref = topicRefFromBlock(block);
  if (!ref) return true;
  const via = getTopicCompletedVia(useCoursesStore.getState().courses, ref);
  return via !== 'manual';
}

/** Marca checkbox en curso/misión al completar todos los bloques vinculados */
async function syncBlockCompletionToSource(block: TimeBlock): Promise<void> {
  if (block.missionId) {
    const mission = useMissionsStore.getState().missions.find((m) => m.id === block.missionId);
    if (mission && !mission.completed) {
      await useMissionsStore.getState().completeMission(block.missionId, { fromTimeBlock: true });
    }
    return;
  }

  const ref = topicRefFromBlock(block);
  if (!ref) return;

  const courses = useCoursesStore.getState().courses;
  if (getTopicCompletedVia(courses, ref) === 'manual') return;

  const linked = await getLinkedBlocksForTopic(ref);
  if (!allLinkedBlocksComplete(linked)) return;

  await useCoursesStore.getState().markTopicComplete(
    ref.courseId,
    ref.unitId,
    ref.topicId,
    ref.subtopicId,
    true,
  );
}

/** Desmarca checkbox en curso/misión al revertir bloque completado */
async function syncBlockUncompleteFromSource(block: TimeBlock): Promise<void> {
  if (block.missionId) {
    const mission = useMissionsStore.getState().missions.find((m) => m.id === block.missionId);
    if (mission?.completed) {
      await useMissionsStore.getState().uncompleteMission(block.missionId, { fromTimeBlock: true });
    }
    return;
  }

  if (block.courseId && block.unitId && block.topicId) {
    const ref = topicRefFromBlock(block);
    if (!ref) return;

    const via = getTopicCompletedVia(useCoursesStore.getState().courses, ref);
    if (via !== 'timeblock') return;

    const linked = await getLinkedBlocksForTopic(ref);
    if (allLinkedBlocksComplete(linked)) return;

    await useCoursesStore.getState().unmarkTopicFromBlock(
      ref.courseId,
      ref.unitId,
      ref.topicId,
      ref.subtopicId,
    );
  }
}

/** Aplica payload de asignación; claves presentes con `undefined` limpian el enlace */
function applyBlockPayload(block: TimeBlock, payload: BlockAssignPayload): TimeBlock {
  const next: TimeBlock = {
    ...block,
    title: payload.title ?? block.title,
    type: payload.type ?? block.type,
    completed: false,
    playStartedAt: undefined,
    completionRecord: undefined,
  };
  const linkKeys = ['courseId', 'unitId', 'topicId', 'subtopicId', 'missionId'] as const;
  for (const key of linkKeys) {
    if (key in payload) next[key] = payload[key];
  }
  return next;
}

const SLOT_MINUTES = 30;

function scheduleForPlayer() {
  return getBlockSchedule(usePlayerStore.getState().player);
}

interface TimeState {
  blocks: TimeBlock[];
  blocksRevision: number;
  selectedDate: string;
  loading: boolean;
  draggedBlock: TimeBlock | null;
  load: (date?: string) => Promise<void>;
  setDate: (date: string) => void;
  generateDayBlocks: (date: string) => TimeBlock[];
  assignBlockFull: (blockId: string, payload: BlockAssignPayload) => Promise<void>;
  assignBlocksFull: (blockIds: string[], payload: BlockAssignPayload) => Promise<void>;
  assignBlock: (blockId: string, title: string, type: BlockType, courseId?: string, topicId?: string) => Promise<void>;
  updateBlock: (blockId: string, payload: Partial<BlockAssignPayload & { title: string }>) => Promise<void>;
  completeBlock: (blockId: string) => Promise<void>;
  startBlockPlay: (blockId: string) => Promise<void>;
  completeBlockPlaySession: (blockId: string) => Promise<boolean>;
  uncompleteBlock: (blockId: string) => Promise<void>;
  clearBlock: (blockId: string) => Promise<void>;
  deleteBlockContent: (blockId: string) => Promise<void>;
  setDraggedBlock: (block: TimeBlock | null) => void;
  moveBlock: (fromId: string, toId: string) => Promise<void>;
  rescheduleBlock: (blockId: string, targetDate: string, targetStartTime: string) => Promise<'ok' | 'slot_occupied' | 'not_found'>;
  resetTodayBlockProgress: () => Promise<void>;
  getBlocksForDate: (date: string) => Promise<TimeBlock[]>;
  getBlocksByPeriod: (date: string, period: DayPeriod) => Promise<TimeBlock[]>;
  getTodayCompletedCount: () => number;
  getTodayTotalScheduled: () => number;
  getTodayStudyMinutes: () => number;
  applyWeeklyPlan: (
    plan: WeeklyPlanDay[],
    weekMonday: string,
    courseId?: string,
  ) => Promise<ApplyPlanResult>;
  applyOracleBlockPlan: (
    items: OracleBlockPlanItem[],
    planDate: string,
    blockMinutes: number,
  ) => Promise<string[]>;
}

/** ID estable por fecha+hora — evita que la asignación falle tras normalizar slots */
export function blockIdForSlot(date: string, startTime: string): string {
  return `tb-${date}-${startTime.replace(':', '')}`;
}

function makeEmptyBlock(date: string, hour: number, min: number): TimeBlock {
  const start = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  const endHour = min === 30 ? hour + 1 : hour;
  const endMin = min === 30 ? '00' : '30';
  const end = `${String(endHour).padStart(2, '0')}:${endMin}`;
  return {
    id: blockIdForSlot(date, start),
    date,
    startTime: start,
    endTime: end,
    type: hour >= 22 ? 'rest' : 'rest',
    title: hour >= 22 ? 'Descanso' : '',
    completed: false,
  };
}

export const useTimeStore = create<TimeState>((set, get) => ({
  blocks: [],
  blocksRevision: 0,
  selectedDate: todayLocalISO(),
  loading: true,
  draggedBlock: null,

  load: async (date) => {
    const targetDate = date ?? get().selectedDate;
    let blocks = await db.timeblocks.where('date').equals(targetDate).toArray();

    if (blocks.length === 0) {
      blocks = get().generateDayBlocks(targetDate);
    }

    blocks = await normalizeDayBlocks(targetDate, blocks, makeEmptyBlock);
    blocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
    set({ blocks, selectedDate: targetDate, loading: false, blocksRevision: get().blocksRevision + 1 });
  },

  setDate: (date) => {
    set({ selectedDate: date, loading: true });
    get().load(date);
  },

  generateDayBlocks: (date) => {
    const schedule = scheduleForPlayer();
    const slots = slotTimesForSchedule(schedule);
    return slots.map((startTime) => {
      const { hour, min } = parseHourMin(startTime);
      return makeEmptyBlock(date, hour, min);
    });
  },

  assignBlockFull: async (blockId, payload) => {
    let block = get().blocks.find((b) => b.id === blockId);
    if (!block) {
      block = await db.timeblocks.get(blockId);
    }
    if (!block) return;

    const updated = applyBlockPayload(block, payload);
    await persistTimeBlock(updated);
    set((s) => {
      const inView = s.blocks.some((b) => b.id === blockId);
      return {
        blocks: inView ? s.blocks.map((b) => (b.id === blockId ? updated : b)) : s.blocks,
        blocksRevision: s.blocksRevision + 1,
      };
    });
    syncDailyMissions();
  },

  assignBlock: async (blockId, title, type, courseId, topicId) => {
    await get().assignBlockFull(blockId, {
      title,
      type,
      courseId,
      topicId,
      unitId: undefined,
      subtopicId: undefined,
      missionId: undefined,
    });
  },

  assignBlocksFull: async (blockIds, payload) => {
    if (blockIds.length === 0) return;

    const updates: TimeBlock[] = [];
    let assignDate: string | undefined;

    for (const blockId of blockIds) {
      let block = get().blocks.find((b) => b.id === blockId);
      if (!block) block = await db.timeblocks.get(blockId);
      if (!block) continue;
      assignDate = block.date;
      updates.push(applyBlockPayload(block, payload));
    }

    if (updates.length === 0) return;

    await persistTimeBlocksBulk(updates);

    const updateMap = new Map(updates.map((b) => [b.id, b]));
    set((s) => {
      const touchView = updates.some((u) => u.date === s.selectedDate);
      return {
        blocks: touchView
          ? s.blocks.map((b) => updateMap.get(b.id) ?? b)
          : s.blocks,
        blocksRevision: s.blocksRevision + 1,
      };
    });
    syncDailyMissions();

    if (assignDate && assignDate === get().selectedDate) {
      await get().load(assignDate);
    }
  },

  updateBlock: async (blockId, payload) => {
    const block = get().blocks.find((b) => b.id === blockId);
    if (!block) return;
    const updated = { ...block, ...payload };
    await persistTimeBlock(updated);
    set((s) => ({
      blocks: s.blocks.map((b) => (b.id === blockId ? updated : b)),
      blocksRevision: s.blocksRevision + 1,
    }));
    syncDailyMissions();
  },

  completeBlock: async (blockId) => {
    if (!beginBlockCompletion(blockId)) return;

    try {
      let block = get().blocks.find((b) => b.id === blockId);
      if (!block) {
        block = await db.timeblocks.get(blockId);
      }
      if (!block || block.completed || !block.title) return;

      const today = todayLocalISO();
      let completionRecord: import('../types').BlockCompletionGrant | undefined;
      const grantBlockXp = await shouldGrantBlockCompletionXp(block);
      if (block.date === today) {
        completionRecord = await usePlayerStore.getState().completeStudyBlock({ grantXp: grantBlockXp });
      }

      const updated: TimeBlock = {
        ...block,
        completed: true,
        completionRecord,
        playStartedAt: undefined,
      };
      await persistTimeBlock(updated);
      set((s) => ({
        blocks: s.blocks.some((b) => b.id === blockId)
          ? s.blocks.map((b) => (b.id === blockId ? updated : b))
          : s.blocks,
        blocksRevision: s.blocksRevision + 1,
      }));

      const blocksToday = get().blocks.filter((b) => b.date === block.date);
      void notifyBlockCompleted(updated, blocksToday.length ? blocksToday : [updated]);


      await syncBlockCompletionToSource(updated);

      triggerPerfectDayCheck();
      if (block.date === today) await syncTodayStudyMinutesFromBlocks();
      syncDailyMissions();
    } catch (err) {
      console.error('completeBlock failed:', blockId, err);
    } finally {
      endBlockCompletion(blockId);
    }
  },

  startBlockPlay: async (blockId) => {
    let block = get().blocks.find((b) => b.id === blockId);
    if (!block) block = await db.timeblocks.get(blockId);
    if (!block || block.completed || !block.title || block.type === 'rest') return;
    if (getBlockLiveStatus(block) !== 'live') return;
    if (block.playStartedAt) return;

    const updated: TimeBlock = { ...block, playStartedAt: new Date().toISOString() };
    await persistTimeBlock(updated);
    set((s) => ({
      blocks: s.blocks.some((b) => b.id === blockId)
        ? s.blocks.map((b) => (b.id === blockId ? updated : b))
        : s.blocks,
      blocksRevision: s.blocksRevision + 1,
    }));
  },

  completeBlockPlaySession: async (blockId) => {
    if (!beginBlockCompletion(blockId)) return false;

    try {
      let block = get().blocks.find((b) => b.id === blockId);
      if (!block) block = await db.timeblocks.get(blockId);
      if (!block || block.completed || !block.title || !block.playStartedAt) return false;
      if (!hasBlockSlotEnded(block)) return false;

      const today = todayLocalISO();
      let completionRecord: import('../types').BlockCompletionGrant | undefined;
      const grantBlockXp = await shouldGrantBlockCompletionXp(block);
      if (block.date === today) {
        completionRecord = await usePlayerStore.getState().completeStudyBlock({ grantXp: grantBlockXp });
      }

      const updated: TimeBlock = {
        ...block,
        completed: true,
        completionRecord,
        playStartedAt: undefined,
      };
      await persistTimeBlock(updated);
      set((s) => ({
        blocks: s.blocks.some((b) => b.id === blockId)
          ? s.blocks.map((b) => (b.id === blockId ? updated : b))
          : s.blocks,
        blocksRevision: s.blocksRevision + 1,
      }));

      const blocksToday = get().blocks.filter((b) => b.date === block.date);
      void notifyBlockCompleted(updated, blocksToday.length ? blocksToday : [updated]);


      await syncBlockCompletionToSource(updated);

      triggerPerfectDayCheck();
      if (block.date === today) await syncTodayStudyMinutesFromBlocks();
      syncDailyMissions();
      return true;
    } catch (err) {
      console.error('completeBlockPlaySession failed:', blockId, err);
      return false;
    } finally {
      endBlockCompletion(blockId);
    }
  },

  uncompleteBlock: async (blockId) => {
    let block = get().blocks.find((b) => b.id === blockId);
    if (!block) {
      block = await db.timeblocks.get(blockId);
    }
    if (!block || !block.completed) return;

    const today = todayLocalISO();
    const grant = block.completionRecord ?? {
      blockXp: 0,
      goalBonus: 0,
      minutes: block.date === today ? PLAYER_CONFIG.blockMinutes : 0,
    };

    if (block.date === today && (grant.blockXp > 0 || grant.goalBonus > 0 || grant.minutes > 0)) {
      await usePlayerStore.getState().revertStudyBlock(grant);
    }

    await syncBlockUncompleteFromSource(block);

    const updated: TimeBlock = {
      ...block,
      completed: false,
      completionRecord: undefined,
      playStartedAt: undefined,
    };
    await persistTimeBlock(updated);
    set((s) => ({
      blocks: s.blocks.some((b) => b.id === blockId)
        ? s.blocks.map((b) => (b.id === blockId ? updated : b))
        : s.blocks,
      blocksRevision: s.blocksRevision + 1,
    }));
    if (block.date === today) await syncTodayStudyMinutesFromBlocks();
    syncDailyMissions();
  },

  resetTodayBlockProgress: async () => {
    const today = todayLocalISO();
    const allToday = await db.timeblocks.where('date').equals(today).toArray();
    const completed = allToday.filter((b) => b.completed && b.type !== 'rest' && b.title);

    for (const block of completed) {
      await get().uncompleteBlock(block.id);
    }

    const selected = get().selectedDate;
    if (selected === today) {
      await get().load(today);
    } else {
      set((s) => ({ blocksRevision: s.blocksRevision + 1 }));
    }
    await syncTodayStudyMinutesFromBlocks();
  },

  clearBlock: async (blockId) => {
    await get().deleteBlockContent(blockId);
  },

  deleteBlockContent: async (blockId) => {
    const block = get().blocks.find((b) => b.id === blockId);
    if (!block || block.completed) return;
    const cleared: TimeBlock = {
      ...block,
      title: block.startTime >= '22:00' ? 'Descanso' : '',
      type: block.startTime >= '22:00' ? 'rest' : 'rest',
      courseId: undefined,
      unitId: undefined,
      topicId: undefined,
      subtopicId: undefined,
      missionId: undefined,
      completed: false,
      playStartedAt: undefined,
    };
    await persistTimeBlock(cleared);
    set((s) => ({
      blocks: s.blocks.map((b) => (b.id === blockId ? cleared : b)),
      blocksRevision: s.blocksRevision + 1,
    }));
    syncDailyMissions();
  },

  setDraggedBlock: (block) => set({ draggedBlock: block }),

  moveBlock: async (fromId, toId) => {
    const { blocks } = get();
    const from = blocks.find((b) => b.id === fromId);
    const to = blocks.find((b) => b.id === toId);
    if (!from || !to || from.id === to.id) return;

    const updatedFrom: TimeBlock = {
      ...to,
      title: from.title,
      type: from.type,
      courseId: from.courseId,
      unitId: from.unitId,
      topicId: from.topicId,
      subtopicId: from.subtopicId,
      missionId: from.missionId,
      completed: from.completed,
      completionRecord: from.completionRecord,
    };
    const updatedTo: TimeBlock = {
      ...from,
      title: to.title || (from.startTime >= '22:00' ? 'Descanso' : ''),
      type: to.type,
      courseId: to.courseId,
      unitId: to.unitId,
      topicId: to.topicId,
      subtopicId: to.subtopicId,
      missionId: to.missionId,
      completed: to.completed,
      completionRecord: to.completionRecord,
    };

    await persistTimeBlocksBulk([updatedFrom, updatedTo]);
    set((s) => ({
      blocks: s.blocks.map((b) => {
        if (b.id === fromId) return updatedTo;
        if (b.id === toId) return updatedFrom;
        return b;
      }),
      draggedBlock: null,
      blocksRevision: s.blocksRevision + 1,
    }));
  },

  rescheduleBlock: async (blockId, targetDate, targetStartTime) => {
    let source = get().blocks.find((b) => b.id === blockId);
    if (!source) source = await db.timeblocks.get(blockId);
    if (!source || !source.title) return 'not_found';

    const today = todayLocalISO();
    if (source.completed) {
      const grant = source.completionRecord ?? {
        blockXp: 0,
        goalBonus: 0,
        minutes: source.date === today ? PLAYER_CONFIG.blockMinutes : 0,
      };
      if (source.date === today && (grant.blockXp > 0 || grant.goalBonus > 0 || grant.minutes > 0)) {
        await usePlayerStore.getState().revertStudyBlock(grant);
      }
      await syncBlockUncompleteFromSource(source);
    }

    let targetBlocks = await db.timeblocks.where('date').equals(targetDate).toArray();
    if (targetBlocks.length === 0) {
      targetBlocks = get().generateDayBlocks(targetDate);
    }
    targetBlocks = await normalizeDayBlocks(targetDate, targetBlocks, makeEmptyBlock);

    const target = targetBlocks.find((b) => b.startTime === targetStartTime);
    if (!target) return 'not_found';

    const targetOccupied =
      target.id !== source.id &&
      !!target.title &&
      target.type !== 'rest';
    if (targetOccupied) return 'slot_occupied';

    const updatedTarget: TimeBlock = {
      ...target,
      title: source.title,
      type: source.type,
      courseId: source.courseId,
      unitId: source.unitId,
      topicId: source.topicId,
      subtopicId: source.subtopicId,
      missionId: source.missionId,
      completed: false,
      completionRecord: undefined,
    };

    const clearedSource: TimeBlock = {
      ...source,
      title: source.startTime >= '22:00' ? 'Descanso' : '',
      type: 'rest',
      courseId: undefined,
      unitId: undefined,
      topicId: undefined,
      subtopicId: undefined,
      missionId: undefined,
      completed: false,
      completionRecord: undefined,
    };

    if (source.id === target.id) {
      await persistTimeBlock(updatedTarget);
    } else {
      await persistTimeBlocksBulk([clearedSource, updatedTarget]);
    }

    const { selectedDate } = get();
    if (selectedDate === source.date || selectedDate === targetDate) {
      await get().load(selectedDate);
    } else {
      set((s) => ({ blocksRevision: s.blocksRevision + 1 }));
    }
    return 'ok';
  },

  getBlocksForDate: async (date) => {
    const { selectedDate, blocks: inMemory, loading } = get();
    if (date === selectedDate && inMemory.length > 0 && !loading) {
      return inMemory;
    }
    let dayBlocks = await db.timeblocks.where('date').equals(date).toArray();
    if (dayBlocks.length === 0) {
      dayBlocks = get().generateDayBlocks(date);
    }
    return normalizeDayBlocks(date, dayBlocks, makeEmptyBlock);
  },

  applyOracleBlockPlan: async (items, planDate, blockMinutes) => {
    await get().load(planDate);

    const errors: string[] = [];
    const updateMap = new Map<string, TimeBlock>();
    let workingBlocks = [...get().blocks];

    for (const item of items) {
      const slots = slotsForDuration(workingBlocks, item.startTime, blockMinutes, {
        planDate,
        now: new Date(),
      });
      if (slots.length === 0) {
        errors.push(`Sin slot libre en ${item.startTime}`);
        continue;
      }
      const payload: BlockAssignPayload = {
        title: item.title,
        type: item.type,
        courseId: item.courseId,
        unitId: item.unitId,
        topicId: item.topicId,
      };
      for (const slot of slots) {
        const updated = applyBlockPayload(slot, payload);
        updateMap.set(slot.id, updated);
        workingBlocks = workingBlocks.map((b) => (b.id === slot.id ? updated : b));
      }
    }

    if (updateMap.size === 0) return errors;

    await persistTimeBlocksBulk([...updateMap.values()]);
    await persistQueue.drain();

    set((s) => ({
      blocks: planDate === s.selectedDate
        ? s.blocks.map((b) => updateMap.get(b.id) ?? b)
        : s.blocks,
      blocksRevision: s.blocksRevision + 1,
    }));
    syncDailyMissions();

    if (planDate === get().selectedDate) {
      await get().load(planDate);
    }

    return errors;
  },

  getBlocksByPeriod: async (date, period) => {
    const blocks = await get().getBlocksForDate(date);
    const schedule = getBlockSchedule(usePlayerStore.getState().player);
    return blocks.filter((b) => blockInPeriod(b.startTime, period, schedule));
  },

  getTodayCompletedCount: () => {
    const today = todayLocalISO();
    return get().blocks.filter(
      (b) => b.date === today && b.completed && b.title && b.type !== 'rest',
    ).length;
  },

  getTodayTotalScheduled: () =>
    get().blocks.filter((b) => b.title && b.type !== 'rest').length,

  getTodayStudyMinutes: () => {
    const today = todayLocalISO();
    return get().blocks.filter((b) => b.date === today && b.completed && b.type !== 'rest').length * SLOT_MINUTES;
  },

  applyWeeklyPlan: async (plan, weekMonday, courseId) => {
    let applied = 0;
    let skipped = 0;

    for (const day of plan) {
      const date = dateForPlanDay(weekMonday, day.day);
      if (!date) continue;

      const blocks = await get().getBlocksForDate(date);

      for (const item of day.blocks) {
        const slotsNeeded = Math.max(1, Math.ceil(item.durationMin / SLOT_MINUTES));
        const startIdx = blocks.findIndex((b) => b.startTime === item.startTime);
        if (startIdx === -1) {
          skipped += slotsNeeded;
          continue;
        }

        for (let i = 0; i < slotsNeeded; i++) {
          const block = blocks[startIdx + i];
          if (!block) {
            skipped += 1;
            continue;
          }
          const empty = (!block.title || block.type === 'rest') && !block.completed;
          if (!empty) {
            skipped += 1;
            continue;
          }
          await get().assignBlockFull(block.id, {
            title: item.title,
            type: 'study',
            courseId,
          });
          applied += 1;
        }
      }
    }

    const today = get().selectedDate;
    if (plan.some((d) => dateForPlanDay(weekMonday, d.day) === today)) {
      await get().load(today);
    }

    return { applied, skipped };
  },
}));
