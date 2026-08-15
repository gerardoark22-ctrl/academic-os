import { todayLocalISO } from './localTime';

export type MissionDueUrgency = 'overdue' | 'today' | 'tomorrow' | 'soon' | 'week' | 'later';

/** Días hasta vencimiento (negativo = vencida) — zona Perú, sin drift UTC */
export function daysUntilDue(dueDateStr: string): number {
  const today = todayLocalISO();
  const [ty, tm, td] = today.split('-').map(Number);
  const [dy, dm, dd] = dueDateStr.split('-').map(Number);
  const t0 = Date.UTC(ty, tm - 1, td);
  const d0 = Date.UTC(dy, dm - 1, dd);
  return Math.round((d0 - t0) / 86400000);
}

export function getMissionDueUrgency(dueDate: string): MissionDueUrgency {
  const d = daysUntilDue(dueDate);
  if (d < 0) return 'overdue';
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d <= 4) return 'soon';
  if (d <= 7) return 'week';
  return 'later';
}

/** Formato legible respetando la fecha ISO asignada (sin cambio de día por UTC) */
export function formatMissionDueDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('es-PE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function formatMissionDueShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

const URGENCY_META: Record<
  MissionDueUrgency,
  { label: string; sublabel?: (days: number) => string; cssClass: string }
> = {
  overdue: {
    label: 'VENCIDA',
    sublabel: (d) => `+${Math.abs(d)}d`,
    cssClass: 'mission-due-overdue',
  },
  today: {
    label: 'HOY',
    cssClass: 'mission-due-today',
  },
  tomorrow: {
    label: 'MAÑANA',
    cssClass: 'mission-due-tomorrow',
  },
  soon: {
    label: 'PRÓXIMA',
    sublabel: (d) => `${d}d`,
    cssClass: 'mission-due-soon',
  },
  week: {
    label: 'ESTA SEMANA',
    sublabel: (d) => `${d}d`,
    cssClass: 'mission-due-week',
  },
  later: {
    label: 'PROGRAMADA',
    sublabel: (d) => `${d}d`,
    cssClass: 'mission-due-later',
  },
};

export function getMissionDueMeta(dueDate: string) {
  const days = daysUntilDue(dueDate);
  const urgency = getMissionDueUrgency(dueDate);
  const meta = URGENCY_META[urgency];
  return {
    urgency,
    days,
    label: meta.label,
    sublabel: meta.sublabel?.(days),
    cssClass: meta.cssClass,
    formatted: formatMissionDueDate(dueDate),
    formattedLong: formatMissionDueShort(dueDate),
  };
}
