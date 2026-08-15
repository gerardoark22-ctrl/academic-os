import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { buildMonthGrid, dateFromParts, WEEKDAY_LABELS } from '../../utils/missionMatrix';
import { getCourseColor } from '../../utils/courseColors';
import { todayLocalISO } from '../../utils/localTime';
import type { Mission, Course } from '../../types';
import { MissionCompactCard } from './MissionCompactCard';
import { EpicButton } from '../ui';

interface Props {
  missions: Mission[];
  courses: Course[];
  onComplete: (id: string) => void;
  onEdit: (m: Mission) => void;
  onDelete: (id: string) => void;
  onExport: (m: Mission) => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const PRIORITY_EMOJI = { odisea: '🗡', epica: '⚔', chiste: '▪' };

export function MissionMonthGrid({ missions, courses, onComplete, onEdit, onDelete, onExport }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate());

  const weeks = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const byDate = useMemo(() => {
    const map: Record<string, Mission[]> = {};
    for (const m of missions) {
      if (!map[m.dueDate]) map[m.dueDate] = [];
      map[m.dueDate].push(m);
    }
    return map;
  }, [missions]);

  const courseMap = useMemo(() => {
    const map: Record<string, Course> = {};
    for (const c of courses) map[c.id] = c;
    return map;
  }, [courses]);

  const getColor = (courseId: string) => getCourseColor(courseId, courseMap[courseId]?.color);

  const selectedDate = selectedDay ? dateFromParts(year, month, selectedDay) : null;
  const selectedMissions = selectedDate ? (byDate[selectedDate] ?? []) : [];
  const today = todayLocalISO();

  return (
    <div className="space-y-4">
      <div className="cal-month-banner flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <EpicButton size="sm" variant="ghost" onClick={() => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); setSelectedDay(null); }}>◀</EpicButton>
        <h3 className="title-carved !text-lg text-gold-bright">{MONTH_NAMES[month]} {year}</h3>
        <div className="flex gap-2">
          <EpicButton size="sm" variant="ghost" onClick={() => { const t = new Date(); setYear(t.getFullYear()); setMonth(t.getMonth()); setSelectedDay(t.getDate()); }}>Hoy</EpicButton>
          <EpicButton size="sm" variant="ghost" onClick={() => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); setSelectedDay(null); }}>▶</EpicButton>
        </div>
      </div>

      <div className="cal-month-grid overflow-x-auto">
        <div className="cal-month-inner min-w-[720px]">
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="cal-weekday-header py-2.5 text-center font-epic text-xs uppercase tracking-widest">
                {label}
              </div>
            ))}

            {weeks.flat().map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} className="cal-day-cell cal-day-empty" />;
              const dateStr = dateFromParts(year, month, day);
              const dayMissions = byDate[dateStr] ?? [];
              const isToday = dateStr === today;
              const isSelected = selectedDay === day;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`cal-day-cell text-left ${isSelected ? 'cal-day-selected' : ''} ${isToday ? 'cal-day-today' : ''}`}
                >
                  <div className="cal-day-header flex items-center justify-between">
                    <span className="cal-day-badge font-epic text-sm text-gold-bright">{day}</span>
                    {dayMissions.length > 0 && (
                      <span className="cal-day-count text-[10px] text-readable-dim">{dayMissions.length}</span>
                    )}
                  </div>
                  <div className="cal-day-tasks mt-2 space-y-1.5">
                    {dayMissions.slice(0, 4).map((m) => {
                      const course = courseMap[m.courseId];
                      const color = getColor(m.courseId);
                      return (
                        <div
                          key={m.id}
                          className="cal-task-chip flex items-center gap-1.5 truncate rounded-sm px-2 py-1.5 text-[11px]"
                          style={{ borderLeft: `3px solid ${color}`, background: 'rgba(10, 8, 6, 0.85)' }}
                          title={m.title}
                        >
                          <span className="shrink-0 text-base">{course?.icon ?? PRIORITY_EMOJI[m.priority]}</span>
                          <span className="truncate text-readable">{m.title}</span>
                        </div>
                      );
                    })}
                    {dayMissions.length > 4 && (
                      <p className="text-[9px] text-readable-dim">+{dayMissions.length - 4} más</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selectedDate && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel-epic p-4">
          <div className="panel-epic-inner mb-3 flex items-center justify-between">
            <h4 className="title-carved !text-sm capitalize">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h4>
            <span className="stat-epic text-xs text-readable-dim">{selectedMissions.length} pendiente{selectedMissions.length !== 1 ? 's' : ''}</span>
          </div>
          {selectedMissions.length === 0 ? (
            <p className="body-parchment py-4 text-center text-sm">Sin misiones este día</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {selectedMissions.map((m) => (
                <MissionCompactCard key={m.id} mission={m} courseColor={getColor(m.courseId)} onComplete={onComplete} onEdit={onEdit} onDelete={onDelete} onExport={onExport} compact />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
