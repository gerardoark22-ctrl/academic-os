import type { Course, Mission } from '../types';

/** Título completo para bloques del horario: Curso · Unidad · Tema (contrato del día). */
export function formatBlockContractTitle(opts: {
  courseName: string;
  unitName?: string;
  topicName?: string;
  subtopicName?: string;
  /** Misión/tarea cuando no hay tema (modo Thor). */
  missionTitle?: string;
}): string {
  const parts: string[] = [];

  const course = opts.courseName?.trim();
  if (course) parts.push(course);

  const unit = opts.unitName?.trim();
  if (unit) parts.push(unit);

  const topic = opts.topicName?.trim();
  if (topic) parts.push(topic);

  const sub = opts.subtopicName?.trim();
  if (sub) parts.push(sub);

  if (!topic && opts.missionTitle?.trim()) {
    parts.push(opts.missionTitle.trim());
  }

  return parts.join(' · ');
}

export function blockTitleForMission(mission: Mission, courses: Course[]): string {
  const course = courses.find((c) => c.id === mission.courseId);
  const unit = course?.units.find((u) => u.id === mission.unitId);
  return formatBlockContractTitle({
    courseName: course?.name ?? mission.courseName,
    unitName: unit?.name,
    missionTitle: mission.title,
  });
}

export function resolveBlockContractTitle(
  courses: Course[],
  missions: Mission[],
  fallbackTitle: string,
  payload: {
    courseId?: string;
    unitId?: string;
    topicId?: string;
    subtopicId?: string;
    missionId?: string;
  },
): string {
  const course = payload.courseId ? courses.find((c) => c.id === payload.courseId) : undefined;
  if (!course) return fallbackTitle;

  const unit = payload.unitId ? course.units.find((u) => u.id === payload.unitId) : undefined;

  if (payload.topicId && unit) {
    const topic = unit.topics.find((t) => t.id === payload.topicId);
    if (topic) {
      const sub = payload.subtopicId
        ? topic.subtopics?.find((s) => s.id === payload.subtopicId)
        : undefined;
      return formatBlockContractTitle({
        courseName: course.name,
        unitName: unit.name,
        topicName: topic.name,
        subtopicName: sub?.name,
      });
    }
  }

  if (payload.missionId) {
    const mission = missions.find((m) => m.id === payload.missionId);
    if (mission) return blockTitleForMission(mission, courses);
  }

  if (unit) {
    return formatBlockContractTitle({
      courseName: course.name,
      unitName: unit.name,
      missionTitle: fallbackTitle.includes('·') ? undefined : fallbackTitle,
    });
  }

  return fallbackTitle;
}
