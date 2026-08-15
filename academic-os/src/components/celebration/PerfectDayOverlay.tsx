import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { playVictoryFanfare } from '../../utils/epicSound';
import { GERARDEX_COMIC } from '../../utils/playerConfig';
import { EpicButton } from '../ui';

interface PerfectDayOverlayProps {
  show: boolean;
  xpBonus: number;
  nightBonus?: number;
  onClose: () => void;
}

const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  delay: Math.random() * 0.5,
  color: ['#FFD700', '#32CD32', '#FF6347', '#FFA500'][i % 4],
}));

export function PerfectDayOverlay({ show, xpBonus, nightBonus = 0, onClose }: PerfectDayOverlayProps) {
  useEffect(() => {
    if (show) playVictoryFanfare();
  }, [show]);

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="victory-overlay fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {PARTICLES.map((p) => (
        <motion.div
          key={p.id}
          className="victory-particle pointer-events-none absolute h-2 w-2 rounded-full"
          style={{ left: `${p.x}%`, background: p.color, boxShadow: `0 0 8px ${p.color}` }}
          initial={{ y: '100vh', opacity: 1, scale: 1 }}
          animate={{ y: '-20vh', opacity: 0, scale: 0.5 }}
          transition={{ duration: 2.5, delay: p.delay, ease: 'easeOut' }}
        />
      ))}

      <motion.div
        initial={{ scale: 0.5, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 12, stiffness: 200 }}
        className="panel-hero-radiant relative max-w-md p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          animate={{ rotate: [0, 360], scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="text-6xl"
        >
          🏆
        </motion.div>
        <h2 className="title-carved-lg mt-4 !text-2xl text-gold-bright">¡DÍA PERFECTO!</h2>
        <p className="flavor-brutal mt-3 text-lg">{GERARDEX_COMIC.perfectDay}</p>
        <div className="mt-4 space-y-1">
          <p className="stat-epic text-xl text-highlight">+{xpBonus} XP</p>
          {nightBonus > 0 && (
            <p className="body-parchment text-sm">🌙 Bonus nocturno: +{nightBonus} XP</p>
          )}
        </div>
        <EpicButton className="mt-6" onClick={onClose}>GERARDEX APRUEBA</EpicButton>
      </motion.div>
    </motion.div>
  );
}
