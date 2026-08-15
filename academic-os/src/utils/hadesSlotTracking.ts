import type { Player } from '../types';
import { todayISO } from './gamification';
import { type HadesEmailSlot } from './hadesRules';
import {
  getSlotSettings,
  inactivityIntervalHours,
  slotClockMinutes,
} from './hadesEmailConfig';

/** Slots que se envían siempre a su hora (1× por día). */
export const MANDATORY_DAILY_SLOTS: HadesEmailSlot[] = ['fiveAm', 'elevenPm'];

export const ALL_HADES_EMAIL_SLOTS: HadesEmailSlot[] = [
  'fiveAm',
  'sixPm',
  'ninePm',
  'evening',
  'elevenPm',
  'inactivity6h',
];

export function isHadesSlotSentToday(player: Player, slot: HadesEmailSlot): boolean {
  const today = todayISO();
  switch (slot) {
    case 'fiveAm':
      return player.lastHadesEmailFiveAm === today;
    case 'sixPm':
      return player.lastHadesEmailSixPm === today;
    case 'ninePm':
      return player.lastHadesEmailNinePm === today;
    case 'evening':
      return player.lastHadesEmailEvening === today;
    case 'elevenPm':
      return player.lastHadesEmailElevenPm === today;
    case 'inactivity6h': {
      if (!player.lastHadesInactivityEmailAt) return false;
      const interval = inactivityIntervalHours(player);
      const hours =
        (Date.now() - new Date(player.lastHadesInactivityEmailAt).getTime()) / 3_600_000;
      return hours < interval;
    }
    default:
      return false;
  }
}

export function patchForHadesSlot(slot: HadesEmailSlot, today = todayISO()): Partial<Player> {
  const patch: Partial<Player> = { lastShameEmailDate: today };
  switch (slot) {
    case 'fiveAm':
      patch.lastHadesEmailFiveAm = today;
      break;
    case 'sixPm':
      patch.lastHadesEmailSixPm = today;
      break;
    case 'ninePm':
      patch.lastHadesEmailNinePm = today;
      break;
    case 'evening':
      patch.lastHadesEmailEvening = today;
      break;
    case 'elevenPm':
      patch.lastHadesEmailElevenPm = today;
      break;
    case 'inactivity6h':
      patch.lastHadesInactivityEmailAt = new Date().toISOString();
      break;
  }
  return patch;
}

export function slotHour(slot: HadesEmailSlot, player?: Player | null): number | null {
  if (slot === 'inactivity6h') return null;
  return getSlotSettings(player, slot).hour;
}

export function slotMinute(slot: HadesEmailSlot, player?: Player | null): number {
  return getSlotSettings(player, slot).minute;
}

/** Slots con hora fija, en orden cronológico del día (Perú). */
export const TIMED_HADES_SLOTS: HadesEmailSlot[] = [
  'fiveAm',
  'sixPm',
  'ninePm',
  'evening',
  'elevenPm',
];

/** ¿Ya pasó la hora programada del slot hoy? */
export function isTimedSlotDue(
  currentHour: number,
  slot: HadesEmailSlot,
  player?: Player | null,
  currentMinute = 0,
): boolean {
  if (slot === 'inactivity6h') return false;
  const settings = getSlotSettings(player, slot);
  if (settings.frequency === 'disabled') return false;
  const slotMin = slotClockMinutes(player, slot);
  const nowMin = currentHour * 60 + currentMinute;
  return nowMin >= slotMin;
}

/** Slots programados cuya hora ya pasó hoy y aún no se enviaron. */
export function getMissedTimedSlots(
  player: Player,
  currentHour: number,
  currentMinute = 0,
): HadesEmailSlot[] {
  return TIMED_HADES_SLOTS.filter(
    (slot) =>
      isTimedSlotDue(currentHour, slot, player, currentMinute)
      && !isHadesSlotSentToday(player, slot),
  );
}
