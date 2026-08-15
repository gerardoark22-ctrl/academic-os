import type { Course, CourseMode, Unit } from '../types';
import {
  calculateCourseProgress,
  calculateUnitProgress,
  generateId,
  getTempleLevel,
} from './gamification';
import { getCourseColor } from './courseColors';
import { normalizeCourse } from './courseNormalize';
import { ensureThorDefaults } from './thorCourse';

/** Normaliza, defaults THOR y recalcula progreso — usar al crear o cargar cursos */
export function finalizeCourse(course: Course): Course {
  const normalized = ensureThorDefaults(normalizeCourse(course));
  const units = normalized.units.map((unit) => ({
    ...unit,
    tasks: unit.tasks ?? [],
    topics: unit.topics.map((t) => ({
      ...t,
      subtopics: t.subtopics ?? [],
      completed: t.completed ?? false,
    })),
    progress: calculateUnitProgress(unit.topics),
  }));
  const progress = calculateCourseProgress(units);
  return {
    ...normalized,
    units,
    progress,
    templeLevel: getTempleLevel(progress),
    color: normalized.color ?? getCourseColor(normalized.id),
  };
}

export function buildNewCourse(params: {
  name: string;
  icon: string;
  color?: string;
  mode?: CourseMode;
  units?: Unit[];
}): Course {
  const id = generateId();
  return finalizeCourse({
    id,
    name: params.name.trim(),
    icon: params.icon,
    color: params.color ?? getCourseColor(id),
    mode: params.mode ?? 'kratos',
    units: params.units ?? [],
    progress: 0,
    templeLevel: 0,
  });
}

export function isCourseFresh(course: Course): boolean {
  const hasUnits = course.units.length > 0;
  const hasThor = (course.thorTasks?.length ?? 0) > 0;
  return !hasUnits && !hasThor;
}
