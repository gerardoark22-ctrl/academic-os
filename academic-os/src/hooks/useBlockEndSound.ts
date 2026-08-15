import { useEffect, useRef } from 'react';
import { useTimeStore } from '../stores/timeStore';
import { getBlockRemainingMs, isBlockAssigned, todayLocalISO } from '../utils/localTime';
import { notifyBlockEnded } from '../utils/blockEndNotify';

/** Programa sonido al llegar endTime de cada bloque asignado hoy (sin avisos retroactivos). */
export function useBlockEndSound(): void {
  const blocks = useTimeStore((s) => s.blocks);
  const today = todayLocalISO();
  const timersRef = useRef<Map<string, number>>(new Map());
  const skippedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const now = new Date();
    const relevant = blocks.filter(
      (b) => b.date === today && isBlockAssigned(b),
    );

    for (const [id, timerId] of timersRef.current) {
      if (!relevant.some((b) => b.id === id && !b.completed)) {
        window.clearTimeout(timerId);
        timersRef.current.delete(id);
      }
    }

    for (const block of relevant) {
      if (block.completed) {
        const pending = timersRef.current.get(block.id);
        if (pending !== undefined) {
          window.clearTimeout(pending);
          timersRef.current.delete(block.id);
        }
        skippedRef.current.add(block.id);
        continue;
      }

      if (skippedRef.current.has(block.id) || timersRef.current.has(block.id)) continue;

      const remainingMs = getBlockRemainingMs(block, now);
      if (remainingMs <= 0) {
        skippedRef.current.add(block.id);
        continue;
      }

      const timerId = window.setTimeout(() => {
        timersRef.current.delete(block.id);
        skippedRef.current.add(block.id);

        const current = useTimeStore.getState().blocks.find((b) => b.id === block.id);
        if (!current || current.completed || !isBlockAssigned(current)) return;

        void notifyBlockEnded(current, useTimeStore.getState().blocks);
      }, remainingMs + 80);

      timersRef.current.set(block.id, timerId);
    }
  }, [blocks, today]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timerId of timers.values()) window.clearTimeout(timerId);
      timers.clear();
    };
  }, []);
}
