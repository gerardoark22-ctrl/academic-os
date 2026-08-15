import { useState, useEffect } from 'react';
import { EpicModal, EpicButton } from '../ui';
import { usePlayerStore } from '../../stores/playerStore';
import {
  DEFAULT_BLOCK_END,
  DEFAULT_BLOCK_START,
  getBlockSchedule,
  validateBlockSchedule,
} from '../../utils/blockSchedule';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function BlockScheduleModal({ open, onClose }: Props) {
  const player = usePlayerStore((s) => s.player);
  const updateBlockSchedule = usePlayerStore((s) => s.updateBlockSchedule);
  const schedule = getBlockSchedule(player);
  const [start, setStart] = useState(schedule.start);
  const [end, setEnd] = useState(schedule.end);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStart(schedule.start);
      setEnd(schedule.end);
      setError(null);
    }
  }, [open, schedule.start, schedule.end]);

  const handleSave = async () => {
    const err = validateBlockSchedule(start, end);
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateBlockSchedule(start, end);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <EpicModal
      open={open}
      onClose={onClose}
      title="Rango del Reloj de ceniza"
      flavor="Horario Perú · slots de 30 min"
    >
      <div className="space-y-3">
        <p className="body-parchment text-sm text-readable-dim">
          Define desde qué hora hasta cuándo aparecen bloques cada día. Útil si estudias de madrugada.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="body-parchment text-xs">
            Desde
            <input
              type="time"
              className="input-war mt-1 w-full"
              value={start}
              step={1800}
              onChange={(e) => setStart(e.target.value || DEFAULT_BLOCK_START)}
            />
          </label>
          <label className="body-parchment text-xs">
            Hasta (exclusivo)
            <input
              type="time"
              className="input-war mt-1 w-full"
              value={end}
              step={1800}
              onChange={(e) => setEnd(e.target.value || DEFAULT_BLOCK_END)}
            />
          </label>
        </div>
        <p className="text-xs text-readable-dim">
          Actual: {schedule.start} → {schedule.end} · Default {DEFAULT_BLOCK_START}–{DEFAULT_BLOCK_END}
        </p>
        {error && <p className="flavor-brutal text-sm">{error}</p>}
        <div className="flex gap-2">
          <EpicButton className="flex-1" disabled={saving} onClick={() => void handleSave()}>
            {saving ? '…' : 'Guardar y regenerar día'}
          </EpicButton>
          <EpicButton variant="ghost" onClick={onClose}>
            Cancelar
          </EpicButton>
        </div>
      </div>
    </EpicModal>
  );
}
