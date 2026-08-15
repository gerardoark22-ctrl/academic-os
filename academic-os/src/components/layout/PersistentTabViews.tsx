import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { motion } from 'framer-motion';
import { NAV_TABS } from '../../utils/uiCopy';

type Tab = (typeof NAV_TABS)[number]['id'];

const AgoraDashboard = lazy(() =>
  import('../dashboard/AgoraDashboard').then((m) => ({ default: m.AgoraDashboard })),
);
const RankingDashboard = lazy(() =>
  import('../ranking/RankingDashboard').then((m) => ({ default: m.RankingDashboard })),
);
const CoursesLibrary = lazy(() =>
  import('../courses/CoursesLibrary').then((m) => ({ default: m.CoursesLibrary })),
);
const MissionsBoard = lazy(() =>
  import('../missions/MissionsBoard').then((m) => ({ default: m.MissionsBoard })),
);
const SunDialTimeBlocking = lazy(() =>
  import('../timeblocking/SunDialTimeBlocking').then((m) => ({ default: m.SunDialTimeBlocking })),
);

const TAB_VIEWS: Record<Tab, ComponentType> = {
  agora: AgoraDashboard,
  ranking: RankingDashboard,
  courses: CoursesLibrary,
  missions: MissionsBoard,
  time: SunDialTimeBlocking,
};

const ALL_TABS: Tab[] = ['agora', 'ranking', 'courses', 'missions', 'time'];

function LoadingScreen() {
  return (
    <div className="flex h-64 items-center justify-center">
      <motion.div
        animate={{ rotate: [0, 15, -15, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="text-4xl opacity-60"
      >
        ⚔️
      </motion.div>
    </div>
  );
}

interface Props {
  activeTab: Tab;
}

/** Monta cada tab visitada y la oculta con CSS — conserva scroll y formularios */
export function PersistentTabViews({ activeTab }: Props) {
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set(['agora']));

  useEffect(() => {
    setVisited((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  return (
    <>
      {ALL_TABS.map((tab) => {
        if (!visited.has(tab)) return null;
        const View = TAB_VIEWS[tab];
        const isActive = tab === activeTab;
        return (
          <div
            key={tab}
            id={`tab-panel-${tab}`}
            role="tabpanel"
            aria-hidden={!isActive}
            className={isActive ? 'block animate-tab-in' : 'hidden'}
          >
            <Suspense fallback={isActive ? <LoadingScreen /> : null}>
              <View />
            </Suspense>
          </div>
        );
      })}
    </>
  );
}
