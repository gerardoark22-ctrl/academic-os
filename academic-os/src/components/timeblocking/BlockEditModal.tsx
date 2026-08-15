import { useEffect, useMemo, useState } from 'react';
import { EpicButton } from '../ui';
import { useTimeStore } from '../../stores/timeStore';
import type { TimeBlock } from '../../types';
import {
  allDaySlotTimes,
  getLocalParts,
  minutesFromHHMM,
  todayLocalISO,
  tomorrowLocalISO,
} from '../../utils/localTime';

interface Props {
  block: TimeBlock;
  isMissed: boolean;
  now: Date;
  onClose: () => void;
  onSaved: () => void;
}

type RescheduleDay = 'today' | 'tomorrow';

function isSlotEmpty(b: TimeBlock, excludeId: string): boolean {
  if (b.id === excludeId) return true;
  return !b.title || b.type === 'rest';
}

export function BlockEditModal({ block, isMissed, now, onClose, onSaved }: Props) {
  const updateBlock = useTimeStore((s) => s.updateBlock);
  const rescheduleBlock = useTimeStore((s) => s.rescheduleBlock);
  const getBlocksForDate = useTimeStore((s) => s.getBlocksForDate);

  const [title, setTitle] = useState(block.title);
  const [rescheduleDay, setRescheduleDay] = useState<RescheduleDay>('today');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [wantReschedule, setWantReschedule] = useState(isMissed);
  const [dayBlocks, setDayBlocks] = useState<TimeBlock[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const today = todayLocalISO();
  const tomorrow = tomorrowLocalISO();
  const targetDate = rescheduleDay === 'today' ? today : tomorrow;

  useEffect(() => {
    let cancelled = false;
    void getBlocksForDate(targetDate).then((blocks) => {
      if (!cancelled) setDayBlocks(blocks);
    });
    return () => { cancelled = true; };
  }, [targetDate, getBlocksForDate]);

  const availableSlots = useMemo(() => {
    const { dateISO, timeHHMM } = getLocalParts(now);
    const nowMin = minutesFromHHMM(timeHHMM);
    return allDaySlotTimes().filter((slot) => {
      const slotBlock = dayBlocks.find((b) => b.startTime === slot);
      if (!slotBlock || !isSlotEmpty(slotBlock, block.id)) return false;
      if (targetDate === today && dateISO === today) {
        return minutesFromHHMM(slot) >= nowMin;
      }
      return true;
    });
  }, [dayBlocks, block.id, targetDate, today, now]);

  useEffect(() => {
    if (availableSlots.length === 0) {
      setRescheduleTime('');
      return;
    }
    if (!availableSlots.includes(rescheduleTime)) {
      setRescheduleTime(availableSlots[0]);
    }
  }, [availableSlots, rescheduleTime]);

  const handleSave = async () => {
    if (!title.trim()) {
      setError('El título no puede estar vacío.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      if (title.trim() !== block.title) {
        await updateBlock(block.id, { title: title.trim() });
      }

      if (wantReschedule && rescheduleTime) {
        const sameSlot =
          targetDate === block.date && rescheduleTime === block.startTime;
        if (!sameSlot) {
          const result = await rescheduleBlock(block.id, targetDate, rescheduleTime);
          if (result === 'slot_occupied') {
            setError('Ese horario ya está ocupado. Elige otro.');
            setSaving(false);
            return;
          }
          if (result === 'not_found') {
            setError('No se pudo reprogramar el bloque.');
            setSaving(false);
            return;
          }
        }
      }

      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4">
      <div className="panel-epic w-full max-w-lg p-4">
        <p className="label-clear mb-1">Editar bloque</p>
        <p className="text-readable-dim mb-3 text-sm">
          {block.startTime} · {block.date}
          {isMissed && (
            <span className="ml-2 text-red-400">☠ MUERTO — reprograma para recuperarlo</span>
          )}
        </p>

        <label className="label-clear mb-1 block text-sm">Título</label>
        <input
          className="input-war mb-4 w-full"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        <div className={`block-edit-reschedule ${isMissed ? 'block-edit-reschedule-urgent' : ''}`}>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={wantReschedule}
              onChange={(e) => setWantReschedule(e.target.checked)}
              className="accent-gold-bright"
            />
            <span className="label-clear text-sm">Reprogramar (hoy o mañana)</span>
          </label>

          {wantReschedule && (
            <div className="mt-3 space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`block-edit-day-btn ${rescheduleDay === 'today' ? 'block-edit-day-btn-active' : ''}`}
                  onClick={() => setRescheduleDay('today')}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  className={`block-edit-day-btn ${rescheduleDay === 'tomorrow' ? 'block-edit-day-btn-active' : ''}`}
                  onClick={() => setRescheduleDay('tomorrow')}
                >
                  Mañana
                </button>
              </div>

              {availableSlots.length > 0 ? (
                <select
                  className="input-war w-full"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                >
                  {availableSlots.map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              ) : (
                <p className="text-readable-dim text-sm">
                  No hay horarios libres {rescheduleDay === 'today' ? 'hoy' : 'mañana'}. Prueba el otro día.
                </p>
              )}
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          <EpicButton size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </EpicButton>
          <EpicButton size="sm" variant="ghost" onClick={onClose}>Cancelar</EpicButton>
        </div>
      </div>
    </div>
  );
}
