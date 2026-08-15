import { motion } from 'framer-motion';
import { EpicButton } from '../ui';
import { useEffect } from 'react';

interface LevelDownOverlayProps {
  show: boolean;
  level: number;
  title: string;
  onClose: () => void;
}

export function LevelDownOverlay({ show, level, title, onClose }: LevelDownOverlayProps) {
  useEffect(() => {
    if (!show) return;
    document.body.classList.add('leveldown-active');
    return () => document.body.classList.remove('leveldown-active');
  }, [show]);

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="leveldown-overlay fixed inset-0 z-[110] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 14, stiffness: 140 }}
        className="leveldown-panel relative max-w-lg p-10 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          animate={{ scale: [1, 0.92, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          className="text-7xl"
        >
          ☠
        </motion.div>
        <h2 className="leveldown-title mt-4 font-epic text-4xl uppercase tracking-widest">
          DESCENSO
        </h2>
        <p className="stat-number leveldown-level mt-2 !text-5xl">NIVEL {level}</p>
        <p className="flavor-brutal leveldown-sub mt-4 text-xl">{title}</p>
        <p className="body-parchment mt-3 text-sm opacity-90">
          Hades reclama tributo — Gerardex retrocede en la escalera del Olimpo
        </p>
        <EpicButton variant="ghost" className="mt-8" onClick={onClose}>
          LEVANTARSE DEL INFIERNO
        </EpicButton>
      </motion.div>
    </motion.div>
  );
}
