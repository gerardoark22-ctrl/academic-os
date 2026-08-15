import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { StoneCard, SectionTitle, DynamicProgressBar } from '../ui';
import { buildRankingSnapshot, type RankingSnapshot } from '../../utils/statsEngine';
import { formatGoalHoursMinutes } from '../../utils/dailyGoal';
import { usePlayerStore } from '../../stores/playerStore';
import { useTimeStore } from '../../stores/timeStore';

function RadialGauge({ value, label, sub }: { value: number; label: string; sub?: string }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="ranking-radial">
      <svg viewBox="0 0 128 128" className="ranking-radial-svg">
        <circle cx="64" cy="64" r={r} className="ranking-radial-track" />
        <motion.circle
          cx="64"
          cy="64"
          r={r}
          className="ranking-radial-fill"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
      </svg>
      <div className="ranking-radial-center">
        <span className="ranking-radial-value">{value}%</span>
        <span className="ranking-radial-label">{label}</span>
        {sub && <span className="ranking-radial-sub">{sub}</span>}
      </div>
    </div>
  );
}

function WeekChart({ data, goalLine }: { data: RankingSnapshot['weeklyStudy']; goalLine: number }) {
  const maxVal = Math.max(...data.map((d) => d.minutes), goalLine, 60);
  return (
    <div className="ranking-week-chart">
      <div className="ranking-week-bars">
        {data.map((d, i) => {
          const h = maxVal > 0 ? Math.max(6, (d.minutes / maxVal) * 100) : 6;
          const goalH = maxVal > 0 ? (goalLine / maxVal) * 100 : 0;
          const day = new Date(`${d.date}T12:00:00`).toLocaleDateString('es-PE', { weekday: 'short' });
          return (
            <div key={d.date} className="ranking-week-col">
              <span className="ranking-week-value">{d.minutes}m</span>
              <div className="ranking-week-bar-wrap">
                <div className="ranking-week-goal-line" style={{ bottom: `${goalH}%` }} />
                <motion.div
                  className={`ranking-week-bar ${d.goalMet ? 'ranking-week-bar-met' : ''}`}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: i * 0.06, duration: 0.55 }}
                />
              </div>
              <span className="ranking-week-label">{day}</span>
              {d.blocks > 0 && <span className="ranking-week-blocks">{d.blocks} blk</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PeriodRadar({ dist }: { dist: RankingSnapshot['periodDistribution'] }) {
  const total = dist.morning + dist.afternoon + dist.evening || 1;
  const items = [
    { label: 'Mañana', value: dist.morning, icon: '☀', color: '#FFD700' },
    { label: 'Tarde', value: dist.afternoon, icon: '⚡', color: '#32CD32' },
    { label: 'Noche', value: dist.evening, icon: '🌙', color: '#6495ED' },
  ];
  return (
    <div className="ranking-period-grid">
      {items.map((item) => {
        const pct = Math.round((item.value / total) * 100);
        return (
          <div key={item.label} className="ranking-period-item">
            <div
              className="ranking-period-ring"
              style={{
                background: `conic-gradient(${item.color} ${pct * 3.6}deg, rgba(255,255,255,0.08) 0)`,
              }}
            >
              <span>{item.icon}</span>
            </div>
            <p className="stat-epic text-xs text-readable-dim">{item.label}</p>
            <p className="stat-number !text-lg text-highlight">{item.value}m</p>
            <p className="text-readable-dim text-[10px]">{pct}%</p>
          </div>
        );
      })}
    </div>
  );
}

export function RankingDashboard() {
  const [stats, setStats] = useState<RankingSnapshot | null>(null);
  const blocksRevision = useTimeStore((s) => s.blocksRevision);
  const playerXp = usePlayerStore((s) => s.player?.xp);

  const refresh = useCallback(() => {
    void buildRankingSnapshot().then(setStats);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, blocksRevision, playerXp]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  if (!stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-3xl"
        >
          📊
        </motion.span>
      </div>
    );
  }

  const trendLabel =
    stats.trend === 'up' ? '📈 Rendimiento en ascenso' :
    stats.trend === 'down' ? '📉 Caída — recupera el ritmo' :
    '➡️ Ritmo estable';

  const weekTotal = stats.weeklyStudy.reduce((s, d) => s + d.minutes, 0);
  const typeTotal = stats.studyByType.study + stats.studyByType.exam + stats.studyByType.task;

  return (
    <div className="space-y-6">
      <SectionTitle title="Ranking & Estadísticas" flavor="Datos en vivo de tu campaña" large />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Nivel', value: stats.player?.level ?? 1, icon: '⚔' },
          { label: 'XP total', value: stats.player?.xp ?? 0, icon: '📜' },
          { label: 'Racha', value: `${stats.streak}d`, icon: '🔥' },
          { label: 'Hoy', value: `${stats.todayVsYesterday.today}m`, icon: '⏱' },
        ].map((s) => (
          <StoneCard key={s.label}>
            <p className="stat-epic text-xs text-readable-dim">{s.icon} {s.label}</p>
            <p className="stat-number mt-1 !text-2xl text-highlight">{s.value}</p>
          </StoneCard>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <StoneCard hero className="xl:col-span-2">
          <SectionTitle title="Estudio semanal" flavor={trendLabel} className="mb-3" />
          <WeekChart data={stats.weeklyStudy} goalLine={stats.goalMinutes} />
          <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm">
            <span className="body-parchment">
              Total: {weekTotal}m / {stats.weeklyGoalTarget}m ({stats.weeklyGoalPct}%)
            </span>
            <span className="body-parchment">
              Meta diaria: {formatGoalHoursMinutes(stats.goalMinutes)} · Días cumplidos: {stats.goalDaysThisWeek}/7
            </span>
          </div>
        </StoneCard>

        <StoneCard hero>
          <SectionTitle title="Índice de eficiencia" flavor="Rendimiento global" className="mb-2" />
          <RadialGauge
            value={stats.efficiencyScore}
            label="Eficiencia"
            sub={`Pico: ${stats.peakDayLabel} (${stats.peakDayMinutes}m)`}
          />
          <p className="body-parchment mt-3 text-center text-xs">
            Bloques hoy: {stats.todayBlocksDone}/{stats.todayBlocksScheduled || '—'}
          </p>
        </StoneCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StoneCard hero>
          <SectionTitle title="Hoy vs ayer" flavor="Comparativa directa" className="mb-2" />
          <div className="ranking-vs-grid">
            {[
              { label: 'Ayer', value: stats.todayVsYesterday.yesterday, tone: 'muted' },
              { label: 'Hoy', value: stats.todayVsYesterday.today, tone: 'live' },
            ].map((d) => {
              const max = Math.max(stats.todayVsYesterday.today, stats.todayVsYesterday.yesterday, stats.goalMinutes);
              const pct = max > 0 ? Math.round((d.value / max) * 100) : 0;
              return (
                <div key={d.label} className={`ranking-vs-card ranking-vs-${d.tone}`}>
                  <p className="stat-epic text-xs">{d.label}</p>
                  <p className="stat-number !text-3xl text-highlight">{d.value}m</p>
                  <div className="ranking-vs-track">
                    <motion.div
                      className="ranking-vs-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="body-parchment mt-3 text-center text-sm">
            {stats.todayVsYesterday.delta >= 0 ? '📈' : '📉'}{' '}
            {stats.todayVsYesterday.delta >= 0 ? '+' : ''}{stats.todayVsYesterday.delta} min
            {stats.todayVsYesterday.pct !== 0 && ` (${stats.todayVsYesterday.pct > 0 ? '+' : ''}${stats.todayVsYesterday.pct}%)`}
          </p>
        </StoneCard>

        <StoneCard>
          <SectionTitle title="Ritmo por periodo" flavor="Esta semana" className="mb-2" />
          <PeriodRadar dist={stats.periodDistribution} />
        </StoneCard>
      </div>

      <StoneCard>
        <SectionTitle title="Composición del estudio" flavor="Estudio · Examen · Tareas" className="mb-3" />
        <div className="ranking-type-stack">
          {[
            { label: '📚 Estudio', value: stats.studyByType.study, color: '#32CD32' },
            { label: '⚔ Examen', value: stats.studyByType.exam, color: '#DC143C' },
            { label: '🔨 Tarea', value: stats.studyByType.task, color: '#1E90FF' },
          ].map((t) => {
            const pct = typeTotal > 0 ? Math.round((t.value / typeTotal) * 100) : 0;
            return (
              <div key={t.label} className="ranking-type-row">
                <span className="ranking-type-label">{t.label}</span>
                <div className="ranking-type-track">
                  <motion.div
                    className="ranking-type-fill"
                    style={{ background: t.color, boxShadow: `0 0 10px ${t.color}88` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                  />
                </div>
                <span className="ranking-type-pct">{pct}%</span>
                <span className="ranking-type-min">{t.value}m</span>
              </div>
            );
          })}
        </div>
        <p className="body-parchment mt-3 text-center text-sm">
          {stats.totalBlocksCompleted} bloques · {Math.floor(stats.totalStudyMinutes / 60)}h {stats.totalStudyMinutes % 60}m acumulados
          {stats.perfectDaysCount > 0 && ` · 🏆 ${stats.perfectDaysCount} día(s) perfecto(s)`}
        </p>
      </StoneCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StoneCard>
          <SectionTitle title="Progreso por curso" flavor="Dominio + bloques semanales" className="mb-2" />
          <div className="space-y-3">
            {stats.courseProgress.map((c) => (
              <div key={c.name}>
                <DynamicProgressBar
                  value={c.progress}
                  label={`${c.name} · ${c.blocksThisWeek} blk/sem`}
                  variant="course"
                  size="sm"
                  shimmer={c.progress >= 50}
                />
              </div>
            ))}
            {stats.courseProgress.length === 0 && (
              <p className="body-parchment text-sm">Sin cursos registrados</p>
            )}
          </div>
        </StoneCard>

        <StoneCard>
          <SectionTitle title="Misiones & combate" flavor="Tablero de guerra" className="mb-2" />
          <DynamicProgressBar
            value={stats.completionRate}
            label="Tasa global completada"
            variant="study"
            size="md"
          />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="stat-block !py-3">
              <p className="stat-epic text-xs text-readable-dim">Activas</p>
              <p className="stat-number !text-xl text-highlight">{stats.missionsActive}</p>
            </div>
            <div className="stat-block !py-3">
              <p className="stat-epic text-xs text-readable-dim">Hechas</p>
              <p className="stat-number !text-xl text-highlight">{stats.missionsCompleted}</p>
            </div>
            <div className="stat-block !py-3">
              <p className="stat-epic text-xs text-readable-dim">Esta sem.</p>
              <p className="stat-number !text-xl text-highlight">{stats.missionsCompletedThisWeek}</p>
            </div>
          </div>
        </StoneCard>
      </div>
    </div>
  );
}
