/** Paleta de auras por curso */
export const COURSE_PALETTE = [
  '#DC143C', '#1E90FF', '#32CD32', '#FF8C00', '#9370DB',
  '#00CED1', '#FFD700', '#FF69B4', '#20B2AA', '#CD853F',
];

export function getCourseColor(courseId: string, stored?: string): string {
  if (stored) return stored;
  let hash = 0;
  for (let i = 0; i < courseId.length; i++) hash = courseId.charCodeAt(i) + ((hash << 5) - hash);
  return COURSE_PALETTE[Math.abs(hash) % COURSE_PALETTE.length];
}

export function courseAuraCss(color: string, intensity = 0.35): Record<string, string> {
  const alpha = Math.round(intensity * 255).toString(16).padStart(2, '0');
  return {
    boxShadow: `0 0 12px ${color}${alpha}, inset 4px 0 0 ${color}`,
    borderLeftColor: color,
  };
}

import type { BlockSchedule } from './blockSchedule';
import { DEFAULT_BLOCK_END, DEFAULT_BLOCK_START } from './blockSchedule';
import { blockInSchedulePeriod, type DayPeriod } from './dayPeriods';

export type { DayPeriod };

/** @deprecated Usar getSchedulePeriods + blockInSchedulePeriod con el horario del jugador */
export const PERIOD_RANGES = {
  morning: { label: '☀ Mañana', start: '06:00', end: '11:59' },
  afternoon: { label: '⚡ Tarde', start: '12:00', end: '17:59' },
  evening: { label: '🌙 Noche', start: '18:00', end: '22:59' },
} as const;

export function blockInPeriod(startTime: string, period: DayPeriod, schedule?: BlockSchedule): boolean {
  const sched = schedule ?? { start: DEFAULT_BLOCK_START, end: DEFAULT_BLOCK_END };
  return blockInSchedulePeriod(startTime, period, sched);
}
