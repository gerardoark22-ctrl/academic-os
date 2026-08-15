import type { Player } from '../types';
import { PLAYER_CONFIG } from './playerConfig';

export const DEFAULT_DAILY_GOAL_MINUTES = PLAYER_CONFIG.minStudyHours * 60;
export const MIN_DAILY_GOAL_MINUTES = PLAYER_CONFIG.blockMinutes;
export const MAX_DAILY_GOAL_MINUTES = 8 * 60;

export function getDailyGoalMinutes(player?: Player | null): number {
  const raw = player?.dailyGoalMinutes;
  if (raw == null || raw < MIN_DAILY_GOAL_MINUTES) return DEFAULT_DAILY_GOAL_MINUTES;
  return Math.min(MAX_DAILY_GOAL_MINUTES, raw);
}

export function getDailyGoalBlocks(player?: Player | null): number {
  return Math.round(getDailyGoalMinutes(player) / PLAYER_CONFIG.blockMinutes);
}

/** Bonus diario escala con la meta (3h base = bonus base). */
export function getScaledDailyBonusXp(goalMinutes: number): number {
  return Math.round(
    PLAYER_CONFIG.dailyBonusXp * (goalMinutes / DEFAULT_DAILY_GOAL_MINUTES),
  );
}

export function getDailyGoalBlockOptions(): number[] {
  const options: number[] = [];
  for (let m = MIN_DAILY_GOAL_MINUTES; m <= MAX_DAILY_GOAL_MINUTES; m += PLAYER_CONFIG.blockMinutes) {
    options.push(m);
  }
  return options;
}

export function clampDailyGoalMinutes(minutes: number): number {
  const step = PLAYER_CONFIG.blockMinutes;
  const snapped = Math.round(minutes / step) * step;
  return Math.max(MIN_DAILY_GOAL_MINUTES, Math.min(MAX_DAILY_GOAL_MINUTES, snapped));
}

export function formatGoalHoursMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
