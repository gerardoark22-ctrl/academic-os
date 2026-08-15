import { useEffect, useRef, useMemo } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { useTimeStore } from '../stores/timeStore';
import { countStudyMinutesFromBlocks, resolveTodayStudyMinutes } from '../utils/studyProgress';
import { getEffectiveTodayStudyMinutes } from '../utils/gamification';
import { todayLocalISO } from '../utils/localTime';

/** Minutos de estudio hoy — sincronizado entre dashboard, horario y misiones. */
export function useTodayStudyMinutes(): number {
  const player = usePlayerStore((s) => s.player);
  const blocks = useTimeStore((s) => s.blocks);
  const selectedDate = useTimeStore((s) => s.selectedDate);
  const blocksRevision = useTimeStore((s) => s.blocksRevision);
  const lastActiveDate = player?.lastActiveDate;
  const today = todayLocalISO();
  const rolloverBusy = useRef(false);

  useEffect(() => {
    if (!lastActiveDate || lastActiveDate === today || rolloverBusy.current) return;
    rolloverBusy.current = true;
    void usePlayerStore
      .getState()
      .ensureDailyRollover()
      .finally(() => {
        rolloverBusy.current = false;
      });
  }, [lastActiveDate, today]);

  return useMemo(() => {
    if (selectedDate === today) {
      return resolveTodayStudyMinutes(player, blocks);
    }
    return getEffectiveTodayStudyMinutes(player);
  }, [player, blocks, blocksRevision, selectedDate, today]);
}

/** Minutos en la fecha seleccionada del horario (puede ser un día pasado). */
export function useSelectedDateStudyMinutes(): number {
  const blocks = useTimeStore((s) => s.blocks);
  const selectedDate = useTimeStore((s) => s.selectedDate);
  const blocksRevision = useTimeStore((s) => s.blocksRevision);
  return useMemo(
    () => countStudyMinutesFromBlocks(blocks, selectedDate),
    [blocks, selectedDate, blocksRevision],
  );
}
