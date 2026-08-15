import type { WeeklyPlanDay } from './deepseekClient';
import { todayISO } from './gamification';

const DAY_OFFSET: Record<string, number> = {
  lunes: 0,
  martes: 1,
  miercoles: 2,
  miércoles: 2,
  jueves: 3,
  viernes: 4,
  sabado: 5,
  sábado: 5,
  domingo: 6,
};

export function mondayOfWeek(ref = new Date()): string {
  const d = new Date(ref);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().split('T')[0];
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function dateForPlanDay(weekMonday: string, dayName: string): string | null {
  const key = dayName.toLowerCase().trim();
  const offset = DAY_OFFSET[key];
  if (offset === undefined) return null;
  return addDays(weekMonday, offset);
}

export function nextWeekMonday(): string {
  return addDays(mondayOfWeek(), 7);
}

export interface ApplyPlanResult {
  applied: number;
  skipped: number;
}

export function summarizePlan(plan: WeeklyPlanDay[]): string {
  const lines: string[] = [];
  for (const day of plan) {
    for (const b of day.blocks) {
      lines.push(`${day.day} ${b.startTime} — ${b.title} (${b.durationMin}m)`);
    }
  }
  return lines.join('\n');
}

export function weekLabel(monday: string): string {
  const end = addDays(monday, 6);
  return `${monday} → ${end}`;
}

export function defaultWeekStart(nextWeek: boolean): string {
  return nextWeek ? nextWeekMonday() : mondayOfWeek(new Date(todayISO() + 'T12:00:00'));
}
