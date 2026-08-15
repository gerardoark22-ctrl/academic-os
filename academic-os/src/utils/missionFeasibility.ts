import type { Course, Mission, TimeBlock, Topic } from '../types';

/** Tema pendiente — solo el checkbox cuenta (no domainLevel). */
export function isTopicActionable(topic: Topic): boolean {
  return !topic.completed;
}

export function courseHasOpenTopics(course: Course): boolean {
  return course.units.some((u) => u.topics.some(isTopicActionable));
}

export function collectActionableTopics(
  courses: Course[],
): Array<{ course: Course; unitId: string; topic: Topic }> {
  const out: Array<{ course: Course; unitId: string; topic: Topic }> = [];
  for (const course of courses) {
    for (const unit of course.units) {
      for (const topic of unit.topics) {
        if (!isTopicActionable(topic)) continue;
        out.push({ course, unitId: unit.id, topic });
      }
    }
  }
  return out;
}

export function courseHasStudyBlocksToday(courseId: string, todayBlocks: TimeBlock[]): boolean {
  return todayBlocks.some(
    (b) => b.courseId === courseId && b.title && b.type !== 'rest' && !b.completed,
  );
}

/** Curso con temas pendientes o bloques de estudio hoy sin completar. */
export function isCourseStudyMissionFeasible(course: Course, todayBlocks: TimeBlock[]): boolean {
  return courseHasOpenTopics(course) || courseHasStudyBlocksToday(course.id, todayBlocks);
}

export function isMissionBoardQuestFeasible(m: Mission): boolean {
  return !m.completed;
}
