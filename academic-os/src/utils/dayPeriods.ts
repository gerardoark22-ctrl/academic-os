import type { BlockSchedule } from './blockSchedule';
import { minutesFromHHMM } from './localTime';

export type DayPeriod = 'morning' | 'afternoon' | 'evening';

export interface DayPeriodDef {
  key: DayPeriod;
  label: string;
  icon: string;
  startMin: number;
  /** Exclusivo — último slot empieza en endMin - 30 */
  endMin: number;
}

function formatHHMM(totalMin: number): string {
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Tres turnos dentro del rango del Reloj de ceniza (mañana / tarde / noche). */
export function getSchedulePeriods(schedule: BlockSchedule): DayPeriodDef[] {
  const startMin = minutesFromHHMM(schedule.start);
  const endMin = minutesFromHHMM(schedule.end);
  const span = endMin - startMin;

  if (span <= 30) {
    return [
      {
        key: 'morning',
        label: 'Turno',
        icon: '⏳',
        startMin,
        endMin,
      },
    ];
  }

  const slotCount = Math.floor(span / 30);
  const slotsPerPeriod = Math.max(1, Math.floor(slotCount / 3));
  const seg1End = startMin + slotsPerPeriod * 30;
  const seg2End = startMin + slotsPerPeriod * 2 * 30;

  return [
    { key: 'morning', label: 'Mañana', icon: '☀', startMin, endMin: seg1End },
    { key: 'afternoon', label: 'Tarde', icon: '⚡', startMin: seg1End, endMin: seg2End },
    { key: 'evening', label: 'Noche', icon: '🌙', startMin: seg2End, endMin: endMin },
  ];
}

export function formatPeriodRange(def: DayPeriodDef): string {
  const lastSlotStart = Math.max(def.startMin, def.endMin - 30);
  return `${formatHHMM(def.startMin)}–${formatHHMM(lastSlotStart)}`;
}

export function formatPeriodButtonLabel(def: DayPeriodDef): string {
  return `${def.icon} ${def.label}`;
}

export function blockInSchedulePeriod(
  startTime: string,
  period: DayPeriod,
  schedule: BlockSchedule,
): boolean {
  const t = minutesFromHHMM(startTime);
  const def = getSchedulePeriods(schedule).find((p) => p.key === period);
  if (!def) return false;
  return t >= def.startMin && t < def.endMin;
}

export function partitionBySchedulePeriod<T extends { startTime: string }>(
  items: T[],
  schedule: BlockSchedule,
): Record<DayPeriod, T[]> {
  const periods = getSchedulePeriods(schedule);
  const buckets: Record<DayPeriod, T[]> = { morning: [], afternoon: [], evening: [] };

  for (const item of items) {
    const t = minutesFromHHMM(item.startTime);
    const match = periods.find((p) => t >= p.startMin && t < p.endMin);
    if (match) buckets[match.key].push(item);
  }

  for (const key of Object.keys(buckets) as DayPeriod[]) {
    buckets[key].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return buckets;
}

/** Periodos con al menos un slot en el horario actual */
export function getActiveSchedulePeriods(schedule: BlockSchedule): DayPeriodDef[] {
  const slots = getSchedulePeriods(schedule);
  return slots.filter((p) => p.endMin - p.startMin >= 30);
}
