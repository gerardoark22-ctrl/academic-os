import type { Course, Mission, Player, TimeBlock, WeeklyMission, MissionComplexity } from '../types';
import { generateId, todayISO } from './gamification';
import { PLAYER_CONFIG } from './playerConfig';
import { daysUntilDue } from './missionDue';
import { getWeekKey } from './hadesShield';
import {
  creativeBoardMissionQuest,
  creativeWeeklyCourseQuest,
  pickGeneric,
  GENERIC_WEEKLY_COPY,
} from './creativeQuestCopy';

type Candidate = Omit<WeeklyMission, 'id' | 'weekKey' | 'progress' | 'completed'>;

function xpFor(complexity: MissionComplexity): number {
  return PLAYER_CONFIG.weeklyMissionXp[complexity];
}

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

export interface WeeklyMissionGenContext {
  courses: Course[];
  missions: Mission[];
  weekBlocks: TimeBlock[];
  goalMinutes: number;
  weekKey: string;
  player?: Player | null;
}

function countAssignedWeekBlocks(blocks: TimeBlock[]): number {
  return blocks.filter((b) => b.title && b.type !== 'rest').length;
}

function buildGoalDays(seed: string, target: number, complexity: MissionComplexity, required: boolean): Candidate {
  const copy = pickGeneric(GENERIC_WEEKLY_COPY.weekGoalDays, `${seed}-g${target}`);
  return {
    kind: 'week_goal_days',
    title: copy.title,
    description: `Cumple tu meta diaria ${target} días esta semana`,
    complexity,
    required,
    target,
    xpReward: xpFor(complexity),
    icon: copy.icon,
  };
}

function buildWeekBlocks(seed: string, target: number, complexity: MissionComplexity): Candidate {
  const copy = pickGeneric(GENERIC_WEEKLY_COPY.weekBlocks, `${seed}-b${target}`);
  return {
    kind: 'week_blocks',
    title: copy.title,
    description: `Completa ${target} bloques de estudio esta semana`,
    complexity,
    required: false,
    target,
    xpReward: xpFor(complexity),
    icon: copy.icon,
  };
}

function buildWeekMinutes(seed: string, target: number, complexity: MissionComplexity): Candidate {
  const copy = pickGeneric(GENERIC_WEEKLY_COPY.weekMinutes, `${seed}-m${target}`);
  return {
    kind: 'week_minutes',
    title: copy.title,
    description: `Acumula ${target} min de estudio esta semana`,
    complexity,
    required: false,
    target,
    xpReward: xpFor(complexity),
    icon: copy.icon,
  };
}

function buildWeekXp(ctx: WeeklyMissionGenContext): Candidate {
  const level = ctx.player?.level ?? 1;
  const perBlock = PLAYER_CONFIG.xpPerBlock;
  const options = [perBlock * 15, perBlock * 25, perBlock * 40];
  const target = options[Math.min(options.length - 1, Math.floor(level / 4))] ?? perBlock * 20;
  const complexity: MissionComplexity = target >= perBlock * 35 ? 'heavy' : 'medium';
  const copy = pickGeneric(GENERIC_WEEKLY_COPY.weekXp, `${ctx.weekKey}-xp`);
  return {
    kind: 'week_xp',
    title: copy.title,
    description: `Gana ${target} XP esta semana`,
    complexity,
    required: false,
    target,
    xpReward: xpFor(complexity),
    icon: copy.icon,
  };
}

function buildWeekAssign(ctx: WeeklyMissionGenContext): Candidate {
  const assigned = countAssignedWeekBlocks(ctx.weekBlocks);
  const target = Math.max(8, assigned + 5);
  const copy = pickGeneric(GENERIC_WEEKLY_COPY.weekAssign, `${ctx.weekKey}-assign`);
  return {
    kind: 'week_assign_blocks',
    title: copy.title,
    description: `Asigna al menos ${target} bloques en tu horario esta semana`,
    complexity: 'medium',
    required: false,
    target,
    xpReward: xpFor('medium'),
    icon: copy.icon,
  };
}

function buildWeekTopics(seed: string, target: number): Candidate {
  const copy = pickGeneric(GENERIC_WEEKLY_COPY.weekTopics, `${seed}-t${target}`);
  return {
    kind: 'week_topics',
    title: copy.title,
    description: `Avanza ${target} temas de tus cursos esta semana`,
    complexity: target >= 3 ? 'heavy' : 'medium',
    required: false,
    target,
    xpReward: xpFor(target >= 3 ? 'heavy' : 'medium'),
    icon: copy.icon,
  };
}

function buildWeekMissionsDone(seed: string, target: number): Candidate {
  const copy = pickGeneric(GENERIC_WEEKLY_COPY.weekMissions, `${seed}-md${target}`);
  return {
    kind: 'week_missions_done',
    title: copy.title,
    description: `Completa ${target} misiones del tablero esta semana`,
    complexity: target >= 4 ? 'heavy' : 'medium',
    required: false,
    target,
    xpReward: xpFor(target >= 4 ? 'heavy' : 'medium'),
    icon: copy.icon,
  };
}

/** Metas semanales variadas — un tipo distinto por misión cuando es posible. */
export function generateWeeklyMissions(ctx: WeeklyMissionGenContext): WeeklyMission[] {
  const seed = ctx.weekKey;
  const usedKinds = new Set<string>();
  const selected: Candidate[] = [];

  const anchor = buildGoalDays(seed, 4, 'heavy', true);
  selected.push(anchor);
  usedKinds.add(anchor.kind);

  const slotFactories: Array<() => Candidate | null> = shuffle(
    [
      () => buildWeekBlocks(seed, 12, 'medium'),
      () => buildWeekBlocks(seed, 6, 'light'),
      () => buildWeekMinutes(seed, 300, 'medium'),
      () => buildWeekMinutes(seed, 150, 'light'),
      () => buildWeekXp(ctx),
      () => buildWeekAssign(ctx),
      () => buildWeekTopics(seed, 2),
      () => buildWeekTopics(seed, 3),
      () => buildWeekMissionsDone(seed, 2),
      () => buildWeekMissionsDone(seed, 4),
      () => {
        const urgent = ctx.missions
          .filter((m) => !m.completed && daysUntilDue(m.dueDate) <= 7)
          .sort((a, b) => daysUntilDue(a.dueDate) - daysUntilDue(b.dueDate));
        const m = pickOne(urgent, `${seed}-board`);
        if (!m) return null;
        const complexity = m.complexity ?? (m.priority === 'odisea' ? 'heavy' : 'medium');
        const creative = creativeBoardMissionQuest(m, 'weekly');
        return {
          kind: 'complete_mission' as const,
          title: creative.title,
          description: creative.description,
          complexity,
          required: m.priority === 'odisea',
          target: 1,
          refMissionId: m.id,
          xpReward: xpFor(complexity),
          icon: creative.icon,
        };
      },
      () => {
        const course = pickOne(ctx.courses, `${seed}-course`);
        if (!course) return null;
        const creative = creativeWeeklyCourseQuest(course, 3);
        return {
          kind: 'week_course_blocks' as const,
          title: creative.title,
          description: creative.description,
          complexity: 'medium' as const,
          required: false,
          target: 3,
          refCourseId: course.id,
          xpReward: xpFor('medium'),
          icon: creative.icon,
        };
      },
      () => buildGoalDays(seed, 3, 'medium', false),
    ],
    `${seed}-slots`,
  );

  function tryAdd(c: Candidate | null) {
    if (!c || selected.length >= PLAYER_CONFIG.weeklyMissionMaxCount) return;
    const key = c.kind === 'complete_mission' || c.kind === 'week_course_blocks'
      ? `${c.kind}:${c.refMissionId ?? c.refCourseId}`
      : c.kind;
    if (usedKinds.has(key)) return;
    if (c.kind !== 'week_goal_days' && selected.some((s) => s.kind === c.kind && s.target === c.target)) return;
    selected.push(c);
    usedKinds.add(key);
    if (c.kind === 'week_goal_days') usedKinds.add('week_goal_days');
  }

  for (const factory of slotFactories) {
    if (selected.length >= PLAYER_CONFIG.weeklyMissionMaxCount) break;
    tryAdd(factory());
  }

  const fallbacks: Candidate[] = [
    buildWeekBlocks(seed, 6, 'light'),
    buildWeekMinutes(seed, 150, 'light'),
    buildGoalDays(seed, 3, 'medium', false),
  ];
  for (const fb of fallbacks) {
    if (selected.length >= PLAYER_CONFIG.weeklyMissionMinCount) break;
    tryAdd(fb);
  }

  while (selected.length < PLAYER_CONFIG.weeklyMissionMinCount) {
    const fb = fallbacks.find((f) => !selected.some((s) => s.kind === f.kind && s.target === f.target));
    if (!fb) break;
    tryAdd(fb);
  }

  return selected.slice(0, PLAYER_CONFIG.weeklyMissionMaxCount).map((c) => ({
    ...c,
    id: generateId(),
    weekKey: ctx.weekKey,
    progress: 0,
    completed: false,
  }));
}

export function currentWeekKey(): string {
  return getWeekKey(todayISO());
}
