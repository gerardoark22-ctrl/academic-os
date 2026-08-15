import { motion } from 'framer-motion';
import { getEpicTier, epicTierClass } from '../../utils/levelEpic';
import { getStreakGlow, getStreakLabel } from '../../utils/playerConfig';

interface HeroStatBlocksProps {
  level: number;
  xp: number;
  streak: number;
  animOn: boolean;
}

function TierParticles({ color, count = 6 }: { color: string; count?: number }) {
  return (
    <div className="stat-particles pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="stat-tier-particle"
          style={{
            background: color,
            boxShadow: `0 0 6px ${color}`,
            left: `${8 + i * 14}%`,
            top: `${20 + (i % 3) * 28}%`,
            animationDuration: `${1.8 + i * 0.15}s`,
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}

export function HeroStatBlocks({ level, xp, streak, animOn }: HeroStatBlocksProps) {
  const tier = getEpicTier(level);
  const tierCls = epicTierClass('stat-hero', tier);
  const anim = animOn && tier >= 1;

  return (
    <div className="grid grid-cols-3 gap-3">
      <motion.div
        className={`stat-block stat-block-hero stat-block-level ${tierCls} relative overflow-hidden`}
        animate={anim && tier >= 1 ? { scale: [1, 1.02, 1] } : {}}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        {anim && tier >= 2 && <TierParticles color="#FFD700" count={tier >= 3 ? 10 : 6} />}
        {anim && tier >= 4 && <div className="stat-fire-bg pointer-events-none absolute inset-0" aria-hidden />}
        <p className="stat-hero-label">Nivel</p>
        <p className="stat-number stat-hero-value text-highlight">{level}</p>
        {tier >= 1 && (
          <p className="stat-hero-tier-tag mt-1 text-[11px] uppercase tracking-widest text-gold-bright">
            {tier >= 4 ? '⚡ TITÁN' : tier >= 3 ? '👑 SEMIDIÓS' : tier >= 2 ? '🔥 CAMPEÓN' : '⚔ GUERRERO'}
          </p>
        )}
      </motion.div>

      <motion.div
        className={`stat-block stat-block-hero stat-block-xp ${tierCls} relative overflow-hidden`}
        animate={anim && tier >= 2 ? { y: [0, -2, 0] } : {}}
        transition={{ duration: 3, repeat: Infinity }}
      >
        {anim && tier >= 3 && <TierParticles color="#FFA500" count={6} />}
        <p className="stat-hero-label">XP total</p>
        <p className="stat-number stat-hero-value !text-2xl md:!text-3xl text-highlight">{xp.toLocaleString()}</p>
      </motion.div>

      <motion.div
        className={`stat-block stat-block-hero stat-block-streak ${tierCls} relative overflow-hidden`}
        style={{ boxShadow: getStreakGlow(streak) }}
        animate={anim && streak >= 3 ? { scale: [1, 1.015, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {anim && tier >= 2 && streak >= 3 && <TierParticles color="#FF6347" count={4} />}
        <p className="stat-hero-label">Racha</p>
        <p className="stat-number stat-hero-value !text-2xl md:!text-3xl text-highlight">
          {streak}
          <span className="text-base">{streak >= 3 ? ' 🔥' : 'd'}</span>
        </p>
        <p className="stat-hero-sub mt-1">{getStreakLabel(streak)}</p>
      </motion.div>
    </div>
  );
}
