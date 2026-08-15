import { useEffect, useState } from 'react';
import { StoneCard, SectionTitle } from '../ui';
import { useCoursesStore } from '../../stores/coursesStore';
import { useTimeStore } from '../../stores/timeStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useActiveMissions } from '../../hooks/useActiveMissions';
import { daysUntil, todayISO } from '../../utils/gamification';
import { getCourseColor } from '../../utils/courseColors';
import type { Mission, TimeBlock } from '../../types';

function isUrgent(m: Mission): boolean {
  const d = daysUntil(m.dueDate);
  return d <= 3 || m.priority === 'odisea' || m.type === 'exam';
}

export function DashboardTodayMissions() {
  const missions = useActiveMissions();
  const courses = useCoursesStore((s) => s.courses);
  const today = todayISO();

  const todayMissions = missions.filter((m) => m.dueDate === today || daysUntil(m.dueDate) < 0);
  const urgent = todayMissions.filter(isUrgent);
  const calm = todayMissions.filter((m) => !isUrgent(m));

  const renderRow = (m: Mission) => {
    const days = daysUntil(m.dueDate);
    const overdue = days < 0;
    const color = getCourseColor(m.courseId, courses.find((c) => c.id === m.courseId)?.color);
    return (
      <div
        key={m.id}
        className="dashboard-mission-row flex items-start gap-3 rounded-sm px-3 py-3"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <div className="min-w-0 flex-1">
          <p className="dashboard-mission-title">{m.title}</p>
          <p className="dashboard-mission-meta">{m.courseName}</p>
        </div>
        <span className={`dashboard-mission-badge shrink-0 ${overdue || days <= 1 ? 'dashboard-mission-badge-hot' : ''}`}>
          {overdue ? `+${Math.abs(days)}d vencida` : days === 0 ? 'HOY' : `${days}d`}
        </span>
      </div>
    );
  };

  return (
    <StoneCard>
      <SectionTitle title="Pendientes de hoy" flavor="Urgentes y resto del día" />
      {todayMissions.length === 0 ? (
        <p className="body-parchment py-6 text-center text-base">Sin misiones para hoy — campo despejado</p>
      ) : (
        <div className="space-y-4">
          {urgent.length > 0 && (
            <div>
              <p className="dashboard-section-label">Urgentes</p>
              <div className="space-y-2">{urgent.map(renderRow)}</div>
            </div>
          )}
          {calm.length > 0 && (
            <div>
              <p className="dashboard-section-label">Sin prisa hoy</p>
              <div className="space-y-2">{calm.map(renderRow)}</div>
            </div>
          )}
        </div>
      )}
    </StoneCard>
  );
}

export function DashboardTodaySchedule() {
  const today = todayISO();
  const getBlocksForDate = useTimeStore((s) => s.getBlocksForDate);
  const blocksRevision = useTimeStore((s) => s.blocksRevision);
  const totalBlocksCompleted = usePlayerStore((s) => s.player?.totalBlocksCompleted ?? 0);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);

  useEffect(() => {
    void getBlocksForDate(today).then(setBlocks);
  }, [today, getBlocksForDate, blocksRevision, totalBlocksCompleted]);

  const scheduled = blocks.filter((b) => b.title && b.type !== 'rest');
  const done = scheduled.filter((b) => b.completed).length;

  return (
    <StoneCard>
      <SectionTitle title="Horario de hoy" flavor={`${done}/${scheduled.length} bloques completados`} />
      {scheduled.length === 0 ? (
        <p className="body-parchment py-6 text-center text-base">Sin bloques asignados — ve a Horario</p>
      ) : (
        <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
          {scheduled.map((b) => (
            <div
              key={b.id}
              className={`dashboard-block-row ${b.completed ? 'dashboard-block-done' : ''}`}
              data-type={b.type}
            >
              <span className="dashboard-block-time">{b.startTime}</span>
              <div className="min-w-0 flex-1">
                <p className="dashboard-block-title">{b.title}</p>
                <p className="dashboard-block-meta">{b.type === 'study' ? 'Estudio' : b.type === 'exam' ? 'Examen' : 'Tarea'}</p>
              </div>
              {b.completed && <span className="dashboard-block-check">✓</span>}
            </div>
          ))}
        </div>
      )}
    </StoneCard>
  );
}
