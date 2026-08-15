import { useState, useMemo } from 'react';
import { useTimeStore } from '../../stores/timeStore';
import { useMissionsStore } from '../../stores/missionsStore';
import { usePlayerStore } from '../../stores/playerStore';
import { getDailyGoalMinutes, formatGoalHoursMinutes } from '../../utils/dailyGoal';
import { getBlockLiveStatus, todayLocalISO } from '../../utils/localTime';
import { useLiveClock } from '../../hooks/useLiveClock';
import { StoneCard, SectionTitle, EpicButton } from '../ui';
import { WarBlock, DayProgressHeader } from './WarBlock';
import { AssignedDayBlocksPanel } from './AssignedDayBlocksPanel';
import { GreekPeruClock } from './GreekPeruClock';
import { BlockEditModal } from './BlockEditModal';
import { BlockScheduleModal } from './BlockScheduleModal';
import { SECTIONS } from '../../utils/uiCopy';
import { exportCombinedICS } from '../../utils/icsExport';
import { useBlockPlayAutoComplete } from '../../hooks/useBlockPlayAutoComplete';
import { useTodayStudyMinutes } from '../../hooks/useTodayStudyMinutes';
import { useBlockSchedule, useSchedulePeriodMap } from '../../hooks/useBlockSchedule';
import { formatPeriodButtonLabel, formatPeriodRange, partitionBySchedulePeriod } from '../../utils/dayPeriods';
import { countAssignedContracts } from '../../utils/studyProgress';
import { PLAYER_CONFIG } from '../../utils/playerConfig';

export function SunDialTimeBlocking() {
  const blocks = useTimeStore((s) => s.blocks);
  const missions = useMissionsStore((s) => s.missions);
  const selectedDate = useTimeStore((s) => s.selectedDate);
  const setDate = useTimeStore((s) => s.setDate);
  const completeBlock = useTimeStore((s) => s.completeBlock);
  const uncompleteBlock = useTimeStore((s) => s.uncompleteBlock);
  const startBlockPlay = useTimeStore((s) => s.startBlockPlay);
  const assignBlock = useTimeStore((s) => s.assignBlock);
  const deleteBlockContent = useTimeStore((s) => s.deleteBlockContent);
  const moveBlock = useTimeStore((s) => s.moveBlock);
  const draggedBlock = useTimeStore((s) => s.draggedBlock);
  const setDraggedBlock = useTimeStore((s) => s.setDraggedBlock);
  const player = usePlayerStore((s) => s.player);
  const todayMinutes = useTodayStudyMinutes();
  const schedule = useBlockSchedule();
  const periodDefs = useSchedulePeriodMap();

  const [xpFloat, setXpFloat] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assignTitle, setAssignTitle] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const goalMinutes = getDailyGoalMinutes(player);
  const now = useLiveClock(15_000);
  const todayLocal = todayLocalISO();
  const isToday = selectedDate === todayLocal;

  /** Evita duplicados visuales por startTime (respaldo UI) */
  const uniqueBlocks = useMemo(() => {
    const seen = new Set<string>();
    return blocks
      .filter((b) => {
        if (seen.has(b.startTime)) return false;
        seen.add(b.startTime);
        return true;
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [blocks]);

  useBlockPlayAutoComplete(uniqueBlocks, isToday);

  const blocksByPeriod = useMemo(
    () => partitionBySchedulePeriod(uniqueBlocks, schedule),
    [uniqueBlocks, schedule.start, schedule.end],
  );

  const contracts = useMemo(
    () => (isToday ? countAssignedContracts(uniqueBlocks, todayLocal) : { done: 0, total: 0 }),
    [uniqueBlocks, isToday, todayLocal],
  );

  const goalBlocks = Math.max(1, Math.ceil(goalMinutes / PLAYER_CONFIG.blockMinutes));

  const handleComplete = async (id: string) => {
    await completeBlock(id);
    setXpFloat(id);
    setTimeout(() => setXpFloat(null), 1500);
  };

  const handleUncomplete = async (id: string) => {
    await uncompleteBlock(id);
  };

  const handleDrop = (targetId: string) => {
    if (draggedBlock && draggedBlock.id !== targetId) {
      moveBlock(draggedBlock.id, targetId);
    }
    setDraggedBlock(null);
  };

  const handleAssign = async (blockId: string) => {
    if (!assignTitle.trim()) return;
    await assignBlock(blockId, assignTitle, 'study');
    setAssigningId(null);
    setAssignTitle('');
  };

  const editingBlock = editingId ? uniqueBlocks.find((b) => b.id === editingId) : null;

  const renderPeriod = (title: string, subtitle: string, periodBlocks: typeof blocks) => (
    <StoneCard>
      <h3 className="period-header !text-xs">{title}</h3>
      <p className="body-parchment mb-2 text-[10px] text-readable-dim">{subtitle}</p>
      <div className="max-h-[52vh] overflow-y-auto pr-1">
        {periodBlocks.map((block) => (
          <WarBlock
            key={block.id}
            block={block}
            liveStatus={isToday ? getBlockLiveStatus(block, now) : undefined}
            isDragOver={draggedBlock?.id === block.id}
            xpFloat={xpFloat === block.id}
            assigning={assigningId === block.id}
            assignTitle={assignTitle}
            onAssignTitleChange={setAssignTitle}
            onStartAssign={() => setAssigningId(block.id)}
            onCancelAssign={() => setAssigningId(null)}
            onConfirmAssign={() => handleAssign(block.id)}
            onComplete={() => handleComplete(block.id)}
            onUncomplete={() => handleUncomplete(block.id)}
            onEdit={() => setEditingId(block.id)}
            onDelete={() => deleteBlockContent(block.id)}
            onDragStart={() => setDraggedBlock(block)}
            onDrop={() => handleDrop(block.id)}
          />
        ))}
      </div>
    </StoneCard>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle title={SECTIONS.time.title} flavor={SECTIONS.time.flavor} className="mb-0" />
        <div className="flex flex-wrap items-center gap-2">
          {isToday && <GreekPeruClock now={now} />}
          <EpicButton size="sm" variant="ghost" onClick={() => setScheduleOpen(true)} title="Rango horario de bloques">
            ⚙
          </EpicButton>
          <EpicButton
            variant="ghost"
            size="sm"
            onClick={() => exportCombinedICS(
              missions.filter((m) => !m.completed),
              blocks,
              `horario-${selectedDate}.ics`,
            )}
          >
            📅 Exportar ICS
          </EpicButton>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setDate(e.target.value)}
            className="input-war"
          />
        </div>
      </div>

      {isToday && (
        <>
          <DayProgressHeader
            minutes={todayMinutes}
            goalMinutes={goalMinutes}
            contractsDone={contracts.done}
            contractsTotal={contracts.total}
            goalBlocks={goalBlocks}
          />
          <AssignedDayBlocksPanel
            blocks={uniqueBlocks}
            isToday={isToday}
            now={now}
            onComplete={handleComplete}
            onUncomplete={handleUncomplete}
            onEdit={(id) => setEditingId(id)}
            onStartPlay={(id) => void startBlockPlay(id)}
          />
        </>
      )}

      <div className={`grid grid-cols-1 gap-5 ${periodDefs.length >= 3 ? 'xl:grid-cols-3' : periodDefs.length === 2 ? 'md:grid-cols-2' : ''}`}>
        {periodDefs.map((p) =>
          renderPeriod(
            formatPeriodButtonLabel(p),
            formatPeriodRange(p),
            blocksByPeriod[p.key],
          ),
        )}
      </div>

      {editingBlock && (
        <BlockEditModal
          block={editingBlock}
          isMissed={isToday && getBlockLiveStatus(editingBlock, now) === 'missed'}
          now={now}
          onClose={() => setEditingId(null)}
          onSaved={() => setEditingId(null)}
        />
      )}

      <BlockScheduleModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} />

      <p className="body-parchment text-center text-sm text-readable-dim">
        Arrastra · ✎ editar/reprogramar · ✕ eliminar · ⚔ completar · ▶ play en Contratos (XP al cerrar hora) · Meta {formatGoalHoursMinutes(goalMinutes)}/día
      </p>
    </div>
  );
}
