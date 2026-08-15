import { motion } from 'framer-motion';
import { EpicButton } from '../ui';
import { computeCondemnation } from '../../utils/condemnationEngine';
import type { Player } from '../../types';
import { todayISO } from '../../utils/gamification';

interface SuperHellAlertProps {
  days: number;
  player?: Player | null;
  onDismiss?: () => void;
}

const HELL_SUBTITLES = [
  'HADES TIENE TU NOMBRE EN LA LISTA',
  'LA SENTENCIA SE EJECUTA AL AMANECER',
  'TU XP ES CARNE DE PENALIZACIÓN',
  'LEVÁNTATE. ESTUDIA. O PAGA.',
];

export function SuperHellAlert({ days, player, onDismiss }: SuperHellAlertProps) {
  if (days <= 0) return null;

  const c = computeCondemnation(days, player ?? null);
  const intensity = Math.min(1, days / 7);
  const subtitle = HELL_SUBTITLES[Math.min(HELL_SUBTITLES.length - 1, Math.floor(days / 2))];
  const penaltyAppliedToday =
    player?.lastUnderworldPenaltyDate === todayISO() && (player?.lastXpPenaltyAmount ?? 0) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="hell-alert relative overflow-hidden border-4 border-blood-dried"
      style={{
        boxShadow: `0 0 ${30 + days * 8}px rgba(220, 20, 60, ${0.4 + intensity * 0.4}), inset 0 0 60px rgba(255, 69, 0, 0.2)`,
      }}
    >
      <div className="hell-fire-layer pointer-events-none absolute inset-0" aria-hidden />
      <div className="hell-ember-layer pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative z-10 px-4 py-5 md:px-8 md:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1">
            <p className="hell-title font-epic text-2xl uppercase tracking-widest text-blood-fresh md:text-3xl">
              ⚰️ {days} DÍA{days !== 1 ? 'S' : ''} VAGANDO EN EL INFRAMUNDO
            </p>
            <p className="hell-subtitle mt-2 font-epic text-lg text-gold-bright md:text-xl">
              {subtitle}
            </p>
            <p className="hell-condemnation-headline mt-4 font-epic text-base uppercase tracking-wide text-blood-fresh md:text-lg">
              {c.headline}
            </p>
            <p className="hell-condemnation-punishment mt-2 text-base font-semibold text-gold-bright md:text-lg">
              {c.punishment}
            </p>
            <p className="body-parchment mt-3 max-w-2xl text-sm md:text-base opacity-95">
              {c.detail}
            </p>
            {penaltyAppliedToday && (
              <p className="mt-2 font-epic text-sm uppercase tracking-wide text-blood-fresh md:text-base">
                ⚰️ Castigo ejecutado hoy: −{player!.lastXpPenaltyAmount} XP descontados de tu cuenta
              </p>
            )}
          </div>

          <div className="text-5xl md:text-6xl">
            {days >= 7 ? '💀' : days >= 3 ? '🔥' : '⚠️'}
          </div>
        </div>

        <div className="hell-bar-track mt-5 h-3 w-full overflow-hidden rounded-sm border border-blood-dried/60">
          <div
            className="hell-bar-fill h-full transition-[width] duration-500"
            style={{ width: `${c.condemnationPercent}%` }}
          />
        </div>
        <p className="flavor-brutal mt-2 text-center text-xs uppercase tracking-widest md:text-sm">
          Nivel de condena: {c.condemnationPercent}% · −{penaltyAppliedToday ? player!.lastXpPenaltyAmount : c.xpToLoseNow} XP{' '}
          {penaltyAppliedToday ? 'restados hoy' : 'en juego'}
        </p>

        {onDismiss && (
          <div className="mt-4 flex justify-center">
            <EpicButton size="sm" variant="ghost" onClick={onDismiss}>
              Entiendo — voy a estudiar
            </EpicButton>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function UnderworldCounter({ days, player }: { days: number; player?: Player | null }) {
  return <SuperHellAlert days={days} player={player} />;
}
