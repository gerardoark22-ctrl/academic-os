/** Barra de progreso CSS pura — sin Framer Motion, estable en el pergamino */

type QuestProgressVariant = 'study' | 'streak' | 'course';
type QuestProgressSize = 'normal' | 'header';

interface QuestProgressBarProps {
  value: number;
  max: number;
  variant?: QuestProgressVariant;
  size?: QuestProgressSize;
  showLabel?: boolean;
  /** 100% — barra dorada con animación */
  complete?: boolean;
  /** Texto de recompensa al completar (p. ej. bonus XP) */
  rewardLabel?: string;
}

export function QuestProgressBar({
  value,
  max,
  variant = 'study',
  size = 'normal',
  showLabel = true,
  complete = false,
  rewardLabel,
}: QuestProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const isComplete = complete || (max > 0 && value >= max);

  return (
    <div className={`quest-progress quest-progress--${size}`}>
      {showLabel && (
        <div className="quest-progress-meta">
          <span className="flavor-brutal text-[10px]">{value}/{max}</span>
          <span className="stat-epic text-[10px] text-bronze-light">{pct}%</span>
        </div>
      )}
      <div
        className={`quest-progress-track ${isComplete ? 'quest-progress-track--complete' : ''}`}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={`quest-progress-fill quest-progress-fill--${isComplete ? 'gold' : variant}${isComplete ? ' quest-progress-fill--complete' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isComplete && rewardLabel && (
        <p className="quest-progress-reward stat-epic">{rewardLabel}</p>
      )}
    </div>
  );
}
