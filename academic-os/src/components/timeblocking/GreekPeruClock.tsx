import { formatLocalClock } from '../../utils/localTime';

interface Props {
  now: Date;
}

/** Reloj Perú en bloque de piedra griega rústica */
export function GreekPeruClock({ now }: Props) {
  return (
    <div className="greek-clock-stone" title="Hora Perú (America/Lima)">
      <span className="greek-clock-column greek-clock-column-l" aria-hidden />
      <span className="greek-clock-column greek-clock-column-r" aria-hidden />
      <div className="greek-clock-mist" aria-hidden />
      <div className="greek-clock-inner">
        <span className="greek-clock-ornament" aria-hidden>☙</span>
        <div className="greek-clock-face">
          <span className="greek-clock-label">ΧΡΟΝΟΣ · PE</span>
          <time className="greek-clock-time tabular-nums" dateTime={now.toISOString()}>
            {formatLocalClock(now)}
          </time>
        </div>
        <span className="greek-clock-ornament greek-clock-ornament-r" aria-hidden>❧</span>
      </div>
    </div>
  );
}
