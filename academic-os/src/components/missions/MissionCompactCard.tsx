import { motion } from 'framer-motion';
import { MISSION_COMPLEXITY_LABEL, MISSION_PRIORITY_LABEL } from '../../utils/gamification';
import { getMissionDueMeta } from '../../utils/missionDue';
import { courseAuraCss } from '../../utils/courseColors';
import type { Mission } from '../../types';

const PRIORITY_DOT = {
  odisea: '🗡',
  epica: '⚔',
  chiste: '▪',
};

interface MissionCompactCardProps {
  mission: Mission;
  courseColor: string;
  onComplete: (id: string) => void;
  onEdit: (m: Mission) => void;
  onDelete: (id: string) => void;
  onExport: (m: Mission) => void;
  compact?: boolean;
}

export function MissionCompactCard({
  mission,
  courseColor,
  onComplete,
  onEdit,
  onDelete,
  onExport,
  compact = false,
}: MissionCompactCardProps) {
  const complexity = mission.complexity ?? 'medium';
  const due = getMissionDueMeta(mission.dueDate);
  const isUrgent = due.urgency === 'overdue' || due.urgency === 'today' || due.urgency === 'tomorrow';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`mission-card-war relative flex items-stretch gap-0 overflow-hidden rounded-sm border-2 ${
        isUrgent ? 'border-blood-dried/80' : 'border-ink/60'
      } ${compact ? 'text-[11px]' : ''}`}
      style={courseAuraCss(courseColor, isUrgent ? 0.65 : 0.35)}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2.5">
        <div className={`mission-due-chip ${due.cssClass} mb-2 inline-flex items-center gap-2 self-start`}>
          <span className="mission-due-particles pointer-events-none absolute inset-0" aria-hidden />
          <time className="mission-due-date relative font-epic font-bold tracking-wide" dateTime={mission.dueDate}>
            {due.formattedLong}
          </time>
          <span className="mission-due-badge relative">{due.label}</span>
          {due.sublabel && due.urgency !== 'today' && due.urgency !== 'tomorrow' && (
            <span className="mission-due-sub relative">{due.sublabel}</span>
          )}
        </div>

        <div className="flex items-start gap-2">
          <span className={`mt-0.5 shrink-0 ${compact ? 'text-xs' : 'text-base'}`}>
            {PRIORITY_DOT[mission.priority]}
          </span>
          <h4 className={`mission-title-epic min-w-0 flex-1 ${compact ? 'text-sm' : ''}`} title={mission.title}>
            {mission.title}
          </h4>
        </div>

        <div className={`mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 ${compact ? 'text-[10px]' : 'text-xs'} text-readable-dim`}>
          <span className="font-semibold" style={{ color: courseColor }}>{mission.courseName}</span>
          <span>·</span>
          <span className="uppercase tracking-wider">{MISSION_PRIORITY_LABEL[mission.priority]}</span>
          <span>·</span>
          <span>{MISSION_COMPLEXITY_LABEL[complexity]}</span>
          <span>·</span>
          <span className="mission-xp-reward font-epic text-gold-bright">+{mission.xpReward} XP</span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col border-l border-ink/40 bg-ink/30">
        <button type="button" onClick={() => onExport(mission)} className="btn-icon-war" title="Asignar bloques">📅</button>
        <button type="button" onClick={() => onEdit(mission)} className="btn-icon-war" title="Editar">✎</button>
        <button type="button" onClick={() => onComplete(mission.id)} className="btn-icon-war text-gold-bright" title={`Completar (+${mission.xpReward} XP)`}>⚔</button>
        <button type="button" onClick={() => onDelete(mission.id)} className="btn-icon-war flavor-brutal !text-xs" title="Eliminar">✕</button>
      </div>
    </motion.div>
  );
}
