import { useState, lazy, Suspense, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { SilentErrorBoundary } from './components/SilentErrorBoundary';
import { useAppInit } from './hooks/useAppInit';
import { usePersistLifecycle } from './hooks/usePersistLifecycle';
import { useDailyRolloverWatch } from './hooks/useDailyRolloverWatch';
import { useNotifications } from './hooks/useNotifications';
import { useBlockEndSound } from './hooks/useBlockEndSound';
import { PersistentTabViews } from './components/layout/PersistentTabViews';
import { usePlayerStore } from './stores/playerStore';
import { useDailyMissionsStore } from './stores/dailyMissionsStore';
import { underworldDays, todayISO } from './utils/gamification';
import { NAV_TABS } from './utils/uiCopy';
import { shouldShowDailyChest, rollChestReward, type ChestReward } from './utils/cosmetics';

const DeepSeekAssistant = lazy(() =>
  import('./components/ai/DeepSeekAssistant').then((m) => ({ default: m.DeepSeekAssistant })),
);
const PerfectDayOverlay = lazy(() =>
  import('./components/celebration/PerfectDayOverlay').then((m) => ({ default: m.PerfectDayOverlay })),
);
const LevelUpOverlay = lazy(() =>
  import('./components/celebration/LevelUpOverlay').then((m) => ({ default: m.LevelUpOverlay })),
);
const LevelDownOverlay = lazy(() =>
  import('./components/celebration/LevelDownOverlay').then((m) => ({ default: m.LevelDownOverlay })),
);
const AchievementOverlay = lazy(() =>
  import('./components/celebration/AchievementOverlay').then((m) => ({ default: m.AchievementOverlay })),
);
const WarChestModal = lazy(() =>
  import('./components/celebration/WarChestModal').then((m) => ({ default: m.WarChestModal })),
);
const XpGainCelebrationStack = lazy(() =>
  import('./components/celebration/XpGainCelebrationStack').then((m) => ({ default: m.XpGainCelebrationStack })),
);
const DailyMissionsFloating = lazy(() =>
  import('./components/dailymissions/DailyMissionsFloating').then((m) => ({ default: m.DailyMissionsFloating })),
);
const SuperHellAlert = lazy(() =>
  import('./components/alerts/SuperHellAlert').then((m) => ({ default: m.SuperHellAlert })),
);
const SystemSettingsModal = lazy(() =>
  import('./components/settings/SystemSettingsModal').then((m) => ({ default: m.SystemSettingsModal })),
);

type Tab = (typeof NAV_TABS)[number]['id'];

function AppShell() {
  useAppInit();
  usePersistLifecycle();
  useDailyRolloverWatch();
  useNotifications();
  useBlockEndSound();
  const touchAppOpen = usePlayerStore((s) => s.touchAppOpen);
  const player = usePlayerStore((s) => s.player);
  const celebration = usePlayerStore((s) => s.celebration);
  const clearCelebration = usePlayerStore((s) => s.clearCelebration);
  const claimChest = usePlayerStore((s) => s.claimChest);
  const questPendingChest = useDailyMissionsStore((s) => s.pendingChest);
  const claimPendingChest = useDailyMissionsStore((s) => s.claimPendingChest);

  // Las notificaciones push abren /?tab=… para caer en la vista que las motivó.
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const pedida = new URLSearchParams(window.location.search).get('tab');
    return NAV_TABS.some((t) => t.id === pedida) ? (pedida as Tab) : 'agora';
  });
  const today = todayISO();
  const hellDismissKey = `hell-dismiss-${today}`;
  const [hellDismissed, setHellDismissed] = useState(
    () => typeof sessionStorage !== 'undefined' && sessionStorage.getItem(hellDismissKey) === '1',
  );
  const [chestReward, setChestReward] = useState<ChestReward | null>(null);
  const [chestOpen, setChestOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const chestChecked = useRef(false);

  const underworld = underworldDays(player?.lastStudyDate ?? null);
  const showHell = underworld > 0 && player?.lastStudyDate !== today && !hellDismissed;
  const ifaceClass = player?.currentInterfaceSkin ? `iface-${player.currentInterfaceSkin}` : 'iface-default';

  const dismissHell = () => {
    try {
      sessionStorage.setItem(hellDismissKey, '1');
    } catch {
      /* ignore */
    }
    setHellDismissed(true);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  useEffect(() => {
    void touchAppOpen();
    const onFocus = () => void touchAppOpen();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // Notificación tocada con la app ya abierta: el service worker manda la vista.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type !== 'aos-push-nav') return;
      const pedida = new URL(e.data.url ?? '/', window.location.origin).searchParams.get('tab');
      if (NAV_TABS.some((t) => t.id === pedida)) setActiveTab(pedida as Tab);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (questPendingChest) setChestOpen(true);
  }, [questPendingChest]);

  useEffect(() => {
    if (!player || chestChecked.current || questPendingChest) return;
    chestChecked.current = true;
    if (shouldShowDailyChest(player)) {
      setChestReward(rollChestReward(player));
      setChestOpen(true);
    }
  }, [player, questPendingChest]);

  const handleResetDay = async () => {
    const ok = window.confirm(
      '¿Reiniciar el progreso del día?\n\nSe revierte XP, bonus, bloques completados y checks de progreso al estado de esta mañana.\n\nCursos, temas, tareas y asignaciones del horario NO se eliminan.\n\nEsta acción no se puede deshacer.',
    );
    if (!ok) return;
    const done = await usePlayerStore.getState().resetCompleteDay();
    if (!done) {
      window.alert('No hay snapshot del día para restaurar.');
    }
  };

  const navList = (
    <nav className="flex flex-col gap-1 p-2" role="tablist">
      {NAV_TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`tab-panel-${tab.id}`}
          onClick={() => {
            setActiveTab(tab.id);
            setSidebarOpen(false);
          }}
          className={`flex items-center gap-2 rounded-sm px-3 py-2.5 text-left transition ${activeTab === tab.id ? 'nav-tab-active' : 'text-parchment-dim hover:bg-bronze-dark/50'}`}
        >
          <span className="text-lg">{tab.icon}</span>
          <span className="flex flex-col">
            <span className="title-carved text-[10px] leading-tight">{tab.label}</span>
            <span className="flavor-brutal text-[9px] leading-tight opacity-80">{tab.flavor}</span>
          </span>
        </button>
      ))}
    </nav>
  );

  return (
    <div className={`bg-ruins greek-arena min-h-screen ${ifaceClass}`}>
      <div className="greek-frieze greek-frieze-top" aria-hidden />
      <div className="greek-frieze greek-frieze-bottom" aria-hidden />

      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-40 md:flex md:w-56 md:flex-col md:overflow-y-auto md:border-r-4 md:border-ink md:bg-bronze-dark/95">
        <div className="border-b-2 border-ink/50 p-3">
          <h1 className="title-carved text-sm">Academic OS</h1>
        </div>
        {navList}
      </aside>

      {sidebarOpen && (
        <>
          <div className="nav-drawer-backdrop fixed inset-0 z-40 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />
          <aside className="nav-drawer fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto border-r-4 border-ink bg-bronze-dark md:hidden">
            <div className="flex items-center justify-between border-b-2 border-ink/50 p-3">
              <h1 className="title-carved text-sm">Academic OS</h1>
              <button onClick={() => setSidebarOpen(false)} className="btn-war px-2 py-1 text-xs" aria-label="Cerrar menú">
                ✕
              </button>
            </div>
            {navList}
          </aside>
        </>
      )}

      <header className="header-ruin sticky top-0 z-30 md:ml-56">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="btn-war min-h-[40px] min-w-[40px] px-2 py-1 text-base md:hidden"
              aria-label="Abrir menú de navegación"
            >
              ☰
            </button>
            <div className="min-w-0">
              <h1 className="title-carved text-sm sm:text-base md:text-lg">Academic OS</h1>
              <p className="flavor-brutal hidden text-[11px] sm:block">Odyssey of Gerardex — campo de ruinas</p>
            </div>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="btn-war min-h-[40px] min-w-[40px] px-3 py-1 text-lg"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Más opciones"
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="panel-epic absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden" role="menu">
                <div className="panel-epic-inner flex flex-col">
                  <button
                    role="menuitem"
                    onClick={() => {
                      void handleResetDay();
                      setMenuOpen(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 text-left hover:bg-bronze-dark/50"
                  >
                    <span aria-hidden>⏪</span>
                    <span className="label-clear text-sm">Reiniciar día</span>
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setSettingsOpen(true);
                      setMenuOpen(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 text-left hover:bg-bronze-dark/50"
                  >
                    <span aria-hidden>⚙</span>
                    <span className="label-clear text-sm">Configuración</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {showHell && player && (
        <div className="relative z-30 mx-auto max-w-7xl px-4 pt-4 md:ml-56">
          <Suspense fallback={null}>
            <SuperHellAlert
              days={underworld}
              player={player}
              onDismiss={dismissHell}
            />
          </Suspense>
        </div>
      )}

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 md:ml-56">
        <PersistentTabViews activeTab={activeTab} />
        {activeTab === 'agora' && (
          <Suspense fallback={null}>
            <DeepSeekAssistant />
          </Suspense>
        )}
      </main>

      <Suspense fallback={null}>
        <SystemSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </Suspense>

      <SilentErrorBoundary label="celebration">
        <AnimatePresence mode="wait">
        {celebration?.type === 'perfect-day' && (
          <Suspense key="perfect-day" fallback={null}>
            <PerfectDayOverlay show xpBonus={celebration.xpBonus} nightBonus={celebration.nightBonus} onClose={clearCelebration} />
          </Suspense>
        )}
        {celebration?.type === 'level-up' && (
          <Suspense key={`level-up-${celebration.level}`} fallback={null}>
            <LevelUpOverlay
              show
              level={celebration.level}
              title={celebration.title}
              weapon={celebration.weapon}
              armor={celebration.armor}
              onClose={clearCelebration}
            />
          </Suspense>
        )}
        {celebration?.type === 'level-down' && (
          <Suspense key="level-down" fallback={null}>
            <LevelDownOverlay show level={celebration.level} title={celebration.title} onClose={clearCelebration} />
          </Suspense>
        )}
        {celebration?.type === 'achievement' && (
          <Suspense key="achievement" fallback={null}>
            <AchievementOverlay show name={celebration.name} emoji={celebration.emoji} onClose={clearCelebration} />
          </Suspense>
        )}
        </AnimatePresence>
      </SilentErrorBoundary>

      <Suspense fallback={null}>
        <WarChestModal
          open={chestOpen && !!(questPendingChest ?? chestReward)}
          reward={questPendingChest ?? chestReward}
          onClaim={async () => {
            if (questPendingChest) {
              await claimPendingChest();
            } else if (chestReward) {
              await claimChest(chestReward);
            }
            setChestOpen(false);
            setChestReward(null);
          }}
        />
      </Suspense>

      <Suspense fallback={null}>
        <DailyMissionsFloating />
      </Suspense>

      <SilentErrorBoundary label="xp-celebration">
        <Suspense fallback={null}>
          <XpGainCelebrationStack />
        </Suspense>
      </SilentErrorBoundary>
    </div>
  );
}

export default AppShell;
