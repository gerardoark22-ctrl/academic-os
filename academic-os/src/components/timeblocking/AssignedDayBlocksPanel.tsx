import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { TimeBlock } from '../../types';
import {
  getBlockLiveStatus,
  getBlockRemainingMs,
  getBlockSlotProgress,
  formatRemainingClock,
  type BlockLiveStatus,
} from '../../utils/localTime';
import { useLiveClock } from '../../hooks/useLiveClock';

const TYPE_ICON: Record<string, string> = {
  study: '📜',
  exam: '⚔',
  task: '🗡️',
  rest: '💤',
};

function isAssignedBlock(b: TimeBlock): boolean {
  return !!b.title && b.type !== 'rest';
}

interface Props {
  blocks: TimeBlock[];
  isToday?: boolean;
  now?: Date;
  onComplete?: (blockId: string) => void;
  onUncomplete?: (blockId: string) => void;
  onEdit?: (blockId: string) => void;
  onStartPlay?: (blockId: string) => void;
}

export function AssignedDayBlocksPanel({
  blocks,
  isToday = false,
  now: nowProp,
  onComplete,
  onUncomplete,
  onEdit,
  onStartPlay,
}: Props) {
  const assigned = blocks.filter(isAssignedBlock).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const hasActivePlay = isToday && assigned.some((b) => b.playStartedAt && !b.completed);

  const tickNow = useLiveClock(hasActivePlay ? 1000 : 30_000);
  const now = hasActivePlay ? tickNow : (nowProp ?? new Date());

  if (assigned.length === 0) return null;

  const pending = assigned.filter((b) => !b.completed);
  const done = assigned.length - pending.length;
  const pct = Math.round((done / assigned.length) * 100);

  const hasLiveBlock = isToday && assigned.some((b) => getBlockLiveStatus(b, now) === 'live');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="assigned-blocks-divine mb-5"
    >
      <div className="assigned-blocks-divine-aura" aria-hidden />
      <div className="assigned-blocks-divine-inner">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="assigned-blocks-divine-kicker">
              {hasLiveBlock ? '⚡ AHORA · Contratos del día' : '⚡ Contratos del día'}
            </p>
            <h3 className="assigned-blocks-divine-title">
              {hasLiveBlock
                ? 'Bloque activo — pulsa ▶ y conquista hasta que suene la hora'
                : pending.length > 0
                  ? `${pending.length} pendiente${pending.length !== 1 ? 's' : ''} por conquistar`
                  : '¡Todos los bloques asignados completados!'}
            </h3>
          </div>
          <div className="text-right">
            <p className="stat-epic text-2xl text-gold-bright tabular-nums">{done}/{assigned.length}</p>
            <p className="text-readable-dim text-xs uppercase tracking-wider">bloques del día</p>
          </div>
        </div>

        <div className="assigned-blocks-divine-track mt-3">
          <motion.div
            className="assigned-blocks-divine-fill"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>

        <ul className="assigned-blocks-divine-list mt-4 space-y-2">
          {assigned.map((block, i) => (
            <AssignedBlockRow
              key={block.id}
              block={block}
              index={i}
              isToday={isToday}
              now={now}
              onComplete={onComplete}
              onUncomplete={onUncomplete}
              onEdit={onEdit}
              onStartPlay={onStartPlay}
            />
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

function AssignedBlockRow({
  block,
  index,
  isToday,
  now,
  onComplete,
  onUncomplete,
  onEdit,
  onStartPlay,
}: {
  block: TimeBlock;
  index: number;
  isToday: boolean;
  now: Date;
  onComplete?: (blockId: string) => void;
  onUncomplete?: (blockId: string) => void;
  onEdit?: (blockId: string) => void;
  onStartPlay?: (blockId: string) => void;
}) {
  const liveStatus: BlockLiveStatus = isToday ? getBlockLiveStatus(block, now) : 'future';
  const isLive = liveStatus === 'live';
  const isMissed = liveStatus === 'missed';
  const isPending = !block.completed;
  const isPlaying = isLive && isPending && !!block.playStartedAt;

  const remainingMs = useMemo(
    () => (isPlaying ? getBlockRemainingMs(block, now) : 0),
    [block, now, isPlaying],
  );
  const slotProgress = useMemo(
    () => (isPlaying ? getBlockSlotProgress(block, now) : 0),
    [block, now, isPlaying],
  );

  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className={[
        'assigned-blocks-divine-item',
        isLive ? 'assigned-blocks-divine-item-live' : '',
        isMissed && isPending ? 'assigned-blocks-divine-item-missed' : '',
        isPending && !isLive && !isMissed ? 'assigned-blocks-divine-item-pending' : '',
        !isPending ? 'assigned-blocks-divine-item-done' : '',
        isPlaying ? 'assigned-blocks-divine-item-playing' : '',
      ].filter(Boolean).join(' ')}
    >
      {isLive && <span className="assigned-blocks-divine-item-glow" aria-hidden />}
      <span className={`assigned-blocks-divine-time ${isLive ? 'assigned-blocks-divine-time-live' : ''}`}>
        {block.startTime}
      </span>
      <span className="assigned-blocks-divine-icon">{TYPE_ICON[block.type] ?? '•'}</span>
      <div className="assigned-blocks-divine-body min-w-0 flex-1">
        <span className="assigned-blocks-divine-label truncate">{block.title}</span>
        {isPlaying && (
          <>
            <div className="assigned-blocks-play-track mt-1.5">
              <div
                className="assigned-blocks-play-fill"
                style={{ width: `${slotProgress}%` }}
              />
            </div>
            <p className="assigned-blocks-play-clock mt-0.5 tabular-nums">
              ⏱ {formatRemainingClock(remainingMs)} · sincronizado con {block.endTime}
            </p>
          </>
        )}
      </div>
      {isLive && isPending && !isPlaying && (
        <span className="assigned-blocks-divine-badge-live">⚡ AHORA</span>
      )}
      {isMissed && isPending && (
        <span className="assigned-blocks-divine-badge-missed">☠ MUERTO</span>
      )}
      {isPending ? (
        <div className="flex shrink-0 items-center gap-1.5">
          {onEdit && (
            <button
              type="button"
              className="assigned-blocks-divine-edit"
              onClick={() => onEdit(block.id)}
              title="Editar / reprogramar"
            >
              ✎
            </button>
          )}
          {isLive && onStartPlay && !block.playStartedAt && (
            <button
              type="button"
              className="assigned-blocks-divine-play"
              onClick={() => onStartPlay(block.id)}
              title="Iniciar sesión — XP al terminar la hora del bloque"
            >
              ▶
            </button>
          )}
          {isPlaying && (
            <span className="assigned-blocks-divine-badge-playing">EN CURSO</span>
          )}
          {!isLive && onComplete && (
            <button
              type="button"
              className={`assigned-blocks-divine-complete ${isMissed ? 'assigned-blocks-divine-complete-dead' : ''}`}
              onClick={() => !isMissed && onComplete(block.id)}
              disabled={isMissed}
              title={isMissed ? 'Muerto — reprograma desde editar' : 'Completar bloque'}
            >
              ⚔
            </button>
          )}
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <span className="assigned-blocks-divine-badge-done">✓ HECHO</span>
          {onUncomplete && (
            <button
              type="button"
              className="assigned-blocks-divine-uncomplete"
              onClick={() => onUncomplete(block.id)}
              title="Desmarcar — revierte XP y progreso"
            >
              ↩
            </button>
          )}
        </div>
      )}
    </motion.li>
  );
}
