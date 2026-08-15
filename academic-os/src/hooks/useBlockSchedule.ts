import { useMemo } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { getBlockSchedule, type BlockSchedule } from '../utils/blockSchedule';
import {
  getActiveSchedulePeriods,
  getSchedulePeriods,
  type DayPeriodDef,
} from '../utils/dayPeriods';

export function useBlockSchedule(): BlockSchedule {
  const dayBlockStart = usePlayerStore((s) => s.player?.dayBlockStart);
  const dayBlockEnd = usePlayerStore((s) => s.player?.dayBlockEnd);
  const player = usePlayerStore((s) => s.player);

  return useMemo(() => getBlockSchedule(player), [player, dayBlockStart, dayBlockEnd]);
}

export function useSchedulePeriods(): DayPeriodDef[] {
  const schedule = useBlockSchedule();
  return useMemo(() => getActiveSchedulePeriods(schedule), [schedule.start, schedule.end]);
}

export function useSchedulePeriodMap(): DayPeriodDef[] {
  const schedule = useBlockSchedule();
  return useMemo(() => getSchedulePeriods(schedule), [schedule.start, schedule.end]);
}
