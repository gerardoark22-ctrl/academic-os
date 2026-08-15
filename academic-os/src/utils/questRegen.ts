import type { DailyMission, WeeklyMission } from '../types';

/** Incrementar cuando cambie el estilo de copy — fuerza regeneración creativa */
export const QUEST_GENERATOR_VERSION = 8;

function legacyDailyCopy(m: DailyMission): boolean {
  if (m.kind === 'complete_mission') {
    return /^⚠?\s*Vence hoy:|^Vencer:|^Semana:/i.test(m.title);
  }
  if (m.kind === 'complete_topic') {
    return /^Domina:/i.test(m.title);
  }
  if (m.kind === 'course_study') {
    return /^Honor a /i.test(m.title);
  }
  return false;
}

function legacyWeeklyCopy(m: WeeklyMission): boolean {
  if (m.kind === 'complete_mission') {
    return /^Semana:/i.test(m.title);
  }
  if (m.kind === 'week_course_blocks') {
    return / — semana$/i.test(m.title);
  }
  return false;
}

export function dailyRecordNeedsCreativeRegen(
  missions: DailyMission[],
  generatorVersion?: number,
): boolean {
  if ((generatorVersion ?? 0) < QUEST_GENERATOR_VERSION) return true;
  return missions.some(legacyDailyCopy);
}

export function weeklyRecordNeedsCreativeRegen(
  missions: WeeklyMission[],
  generatorVersion?: number,
): boolean {
  if ((generatorVersion ?? 0) < QUEST_GENERATOR_VERSION) return true;
  return missions.some(legacyWeeklyCopy);
}

function matchDailyKey(a: DailyMission, b: DailyMission): boolean {
  if (a.kind === 'daily_goal' && b.kind === 'daily_goal') return true;
  if (a.kind !== b.kind) return false;
  if (a.refMissionId || b.refMissionId) return a.refMissionId === b.refMissionId;
  if (a.refTopicId || b.refTopicId) {
    return a.refTopicId === b.refTopicId && a.refCourseId === b.refCourseId;
  }
  if (a.refCourseId && b.refCourseId && a.kind === 'course_study') {
    return a.refCourseId === b.refCourseId;
  }
  return a.target === b.target;
}

function matchWeeklyKey(a: WeeklyMission, b: WeeklyMission): boolean {
  if (a.kind !== b.kind) return false;
  if (a.refMissionId || b.refMissionId) return a.refMissionId === b.refMissionId;
  if (a.refCourseId || b.refCourseId) return a.refCourseId === b.refCourseId;
  return a.target === b.target;
}

/** Regenera copy creativo — solo conserva estado manual; el progreso auto se recalcula */
export function mergeDailyMissionProgress(
  previous: DailyMission[],
  fresh: DailyMission[],
): DailyMission[] {
  const used = new Set<string>();
  return fresh.map((nm) => {
    const om = previous.find((o) => !used.has(o.id) && matchDailyKey(o, nm));
    if (!om) return nm;
    used.add(om.id);
    if (nm.kind === 'daily_goal') {
      return nm;
    }
    if (om.manualComplete && om.completed) {
      return {
        ...nm,
        progress: om.progress,
        completed: om.completed,
        completedAt: om.completedAt,
        xpGranted: om.xpGranted,
        manualComplete: true,
        autoCompleteBlocked: false,
      };
    }
    return {
      ...nm,
      autoCompleteBlocked: om.autoCompleteBlocked,
    };
  });
}

export function mergeWeeklyMissionProgress(
  previous: WeeklyMission[],
  fresh: WeeklyMission[],
): WeeklyMission[] {
  const used = new Set<string>();
  return fresh.map((nm) => {
    const om = previous.find((o) => !used.has(o.id) && matchWeeklyKey(o, nm));
    if (!om) return nm;
    used.add(om.id);
    return {
      ...nm,
      progress: om.progress,
      completed: om.completed,
      completedAt: om.completedAt,
      xpGranted: om.xpGranted,
      manualComplete: om.manualComplete,
      autoCompleteBlocked: om.autoCompleteBlocked,
    };
  });
}
