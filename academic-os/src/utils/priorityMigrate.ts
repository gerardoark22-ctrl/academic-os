import type { MissionPriority } from '../types';

/** Migra prioridades legacy → épica / odisea / chiste */
export function migratePriority(p?: string | null): MissionPriority {
  if (p === 'legendary' || p === 'odisea') return 'odisea';
  if (p === 'epic' || p === 'epica') return 'epica';
  if (p === 'common' || p === 'chiste') return 'chiste';
  return 'chiste';
}

export function isHighPriority(p: MissionPriority): boolean {
  return p === 'odisea' || p === 'epica';
}
