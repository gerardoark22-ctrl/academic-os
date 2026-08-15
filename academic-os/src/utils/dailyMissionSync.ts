import type { Course, DailyMission, Mission, Player, TimeBlock, Topic } from '../types';
import { PLAYER_CONFIG } from './playerConfig';
import {
  countCompletedStudyBlocks,
  isDailyGoalMet,
  resolveTodayStudyMinutes,
} from './studyProgress';
import { todayLocalISO } from './localTime';

export interface DailyMissionProgressContext {
  player: Player | null;
  missions: Mission[];
  courses: Course[];
  todayBlocks: TimeBlock[];
  /** XP al generar el día */
  xpBaseline?: number;
}

function findTopic(
  courses: Course[],
  courseId?: string,
  unitId?: string,
  topicId?: string,
): Topic | undefined {
  if (!courseId || !unitId || !topicId) return undefined;
  const course = courses.find((c) => c.id === courseId);
  const unit = course?.units.find((u) => u.id === unitId);
  return unit?.topics.find((t) => t.id === topicId);
}

/** Solo cuenta si la acción ocurrió hoy (no arrastra progreso de días anteriores). */
export function actionCompletedToday(
  completedOn: string | undefined,
  fallbackCompleted: boolean,
  today: string,
  lastStudied?: string | null,
): boolean {
  if (completedOn) return completedOn === today;
  if (fallbackCompleted && lastStudied === today) return true;
  return false;
}

export function maxConsecutiveCompletedBlocks(blocks: TimeBlock[]): number {
  const sorted = [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
  let max = 0;
  let cur = 0;
  for (const b of sorted) {
    if (b.completed && b.type !== 'rest') {
      cur++;
      max = Math.max(max, cur);
    } else {
      cur = 0;
    }
  }
  return max;
}

function topicCompletedToday(
  courses: Course[],
  courseId?: string,
  unitId?: string,
  topicId?: string,
  today?: string,
): boolean {
  const topic = findTopic(courses, courseId, unitId, topicId);
  if (!topic?.completed) return false;
  const day = today ?? todayLocalISO();
  return actionCompletedToday(topic.completedOn, true, day, topic.lastStudied);
}

function missionCompletedToday(missions: Mission[], missionId?: string, today?: string): boolean {
  if (!missionId) return false;
  const mission = missions.find((m) => m.id === missionId);
  if (!mission?.completed) return false;
  const day = today ?? todayLocalISO();
  return actionCompletedToday(mission.completedOn, false, day);
}

export function computeMissionProgress(m: DailyMission, ctx: DailyMissionProgressContext): number {
  const { player, missions, courses, todayBlocks } = ctx;
  const today = todayLocalISO();
  const studyBlocks = todayBlocks.filter((b) => b.completed && b.type !== 'rest');
  const assignedBlocks = todayBlocks.filter((b) => b.title && b.type !== 'rest');
  const todayMinutes = resolveTodayStudyMinutes(player, todayBlocks);

  switch (m.kind) {
    case 'blocks_completed':
      return countCompletedStudyBlocks(todayBlocks, today);
    case 'study_minutes':
      return todayMinutes;
    case 'daily_goal':
      return isDailyGoalMet(player, todayBlocks) ? 1 : 0;
    case 'complete_mission':
      return missionCompletedToday(missions, m.refMissionId, today) ? 1 : 0;
    case 'complete_topic':
      return topicCompletedToday(courses, m.refCourseId, m.refUnitId, m.refTopicId, today) ? 1 : 0;
    case 'assign_blocks':
      return assignedBlocks.length;
    case 'consecutive_blocks':
      return maxConsecutiveCompletedBlocks(todayBlocks);
    case 'course_study':
      return studyBlocks.filter((b) => b.courseId === m.refCourseId).length;
    case 'earn_xp': {
      if (player?.lastActiveDate !== today) return 0;
      const baseline = ctx.xpBaseline ?? player?.xp ?? 0;
      return Math.max(0, (player?.xp ?? 0) - baseline);
    }
    default:
      return m.progress;
  }
}

export function applyProgressToMission(m: DailyMission, rawProgress: number): DailyMission {
  const capped = m.autoCompleteBlocked ? Math.min(m.target - 1, Math.max(0, rawProgress)) : rawProgress;
  const progress = Math.min(m.target, Math.max(0, capped));
  const wasComplete = m.completed;
  const completed = !m.autoCompleteBlocked && progress >= m.target;
  return {
    ...m,
    progress,
    completed,
    completedAt: completed && !wasComplete ? new Date().toISOString() : completed ? m.completedAt : undefined,
  };
}

export function dailyMissionPenalty(m: DailyMission): number {
  return PLAYER_CONFIG.dailyMissionPenalty[m.complexity];
}

export function allMissionsComplete(missions: DailyMission[]): boolean {
  return missions.length > 0 && missions.every((m) => m.completed);
}

export function syncDailyGoalMissionMeta(m: DailyMission, goalMinutes: number): DailyMission {
  if (m.kind !== 'daily_goal') return m;
  return {
    ...m,
    target: 1,
    description: `Alcanza tu meta diaria (${goalMinutes} min)`,
  };
}
