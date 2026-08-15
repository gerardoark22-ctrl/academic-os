import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { usePlayerStore } from '../../stores/playerStore';
import { playXpGainChime } from '../../utils/epicSound';

const CELEBRATION_MS = 6000;

/** Celebración central de XP — estable, sin AnimatePresence en portal. */
export function XpGainCelebrationStack() {
  const queue = usePlayerStore((s) => s.xpCelebrations);
  const clearAll = usePlayerStore((s) => s.clearXpCelebrations);
  const player = usePlayerStore((s) => s.player);
  const batchTimer = useRef<number | null>(null);
  const playedSound = useRef(false);
  const queueSig = useRef('');

  const sorted = useMemo(
    () => [...queue].sort((a, b) => b.amount - a.amount),
    [queue],
  );
  const animOff = player?.showAnimations === false;

  useEffect(() => {
    const sig = queue.map((q) => q.id).join('|');
    if (queue.length === 0) {
      queueSig.current = '';
      playedSound.current = false;
      if (batchTimer.current !== null) {
        window.clearTimeout(batchTimer.current);
        batchTimer.current = null;
      }
      return;
    }

    if (sig !== queueSig.current) {
      queueSig.current = sig;
      if (!playedSound.current) {
        playedSound.current = true;
        void playXpGainChime();
      }
    }

    if (batchTimer.current === null) {
      batchTimer.current = window.setTimeout(() => {
        batchTimer.current = null;
        playedSound.current = false;
        queueSig.current = '';
        clearAll();
      }, CELEBRATION_MS);
    }
  }, [queue, clearAll]);

  useEffect(() => () => {
    if (batchTimer.current !== null) window.clearTimeout(batchTimer.current);
  }, []);

  if (sorted.length === 0 || typeof document === 'undefined') return null;

  return createPortal(
    <div className="xp-celebration-overlay" aria-live="polite">
      <div className="xp-celebration-aura" aria-hidden />
      <div className="xp-celebration-rays" aria-hidden />
      <div className="xp-celebration-grid">
        {sorted.map((item, idx) => (
          <motion.div
            key={item.id}
            className="xp-celebration-card"
            initial={animOff ? false : { opacity: 0, scale: 0.85, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={
              animOff
                ? { duration: 0.01 }
                : { type: 'spring', stiffness: 260, damping: 20, delay: idx * 0.05 }
            }
            style={{ '--xp-rank': idx } as CSSProperties}
          >
            <div className="xp-celebration-card-glow" aria-hidden />
            <div className="xp-celebration-sparks" aria-hidden>
              <span>✦</span>
              <span>★</span>
              <span>✦</span>
              <span>☆</span>
            </div>
            <p className="xp-celebration-kicker">LOGRO DESBLOQUEADO</p>
            <p className="xp-celebration-amount">+{item.amount} XP</p>
            {item.reason ? <p className="xp-celebration-reason">{String(item.reason)}</p> : null}
          </motion.div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
