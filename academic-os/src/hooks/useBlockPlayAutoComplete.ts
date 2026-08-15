import { useEffect, useRef, useState } from 'react';

import type { TimeBlock } from '../types';

import { hasBlockSlotEnded } from '../utils/localTime';

import { useTimeStore } from '../stores/timeStore';



/** Completa bloques con sesión play activa al llegar endTime del slot */

export function useBlockPlayAutoComplete(blocks: TimeBlock[], enabled: boolean) {

  const completeBlockPlaySession = useTimeStore((s) => s.completeBlockPlaySession);

  const completingRef = useRef<Set<string>>(new Set());

  const hasPlaySession = enabled && blocks.some((b) => b.playStartedAt && !b.completed);

  const [now, setNow] = useState(() => new Date());



  useEffect(() => {

    if (!hasPlaySession) return;

    setNow(new Date());

    const id = window.setInterval(() => setNow(new Date()), 1000);

    return () => window.clearInterval(id);

  }, [hasPlaySession]);



  useEffect(() => {

    if (!enabled) return;



    const pending = blocks.filter(

      (b) => b.playStartedAt && !b.completed && hasBlockSlotEnded(b, now),

    );



    for (const block of pending) {

      if (completingRef.current.has(block.id)) continue;

      completingRef.current.add(block.id);

      void completeBlockPlaySession(block.id)

        .catch((err) => console.error('auto-complete block failed:', block.id, err))

        .finally(() => {

          completingRef.current.delete(block.id);

        });

    }

  }, [blocks, now, enabled, completeBlockPlaySession]);

}

