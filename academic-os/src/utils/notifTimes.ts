/**
 * Horas configurables del briefing matutino y el cierre nocturno.
 *
 * Solo las horas viven en el cliente. La redacción de los avisos y el plan del
 * día ahora viven en el servidor (netlify/functions/plan.js), porque el push lo
 * arma Netlify, no el navegador.
 */

import { db } from './db';

const TIMES_KEY = 'pushTimes';

export const DEFAULT_MORNING_TIME = '07:00';
export const DEFAULT_NIGHT_TIME = '22:00';

export interface NotifTimes {
  morning: string;
  night: string;
}

export async function getNotifTimes(): Promise<NotifTimes> {
  const row = await db.settings.get(TIMES_KEY);
  const value = row?.value as Partial<NotifTimes> | undefined;
  return {
    morning: value?.morning || DEFAULT_MORNING_TIME,
    night: value?.night || DEFAULT_NIGHT_TIME,
  };
}

export async function setNotifTimes(times: NotifTimes): Promise<void> {
  await db.settings.put({ key: TIMES_KEY, value: times });
}

// ── Tipos de notificación: prender/apagar por separado ──────────────────────

const ENABLED_KEY = 'notifEnabled';

export type NotifTipo = 'briefing' | 'cierre' | 'bloques' | 'tareas' | 'examen';

export type NotifEnabled = Record<NotifTipo, boolean>;

export const DEFAULT_NOTIF_ENABLED: NotifEnabled = {
  briefing: true,
  cierre: true,
  bloques: true,
  tareas: true,
  examen: true,
};

export async function getNotifEnabled(): Promise<NotifEnabled> {
  const row = await db.settings.get(ENABLED_KEY);
  const value = row?.value as Partial<NotifEnabled> | undefined;
  return { ...DEFAULT_NOTIF_ENABLED, ...value };
}

export async function setNotifEnabled(enabled: NotifEnabled): Promise<void> {
  await db.settings.put({ key: ENABLED_KEY, value: enabled });
}
