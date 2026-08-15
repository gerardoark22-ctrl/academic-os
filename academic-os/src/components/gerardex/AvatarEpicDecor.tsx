import { motion } from 'framer-motion';
import { GERARDEX_SKINS, type GerardexSkinDef, type UnlockExtras } from '../../utils/cosmetics';
import { getEpicTier, epicTierClass } from '../../utils/levelEpic';
import type { Player } from '../../types';

interface AvatarEpicDecorProps {
  player: Player;
  skinDef: GerardexSkinDef;
  panelTheme: string;
  showParticles: boolean;
  extras?: UnlockExtras;
}

export function AvatarEpicDecor({
  player,
  skinDef,
  panelTheme,
  showParticles,
  extras,
}: AvatarEpicDecorProps) {
  const tier = getEpicTier(player.level);
  const defaultExtras: UnlockExtras = { perfectDays: 0, legendaryMissionsDone: 0, coursesCompleted: 0, blocksCompleted: 0 };
  const ownedSkins = GERARDEX_SKINS.filter(
    (s) => s.id !== 'default' && (player.skins.includes(s.id) || s.checkUnlock(player, extras ?? defaultExtras)),
  ).slice(0, 4);

  const badges = (player.badges ?? []).slice(0, 3);

  return (
    <>
      {/* Insignia de skin activa */}
      <motion.div
        className={`avatar-skin-insignia avatar-skin-insignia-${skinDef.id}`}
        animate={showParticles ? { scale: [1, 1.12, 1], rotate: [0, 5, -5, 0] } : {}}
        transition={{ duration: 2.5, repeat: Infinity }}
        title={skinDef.label}
      >
        {skinDef.emoji}
      </motion.div>

      {/* Logros / skins desbloqueadas alrededor del marco */}
      {ownedSkins.map((s, i) => (
        <motion.span
          key={s.id}
          className={`avatar-achievement-medal avatar-medal-pos-${i} ${player.currentSkin === s.id ? 'avatar-medal-active' : ''}`}
          title={s.label}
          whileHover={{ scale: 1.15 }}
          animate={player.currentSkin === s.id && showParticles ? { y: [0, -3, 0] } : {}}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
        >
          {s.emoji}
        </motion.span>
      ))}

      {badges.map((b, i) => (
        <span key={b} className={`avatar-badge-slot avatar-badge-pos-${i}`} title={b}>
          {b.split(' ')[0]}
        </span>
      ))}

      {showParticles && tier >= 2 && (
        <div className={`avatar-tier-glow ${epicTierClass('avatar', tier)} avatar-theme-${panelTheme}`} aria-hidden />
      )}
      {showParticles && tier >= 4 && <div className="avatar-epic-fire-ring pointer-events-none absolute inset-0" aria-hidden />}
    </>
  );
}
