import type { Mission } from '../types';
import { daysUntil } from './gamification';
import { isHighPriority } from './priorityMigrate';

export type EisenhowerQuadrant = 'do' | 'schedule' | 'delegate' | 'eliminate';

export const EISENHOWER_META: Record<
  EisenhowerQuadrant,
  { label: string; subtitle: string; color: string; icon: string }
> = {
  do: {
    label: 'HACER YA',
    subtitle: 'Urgente e importante',
    color: '#DC143C',
    icon: '🔥',
  },
  schedule: {
    label: 'PLANIFICAR',
    subtitle: 'Importante, no urgente',
    color: '#FFD700',
    icon: '⚔',
  },
  delegate: {
    label: 'DELEGAR / RÁPIDO',
    subtitle: 'Urgente, menos crítico',
    color: '#1E90FF',
    icon: '⚡',
  },
  eliminate: {
    label: 'DESCARTAR',
    subtitle: 'Ni urgente ni vital',
    color: '#6B5A4A',
    icon: '💀',
  },
};

function isImportant(m: Mission): boolean {
  return isHighPriority(m.priority);
}

function isUrgent(m: Mission): boolean {
  if (!m.dueDate) return false;
  const days = daysUntil(m.dueDate);
  return days <= 3;
}

export function classifyMission(m: Mission): EisenhowerQuadrant {
  const urgent = isUrgent(m);
  const important = isImportant(m);
  if (urgent && important) return 'do';
  if (!urgent && important) return 'schedule';
  if (urgent && !important) return 'delegate';
  return 'eliminate';
}

export function groupByEisenhower(missions: Mission[]): Record<EisenhowerQuadrant, Mission[]> {
  const groups: Record<EisenhowerQuadrant, Mission[]> = {
    do: [],
    schedule: [],
    delegate: [],
    eliminate: [],
  };
  for (const m of missions.filter((x) => !x.completed)) {
    groups[classifyMission(m)].push(m);
  }
  return groups;
}

export function buildMonthGrid(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = last.getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export function dateFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export const WEEKDAY_LABELS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

export const WEEKDAY_COLORS = [
  '#C2185B', '#689F38', '#F9A825', '#00897B', '#43A047', '#8E24AA', '#E64A19',
];
