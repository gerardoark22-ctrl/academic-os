/** Zona horaria del usuario — Perú (sin horario de verano) */
export const APP_TIMEZONE = 'America/Lima';

export function getLocalParts(date = new Date()): {
  dateISO: string;
  hours: number;
  minutes: number;
  timeHHMM: string;
} {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '0';

  const y = get('year');
  const m = get('month');
  const d = get('day');
  let hour = parseInt(get('hour'), 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(get('minute'), 10);

  return {
    dateISO: `${y}-${m}-${d}`,
    hours: hour,
    minutes: minute,
    timeHHMM: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

export function todayLocalISO(): string {
  return getLocalParts().dateISO;
}

export function tomorrowLocalISO(): string {
  return addDaysLocalISO(todayLocalISO(), 1);
}

export function addDaysLocalISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** Días entre fechas ISO (calendario Lima), sin drift UTC */
export function daysBetweenLocalISO(from: string, to: string): number {
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(to) - parse(from)) / 86400000);
}

/** Slots de 30 min (06:00–22:30) */
export function allDaySlotTimes(): string[] {
  const slots: string[] = [];
  for (let hour = 6; hour < 23; hour++) {
    for (const min of [0, 30]) {
      slots.push(`${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
    }
  }
  return slots;
}

export function formatLocalClock(date = new Date()): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

/** Fecha legible en calendario Perú (ej. domingo, 21 de junio de 2025) */
export function formatLocalDateLong(date = new Date()): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: APP_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** ¿El slot de inicio aún no ha comenzado hoy en Perú? */
export function isSlotFutureOnDate(
  dateISO: string,
  slotStart: string,
  now = new Date(),
): boolean {
  const { dateISO: today, timeHHMM } = getLocalParts(now);
  if (dateISO > today) return true;
  if (dateISO < today) return false;
  return minutesFromHHMM(slotStart) > minutesFromHHMM(timeHHMM);
}

export function getOracleTimeSnapshot(now = new Date()) {
  const { dateISO, timeHHMM } = getLocalParts(now);
  return {
    timezone: APP_TIMEZONE,
    timezoneLabel: 'Perú (America/Lima, UTC-5)',
    dateISO,
    timeHHMM,
    dateLong: formatLocalDateLong(now),
    clock: formatLocalClock(now),
  };
}

export function minutesFromHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

/** Instantánea en ms para fecha+hora en America/Lima (UTC-5, sin DST) */
export function limaDateTimeToMs(date: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const time = `${String(h).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}:00`;
  return new Date(`${date}T${time}-05:00`).getTime();
}

export function getBlockRemainingMs(
  block: { date: string; endTime: string },
  now = new Date(),
): number {
  const endMs = limaDateTimeToMs(block.date, block.endTime);
  return Math.max(0, endMs - now.getTime());
}

export function hasBlockSlotEnded(
  block: { date: string; endTime: string },
  now = new Date(),
): boolean {
  return getBlockRemainingMs(block, now) <= 0;
}

export function formatRemainingClock(totalMs: number): string {
  const totalSec = Math.ceil(totalMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function getBlockSlotProgress(
  block: { date: string; startTime: string; endTime: string },
  now = new Date(),
): number {
  const startMs = limaDateTimeToMs(block.date, block.startTime);
  const endMs = limaDateTimeToMs(block.date, block.endTime);
  const nowMs = now.getTime();
  if (nowMs <= startMs) return 0;
  if (nowMs >= endMs) return 100;
  return ((nowMs - startMs) / (endMs - startMs)) * 100;
}

export function isBlockAssigned(block: {
  title?: string;
  type?: string;
}): boolean {
  return !!block.title && block.type !== 'rest';
}

export type BlockLiveStatus = 'future' | 'live' | 'missed' | 'done' | 'idle';

/** Estado del bloque respecto al reloj en Perú */
export function getBlockLiveStatus(
  block: {
    date: string;
    startTime: string;
    endTime: string;
    completed: boolean;
    title?: string;
    type?: string;
  },
  now = new Date(),
): BlockLiveStatus {
  if (block.completed) return 'done';

  const { dateISO, timeHHMM } = getLocalParts(now);
  const nowMin = minutesFromHHMM(timeHHMM);
  const startMin = minutesFromHHMM(block.startTime);
  const endMin = minutesFromHHMM(block.endTime);
  const assigned = isBlockAssigned(block);

  if (block.date < dateISO) return assigned ? 'missed' : 'idle';
  if (block.date > dateISO) return 'future';

  if (nowMin >= endMin) return assigned ? 'missed' : 'idle';
  if (nowMin >= startMin) return 'live';
  return 'future';
}
