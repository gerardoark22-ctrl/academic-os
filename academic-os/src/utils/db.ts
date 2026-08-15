import Dexie, { type Table } from 'dexie';
import type { Course, Mission, Player, TimeBlock, AppSettings, DailyMissionDayRecord, WeeklyMissionWeekRecord } from '../types';
import { normalizeCourse } from './courseNormalize';
import { createDefaultPlayer, ODYSSEY_RESET_VERSION } from './defaultPlayer';

export class AcademicOsDB extends Dexie {
  player!: Table<Player>;
  courses!: Table<Course>;
  missions!: Table<Mission>;
  timeblocks!: Table<TimeBlock>;
  settings!: Table<AppSettings>;
  dailyMissions!: Table<DailyMissionDayRecord>;
  weeklyMissions!: Table<WeeklyMissionWeekRecord>;

  constructor() {
    super('OdysseyGerardexDB');
    this.version(1).stores({
      player: 'id',
      courses: 'id, name, progress',
      missions: 'id, dueDate, priority, completed, courseId',
      timeblocks: 'id, date, completed',
      settings: 'key',
    });
    this.version(2)
      .stores({
        player: 'id',
        courses: 'id, name, progress',
        missions: 'id, dueDate, priority, completed, courseId, unitId',
        timeblocks: 'id, date, completed, missionId',
        settings: 'key',
      })
      .upgrade(async (tx) => {
        const courses = await tx.table('courses').toArray();
        for (const c of courses) {
          await tx.table('courses').put(normalizeCourse(c as Course));
        }
      });
    this.version(3)
      .stores({
        player: 'id',
        courses: 'id, name, progress',
        missions: 'id, dueDate, priority, completed, courseId, unitId',
        timeblocks: 'id, date, completed, missionId',
        settings: 'key',
      })
      .upgrade(async (tx) => {
        await tx.table('player').clear();
        await tx.table('player').put(createDefaultPlayer());
        await tx.table('settings').put({
          key: 'odysseyResetVersion',
          value: ODYSSEY_RESET_VERSION,
        });
      });
    this.version(4)
      .stores({
        player: 'id',
        courses: 'id, name, progress',
        missions: 'id, dueDate, priority, completed, courseId, unitId',
        timeblocks: 'id, date, completed, missionId',
        settings: 'key',
      })
      .upgrade(async (tx) => {
        await tx.table('player').clear();
        await tx.table('courses').clear();
        await tx.table('missions').clear();
        await tx.table('timeblocks').clear();
        const settings = await tx.table('settings').toArray();
        for (const row of settings) {
          if (row.key.startsWith('daySnapshot:')) {
            await tx.table('settings').delete(row.key);
          }
        }
        await tx.table('player').put(createDefaultPlayer());
        await tx.table('settings').put({
          key: 'odysseyResetVersion',
          value: ODYSSEY_RESET_VERSION,
        });
      });
    this.version(5).stores({
      player: 'id',
      courses: 'id, name, progress',
      missions: 'id, dueDate, priority, completed, courseId, unitId',
      timeblocks: 'id, date, completed, missionId',
      settings: 'key',
      dailyMissions: 'date',
    });
    this.version(6).stores({
      player: 'id',
      courses: 'id, name, progress',
      missions: 'id, dueDate, priority, completed, courseId, unitId',
      timeblocks: 'id, date, completed, missionId',
      settings: 'key',
      dailyMissions: 'date',
      weeklyMissions: 'weekKey',
    });
  }
}
export const db = new AcademicOsDB();

function clearNotifLocalStorage(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('aos-notif')) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/** Borra todo y deja Gerardex en estado inicial vacío (sin cursos ni misiones). */
export async function factoryResetOdyssey(): Promise<void> {
  await db.transaction('rw', [db.player, db.courses, db.missions, db.timeblocks, db.settings], async () => {
    await db.player.clear();
    await db.courses.clear();
    await db.missions.clear();
    await db.timeblocks.clear();

    const settings = await db.settings.toArray();
    for (const row of settings) {
      await db.settings.delete(row.key);
    }

    await db.player.put(createDefaultPlayer());
    await db.settings.put({ key: 'odysseyResetVersion', value: ODYSSEY_RESET_VERSION });
  });
  clearNotifLocalStorage();
}

export async function ensureOdysseyResetVersion(): Promise<boolean> {
  const row = await db.settings.get('odysseyResetVersion');
  const current = row?.value as number | undefined;
  if (current === ODYSSEY_RESET_VERSION) return false;

  await factoryResetOdyssey();
  return true;
}

export async function exportAllData(): Promise<string> {
  const [player, courses, missions, timeblocks, settings, dailyMissions, weeklyMissions] = await Promise.all([
    db.player.toArray(),
    db.courses.toArray(),
    db.missions.toArray(),
    db.timeblocks.toArray(),
    db.settings.toArray(),
    db.dailyMissions.toArray(),
    db.weeklyMissions.toArray(),
  ]);
  return JSON.stringify({ player, courses, missions, timeblocks, settings, dailyMissions, weeklyMissions }, null, 2);
}

export async function importAllData(json: string): Promise<void> {
  const data = JSON.parse(json) as {
    player?: Player[];
    courses?: Course[];
    missions?: Mission[];
    timeblocks?: TimeBlock[];
    settings?: AppSettings[];
    dailyMissions?: DailyMissionDayRecord[];
    weeklyMissions?: WeeklyMissionWeekRecord[];
  };

  await db.transaction('rw', [db.player, db.courses, db.missions, db.timeblocks, db.settings, db.dailyMissions, db.weeklyMissions], async () => {
    if (data.player) {
      await db.player.clear();
      await db.player.bulkPut(data.player);
    }
    if (data.courses) {
      await db.courses.clear();
      await db.courses.bulkPut(data.courses);
    }
    if (data.missions) {
      await db.missions.clear();
      await db.missions.bulkPut(data.missions);
    }
    if (data.timeblocks) {
      await db.timeblocks.clear();
      await db.timeblocks.bulkPut(data.timeblocks);
    }
    if (data.settings) {
      await db.settings.clear();
      await db.settings.bulkPut(data.settings);
    }
    if (data.dailyMissions) {
      await db.dailyMissions.clear();
      await db.dailyMissions.bulkPut(data.dailyMissions);
    }
    if (data.weeklyMissions) {
      await db.weeklyMissions.clear();
      await db.weeklyMissions.bulkPut(data.weeklyMissions);
    }
  });
}

export function downloadBackup(data: string, filename?: string): void {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `gerardex-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
