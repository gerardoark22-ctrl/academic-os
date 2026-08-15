import { motion } from 'framer-motion';
import { playVictoryFanfare } from '../../utils/epicSound';
import { EpicButton } from '../ui';
import { useEffect } from 'react';

interface AchievementOverlayProps {
  show: boolean;
  name: string;
  emoji: string;
  onClose: () => void;
}

export function AchievementOverlay({ show, name, emoji, onClose }: AchievementOverlayProps) {
  useEffect(() => {
    if (show) playVictoryFanfare();
  }, [show]);

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="levelup-overlay fixed inset-0 z-[110] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.4 }}
        animate={{ scale: 1 }}
        className="panel-hero-radiant max-w-md p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <motion.span animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-6xl">
          {emoji}
        </motion.span>
        <h2 className="title-carved-lg mt-4 !text-xl text-gold-bright">LOGRO DESBLOQUEADO</h2>
        <p className="stat-epic mt-3 text-2xl text-highlight">{name}</p>
        <EpicButton className="mt-6" onClick={onClose}>CONTINUAR</EpicButton>
      </motion.div>
    </motion.div>
  );
}
