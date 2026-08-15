import { useState } from 'react';
import { useCoursesStore } from '../../stores/coursesStore';
import { useMissionsStore } from '../../stores/missionsStore';
import { usePlayerStore } from '../../stores/playerStore';
import { EpicButton, EpicModal, SectionTitle } from '../ui';
import { EmojiPicker } from '../ui/EmojiPicker';
import { ColorPalette } from '../ui/ColorPalette';
import { CourseWarCard } from './CourseWarCard';
import { CourseDetailView } from './CourseDetailView';
import { SyllabusAIModal, type SyllabusImportPayload } from './SyllabusAIModal';
import { COURSE_COLOR_PALETTE } from '../../utils/cosmetics';
import { SECTIONS, FLAVOR } from '../../utils/uiCopy';
import { courseMatchesModeFilter, courseUrgencyCount } from '../../utils/thorCourse';
import type { CourseMode } from '../../types';

type ModeFilter = 'all' | CourseMode;

interface CourseFormState {
  name: string;
  icon: string;
  color: string;
  mode: CourseMode;
}

export function CoursesLibrary() {
  const courses = useCoursesStore((s) => s.courses);
  const loading = useCoursesStore((s) => s.loading);
  const selectedId = useCoursesStore((s) => s.selectedCourseId);
  const selectCourse = useCoursesStore((s) => s.selectCourse);
  const addCourse = useCoursesStore((s) => s.addCourse);
  const importCourseFromSyllabus = useCoursesStore((s) => s.importCourseFromSyllabus);
  const addMission = useMissionsStore((s) => s.addMission);
  const updateCourse = useCoursesStore((s) => s.updateCourse);
  const deleteCourse = useCoursesStore((s) => s.deleteCourse);
  const missions = useMissionsStore((s) => s.missions);
  const lastCourseMode = usePlayerStore((s) => s.player?.lastCourseMode ?? 'kratos');

  const [showForm, setShowForm] = useState(false);
  const [showSyllabus, setShowSyllabus] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CourseFormState>({
    name: '',
    icon: '📚',
    color: COURSE_COLOR_PALETTE[0],
    mode: 'kratos',
  });
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');

  const filteredCourses = courses.filter((c) => courseMatchesModeFilter(c, modeFilter));
  const selected = courses.find((c) => c.id === selectedId);

  if (selected) {
    return <CourseDetailView courseId={selected.id} onBack={() => selectCourse(null)} />;
  }

  const openCreate = () => {
    setEditId(null);
    setForm({
      name: '',
      icon: '📚',
      color: COURSE_COLOR_PALETTE[courses.length % COURSE_COLOR_PALETTE.length],
      mode: lastCourseMode,
    });
    setShowForm(true);
  };

  const openEdit = (course: (typeof courses)[0]) => {
    setEditId(course.id);
    setForm({
      name: course.name,
      icon: course.icon,
      color: course.color ?? COURSE_COLOR_PALETTE[0],
      mode: course.mode ?? 'kratos',
    });
    setShowForm(true);
  };

  const saveCourse = async () => {
    if (!form.name.trim()) return;
    if (editId) {
      await updateCourse(editId, {
        name: form.name.trim(),
        icon: form.icon,
        color: form.color,
        mode: form.mode,
      });
      setShowForm(false);
      setEditId(null);
      return;
    }
    const courseId = await addCourse(form.name.trim(), form.icon, form.color, form.mode);
    setShowForm(false);
    setEditId(null);
    selectCourse(courseId);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle title={SECTIONS.courses.title} flavor={SECTIONS.courses.flavor} className="mb-0" />
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="select-war !w-auto !py-1 text-sm"
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value as ModeFilter)}
          >
            <option value="all">Todos los modos</option>
            <option value="kratos">⚔ KRATOS</option>
            <option value="thor">⚡ THOR</option>
          </select>
          <EpicButton onClick={openCreate}>+ Curso</EpicButton>
        </div>
      </div>

      {loading ? (
        <p className="body-parchment py-8 text-center text-sm opacity-70">Cargando biblioteca…</p>
      ) : courses.length === 0 ? (
        <div className="panel-epic mx-auto max-w-lg p-6 text-center">
          <p className="title-carved !text-lg text-highlight">Forja tu primer curso</p>
          <p className="body-parchment mt-2 text-sm opacity-90">{FLAVOR.emptyCourses}</p>
          <ol className="body-parchment mt-4 space-y-2 text-left text-xs opacity-80">
            <li>1. Pulsa <strong>+ Curso</strong> y elige modo inicial (KRATOS o THOR).</li>
            <li>2. Dentro del curso: unidades/temas <em>o</em> tareas THOR.</li>
            <li>3. Exporta al horario (📅) para ganar XP con bloques.</li>
          </ol>
          <EpicButton className="mt-5" onClick={openCreate}>⚔ Empezar curso</EpicButton>
        </div>
      ) : filteredCourses.length === 0 ? (
        <p className="body-parchment py-8 text-center text-sm opacity-70">Ningún curso coincide con el filtro.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredCourses.map((course, i) => (
            <CourseWarCard
              key={course.id}
              course={course}
              index={i}
              urgentCount={courseUrgencyCount(course, missions)}
              onClick={() => selectCourse(course.id)}
              onEdit={() => openEdit(course)}
              onDelete={() => { if (confirm(`¿Eliminar ${course.name}?`)) deleteCourse(course.id); }}
            />
          ))}
        </div>
      )}

      <EpicModal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editId ? 'Editar curso' : 'Nuevo curso'}
        flavor="Forja tu templo de conocimiento"
      >
        <div className="course-form-unified mb-4 flex items-stretch gap-0 overflow-hidden rounded border-2 border-bronze-light/50">
          <div className="flex shrink-0 items-center border-r border-bronze-light/30 bg-ink/40 px-3">
            <span className="text-3xl">{form.icon}</span>
          </div>
          <input
            className="input-war flex-1 !border-0 !bg-transparent !shadow-none"
            placeholder="Nombre del curso (ej. Epidemiología)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') void saveCourse(); }}
          />
        </div>
        <EmojiPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
        <div className="mt-4">
          <ColorPalette value={form.color} onChange={(color) => setForm({ ...form, color })} />
        </div>
        {!editId && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`rounded-sm border-2 p-3 text-left text-xs transition ${form.mode === 'kratos' ? 'mode-active border-highlight' : 'border-ink/40 opacity-70'}`}
              onClick={() => setForm({ ...form, mode: 'kratos' })}
            >
              <span className="title-carved !text-sm">⚔ KRATOS</span>
              <p className="body-parchment mt-1">Temario y estudio</p>
            </button>
            <button
              type="button"
              className={`rounded-sm border-2 p-3 text-left text-xs transition ${form.mode === 'thor' ? 'mode-active border-highlight' : 'border-ink/40 opacity-70'}`}
              onClick={() => setForm({ ...form, mode: 'thor' })}
            >
              <span className="title-carved !text-sm">⚡ THOR</span>
              <p className="body-parchment mt-1">Gestor de tareas</p>
            </button>
          </div>
        )}
        {!editId && (
          <EpicButton variant="ghost" className="mt-3 w-full" onClick={() => { setShowForm(false); setShowSyllabus(true); }}>
            🧠 IA Syllabus — generar temario desde texto
          </EpicButton>
        )}
        <EpicButton className="mt-4 w-full" onClick={() => void saveCourse()}>
          {editId ? 'Guardar' : 'Crear y abrir'}
        </EpicButton>
        {editId && (
          <EpicButton variant="danger" className="mt-2 w-full" onClick={() => { deleteCourse(editId); setShowForm(false); }}>
            Eliminar curso
          </EpicButton>
        )}
      </EpicModal>

      <SyllabusAIModal
        open={showSyllabus}
        onClose={() => setShowSyllabus(false)}
        courseName={form.name}
        courseIcon={form.icon}
        courseColor={form.color}
        onImport={async ({ draft, missions: draftMissions }: SyllabusImportPayload) => {
          const name = form.name.trim() || draft.units[0]?.name || 'Curso IA';
          const courseId = await importCourseFromSyllabus(name, form.icon, form.color, draft);
          const course = useCoursesStore.getState().courses.find((c) => c.id === courseId);
          for (const m of draftMissions.filter((x) => x.enabled)) {
            await addMission({
              title: m.title,
              type: 'exam',
              courseId,
              courseName: course?.name ?? name,
              dueDate: m.dueDate,
              priority: 'odisea',
            });
          }
          selectCourse(courseId);
          return courseId;
        }}
      />
    </div>
  );
}
