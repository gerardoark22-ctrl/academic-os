import { useState } from 'react';
import { motion } from 'framer-motion';
import { usePlayerStore } from '../../stores/playerStore';
import { GERARDEX_SKINS, INTERFACE_SKINS } from '../../utils/cosmetics';
import { PANEL_THEMES, getEffectivePanelTheme } from '../../utils/progressGradients';
import { EpicButton } from '../ui';
import { PlayerCustomizeModal } from './PlayerCustomizeModal';

export function PlayerCustomizeStrip() {
  const player = usePlayerStore((s) => s.player);
  const [open, setOpen] = useState(false);

  if (!player) return null;

  const currentSkin = GERARDEX_SKINS.find((s) => s.id === player.currentSkin) ?? GERARDEX_SKINS[0];
  const iface = INTERFACE_SKINS.find((s) => s.id === (player.currentInterfaceSkin ?? 'default')) ?? INTERFACE_SKINS[0];
  const theme = PANEL_THEMES[getEffectivePanelTheme(player.level, player.panelTheme)];

  const badges = [
    { icon: currentSkin.emoji, tip: `Skin: ${currentSkin.label}` },
    { icon: '🎨', tip: `Tema: ${theme.label}` },
    { icon: '🏛️', tip: `Interfaz: ${iface.label}` },
    { icon: player.showAnimations !== false ? '✨' : '💤', tip: player.showAnimations !== false ? 'Brillos ON' : 'Brillos OFF' },
    ...(player.badges ?? []).slice(0, 3).map((b) => ({ icon: b.split(' ')[0] ?? '🏅', tip: b })),
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="customize-strip mt-4 flex flex-wrap items-center justify-center gap-2 px-2"
      >
        {badges.map((b, i) => (
          <span
            key={i}
            title={b.tip}
            className="customize-badge cursor-default text-lg transition hover:scale-110"
          >
            {b.icon}
          </span>
        ))}
        <EpicButton size="sm" variant="ghost" onClick={() => setOpen(true)} className="!px-3 !py-1 text-xs">
          ⚙ Forjar
        </EpicButton>
      </motion.div>

      {open && <PlayerCustomizeModal open onClose={() => setOpen(false)} />}
    </>
  );
}
