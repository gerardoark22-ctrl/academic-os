import type { Course } from '../types';
import { daysUntil } from './gamification';
import { getCourseColor } from './courseColors';

export interface CourseExamAlert {
  courseId: string;
  courseName: string;
  courseIcon: string;
  courseColor: string;
  unitId: string;
  unitName: string;
  examDate: string;
  daysLeft: number;
  courseProgress: number;
  unitProgress: number;
  /** ≤7 días o vencido reciente — animación intensa */
  isCritical: boolean;
}

const EXAM_MODE_MAX_DAYS = 7;
/** Horizonte máximo en el radar del Ágora (días futuros) */
const EXAM_DASHBOARD_MAX_FUTURE_DAYS = 365;
/** Exámenes vencidos recientes aún visibles en el radar */
const EXAM_DASHBOARD_MAX_OVERDUE_DAYS = 21;

export function isExamWarCritical(daysLeft: number): boolean {
  return daysLeft <= EXAM_MODE_MAX_DAYS;
}

/** Todas las unidades con fecha de examen para el radar del Ágora */
export function getExamModeAlerts(courses: Course[]): CourseExamAlert[] {
  const alerts: CourseExamAlert[] = [];

  for (const course of courses) {
    const color = getCourseColor(course.id, course.color);
    for (const unit of course.units) {
      if (!unit.examDate?.trim()) continue;
      const daysLeft = daysUntil(unit.examDate);
      if (daysLeft < -EXAM_DASHBOARD_MAX_OVERDUE_DAYS) continue;
      if (daysLeft > EXAM_DASHBOARD_MAX_FUTURE_DAYS) continue;

      alerts.push({
        courseId: course.id,
        courseName: course.name,
        courseIcon: course.icon,
        courseColor: color,
        unitId: unit.id,
        unitName: unit.name,
        examDate: unit.examDate,
        daysLeft,
        courseProgress: course.progress,
        unitProgress: unit.progress,
        isCritical: isExamWarCritical(daysLeft),
      });
    }
  }

  return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function getNextCourseExam(courses: Course[]): CourseExamAlert | null {
  const alerts = getExamModeAlerts(courses);
  return alerts[0] ?? null;
}

/** Todas las unidades con examen futuro (para resaltar en hub) */
export function getCourseExamDates(course: Course): { unitId: string; unitName: string; examDate: string; daysLeft: number }[] {
  return course.units
    .filter((u) => u.examDate)
    .map((u) => ({
      unitId: u.id,
      unitName: u.name,
      examDate: u.examDate!,
      daysLeft: daysUntil(u.examDate!),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function computeWarReadiness(courseProgress: number, unitProgress: number): number {
  return Math.round((courseProgress * 0.4 + unitProgress * 0.6));
}
