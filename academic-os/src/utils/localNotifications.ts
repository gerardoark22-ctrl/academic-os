/**
 * Notificaciones LOCALES (Android nativo vía Capacitor).
 *
 * Reemplaza al Web Push con backend: no hay servidor, no hay internet, no hay
 * costo. Android guarda las alarmas y las dispara aunque la app esté cerrada.
 *
 * El truco: una notificación local se programa CON ANTELACIÓN, así que su texto
 * queda congelado en el momento de programarla. Por eso cada vez que la app se
 * abre o vuelve a primer plano se cancela todo lo pendiente y se REPROGRAMAN
 * las próximas ~48 h leyendo Dexie en ese momento (`rescheduleAll`). Más allá
 * de esas 48 h quedan briefings genéricos de respaldo por si no abre la app.
 *
 * La redacción y el escalado de tono son el puerto directo de lo que vivía en
 * academic_os/api/push.py (borrado).
 */

import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { db } from './db';
import { todayLocalISO, addDaysLocalISO, daysBetweenLocalISO, limaDateTimeToMs } from './localTime';
import { getDailyGoalMinutes } from './dailyGoal';
import type { Course, Mission, Player, TimeBlock } from '../types';

const TIMES_KEY = 'pushTimes';

export const DEFAULT_MORNING_TIME = '07:00';
export const DEFAULT_NIGHT_TIME = '22:00';
const EXAM_HOUR = '09:00';
const OVERDUE_HOUR = '13:00';

/** Días con contenido real leído de Dexie. Más allá van briefings genéricos. */
const REAL_DAYS = 2;
/** Días de respaldo genérico si el dueño no abre la app. */
const FALLBACK_DAYS = 7;

export const BLOCK_END_ACTION_TYPE = 'aos-block-end';

export const isNative = Capacitor.isNativePlatform();

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
  await rescheduleAll();
}

// ── Redacción (puerto de push.py) ───────────────────────────────────────────

export interface DayData {
  date: string;
  blocks: { id: string; title: string; startTime: string; endTime: string; completed: boolean }[];
  dueToday: string[];
  overdue: { title: string; daysOverdue: number }[];
  exam: { name: string; daysLeft: number } | null;
  goalMinutes: number;
}

export function morningBody(d: DayData): string {
  const lineas: string[] = [];
  const pendientes = d.blocks.filter((b) => !b.completed);
  if (d.dueToday.length) {
    lineas.push(`📌 ${d.dueToday.length} para hoy: ${d.dueToday.slice(0, 3).join(', ')}`);
  }
  if (d.overdue.length) lineas.push(`🔥 ${d.overdue.length} vencida(s)`);
  if (pendientes.length) {
    const primero = pendientes.reduce((a, b) => (a.startTime <= b.startTime ? a : b));
    lineas.push(`⏱️ ${pendientes.length} bloque(s) — arranca ${primero.startTime} ${primero.title}`);
  }
  if (d.exam) lineas.push(`🎯 ${d.exam.name} en ${d.exam.daysLeft}d`);
  if (!lineas.length) lineas.push('Día limpio: sin pendientes ni bloques cargados. Carga tu plan.');
  return lineas.join('\n');
}

export function nightBody(d: DayData): string {
  const lineas: string[] = [];
  const sinHacer = d.blocks.filter((b) => !b.completed);
  lineas.push(`Bloques ${d.blocks.length - sinHacer.length}/${d.blocks.length} · meta ${d.goalMinutes} min`);
  if (sinHacer.length) {
    lineas.push('❌ Sin marcar: ' + sinHacer.slice(0, 4).map((b) => b.title).join(', '));
  }
  if (d.overdue.length) lineas.push(`⚠️ Mañana arrastras ${d.overdue.length} misión(es) vencida(s)`);
  if (!sinHacer.length) lineas.push('✅ Todo marcado. Duerme tranquilo.');
  return lineas.join('\n');
}

export function overdueBody(venc: { title: string; daysOverdue: number }[]): [string, string] {
  const peor = venc.reduce((m, x) => Math.max(m, x.daysOverdue), 0);
  const titulos = venc.slice(0, 3).map((m) => m.title).join(', ');
  if (peor >= 7) {
    return [`☠️ ${venc.length} misiones podridas (+${peor}d)`, `${titulos}. Ya no es olvido, es abandono.`];
  }
  if (peor >= 3) {
    return [`🔥 ${venc.length} vencidas hace ${peor} días`, `${titulos}. Cada día que pasa cuesta más.`];
  }
  return [`⏳ ${venc.length} misión(es) vencida(s)`, `${titulos}. Márcala o muévela, pero no la ignores.`];
}

export function examBody(examen: { name: string; daysLeft: number }): [string, string] {
  const d = examen.daysLeft;
  if (d <= 1) return [d === 1 ? '🚨 EXAMEN MAÑANA' : '🚨 EXAMEN HOY', examen.name];
  if (d <= 3) return [`⚔️ ${examen.name}: ${d} días`, 'Ya no hay margen. Hoy toca repasar sí o sí.'];
  return [`🎯 ${examen.name}: ${d} días`, 'Sigue empujando temas: en 3 días esto se pone feo.'];
}

// ── Plan del día ────────────────────────────────────────────────────────────

export interface PlannedNotif {
  atMs: number;
  title: string;
  body: string;
  blockId?: string;
}

/** Los 6 disparadores para un día concreto. Pura — el self-check la usa. */
export function planDay(d: DayData, times: NotifTimes): PlannedNotif[] {
  const at = (hhmm: string) => limaDateTimeToMs(d.date, hhmm);
  const out: PlannedNotif[] = [
    { atMs: at(times.morning), title: '☀️ Briefing del día', body: morningBody(d) },
    { atMs: at(times.night), title: '🌙 Cierre del día', body: nightBody(d) },
  ];

  for (const b of d.blocks) {
    if (b.completed) continue;
    out.push({
      atMs: at(b.startTime),
      title: `▶️ ${b.title}`,
      body: `Bloque ${b.startTime}–${b.endTime}. Empieza ahora.`,
    });
    out.push({
      atMs: at(b.endTime),
      title: `⏱️ ¿Completaste ${b.title}?`,
      body: `El bloque ${b.startTime}–${b.endTime} terminó.`,
      blockId: b.id,
    });
  }

  if (d.overdue.length) {
    const [title, body] = overdueBody(d.overdue);
    out.push({ atMs: at(OVERDUE_HOUR), title, body });
  }

  if (d.exam && d.exam.daysLeft >= 0 && d.exam.daysLeft <= 7) {
    const [title, body] = examBody(d.exam);
    out.push({ atMs: at(EXAM_HOUR), title, body });
  }

  return out.sort((a, b) => a.atMs - b.atMs);
}

// ── Lectura de Dexie ────────────────────────────────────────────────────────

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

// ── Permisos y programación ─────────────────────────────────────────────────

export type PermResult = 'ok' | 'denied' | 'unsupported';

export async function ensureNotifPermission(): Promise<PermResult> {
  if (!isNative) return 'unsupported';
  const cur = await LocalNotifications.checkPermissions();
  const res = cur.display === 'granted' ? cur : await LocalNotifications.requestPermissions();
  if (res.display !== 'granted') return 'denied';
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: BLOCK_END_ACTION_TYPE,
        actions: [
          { id: 'done', title: 'Sí' },
          { id: 'later', title: 'Después' },
        ],
      },
    ],
  });
  return 'ok';
}

let rescheduling = false;

/**
 * Cancela lo pendiente y reprograma: 48 h con contenido real de Dexie, más
 * briefings genéricos de respaldo hasta 7 días.
 */
export async function rescheduleAll(): Promise<number> {
  if (!isNative || rescheduling) return 0;
  rescheduling = true;
  try {
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return 0;

    const times = await getNotifTimes();
    const goal = getDailyGoalMinutes((await db.player.get('gerardex')) as Player | undefined);
    const today = todayLocalISO();
    const now = Date.now();

    const planned: PlannedNotif[] = [];
    for (let i = 0; i < REAL_DAYS; i++) {
      planned.push(...planDay(await readDay(addDaysLocalISO(today, i), goal), times));
    }
    for (let i = REAL_DAYS; i < FALLBACK_DAYS; i++) {
      planned.push({
        atMs: limaDateTimeToMs(addDaysLocalISO(today, i), times.morning),
        title: '☀️ Briefing del día',
        body: 'Abre Academic OS: hace días que no leo tus pendientes.',
      });
    }

    let id = 1000;
    const notifications: LocalNotificationSchema[] = planned
      .filter((p) => p.atMs > now)
      .map((p) => ({
        id: id++,
        title: p.title,
        body: p.body,
        schedule: { at: new Date(p.atMs), allowWhileIdle: true },
        ...(p.blockId
          ? { actionTypeId: BLOCK_END_ACTION_TYPE, extra: { blockId: p.blockId } }
          : {}),
      }));

    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel(pending);
    if (notifications.length) await LocalNotifications.schedule({ notifications });
    return notifications.length;
  } finally {
    rescheduling = false;
  }
}

/** Botón de prueba en Configuración: dispara un aviso a los 5 s. */
export async function sendTestNotification(): Promise<boolean> {
  if ((await ensureNotifPermission()) !== 'ok') return false;
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 999,
        title: '🔔 Prueba de Academic OS',
        body: 'Si ves esto con la app cerrada, las notificaciones funcionan.',
        schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
      },
    ],
  });
  return true;
}
