import type { Course, Mission, ThorSection, ThorTask, ThorTaskType } from '../types';
import { daysUntil } from './gamification';
import { isHighPriority } from './priorityMigrate';
import type { EisenhowerQuadrant } from './missionMatrix';

export const DEFAULT_THOR_TASK_TYPES: ThorTaskType[] = [
  { id: 'thor-type-task', name: 'Tarea', icon: '📋' },
  { id: 'thor-type-exam', name: 'Examen', icon: '📝' },
  { id: 'thor-type-reading', name: 'Lectura', icon: '📖' },
  { id: 'thor-type-delivery', name: 'Entrega', icon: '📦' },
  { id: 'thor-type-practice', name: 'Práctica', icon: '⚔️' },
];

export function ensureThorDefaults(course: Course): Course {
  const taskTypes = course.thorTaskTypes?.length ? course.thorTaskTypes : DEFAULT_THOR_TASK_TYPES;
  return {
    ...course,
    thorSections: course.thorSections ?? [],
    thorTasks: course.thorTasks ?? [],
    thorTaskTypes: taskTypes,
    thorXpEarned: course.thorXpEarned ?? 0,
  };
}

export function kratosHasTopics(course: Course): boolean {
  return course.units.some((u) => u.topics.length > 0);
}

export function kratosTopicStats(course: Course) {
  const totalTopics = course.units.reduce((s, u) => s + u.topics.length, 0);
  const doneTopics = course.units.reduce(
    (s, u) => s + u.topics.filter((t) => t.completed).length,
    0,
  );
  const studyMin = course.units.reduce(
    (s, u) => s + u.topics.reduce((ts, t) => ts + (t.studyTime ?? 0), 0),
    0,
  );
  const unitsWithExam = course.units.filter((u) => u.examDate).length;
  return { totalUnits: course.units.length, totalTopics, doneTopics, studyMin, unitsWithExam };
}

export function activeThorTasks(course: Course): ThorTask[] {
  return (course.thorTasks ?? []).filter((t) => !t.completed && !t.parentTaskId);
}

export function courseHasThorTasks(course: Course): boolean {
  return (course.thorTasks?.length ?? 0) > 0;
}

export function courseDualSummary(course: Course) {
  const k = kratosTopicStats(course);
  const t = thorTaskStats(course);
  const hasKratos = kratosHasTopics(course);
  const hasThor = courseHasThorTasks(course);
  return { hasKratos, hasThor, kratosPendingTopics: k.totalTopics - k.doneTopics, thorPending: t.pending };
}

export function nearestExamUnit(course: Course) {
  return course.units.filter((u) => u.examDate).sort((a, b) => a.examDate!.localeCompare(b.examDate!))[0];
}

export function formatExamDaysLabel(examDate?: string): string {
  if (!examDate) return '—';
  const d = daysUntil(examDate);
  if (d < 0) return `+${Math.abs(d)}d`;
  if (d === 0) return 'HOY';
  return `${d}d`;
}

/** Badge del card — dual si hay temario y tareas THOR */
export function courseModeBadgeLabel(course: Course): string {
  const hasKratos = kratosHasTopics(course);
  const hasThor = courseHasThorTasks(course);
  if (hasKratos && hasThor) return '⚔ KRATOS · ⚡ THOR';
  if (hasThor) return '⚡ THOR';
  if (hasKratos) return '⚔ KRATOS';
  const mode = course.mode ?? 'kratos';
  return mode === 'thor' ? '⚡ THOR' : '⚔ KRATOS';
}

export function courseCardSectionVisibility(course: Course) {
  const mode = course.mode ?? 'kratos';
  const hasKratosContent = kratosHasTopics(course);
  const hasThorContent = courseHasThorTasks(course);
  return {
    showKratosBar: hasKratosContent,
    showKratosSection: hasKratosContent || mode === 'kratos',
    showThorSection: hasThorContent || mode === 'thor',
    hasKratosContent,
    hasThorContent,
  };
}

export function courseMatchesModeFilter(course: Course, filter: 'all' | 'kratos' | 'thor'): boolean {
  if (filter === 'all') return true;
  if (filter === 'kratos') {
    return kratosHasTopics(course) || (course.mode ?? 'kratos') === 'kratos';
  }
  return courseHasThorTasks(course) || (course.mode ?? 'kratos') === 'thor';
}

export function thorProgressUnits(course: Course): { total: number; completed: number; percent: number } {
  let total = 0;
  let completed = 0;
  for (const t of course.thorTasks ?? []) {
    if (t.subtasks.length > 0) {
      total += t.subtasks.length;
      completed += t.subtasks.filter((s) => s.completed).length;
    } else {
      total += 1;
      completed += t.completed ? 1 : 0;
    }
  }
  return {
    total,
    completed,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export function computeThorProgress(course: Course): { percent: number; completed: number; total: number } {
  const { total, completed, percent } = thorProgressUnits(course);
  return { percent, completed, total };
}

export function thorTaskStats(course: Course) {
  const tasks = course.thorTasks ?? [];
  const active = tasks.filter((t) => !t.completed);
  const topLevel = tasks.filter((t) => !t.parentTaskId);
  const topActive = topLevel.filter((t) => !t.completed);
  const overdue = active.filter((t) => t.dueDate && daysUntil(t.dueDate) < 0);
  const progress = computeThorProgress(course);
  return {
    pending: topActive.length,
    overdue: overdue.length,
    progressPercent: progress.percent,
    progressUnits: progress.total,
    xpEarned: course.thorXpEarned ?? 0,
    total: topLevel.length,
    completed: topLevel.filter((t) => t.completed).length,
  };
}

export function nextThorTaskWithDueDate(course: Course): ThorTask | undefined {
  const pending = (course.thorTasks ?? []).filter((t) => !t.completed && t.dueDate);
  return sortThorTasks(pending)[0];
}

export function upcomingThorTasks(course: Course, limit = 3): ThorTask[] {
  return sortThorTasks(
    (course.thorTasks ?? []).filter((t) => !t.completed && !t.parentTaskId),
  ).slice(0, limit);
}

export function courseUrgencyCount(course: Course, missions: Mission[]): number {
  let count = missions.filter(
    (m) => !m.completed && m.courseId === course.id && m.dueDate && daysUntil(m.dueDate) <= 3,
  ).length;
  if (kratosHasTopics(course)) {
    count += course.units.filter((u) => u.examDate && daysUntil(u.examDate) <= 7).length;
  }
  return count;
}

export function thorTaskTypeLabel(course: Course, typeId: string): string {
  const t = (course.thorTaskTypes ?? DEFAULT_THOR_TASK_TYPES).find((x) => x.id === typeId);
  return t ? `${t.icon} ${t.name}` : typeId;
}

export function missionTypeFromThorType(typeId: string): import('../types').MissionType {
  if (typeId.includes('exam')) return 'exam';
  if (typeId.includes('reading')) return 'reading';
  return 'task';
}

export function sortThorTasks(tasks: ThorTask[]): ThorTask[] {
  return [...tasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return a.createdAt.localeCompare(b.createdAt);
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    const d = a.dueDate.localeCompare(b.dueDate);
    return d !== 0 ? d : a.createdAt.localeCompare(b.createdAt);
  });
}

export function thorTaskFullyComplete(task: ThorTask): boolean {
  if (task.subtasks.length > 0) return task.subtasks.every((s) => s.completed);
  return task.completed;
}

export function classifyThorTask(task: ThorTask): EisenhowerQuadrant {
  const urgent = task.dueDate ? daysUntil(task.dueDate) <= 3 : false;
  const important = isHighPriority(task.priority);
  if (urgent && important) return 'do';
  if (!urgent && important) return 'schedule';
  if (urgent && !important) return 'delegate';
  return 'eliminate';
}

export function groupThorByEisenhower(tasks: ThorTask[]): Record<EisenhowerQuadrant, ThorTask[]> {
  const groups: Record<EisenhowerQuadrant, ThorTask[]> = {
    do: [],
    schedule: [],
    delegate: [],
    eliminate: [],
  };
  for (const t of tasks.filter((x) => !x.completed && !x.parentTaskId)) {
    groups[classifyThorTask(t)].push(t);
  }
  return groups;
}

export function thorTasksForSection(course: Course, sectionId: string | null): ThorTask[] {
  const tasks = (course.thorTasks ?? []).filter((t) => !t.completed && !t.parentTaskId);
  const filtered = sectionId === null
    ? tasks.filter((t) => !t.sectionId)
    : tasks.filter((t) => t.sectionId === sectionId);
  return sortThorTasks(filtered);
}

export function childThorTasks(course: Course, parentId: string): ThorTask[] {
  return sortThorTasks((course.thorTasks ?? []).filter((t) => t.parentTaskId === parentId && !t.completed));
}

export function findThorTask(course: Course, taskId: string): ThorTask | undefined {
  return (course.thorTasks ?? []).find((t) => t.id === taskId);
}

export function findThorTaskByMission(course: Course, missionId: string): ThorTask | undefined {
  return (course.thorTasks ?? []).find((t) => t.missionId === missionId);
}

export function sortedThorSections(sections: ThorSection[]): ThorSection[] {
  return [...sections].sort((a, b) => a.order - b.order);
}

export function filterThorTasks(
  tasks: ThorTask[],
  opts: {
    priority?: string;
    typeId?: string;
    overdueOnly?: boolean;
    /** '' = solo bandeja (sin sección); id = sección concreta; omitir = todas */
    sectionId?: string;
    sectionFilterAll?: boolean;
  },
): ThorTask[] {
  return tasks.filter((t) => {
    if (opts.priority && t.priority !== opts.priority) return false;
    if (opts.typeId && t.taskTypeId !== opts.typeId) return false;
    if (opts.overdueOnly && (!t.dueDate || daysUntil(t.dueDate) >= 0)) return false;
    if (!opts.sectionFilterAll && opts.sectionId !== undefined) {
      if ((t.sectionId ?? '') !== opts.sectionId) return false;
    }
    return true;
  });
}

export function thorSectionLabel(course: Course, sectionId?: string): string {
  if (!sectionId) return '⚡ Bandeja';
  return course.thorSections?.find((s) => s.id === sectionId)?.name ?? 'Sección';
}

/** Claves de sección visibles según filtro UI: null = bandeja */
export function visibleThorSectionKeys(
  sections: ThorSection[],
  filterSection: string,
): Array<string | null> {
  if (filterSection === '__inbox__') return [null];
  if (filterSection) return [filterSection];
  return [null, ...sections.map((s) => s.id)];
}

export function thorMissionsForCourse(missions: Mission[], courseId: string): Mission[] {
  return missions.filter((m) => m.courseId === courseId && m.source === 'thor');
}
