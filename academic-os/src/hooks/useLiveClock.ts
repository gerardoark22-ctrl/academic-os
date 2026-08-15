import { useEffect, useState } from 'react';

/** Tick del reloj local para actualizar estados de bloques (cada 30s). */
export function useLiveClock(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
