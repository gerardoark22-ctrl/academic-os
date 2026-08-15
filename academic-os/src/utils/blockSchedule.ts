import type { Player } from '../types';
import { minutesFromHHMM } from './localTime';

export const DEFAULT_BLOCK_START = '06:00';
export const DEFAULT_BLOCK_END = '23:00';

export interface BlockSchedule {
  start: string;
  end: string;
}

export function getBlockSchedule(player?: Player | null): BlockSchedule {
  const start = player?.dayBlockStart?.trim() || DEFAULT_BLOCK_START;
  const end = player?.dayBlockEnd?.trim() || DEFAULT_BLOCK_END;
  return { start, end };
}

/** Slots de 30 min dentro del rango [start, end) */
export function slotTimesForSchedule(schedule: BlockSchedule): string[] {
  const startMin = minutesFromHHMM(schedule.start);
  const endMin = minutesFromHHMM(schedule.end);
  const slots: string[] = [];

  for (let m = startMin; m < endMin; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return slots;
}

export function validateBlockSchedule(start: string, end: string): string | null {
  const s = minutesFromHHMM(start);
  const e = minutesFromHHMM(end);
  if (e <= s) return 'La hora de fin debe ser posterior al inicio';
  if (e - s < 30) return 'El rango mínimo es 30 minutos';
  if (e - s > 24 * 60) return 'El rango máximo es 24 horas';
  return null;
}

export function parseHourMin(hhmm: string): { hour: number; min: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return { hour: h, min: m ?? 0 };
}
