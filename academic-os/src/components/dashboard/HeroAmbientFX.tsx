interface HeroAmbientFXProps {
  intensity: number;
  active: boolean;
}

/** Ambiente del hero — CSS puro (compositor), no Framer Motion.
 *  Antes eran 2 orbes + hasta 10 partículas con rAF de framer-motion corriendo
 *  para siempre, incluso con la pestaña oculta (display:none no para rAF). */
export function HeroAmbientFX({ intensity, active }: HeroAmbientFXProps) {
  if (!active) return null;

  const count = 4 + Math.round(intensity * 6);
  const glowScale = 0.85 + intensity * 0.35;

  return (
    <div className="hero-ambient-fx pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="hero-ambient-orb hero-ambient-orb-left"
        style={{ transform: `scale(${glowScale})` }}
      />
      <div
        className="hero-ambient-orb hero-ambient-orb-right"
        style={{ transform: `scale(${glowScale * 0.95})`, animationDelay: '0.6s' }}
      />
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="hero-ambient-particle"
          style={{
            left: `${8 + (i * 84) / count}%`,
            top: `${20 + (i % 4) * 18}%`,
            ['--hp-rise' as string]: `${-22 - intensity * 20}px`,
            animationDuration: `${2.5 + (i % 3) * 0.8}s`,
            animationDelay: `${i * 0.25}s`,
          }}
        />
      ))}
    </div>
  );
}
