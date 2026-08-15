import { useMemo } from 'react';
import { useMissionsStore } from '../stores/missionsStore';
import type { Mission } from '../types';

/** Misiones activas — evita selector Zustand que devuelve array nuevo (loop React 19) */
export function useActiveMissions(): Mission[] {
  const missions = useMissionsStore((s) => s.missions);
  return useMemo(() => missions.filter((m) => !m.completed), [missions]);
}

export function useSortedActiveMissions(): Mission[] {
  const active = useActiveMissions();
  return useMemo(
    () => [...active].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [active],
  );
}
