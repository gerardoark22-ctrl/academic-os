/**
 * Web Push — suscripción VAPID y snapshot del día para el backend.
 *
 * La fuente de verdad de los datos es Dexie (en el celular). El servidor solo
 * necesita un resumen para redactar el briefing y disparar los avisos con la
 * app cerrada, así que la PWA le empuja ese snapshot cuando cambian los datos
 * y al ocultarse/cerrarse.
 */

import { db } from './db';
import { todayLocalISO, daysBetweenLocalISO } from './localTime';
import { buildAcademicReport, type AcademicReport } from './academicReport';
import type { Course, Mission, Player, TimeBlock } from '../types';

const API_BASE = import.meta.env.VITE_API_URL ?? '';
const TIMES_KEY = 'pushTimes';

export const DEFAULT_MORNING_TIME = '07:00';
export const DEFAULT_NIGHT_TIME = '22:00';

export interface PushTimes {
  morning: string;
  night: string;
}

export interface DayPushSnapshot {
  date: string;
  savedAt: string;
  times: PushTimes;
  /** Mismo informe que alimentaba al Oráculo — el servidor solo lo redacta. */
  report: AcademicReport | null;
  blocks: { id: string; title: string; startTime: string; endTime: string; completed: boolean }[];
  nextExam: { name: string; date: string; daysLeft: number } | null;
}

function url(path: string): string {
  return `${API_BASE}${path}`;
}

export async function getPushTimes(): Promise<PushTimes> {
  const row = await db.settings.get(TIMES_KEY);
  const value = row?.value as Partial<PushTimes> | undefined;
  return {
    morning: value?.morning || DEFAULT_MORNING_TIME,
    night: value?.night || DEFAULT_NIGHT_TIME,
  };
}

export async function setPushTimes(times: PushTimes): Promise<void> {
  await db.settings.put({ key: TIMES_KEY, value: times });
  await pushDaySnapshot();
}

export async function buildDaySnapshot(): Promise<DayPushSnapshot> {
  const today = todayLocalISO();
  const [player, missions, blocks, courses, times] = await Promise.all([
    db.player.get('gerardex') as Promise<Player | undefined>,
    db.missions.toArray() as Promise<Mission[]>,
    db.timeblocks.where('date').equals(today).toArray() as Promise<TimeBlock[]>,
    db.courses.toArray() as Promise<Course[]>,
    getPushTimes(),
  ]);

  const exams = courses
    .flatMap((c) => c.units.map((u) => ({ unit: u, course: c })))
    .filter((x) => x.unit.examDate && x.unit.examDate >= today)
    .sort((a, b) => (a.unit.examDate! > b.unit.examDate! ? 1 : -1));
  const soonest = exams[0];

  return {
    date: today,
    savedAt: new Date().toISOString(),
    times,
    report: player ? buildAcademicReport(player, missions, courses, blocks) : null,
    blocks: blocks
      .filter((b) => b.title && b.type !== 'rest')
      .map((b) => ({
        id: b.id,
        title: b.title,
        startTime: b.startTime,
        endTime: b.endTime,
        completed: b.completed,
      })),
    nextExam: soonest
      ? {
          name: `${soonest.course.name} — ${soonest.unit.name}`,
          date: soonest.unit.examDate!,
          daysLeft: daysBetweenLocalISO(today, soonest.unit.examDate!),
        }
      : null,
  };
}

let lastSnapshotJson = '';

/** Sube el resumen del día. No-op silencioso si no hay red. */
export async function pushDaySnapshot(force = false): Promise<void> {
  try {
    const snap = await buildDaySnapshot();
    const json = JSON.stringify(snap);
    // Las marcas de tiempo cambian siempre: fuera del comparador o el dedupe
    // no serviría de nada.
    const comparable = JSON.stringify(snap, (k, v) =>
      k === 'savedAt' || k === 'generatedAt' ? '' : v,
    );
    if (!force && comparable === lastSnapshotJson) return;
    lastSnapshotJson = comparable;
    await fetch(url('/api/push/snapshot'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json,
      keepalive: true,
    });
  } catch {
    /* sin backend o sin red: reintenta al siguiente cambio */
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export type PushSetupResult = 'ok' | 'denied' | 'unsupported' | 'error';

/** Pide permiso, se suscribe y registra la suscripción en el backend. */
export async function ensurePushSubscription(): Promise<PushSetupResult> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const permission =
      Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';

    const keyRes = await fetch(url('/api/push/public-key'));
    if (!keyRes.ok) return 'error';
    const { key } = (await keyRes.json()) as { key: string };
    if (!key) return 'error';

    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      }));

    const res = await fetch(url('/api/push/subscribe'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    });
    return res.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

/** Dispara un push de prueba inmediato (botón en Configuración). */
export async function sendTestPush(): Promise<boolean> {
  try {
    const res = await fetch(url('/api/push/test'), { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}
