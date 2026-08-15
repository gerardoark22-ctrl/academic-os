import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { EpicModal, EpicButton } from '../ui';
import { useTimeStore } from '../../stores/timeStore';
import { useCoursesStore } from '../../stores/coursesStore';
import { useMissionsStore } from '../../stores/missionsStore';
import { resolveBlockContractTitle } from '../../utils/blockTitle';
import type { DayPeriod } from '../../utils/dayPeriods';
import { formatPeriodButtonLabel, formatPeriodRange } from '../../utils/dayPeriods';
import { useBlockSchedule, useSchedulePeriods } from '../../hooks/useBlockSchedule';
import type { BlockAssignPayload, BlockType, TimeBlock } from '../../types';
import { todayISO } from '../../utils/gamification';

interface ExportToBlockModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  blockType: BlockType;
  payload: Omit<BlockAssignPayload, 'title' | 'type'>;
  courseColor?: string;
}

function buildLinkPayload(payload: Omit<BlockAssignPayload, 'title' | 'type'>): Omit<BlockAssignPayload, 'title' | 'type'> {
  const link: Omit<BlockAssignPayload, 'title' | 'type'> = {};
  if (payload.courseId) link.courseId = payload.courseId;
  if (payload.unitId) link.unitId = payload.unitId;
  if (payload.topicId) link.topicId = payload.topicId;
  if (payload.subtopicId) link.subtopicId = payload.subtopicId;
  if (payload.missionId) link.missionId = payload.missionId;
  return link;
}

function blockMatchesSource(
  b: TimeBlock,
  src: Omit<BlockAssignPayload, 'title' | 'type'>,
): boolean {
  if (src.missionId) return b.missionId === src.missionId;
  if (src.subtopicId) {
    return (
      b.subtopicId === src.subtopicId
      && b.topicId === src.topicId
      && b.courseId === src.courseId
      && b.unitId === src.unitId
    );
  }
  if (src.topicId) {
    return (
      b.topicId === src.topicId
      && b.courseId === src.courseId
      && b.unitId === src.unitId
      && !b.subtopicId
    );
  }
  return false;
}

function isBlockEmpty(b: TimeBlock): boolean {
  return (!b.title || b.type === 'rest') && !b.completed;
}

export function ExportToBlockModal({
  open,
  onClose,
  title,
  blockType,
  payload,
  courseColor = '#CD853F',
}: ExportToBlockModalProps) {
  const assignBlocksFull = useTimeStore((s) => s.assignBlocksFull);
  const blocksRevision = useTimeStore((s) => s.blocksRevision);
  const courses = useCoursesStore((s) => s.courses);
  const missions = useMissionsStore((s) => s.missions);
  const schedule = useBlockSchedule();
  const periods = useSchedulePeriods();
  const linkPayload = useMemo(() => buildLinkPayload(payload), [payload]);
  const contractTitle = useMemo(
    () => resolveBlockContractTitle(courses, missions, title, payload),
    [courses, missions, title, payload],
  );

  const [step, setStep] = useState<'period' | 'blocks'>('period');
  const [period, setPeriod] = useState<DayPeriod | null>(null);
  const [date, setDate] = useState(todayISO());
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep('period');
      setPeriod(null);
      setSelected(new Set());
      setDone(false);
      setAssigning(false);
      setDate(todayISO());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setStep('period');
    setPeriod(null);
    setSelected(new Set());
    setBlocks([]);
  }, [open, date, schedule.start, schedule.end, blocksRevision]);

  const loadBlocks = async (p: DayPeriod) => {
    const list = await useTimeStore.getState().getBlocksByPeriod(date, p);
    const seen = new Set<string>();
    const unique = list.filter((b) => {
      if (seen.has(b.startTime)) return false;
      seen.add(b.startTime);
      return true;
    });
    setBlocks(unique);
    setSelected(new Set());
    setStep('blocks');
  };

  const toggleBlock = (blockId: string) => {
    const b = blocks.find((x) => x.id === blockId);
    if (!b || !isBlockEmpty(b)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  };

  const handleAssign = async () => {
    if (selected.size === 0 || assigning) return;
    setAssigning(true);
    try {
      const ids = [...selected]
        .filter((id) => {
          const b = blocks.find((x) => x.id === id);
          return b && isBlockEmpty(b);
        })
        .sort((a, b) => {
          const ba = blocks.find((x) => x.id === a);
          const bb = blocks.find((x) => x.id === b);
          return (ba?.startTime ?? '').localeCompare(bb?.startTime ?? '');
        });

      if (ids.length === 0) return;

      await assignBlocksFull(ids, { title: contractTitle, type: blockType, ...linkPayload });
      setDone(true);
      setTimeout(onClose, 1400);
    } finally {
      setAssigning(false);
    }
  };

  const emptySelectedCount = [...selected].filter((id) => {
    const b = blocks.find((x) => x.id === id);
    return b && isBlockEmpty(b);
  }).length;

  const activePeriod = periods.find((p) => p.key === period);

  return (
    <EpicModal open={open} onClose={onClose} title="Exportar al Horario" flavor={`${contractTitle} — selecciona bloques de 30 min`}>
      <div className="space-y-4">
        <div>
          <label className="label-clear text-sm">Fecha</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-war mt-1 w-full" />
        </div>

        <p className="body-parchment text-xs text-readable-dim">
          Horario del reloj: {schedule.start} → {schedule.end}
        </p>

        {step === 'period' && (
          <>
            <p className="body-parchment text-sm">Elige turno — sincronizado con tu rango del Reloj de ceniza</p>
            <div className={`grid gap-2 ${periods.length === 1 ? 'grid-cols-1' : periods.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {periods.map((p) => (
                <EpicButton
                  key={p.key}
                  size="sm"
                  variant={period === p.key ? 'gold' : 'ghost'}
                  className="w-full !px-2 !py-3"
                  onClick={() => {
                    setPeriod(p.key);
                    void loadBlocks(p.key);
                  }}
                >
                  <span className="block">{formatPeriodButtonLabel(p)}</span>
                  <span className="mt-1 block text-[10px] opacity-80">{formatPeriodRange(p)}</span>
                </EpicButton>
              ))}
            </div>
          </>
        )}

        {step === 'blocks' && period && activePeriod && (
          <>
            <div className="flex items-center justify-between">
              <p className="label-clear text-sm">
                {formatPeriodButtonLabel(activePeriod)} ({formatPeriodRange(activePeriod)}) — {emptySelectedCount} seleccionado{emptySelectedCount !== 1 ? 's' : ''}
              </p>
              <button type="button" onClick={() => setStep('period')} className="text-readable-dim text-xs hover:text-highlight">← Cambiar turno</button>
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {blocks.length === 0 ? (
                <p className="body-parchment text-sm text-readable-dim">No hay slots en este turno para la fecha elegida.</p>
              ) : (
                blocks.map((b) => {
                  const empty = isBlockEmpty(b);
                  const linked = !empty && blockMatchesSource(b, linkPayload);
                  const checked = selected.has(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      disabled={!empty}
                      onClick={() => toggleBlock(b.id)}
                      className={`block-slot-select relative flex w-full items-center gap-3 px-3 py-2.5 text-left ${
                        empty
                          ? checked
                            ? 'block-slot-selected'
                            : 'block-slot-empty'
                          : linked
                            ? 'block-slot-linked opacity-80'
                            : 'block-slot-occupied opacity-50'
                      }`}
                      style={empty || linked ? { borderLeftColor: courseColor } : undefined}
                    >
                      {(empty || linked) && (
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center border-2 text-[10px] ${checked && empty ? 'border-gold-bright bg-gold-bright/20 text-gold-bright' : 'border-ink/50'}`}>
                          {checked && empty ? '✓' : linked ? '•' : ''}
                        </span>
                      )}
                      <span className="stat-epic text-xs">{b.startTime}</span>
                      <span className="body-parchment text-sm">
                        {empty ? 'Disponible' : linked ? `${b.title} (ya asignado)` : b.title}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <EpicButton className="w-full" disabled={emptySelectedCount === 0 || done || assigning} onClick={handleAssign}>
              {assigning
                ? 'Asignando…'
                : `Asignar ${emptySelectedCount || ''} bloque${emptySelectedCount !== 1 ? 's' : ''} (${emptySelectedCount * 30} min)`}
            </EpicButton>
          </>
        )}

        {done && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flavor-brutal text-center">
            ✓ Bloques asignados — revisa Horario
          </motion.p>
        )}
      </div>
    </EpicModal>
  );
}
