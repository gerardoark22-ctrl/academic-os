import type { Course, Mission, Player, TimeBlock, WeeklyMission } from '../types';
import { blockStudyMinutes } from './studyProgress';
import { getDailyGoalMinutes } from './dailyGoal';
import { PLAYER_CONFIG } from './playerConfig';
import { getWeekDateRange } from './weekRange';

export interface WeeklyMissionProgressContext {
  player: Player | null;
  missions: Mission[];
  courses: Course[];
  weekBlocks: TimeBlock[];
  weekKey: string;
  missionsCompletedBaseline: number;
  topicsBaseline: number;
  xpBaseline?: number;
}

function studyBlocksInWeek(blocks: TimeBlock[]): TimeBlock[] {
  return blocks.filter((b) => b.completed && b.type !== 'rest');
}

function minutesInWeek(blocks: TimeBlock[]): number {
  return studyBlocksInWeek(blocks).reduce((sum, b) => sum + blockStudyMinutes(b), 0);
}

function goalDaysInWeek(blocks: TimeBlock[], goalMinutes: number, weekKey: string): number {
  const dates = getWeekDateRange(weekKey);
  let count = 0;
  for (const d of dates) {
    const dayBlocks = studyBlocksInWeek(blocks.filter((b) => b.date === d));
    const minutes = dayBlocks.reduce((sum, b) => sum + blockStudyMinutes(b), 0);
    if (minutes >= goalMinutes) count++;
  }
  return count;
}

function missionDone(missions: Mission[], missionId?: string): boolean {
  if (!missionId) return false;
  return missions.find((m) => m.id === missionId)?.completed ?? false;
}

function topicsCompletedInCourses(courses: Course[]): number {
  let n = 0;
  for (const c of courses) {
    for (const u of c.units) {
      for (const t of u.topics) {
        if (t.completed || (t.domainLevel ?? 0) >= 50) n++;
      }
    }
  }
  return n;
}

export function computeWeeklyMissionProgress(m: WeeklyMission, ctx: WeeklyMissionProgressContext): number {
  const studyBlocks = studyBlocksInWeek(ctx.weekBlocks);
  const goalMinutes = getDailyGoalMinutes(ctx.player);

  switch (m.kind) {
    case 'week_blocks':
      return studyBlocks.length;
    case 'week_minutes':
      return minutesInWeek(ctx.weekBlocks);
    case 'week_missions_done':
      return Math.max(0, ctx.missions.filter((m) => m.completed).length - ctx.missionsCompletedBaseline);
    case 'week_topics':
      return Math.max(0, topicsCompletedInCourses(ctx.courses) - ctx.topicsBaseline);
    case 'week_goal_days':
      return goalDaysInWeek(ctx.weekBlocks, goalMinutes, ctx.weekKey);
    case 'week_course_blocks':
      return studyBlocks.filter((b) => b.courseId === m.refCourseId).length;
    case 'complete_mission':
      return missionDone(ctx.missions, m.refMissionId) ? 1 : 0;
    case 'week_xp': {
      const baseline = ctx.xpBaseline ?? ctx.player?.xp ?? 0;
      return Math.max(0, (ctx.player?.xp ?? 0) - baseline);
    }
    case 'week_assign_blocks':
      return ctx.weekBlocks.filter((b) => b.title && b.type !== 'rest').length;
    default:
      return m.progress;
  }
}

export function applyWeeklyProgress(m: WeeklyMission, rawProgress: number): WeeklyMission {
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

export function weeklyMissionPenalty(m: WeeklyMission): number {
  return PLAYER_CONFIG.weeklyMissionPenalty[m.complexity];
}

export function allWeeklyComplete(missions: WeeklyMission[]): boolean {
  return missions.length > 0 && missions.every((m) => m.completed);
}

/** Baseline de temas al inicio de semana — guardado en record si hace falta */
export function countCompletedTopics(courses: Course[]): number {
  return topicsCompletedInCourses(courses);
}
