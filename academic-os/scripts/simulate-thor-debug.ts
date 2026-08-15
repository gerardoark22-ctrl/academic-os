/**
 * Simulación THOR/KRATOS — tarjetas, sync misiones, progreso.
 * Ejecutar: npx tsx scripts/simulate-thor-debug.ts
 */
import { buildNewCourse, isCourseFresh } from '../src/utils/courseFactory';
import { generateId } from '../src/utils/gamification';
import { migratePriority } from '../src/utils/priorityMigrate';
import {
  kratosHasTopics,
  computeThorProgress,
  thorTaskStats,
  DEFAULT_THOR_TASK_TYPES,
  courseModeBadgeLabel,
  courseCardSectionVisibility,
  courseMatchesModeFilter,
  kratosTopicStats,
  formatExamDaysLabel,
  nearestExamUnit,
  filterThorTasks,
  thorTasksForSection,
  visibleThorSectionKeys,
} from '../src/utils/thorCourse';
import type { Course, Mission } from '../src/types';

let ok = 0;
let fail = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    ok++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.log(`  ✗ ${msg}`);
  }
}

console.log('\n=== 1. Prioridades migradas ===');
assert(migratePriority('legendary') === 'odisea', 'legendary → odisea');
assert(migratePriority('epic') === 'epica', 'epic → epica');
assert(migratePriority('common') === 'chiste', 'common → chiste');

console.log('\n=== 2. KRATOS — barra de progreso en card ===');
{
  const emptyTopics: Course = {
    id: 'c1',
    name: 'Vacío',
    icon: '📚',
    mode: 'kratos',
    units: [{ id: 'u1', name: 'U1', topics: [], progress: 0, tasks: [] }],
    progress: 0,
    templeLevel: 0,
    thorSections: [],
    thorTasks: [],
    thorTaskTypes: DEFAULT_THOR_TASK_TYPES,
  };
  const noUnits: Course = { ...emptyTopics, units: [] };
  const withTopics: Course = {
    ...emptyTopics,
    units: [{
      id: 'u1',
      name: 'U1',
      progress: 50,
      tasks: [],
      topics: [{ id: 't1', name: 'T1', domainLevel: 0, studyTime: 0, lastStudied: null, subtopics: [] }],
    }],
  };
  assert(!kratosHasTopics(emptyTopics), 'Unidad sin temas → sin barra');
  assert(!kratosHasTopics(noUnits), 'Sin unidades → sin barra');
  assert(kratosHasTopics(withTopics), 'Con temas → mostrar barra');
}

console.log('\n=== 3. THOR — progreso y stats ===');
{
  const course: Course = {
    id: 'c2',
    name: 'THOR',
    icon: '⚡',
    mode: 'thor',
    units: [],
    progress: 0,
    templeLevel: 0,
    thorSections: [{ id: 's1', name: 'Parcial', order: 0 }],
    thorTaskTypes: DEFAULT_THOR_TASK_TYPES,
    thorXpEarned: 200,
    thorTasks: [
      {
        id: 't1',
        missionId: 'm1',
        title: 'A',
        priority: 'epica',
        complexity: 'medium',
        taskTypeId: DEFAULT_THOR_TASK_TYPES[0].id,
        sectionId: 's1',
        subtasks: [],
        completed: true,
        xpEarned: 200,
        createdAt: new Date().toISOString(),
      },
      {
        id: 't2',
        missionId: 'm2',
        title: 'B',
        priority: 'chiste',
        complexity: 'light',
        taskTypeId: DEFAULT_THOR_TASK_TYPES[0].id,
        subtasks: [],
        completed: false,
        createdAt: new Date().toISOString(),
      },
    ],
  };
  const prog = computeThorProgress(course);
  assert(prog.percent === 50, `50% con 1/2 tareas (${prog.percent})`);
  const withSubtasks: Course = {
    ...course,
    thorTasks: [{
      id: 't3',
      missionId: 'm3',
      title: 'Checklist',
      priority: 'chiste',
      complexity: 'light',
      taskTypeId: DEFAULT_THOR_TASK_TYPES[0].id,
      subtasks: [
        { id: 's1', title: 'a', completed: true },
        { id: 's2', title: 'b', completed: false },
      ],
      completed: false,
      createdAt: new Date().toISOString(),
    }],
  };
  const subProg = computeThorProgress(withSubtasks);
  assert(subProg.percent === 50 && subProg.total === 2, `Subtareas en progreso (${subProg.percent}%, ${subProg.total} u)`);
  const stats = thorTaskStats(course);
  assert(stats.pending === 1, `1 pendiente (${stats.pending})`);
  assert(stats.xpEarned === 200, `200 XP thor (${stats.xpEarned})`);
}

console.log('\n=== 4. Sync misión ↔ THOR (modelo) ===');
{
  const taskId = generateId();
  const missionId = generateId();
  const mission: Mission = {
    id: missionId,
    title: 'Entrega',
    type: 'task',
    courseId: 'c2',
    courseName: 'THOR',
    priority: 'epica',
    complexity: 'medium',
    xpReward: 200,
    completed: false,
    source: 'thor',
    thorTaskId: taskId,
  };
  assert(mission.source === 'thor', 'Misión marcada como thor');
  assert(mission.thorTaskId === taskId, 'thorTaskId enlazado');
  const completed = { ...mission, completed: true };
  assert(completed.completed && completed.xpReward > 0, 'Completar otorga XP');
}

console.log('\n=== 5. Mundos separados KRATOS + THOR ===');
{
  const dual: Course = {
    id: 'c3',
    name: 'Dual',
    icon: '🏛️',
    mode: 'kratos',
    units: [{
      id: 'u1',
      name: 'U1',
      progress: 0,
      tasks: [],
      topics: [{ id: 't1', name: 'Tema K', domainLevel: 0, studyTime: 0, lastStudied: null, subtopics: [] }],
    }],
    progress: 10,
    templeLevel: 1,
    thorTasks: [{
      id: 'tt1',
      missionId: 'mm1',
      title: 'Tarea T',
      priority: 'chiste',
      complexity: 'light',
      taskTypeId: DEFAULT_THOR_TASK_TYPES[0].id,
      subtasks: [],
      completed: false,
      createdAt: new Date().toISOString(),
    }],
    thorSections: [],
    thorTaskTypes: DEFAULT_THOR_TASK_TYPES,
  };
  assert(kratosHasTopics(dual), 'KRATOS tiene temas');
  assert((dual.thorTasks?.length ?? 0) === 1, 'THOR conserva tarea paralela');
}

console.log('\n=== 6. Card biblioteca — badge dual y visibilidad ===');
{
  const dual: Course = {
    id: 'c4',
    name: 'Dual',
    icon: '🏛️',
    mode: 'thor',
    units: [{
      id: 'u1',
      name: 'U1',
      progress: 0,
      tasks: [],
      topics: [{ id: 't1', name: 'T', domainLevel: 0, studyTime: 0, lastStudied: null, completed: true, subtopics: [] }],
    }],
    progress: 50,
    templeLevel: 1,
    thorTasks: [{
      id: 'tt1',
      missionId: 'mm1',
      title: 'T',
      priority: 'chiste',
      complexity: 'light',
      taskTypeId: DEFAULT_THOR_TASK_TYPES[0].id,
      subtasks: [],
      completed: false,
      createdAt: new Date().toISOString(),
    }],
    thorSections: [],
    thorTaskTypes: DEFAULT_THOR_TASK_TYPES,
  };
  assert(courseModeBadgeLabel(dual) === '⚔ KRATOS · ⚡ THOR', 'Badge dual');
  const vis = courseCardSectionVisibility(dual);
  assert(vis.showKratosBar && vis.showKratosSection && vis.showThorSection, 'Secciones KRATOS+THOR visibles');
  assert(courseMatchesModeFilter(dual, 'kratos') && courseMatchesModeFilter(dual, 'thor'), 'Curso dual en ambos filtros');

  const kratosOnly: Course = { ...dual, mode: 'kratos', thorTasks: [] };
  assert(courseModeBadgeLabel(kratosOnly) === '⚔ KRATOS', 'Solo KRATOS');
  assert(kratosTopicStats(kratosOnly).doneTopics === 1, 'Temas hechos = solo checkbox completed');

  const domainInflate: Course = {
    ...kratosOnly,
    units: [{
      ...kratosOnly.units[0],
      topics: [
        { id: 't1', name: 'Done', domainLevel: 0, studyTime: 0, lastStudied: null, completed: true, subtopics: [] },
        { id: 't2', name: 'Alto', domainLevel: 80, studyTime: 0, lastStudied: null, subtopics: [] },
      ],
    }],
  };
  assert(kratosTopicStats(domainInflate).doneTopics === 1, 'domainLevel alto sin completed no cuenta');

  const examUnit = nearestExamUnit({
    ...kratosOnly,
    units: [{ ...kratosOnly.units[0], examDate: '2099-12-31' }],
  });
  assert(formatExamDaysLabel(examUnit?.examDate) !== '—', 'Etiqueta de examen formateada');
}

console.log('\n=== 7. Secciones THOR — filtro y bandeja ===');
{
  const course: Course = {
    id: 'c5',
    name: 'Sec',
    icon: '📂',
    mode: 'thor',
    units: [],
    progress: 0,
    templeLevel: 0,
    thorSections: [{ id: 's1', name: 'Parcial 1', order: 0 }],
    thorTaskTypes: DEFAULT_THOR_TASK_TYPES,
    thorTasks: [
      {
        id: 't-inbox',
        missionId: 'm-inbox',
        title: 'Bandeja',
        priority: 'epica',
        complexity: 'medium',
        taskTypeId: DEFAULT_THOR_TASK_TYPES[0].id,
        subtasks: [],
        completed: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 't-sec',
        missionId: 'm-sec',
        title: 'En sección',
        priority: 'chiste',
        complexity: 'light',
        taskTypeId: DEFAULT_THOR_TASK_TYPES[0].id,
        sectionId: 's1',
        subtasks: [],
        completed: false,
        createdAt: new Date().toISOString(),
      },
    ],
  };
  const inbox = thorTasksForSection(course, null);
  const inSection = thorTasksForSection(course, 's1');
  assert(inbox.length === 1 && inbox[0].id === 't-inbox', 'Bandeja sin sectionId');
  assert(inSection.length === 1 && inSection[0].id === 't-sec', 'Tarea en sección s1');

  const onlyInbox = filterThorTasks(
    [...inbox, ...inSection],
    { sectionId: '', sectionFilterAll: false },
  );
  assert(onlyInbox.length === 1 && onlyInbox[0].id === 't-inbox', 'Filtro bandeja');

  const onlySection = filterThorTasks(
    [...inbox, ...inSection],
    { sectionId: 's1', sectionFilterAll: false },
  );
  assert(onlySection.length === 1 && onlySection[0].id === 't-sec', 'Filtro sección');

  const keys = visibleThorSectionKeys(course.thorSections ?? [], '');
  assert(keys.length === 2 && keys[0] === null, 'Vista lista: bandeja + secciones');
  assert(visibleThorSectionKeys(course.thorSections ?? [], 's1').length === 1, 'Filtro una sección');
}

console.log('\n=== 8. Crear curso — defaults THOR + fresh ===');
{
  const c = buildNewCourse({ name: 'Nuevo', icon: '📚', mode: 'thor' });
  assert(!!c.thorTaskTypes?.length, 'thorTaskTypes por defecto');
  assert(c.thorSections?.length === 0, 'sin secciones al crear');
  assert(isCourseFresh(c), 'curso nuevo = fresh');
  const withUnit = buildNewCourse({
    name: 'K',
    icon: '⚔',
    units: [{ id: 'u1', name: 'U1', topics: [], progress: 0, tasks: [] }],
  });
  assert(!isCourseFresh(withUnit), 'con unidad ya no es fresh');
}

console.log(`\n--- Resultado: ${ok} OK, ${fail} FAIL ---\n`);
process.exit(fail > 0 ? 1 : 0);
