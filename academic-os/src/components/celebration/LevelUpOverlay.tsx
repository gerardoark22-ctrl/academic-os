import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { playVictoryFanfare } from '../../utils/epicSound';
import { EpicButton } from '../ui';

interface LevelUpOverlayProps {
  show: boolean;
  level: number;
  title: string;
  weapon: string;
  armor: string;
  onClose: () => void;
}

const CONFETTI_COLORS = ['#FFD700', '#D4AF37', '#CD7F32', '#DC143C', '#FFA500', '#FFEC8B', '#B8860B'];

function ConfettiField() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        id: i,
        left: `${(i * 17 + 7) % 100}%`,
        delay: (i % 12) * 0.18,
        duration: 2.4 + (i % 5) * 0.35,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: (i * 47) % 360,
        size: i % 3 === 0 ? 'lg' : 'sm',
      })),
    [],
  );

  return (
    <div className="levelup-confetti-field" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className={`levelup-confetti-piece ${p.size === 'lg' ? 'levelup-confetti-piece-lg' : ''}`}
          style={{
            left: p.left,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export function LevelUpOverlay({ show, level, title, weapon, armor, onClose }: LevelUpOverlayProps) {
  useEffect(() => {
    if (show) void playVictoryFanfare();
  }, [show]);

  if (!show || typeof document === 'undefined') return null;

  return createPortal(
    <div className="levelup-epic-overlay" role="dialog" aria-modal="true" aria-labelledby="levelup-epic-title">
      <div className="levelup-epic-backdrop" aria-hidden />
      <div className="levelup-epic-rainbow-ring" aria-hidden />
      <div className="levelup-epic-rainbow-ring levelup-epic-rainbow-ring-inner" aria-hidden />
      <div className="levelup-epic-light-burst" aria-hidden />
      <ConfettiField />

      <motion.div
        initial={{ opacity: 0, scale: 0.72, y: 32 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className="levelup-epic-panel"
      >
        <div className="levelup-epic-panel-cracks" aria-hidden />
        <div className="levelup-epic-crown" aria-hidden>👑</div>

        <p className="levelup-epic-kicker">EL OLIMPO PROCLAMA</p>
        <h2 id="levelup-epic-title" className="levelup-epic-heading">
          ¡ASCENSO!
        </h2>

        <p className="levelup-epic-level">NIVEL {level}</p>
        <p className="levelup-epic-title">{title}</p>
        <p className="levelup-epic-evolution">
          {weapon} · {armor}
        </p>
        <p className="levelup-epic-flavor">
          Gerardex ha evolucionado — las ruinas tiemblan ante tu poder
        </p>

        <EpicButton className="levelup-epic-btn mt-8" onClick={onClose}>
          CONTINUAR LA CONQUISTA
        </EpicButton>
      </motion.div>
    </div>,
    document.body,
  );
}
