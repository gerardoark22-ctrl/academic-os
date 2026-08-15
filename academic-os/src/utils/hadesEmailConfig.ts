import type { Player, HadesEmailSlotSettings } from '../types';
import { todayISO } from './gamification';
import { addDaysLocalISO } from './localTime';
import {
  HADES_RULES,
  shouldSendHadesEmailSlot,
  type HadesEmailSlot,
  type HadesTriggerState,
} from './hadesRules';

export type HadesEmailFrequency = import('../types').HadesEmailFrequency;
export type { HadesEmailSlotSettings };

export interface HadesEmailSlotUiMeta {
  slot: HadesEmailSlot;
  title: string;
  topic: string;
  conditions: string[];
  timed: boolean;
}

export const HADES_EMAIL_SLOT_UI: HadesEmailSlotUiMeta[] = [
  {
    slot: 'fiveAm',
    title: 'Planificación matutina',
    topic: 'Oráculo IA — misiones, exámenes y temas del día',
    timed: true,
    conditions: [
      'Lista misiones de hoy, exámenes cercanos y temas pendientes',
      'Por defecto: todos los días a las 05:00 (Perú)',
    ],
  },
  {
    slot: 'sixPm',
    title: 'Alerta de mediodía-tarde',
    topic: '0 min de estudio o crisis de examen',
    timed: true,
    conditions: ['0 min de estudio hoy', 'O crisis de examen (prep. <60% con examen ≤7d)'],
  },
  {
    slot: 'ninePm',
    title: 'Meta diaria pendiente',
    topic: 'Recordatorio si no cumpliste la meta de estudio',
    timed: true,
    conditions: ['Meta diaria de estudio NO cumplida'],
  },
  {
    slot: 'evening',
    title: 'Informe de deuda académica',
    topic: 'Inframundo, misiones vencidas, temas sin dominar',
    timed: true,
    conditions: [
      'Inframundo, inactividad, misiones vencidas',
      'Temas pendientes con examen cercano, meta sin cumplir',
    ],
  },
  {
    slot: 'elevenPm',
    title: 'Balance nocturno',
    topic: 'Valoración del día (PÉSIMO → EXCELENTE) con IA',
    timed: true,
    conditions: ['Resumen franco del día con valoración IA', 'Por defecto: todos los días a las 23:00'],
  },
  {
    slot: 'inactivity6h',
    title: 'Inactividad prolongada',
    topic: 'Sin usar ni avanzar en la app',
    timed: false,
    conditions: [`Correo si pasan N horas sin actividad (default ${HADES_RULES.inactivityHours}h)`],
  },
];

const DEFAULTS: Record<HadesEmailSlot, HadesEmailSlotSettings> = {
  fiveAm: { hour: HADES_RULES.fiveAmHour, minute: 0, frequency: 'daily' },
  sixPm: { hour: HADES_RULES.sixPmHour, minute: 0, frequency: 'conditional' },
  ninePm: { hour: HADES_RULES.ninePmHour, minute: 0, frequency: 'conditional' },
  evening: { hour: HADES_RULES.eveningHour, minute: 0, frequency: 'conditional' },
  elevenPm: { hour: HADES_RULES.elevenPmHour, minute: 0, frequency: 'daily' },
  inactivity6h: {
    hour: 0,
    minute: 0,
    frequency: 'conditional',
    intervalHours: HADES_RULES.inactivityHours,
  },
};

export function getDefaultHadesEmailSlots(): Record<HadesEmailSlot, HadesEmailSlotSettings> {
  return { ...DEFAULTS };
}

function clampHour(h: number): number {
  return Math.max(0, Math.min(23, Math.floor(h)));
}

function clampMinute(m: number): number {
  return Math.max(0, Math.min(59, Math.floor(m)));
}

export function normalizeSlotSettings(
  raw: Partial<HadesEmailSlotSettings> | undefined,
): HadesEmailSlotSettings | undefined {
  if (!raw) return undefined;
  return {
    hour: clampHour(raw.hour ?? 0),
    minute: clampMinute(raw.minute ?? 0),
    frequency: raw.frequency ?? 'conditional',
    intervalHours:
      raw.intervalHours != null
        ? Math.max(1, Math.min(24, Math.floor(raw.intervalHours)))
        : undefined,
  };
}

/** Config vigente hoy (activa + defaults). */
export function getEffectiveHadesEmailSlots(
  player?: Player | null,
): Record<HadesEmailSlot, HadesEmailSlotSettings> {
  const base = getDefaultHadesEmailSlots();
  if (!player?.hadesEmailSlotsActive) return base;
  const out = { ...base };
  for (const slot of Object.keys(base) as HadesEmailSlot[]) {
    const norm = normalizeSlotSettings(player.hadesEmailSlotsActive[slot]);
    if (norm) out[slot] = { ...out[slot], ...norm };
  }
  return out;
}

/** Config pendiente completa (para formulario / vista previa). */
export function getPendingHadesEmailSlots(
  player?: Player | null,
): Record<HadesEmailSlot, HadesEmailSlotSettings> | null {
  if (!player?.hadesEmailSlotsPending) return null;
  const base = getEffectiveHadesEmailSlots(player);
  const out = { ...base };
  for (const slot of Object.keys(base) as HadesEmailSlot[]) {
    const norm = normalizeSlotSettings(player.hadesEmailSlotsPending[slot]);
    if (norm) out[slot] = { ...out[slot], ...norm };
  }
  return out;
}

export function getSlotSettings(player: Player | null | undefined, slot: HadesEmailSlot): HadesEmailSlotSettings {
  return getEffectiveHadesEmailSlots(player)[slot];
}

export function settingsToTimeValue(s: HadesEmailSlotSettings): string {
  return `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
}

export function timeValueToSettings(time: string, base: HadesEmailSlotSettings): HadesEmailSlotSettings {
  const [h, m] = time.split(':').map((x) => parseInt(x, 10));
  return {
    ...base,
    hour: clampHour(Number.isFinite(h) ? h : base.hour),
    minute: clampMinute(Number.isFinite(m) ? m : base.minute),
  };
}

export function nextHadesConfigEffectiveDate(from = todayISO()): string {
  return addDaysLocalISO(from, 1);
}

/** Aplica configuración pendiente si ya es su fecha efectiva. */
export function applyPendingHadesEmailConfig(player: Player): { player: Player; applied: boolean } {
  const today = todayISO();
  if (!player.hadesEmailSlotsPendingFrom || player.hadesEmailSlotsPendingFrom > today) {
    return { player, applied: false };
  }
  if (!player.hadesEmailSlotsPending) {
    return {
      player: {
        ...player,
        hadesEmailSlotsPendingFrom: undefined,
      },
      applied: false,
    };
  }

  const merged = getPendingHadesEmailSlots(player) ?? getEffectiveHadesEmailSlots(player);
  return {
    player: {
      ...player,
      hadesEmailSlotsActive: merged,
      hadesEmailSlotsPending: undefined,
      hadesEmailSlotsPendingFrom: undefined,
    },
    applied: true,
  };
}

export function shouldDispatchHadesEmailSlot(
  slot: HadesEmailSlot,
  triggers: HadesTriggerState,
  player?: Player | null,
): boolean {
  const settings = getSlotSettings(player, slot);
  if (settings.frequency === 'disabled') return false;
  if (settings.frequency === 'daily') return true;
  return shouldSendHadesEmailSlot(slot, triggers);
}

export function formatSlotScheduleLabel(slot: HadesEmailSlot, player?: Player | null): string {
  const s = getSlotSettings(player, slot);
  if (slot === 'inactivity6h') {
    return `cada ${s.intervalHours ?? HADES_RULES.inactivityHours}h sin actividad`;
  }
  const freq =
    s.frequency === 'daily' ? 'diario' : s.frequency === 'disabled' ? 'desactivado' : 'si aplica';
  return `${settingsToTimeValue(s)} Perú · ${freq}`;
}

export function inactivityIntervalHours(player?: Player | null): number {
  return getSlotSettings(player, 'inactivity6h').intervalHours ?? HADES_RULES.inactivityHours;
}

export function slotClockMinutes(player: Player | null | undefined, slot: HadesEmailSlot): number {
  const s = getSlotSettings(player, slot);
  return s.hour * 60 + s.minute;
}
