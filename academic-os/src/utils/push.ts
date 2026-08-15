/**
 * Notificaciones PUSH por Firebase Cloud Messaging (FCM).
 *
 * Por qué esto y no alarmas locales de Android: el gestor de batería de Samsung
 * mata `AlarmManager`, así que las notificaciones locales nunca sonaban. FCM
 * llega por Google Play Services — el mismo canal que WhatsApp — y está
 * verificado que sí suena en ese celular con la app cerrada.
 *
 * Reparto de responsabilidades:
 *   - Cliente (este archivo): pide permiso, saca el token de FCM y sube a
 *     Supabase el "snapshot del día" (lo que hay en Dexie, que vive solo aquí).
 *   - Servidor (netlify/functions/despachar.js): cada 5 min lee ese snapshot,
 *     decide qué toca enviar y lo manda por FCM.
 *
 * Se copia el patrón de NoMimir: el SDK de Firebase se carga por URL desde
 * gstatic, sin dependencia de npm.
 */

import { db } from './db';
import { getNotifTimes, type NotifTimes } from './notifTimes';
import { todayLocalISO, addDaysLocalISO, daysBetweenLocalISO } from './localTime';
import { getDailyGoalMinutes } from './dailyGoal';
import type { Course, Mission, Player, TimeBlock } from '../types';

const env = import.meta.env;

/** Públicas por diseño: Firebase y Supabase las exponen a propósito en el navegador. */
export const FIREBASE_CONFIG = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
  messagingSenderId: env.VITE_FIREBASE_SENDER_ID ?? '',
  appId: env.VITE_FIREBASE_APP_ID ?? '',
};
export const VAPID_KEY: string = env.VITE_FIREBASE_VAPID_KEY ?? '';
const SUPABASE_URL: string = env.VITE_SUPABASE_URL ?? 'https://ytfpvmnxchkwiujphxeb.supabase.co';
const SUPABASE_ANON_KEY: string = env.VITE_SUPABASE_ANON_KEY ?? '';

/** Un solo usuario: todas las filas de Supabase llevan este id. */
export const USER_ID = 'gerardex';

export const pushConfigured = (): boolean =>
  !!(FIREBASE_CONFIG.apiKey && VAPID_KEY && SUPABASE_ANON_KEY);

// ── Supabase por REST, sin librería ─────────────────────────────────────────

async function supaUpsert(table: string, row: unknown, onConflict: string): Promise<void> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`Supabase ${table}: ${r.status} ${await r.text()}`);
}

// ── Snapshot del día (lectura de Dexie) ─────────────────────────────────────

export interface DayData {
  date: string;
  blocks: { id: string; title: string; startTime: string; endTime: string; completed: boolean }[];
  dueToday: string[];
  overdue: { title: string; daysOverdue: number }[];
  exam: { name: string; daysLeft: number } | null;
  goalMinutes: number;
}

async function readDay(date: string, goalMinutes: number): Promise<DayData> {
  const [missions, blocks, courses] = await Promise.all([
    db.missions.toArray() as Promise<Mission[]>,
    db.timeblocks.where('date').equals(date).toArray() as Promise<TimeBlock[]>,
    db.courses.toArray() as Promise<Course[]>,
  ]);

  const activas = missions.filter((m) => !m.completed && m.dueDate);
  const soonest = courses
    .flatMap((c) => c.units.map((u) => ({ unit: u, course: c })))
    .filter((x) => x.unit.examDate && x.unit.examDate >= date)
    .sort((a, b) => (a.unit.examDate! > b.unit.examDate! ? 1 : -1))[0];

  return {
    date,
    blocks: blocks
      .filter((b) => b.title && b.type !== 'rest')
      .map((b) => ({
        id: b.id,
        title: b.title,
        startTime: b.startTime,
        endTime: b.endTime,
        completed: b.completed,
      })),
    dueToday: activas.filter((m) => m.dueDate === date).map((m) => m.title),
    overdue: activas
      .filter((m) => m.dueDate < date)
      .map((m) => ({ title: m.title, daysOverdue: daysBetweenLocalISO(m.dueDate, date) }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue),
    exam: soonest
      ? {
          name: `${soonest.course.name} — ${soonest.unit.name}`,
          daysLeft: daysBetweenLocalISO(date, soonest.unit.examDate!),
        }
      : null,
    goalMinutes,
  };
}

/**
 * Sube a Supabase hoy y mañana (mañana evita que un briefing temprano se quede
 * sin datos si la app no se abre en la madrugada) junto con las horas elegidas.
 * Silencioso a propósito: es de fondo, no debe romper la UI.
 */
export async function syncSnapshot(): Promise<boolean> {
  if (!SUPABASE_ANON_KEY) return false;
  try {
    const times: NotifTimes = await getNotifTimes();
    const goal = getDailyGoalMinutes((await db.player.get('gerardex')) as Player | undefined);
    const today = todayLocalISO();
    const days = [await readDay(today, goal), await readDay(addDaysLocalISO(today, 1), goal)];

    await supaUpsert(
      'aos_snapshot',
      {
        user_id: USER_ID,
        fecha: today,
        morning: times.morning,
        night: times.night,
        days,
        updated_at: new Date().toISOString(),
      },
      'user_id',
    );
    return true;
  } catch (e) {
    console.warn('syncSnapshot', e);
    return false;
  }
}

// ── Permiso + token de FCM ──────────────────────────────────────────────────

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (e) {
    console.warn('sw.register', e);
    return null;
  }
}

export type PushResult = { ok: true; token: string } | { ok: false; error: string };

export async function enablePush(): Promise<PushResult> {
  if (!pushConfigured()) {
    return { ok: false, error: 'Faltan las variables VITE_FIREBASE_* / VITE_SUPABASE_ANON_KEY (ver DESPLIEGUE.md).' };
  }
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return { ok: false, error: 'Este navegador no soporta notificaciones push.' };
  }
  try {
    if ((await Notification.requestPermission()) !== 'granted') {
      return { ok: false, error: 'No aceptaste el permiso de notificaciones.' };
    }

    await registerServiceWorker();
    const reg = await navigator.serviceWorker.ready;

    const base = 'https://www.gstatic.com/firebasejs/10.12.5';
    const { initializeApp } = await import(/* @vite-ignore */ `${base}/firebase-app.js`);
    const { getMessaging, getToken } = await import(/* @vite-ignore */ `${base}/firebase-messaging.js`);
    const messaging = getMessaging(initializeApp(FIREBASE_CONFIG));
    const token: string = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg,
    });
    if (!token) return { ok: false, error: 'Firebase no devolvió token.' };

    await supaUpsert('aos_push_subs', { token, user_id: USER_ID }, 'token');
    await syncSnapshot();
    return { ok: true, token };
  } catch (e) {
    console.error('enablePush', e);
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

/** Diagnóstico legible: sin esto todos los fallos se ven igual (no llega nada). */
export async function diagnose(): Promise<string> {
  if (!pushConfigured()) return '❌ Faltan variables de entorno (VITE_FIREBASE_* / VITE_SUPABASE_ANON_KEY).';
  if (!('serviceWorker' in navigator)) return '❌ Este navegador no soporta service workers.';
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    return '❌ El push necesita HTTPS. Abre la versión de Netlify, no un archivo local.';
  }
  const perm = Notification.permission;
  if (perm !== 'granted') return `⚠️ Permiso de notificaciones: ${perm}. Pulsa "Activar push".`;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return '⚠️ Permiso OK pero el service worker no está registrado. Recarga la página.';
  const sub = await reg.pushManager.getSubscription();
  const snap = await syncSnapshot();
  return [
    '✅ Permiso OK · service worker activo',
    sub ? '✅ Suscripción push presente' : '⚠️ Sin suscripción push: pulsa "Activar push".',
    snap ? '✅ Snapshot del día subido a Supabase' : '❌ No se pudo subir el snapshot (revisa Supabase).',
  ].join('\n');
}
