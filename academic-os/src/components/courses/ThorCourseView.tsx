import { useMemo, useState, useEffect } from 'react';
import { useCoursesStore } from '../../stores/coursesStore';
import { EpicButton, EpicModal } from '../ui';
import { EpicWarCheckbox } from '../ui/EpicWarCheckbox';
import {
  childThorTasks,
  computeThorProgress,
  filterThorTasks,
  groupThorByEisenhower,
  sortThorTasks,
  sortedThorSections,
  thorSectionLabel,
  thorTaskTypeLabel,
  thorTasksForSection,
  visibleThorSectionKeys,
} from '../../utils/thorCourse';
import { EISENHOWER_META, type EisenhowerQuadrant } from '../../utils/missionMatrix';
import { getMissionXpReward, MISSION_PRIORITY_LABEL, MISSION_COMPLEXITY_LABEL, daysUntil } from '../../utils/gamification';
import type { Course, MissionComplexity, MissionPriority, ThorSection, ThorTask } from '../../types';

type ThorView = 'list' | 'calendar' | 'eisenhower';

interface ThorCourseViewProps {
  course: Course;
  color: string;
  onExport: (task: ThorTask) => void;
  createSignal?: number;
}

const PRIORITIES: MissionPriority[] = ['odisea', 'epica', 'chiste'];
const QUADRANTS: EisenhowerQuadrant[] = ['do', 'schedule', 'delegate', 'eliminate'];

export function ThorCourseView({ course, color, onExport, createSignal = 0 }: ThorCourseViewProps) {
  const addThorTask = useCoursesStore((s) => s.addThorTask);
  const updateThorTask = useCoursesStore((s) => s.updateThorTask);
  const deleteThorTask = useCoursesStore((s) => s.deleteThorTask);
  const toggleThorTask = useCoursesStore((s) => s.toggleThorTask);
  const addThorSubtask = useCoursesStore((s) => s.addThorSubtask);
  const toggleThorSubtask = useCoursesStore((s) => s.toggleThorSubtask);
  const deleteThorSubtask = useCoursesStore((s) => s.deleteThorSubtask);
  const addThorSection = useCoursesStore((s) => s.addThorSection);
  const updateThorSection = useCoursesStore((s) => s.updateThorSection);
  const deleteThorSection = useCoursesStore((s) => s.deleteThorSection);
  const addThorTaskType = useCoursesStore((s) => s.addThorTaskType);

  const [view, setView] = useState<ThorView>('list');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [taskForm, setTaskForm] = useState({
    open: false,
    editId: '',
    title: '',
    priority: 'epica' as MissionPriority,
    complexity: 'medium' as MissionComplexity,
    taskTypeId: course.thorTaskTypes?.[0]?.id ?? '',
    dueDate: '',
    estimateBlocks: 2,
    sectionId: '',
    parentTaskId: '',
  });
  const [sectionForm, setSectionForm] = useState({ open: false, name: '', editId: '' });
  const [typeForm, setTypeForm] = useState({ open: false, name: '', icon: '📌' });
  const [subForm, setSubForm] = useState({ open: false, taskId: '', title: '' });

  const openCreate = (parentTaskId = '', sectionId = '') => {
    setTaskForm({
      open: true,
      editId: '',
      title: '',
      priority: 'epica',
      complexity: 'medium',
      taskTypeId: course.thorTaskTypes?.[0]?.id ?? '',
      dueDate: '',
      estimateBlocks: 2,
      sectionId,
      parentTaskId,
    });
  };

  useEffect(() => {
    if (createSignal > 0) openCreate();
  }, [createSignal]);

  const progress = computeThorProgress(course);
  const sections = sortedThorSections(course.thorSections ?? []);
  const activeTasks = useMemo(
    () => sortThorTasks((course.thorTasks ?? []).filter((t) => !t.completed && !t.parentTaskId)),
    [course.thorTasks],
  );

  const taskFilterOpts = useMemo(() => {
    const opts: { priority?: string; sectionId?: string; sectionFilterAll?: boolean } = {
      priority: filterPriority || undefined,
      sectionFilterAll: !filterSection,
    };
    if (filterSection === '__inbox__') opts.sectionId = '';
    else if (filterSection) opts.sectionId = filterSection;
    return opts;
  }, [filterPriority, filterSection]);

  const filteredTasks = useMemo(
    () => filterThorTasks(activeTasks, taskFilterOpts),
    [activeTasks, taskFilterOpts],
  );

  const openEdit = (task: ThorTask) => {
    setTaskForm({
      open: true,
      editId: task.id,
      title: task.title,
      priority: task.priority,
      complexity: task.complexity,
      taskTypeId: task.taskTypeId,
      dueDate: task.dueDate ?? '',
      estimateBlocks: task.estimateBlocks ?? 2,
      sectionId: task.sectionId ?? '',
      parentTaskId: task.parentTaskId ?? '',
    });
  };

  const openSectionEdit = (section: ThorSection) => {
    setSectionForm({ open: true, name: section.name, editId: section.id });
  };

  const saveTask = async () => {
    if (!taskForm.title.trim()) return;
    const sectionId = taskForm.sectionId || undefined;
    if (taskForm.editId) {
      await updateThorTask(course.id, taskForm.editId, {
        title: taskForm.title.trim(),
        priority: taskForm.priority,
        complexity: taskForm.complexity,
        taskTypeId: taskForm.taskTypeId,
        dueDate: taskForm.dueDate || undefined,
        estimateBlocks: taskForm.estimateBlocks,
        sectionId,
      });
    } else {
      await addThorTask(course.id, {
        title: taskForm.title.trim(),
        priority: taskForm.priority,
        complexity: taskForm.complexity,
        taskTypeId: taskForm.taskTypeId,
        dueDate: taskForm.dueDate || undefined,
        estimateBlocks: taskForm.estimateBlocks,
        sectionId,
        parentTaskId: taskForm.parentTaskId || undefined,
      });
    }
    setTaskForm((f) => ({ ...f, open: false }));
  };

  const saveSection = async () => {
    if (!sectionForm.name.trim()) return;
    if (sectionForm.editId) {
      await updateThorSection(course.id, sectionForm.editId, sectionForm.name);
    } else {
      await addThorSection(course.id, sectionForm.name);
    }
    setSectionForm({ open: false, name: '', editId: '' });
  };

  const renderTaskRow = (task: ThorTask, depth = 0) => {
    const children = childThorTasks(course, task.id);
    const xp = getMissionXpReward(task.priority, task.complexity);
    const overdue = task.dueDate && daysUntil(task.dueDate) < 0;
    const sectionName = task.sectionId ? thorSectionLabel(course, task.sectionId) : null;
    return (
      <div key={task.id} style={{ marginLeft: depth * 12 }}>
        <div className="topic-row-war mt-2 flex items-start gap-2 px-3 py-2">
          <EpicWarCheckbox
            checked={task.completed}
            onToggle={() => void toggleThorTask(course.id, task.id)}
            label={task.title}
          />
          <div className="min-w-0 flex-1">
            <p className="label-clear text-sm">{task.title}</p>
            <p className="text-readable-dim text-xs">
              {thorTaskTypeLabel(course, task.taskTypeId)}
              {' · '}{MISSION_PRIORITY_LABEL[task.priority]}
              {' · '}{MISSION_COMPLEXITY_LABEL[task.complexity]}
              {sectionName ? ` · ${sectionName}` : ''}
              {task.dueDate ? ` · ${task.dueDate}${overdue ? ' ⚠' : ''}` : ''}
              {task.estimateBlocks ? ` · ${task.estimateBlocks * 30}m` : ''}
              {' · '}+{xp} XP
            </p>
            {task.subtasks.map((st) => (
              <div key={st.id} className="ml-4 mt-1 flex items-center gap-2">
                <EpicWarCheckbox
                  size="sm"
                  checked={st.completed}
                  onToggle={() => void toggleThorSubtask(course.id, task.id, st.id)}
                  label={st.title}
                />
                <span className="text-xs">{st.title}</span>
                <button type="button" className="text-[10px] flavor-brutal" onClick={() => void deleteThorSubtask(course.id, task.id, st.id)}>✕</button>
              </div>
            ))}
          </div>
          <div className="flex shrink-0 flex-wrap gap-1">
            <button type="button" className="btn-icon-war text-xs" title="Horario" onClick={() => onExport(task)}>📅</button>
            <button type="button" className="btn-icon-war text-xs" onClick={() => setSubForm({ open: true, taskId: task.id, title: '' })}>+</button>
            <button type="button" className="btn-icon-war text-xs" onClick={() => openCreate(task.id, task.sectionId ?? '')}>↳</button>
            <button type="button" className="btn-icon-war text-xs" onClick={() => openEdit(task)}>✎</button>
            <button type="button" className="btn-icon-war text-xs flavor-brutal" onClick={() => void deleteThorTask(course.id, task.id)}>✕</button>
          </div>
        </div>
        {children.map((c) => renderTaskRow(c, depth + 1))}
      </div>
    );
  };

  const renderList = () => {
    const sectionKeys = visibleThorSectionKeys(sections, filterSection);
    return (
      <div className="space-y-4">
        {sectionKeys.map((sid) => {
          const section = sid ? sections.find((s) => s.id === sid) : undefined;
          const tasks = filterThorTasks(thorTasksForSection(course, sid), {
            priority: filterPriority || undefined,
          });
          const panelKey = sid ?? 'inbox';
          return (
            <div key={panelKey} className="panel-epic overflow-hidden" style={{ borderLeftColor: color, borderLeftWidth: 4 }}>
              <div className="panel-epic-inner px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="title-carved !text-sm text-highlight">
                    {section ? section.name : '⚡ Bandeja'}
                  </p>
                  <div className="flex shrink-0 items-center gap-1">
                    {section ? (
                      <>
                        <button type="button" className="btn-icon-war text-xs" onClick={() => openSectionEdit(section)}>✎</button>
                        <button
                          type="button"
                          className="btn-icon-war text-xs flavor-brutal"
                          onClick={() => {
                            if (confirm(`¿Eliminar sección "${section.name}"? Las tareas pasan a bandeja.`)) {
                              void deleteThorSection(course.id, section.id);
                            }
                          }}
                        >
                          ✕
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="btn-war btn-war-sm !px-2 !py-0.5 text-[10px]"
                      onClick={() => openCreate('', sid ?? '')}
                    >
                      + Tarea
                    </button>
                  </div>
                </div>
                {tasks.length === 0 ? (
                  <p className="body-parchment py-4 text-center text-xs opacity-70">Sin tareas pendientes</p>
                ) : (
                  tasks.map((t) => renderTaskRow(t))
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCalendar = () => {
    const byDate = new Map<string, ThorTask[]>();
    for (const t of filteredTasks) {
      const key = t.dueDate ?? 'sin-fecha';
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(t);
    }
    const keys = [...byDate.keys()].sort((a, b) => {
      if (a === 'sin-fecha') return 1;
      if (b === 'sin-fecha') return -1;
      return a.localeCompare(b);
    });
    return (
      <div className="space-y-3">
        {keys.length === 0 ? (
          <p className="body-parchment py-6 text-center text-xs opacity-70">Sin tareas con estos filtros</p>
        ) : (
          keys.map((k) => (
            <div key={k} className="panel-epic p-3">
              <p className="title-carved mb-2 !text-sm">{k === 'sin-fecha' ? 'Sin fecha' : k}</p>
              {byDate.get(k)!.map((t) => renderTaskRow(t))}
            </div>
          ))
        )}
      </div>
    );
  };

  const renderEisenhower = () => {
    const groups = groupThorByEisenhower(filteredTasks);
    return (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {QUADRANTS.map((q) => {
          const meta = EISENHOWER_META[q];
          return (
            <div key={q} className="panel-epic p-3" style={{ borderColor: meta.color }}>
              <p className="title-carved mb-2 !text-sm" style={{ color: meta.color }}>{meta.icon} {meta.label}</p>
              {groups[q].length === 0 ? (
                <p className="text-xs opacity-60">Vacío</p>
              ) : (
                groups[q].map((t) => renderTaskRow(t))
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="panel-epic p-3" style={{ borderLeft: `4px solid ${color}` }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="title-carved !text-sm text-highlight">Progreso THOR</p>
            <p className="body-parchment text-xs">
              {progress.completed}/{progress.total} tareas · {course.thorXpEarned ?? 0} XP ganado
            </p>
          </div>
          <p className="stat-epic text-2xl" style={{ color }}>{progress.percent}%</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['list', 'calendar', 'eisenhower'] as const).map((v) => (
          <button
            key={v}
            type="button"
            className={`btn-war btn-war-sm ${view === v ? 'btn-war-active' : ''}`}
            onClick={() => setView(v)}
          >
            {v === 'list' ? 'Lista' : v === 'calendar' ? 'Calendario' : 'Eisenhower'}
          </button>
        ))}
        <EpicButton size="sm" variant="ghost" onClick={() => setSectionForm({ open: true, name: '', editId: '' })}>
          + Sección
        </EpicButton>
        <EpicButton size="sm" variant="ghost" onClick={() => setTypeForm({ open: true, name: '', icon: '📌' })}>
          + Tipo
        </EpicButton>
      </div>

      <div className="inline-flex flex-wrap items-center gap-2 rounded-sm border border-ink/30 bg-ink/20 px-2 py-1.5 text-xs">
        <select
          className="select-war !w-auto !min-w-[7.5rem] !max-w-[10rem] !py-1 text-xs"
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          aria-label="Filtrar por prioridad"
        >
          <option value="">Prioridad</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{MISSION_PRIORITY_LABEL[p]}</option>)}
        </select>
        <select
          className="select-war !w-auto !min-w-[7.5rem] !max-w-[10rem] !py-1 text-xs"
          value={filterSection}
          onChange={(e) => setFilterSection(e.target.value)}
          aria-label="Filtrar por sección"
        >
          <option value="">Sección</option>
          <option value="__inbox__">⚡ Bandeja</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {view === 'list' && renderList()}
      {view === 'calendar' && renderCalendar()}
      {view === 'eisenhower' && renderEisenhower()}

      <div className="flex justify-center pt-2">
        <EpicButton size="lg" onClick={() => openCreate()} className="shadow-epic">
          ⚡ + NUEVA TAREA
        </EpicButton>
      </div>

      <EpicModal open={taskForm.open} onClose={() => setTaskForm((f) => ({ ...f, open: false }))} title={taskForm.editId ? 'Editar tarea' : 'Nueva tarea Thor'}>
        <input className="input-war mb-3 w-full" placeholder="Título" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
        <select className="select-war mb-3 w-full" value={taskForm.taskTypeId} onChange={(e) => setTaskForm({ ...taskForm, taskTypeId: e.target.value })}>
          {(course.thorTaskTypes ?? []).map((t) => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
        </select>
        <select className="select-war mb-3 w-full" value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as MissionPriority })}>
          {PRIORITIES.map((p) => <option key={p} value={p}>{MISSION_PRIORITY_LABEL[p]}</option>)}
        </select>
        <select className="select-war mb-3 w-full" value={taskForm.complexity} onChange={(e) => setTaskForm({ ...taskForm, complexity: e.target.value as MissionComplexity })}>
          <option value="light">Ligera</option>
          <option value="medium">Media</option>
          <option value="heavy">Pesada</option>
        </select>
        <input type="date" className="input-war mb-3 w-full" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
        <label className="text-readable-dim mb-1 block text-xs">Estimación (bloques de 30 min)</label>
        <input type="number" min={1} max={24} className="input-war mb-3 w-full" value={taskForm.estimateBlocks} onChange={(e) => setTaskForm({ ...taskForm, estimateBlocks: Number(e.target.value) })} />
        <select className="select-war mb-3 w-full" value={taskForm.sectionId} onChange={(e) => setTaskForm({ ...taskForm, sectionId: e.target.value })}>
          <option value="">Sin sección (bandeja)</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <p className="text-readable-dim mb-3 text-sm">
          XP: <span className="text-gold-bright font-epic">+{getMissionXpReward(taskForm.priority, taskForm.complexity)}</span>
        </p>
        <EpicButton className="w-full" onClick={() => void saveTask()}>Guardar</EpicButton>
      </EpicModal>

      <EpicModal
        open={sectionForm.open}
        onClose={() => setSectionForm({ open: false, name: '', editId: '' })}
        title={sectionForm.editId ? 'Editar sección' : 'Nueva sección'}
      >
        <input
          className="input-war mb-3 w-full"
          value={sectionForm.name}
          onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
          placeholder="Nombre de sección"
        />
        <EpicButton className="w-full" onClick={() => void saveSection()}>
          {sectionForm.editId ? 'Guardar' : 'Crear'}
        </EpicButton>
      </EpicModal>

      <EpicModal open={typeForm.open} onClose={() => setTypeForm({ open: false, name: '', icon: '📌' })} title="Nuevo tipo de tarea">
        <input className="input-war mb-3 w-full" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="Nombre" />
        <input className="input-war mb-3 w-full" value={typeForm.icon} onChange={(e) => setTypeForm({ ...typeForm, icon: e.target.value })} placeholder="Emoji" />
        <EpicButton className="w-full" onClick={async () => {
          if (!typeForm.name.trim()) return;
          await addThorTaskType(course.id, typeForm.name, typeForm.icon);
          setTypeForm({ open: false, name: '', icon: '📌' });
        }}>Crear</EpicButton>
      </EpicModal>

      <EpicModal open={subForm.open} onClose={() => setSubForm({ open: false, taskId: '', title: '' })} title="Subtarea">
        <input className="input-war mb-3 w-full" value={subForm.title} onChange={(e) => setSubForm({ ...subForm, title: e.target.value })} />
        <EpicButton className="w-full" onClick={async () => {
          if (!subForm.title.trim()) return;
          await addThorSubtask(course.id, subForm.taskId, subForm.title);
          setSubForm({ open: false, taskId: '', title: '' });
        }}>Añadir</EpicButton>
      </EpicModal>
    </div>
  );
}
