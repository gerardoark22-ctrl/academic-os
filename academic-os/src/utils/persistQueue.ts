import { db } from './db';
import type {
  AppSettings,
  Course,
  DailyMissionDayRecord,
  Mission,
  Player,
  TimeBlock,
  WeeklyMissionWeekRecord,
} from '../types';

type TableName =
  | 'player'
  | 'courses'
  | 'missions'
  | 'timeblocks'
  | 'settings'
  | 'dailyMissions'
  | 'weeklyMissions';

type QueueEntry =
  | { table: TableName; op: 'put'; id: string; data: unknown }
  | { table: TableName; op: 'delete'; id: string };

const FLUSH_DEBOUNCE_MS = 180;
const SAFETY_FLUSH_MS = 25_000;

class PersistQueue {
  private pending = new Map<string, QueueEntry>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushPromise: Promise<void> | null = null;
  private debounceWaiters: Array<{ resolve: () => void; reject: (e: unknown) => void }> = [];
  private inFlight = 0;

  private mapKey(table: TableName, id: string) {
    return `${table}:${id}`;
  }

  enqueuePut(table: TableName, id: string, data: unknown) {
    this.pending.set(this.mapKey(table, id), { table, op: 'put', id, data });
    this.scheduleFlush();
  }

  enqueueDelete(table: TableName, id: string) {
    this.pending.set(this.mapKey(table, id), { table, op: 'delete', id });
    this.scheduleFlush();
  }

  hasPending(): boolean {
    return this.pending.size > 0 || this.inFlight > 0;
  }

  /** Espera el flush debounced tras encolar (para await en stores). */
  async waitForFlush(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.debounceWaiters.push({ resolve, reject });
      this.scheduleFlush();
    });
    while (this.inFlight > 0) {
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  /** Flush inmediato — al ocultar pestaña o cerrar. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.flushPromise) return this.flushPromise;
    if (this.pending.size === 0) return;
    this.flushPromise = this.runFlush();
    try {
      await this.flushPromise;
    } finally {
      this.flushPromise = null;
    }
  }

  private scheduleFlush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, FLUSH_DEBOUNCE_MS);
  }

  private resolveWaiters(err?: unknown) {
    const waiters = this.debounceWaiters.splice(0);
    for (const w of waiters) {
      if (err) w.reject(err);
      else w.resolve();
    }
  }

  private async runFlush() {
    const batch = [...this.pending.entries()];
    this.pending.clear();
    if (batch.length === 0) {
      this.resolveWaiters();
      return;
    }

    this.inFlight++;
    const failed = new Map<string, QueueEntry>();

    try {
      const tables = new Set<TableName>();
      for (const [, entry] of batch) tables.add(entry.table);

      await db.transaction(
        'rw',
        [
          db.player,
          db.courses,
          db.missions,
          db.timeblocks,
          db.settings,
          db.dailyMissions,
          db.weeklyMissions,
        ],
        async () => {
          const puts: Partial<Record<TableName, unknown[]>> = {};
          const deletes: Partial<Record<TableName, string[]>> = {};

          for (const [, entry] of batch) {
            if (entry.op === 'delete') {
              deletes[entry.table] = [...(deletes[entry.table] ?? []), entry.id];
            } else {
              puts[entry.table] = [...(puts[entry.table] ?? []), entry.data];
            }
          }

          if (deletes.player?.length) await db.player.bulkDelete(deletes.player);
          if (deletes.courses?.length) await db.courses.bulkDelete(deletes.courses);
          if (deletes.missions?.length) await db.missions.bulkDelete(deletes.missions);
          if (deletes.timeblocks?.length) await db.timeblocks.bulkDelete(deletes.timeblocks);
          if (deletes.settings?.length) await db.settings.bulkDelete(deletes.settings);
          if (deletes.dailyMissions?.length) await db.dailyMissions.bulkDelete(deletes.dailyMissions);
          if (deletes.weeklyMissions?.length) await db.weeklyMissions.bulkDelete(deletes.weeklyMissions);

          if (puts.player?.length) await db.player.bulkPut(puts.player as Player[]);
          if (puts.courses?.length) await db.courses.bulkPut(puts.courses as Course[]);
          if (puts.missions?.length) await db.missions.bulkPut(puts.missions as Mission[]);
          if (puts.timeblocks?.length) await db.timeblocks.bulkPut(puts.timeblocks as TimeBlock[]);
          if (puts.settings?.length) await db.settings.bulkPut(puts.settings as AppSettings[]);
          if (puts.dailyMissions?.length) {
            await db.dailyMissions.bulkPut(puts.dailyMissions as DailyMissionDayRecord[]);
          }
          if (puts.weeklyMissions?.length) {
            await db.weeklyMissions.bulkPut(puts.weeklyMissions as WeeklyMissionWeekRecord[]);
          }
        },
      );

      this.resolveWaiters();
    } catch (err) {
      for (const [key, entry] of batch) {
        if (!this.pending.has(key)) failed.set(key, entry);
      }
      for (const [key, entry] of failed) this.pending.set(key, entry);
      console.error('[persist] Error al guardar — reintentando en cola', err);
      this.resolveWaiters(err);
      throw err;
    } finally {
      this.inFlight--;
    }
  }

  /** Bloquea hasta vaciar cola (cierre de pestaña). */
  async drain(): Promise<void> {
    await this.flush();
    while (this.inFlight > 0) {
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  startSafetyInterval() {
    return window.setInterval(() => {
      if (this.hasPending()) void this.flush();
    }, SAFETY_FLUSH_MS);
  }
}

export const persistQueue = new PersistQueue();
