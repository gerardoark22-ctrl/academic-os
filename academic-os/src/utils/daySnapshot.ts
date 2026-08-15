import { db } from './db';
import { todayISO } from './gamification';
import { normalizeCourse } from './courseNormalize';
import type { Course, Mission, Player, TimeBlock, Topic } from '../types';
import { DomainLevel } from '../types';

export interface TopicProgressSnap {
  completed?: boolean;
  studyTime: number;
  domainLevel: DomainLevel;
  subtopics: Record<string, { completed: boolean }>;
}

export interface DayProgressSnapshot {
  date: string;
  savedAt: string;
  player: Player;
  courses: Record<
    string,
    {
      progress: number;
      units: Record<
        string,
        {
          progress: number;
          topics: Record<string, TopicProgressSnap>;
        }
      >;
    }
  >;
  missions: Record<string, boolean>;
  blocks: Record<string, boolean>;
}

/** @deprecated Formato antiguo — solo para migración al restaurar */
export interface LegacyDaySnapshot {
  date: string;
  savedAt: string;
  player: Player;
  courses: Course[];
  missions: Mission[];
  timeblocks: TimeBlock[];
}

function snapshotKey(date: string) {
  return `daySnapshot:${date}`;
}

function snapTopic(topic: Topic): TopicProgressSnap {
  const subtopics: Record<string, { completed: boolean }> = {};
  for (const st of topic.subtopics ?? []) {
    subtopics[st.id] = { completed: st.completed };
  }
  return {
    completed: topic.completed,
    studyTime: topic.studyTime,
    domainLevel: topic.domainLevel,
    subtopics,
  };
}

function extractCourseProgress(courses: Course[]): DayProgressSnapshot['courses'] {
  const out: DayProgressSnapshot['courses'] = {};
  for (const course of courses) {
    const units: DayProgressSnapshot['courses'][string]['units'] = {};
    for (const unit of course.units) {
      const topics: Record<string, TopicProgressSnap> = {};
      for (const topic of unit.topics) {
        topics[topic.id] = snapTopic(topic);
      }
      units[unit.id] = { progress: unit.progress, topics };
    }
    out[course.id] = { progress: course.progress, units };
  }
  return out;
}

function defaultTopicProgress(): TopicProgressSnap {
  return {
    completed: false,
    studyTime: 0,
    domainLevel: DomainLevel.MORTAL,
    subtopics: {},
  };
}

function applyTopicProgress(current: Topic, baseline?: TopicProgressSnap): Topic {
  const base = baseline ?? defaultTopicProgress();
  return {
    ...current,
    completed: base.completed,
    studyTime: base.studyTime,
    domainLevel: base.domainLevel,
    subtopics: current.subtopics.map((st) => {
      const bst = base.subtopics[st.id];
      return bst ? { ...st, completed: bst.completed, studyTime: 0 } : { ...st, completed: false, studyTime: 0 };
    }),
  };
}

function mergeCourseProgress(current: Course, baseline?: DayProgressSnapshot['courses'][string]): Course {
  if (!baseline) {
    return normalizeCourse({
      ...current,
      progress: 0,
      units: current.units.map((u) => ({
        ...u,
        progress: 0,
        topics: u.topics.map((t) => applyTopicProgress(t)),
      })),
    });
  }

  return normalizeCourse({
    ...current,
    progress: baseline.progress,
    units: current.units.map((u) => {
      const bu = baseline.units[u.id];
      if (!bu) {
        return {
          ...u,
          progress: 0,
          topics: u.topics.map((t) => applyTopicProgress(t)),
        };
      }
      return {
        ...u,
        progress: bu.progress,
        topics: u.topics.map((t) => applyTopicProgress(t, bu.topics[t.id])),
      };
    }),
  });
}

function legacyToProgress(snap: LegacyDaySnapshot): DayProgressSnapshot {
  return {
    date: snap.date,
    savedAt: snap.savedAt,
    player: snap.player,
    courses: extractCourseProgress(snap.courses.map(normalizeCourse)),
    missions: Object.fromEntries(snap.missions.map((m) => [m.id, m.completed])),
    blocks: Object.fromEntries(snap.timeblocks.map((b) => [b.id, b.completed])),
  };
}

function normalizeStoredSnapshot(raw: unknown): DayProgressSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const snap = raw as LegacyDaySnapshot & DayProgressSnapshot;
  if (!snap.player) return null;
  if (Array.isArray(snap.courses)) {
    return legacyToProgress(snap as LegacyDaySnapshot);
  }
  if (snap.courses && typeof snap.courses === 'object') {
    return snap as DayProgressSnapshot;
  }
  return null;
}

export async function captureDaySnapshot(date: string = todayISO()): Promise<DayProgressSnapshot> {
  const [player, courses, missions, timeblocks] = await Promise.all([
    db.player.get('gerardex'),
    db.courses.toArray(),
    db.missions.toArray(),
    db.timeblocks.where('date').equals(date).toArray(),
  ]);

  if (!player) throw new Error('Jugador no encontrado');

  return {
    date,
    savedAt: new Date().toISOString(),
    player: structuredClone(player),
    courses: extractCourseProgress(courses.map(normalizeCourse)),
    missions: Object.fromEntries(missions.map((m) => [m.id, m.completed])),
    blocks: Object.fromEntries(timeblocks.map((b) => [b.id, b.completed])),
  };
}

/** Guarda progreso al inicio del día (solo una vez por fecha). */
export async function ensureDaySnapshot(date: string = todayISO()): Promise<void> {
  const key = snapshotKey(date);
  const existing = await db.settings.get(key);
  if (existing?.value) return;

  const snap = await captureDaySnapshot(date);
  await db.settings.put({ key, value: snap });
}

export async function hasDaySnapshot(date: string = todayISO()): Promise<boolean> {
  const row = await db.settings.get(snapshotKey(date));
  return !!normalizeStoredSnapshot(row?.value);
}

/**
 * Restaura solo progreso (XP, checks, bloques completados).
 * Conserva cursos, temas, tareas y asignaciones de bloques creados después del amanecer.
 */
export async function restoreDayProgressOnly(date: string = todayISO()): Promise<boolean> {
  const row = await db.settings.get(snapshotKey(date));
  const snap = normalizeStoredSnapshot(row?.value);
  if (!snap?.player) return false;

  const [currentCourses, currentMissions, currentBlocks] = await Promise.all([
    db.courses.toArray(),
    db.missions.toArray(),
    db.timeblocks.where('date').equals(date).toArray(),
  ]);

  const mergedCourses = currentCourses.map((c) =>
    mergeCourseProgress(normalizeCourse(c), snap.courses[c.id]),
  );

  const mergedMissions = currentMissions.map((m) => ({
    ...m,
    completed: snap.missions[m.id] ?? false,
  }));

  const mergedBlocks = currentBlocks.map((b) => ({
    ...b,
    completed: snap.blocks[b.id] ?? false,
  }));

  await db.transaction('rw', [db.player, db.courses, db.missions, db.timeblocks], async () => {
    await db.player.put(snap.player);
    await db.courses.clear();
    if (mergedCourses.length) await db.courses.bulkPut(mergedCourses);
    await db.missions.clear();
    if (mergedMissions.length) await db.missions.bulkPut(mergedMissions);
    for (const block of mergedBlocks) {
      await db.timeblocks.put(block);
    }
  });

  return true;
}

/** @deprecated Usar restoreDayProgressOnly */
export async function restoreDaySnapshot(date: string = todayISO()): Promise<boolean> {
  return restoreDayProgressOnly(date);
}
