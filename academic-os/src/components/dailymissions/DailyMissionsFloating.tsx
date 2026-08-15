import { useEffect, type CSSProperties } from 'react';
import { useDailyMissionsStore } from '../../stores/dailyMissionsStore';
import { usePlayerStore } from '../../stores/playerStore';
import { MISSION_COMPLEXITY_LABEL } from '../../utils/gamification';
import { PLAYER_CONFIG } from '../../utils/playerConfig';
import { isDichotomousDailyKind, isDichotomousWeeklyKind } from '../../utils/questMissionKind';
import type { DailyMission, WeeklyMission } from '../../types';
import { PergaminoModal } from './PergaminoModal';
import { QuestProgressBar } from './QuestProgressBar';

function complexityClass(c: string): string {
  if (c === 'heavy') return 'dm-complexity-heavy';
  if (c === 'medium') return 'dm-complexity-medium';
  return 'dm-complexity-light';
}

interface DailyQuestRowProps {
  mission: DailyMission;
  onToggle: () => void;
}

function DailyQuestRow({ mission: m, onToggle }: DailyQuestRowProps) {
  const dichotomous = isDichotomousDailyKind(m.kind);
  const pct = m.target > 0 ? Math.round((m.progress / m.target) * 100) : 0;

  return (
    <li
      className={`daily-mission-row ${m.completed ? 'daily-mission-row-done' : ''} ${m.required ? 'daily-mission-row-required' : ''}`}
    >
      <span className="daily-mission-row-icon" aria-hidden>{m.icon}</span>

      <div className="daily-mission-row-body">
        <div className="daily-mission-row-head">
          <h3 className="title-carved daily-mission-row-title">{m.title}</h3>
          <div className="daily-mission-row-badges">
            {m.required && <span className="daily-mission-required-badge">Oblig.</span>}
            <span className={`daily-mission-complexity ${complexityClass(m.complexity)}`}>
              {MISSION_COMPLEXITY_LABEL[m.complexity]}
            </span>
            <span className="stat-epic daily-mission-row-xp">+{m.xpReward} XP</span>
          </div>
        </div>
        <p className="body-parchment daily-mission-row-desc">{m.description}</p>

        <div className="daily-mission-row-progress">
          {dichotomous ? (
            <div className={`daily-mission-dichotomy daily-mission-dichotomy-inline ${m.completed ? 'daily-mission-dichotomy-done' : ''}`}>
              <span className="daily-mission-dichotomy-icon" aria-hidden>{m.completed ? '☑' : '☐'}</span>
              <span className="flavor-brutal text-[10px] sm:text-xs">
                {m.completed ? 'Completada' : 'Pendiente — marca al terminar'}
              </span>
            </div>
          ) : (
            <QuestProgressBar
              value={m.progress}
              max={m.target}
              variant="study"
              size="normal"
              showLabel
              complete={m.completed}
            />
          )}
        </div>
      </div>

      <div className="daily-mission-row-actions">
        <span className="flavor-brutal daily-mission-row-status">
          {m.completed ? '✓ Hecha' : dichotomous ? 'Sí / No' : `${pct}%`}
        </span>
        <button
          type="button"
          className={`btn-war daily-mission-row-btn ${m.completed ? 'opacity-70' : ''}`}
          onClick={onToggle}
        >
          {m.completed ? '↩ Revertir' : '✓ Completar'}
        </button>
      </div>
    </li>
  );
}

interface WeeklyQuestCardProps {
  mission: WeeklyMission;
  onToggle: () => void;
}

function WeeklyQuestCard({ mission: m, onToggle }: WeeklyQuestCardProps) {
  const dichotomous = isDichotomousWeeklyKind(m.kind);
  const pct = m.target > 0 ? Math.round((m.progress / m.target) * 100) : 0;

  return (
    <li
      className={`daily-mission-card daily-mission-card-compact ${m.completed ? 'daily-mission-card-done' : ''} ${m.required ? 'daily-mission-card-required' : ''}`}
    >
      <div className="daily-mission-card-top">
        <span className="daily-mission-icon">{m.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="title-carved text-xs leading-tight sm:text-sm">{m.title}</h3>
            {m.required && <span className="daily-mission-required-badge">Oblig.</span>}
            <span className={`daily-mission-complexity ${complexityClass(m.complexity)}`}>
              {MISSION_COMPLEXITY_LABEL[m.complexity]}
            </span>
          </div>
          <p className="body-parchment mt-1 text-[10px] leading-snug opacity-90 sm:text-xs">{m.description}</p>
        </div>
        <span className="stat-epic shrink-0 text-sm text-bronze-light">+{m.xpReward}</span>
      </div>

      {dichotomous ? (
        <div className={`daily-mission-dichotomy ${m.completed ? 'daily-mission-dichotomy-done' : ''}`}>
          <span className="daily-mission-dichotomy-icon" aria-hidden>{m.completed ? '☑' : '☐'}</span>
          <span className="flavor-brutal text-[10px] sm:text-xs">
            {m.completed ? 'Completada' : 'Pendiente — marca al terminar'}
          </span>
        </div>
      ) : (
        !m.completed && (
          <div className="mt-2">
            <QuestProgressBar value={m.progress} max={m.target} variant="course" size="normal" />
          </div>
        )
      )}

      <div className="daily-mission-actions mt-2 flex items-center justify-between gap-2">
        <span className="flavor-brutal text-[9px] sm:text-[10px]">
          {m.completed ? '✓ Hecha' : dichotomous ? 'Sí / No' : `${pct}%`}
        </span>
        <button
          type="button"
          className={`btn-war px-2 py-0.5 text-[10px] sm:px-3 sm:py-1 sm:text-xs ${m.completed ? 'opacity-70' : ''}`}
          onClick={onToggle}
        >
          {m.completed ? '↩ Revertir' : '✓ Completar'}
        </button>
      </div>
    </li>
  );
}

export function DailyMissionsFloating() {
  const record = useDailyMissionsStore((s) => s.record);
  const weeklyRecord = useDailyMissionsStore((s) => s.weeklyRecord);
  const history = useDailyMissionsStore((s) => s.history);
  const panelOpen = useDailyMissionsStore((s) => s.panelOpen);
  const setPanelOpen = useDailyMissionsStore((s) => s.setPanelOpen);
  const toggleComplete = useDailyMissionsStore((s) => s.toggleComplete);
  const toggleWeeklyComplete = useDailyMissionsStore((s) => s.toggleWeeklyComplete);
  const load = useDailyMissionsStore((s) => s.load);
  const dailyMissionStreak = usePlayerStore((s) => s.player?.dailyMissionStreak ?? 0);

  const dailyMissions = record?.missions ?? [];
  const weeklyMissions = weeklyRecord?.missions ?? [];
  const dailyCompleted = dailyMissions.filter((m) => m.completed).length;
  const weeklyCompleted = weeklyMissions.filter((m) => m.completed).length;
  const dailyTotal = dailyMissions.length;
  const weeklyTotal = weeklyMissions.length;
  const allDailyDone = dailyTotal > 0 && dailyCompleted === dailyTotal;
  const allWeeklyDone = weeklyTotal > 0 && weeklyCompleted === weeklyTotal;
  const hasRequiredPending = dailyMissions.some((m) => m.required && !m.completed);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <button
        type="button"
        aria-label="Desafíos diarios"
        aria-expanded={panelOpen}
        onClick={() => setPanelOpen(true)}
        className={`daily-missions-fab ${hasRequiredPending ? 'daily-missions-fab-alert' : ''} ${allDailyDone ? 'daily-missions-fab-done' : ''}`}
        style={{ '--dm-progress': `${Math.round((dailyCompleted / Math.max(dailyTotal, 3)) * 100)}%` } as CSSProperties}
      >
        <span className="daily-missions-fab-icon" aria-hidden>📜</span>
        <span className="daily-missions-fab-count">{dailyCompleted}/{dailyTotal || 3}</span>
      </button>

      <PergaminoModal
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title="Pergamino de Disciplina"
        flavor={`${PLAYER_CONFIG.dailyMissionCount} misiones diarias · se renuevan cada medianoche · −XP por cada una incumplida`}
      >
        <div className="daily-missions-scroll">
          <section className="discipline-command-panel" aria-label="Progreso de disciplina">
            <div className="discipline-command-panel-glow" aria-hidden />

            <div className="discipline-command-streak">
              <span className="discipline-streak-flame" aria-hidden>🔥</span>
              <div className="discipline-streak-copy">
                <span className="discipline-streak-label">Racha diaria</span>
                <span className="discipline-streak-value">{dailyMissionStreak}</span>
                <span className="discipline-streak-unit">{dailyMissionStreak === 1 ? 'día' : 'días'}</span>
              </div>
            </div>

            <div className="discipline-command-divider" aria-hidden />

            <div className="discipline-command-bars">
              <div className="discipline-progress-block">
                <div className="discipline-progress-head">
                  <span className="discipline-progress-title">☀️ Hoy</span>
                  <span className="discipline-progress-count">{dailyCompleted}/{dailyTotal || 3}</span>
                </div>
                <QuestProgressBar
                  value={dailyCompleted}
                  max={Math.max(dailyTotal, 3)}
                  variant="streak"
                  size="header"
                  showLabel={false}
                  complete={allDailyDone}
                  rewardLabel={allDailyDone ? `🎁 +${PLAYER_CONFIG.dailyMissionAllCompleteBonusXp} XP bonus` : undefined}
                />
              </div>

              <div className="discipline-progress-block">
                <div className="discipline-progress-head">
                  <span className="discipline-progress-title">🗓️ Semana</span>
                  <span className="discipline-progress-count">{weeklyCompleted}/{weeklyTotal || 1}</span>
                </div>
                <QuestProgressBar
                  value={weeklyCompleted}
                  max={Math.max(weeklyTotal, 1)}
                  variant="course"
                  size="header"
                  showLabel={false}
                  complete={allWeeklyDone}
                  rewardLabel={allWeeklyDone ? `🏆 +${PLAYER_CONFIG.weeklyMissionAllCompleteBonusXp} XP bonus` : undefined}
                />
              </div>
            </div>
          </section>

          <section className="daily-missions-section">
            <div className="daily-missions-section-head">
              <h3 className="title-carved text-sm">☀️ Diarias de hoy</h3>
              <span className="flavor-brutal text-[10px]">
                Máx. {PLAYER_CONFIG.dailyMissionCount} · +{PLAYER_CONFIG.dailyMissionAllCompleteBonusXp} XP al completar todas · caducan a medianoche
              </span>
            </div>
            <ul className="daily-missions-list-daily">
              {dailyMissions.map((m) => (
                <DailyQuestRow key={m.id} mission={m} onToggle={() => void toggleComplete(m.id)} />
              ))}
            </ul>
          </section>

          <section className="daily-missions-section">
            <div className="daily-missions-section-head">
              <h3 className="title-carved text-sm">🗓️ Semanales</h3>
              <span className="flavor-brutal text-[10px]">
                {weeklyTotal} metas · +{PLAYER_CONFIG.weeklyMissionAllCompleteBonusXp} XP bonus semanal
              </span>
            </div>
            <ul className="daily-missions-grid-weekly">
              {weeklyMissions.map((m) => (
                <WeeklyQuestCard key={m.id} mission={m} onToggle={() => void toggleWeeklyComplete(m.id)} />
              ))}
            </ul>
          </section>

          {history.length > 0 && (
            <section className="daily-missions-history">
              <h4 className="title-carved daily-missions-history-title">Historial diario</h4>
              <p className="body-parchment daily-missions-history-flavor">
                Últimos días — ★ día perfecto · números = completadas/total
              </p>
              <div className="daily-missions-history-grid">
                {[...history].reverse().slice(0, 14).map((h) => (
                  <div
                    key={h.date}
                    className={`daily-missions-history-day ${h.allComplete ? 'daily-missions-history-perfect' : ''} ${(h.penaltyXp ?? 0) > 0 ? 'daily-missions-history-penalty' : ''}`}
                    title={`${h.completed}/${h.total}${h.penaltyXp ? ` · −${h.penaltyXp} XP` : ''}`}
                  >
                    <span className="text-[9px] opacity-70">{h.date.slice(5)}</span>
                    <span className="stat-epic text-xs">{h.allComplete ? '★' : `${h.completed}/${h.total}`}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </PergaminoModal>
    </>
  );
}
