import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { groupByEisenhower, EISENHOWER_META, type EisenhowerQuadrant } from '../../utils/missionMatrix';
import { getCourseColor } from '../../utils/courseColors';
import type { Mission, Course } from '../../types';
import { MissionCompactCard } from './MissionCompactCard';

interface Props {
  missions: Mission[];
  courses: Course[];
  onComplete: (id: string) => void;
  onEdit: (m: Mission) => void;
  onDelete: (id: string) => void;
  onExport: (m: Mission) => void;
}

const QUADRANT_ORDER: EisenhowerQuadrant[] = ['do', 'schedule', 'delegate', 'eliminate'];

export function MissionEisenhowerView({
  missions,
  courses,
  onComplete,
  onEdit,
  onDelete,
  onExport,
}: Props) {
  const groups = useMemo(() => groupByEisenhower(missions), [missions]);

  const getColor = (courseId: string) => {
    const c = courses.find((x) => x.id === courseId);
    return getCourseColor(courseId, c?.color);
  };

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {QUADRANT_ORDER.map((q) => {
        const meta = EISENHOWER_META[q];
        const items = groups[q];
        return (
          <motion.div
            key={q}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="eisenhower-quadrant panel-epic p-3"
            style={{
              borderColor: meta.color,
              boxShadow: `0 0 20px ${meta.color}33, inset 0 0 30px rgba(0,0,0,0.3)`,
            }}
          >
            <div
              className="eisenhower-header mb-3 border-b-2 pb-2"
              style={{ borderColor: `${meta.color}88` }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{meta.icon}</span>
                <div>
                  <h4 className="title-carved !text-sm" style={{ color: meta.color }}>
                    {meta.label}
                  </h4>
                  <p className="text-readable-dim text-[10px] uppercase tracking-wider">{meta.subtitle}</p>
                </div>
                <span className="ml-auto stat-epic text-xs" style={{ color: meta.color }}>
                  {items.length}
                </span>
              </div>
            </div>

            <div className="max-h-80 space-y-2 overflow-y-auto">
              {items.length === 0 ? (
                <p className="body-parchment py-6 text-center text-xs opacity-60">Vacío — los dioses sonríen</p>
              ) : (
                items.map((m) => (
                  <MissionCompactCard
                    key={m.id}
                    mission={m}
                    courseColor={getColor(m.courseId)}
                    onComplete={onComplete}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onExport={onExport}
                    compact
                  />
                ))
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
