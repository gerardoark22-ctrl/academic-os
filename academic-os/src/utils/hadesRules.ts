import type { Course, Mission, Player } from '../types';
import { daysUntil, todayISO, underworldDays } from './gamification';
import { computeWarReadiness } from './courseExams';
import { getDailyGoalMinutes } from './dailyGoal';

export const HADES_RULES = {
  /** Planificación diaria con Oráculo IA */
  fiveAmHour: 5,
  /** Regla 1: correo por 0 min de estudio */
  sixPmHour: 18,
  /** Regla 7: extra si no cumples meta */
  ninePmHour: 21,
  /** Informe nocturno de deuda */
  eveningHour: 22,
  /** Balance del día + valoración IA */
  elevenPmHour: 23,
  /** Regla 3: temas pendientes en curso con examen ≤14d */
  examHorizonDays: 14,
  minPendingTopicsInExamCourse: 3,
  /** Regla 6: examen ≤7d y prep. guerra <60% */
  examCrisisDays: 7,
  prepWarMinPct: 60,
  /** Regla 5 */
  minOverdueMissions: 2,
  /** Inactividad: correo si pasan 6h sin usar/avanzar */
  inactivityHours: 6,
} as const;

export type HadesEmailSlot =
  | 'fiveAm'
  | 'sixPm'
  | 'ninePm'
  | 'evening'
  | 'elevenPm'
  | 'inactivity6h';

export interface TopicBacklogAlert {
  courseName: string;
  unitName: string;
  examDate: string;
  daysLeft: number;
  pendingTopics: number;
  pendingTopicNames: string[];
}

export interface ExamCrisisAlert {
  courseName: string;
  unitName: string;
  daysLeft: number;
  prepWarPct: number;
}

export interface HadesTriggerState {
  zeroStudyToday: boolean;
  dailyGoalMet: boolean;
  underworldDays: number;
  daysWithoutOpeningApp: number;
  overdueMissions: Mission[];
  legendaryOverdue: Mission[];
  missionDebt: boolean;
  topicBacklogs: TopicBacklogAlert[];
  topicBacklogActive: boolean;
  examCrises: ExamCrisisAlert[];
  escalationLevel: number;
  reasons: string[];
}

function daysBetween(from: string | null | undefined, to: string): number {
  if (!from) return 999;
  const a = new Date(from);
  const b = new Date(to);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function getTopicBacklogs(courses: Course[]): TopicBacklogAlert[] {
  const alerts: TopicBacklogAlert[] = [];

  for (const course of courses) {
    for (const unit of course.units) {
      if (!unit.examDate) continue;
      const daysLeft = daysUntil(unit.examDate);
      if (daysLeft < 0 || daysLeft > HADES_RULES.examHorizonDays) continue;

      const pending = unit.topics.filter((t) => !t.completed);
      if (pending.length < HADES_RULES.minPendingTopicsInExamCourse) continue;

      alerts.push({
        courseName: course.name,
        unitName: unit.name,
        examDate: unit.examDate,
        daysLeft,
        pendingTopics: pending.length,
        pendingTopicNames: pending.map((t) => t.name),
      });
    }
  }

  return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function getExamCrises(courses: Course[]): ExamCrisisAlert[] {
  const crises: ExamCrisisAlert[] = [];

  for (const course of courses) {
    for (const unit of course.units) {
      if (!unit.examDate) continue;
      const daysLeft = daysUntil(unit.examDate);
      if (daysLeft < 0 || daysLeft > HADES_RULES.examCrisisDays) continue;

      const prep = computeWarReadiness(course.progress, unit.progress);
      if (prep >= HADES_RULES.prepWarMinPct) continue;

      crises.push({
        courseName: course.name,
        unitName: unit.name,
        daysLeft,
        prepWarPct: prep,
      });
    }
  }

  return crises.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function evaluateHadesTriggers(
  player: Player,
  missions: Mission[],
  courses: Course[],
  todayStudyMinutes: number,
): HadesTriggerState {
  const today = todayISO();
  const uw = underworldDays(player.lastStudyDate);
  const dailyGoalMinutes = getDailyGoalMinutes(player);
  const dailyGoalMet = todayStudyMinutes >= dailyGoalMinutes;
  const zeroStudyToday = todayStudyMinutes === 0;

  const daysWithoutOpeningApp = daysBetween(player.lastAppOpenDate ?? player.lastActiveDate, today);

  const overdueMissions = missions.filter((m) => !m.completed && daysUntil(m.dueDate) < 0);
  const legendaryOverdue = overdueMissions.filter((m) => m.priority === 'odisea');
  const missionDebt =
    overdueMissions.length >= HADES_RULES.minOverdueMissions || legendaryOverdue.length >= 1;

  const topicBacklogs = getTopicBacklogs(courses);
  const topicBacklogActive = topicBacklogs.length > 0;
  const examCrises = getExamCrises(courses);

  const escalationLevel = player.topicBacklogEscalation ?? 0;

  const reasons: string[] = [];
  if (zeroStudyToday) reasons.push('0 minutos de estudio hoy');
  if (!dailyGoalMet && !zeroStudyToday) {
    reasons.push(`Meta ${Math.round(dailyGoalMinutes / 60)}h sin cumplir (${Math.floor(todayStudyMinutes / 60)}h${todayStudyMinutes % 60}m)`);
  }
  if (uw >= 1) reasons.push(`${uw} día(s) sin estudiar (Inframundo)`);
  if (daysWithoutOpeningApp >= 1) reasons.push(`${daysWithoutOpeningApp} día(s) sin abrir Academic OS`);
  if (missionDebt) {
    for (const m of overdueMissions.slice(0, 5)) {
      reasons.push(`Misión vencida: [${m.courseName}] ${m.title}`);
    }
  }
  for (const b of topicBacklogs) {
    reasons.push(
      `${b.courseName} / ${b.unitName}: ${b.pendingTopics} temas pendientes (examen en ${b.daysLeft}d)`,
    );
  }
  for (const e of examCrises) {
    reasons.push(
      `CRISIS: ${e.courseName} — ${e.unitName} en ${e.daysLeft}d · prep. guerra ${e.prepWarPct}%`,
    );
  }
  if (escalationLevel >= 2) reasons.push(`Escalación de condena nivel ${escalationLevel}`);

  return {
    zeroStudyToday,
    dailyGoalMet,
    underworldDays: uw,
    daysWithoutOpeningApp,
    overdueMissions,
    legendaryOverdue,
    missionDebt,
    topicBacklogs,
    topicBacklogActive,
    examCrises,
    escalationLevel,
    reasons,
  };
}

/** ¿Enviar correo en este slot? */
export function shouldSendHadesEmailSlot(
  slot: HadesEmailSlot,
  triggers: HadesTriggerState,
): boolean {
  const {
    zeroStudyToday,
    dailyGoalMet,
    underworldDays,
    daysWithoutOpeningApp,
    missionDebt,
    topicBacklogActive,
    examCrises,
  } = triggers;

  if (slot === 'fiveAm') {
    return true;
  }

  if (slot === 'elevenPm') {
    return true;
  }

  if (slot === 'sixPm') {
    return zeroStudyToday || examCrises.length > 0;
  }

  if (slot === 'ninePm') {
    return !dailyGoalMet;
  }

  if (slot === 'evening') {
    return (
      underworldDays >= 1 ||
      daysWithoutOpeningApp >= 1 ||
      missionDebt ||
      topicBacklogActive ||
      examCrises.length > 0 ||
      zeroStudyToday ||
      !dailyGoalMet
    );
  }

  if (slot === 'inactivity6h') {
    return true;
  }

  return false;
}

export function slotLabel(slot: HadesEmailSlot): string {
  switch (slot) {
    case 'fiveAm':
      return '05:00 Planificación';
    case 'sixPm':
      return '18:00';
    case 'ninePm':
      return '21:00';
    case 'evening':
      return '22:00';
    case 'elevenPm':
      return '23:00 Balance del día';
    case 'inactivity6h':
      return 'Inactividad 6h';
  }
}
