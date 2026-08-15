import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCoursesStore } from '../../stores/coursesStore';
import { usePlayerStore } from '../../stores/playerStore';
import { EpicButton, EpicModal } from '../ui';
import { EpicWarCheckbox, StudyMinutesBadge } from '../ui/EpicWarCheckbox';
import { CourseWarHub } from './CourseWarCard';
import { ThorCourseView } from './ThorCourseView';
import { UnitConquestProgressBar } from './UnitConquestProgressBar';
import { ExportToBlockModal } from '../timeblocking/ExportToBlockModal';
import { getDomainLabel } from '../../utils/gamification';
import { getCourseColor } from '../../utils/courseColors';
import { suggestTopicName, suggestSubtopicName } from '../../utils/epicNames';
import { formatUnitLine, suggestShortUnitName } from '../../utils/unitDisplay';
import { formatBlockContractTitle } from '../../utils/blockTitle';
import { isCourseFresh } from '../../utils/courseFactory';
import type { CourseMode, Topic, ThorTask } from '../../types';

interface CourseDetailViewProps {
  courseId: string;
  onBack: () => void;
}

export function CourseDetailView({ courseId, onBack }: CourseDetailViewProps) {
  const course = useCoursesStore((s) => s.courses.find((c) => c.id === courseId));
  const addUnit = useCoursesStore((s) => s.addUnit);
  const updateUnit = useCoursesStore((s) => s.updateUnit);
  const deleteUnit = useCoursesStore((s) => s.deleteUnit);
  const addTopic = useCoursesStore((s) => s.addTopic);
  const updateTopic = useCoursesStore((s) => s.updateTopic);
  const deleteTopic = useCoursesStore((s) => s.deleteTopic);
  const addSubtopic = useCoursesStore((s) => s.addSubtopic);
  const updateSubtopic = useCoursesStore((s) => s.updateSubtopic);
  const deleteSubtopic = useCoursesStore((s) => s.deleteSubtopic);
  const toggleTopicStudy = useCoursesStore((s) => s.toggleTopicStudy);
  const updateCourse = useCoursesStore((s) => s.updateCourse);

  const mode = course?.mode ?? 'kratos';
  const setMode = async (m: CourseMode) => {
    await updateCourse(courseId, { mode: m });
    const player = usePlayerStore.getState().player;
    if (player) {
      const { persistPlayer } = await import('../../utils/persist');
      await persistPlayer({ ...player, lastCourseMode: m });
      usePlayerStore.setState({ player: { ...player, lastCourseMode: m } });
    }
  };
  const [thorCreateTick, setThorCreateTick] = useState(0);
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [exportTarget, setExportTarget] = useState<{
    title: string;
    courseId: string;
    unitId?: string;
    topicId?: string;
    subtopicId?: string;
    missionId?: string;
  } | null>(null);

  const [unitForm, setUnitForm] = useState({ open: false, name: '', examDate: '', editId: '' });
  const [topicForm, setTopicForm] = useState({ open: false, unitId: '', name: '', editId: '' });
  const [subForm, setSubForm] = useState({ open: false, unitId: '', topicId: '', name: '', editId: '' });
  const [examForm, setExamForm] = useState({ open: false, unitId: '', date: '' });

  if (!course) return null;

  const color = getCourseColor(course.id, course.color);

  const handleAddUnit = async () => {
    if (!unitForm.name.trim()) return;
    if (unitForm.editId) {
      await updateUnit(course.id, unitForm.editId, { name: unitForm.name, examDate: unitForm.examDate || undefined });
    } else {
      const unitId = await addUnit(course.id, unitForm.name, unitForm.examDate || undefined);
      if (unitId) {
        setExpandedUnit(unitId);
      }
    }
    setUnitForm({ open: false, name: '', examDate: '', editId: '' });
  };

  const exportTopic = (unitId: string, unitName: string, topic: Topic, subtopicId?: string, subName?: string) => {
    setExportTarget({
      title: formatBlockContractTitle({
        courseName: course.name,
        unitName,
        topicName: topic.name,
        subtopicName: subName,
      }),
      courseId: course.id,
      unitId,
      topicId: topic.id,
      subtopicId,
    });
  };

  const exportThorTask = (task: ThorTask) => {
    setExportTarget({
      title: formatBlockContractTitle({
        courseName: course.name,
        missionTitle: task.title,
      }),
      courseId: course.id,
      missionId: task.missionId,
    });
  };

  const fresh = isCourseFresh(course);

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="btn-war btn-war-sm">← Cursos</button>

      <CourseWarHub course={course} onFirstThorTask={() => setThorCreateTick((n) => n + 1)} />

      {fresh && (
        <div className="panel-epic border-l-4 p-4" style={{ borderLeftColor: color }}>
          <p className="title-carved !text-base text-highlight">Inicia este curso</p>
          <p className="body-parchment mt-1 text-sm opacity-90">
            Elige cómo quieres empezar. Puedes usar KRATOS y THOR en el mismo curso.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <EpicButton
              size="sm"
              onClick={() => {
                void setMode('kratos');
                setUnitForm({
                  open: true,
                  name: suggestShortUnitName(0),
                  examDate: '',
                  editId: '',
                });
              }}
            >
              ⚔ Primera unidad (KRATOS)
            </EpicButton>
            <EpicButton
              size="sm"
              variant="ghost"
              onClick={() => {
                void setMode('thor');
                setThorCreateTick((n) => n + 1);
              }}
            >
              ⚡ Primera tarea (THOR)
            </EpicButton>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setMode('kratos')}
          className={`mode-kratos mode-tab-large relative overflow-hidden rounded-sm border-2 p-5 text-left transition ${mode === 'kratos' ? 'mode-active' : 'opacity-70'}`}
        >
          <div className="mode-particles mode-particles-red" />
          <span className="title-carved relative z-10 !text-lg text-highlight">⚔ KRATOS</span>
          <p className="body-parchment relative z-10 mt-1.5 text-base">Estudio — unidades, temas y subtemas</p>
        </button>
        <button
          type="button"
          onClick={() => setMode('thor')}
          className={`mode-thor mode-tab-large relative overflow-hidden rounded-sm border-2 p-5 text-left transition ${mode === 'thor' ? 'mode-active' : 'opacity-70'}`}
        >
          <div className="mode-particles mode-particles-blue" />
          <span className="title-carved relative z-10 !text-lg text-highlight">⚡ THOR</span>
          <p className="body-parchment relative z-10 mt-1.5 text-base">Gestor de tareas del curso</p>
        </button>
      </div>

      <div className="space-y-3 pb-20">
        {mode === 'thor' ? (
          <ThorCourseView course={course} color={color} onExport={exportThorTask} createSignal={thorCreateTick} />
        ) : (
          <>
            {course.units.map((unit) => (
              <div key={unit.id} className="panel-epic overflow-hidden" style={{ borderLeftColor: color, borderLeftWidth: 4 }}>
                <div
                  className="panel-epic-inner unit-card-head cursor-pointer py-2.5 pl-2 pr-3"
                  onClick={() => setExpandedUnit(expandedUnit === unit.id ? null : unit.id)}
                >
                  <div className="unit-header-stack">
                    <div className="unit-actions-float" onClick={(e) => e.stopPropagation()}>
                      <EpicButton
                        size="sm"
                        variant={unit.examDate ? 'gold' : 'ghost'}
                        className="!px-1.5 !py-0.5 text-[10px]"
                        onClick={() => setExamForm({ open: true, unitId: unit.id, date: unit.examDate ?? '' })}
                      >
                        📅 {unit.examDate ? 'Examen' : 'Fijar'}
                      </EpicButton>
                      <button className="btn-icon-war text-xs" onClick={() => setUnitForm({ open: true, name: unit.name, examDate: unit.examDate ?? '', editId: unit.id })}>✎</button>
                      <button className="btn-icon-war text-xs flavor-brutal" onClick={() => deleteUnit(course.id, unit.id)}>✕</button>
                    </div>

                    <p
                      className={`unit-title-line${unit.name.trim().length > 22 ? ' unit-title-line--long' : ''}`}
                      title={unit.name}
                    >
                      {formatUnitLine(unit.name)}
                    </p>
                    <p className="unit-subtitle-imposing">
                      {`${unit.topics.length} temas${unit.examDate ? ` · 📅 ${unit.examDate}` : ''}`}
                    </p>

                    {unit.topics.length > 0 && (
                      <UnitConquestProgressBar
                        layout="hero"
                        className="unit-progress-full"
                        progress={unit.progress}
                        accent={color}
                        totalTopics={unit.topics.length}
                        completedTopics={unit.topics.filter((t) => t.completed).length}
                      />
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {expandedUnit === unit.id && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-ink/30">
                      <div className="p-3">
                        <div className="mt-1 flex justify-end">
                          <EpicButton size="sm" onClick={() => setTopicForm({ open: true, unitId: unit.id, name: suggestTopicName(unit.topics.length), editId: '' })}>+ Tema</EpicButton>
                        </div>
                        {unit.topics.map((topic) => {
                          const topicChecked = topic.subtopics.length > 0
                            ? topic.completed || topic.subtopics.every((st) => st.completed)
                            : !!topic.completed;
                          return (
                            <div key={topic.id} className="topic-row-war mt-2 px-3 py-2">
                              <div className="flex items-center gap-2">
                                <EpicWarCheckbox
                                  checked={topicChecked}
                                  onToggle={() => void toggleTopicStudy(course.id, unit.id, topic.id)}
                                  label={topic.name}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className={`topic-title-imposing transition-all duration-300 ${topicChecked ? 'line-through opacity-60' : ''}`}>{topic.name}</p>
                                  <StudyMinutesBadge minutes={topic.studyTime} domainLabel={getDomainLabel(topic.domainLevel)} />
                                </div>
                                <div className="flex shrink-0 gap-1">
                                  <button className="btn-icon-war text-xs" title="Horario" onClick={() => exportTopic(unit.id, unit.name, topic)}>📅</button>
                                  <button className="btn-icon-war text-xs" onClick={() => setTopicForm({ open: true, unitId: unit.id, name: topic.name, editId: topic.id })}>✎</button>
                                  <button className="btn-icon-war text-xs flavor-brutal" onClick={() => deleteTopic(course.id, unit.id, topic.id)}>✕</button>
                                </div>
                              </div>
                              {topic.subtopics?.map((st) => (
                                <div key={st.id} className="ml-6 mt-1 flex items-center gap-2 border-l border-ink/30 pl-2">
                                  <EpicWarCheckbox
                                    size="sm"
                                    checked={st.completed}
                                    onToggle={() => void toggleTopicStudy(course.id, unit.id, topic.id, st.id)}
                                    label={st.name}
                                  />
                                  <span className={`topic-subtitle-imposing flex-1 transition-all duration-300 ${st.completed ? 'line-through opacity-60' : ''}`}>
                                    ▸ {st.name}
                                  </span>
                                  <div className="flex gap-1">
                                    <button className="text-[10px]" onClick={() => exportTopic(unit.id, unit.name, topic, st.id, st.name)}>📅</button>
                                    <button className="text-[10px]" onClick={() => setSubForm({ open: true, unitId: unit.id, topicId: topic.id, name: st.name, editId: st.id })}>✎</button>
                                    <button className="text-[10px] flavor-brutal" onClick={() => deleteSubtopic(course.id, unit.id, topic.id, st.id)}>✕</button>
                                  </div>
                                </div>
                              ))}
                              <button className="ml-6 mt-1 text-[10px] text-readable-dim hover:text-highlight" onClick={() => setSubForm({ open: true, unitId: unit.id, topicId: topic.id, name: suggestSubtopicName(topic.subtopics?.length ?? 0), editId: '' })}>
                                + Subtema
                              </button>
                            </div>
                          );
                        })}
                        {unit.topics.length === 0 && <p className="body-parchment py-3 text-center text-xs">Sin temas — conquista el conocimiento</p>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            {course.units.length === 0 && (
              <p className="body-parchment py-8 text-center text-sm">Sin unidades — forja tu primera conquista abajo</p>
            )}

            <div className="flex justify-center pt-4">
              <EpicButton
                size="lg"
                onClick={() => setUnitForm({ open: true, name: suggestShortUnitName(course.units.length), examDate: '', editId: '' })}
                className="add-unit-fab shadow-epic"
              >
                ⚔ + AGREGAR UNIDAD
              </EpicButton>
            </div>
          </>
        )}
      </div>

      <ExportToBlockModal
        open={!!exportTarget}
        onClose={() => setExportTarget(null)}
        title={exportTarget?.title ?? ''}
        blockType={exportTarget?.missionId ? 'task' : 'study'}
        courseColor={color}
        payload={{
          courseId: exportTarget?.courseId,
          unitId: exportTarget?.unitId,
          topicId: exportTarget?.topicId,
          subtopicId: exportTarget?.subtopicId,
          missionId: exportTarget?.missionId,
        }}
      />

      <EpicModal open={unitForm.open} onClose={() => setUnitForm({ ...unitForm, open: false })} title={unitForm.editId ? 'Editar unidad' : 'Nueva unidad'}>
        <input className="input-war mb-3 w-full" placeholder="Nombre" value={unitForm.name} onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })} />
        <input type="date" className="input-war mb-3 w-full" value={unitForm.examDate} onChange={(e) => setUnitForm({ ...unitForm, examDate: e.target.value })} />
        <EpicButton className="w-full" onClick={handleAddUnit}>Guardar</EpicButton>
      </EpicModal>

      <EpicModal open={topicForm.open} onClose={() => setTopicForm({ ...topicForm, open: false })} title={topicForm.editId ? 'Editar tema' : 'Nuevo tema'}>
        <input className="input-war mb-3 w-full" value={topicForm.name} onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })} />
        <EpicButton className="w-full" onClick={async () => {
          if (!topicForm.name.trim()) return;
          if (topicForm.editId) await updateTopic(course.id, topicForm.unitId, topicForm.editId, topicForm.name);
          else await addTopic(course.id, topicForm.unitId, topicForm.name);
          setTopicForm({ open: false, unitId: '', name: '', editId: '' });
        }}>Guardar</EpicButton>
      </EpicModal>

      <EpicModal open={subForm.open} onClose={() => setSubForm({ ...subForm, open: false })} title={subForm.editId ? 'Editar subtema' : 'Nuevo subtema'}>
        <input className="input-war mb-3 w-full" value={subForm.name} onChange={(e) => setSubForm({ ...subForm, name: e.target.value })} />
        <EpicButton className="w-full" onClick={async () => {
          if (!subForm.name.trim()) return;
          if (subForm.editId) await updateSubtopic(course.id, subForm.unitId, subForm.topicId, subForm.editId, subForm.name);
          else await addSubtopic(course.id, subForm.unitId, subForm.topicId, subForm.name);
          setSubForm({ open: false, unitId: '', topicId: '', name: '', editId: '' });
        }}>Guardar</EpicButton>
      </EpicModal>

      <EpicModal open={examForm.open} onClose={() => setExamForm({ ...examForm, open: false })} title="Fijar fecha de examen" flavor="Aparece en el Radar de Exámenes del Dashboard · modo guerra si faltan ≤7 días">
        <input
          type="date"
          className="input-war mb-3 w-full text-base"
          value={examForm.date}
          onChange={(e) => setExamForm({ ...examForm, date: e.target.value })}
        />
        <div className="flex gap-2">
          <EpicButton
            className="flex-1"
            onClick={async () => {
              if (!examForm.unitId) return;
              await updateUnit(course.id, examForm.unitId, { examDate: examForm.date || undefined });
              setExamForm({ open: false, unitId: '', date: '' });
            }}
          >
            Guardar examen
          </EpicButton>
          {examForm.date && (
            <EpicButton
              variant="ghost"
              onClick={async () => {
                if (!examForm.unitId) return;
                await updateUnit(course.id, examForm.unitId, { examDate: undefined });
                setExamForm({ open: false, unitId: '', date: '' });
              }}
            >
              Quitar
            </EpicButton>
          )}
        </div>
      </EpicModal>
    </div>
  );
}
