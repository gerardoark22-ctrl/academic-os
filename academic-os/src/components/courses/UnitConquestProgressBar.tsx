import { motion } from 'framer-motion';
import {
  getProgressGradient,
  getProgressGlow,
  getProgressAura,
  getProgressLabelColor,
} from '../../utils/progressGradients';

interface Props {
  progress: number;
  accent?: string;
  completedTopics?: number;
  totalTopics?: number;
  layout?: 'default' | 'hero';
  className?: string;
}

function conquestPhase(pct: number): string {
  if (pct >= 100) return 'DOMINIO TOTAL';
  if (pct >= 75) return 'VICTORIA CERCANA';
  if (pct >= 50) return 'MEDIO CAMINO';
  if (pct >= 25) return 'EN MARCHA';
  return 'ZONA ROJA';
}

const HERO_TRACK_H = 52;

export function UnitConquestProgressBar({
  progress,
  accent,
  completedTopics,
  totalTopics,
  layout = 'default',
  className = '',
}: Props) {
  const pct = Math.min(100, Math.max(0, Math.round(progress)));
  const radiant = pct >= 75;
  const complete = pct >= 100;
  const labelColor = getProgressLabelColor(pct);
  const edgeBlur = Math.min(36, 12 + pct * 0.24);
  const hero = layout === 'hero';
  const fillW = `${Math.max(pct, pct > 0 ? 5 : 0)}%`;
  const gradient = getProgressGradient(pct, 'course');
  const glow = getProgressGlow(pct);
  const aura = getProgressAura(pct);

  return (
    <div
      className={`unit-conquest-bar ${hero ? 'unit-conquest-bar-hero' : ''} ${className}`.trim()}
      style={{ width: '100%', minWidth: 0, ['--unit-accent' as string]: accent ?? '#8B6914' }}
    >
      <div className={`mb-1 flex items-end justify-between gap-2 ${hero ? 'mb-1.5' : ''}`}>
        <div className="min-w-0">
          <p
            className="flavor-brutal uppercase text-highlight"
            style={{
              fontSize: hero ? '0.72rem' : '0.65rem',
              letterSpacing: '0.16em',
              lineHeight: 1.2,
            }}
          >
            ⚔ Conquista de unidad
          </p>
          {totalTopics != null && totalTopics > 0 && (
            <p className="text-readable-dim mt-0.5 text-[11px]">
              {completedTopics ?? 0}/{totalTopics} temas · {conquestPhase(pct)}
            </p>
          )}
        </div>
        <motion.span
          key={pct}
          initial={{ scale: 1.18, opacity: 0.75 }}
          animate={{ scale: 1, opacity: 1 }}
          className="unit-conquest-pct-hero stat-epic shrink-0 font-bold tabular-nums leading-none"
          style={{
            fontSize: hero ? '1.35rem' : '1.65rem',
            color: labelColor,
            textShadow: `0 0 16px ${labelColor}CC, 0 0 32px ${labelColor}55`,
          }}
        >
          {pct}%
        </motion.span>
      </div>

      <div
        className={`unit-conquest-aura ${radiant ? 'unit-conquest-aura-radiant' : ''} ${complete ? 'unit-conquest-aura-complete' : ''}`}
        style={{ boxShadow: aura, padding: hero ? 7 : 5, borderRadius: 10 }}
      >
        <div
          className={`unit-conquest-track ${hero ? 'unit-conquest-track-hero' : ''} ${radiant ? 'unit-conquest-track-radiant' : ''} ${complete ? 'unit-conquest-complete' : ''}`}
          style={{
            height: hero ? HERO_TRACK_H : 28,
            borderRadius: 8,
            position: 'relative',
            overflow: 'hidden',
            border: '3px solid',
            borderColor: radiant
              ? '#FFD700 #1B5E20 #0A0604 #32CD32'
              : '#5C3310 #1A0F08 #0A0604 #8B6914',
            background: 'linear-gradient(180deg, #0A0604 0%, #1A0F08 45%, #120A06 100%)',
            boxShadow: radiant
              ? 'inset 0 4px 14px rgba(0,0,0,0.75), 0 0 18px rgba(50,205,50,0.28)'
              : 'inset 0 4px 14px rgba(0,0,0,0.75), 0 2px 10px rgba(0,0,0,0.45)',
          }}
        >
          {[25, 50, 75].map((mark) => (
            <span
              key={mark}
              className={`unit-conquest-tick ${pct >= mark ? 'unit-conquest-tick-lit' : ''}`}
              style={{ left: `${mark}%` }}
              aria-hidden
            />
          ))}

          {radiant && <div className="unit-conquest-radiance-layer" aria-hidden />}

          <motion.div
            className="unit-conquest-fill"
            initial={false}
            animate={{ width: fillW }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            style={{ height: '100%', position: 'relative', minWidth: 6, borderRadius: '5px 0 0 5px' }}
          >
            <div
              className="unit-conquest-fill-body"
              style={{
                position: 'absolute',
                inset: 0,
                background: gradient,
                boxShadow: glow,
                borderRadius: 'inherit',
              }}
            />
            {pct > 0 && (
              <div
                className="unit-conquest-edge-bloom"
                style={{
                  position: 'absolute',
                  right: -18,
                  top: '-65%',
                  bottom: '-65%',
                  width: 48,
                  pointerEvents: 'none',
                  zIndex: 3,
                  background: `radial-gradient(ellipse at center, ${labelColor}DD 0%, transparent 70%)`,
                  filter: `blur(${edgeBlur}px)`,
                  opacity: Math.min(1, 0.45 + pct / 100),
                }}
                aria-hidden
              />
            )}
            {pct >= 12 && (
              <div
                className="unit-conquest-shimmer"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '50%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
                aria-hidden
              />
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
