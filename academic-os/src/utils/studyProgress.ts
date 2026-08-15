import type { Player, TimeBlock } from '../types';
import { PLAYER_CONFIG } from './playerConfig';
import { getDailyGoalMinutes } from './dailyGoal';
import { todayISO } from './gamification';
import { todayLocalISO } from './localTime';

export function blockStudyMinutes(block: TimeBlock): number {
  if (!block.completed || block.type === 'rest') return 0;
  return block.completionRecord?.minutes ?? PLAYER_CONFIG.blockMinutes;
}

export function isStudyContractBlock(block: TimeBlock): boolean {
  return !!block.title && block.type !== 'rest';
}

export function countStudyMinutesFromBlocks(blocks: TimeBlock[], date: string): number {
  return blocks
    .filter((b) => b.date === date && b.completed && isStudyContractBlock(b))
    .reduce((sum, b) => sum + blockStudyMinutes(b), 0);
}

export function countCompletedStudyBlocks(blocks: TimeBlock[], date: string): number {
  return blocks.filter((b) => b.date === date && b.completed && isStudyContractBlock(b)).length;
}

export function countAssignedContracts(blocks: TimeBlock[], date: string): { done: number; total: number } {
  const assigned = blocks.filter((b) => b.date === date && isStudyContractBlock(b));
  return {
    done: assigned.filter((b) => b.completed).length,
    total: assigned.length,
  };
}

/** Alinea todayStudyMinutes del jugador con bloques completados hoy. */
export async function syncTodayStudyMinutesFromBlocks(): Promise<void> {
  const { useTimeStore } = await import('../stores/timeStore');
  const { usePlayerStore } = await import('../stores/playerStore');
  const today = todayLocalISO();
  const blocks = await useTimeStore.getState().getBlocksForDate(today);
  const minutes = countStudyMinutesFromBlocks(blocks, today);
  const player = usePlayerStore.getState().player;
  if (!player) return;

  if (player.lastActiveDate === todayISO() && player.todayStudyMinutes === minutes) {
    return;
  }

  const next: Player = {
    ...player,
    todayStudyMinutes: minutes,
    lastActiveDate: todayISO(),
  };

  const { persistPlayer } = await import('./persist');
  await persistPlayer(next);
  usePlayerStore.setState({ player: next });
}

/** Fuente unificada para el día calendario actual (Lima). */
export function resolveTodayStudyMinutes(player: Player | null, blocks: TimeBlock[]): number {
  const today = todayLocalISO();
  if (!player || player.lastActiveDate !== todayISO()) {
    return 0;
  }
  const todayBlocks = blocks.filter((b) => b.date === today);
  if (todayBlocks.length > 0) {
    return countStudyMinutesFromBlocks(blocks, today);
  }
  return player.todayStudyMinutes ?? 0;
}

/** Minutos estudiados en una fecha concreta (p. ej. día seleccionado en horario). */
export function resolveStudyMinutesForDate(
  player: Player | null,
  blocks: TimeBlock[],
  date: string,
): number {
  const today = todayLocalISO();
  const fromBlocks = countStudyMinutesFromBlocks(blocks, date);
  if (date !== today) return fromBlocks;
  return resolveTodayStudyMinutes(player, blocks);
}

export function isDailyGoalMetForToday(player: Player | null, blocks: TimeBlock[]): boolean {
  if (!player || player.lastActiveDate !== todayISO()) return false;
  return resolveTodayStudyMinutes(player, blocks) >= getDailyGoalMinutes(player);
}

export function isDailyGoalMet(player: Player | null, blocks: TimeBlock[]): boolean {
  return isDailyGoalMetForToday(player, blocks);
}

export function todayGoalProgressPct(player: Player | null, blocks: TimeBlock[]): number {
  const goal = getDailyGoalMinutes(player);
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((resolveTodayStudyMinutes(player, blocks) / goal) * 100));
}
