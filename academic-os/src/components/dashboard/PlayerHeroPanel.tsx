import { motion } from 'framer-motion';
import { GerardexAvatar } from '../gerardex/GerardexAvatar';
import { DynamicProgressBar } from '../ui/DynamicProgressBar';
import { PlayerCustomizeStrip } from './PlayerCustomizeStrip';
import { HeroAmbientFX } from './HeroAmbientFX';
import { usePlayerStore, PLAYER_CONFIG } from '../../stores/playerStore';
import { formatGoalHoursMinutes, getDailyGoalMinutes, getScaledDailyBonusXp } from '../../utils/dailyGoal';
import { useMissionsStore } from '../../stores/missionsStore';
import { xpProgressInLevel, underworldDays, getGerardexStage, getEffectiveStreak } from '../../utils/gamification';
import {
  GERARDEX_COMIC,
} from '../../utils/playerConfig';
import {
  computeRpgStats,
  getGerardexMessageByTitle,
  getPanelStateClass,
} from '../../utils/cosmetics';
import { HeroStatBlocks } from './HeroStatBlocks';
import { getEpicTier, epicTierClass } from '../../utils/levelEpic';
import { PANEL_THEMES, getEffectivePanelTheme } from '../../utils/progressGradients';
import { useTodayStudyMinutes } from '../../hooks/useTodayStudyMinutes';

export function PlayerHeroPanel() {
  const player = usePlayerStore((s) => s.player);
  const todayMinutes = useTodayStudyMinutes();
  const missions = useMissionsStore((s) => s.missions);

  if (!player) return null;

  const goalMinutes = getDailyGoalMinutes(player);
  const goalMet = todayMinutes >= goalMinutes;
  const blocksDone = Math.floor(todayMinutes / PLAYER_CONFIG.blockMinutes);
  const activeMissions = missions.filter((m) => !m.completed).length;
  const missionsDone = missions.filter((m) => m.completed).length;

  const stage = getGerardexStage(player.level);
  const effectiveStreak = getEffectiveStreak(player.studyStreak ?? 0, player.goalMetDate);
  const isDirty = underworldDays(player.lastStudyDate) > 0
    || (!player.dailyBonusActive && todayMinutes < goalMinutes);

  const xpInfo = xpProgressInLevel(player.xp);
  const yesterdayMinutes = player.yesterdayStudyMinutes ?? 0;
  const studyPct = Math.min(100, Math.round((todayMinutes / goalMinutes) * 100));
  const displayTitle = player.activeTitle ?? stage.title;
  const bonusXp = getScaledDailyBonusXp(goalMinutes);

  const panelStateClass = getPanelStateClass(
    effectiveStreak,
    todayMinutes,
    goalMinutes,
    player.lastStudyDate,
    player.dailyBonusActive === false,
  );

  const ambientIntensity = Math.min(1, (effectiveStreak / 14) + (studyPct / 200));
  const visualState = isDirty ? 'dirty' : panelStateClass === 'panel-state-radiant' ? 'radiant' : panelStateClass === 'panel-state-hell' ? 'dirty' : 'normal';

  const rpg = computeRpgStats(player, {
    perfectDays: player.perfectDaysCount ?? 0,
    legendaryMissionsDone: 0,
    coursesCompleted: 0,
    blocksCompleted: player.totalBlocksCompleted ?? 0,
  });

  const comicMsg = getGerardexMessageByTitle(
    displayTitle,
    todayMinutes > yesterdayMinutes ? GERARDEX_COMIC.vsYesterdayWin : GERARDEX_COMIC.streak(player.studyStreak),
  );

  const animOff = player.showAnimations === false;
  const panelTheme = getEffectivePanelTheme(player.level, player.panelTheme);
  const themeClass = PANEL_THEMES[panelTheme].class;
  const epicTier = getEpicTier(player.level);
  const panelTierClass = epicTierClass('panel-hero', epicTier);

  const heroShimmer = !animOff && (
    panelStateClass === 'panel-state-radiant'
    || panelTheme === 'golden'
    || panelTheme === 'inferno'
    || panelTheme === 'titan'
    || epicTier >= 2
  );

  return (
    <div className={`panel-hero ${panelStateClass} ${themeClass} ${panelTierClass} ${heroShimmer ? 'hero-shimmer' : ''} rounded-sm p-1`}>
      <div className="panel-epic-inner p-4 md:p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="relative flex flex-col items-center lg:col-span-5">
            <HeroAmbientFX intensity={ambientIntensity} active={!animOff} />
            <GerardexAvatar size="xl" visualState={visualState} showName showParticles={!animOff} />
            <PlayerCustomizeStrip />
            <motion.p
              key={comicMsg}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flavor-brutal mt-3 max-w-xs text-center text-base"
            >
              {comicMsg}
            </motion.p>
            {(player.badges?.length ?? 0) > 0 && (
              <div className="hero-triumph-row mt-3 flex flex-wrap justify-center gap-2">
                {player.badges!.map((b) => (
                  <span key={b} className="hero-triumph-badge">{b}</span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-5 lg:col-span-7">
            <HeroStatBlocks level={player.level} xp={player.xp} streak={effectiveStreak} animOn={!animOff} />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                ['Sabiduría', rpg.sabiduria, '📜'],
                ['Resistencia', rpg.resistencia, '🛡️'],
                ['Disciplina', rpg.disciplina, '⚔'],
                ['Velocidad', rpg.velocidad, '⚡'],
              ] as const).map(([label, val, icon]) => (
                <div key={label} className="rpg-stat-block stat-block !py-2.5 text-center">
                  <p className="rpg-stat-label">{icon} {label}</p>
                  <p className="stat-epic rpg-stat-value text-highlight">{val}</p>
                </div>
              ))}
            </div>

            <DynamicProgressBar
              value={xpInfo.current}
              max={xpInfo.needed}
              label={`Progreso al nivel ${xpInfo.nextLevel}`}
              sublabel={`${xpInfo.remaining} XP para ascender · curva −40%`}
              variant="xp"
              size="lg"
              shimmer={!animOff}
            />

            <div className="space-y-2">
              <p className="label-clear text-sm">
                Meta diaria — {formatGoalHoursMinutes(goalMinutes)}
                <span className="text-readable-dim ml-2 text-xs">
                  ({Math.round(goalMinutes / PLAYER_CONFIG.blockMinutes)} bloques)
                </span>
              </p>
              <DynamicProgressBar
                value={todayMinutes}
                max={goalMinutes}
                label=""
                sublabel={
                  goalMet
                    ? `✓ Meta cumplida — +${bonusXp} XP bonus`
                    : `${Math.floor(todayMinutes / 60)}h ${todayMinutes % 60}m / ${formatGoalHoursMinutes(goalMinutes)}`
                }
                variant="study"
                size="md"
                shimmer={!animOff && studyPct >= 75}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="stat-block !py-4 text-left">
                <p className="label-clear text-sm">Hoy vs ayer</p>
                <p className="stat-epic mt-2 text-2xl text-highlight">
                  {Math.floor(todayMinutes / 60)}h{todayMinutes % 60}m
                </p>
                <p className="text-readable-dim text-sm">ayer: {Math.floor(yesterdayMinutes / 60)}h{yesterdayMinutes % 60}m</p>
                <p className="body-parchment mt-1 text-sm">{blocksDone} bloques · {missionsDone} misiones</p>
              </div>
              <div className="stat-block !py-4 text-left">
                <p className="label-clear text-sm">Campo activo</p>
                <p className="stat-epic mt-1 text-2xl text-highlight">{activeMissions}</p>
                <p className="body-parchment text-sm">misiones pendientes</p>
                {underworldDays(player.lastStudyDate) > 0 && (
                  <p className="flavor-brutal mt-2 text-xs">⚰️ Inframundo activo</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
