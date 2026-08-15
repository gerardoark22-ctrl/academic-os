import type { Mission, TimeBlock } from '../types';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function escapeICS(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function stampNow(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function toDateOnly(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

function toDateTime(date: string, time: string): string {
  const [h, m] = time.split(':');
  return `${toDateOnly(date)}T${pad(Number(h))}${pad(Number(m))}00`;
}

function buildCalendar(events: string[]): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Academic OS//Odyssey of Gerardex//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

function missionEvent(m: Mission): string {
  const lines = [
    'BEGIN:VEVENT',
    `UID:mission-${m.id}@academic-os`,
    `DTSTAMP:${stampNow()}`,
    `DTSTART;VALUE=DATE:${toDateOnly(m.dueDate)}`,
    `SUMMARY:${escapeICS(`${m.type === 'exam' ? '⚔ ' : ''}${m.title}`)}`,
    `DESCRIPTION:${escapeICS(`Curso: ${m.courseName} · Prioridad: ${m.priority} · +${m.xpReward} XP`)}`,
    'END:VEVENT',
  ];
  return lines.join('\r\n');
}

function blockEvent(b: TimeBlock): string {
  const lines = [
    'BEGIN:VEVENT',
    `UID:block-${b.id}@academic-os`,
    `DTSTAMP:${stampNow()}`,
    `DTSTART:${toDateTime(b.date, b.startTime)}`,
    `DTEND:${toDateTime(b.date, b.endTime)}`,
    `SUMMARY:${escapeICS(b.title || `Bloque ${b.type}`)}`,
    `DESCRIPTION:${escapeICS(`Tipo: ${b.type}${b.completed ? ' · Completado' : ''}`)}`,
    'END:VEVENT',
  ];
  return lines.join('\r\n');
}

export function generateMissionsICS(missions: Mission[]): string {
  const pending = missions.filter((m) => !m.completed);
  return buildCalendar(pending.map(missionEvent));
}

export function generateBlocksICS(blocks: TimeBlock[]): string {
  const scheduled = blocks.filter((b) => b.title && b.type !== 'rest');
  return buildCalendar(scheduled.map(blockEvent));
}

export function generateCombinedICS(missions: Mission[], blocks: TimeBlock[]): string {
  const events = [
    ...missions.filter((m) => !m.completed).map(missionEvent),
    ...blocks.filter((b) => b.title && b.type !== 'rest').map(blockEvent),
  ];
  return buildCalendar(events);
}

export function downloadICS(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportMissionsICS(missions: Mission[], filename = 'misiones-academic-os.ics'): void {
  downloadICS(generateMissionsICS(missions), filename);
}

export function exportBlocksICS(blocks: TimeBlock[], filename = 'horario-academic-os.ics'): void {
  downloadICS(generateBlocksICS(blocks), filename);
}

export function exportCombinedICS(
  missions: Mission[],
  blocks: TimeBlock[],
  filename = 'academic-os.ics',
): void {
  downloadICS(generateCombinedICS(missions, blocks), filename);
}
