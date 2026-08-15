import type { TimeBlock } from '../types';
import { getBlockSchedule, slotTimesForSchedule, type BlockSchedule } from './blockSchedule';
import { usePlayerStore } from '../stores/playerStore';
import { deleteTimeBlocksBulk, persistTimeBlocksBulk } from './persist';

function blockRichness(b: TimeBlock): number {
  let score = 0;
  if (b.completed) score += 8;
  if (b.title && b.type !== 'rest') score += 4;
  if (b.missionId || b.topicId) score += 2;
  if (b.courseId) score += 1;
  return score;
}

function resolveSchedule(explicit?: BlockSchedule): BlockSchedule {
  if (explicit) return explicit;
  return getBlockSchedule(usePlayerStore.getState().player);
}

/**
 * Un slot por startTime dentro del rango configurado. Elimina duplicados y rellena huecos.
 */
export async function normalizeDayBlocks(
  date: string,
  blocks: TimeBlock[],
  createSlot: (date: string, hour: number, min: number) => TimeBlock,
  schedule?: BlockSchedule,
): Promise<TimeBlock[]> {
  const sched = resolveSchedule(schedule);
  const dayBlocks = blocks.filter((b) => b.date === date);
  const byStart = new Map<string, TimeBlock[]>();

  for (const b of dayBlocks) {
    const list = byStart.get(b.startTime) ?? [];
    list.push(b);
    byStart.set(b.startTime, list);
  }

  const expected = slotTimesForSchedule(sched);
  const result: TimeBlock[] = [];
  const toDelete: string[] = [];

  for (const startTime of expected) {
    const [h, m] = startTime.split(':').map(Number);
    const candidates = byStart.get(startTime) ?? [];

    if (candidates.length === 0) {
      result.push(createSlot(date, h, m));
      continue;
    }

    candidates.sort((a, b) => blockRichness(b) - blockRichness(a));
    result.push(candidates[0]);
    for (let i = 1; i < candidates.length; i++) {
      toDelete.push(candidates[i].id);
    }
    byStart.delete(startTime);
  }

  for (const [, orphans] of byStart) {
    for (const b of orphans) toDelete.push(b.id);
  }

  if (toDelete.length > 0) {
    await deleteTimeBlocksBulk(toDelete);
  }

  const sorted = result.sort((a, b) => a.startTime.localeCompare(b.startTime));
  await persistTimeBlocksBulk(sorted);
  return sorted;
}

/** @deprecated Usar slotTimesForSchedule */
export function expectedSlotTimes(): string[] {
  return slotTimesForSchedule(getBlockSchedule(usePlayerStore.getState().player));
}

export const BLOCK_START_HOUR = 6;
export const BLOCK_END_HOUR = 23;
