import { motion, AnimatePresence } from 'framer-motion';
import { EpicButton, XpFloat } from '../ui';
import { PLAYER_CONFIG } from '../../utils/playerConfig';
import { formatGoalHoursMinutes } from '../../utils/dailyGoal';
import type { BlockLiveStatus } from '../../utils/localTime';
import type { TimeBlock, BlockType } from '../../types';

const blockTypeClass: Record<BlockType, string> = {
  study: 'block-war-study',
  exam: 'block-war-exam',
  task: 'block-war-task',
  rest: 'block-war-rest',
};

const blockLabels: Record<BlockType, string> = {
  study: 'Estudio',
  exam: 'Examen',
  task: 'Tarea',
  rest: 'Descanso',
};

interface WarBlockProps {
  block: TimeBlock;
  liveStatus?: BlockLiveStatus;
  isDragOver?: boolean;
  xpFloat?: boolean;
  assigning?: boolean;
  assignTitle?: string;
  onAssignTitleChange?: (v: string) => void;
  onStartAssign?: () => void;
  onCancelAssign?: () => void;
  onConfirmAssign?: () => void;
  onComplete?: () => void;
  onUncomplete?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDragStart?: () => void;
  onDrop?: () => void;
}

function StatusBadge({ status }: { status: BlockLiveStatus }) {
  if (status === 'live') {
    return <span className="block-war-live-badge block-war-grid-badge">⚡ AHORA</span>;
  }
  if (status === 'missed') {
    return <span className="block-war-dead-badge block-war-grid-badge">☠ MUERTO</span>;
  }
  return <span className="block-war-grid-badge block-war-grid-badge-empty" aria-hidden />;
}

export function WarBlock({
  block,
  liveStatus,
  isDragOver,
  xpFloat,
  assigning,
  assignTitle = '',
  onAssignTitleChange,
  onStartAssign,
  onCancelAssign,
  onConfirmAssign,
  onComplete,
  onUncomplete,
  onEdit,
  onDelete,
  onDragStart,
  onDrop,
}: WarBlockProps) {
  const isEmpty = !block.title || block.type === 'rest';
  const typeClass = isEmpty ? 'block-war-empty' : blockTypeClass[block.type];
  const status = liveStatus ?? 'future';
  const isMissed = status === 'missed' && !block.completed;

  const statusClass =
    status === 'live'
      ? 'block-war-live'
      : status === 'missed'
        ? 'block-war-missed'
        : status === 'future'
          ? 'block-war-future'
          : '';

  return (
    <motion.div
      draggable={!!block.title && block.type !== 'rest' && !block.completed}
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={[
        'block-war relative mb-3 flex min-h-[76px] items-stretch gap-3 px-3 py-3 transition-all',
        typeClass,
        statusClass,
        isDragOver ? 'block-war-drag' : '',
        block.completed ? 'block-war-done' : '',
      ].join(' ')}
    >
      {status === 'live' && <span className="block-war-live-pulse" aria-hidden />}
      {status === 'missed' && <span className="block-war-missed-veil" aria-hidden />}

      <span className={`block-war-time shrink-0 self-center ${status === 'live' ? 'block-war-time-live' : ''}`}>
        {block.startTime}
      </span>

      {isEmpty ? (
        <div className="flex flex-1 items-center justify-between gap-3 self-center">
          <span className="block-war-empty-label">Disponible</span>
          <button type="button" onClick={onStartAssign} className="btn-war btn-war-sm text-sm">
            + Asignar
          </button>
        </div>
      ) : (
        <>
          <div className="block-war-body min-w-0 flex-1 self-center">
            <p className="block-war-title" title={block.title}>{block.title}</p>
            <p className="block-war-sub">
              {blockLabels[block.type]}
              {block.type !== 'rest' && ` · +${PLAYER_CONFIG.xpPerBlock} XP`}
            </p>
          </div>

          {!block.completed && block.type !== 'rest' && (
            <div className="block-war-actions-grid shrink-0 self-center">
              {onEdit ? (
                <button type="button" onClick={onEdit} className="btn-icon-war btn-icon-war-lg" title="Editar">✎</button>
              ) : (
                <span className="block-war-grid-spacer" aria-hidden />
              )}
              {onDelete ? (
                <button type="button" onClick={onDelete} className="btn-icon-war btn-icon-war-lg flavor-brutal" title="Eliminar">✕</button>
              ) : (
                <span className="block-war-grid-spacer" aria-hidden />
              )}
              {onComplete ? (
                <button
                  type="button"
                  onClick={onComplete}
                  disabled={isMissed}
                  className={`block-war-complete-btn ${isMissed ? 'block-war-complete-dead' : ''}`}
                  title={isMissed ? 'Bloque muerto — reprograma desde editar' : 'Completar bloque'}
                >
                  ⚔
                </button>
              ) : (
                <span className="block-war-grid-spacer" aria-hidden />
              )}
              <StatusBadge status={status} />
            </div>
          )}

          {block.completed && (
            <div className="block-war-actions-grid shrink-0 self-center">
              <span className="block-war-check block-war-grid-check">✓</span>
              {onUncomplete ? (
                <button
                  type="button"
                  className="block-war-uncomplete"
                  onClick={onUncomplete}
                  title="Desmarcar — revierte XP y progreso"
                >
                  ↩
                </button>
              ) : (
                <span className="block-war-grid-spacer" aria-hidden />
              )}
              <span className="block-war-grid-badge block-war-grid-done">HECHO</span>
              <span className="block-war-grid-spacer" aria-hidden />
            </div>
          )}
        </>
      )}

      <XpFloat amount={PLAYER_CONFIG.xpPerBlock} show={!!xpFloat} />

      <AnimatePresence>
        {assigning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex items-center gap-2 bg-ink/95 px-4"
          >
            <input
              autoFocus
              value={assignTitle}
              onChange={(e) => onAssignTitleChange?.(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onConfirmAssign?.()}
              placeholder="¿Qué estudiarás?"
              className="input-war flex-1 text-base"
            />
            <EpicButton size="sm" onClick={onConfirmAssign}>OK</EpicButton>
            <button type="button" onClick={onCancelAssign} className="text-readable-dim hover:text-highlight text-lg">✕</button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Barra de progreso del día en horario */
export function DayProgressHeader({
  minutes,
  goalMinutes,
  contractsDone = 0,
  contractsTotal = 0,
  goalBlocks = 0,
}: {
  minutes: number;
  goalMinutes: number;
  contractsDone?: number;
  contractsTotal?: number;
  goalBlocks?: number;
}) {
  const pct = Math.min(100, Math.round((minutes / goalMinutes) * 100));
  const blocksTowardGoal = Math.min(goalBlocks, Math.ceil(minutes / 30));
  return (
    <div className="panel-epic mb-4 p-4">
      <div className="panel-epic-inner">
        <p className="label-clear mb-2 text-base">
          Meta del día — {formatGoalHoursMinutes(minutes)} / {formatGoalHoursMinutes(goalMinutes)}
        </p>
        {(contractsTotal > 0 || goalBlocks > 0) && (
          <p className="body-parchment mb-2 text-xs text-readable-dim">
            {blocksTowardGoal}/{goalBlocks} bloques meta
            {contractsTotal > 0 ? ` · ${contractsDone}/${contractsTotal} contratos completados` : ''}
          </p>
        )}
        <div
          className="bar-aura-wrapper rounded-sm p-[3px]"
          style={{ boxShadow: `0 0 16px rgba(${pct >= 75 ? '50,205,50' : pct >= 50 ? '255,215,0' : '220,20,60'},0.35)` }}
        >
          <div className="bar-epic bar-epic-ryg relative h-8 overflow-hidden bar-shimmer">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              className="bar-fill-ryg h-full"
              style={{
                background: 'linear-gradient(90deg, #8B0000, #FF6347, #FFD700, #32CD32)',
                boxShadow: pct >= 75 ? '0 0 12px rgba(50,205,50,0.6)' : '0 0 10px rgba(255,99,71,0.5)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
