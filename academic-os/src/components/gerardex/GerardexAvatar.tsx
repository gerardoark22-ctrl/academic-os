import { motion } from 'framer-motion';
import { usePlayerStore } from '../../stores/playerStore';
import {
  GERARDEX_AVATAR_SRC,
  combineFilters,
  STATE_BORDER,
  STATE_GLOW,
  STATE_OVERLAY,
  STAGE_GLOW,
  type AvatarVisualState,
} from './avatarConfig';
import { GERARDEX_SKINS } from '../../utils/cosmetics';
import { getEpicTier, epicTierClass } from '../../utils/levelEpic';
import { AvatarEpicDecor } from './AvatarEpicDecor';
import { PANEL_THEMES, getEffectivePanelTheme, type PanelTheme } from '../../utils/progressGradients';
import { getGerardexStage } from '../../utils/gamification';

const SKIN_PARTICLE_COLORS: Record<string, string> = {
  gold: '#FFD700',
  lightning: '#87CEEB',
  blood: '#DC143C',
  ice: '#ADD8E6',
  shadow: '#4A4035',
  divine: '#FFA500',
  ember: '#FF6347',
};

interface GerardexAvatarProps {
  size?: 'sm' | 'lg' | 'xl';
  visualState?: AvatarVisualState;
  showName?: boolean;
  showParticles?: boolean;
}

function SkinParticles({ particle, intense }: { particle: string; intense?: boolean }) {
  const color = SKIN_PARTICLE_COLORS[particle] ?? '#FFD700';
  const count = intense ? 12 : 6;
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="skin-particle pointer-events-none absolute h-1.5 w-1.5 rounded-full"
          style={{
            background: color,
            boxShadow: `0 0 6px ${color}`,
            left: `${20 + i * 12}%`,
            top: `${30 + (i % 3) * 15}%`,
            animationDuration: `${2 + i * 0.3}s`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </>
  );
}

export function GerardexAvatar({ size = 'lg', visualState = 'normal', showName = true, showParticles = true }: GerardexAvatarProps) {
  const player = usePlayerStore((s) => s.player);
  const forgeFlash = usePlayerStore((s) => s.forgeFlash);

  if (!player) return null;
  const stage = getGerardexStage(player.level);

  const skinDef = GERARDEX_SKINS.find((s) => s.id === player.currentSkin) ?? GERARDEX_SKINS[0];
  const flashActive = forgeFlash > 0 && Date.now() - forgeFlash < 1500;
  const skinAura =
    player.currentSkin === 'spartan' ? 'skin-aura-spartan'
    : player.currentSkin === 'mythic' ? 'skin-aura-mythic'
    : player.currentSkin === 'titan' ? 'skin-aura-titan'
    : player.currentSkin === 'hades' ? 'skin-aura-hades'
    : '';
  const goldenSkin = player.currentSkin === 'golden' || player.skins.includes('golden');
  const filter = combineFilters(stage.stage, visualState, goldenSkin && visualState !== 'dirty');
  const borderColor = STATE_BORDER[visualState] ?? STATE_BORDER.normal;
  const glow = STATE_GLOW[visualState] ?? STAGE_GLOW[stage.stage];
  const displayTitle = player.activeTitle ?? stage.title;
  const scale = (1 + (stage.stage - 1) * 0.04) * (player.currentSkin === 'titan' ? 1.12 : 1);
  const epicTier = getEpicTier(player.level);
  const panelTheme = getEffectivePanelTheme(player.level, player.panelTheme as PanelTheme | undefined);
  const themeClass = PANEL_THEMES[panelTheme].class;
  const tierClasses = `${epicTierClass('avatar-frame', epicTier)} ${themeClass}-avatar-tier-${epicTier}`;

  const frameClass = size === 'xl' ? 'h-64 w-64' : size === 'lg' ? 'h-48 w-48' : 'h-24 w-24';
  const imgClass = size === 'xl' ? 'h-60 w-60' : size === 'lg' ? 'h-44 w-44' : 'h-20 w-20';

  return (
    <motion.div
      animate={visualState === 'radiant' ? { y: [0, -8, 0] } : { y: [0, -4, 0] }}
      transition={{ duration: visualState === 'radiant' ? 2 : 3.5, repeat: Infinity, ease: 'easeInOut' }}
      className="flex flex-col items-center"
    >
      <div
        className={`${frameClass} avatar-frame avatar-evolution-stage-${stage.stage} ${tierClasses} ${skinAura} relative flex items-center justify-center ${flashActive ? 'forge-flash' : ''}`}
        style={{ borderColor, boxShadow: glow, transform: `scale(${scale})` }}
      >
        <AvatarEpicDecor
          player={player}
          skinDef={skinDef}
          panelTheme={panelTheme}
          showParticles={showParticles}
          extras={{
            perfectDays: player.perfectDaysCount ?? 0,
            legendaryMissionsDone: 0,
            coursesCompleted: 0,
            blocksCompleted: player.totalBlocksCompleted ?? 0,
          }}
        />
        {showParticles && skinDef.particle !== 'none' && (
          <SkinParticles particle={skinDef.particle} intense={skinDef.id === 'storm'} />
        )}

        <div className="relative overflow-hidden rounded-sm">
          <img
            src={GERARDEX_AVATAR_SRC}
            alt="Gerardex"
            className={`${imgClass} object-cover object-center`}
            style={{ filter }}
            draggable={false}
          />
          {STATE_OVERLAY[visualState] && (
            <div className="pointer-events-none absolute inset-0" style={{ background: STATE_OVERLAY[visualState] }} />
          )}
        </div>

        {stage.stage >= 3 && visualState !== 'dirty' && (
          <div className="pointer-events-none absolute -right-1 top-1 text-lg">
            {stage.stage >= 5 ? '👑' : stage.stage >= 4 ? '🛡️' : '⚔'}
          </div>
        )}

        <div className="absolute -bottom-3 border-2 border-bronze-light bg-ink px-4 py-1 shadow-epic">
          <span className="stat-epic text-base font-bold text-highlight">Nv.{player.level}</span>
        </div>
      </div>

      {showName && (size === 'lg' || size === 'xl') && (
        <div className="mt-5 w-full text-center">
          <h3 className="title-carved-lg !text-2xl text-highlight">Gerardex</h3>
          <p className="title-carved mt-1 !text-base text-gold-bright">{displayTitle}</p>
          <p className="flavor-brutal mt-1 text-base">{stage.weapon} · {stage.armor}</p>
          {skinDef.perk && skinDef.id !== 'default' && (
            <p className="text-readable-dim mt-1 text-xs italic">{skinDef.perk}</p>
          )}
        </div>
      )}
    </motion.div>
  );
}
