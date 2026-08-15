import type { Topic, Unit } from '../types';
import { getCourseColor } from './courseColors';
import { ensureThorDefaults } from './thorCourse';

/** Normaliza cursos legacy sin subtopics/tasks */
export function normalizeCourse(c: import('../types').Course): import('../types').Course {
  return ensureThorDefaults({
    ...c,
    color: c.color ?? getCourseColor(c.id),
    mode: c.mode ?? 'kratos',
    units: (c.units ?? []).map((u: Unit) => ({
      ...u,
      tasks: u.tasks ?? [],
      topics: (u.topics ?? []).map((t: Topic) => ({
        ...t,
        subtopics: t.subtopics ?? [],
        completed: t.completed ?? false,
      })),
    })),
  });
}
