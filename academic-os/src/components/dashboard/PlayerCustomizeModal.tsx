import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EpicModal, EpicButton } from '../ui';
import { GerardexAvatar } from '../gerardex/GerardexAvatar';
import { usePlayerStore } from '../../stores/playerStore';
import { useCoursesStore } from '../../stores/coursesStore';
import { useMissionsStore } from '../../stores/missionsStore';
import {
  GERARDEX_SKINS,
  INTERFACE_SKINS,
  IFACE_PERKS,
  computeUnlockExtras,
} from '../../utils/cosmetics';
import { PANEL_THEMES, PANEL_THEME_ORDER, isPanelThemeUnlocked } from '../../utils/progressGradients';
import { EPIC_EVOLUTION_MILESTONES, isEvolutionUnlocked, getEpicTier, epicTierName } from '../../utils/levelEpic';
import { getGerardexStage, epicTitles } from '../../utils/gamification';

type Tab = 'skins' | 'panel' | 'titles' | 'animations' | 'logros';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PlayerCustomizeModal({ open, onClose }: Props) {
  const player = usePlayerStore((s) => s.player);
  const courses = useCoursesStore((s) => s.courses);
  const missions = useMissionsStore((s) => s.missions);
  const playerTitleNames = usePlayerStore((s) => s.player?.titles);
  const titles = useMemo(
    () => epicTitles.map((t) => ({
      ...t,
      unlocked: playerTitleNames?.includes(t.name) ?? false,
    })),
    [playerTitleNames],
  );
  const setSkin = usePlayerStore((s) => s.setSkin);
  const setPanelTheme = usePlayerStore((s) => s.setPanelTheme);
  const setActiveTitle = usePlayerStore((s) => s.setActiveTitle);
  const setShowAnimations = usePlayerStore((s) => s.setShowAnimations);
  const setInterfaceSkin = usePlayerStore((s) => s.setInterfaceSkin);

  const [tab, setTab] = useState<Tab>('skins');
  const [previewSkin, setPreviewSkin] = useState<string | null>(null);

  if (!player) return null;
  const stage = getGerardexStage(player.level);

  const extras = computeUnlockExtras(player, courses, missions);

  const tier = getEpicTier(player.level);
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'skins', label: 'Skins', icon: '🐕' },
    { id: 'panel', label: 'Panel', icon: '🎨' },
    { id: 'titles', label: 'Títulos', icon: '📜' },
    { id: 'animations', label: 'FX', icon: '✨' },
    { id: 'logros', label: 'Logros', icon: '🏆' },
  ];

  const unlockedTitles = titles.filter((t) => t.unlocked);
  const activeTitle = player.activeTitle ?? stage.title;
  const ifaceClass = player.currentInterfaceSkin ? `iface-${player.currentInterfaceSkin}` : 'iface-default';

  const equipSkin = async (id: string) => {
    setPreviewSkin(id);
    await setSkin(id);
    setTimeout(() => setPreviewSkin(null), 800);
  };

  return (
    <EpicModal open={open} onClose={onClose} title="Forja de Gerardex" flavor="Cada elección forja tu leyenda — visible en el avatar" size="forge">
      <div className={`forge-workshop ${ifaceClass} rounded-sm`}>
        <div className="forge-preview-bar mb-5 flex flex-col items-center gap-4 border-b border-ink/40 pb-5 sm:flex-row sm:justify-between">
          <div className="forge-preview-avatar scale-90 sm:scale-100">
            <GerardexAvatar size="lg" showName={false} showParticles={player.showAnimations !== false} />
          </div>
          <div className="text-center sm:text-left">
            <p className="label-clear text-lg">Rango visual: {epicTierName(tier)}</p>
            <p className="body-parchment text-base">Nivel {player.level} · Insignias y logros en el marco</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
              {(player.badges ?? []).map((b) => (
                <span key={b} className="hero-triumph-badge text-xs">{b}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="forge-modal-tabs flex flex-wrap gap-1 border-b border-ink/40 pb-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`forge-tab-btn font-epic uppercase tracking-wider ${
                tab === t.id ? 'forge-tab-active' : 'text-readable-dim hover:text-highlight'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4 max-h-[58vh] min-h-[280px] overflow-y-auto pr-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
            >
              {tab === 'skins' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {GERARDEX_SKINS.map((skin) => {
                    const owned = player.skins.includes(skin.id) || skin.checkUnlock(player, extras);
                    const active = player.currentSkin === skin.id;
                    const flashing = previewSkin === skin.id;
                    return (
                      <motion.button
                        key={skin.id}
                        type="button"
                        disabled={!owned}
                        onClick={() => owned && equipSkin(skin.id)}
                        whileHover={owned ? { scale: 1.02 } : {}}
                        whileTap={owned ? { scale: 0.98 } : {}}
                        className={`forge-epic-card option-war text-left ${active ? 'option-war-active forge-card-equipped' : ''} ${!owned ? 'option-war-locked' : ''} ${flashing ? 'forge-card-flash' : ''}`}
                      >
                        <span className="forge-skin-emoji">{skin.emoji}</span>
                        <p className="forge-skin-label label-clear">{skin.label}</p>
                        <p className="forge-skin-perk text-readable-dim">{skin.perk}</p>
                        <p className="forge-skin-status text-readable-dim">
                          {owned ? (active ? '✓ Insignia en avatar' : 'Equipar insignia') : `🔒 ${skin.unlock}`}
                        </p>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {tab === 'panel' && (
                <div className="space-y-5">
                  <div>
                    <p className="label-clear mb-3 text-base">Tema del panel</p>
                    <div className="space-y-2">
                      {PANEL_THEME_ORDER.map((key) => {
                        const theme = PANEL_THEMES[key];
                        const active = (player.panelTheme ?? 'bronze') === key;
                        const unlocked = isPanelThemeUnlocked(key, player.level);
                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={!unlocked}
                            onClick={() => unlocked && setPanelTheme(key)}
                            className={`option-war w-full text-left ${active ? 'option-war-active' : ''} ${!unlocked ? 'option-war-locked' : ''}`}
                          >
                            <span className="label-clear text-base">{theme.label}</span>
                            <span className="text-readable-dim block text-sm">{theme.description}</span>
                            <span className="text-readable-dim block text-sm">{theme.effect}</span>
                            <span className="text-readable-dim block text-sm">
                              {unlocked ? (active ? '✓ Activo en app' : 'Aplicar') : `🔒 Nivel ${theme.unlockLevel}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="label-clear mb-2 text-base">Skin de interfaz</p>
                    {INTERFACE_SKINS.map((iface) => {
                      const owned = player.level >= iface.minLevel;
                      const active = (player.currentInterfaceSkin ?? 'default') === iface.id;
                      return (
                        <button
                          key={iface.id}
                          type="button"
                          disabled={!owned}
                          onClick={() => owned && setInterfaceSkin(iface.id)}
                          className={`option-war mb-2 w-full text-left ${active ? 'option-war-active' : ''} ${!owned ? 'option-war-locked' : ''}`}
                        >
                          <span className="label-clear text-base">{iface.label}</span>
                          <span className="text-readable-dim block text-sm">{IFACE_PERKS[iface.id]}</span>
                          <span className="text-readable-dim block text-sm">
                            {owned ? (active ? '✓ App transformada' : 'Aplicar') : `🔒 ${iface.unlock}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {tab === 'titles' && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setActiveTitle(stage.title)}
                    className={`forge-epic-card option-war w-full text-left ${activeTitle === stage.title ? 'option-war-active' : ''}`}
                  >
                    <span className="label-clear text-base">{stage.title}</span>
                    <span className="text-readable-dim block text-sm">Por nivel · tono de Gerardex</span>
                  </button>
                  {unlockedTitles.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTitle(t.name)}
                      className={`forge-epic-card option-war w-full text-left ${activeTitle === t.name ? 'option-war-active' : ''}`}
                    >
                      <span className="label-clear text-base">{t.name}</span>
                      <span className="text-readable-dim block text-sm">Título épico</span>
                    </button>
                  ))}
                </div>
              )}

              {tab === 'animations' && (
                <div className="space-y-4">
                  <EpicButton
                    className="w-full"
                    variant={player.showAnimations !== false ? 'gold' : 'ghost'}
                    onClick={() => setShowAnimations(player.showAnimations === false)}
                  >
                    {player.showAnimations !== false ? '✨ Brillos y partículas activos' : '💤 Modo silencioso'}
                  </EpicButton>
                  <p className="label-clear text-base">Evolución épica por nivel</p>
                  <div className="space-y-2">
                    {EPIC_EVOLUTION_MILESTONES.map((m) => {
                      const unlocked = isEvolutionUnlocked(m.unlockLevel, player.level);
                      const active = unlocked && player.showAnimations !== false;
                      return (
                        <div
                          key={m.id}
                          className={`option-war w-full text-left ${active ? 'option-war-active' : ''} ${!unlocked ? 'option-war-locked' : ''}`}
                        >
                          <span className="label-clear text-base">
                            {m.icon} {m.name}
                          </span>
                          <span className="text-readable-dim block text-sm">{m.description}</span>
                          <span className="text-readable-dim block text-sm">
                            {unlocked ? (active ? '✓ Activo en panel y avatar' : '🔒 Activa brillos arriba') : `🔒 Nivel ${m.unlockLevel}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {tab === 'logros' && (
                <div>
                  <p className="label-clear mb-3 text-sm">Desbloqueados aparecen como medallas en el avatar</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {GERARDEX_SKINS.map((skin) => {
                      const owned = player.skins.includes(skin.id) || skin.checkUnlock(player, extras);
                      return (
                        <motion.div
                          key={skin.id}
                          whileHover={{ scale: owned ? 1.05 : 1 }}
                          className={`forge-achievement-slot collection-slot text-center ${owned ? 'collection-unlocked forge-ach-unlocked' : 'collection-locked'}`}
                          title={owned ? skin.label : skin.unlock}
                        >
                          <span className={`text-3xl ${owned ? '' : 'grayscale opacity-40'}`}>{skin.emoji}</span>
                          <p className="forge-ach-label mt-2">{owned ? skin.label : '🔒'}</p>
                          {owned && <p className="text-gold-bright text-[10px] uppercase tracking-wide">En avatar</p>}
                          {!owned && <p className="text-readable-dim text-xs">{skin.unlock}</p>}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </EpicModal>
  );
}
