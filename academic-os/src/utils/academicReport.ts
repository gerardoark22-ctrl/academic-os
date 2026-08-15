import type { Course, Mission, Player, TimeBlock } from '../types';
import { daysUntil, todayISO, underworldDays } from './gamification';
import { getDailyGoalMinutes } from './dailyGoal';
import { resolveTodayStudyMinutes } from './studyProgress';
import {
  evaluateHadesTriggers,
  getExamCrises,
  getTopicBacklogs,
  type ExamCrisisAlert,
  type TopicBacklogAlert,
  type HadesEmailSlot,
} from './hadesRules';

export interface AcademicReport {
  generatedAt: string;
  underworldDays: number;
  daysWithoutOpeningApp: number;
  level: number;
  xp: number;
  studyStreak: number;
  todayStudyMinutes: number;
  dailyGoalMinutes: number;
  dailyGoalMet: boolean;
  minutesRemaining: number;
  zeroStudyToday: boolean;
  overdueMissions: { title: string; courseName: string; daysOverdue: number; priority: string }[];
  legendaryOverdue: { title: string; courseName: string; daysOverdue: number }[];
  dueTodayMissions: { title: string; courseName: string }[];
  pendingBlocksToday: { startTime: string; title: string; type: string }[];
  completedBlocksToday: number;
  totalScheduledBlocksToday: number;
  pendingTopics: number;
  totalTopics: number;
  topicsProgressPct: number;
  topicBacklogs: TopicBacklogAlert[];
  examCrises: ExamCrisisAlert[];
  escalationLevel: number;
  xpPenaltyToday: number;
  triggers: string[];
}

export function buildAcademicReport(
  player: Player,
  missions: Mission[],
  courses: Course[],
  blocksToday: TimeBlock[],
): AcademicReport {
  const today = todayISO();
  const dailyGoalMinutes = getDailyGoalMinutes(player);
  const todayStudyMinutes = resolveTodayStudyMinutes(player, blocksToday);
  const dailyGoalMet = todayStudyMinutes >= dailyGoalMinutes;

  const triggerState = evaluateHadesTriggers(player, missions, courses, todayStudyMinutes);

  const active = missions.filter((m) => !m.completed);
  const overdueMissions = active
    .filter((m) => daysUntil(m.dueDate) < 0)
    .map((m) => ({
      title: m.title,
      courseName: m.courseName,
      daysOverdue: Math.abs(daysUntil(m.dueDate)),
      priority: m.priority,
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const legendaryOverdue = overdueMissions
    .filter((m) => m.priority === 'odisea')
    .map(({ priority: _, ...rest }) => rest);

  const dueTodayMissions = active
    .filter((m) => m.dueDate === today)
    .map((m) => ({ title: m.title, courseName: m.courseName }));

  const scheduled = blocksToday.filter((b) => b.title && b.type !== 'rest');
  const pendingBlocksToday = scheduled
    .filter((b) => !b.completed)
    .map((b) => ({ startTime: b.startTime, title: b.title, type: b.type }));

  let totalTopics = 0;
  let doneTopics = 0;
  for (const c of courses) {
    for (const u of c.units) {
      for (const t of u.topics) {
        totalTopics++;
        if (t.completed) doneTopics++;
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    underworldDays: underworldDays(player.lastStudyDate),
    daysWithoutOpeningApp: triggerState.daysWithoutOpeningApp,
    level: player.level,
    xp: player.xp,
    studyStreak: player.studyStreak,
    todayStudyMinutes,
    dailyGoalMinutes,
    dailyGoalMet,
    minutesRemaining: Math.max(0, dailyGoalMinutes - todayStudyMinutes),
    zeroStudyToday: triggerState.zeroStudyToday,
    overdueMissions,
    legendaryOverdue,
    dueTodayMissions,
    pendingBlocksToday,
    completedBlocksToday: scheduled.filter((b) => b.completed).length,
    totalScheduledBlocksToday: scheduled.length,
    pendingTopics: totalTopics - doneTopics,
    totalTopics,
    topicsProgressPct: totalTopics ? Math.round((doneTopics / totalTopics) * 100) : 0,
    topicBacklogs: getTopicBacklogs(courses),
    examCrises: getExamCrises(courses),
    escalationLevel: triggerState.escalationLevel,
    xpPenaltyToday: player.lastXpPenaltyAmount ?? 0,
    triggers: triggerState.reasons,
  };
}

export function formatReportForAI(r: AcademicReport, slot?: HadesEmailSlot): string {
  const lines = [
    `Fecha: ${r.generatedAt.split('T')[0]}`,
    `Inframundo: ${r.underworldDays} días sin estudiar`,
    `Sin abrir la app: ${r.daysWithoutOpeningApp} día(s)`,
    `Nivel ${r.level} · ${r.xp} XP · Racha ${r.studyStreak} días`,
    `Estudio hoy: ${Math.floor(r.todayStudyMinutes / 60)}h${r.todayStudyMinutes % 60}m / ${r.dailyGoalMinutes / 60}h (${r.dailyGoalMet ? 'CUMPLIDA' : `FALTAN ${r.minutesRemaining} min`})`,
    `Temas globales: ${r.totalTopics - r.pendingTopics}/${r.totalTopics} (${r.topicsProgressPct}%)`,
    `Bloques hoy: ${r.completedBlocksToday}/${r.totalScheduledBlocksToday} completados`,
  ];

  if (r.legendaryOverdue.length) {
    lines.push('Misiones LEGENDARIAS vencidas (nombra cada una):');
    for (const m of r.legendaryOverdue) {
      lines.push(`  - [${m.courseName}] "${m.title}" (+${m.daysOverdue}d vencida)`);
    }
  }
  if (r.overdueMissions.length) {
    lines.push('Todas las misiones vencidas (nombra curso y título):');
    for (const m of r.overdueMissions) {
      lines.push(`  - [${m.courseName}] "${m.title}" (${m.priority}, +${m.daysOverdue}d)`);
    }
  }
  if (r.dueTodayMissions.length) {
    lines.push('Misiones para hoy:');
    for (const m of r.dueTodayMissions) {
      lines.push(`  - [${m.courseName}] "${m.title}"`);
    }
  }
  if (r.pendingBlocksToday.length) {
    lines.push('Bloques sin hacer hoy (hora y título):');
    for (const b of r.pendingBlocksToday) {
      lines.push(`  - ${b.startTime} "${b.title}" (${b.type})`);
    }
  }
  if (r.topicBacklogs.length) {
    lines.push('Temas pendientes en cursos con examen ≤14 días:');
    for (const b of r.topicBacklogs) {
      lines.push(
        `  - ${b.courseName} / ${b.unitName} (examen ${b.daysLeft}d): ${b.pendingTopics} temas — ${b.pendingTopicNames.slice(0, 6).join(', ')}`,
      );
    }
  }
  if (r.examCrises.length) {
    lines.push('Crisis de examen (≤7d, prep. guerra <60%):');
    for (const e of r.examCrises) {
      lines.push(`  - ${e.courseName} — "${e.unitName}": ${e.daysLeft}d, prep. ${e.prepWarPct}%`);
    }
  }
  if (r.xpPenaltyToday > 0) {
    lines.push(`Castigo XP hoy: −${r.xpPenaltyToday} XP ya ejecutados`);
  }
  if (r.escalationLevel >= 1) {
    lines.push(`Nivel de escalación por inacción: ${r.escalationLevel}`);
  }
  lines.push(`Fallas concretas: ${r.triggers.join(' | ') || 'ninguna'}`);

  if (slot === 'fiveAm') {
    lines.push('--- PLANIFICACIÓN 5 AM ---');
    lines.push('El usuario DEBE abrir el Oráculo (Planificar hoy) y crear bloques de estudio.');
    if (r.dueTodayMissions.length) {
      lines.push('Prioridad: misiones que vencen HOY (nombra cada una).');
    }
    if (r.examCrises.length || r.topicBacklogs.length) {
      lines.push('Priorizar cursos con examen cercano y temas sin dominar.');
    }
  }

  if (slot === 'elevenPm') {
    lines.push('--- BALANCE 23:00 ---');
    lines.push(
      `Bloques completados hoy: ${r.completedBlocksToday}/${r.totalScheduledBlocksToday}`,
    );
    lines.push(
      'Debes emitir VALORACIÓN: PÉSIMO | MALO | REGULAR | BUENO | EXCELENTE según el día real.',
    );
  }

  return lines.join('\n');
}

export { evaluateHadesTriggers, shouldSendHadesEmailSlot } from './hadesRules';
export type { HadesEmailSlot } from './hadesRules';
