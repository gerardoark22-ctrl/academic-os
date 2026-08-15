import { db } from './db';
import type { Mission, Player, TimeBlock } from '../types';
import { blockInPeriod } from './courseColors';
import { getBlockSchedule } from './blockSchedule';
import { addDaysLocalISO, todayLocalISO } from './localTime';
import { getDailyGoalMinutes } from './dailyGoal';
import { blockStudyMinutes, countCompletedStudyBlocks } from './studyProgress';

export interface DayStat {
  date: string;
  minutes: number;
  blocks: number;
  missionsDone: number;
  goalMet: boolean;
}

export interface RankingSnapshot {
  player: Player | null;
  totalStudyMinutes: number;
  totalBlocksCompleted: number;
  weeklyStudy: DayStat[];
  courseProgress: { name: string; progress: number; color?: string; blocksThisWeek: number }[];
  missionsActive: number;
  missionsCompleted: number;
  missionsCompletedThisWeek: number;
  completionRate: number;
  avgDailyMinutes: number;
  trend: 'up' | 'down' | 'stable';
  streak: number;
  periodDistribution: { morning: number; afternoon: number; evening: number };
  todayVsYesterday: { today: number; yesterday: number; delta: number; pct: number };
  studyByType: { study: number; exam: number; task: number };
  goalDaysThisWeek: number;
  goalMinutes: number;
  weeklyGoalTarget: number;
  weeklyGoalPct: number;
  perfectDaysCount: number;
  efficiencyScore: number;
  peakDayMinutes: number;
  peakDayLabel: string;
  todayBlocksDone: number;
  todayBlocksScheduled: number;
}

function dateOffset(days: number): string {
  return addDaysLocalISO(todayLocalISO(), days);
}

function studyBlocks(blocks: TimeBlock[]): TimeBlock[] {
  return blocks.filter((b) => b.completed && b.type !== 'rest');
}

function minutesFromBlocks(blocks: TimeBlock[]): number {
  return studyBlocks(blocks).reduce((sum, b) => sum + blockStudyMinutes(b), 0);
}

export async function buildRankingSnapshot(): Promise<RankingSnapshot> {
  const [playerArr, courses, missions, allBlocks] = await Promise.all([
    db.player.toArray(),
    db.courses.toArray(),
    db.missions.toArray(),
    db.timeblocks.toArray(),
  ]);

  const player = playerArr[0] ?? null;
  const today = todayLocalISO();
  const yesterday = dateOffset(-1);
  const goalMinutes = getDailyGoalMinutes(player);
  const weeklyGoalTarget = goalMinutes * 7;

  const weeklyDates = Array.from({ length: 7 }, (_, i) => dateOffset(-6 + i));

  const weeklyStudy: DayStat[] = weeklyDates.map((date) => {
    const dayBlocks = allBlocks.filter((b) => b.date === date);
    const minutes = minutesFromBlocks(dayBlocks);
    return {
      date,
      minutes,
      blocks: countCompletedStudyBlocks(dayBlocks, date),
      missionsDone: 0,
      goalMet: minutes >= goalMinutes,
    };
  });

  const totalStudyMinutes = minutesFromBlocks(allBlocks);
  const totalBlocksCompleted = studyBlocks(allBlocks).length;
  const thisWeekMinutes = weeklyStudy.reduce((s, d) => s + d.minutes, 0);

  const lastWeekDates = Array.from({ length: 7 }, (_, i) => dateOffset(-13 + i));
  const lastWeekMinutes = lastWeekDates.reduce((sum, date) => {
    const dayBlocks = allBlocks.filter((b) => b.date === date);
    return sum + minutesFromBlocks(dayBlocks);
  }, 0);

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (thisWeekMinutes > lastWeekMinutes * 1.08) trend = 'up';
  else if (thisWeekMinutes < lastWeekMinutes * 0.92) trend = 'down';

  const active = missions.filter((m) => !m.completed);
  const completed = missions.filter((m) => m.completed);
  const completionRate =
    missions.length > 0 ? Math.round((completed.length / missions.length) * 100) : 0;

  const avgDailyMinutes = Math.round(thisWeekMinutes / 7);

  const periodDistribution = { morning: 0, afternoon: 0, evening: 0 };
  const schedule = getBlockSchedule(player);
  for (const b of studyBlocks(allBlocks)) {
    if (!weeklyDates.includes(b.date)) continue;
    const mins = blockStudyMinutes(b);
    if (blockInPeriod(b.startTime, 'morning', schedule)) periodDistribution.morning += mins;
    else if (blockInPeriod(b.startTime, 'afternoon', schedule)) periodDistribution.afternoon += mins;
    else if (blockInPeriod(b.startTime, 'evening', schedule)) periodDistribution.evening += mins;
  }

  const todayBlocks = allBlocks.filter((b) => b.date === today);
  const yesterdayBlocks = allBlocks.filter((b) => b.date === yesterday);
  const todayMin = minutesFromBlocks(todayBlocks);
  const yesterdayMin = minutesFromBlocks(yesterdayBlocks);
  const delta = todayMin - yesterdayMin;
  const pct = yesterdayMin > 0 ? Math.round((delta / yesterdayMin) * 100) : todayMin > 0 ? 100 : 0;

  const studyByType = { study: 0, exam: 0, task: 0 };
  for (const b of studyBlocks(allBlocks)) {
    if (b.type in studyByType) studyByType[b.type as keyof typeof studyByType] += blockStudyMinutes(b);
  }

  const goalDaysThisWeek = weeklyStudy.filter((d) => d.goalMet).length;
  const peakDay = weeklyStudy.reduce(
    (best, d) => (d.minutes > best.minutes ? d : best),
    weeklyStudy[0] ?? { date: today, minutes: 0, blocks: 0, missionsDone: 0, goalMet: false },
  );
  const peakDayLabel = new Date(`${peakDay.date}T12:00:00`).toLocaleDateString('es-PE', {
    weekday: 'short',
    day: 'numeric',
  });

  const courseProgress = courses.map((c) => ({
    name: c.name,
    progress: c.progress,
    color: c.color,
    blocksThisWeek: studyBlocks(allBlocks).filter(
      (b) => b.courseId === c.id && weeklyDates.includes(b.date),
    ).length,
  }));

  const scheduledToday = todayBlocks.filter((b) => b.title && b.type !== 'rest');
  const doneToday = scheduledToday.filter((b) => b.completed).length;
  const weeklyGoalPct = weeklyGoalTarget > 0
    ? Math.min(100, Math.round((thisWeekMinutes / weeklyGoalTarget) * 100))
    : 0;

  const maxPeriod = Math.max(
    periodDistribution.morning,
    periodDistribution.afternoon,
    periodDistribution.evening,
    1,
  );
  const periodBalance = 1 - (
    Math.abs(periodDistribution.morning - maxPeriod)
    + Math.abs(periodDistribution.afternoon - maxPeriod)
    + Math.abs(periodDistribution.evening - maxPeriod)
  ) / (maxPeriod * 3);
  const efficiencyScore = Math.min(
    100,
    Math.round(
      (weeklyGoalPct * 0.45)
      + (goalDaysThisWeek / 7 * 100 * 0.25)
      + (completionRate * 0.15)
      + (periodBalance * 100 * 0.15),
    ),
  );

  return {
    player,
    totalStudyMinutes,
    totalBlocksCompleted,
    weeklyStudy,
    courseProgress,
    missionsActive: active.length,
    missionsCompleted: completed.length,
    missionsCompletedThisWeek: 0,
    completionRate,
    avgDailyMinutes,
    trend,
    streak: player?.studyStreak ?? 0,
    periodDistribution,
    todayVsYesterday: { today: todayMin, yesterday: yesterdayMin, delta, pct },
    studyByType,
    goalDaysThisWeek,
    goalMinutes,
    weeklyGoalTarget,
    weeklyGoalPct,
    perfectDaysCount: player?.perfectDaysCount ?? 0,
    efficiencyScore,
    peakDayMinutes: peakDay.minutes,
    peakDayLabel,
    todayBlocksDone: doneToday,
    todayBlocksScheduled: scheduledToday.length,
  };
}

export function missionSortScore(m: Mission): number {
  const days = Math.max(0, Math.ceil(
    (new Date(m.dueDate).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000,
  ));
  const urgency = days <= 0 ? 100 : days <= 3 ? 80 - days * 10 : Math.max(0, 50 - days);
  const importance = { odisea: 30, epica: 20, chiste: 10 }[m.priority];
  return urgency + importance;
}

export function groupMissionsByDate(missions: Mission[]): Record<string, Mission[]> {
  const groups: Record<string, Mission[]> = {};
  for (const m of missions.filter((x) => !x.completed)) {
    if (!groups[m.dueDate]) groups[m.dueDate] = [];
    groups[m.dueDate].push(m);
  }
  for (const k of Object.keys(groups)) {
    groups[k].sort((a, b) => missionSortScore(b) - missionSortScore(a));
  }
  return groups;
}

export function getBlocksForDate(date: string): Promise<TimeBlock[]> {
  return db.timeblocks.where('date').equals(date).toArray();
}
