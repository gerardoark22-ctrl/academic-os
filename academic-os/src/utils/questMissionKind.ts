import type { DailyMissionKind, WeeklyMissionKind } from '../types';

/** Misiones binarias: hecho / no hecho — sin barra de progreso */
const DICHOTOMOUS_DAILY: ReadonlySet<DailyMissionKind> = new Set([
  'daily_goal',
  'complete_mission',
  'complete_topic',
]);

const DICHOTOMOUS_WEEKLY: ReadonlySet<WeeklyMissionKind> = new Set([
  'complete_mission',
]);

export function isDichotomousDailyKind(kind: DailyMissionKind): boolean {
  return DICHOTOMOUS_DAILY.has(kind);
}

export function isDichotomousWeeklyKind(kind: WeeklyMissionKind): boolean {
  return DICHOTOMOUS_WEEKLY.has(kind);
}
