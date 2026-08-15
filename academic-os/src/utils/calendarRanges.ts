import { addDaysLocalISO } from './localTime';
import { getWeekKey } from './hadesShield';

/** Fechas ISO desde `from` inclusive hasta `to` exclusive. */
export function enumerateDatesUntil(from: string, toExclusive: string): string[] {
  const dates: string[] = [];
  let cur = from;
  while (cur < toExclusive) {
    dates.push(cur);
    cur = addDaysLocalISO(cur, 1);
  }
  return dates;
}

/** Claves de semana (lunes) desde `fromWeekKey` inclusive hasta `toWeekKey` exclusive. */
export function enumerateWeekKeysUntil(fromWeekKey: string, toWeekKey: string): string[] {
  const keys: string[] = [];
  let cur = fromWeekKey;
  let guard = 0;
  while (cur !== toWeekKey && guard < 54) {
    keys.push(cur);
    cur = getWeekKey(addDaysLocalISO(cur, 7));
    guard++;
  }
  return keys;
}
