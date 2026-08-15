import type { Course, DailyMission, DailyMissionKind, Mission, Player, TimeBlock } from '../types';
import { todayISO } from './gamification';
import { PLAYER_CONFIG } from './playerConfig';
import { getDailyGoalMinutes } from './dailyGoal';
import {
  collectOpenTopics,
  creativeBoardMissionQuest,
  creativeCourseStudyQuest,
  creativeDailyGoalQuest,
  creativeTopicQuest,
  GENERIC_DAILY_COPY,
  pickGeneric,
} from './creativeQuestCopy';
import {
  isCourseStudyMissionFeasible,
  isMissionBoardQuestFeasible,
} from './missionFeasibility';
import { maxConsecutiveCompletedBlocks } from './dailyMissionSync';

export interface DailyMissionGeneratorContext {
  player: Player;
  missions: Mission[];
  courses: Course[];
  todayBlocks: TimeBlock[];
  dateKey: string;
}

type Candidate = Omit<DailyMission, 'id' | 'progress' | 'completed' | 'xpGranted'>;

const XP_REWARD = PLAYER_CONFIG.dailyMissionXp;

function shuffle<T>(arr: T[], seed: string): T[] {
  const out = [...arr];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickOne<T>(arr: T[], seed: string): T | undefined {
  if (arr.length === 0) return undefined;
  return shuffle(arr, seed)[0];
}

function minBlocksTarget(): number {
  return Math.max(2, Math.ceil(PLAYER_CONFIG.minStudyBlocks / 3));
}

function countAssignedBlocks(blocks: TimeBlock[]): number {
  return blocks.filter((b) => b.title && b.type !== 'rest').length;
}

function countCompletedBlocks(blocks: TimeBlock[]): number {
  return blocks.filter((b) => b.completed && b.type !== 'rest').length;
}

function missionShell(
  partial: Omit<Candidate, 'date' | 'complexity' | 'required'>,
  ctx: DailyMissionGeneratorContext,
  complexity: Candidate['complexity'] = 'medium',
  required = false,
): Candidate {
  return {
    ...partial,
    date: ctx.dateKey,
    complexity,
    required,
  };
}

function buildDailyGoal(ctx: DailyMissionGeneratorContext): Candidate {
  const goalMinutes = getDailyGoalMinutes(ctx.player);
  const copy = creativeDailyGoalQuest(goalMinutes);
  return missionShell(
    {
      kind: 'daily_goal',
      title: copy.title,
      description: copy.description,
      target: 1,
      xpReward: XP_REWARD.heavy,
      icon: copy.icon,
    },
    ctx,
    'heavy',
    true,
  );
}

function buildTopicCandidates(ctx: DailyMissionGeneratorContext): Candidate[] {
  const open = collectOpenTopics(ctx.courses);
  return shuffle(open, `${ctx.dateKey}-topic`).slice(0, 3).map(({ course, unitId, topic }) => {
    const copy = creativeTopicQuest(course, topic);
    return missionShell(
      {
        kind: 'complete_topic',
        title: copy.title,
        description: copy.description,
        target: 1,
        xpReward: XP_REWARD.medium + 5,
        refCourseId: course.id,
        refUnitId: unitId,
        refTopicId: topic.id,
        icon: copy.icon,
      },
      ctx,
      'medium',
    );
  });
}

function buildAssignCandidate(ctx: DailyMissionGeneratorContext): Candidate | null {
  const target = Math.min(4, minBlocksTarget());
  if (countAssignedBlocks(ctx.todayBlocks) >= target) return null;
  const copy = pickGeneric(GENERIC_DAILY_COPY.assign, `${ctx.dateKey}-assign`);
  return missionShell(
    {
      kind: 'assign_blocks',
      title: copy.title,
      description: `Arma tu timeblocking con al menos ${target} bloques hoy.`,
      target,
      xpReward: XP_REWARD.medium,
      icon: copy.icon,
    },
    ctx,
    'light',
  );
}

function buildBlocksCandidate(ctx: DailyMissionGeneratorContext): Candidate | null {
  const target = Math.min(4, minBlocksTarget());
  if (countCompletedBlocks(ctx.todayBlocks) >= target) return null;
  const copy = pickGeneric(GENERIC_DAILY_COPY.blocks, `${ctx.dateKey}-blocks`);
  return missionShell(
    {
      kind: 'blocks_completed',
      title: copy.title,
      description: `Completa ${target} bloque${target > 1 ? 's' : ''} de estudio hoy.`,
      target,
      xpReward: XP_REWARD.medium,
      icon: copy.icon,
    },
    ctx,
    'medium',
  );
}

function buildXpCandidate(ctx: DailyMissionGeneratorContext): Candidate {
  const level = ctx.player.level ?? 1;
  const perBlock = PLAYER_CONFIG.xpPerBlock;
  const options = [perBlock * 2, perBlock * 4, perBlock * 6, Math.round(perBlock * 3.5)];
  const target = options[Math.min(options.length - 1, Math.floor(level / 3))] ?? perBlock * 3;
  const copy = pickGeneric(GENERIC_DAILY_COPY.xp, `${ctx.dateKey}-xp`);
  return missionShell(
    {
      kind: 'earn_xp',
      title: copy.title,
      description: `Gana al menos ${target} XP hoy (bloques, temas, metas).`,
      target,
      xpReward: XP_REWARD.medium + 3,
      icon: copy.icon,
    },
    ctx,
    'medium',
  );
}

function buildMinutesCandidate(ctx: DailyMissionGeneratorContext): Candidate | null {
  const goal = getDailyGoalMinutes(ctx.player);
  if (goal < 30) return null;
  const target = Math.max(45, Math.round(goal * 0.5));
  const copy = pickGeneric(GENERIC_DAILY_COPY.minutes, `${ctx.dateKey}-min`);
  return missionShell(
    {
      kind: 'study_minutes',
      title: copy.title,
      description: `Acumula ${target} minutos de estudio hoy.`,
      target,
      xpReward: XP_REWARD.light,
      icon: copy.icon,
    },
    ctx,
    'light',
  );
}

function buildMissionCandidate(ctx: DailyMissionGeneratorContext): Candidate | null {
  const urgent = ctx.missions.filter(isMissionBoardQuestFeasible);
  if (urgent.length === 0) return null;
  const m = pickOne(urgent, `${ctx.dateKey}-mission`)!;
  const copy = creativeBoardMissionQuest(m, 'daily');
  return missionShell(
    {
      kind: 'complete_mission',
      title: copy.title,
      description: copy.description,
      target: 1,
      xpReward: XP_REWARD.heavy,
      refMissionId: m.id,
      icon: copy.icon,
    },
    ctx,
    m.priority === 'odisea' ? 'heavy' : 'medium',
  );
}

function buildConsecutiveCandidate(ctx: DailyMissionGeneratorContext): Candidate | null {
  const target = Math.min(3, minBlocksTarget());
  if (maxConsecutiveCompletedBlocks(ctx.todayBlocks) >= target) return null;
  const copy = pickGeneric(GENERIC_DAILY_COPY.consecutive, `${ctx.dateKey}-combo`);
  return missionShell(
    {
      kind: 'consecutive_blocks',
      title: copy.title,
      description: `Encadena ${target} bloques seguidos sin rendirte.`,
      target,
      xpReward: XP_REWARD.medium + 4,
      icon: copy.icon,
    },
    ctx,
    'medium',
  );
}

function buildCourseStudyCandidate(ctx: DailyMissionGeneratorContext): Candidate | null {
  const feasible = ctx.courses.filter((c) => isCourseStudyMissionFeasible(c, ctx.todayBlocks));
  if (feasible.length === 0) return null;
  const course = pickOne(feasible, `${ctx.dateKey}-course`)!;
  const copy = creativeCourseStudyQuest(course);
  return missionShell(
    {
      kind: 'course_study',
      title: copy.title,
      description: copy.description,
      target: 1,
      xpReward: XP_REWARD.medium,
      refCourseId: course.id,
      icon: copy.icon,
    },
    ctx,
    'light',
  );
}

function pickUnique(
  pool: Candidate[],
  usedKinds: Set<DailyMissionKind>,
  seed: string,
): Candidate | null {
  for (const c of shuffle(pool, seed)) {
    if (usedKinds.has(c.kind)) continue;
    return c;
  }
  return null;
}

/** Genera misiones diarias variadas: un tipo distinto por misión (salvo daily_goal obligatoria). */
export function generateDailyMissions(ctx: DailyMissionGeneratorContext): DailyMission[] {
  const max = PLAYER_CONFIG.dailyMissionCount;
  const usedKinds = new Set<DailyMissionKind>();
  const selected: Candidate[] = [];

  selected.push(buildDailyGoal(ctx));
  usedKinds.add('daily_goal');

  const slotBuilders: Array<() => Candidate | null> = shuffle(
    [
      () => pickOne(buildTopicCandidates(ctx), `${ctx.dateKey}-slot-topic`) ?? null,
      () => buildAssignCandidate(ctx),
      () => buildBlocksCandidate(ctx),
      () => buildXpCandidate(ctx),
      () => buildMinutesCandidate(ctx),
      () => buildMissionCandidate(ctx),
      () => buildConsecutiveCandidate(ctx),
      () => buildCourseStudyCandidate(ctx),
    ],
    `${ctx.dateKey}-slots`,
  );

  for (const build of slotBuilders) {
    if (selected.length >= max) break;
    const c = build();
    if (!c || usedKinds.has(c.kind)) continue;
    selected.push(c);
    usedKinds.add(c.kind);
  }

  const fallbackPool: Candidate[] = [];
  for (const c of [
    ...buildTopicCandidates(ctx),
    buildAssignCandidate(ctx),
    buildBlocksCandidate(ctx),
    buildXpCandidate(ctx),
    buildMinutesCandidate(ctx),
    buildMissionCandidate(ctx),
    buildConsecutiveCandidate(ctx),
    buildCourseStudyCandidate(ctx),
  ]) {
    if (c) fallbackPool.push(c);
  }

  while (selected.length < max) {
    const next = pickUnique(fallbackPool, usedKinds, `${ctx.dateKey}-fill-${selected.length}`);
    if (!next) break;
    selected.push(next);
    usedKinds.add(next.kind);
  }

  return selected.map((c, i) => ({
    ...c,
    id: `daily-${ctx.dateKey}-${i}`,
    progress: 0,
    completed: false,
  }));
}

export function buildGenContext(
  courses: Course[],
  missions: Mission[],
  todayBlocks: TimeBlock[],
  player: Player,
  dateKey = todayISO(),
): DailyMissionGeneratorContext {
  return {
    player,
    courses,
    missions,
    todayBlocks,
    dateKey,
  };
}

export function isDailyMissionFeasible(
  mission: DailyMission,
  ctx: Pick<DailyMissionGeneratorContext, 'courses' | 'missions' | 'todayBlocks'>,
): boolean {
  switch (mission.kind) {
    case 'complete_topic':
      if (!mission.refCourseId || !mission.refTopicId) return false;
      return collectOpenTopics(ctx.courses).some(
        (t) => t.course.id === mission.refCourseId && t.topic.id === mission.refTopicId,
      );
    case 'complete_mission':
      if (!mission.refMissionId) return false;
      return ctx.missions.some((m) => m.id === mission.refMissionId && isMissionBoardQuestFeasible(m));
    case 'course_study':
      if (!mission.refCourseId) return false;
      return ctx.courses.some(
        (c) => c.id === mission.refCourseId && isCourseStudyMissionFeasible(c, ctx.todayBlocks),
      );
    case 'assign_blocks':
      return countAssignedBlocks(ctx.todayBlocks) < mission.target;
    case 'blocks_completed':
    case 'consecutive_blocks':
      return countCompletedBlocks(ctx.todayBlocks) < mission.target;
    case 'daily_goal':
    case 'study_minutes':
    case 'earn_xp':
      return true;
    default:
      return true;
  }
}
