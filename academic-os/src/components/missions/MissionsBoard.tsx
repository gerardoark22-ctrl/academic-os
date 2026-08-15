import { useState } from 'react';
import { useMissionsStore } from '../../stores/missionsStore';
import { useCoursesStore } from '../../stores/coursesStore';
import { EpicButton, StoneCard, EpicModal, SectionTitle } from '../ui';
import { MissionListView, MissionCalendarView, MissionMatrixView } from './MissionViews';
import { ExportToBlockModal } from '../timeblocking/ExportToBlockModal';
import type { Mission, MissionPriority, MissionType, MissionComplexity } from '../../types';
import { getCourseColor } from '../../utils/courseColors';
import { getMissionXpReward } from '../../utils/gamification';
import { SECTIONS, FLAVOR } from '../../utils/uiCopy';
import { exportMissionsICS } from '../../utils/icsExport';
import { blockTitleForMission } from '../../utils/blockTitle';

type ViewMode = 'list' | 'calendar' | 'matrix';

export function MissionsBoard() {
  const missions = useMissionsStore((s) => s.missions);
  const completeMission = useMissionsStore((s) => s.completeMission);
  const addMission = useMissionsStore((s) => s.addMission);
  const updateMission = useMissionsStore((s) => s.updateMission);
  const deleteMission = useMissionsStore((s) => s.deleteMission);
  const courses = useCoursesStore((s) => s.courses);

  const [view, setView] = useState<ViewMode>('calendar');
  const [courseFilter, setCourseFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<MissionPriority | ''>('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Mission | null>(null);
  const [exportMission, setExportMission] = useState<Mission | null>(null);
  const [form, setForm] = useState({
    title: '',
    type: 'task' as MissionType,
    courseId: '',
    unitId: '',
    priority: 'chiste' as MissionPriority,
    complexity: 'medium' as MissionComplexity,
    dueDate: '',
  });

  const active = missions.filter((m) => {
    if (m.completed) return false;
    if (courseFilter && m.courseId !== courseFilter) return false;
    if (priorityFilter && m.priority !== priorityFilter) return false;
    return true;
  });

  const openEdit = (m: Mission) => {
    setEditing(m);
    setForm({
      title: m.title,
      type: m.type,
      courseId: m.courseId,
      unitId: m.unitId ?? '',
      priority: m.priority,
      complexity: m.complexity ?? 'medium',
      dueDate: m.dueDate ?? '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.title || !form.courseId) return;
    const course = courses.find((c) => c.id === form.courseId);
    const payload = {
      ...form,
      courseName: course?.name ?? '',
      unitId: form.unitId || undefined,
    };
    if (editing) {
      await updateMission(editing.id, payload);
    } else {
      await addMission(payload);
    }
    setShowForm(false);
    setEditing(null);
    setForm({ title: '', type: 'task', courseId: '', unitId: '', priority: 'chiste', complexity: 'medium', dueDate: '' });
  };

  const previewXp = form.priority && form.complexity
    ? getMissionXpReward(form.priority, form.complexity)
    : 0;

  const selectedCourse = courses.find((c) => c.id === form.courseId);
  const exportColor = exportMission
    ? getCourseColor(exportMission.courseId, courses.find((c) => c.id === exportMission.courseId)?.color)
    : '#CD853F';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle title={SECTIONS.missionsBoard.title} flavor={SECTIONS.missionsBoard.flavor} className="mb-0" />
        <div className="flex flex-wrap gap-2">
          <EpicButton variant="ghost" size="sm" onClick={() => exportMissionsICS(missions.filter((m) => !m.completed))}>
            📅 Exportar ICS
          </EpicButton>
          <EpicButton onClick={() => { setEditing(null); setShowForm(true); }}>+ Misión</EpicButton>
        </div>
      </div>

      <StoneCard>
        <div className="flex flex-wrap items-center gap-2">
          <EpicButton size="sm" variant={view === 'list' ? 'gold' : 'ghost'} onClick={() => setView('list')}>
            Lista
          </EpicButton>
          <EpicButton size="sm" variant={view === 'calendar' ? 'gold' : 'ghost'} onClick={() => setView('calendar')}>
            Calendario
          </EpicButton>
          <EpicButton size="sm" variant={view === 'matrix' ? 'gold' : 'ghost'} onClick={() => setView('matrix')}>
            Matriz
          </EpicButton>
          <span className="mx-2 h-6 w-px bg-ink/40" />
          <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="select-war !w-auto !py-1 text-sm">
            <option value="">Todos los cursos</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as MissionPriority | '')} className="select-war !w-auto !py-1 text-sm">
            <option value="">Toda importancia</option>
            <option value="odisea">Odisea</option>
            <option value="epica">Épica</option>
            <option value="chiste">Chiste</option>
          </select>
        </div>
      </StoneCard>

      {active.length === 0 ? (
        <p className="body-parchment text-center text-sm">{FLAVOR.emptyMissions}</p>
      ) : view === 'list' ? (
        <MissionListView
          missions={active}
          courses={courses}
          courseFilter={courseFilter}
          onComplete={completeMission}
          onEdit={openEdit}
          onDelete={deleteMission}
          onExport={setExportMission}
        />
      ) : view === 'calendar' ? (
        <MissionCalendarView
          missions={active}
          courses={courses}
          courseFilter={courseFilter}
          onComplete={completeMission}
          onEdit={openEdit}
          onDelete={deleteMission}
          onExport={setExportMission}
        />
      ) : view === 'matrix' ? (
        <MissionMatrixView
          missions={active}
          courses={courses}
          courseFilter={courseFilter}
          onComplete={completeMission}
          onEdit={openEdit}
          onDelete={deleteMission}
          onExport={setExportMission}
        />
      ) : null}

      <ExportToBlockModal
        open={!!exportMission}
        onClose={() => setExportMission(null)}
        title={exportMission ? blockTitleForMission(exportMission, courses) : ''}
        blockType={exportMission?.type === 'exam' ? 'exam' : exportMission?.type === 'reading' ? 'study' : 'task'}
        courseColor={exportColor}
        payload={{
          courseId: exportMission?.courseId,
          unitId: exportMission?.unitId,
          missionId: exportMission?.id,
        }}
      />

      <EpicModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null); }}
        title={editing ? 'Editar misión' : 'Nueva misión'}
        flavor="Contrato de batalla"
      >
        <div className="space-y-3">
          <input placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-war w-full" />
          <select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value, unitId: '' })} className="select-war">
            <option value="">Curso</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          {selectedCourse && selectedCourse.units.length > 0 && (
            <select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} className="select-war">
              <option value="">Unidad (opcional)</option>
              {selectedCourse.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as MissionType })} className="select-war">
            <option value="exam">Examen</option>
            <option value="task">Tarea</option>
            <option value="reading">Lectura</option>
          </select>
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as MissionPriority })} className="select-war">
            <option value="odisea">🗡 Odisea — máxima importancia</option>
            <option value="epica">⚔ Épica — alta importancia</option>
            <option value="chiste">▪ Chiste — rutina</option>
          </select>
          <select value={form.complexity} onChange={(e) => setForm({ ...form, complexity: e.target.value as MissionComplexity })} className="select-war">
            <option value="light">Ligera — tarea rápida</option>
            <option value="medium">Media — esfuerzo moderado</option>
            <option value="heavy">Pesada — requiere profundidad</option>
          </select>
          <p className="text-readable-dim text-sm">
            Recompensa estimada: <span className="font-epic text-gold-bright">+{previewXp} XP</span>
          </p>
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="input-war w-full" />
          <div className="flex gap-2">
            <EpicButton onClick={handleSubmit} className="flex-1">{editing ? 'Guardar' : 'Crear'}</EpicButton>
            {editing && (
              <EpicButton variant="danger" onClick={() => { deleteMission(editing.id); setShowForm(false); setEditing(null); }}>
                Eliminar
              </EpicButton>
            )}
          </div>
        </div>
      </EpicModal>
    </div>
  );
}
