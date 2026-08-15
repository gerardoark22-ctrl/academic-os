import type {
  Course,
  Mission,
  OracleBlockPlan,
  OracleBlockPlanItem,
  OracleProfile,
  Player,
  TimeBlock,
} from '../types';
import { countUnitCheckItems, daysUntil, getEffectiveStreak, underworldDays } from './gamification';
import { getDailyGoalMinutes } from './dailyGoal';
import { daysUntilDue } from './missionDue';
import { formatBlockContractTitle } from './blockTitle';
import {
  APP_TIMEZONE,
  getBlockLiveStatus,
  getOracleTimeSnapshot,
  isSlotFutureOnDate,
  minutesFromHHMM,
} from './localTime';

const PLAN_START = '<<<ORACLE_PLAN>>>';
const PLAN_END = '<<<END>>>';

export function isBlockSlotEmpty(b: TimeBlock): boolean {
  return (!b.title || b.type === 'rest') && !b.completed;
}

export function slotsForDuration(
  blocks: TimeBlock[],
  startTime: string,
  blockMinutes: number,
  opts?: { planDate?: string; now?: Date },
): TimeBlock[] {
  const now = opts?.now ?? new Date();
  const planDate = opts?.planDate ?? blocks[0]?.date;
  if (planDate && !isSlotFutureOnDate(planDate, startTime, now)) return [];

  const slotsNeeded = Math.max(1, Math.ceil(blockMinutes / 30));
  const sorted = [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const startIdx = sorted.findIndex((b) => b.startTime === startTime);
  if (startIdx === -1) return [];

  const picked: TimeBlock[] = [];
  for (let i = 0; i < slotsNeeded; i++) {
    const slot = sorted[startIdx + i];
    if (!slot || !isBlockSlotEmpty(slot)) return [];
    picked.push(slot);
  }
  return picked;
}

export function listFreeSlots(
  blocks: TimeBlock[],
  scheduleStart = '08:00',
  scheduleEnd = '22:00',
  opts?: { planDate?: string; now?: Date },
): string[] {
  const now = opts?.now ?? new Date();
  const planDate = opts?.planDate ?? blocks[0]?.date;
  const { dateISO: todayPeru, timeHHMM } = getOracleTimeSnapshot(now);

  return blocks
    .filter((b) => {
      if (!isBlockSlotEmpty(b)) return false;
      if (b.startTime < scheduleStart || b.startTime >= scheduleEnd) return false;
      if (planDate === todayPeru && b.date === todayPeru) {
        return minutesFromHHMM(b.startTime) > minutesFromHHMM(timeHHMM);
      }
      return planDate ? b.date === planDate : true;
    })
    .map((b) => b.startTime);
}

function summarizeBlocksSchedule(blocks: TimeBlock[], now: Date): string[] {
  const lines: string[] = [];
  const scheduled = blocks.filter((b) => b.title && b.type !== 'rest');
  for (const b of scheduled.sort((a, b) => a.startTime.localeCompare(b.startTime))) {
    const status = getBlockLiveStatus(b, now);
    const label =
      status === 'live'
        ? 'EN CURSO'
        : status === 'missed'
          ? 'PERDIDO'
          : status === 'done'
            ? 'HECHO'
            : status === 'future'
              ? 'PENDIENTE'
              : '—';
    lines.push(`  ${b.startTime}–${b.endTime} | ${b.title} | ${label}`);
  }
  if (lines.length === 0) lines.push('  (ningún bloque asignado aún)');
  return lines;
}

function topicLine(
  course: Course,
  unitId: string,
  unitName: string,
  examDate: string | undefined,
  topic: Course['units'][0]['topics'][0],
): string {
  const subs = topic.subtopics ?? [];
  const subDone = subs.filter((s) => s.completed).length;
  const subPart = subs.length > 0 ? `, subtemas ${subDone}/${subs.length}` : '';
  const done = topic.completed ? 'completado' : 'pendiente';
  return (
    `      TEMA id=${topic.id} | ${topic.name} | ${done}${subPart}`
    + `\n        cursoId=${course.id} unidadId=${unitId} unidad="${unitName}"`
    + (examDate ? ` examenUnidad=${examDate}` : '')
  );
}

export function buildOracleStudyContext(opts: {
  player: Player | null;
  courses: Course[];
  blocks: TimeBlock[];
  missions: Mission[];
  profile: OracleProfile;
  today: string;
  now?: Date;
}): string {
  const { player, courses, blocks, missions, profile, today, now = new Date() } = opts;
  const clock = getOracleTimeSnapshot(now);
  const goal = getDailyGoalMinutes(player);
  const streak = getEffectiveStreak(player?.studyStreak ?? 0, player?.goalMetDate);
  const freeSlots = listFreeSlots(blocks, profile.scheduleStart, profile.scheduleEnd, {
    planDate: today,
    now,
  });
  const scheduled = blocks.filter((b) => b.title && b.type !== 'rest');
  const completed = scheduled.filter((b) => b.completed);
  const liveBlock = scheduled.find((b) => getBlockLiveStatus(b, now) === 'live');
  const nextFree = freeSlots[0];

  const lines: string[] = [
    `ZONA HORARIA: ${clock.timezoneLabel} (${APP_TIMEZONE})`,
    `AHORA EN PERÚ: ${clock.dateLong} — ${clock.timeHHMM} (reloj ${clock.clock})`,
    `FECHA PLANIFICACIÓN: ${today}`,
    `REGLA TEMPORAL: solo asignar startTime >= ${clock.timeHHMM} si hoy es ${today}; usar únicamente SLOTS LIBRES FUTUROS.`,
    nextFree ? `PRÓXIMO SLOT LIBRE: ${nextFree}` : 'PRÓXIMO SLOT LIBRE: ninguno restante hoy en tu horario',
    liveBlock
      ? `BLOQUE EN CURSO AHORA: ${liveBlock.startTime}–${liveBlock.endTime} — ${liveBlock.title}`
      : 'BLOQUE EN CURSO AHORA: ninguno',
    `PERFIL ORÁCULO: horario ${profile.scheduleStart ?? '08:00'}–${profile.scheduleEnd ?? '22:00'}, bloque ${profile.blockMinutes ?? 30} min, máx 10 bloques`,
    `JUGADOR: nivel ${player?.level ?? 1}, XP ${player?.xp ?? 0}, racha ${streak} días, inframundo ${underworldDays(player?.lastStudyDate ?? null)} días sin estudio`,
    `META HOY: ${player?.todayStudyMinutes ?? 0}/${goal} min estudio`,
    `BLOQUES HOY: ${completed.length}/${scheduled.length} completados | ${freeSlots.length} slots libres futuros`,
    `SLOTS LIBRES FUTUROS (${freeSlots.length}): ${freeSlots.join(', ') || 'ninguno'}`,
    '',
    'CRONOGRAMA ASIGNADO HOY (estado según reloj Perú):',
    ...summarizeBlocksSchedule(blocks, now),
    '',
    'PRIORIDAD POR CURSO (always = siempre priorizar, exam_only = solo si hay examen próximo):',
  ];

  for (const c of courses) {
    const pri = profile.coursePriorities?.[c.id] ?? 'exam_only';
    const unitFocusId = profile.unitFocus?.[c.id];
    const unitFocus = unitFocusId
      ? c.units.find((u) => u.id === unitFocusId)?.name ?? unitFocusId
      : 'libre (el usuario elige unidad en chat)';
    lines.push(`  ${c.icon} ${c.name} id=${c.id} progreso=${c.progress}% prioridad=${pri} unidadPreferida=${unitFocus}`);
  }

  lines.push('', 'TEMARIO COMPLETO (solo estos topicId son válidos para bloques):');
  for (const course of courses) {
    lines.push(`CURSO ${course.name} id=${course.id}`);
    for (const unit of course.units) {
      const { total, completed: done } = countUnitCheckItems(unit.topics);
      const exam = unit.examDate ? ` | EXAMEN ${unit.examDate} (${daysUntil(unit.examDate)}d)` : '';
      lines.push(`  UNIDAD ${unit.name} id=${unit.id} progreso=${unit.progress}% temas ${done}/${total}${exam}`);
      for (const topic of unit.topics) {
        if (topic.completed) continue;
        lines.push(topicLine(course, unit.id, unit.name, unit.examDate, topic));
      }
    }
  }

  if (missions.length > 0) {
    lines.push('', 'MISIONES ACTIVAS:');
    for (const m of missions.slice(0, 15)) {
      const d = daysUntilDue(m.dueDate);
      lines.push(`  - [${m.priority}] ${m.title} | ${m.courseName} | vence ${m.dueDate} (${d}d)`);
    }
  }

  return lines.join('\n');
}

export function buildVerdadContext(opts: {
  player: Player | null;
  courses: Course[];
  blocks: TimeBlock[];
  missions: Mission[];
  today: string;
  now?: Date;
}): string {
  const { player, courses, blocks, missions, today, now = new Date() } = opts;
  const clock = getOracleTimeSnapshot(now);
  const goal = getDailyGoalMinutes(player);
  const todayMin = player?.todayStudyMinutes ?? 0;
  const yesterday = player?.yesterdayStudyMinutes ?? 0;
  const streak = getEffectiveStreak(player?.studyStreak ?? 0, player?.goalMetDate);
  const scheduled = blocks.filter((b) => b.title && b.type !== 'rest');
  const completed = scheduled.filter((b) => b.completed);
  const missed = scheduled.filter((b) => getBlockLiveStatus(b, now) === 'missed');
  const live = scheduled.filter((b) => getBlockLiveStatus(b, now) === 'live');
  const overdueMissions = missions.filter((m) => daysUntilDue(m.dueDate) < 0);

  let pendingTopics = 0;
  let completedTopics = 0;
  const examAlerts: string[] = [];

  for (const c of courses) {
    for (const u of c.units) {
      const { total, completed: done } = countUnitCheckItems(u.topics);
      pendingTopics += total - done;
      completedTopics += done;
      if (u.examDate) {
        const d = daysUntil(u.examDate);
        if (d <= 21) {
          examAlerts.push(
            `${c.name} / ${u.name}: examen en ${d}d, unidad al ${u.progress}%, curso al ${c.progress}%`,
          );
        }
      }
    }
  }

  const goalMet = todayMin >= goal;
  const vsYesterday = todayMin - yesterday;

  return [
    `ZONA HORARIA: ${clock.timezoneLabel} — AHORA ${clock.timeHHMM}`,
    `FECHA: ${today} (${clock.dateLong})`,
    `NIVEL ${player?.level ?? 1} | XP ${player?.xp ?? 0} | RACHA ${streak}d | INACTIVIDAD ${underworldDays(player?.lastStudyDate ?? null)}d`,
    `META DIARIA: ${todayMin}/${goal} min (${goalMet ? 'CUMPLIDA' : `FALTAN ${goal - todayMin} min`})`,
    `AYER: ${yesterday} min | HOY vs AYER: ${vsYesterday >= 0 ? '+' : ''}${vsYesterday} min`,
    `BLOQUES HOY: ${completed.length} completados / ${scheduled.length} planificados / ${missed.length} perdidos / ${live.length} en curso ahora`,
    `TEMAS: ${completedTopics} completados, ${pendingTopics} pendientes en total`,
    `MISIONES VENCIDAS: ${overdueMissions.length}${overdueMissions.length ? ` (${overdueMissions.map((m) => m.title).join('; ')})` : ''}`,
    `MISIONES ACTIVAS: ${missions.length}`,
    `BLOQUES TOTAL HISTÓRICO: ${player?.totalBlocksCompleted ?? 0}`,
    `BONUS DIARIO: ${player?.dailyBonusActive !== false ? 'activo' : 'perdido'}`,
    `DÍAS PERFECTOS: ${player?.perfectDaysCount ?? 0}`,
    examAlerts.length ? `EXÁMENES PRÓXIMOS CON RETRASO:\n${examAlerts.map((e) => `  - ${e}`).join('\n')}` : 'EXÁMENES PRÓXIMOS: ninguno crítico en 21d',
  ].join('\n');
}

export function parseOracleBlockPlan(text: string): OracleBlockPlan | null {
  const start = text.indexOf(PLAN_START);
  const end = text.indexOf(PLAN_END);
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const raw = text.slice(start + PLAN_START.length, end).trim();
    const parsed = JSON.parse(raw) as OracleBlockPlan;
    if (!Array.isArray(parsed.blocks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function stripOraclePlanFromDisplay(text: string): string {
  const start = text.indexOf(PLAN_START);
  if (start === -1) return text.trim();
  return text.slice(0, start).trim();
}

export function validateOracleBlockPlan(
  plan: OracleBlockPlan,
  courses: Course[],
  opts?: { planDate?: string; now?: Date },
): { valid: OracleBlockPlanItem[]; errors: string[] } {
  const errors: string[] = [];
  const valid: OracleBlockPlanItem[] = [];
  const now = opts?.now ?? new Date();
  const planDate = opts?.planDate ?? todayPeruFrom(now);
  const topicMap = new Map<string, { course: Course; unitId: string; unitName: string; topicName: string }>();

  for (const course of courses) {
    for (const unit of course.units) {
      for (const topic of unit.topics) {
        topicMap.set(topic.id, {
          course,
          unitId: unit.id,
          unitName: unit.name,
          topicName: topic.name,
        });
      }
    }
  }

  for (const block of plan.blocks.slice(0, 10)) {
    const ref = topicMap.get(block.topicId);
    if (!ref) {
      errors.push(`topicId inválido: ${block.topicId}`);
      continue;
    }
    if (block.courseId !== ref.course.id || block.unitId !== ref.unitId) {
      errors.push(`IDs no coinciden para tema ${block.topicId}`);
      continue;
    }
    if (!isSlotFutureOnDate(planDate, block.startTime, now)) {
      errors.push(`${block.startTime} ya pasó en Perú — elige un slot futuro`);
      continue;
    }
    valid.push({
      ...block,
      title:
        block.title && block.title.includes('·')
          ? block.title
          : formatBlockContractTitle({
              courseName: ref.course.name,
              unitName: ref.unitName,
              topicName: ref.topicName,
            }),
      type: block.type === 'exam' ? 'exam' : 'study',
    });
  }

  if (plan.blocks.length > 10) {
    errors.push('Máximo 10 bloques; se truncó el plan.');
  }

  return { valid, errors };
}

export const ORACLE_PLAN_MARKERS = { PLAN_START, PLAN_END };

export const VERDAD_COOLDOWN_MS = 4 * 60 * 60 * 1000;

export function verdadCooldownRemaining(lastVerdadAt?: string): number {
  if (!lastVerdadAt) return 0;
  const elapsed = Date.now() - new Date(lastVerdadAt).getTime();
  return Math.max(0, VERDAD_COOLDOWN_MS - elapsed);
}

export function defaultOracleProfile(): OracleProfile {
  return {
    scheduleStart: '08:00',
    scheduleEnd: '22:00',
    blockMinutes: 30,
    coursePriorities: {},
    unitFocus: {},
  };
}

function todayPeruFrom(now: Date): string {
  return getOracleTimeSnapshot(now).dateISO;
}
