import { motion } from 'framer-motion';
import { getTempleLayerLabel, getGodAngerMessage, getGodAngerColor } from '../../utils/gamification';
import { DynamicProgressBar } from '../ui/DynamicProgressBar';

interface TempleVisualProps {
  courseName: string;
  progress: number;
  templeLevel: number;
  icon?: string;
  compact?: boolean;
}

const LAYERS = [
  { level: 0, label: 'Escombros', mark: '▓', color: '#B8AA96', height: 18 },
  { level: 1, label: 'Columnas rotas', mark: '║', color: '#A89880', height: 22 },
  { level: 2, label: 'Estructura parcial', mark: '⌂', color: '#8B7344', height: 24 },
  { level: 3, label: 'Ruina alzada', mark: '◆', color: '#A68B4B', height: 28 },
];

export function TempleVisual({ courseName, progress, templeLevel, icon, compact = false }: TempleVisualProps) {
  const visibleLayers = LAYERS.filter((l) => l.level <= templeLevel);

  if (compact) {
    return (
      <div className="flex items-center gap-3 border-b border-marble-crack/50 pb-3 last:border-0">
        <span className="text-lg opacity-90">{icon}</span>
        <div className="flex-1">
          <DynamicProgressBar
            value={progress}
            label={courseName}
            variant="course"
            size="sm"
            shimmer={progress >= 75}
          />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center"
    >
      <h3 className="title-carved mb-3 text-xs">
        {icon} {courseName.toUpperCase()}
      </h3>

      <div className="relative flex w-44 flex-col-reverse items-center">
        {visibleLayers.map((layer, i) => (
          <motion.div
            key={layer.level}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ delay: i * 0.2, duration: 0.5 }}
            className="relative mb-px flex w-full items-center justify-center border border-ink/10"
            style={{
              height: layer.height,
              backgroundColor: layer.color,
              opacity: 0.75 + layer.level * 0.06,
              clipPath: 'polygon(2% 0, 98% 0, 100% 100%, 0 100%)',
            }}
          >
            <span className="font-epic text-xs text-ink-deep/60">{layer.mark}</span>
          </motion.div>
        ))}
        <div className="h-2 w-full bg-ink-deep/20" />
      </div>

      <p className="flavor-brutal mt-2 text-xs">
        {getTempleLayerLabel(templeLevel)} — {progress}% reconquistado
      </p>
    </motion.div>
  );
}

export function GodAngerBar({ anger }: { anger: number }) {
  const color = getGodAngerColor(anger);
  const message = getGodAngerMessage(anger);

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-epic text-xs uppercase tracking-wider text-ink/70">Nivel de ira</span>
        <span className="font-epic text-sm" style={{ color }}>{anger}%</span>
      </div>
      <div className={`bar-cracked h-4 ${anger > 70 ? 'animate-pulse-blood' : ''}`}>
        <motion.div
          animate={{ width: `${anger}%` }}
          className="h-full"
          style={{
            background: `linear-gradient(90deg, #5A6B4A, ${color})`,
          }}
        />
      </div>
      <p className="flavor-brutal mt-1.5 text-xs">{message}</p>
    </div>
  );
}

export function UnderworldCounter({ days: _days }: { days: number }) {
  return null;
}
