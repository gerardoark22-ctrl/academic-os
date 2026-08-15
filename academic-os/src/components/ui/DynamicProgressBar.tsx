import { motion } from 'framer-motion';
import {
  getProgressGradient,
  getProgressGlow,
  getProgressAura,
  getProgressLabelColor,
  type ProgressVariant,
} from '../../utils/progressGradients';

interface DynamicProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  sublabel?: string;
  variant?: ProgressVariant;
  size?: 'sm' | 'md' | 'lg';
  shimmer?: boolean;
  showPercent?: boolean;
}

export function DynamicProgressBar({
  value,
  max = 100,
  label,
  sublabel,
  variant = 'xp',
  size = 'md',
  shimmer = true,
  showPercent = true,
}: DynamicProgressBarProps) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const gradient = getProgressGradient(pct, variant);
  const glow = getProgressGlow(pct);
  const aura = getProgressAura(pct);
  const labelColor = getProgressLabelColor(pct);
  const heights = { sm: 'h-4', md: 'h-6', lg: 'h-8' };

  return (
    <div className="w-full">
      {(label || showPercent) && (
        <div className="mb-2 flex items-end justify-between gap-2">
          <div>
            {label && <p className="label-clear text-base">{label}</p>}
            {sublabel && <p className="text-readable-dim mt-0.5 text-sm">{sublabel}</p>}
          </div>
          {showPercent && (
            <span className="stat-epic text-lg" style={{ color: labelColor, textShadow: `0 0 12px ${labelColor}66` }}>
              {pct}%
            </span>
          )}
        </div>
      )}
      <div
        className="bar-aura-wrapper rounded-sm p-[3px]"
        style={{ boxShadow: aura }}
      >
        <div
          className={`bar-epic bar-epic-ryg ${heights[size]} relative overflow-hidden ${shimmer ? 'bar-shimmer' : ''}`}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="bar-fill-ryg h-full"
            style={{ background: gradient, boxShadow: glow }}
          />
          {pct >= 50 && (
            <div className="bar-sweep pointer-events-none absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/35 to-transparent" />
          )}
        </div>
      </div>
    </div>
  );
}
