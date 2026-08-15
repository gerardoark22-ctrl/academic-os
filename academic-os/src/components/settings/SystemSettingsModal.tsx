import { useEffect, useState } from 'react';
import { EpicModal, EpicButton } from '../ui';
import { usePlayerStore } from '../../stores/playerStore';
import {
  formatGoalHoursMinutes,
  getDailyGoalMinutes,
  getDailyGoalBlockOptions,
  getScaledDailyBonusXp,
  DEFAULT_DAILY_GOAL_MINUTES,
} from '../../utils/dailyGoal';
import { PLAYER_CONFIG } from '../../utils/playerConfig';
import {
  DEFAULT_BLOCK_END,
  DEFAULT_BLOCK_START,
  getBlockSchedule,
  validateBlockSchedule,
} from '../../utils/blockSchedule';
import {
  DEFAULT_MORNING_TIME,
  DEFAULT_NIGHT_TIME,
  getNotifTimes,
  setNotifTimes,
} from '../../utils/notifTimes';
import { diagnose, enablePush, pushConfigured, syncSnapshot } from '../../utils/push';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SystemSettingsModal({ open, onClose }: Props) {
  const player = usePlayerStore((s) => s.player);
  const setDailyGoalMinutes = usePlayerStore((s) => s.setDailyGoalMinutes);
  const updateBlockSchedule = usePlayerStore((s) => s.updateBlockSchedule);
  const setShowAnimations = usePlayerStore((s) => s.setShowAnimations);

  const goalOptions = getDailyGoalBlockOptions();
  const currentGoal = getDailyGoalMinutes(player);
  const schedule = getBlockSchedule(player);

  const [goalMinutes, setGoalMinutes] = useState(currentGoal);
  const [start, setStart] = useState(schedule.start);
  const [end, setEnd] = useState(schedule.end);
  const [animations, setAnimations] = useState(player?.showAnimations !== false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [morning, setMorning] = useState(DEFAULT_MORNING_TIME);
  const [night, setNight] = useState(DEFAULT_NIGHT_TIME);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void getNotifTimes().then((t) => {
      setMorning(t.morning);
      setNight(t.night);
    });
  }, [open]);

  useEffect(() => {
    if (!open || !player) return;
    setGoalMinutes(getDailyGoalMinutes(player));
    const sch = getBlockSchedule(player);
    setStart(sch.start);
    setEnd(sch.end);
    setAnimations(player.showAnimations !== false);
    setError(null);
  }, [open, player]);

  const handleSave = async () => {
    if (!player) return;
    const schedErr = validateBlockSchedule(start, end);
    if (schedErr) {
      setError(schedErr);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const goalChanged = goalMinutes !== getDailyGoalMinutes(player);
      const schedChanged = start !== schedule.start || end !== schedule.end;
      const animChanged = animations !== (player.showAnimations !== false);

      if (goalChanged) {
        await setDailyGoalMinutes(goalMinutes);
      }
      if (schedChanged) {
        await updateBlockSchedule(start, end);
      }
      if (animChanged) {
        await setShowAnimations(animations);
      }
      await setNotifTimes({ morning, night });
      // El servidor lee las horas del snapshot, así que hay que subirlo ya
      // mismo: si no, el cambio recién aplicaría en el siguiente ciclo.
      void syncSnapshot();

      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToday = async () => {
    if (!player) return;
    const ok = window.confirm(
      '¿Reiniciar la meta de hoy a 0? Se desmarcarán los bloques completados de hoy y se revertirá el XP de esos bloques.',
    );
    if (!ok) return;

    setResetting(true);
    setError(null);
    try {
      await usePlayerStore.getState().resetTodayDailyProgress();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo reiniciar la meta de hoy');
    } finally {
      setResetting(false);
    }
  };

  if (!player) return null;

  const blocks = Math.round(goalMinutes / PLAYER_CONFIG.blockMinutes);
  const bonusXp = getScaledDailyBonusXp(goalMinutes);

  return (
    <EpicModal
      open={open}
      onClose={onClose}
      title="Configuración del sistema"
      flavor="Meta diaria, horario, notificaciones y preferencias — reconfigura la odisea"
      size="xl"
    >
      <div className="space-y-3">
        <details className="group" open>
          <summary className="title-carved flex cursor-pointer list-none items-center gap-2 text-sm marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="inline-block transition-transform group-open:rotate-90">▸</span>
            ☀️ Meta diaria de estudio
          </summary>
          <div className="mt-3 pl-5">
          <p className="body-parchment mb-3 text-xs text-readable-dim">
            Bloques de {PLAYER_CONFIG.blockMinutes} min. Se actualizan desafíos diarios y semanales al guardar.
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {goalOptions.map((mins) => {
              const selected = goalMinutes === mins;
              const blk = mins / PLAYER_CONFIG.blockMinutes;
              return (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setGoalMinutes(mins)}
                  className={`btn-war px-2 py-2 text-center text-xs transition ${
                    selected ? 'border-gold-bright bg-bronze-dark/80 ring-1 ring-gold-bright' : 'opacity-80'
                  }`}
                >
                  <span className="stat-epic block text-sm text-highlight">{blk}</span>
                  <span className="block text-[10px] text-readable-dim">{formatGoalHoursMinutes(mins)}</span>
                </button>
              );
            })}
          </div>
          <p className="flavor-brutal mt-3 text-xs">
            Seleccionado: {formatGoalHoursMinutes(goalMinutes)} · {blocks} bloques · bonus meta +{bonusXp} XP
            {goalMinutes === DEFAULT_DAILY_GOAL_MINUTES && ' · valor por defecto'}
          </p>
          <div className="mt-4">
            <EpicButton
              variant="ghost"
              size="sm"
              onClick={() => void handleResetToday()}
              disabled={saving || resetting}
            >
              {resetting ? 'Reiniciando…' : '↺ Reiniciar meta de hoy a 0'}
            </EpicButton>
            <p className="body-parchment mt-2 text-[10px] text-readable-dim">
              Desmarca bloques completados hoy y revierte su XP.
            </p>
          </div>
          </div>
        </details>

        <details className="group border-t border-marble-crack/40 pt-3">
          <summary className="title-carved flex cursor-pointer list-none items-center gap-2 text-sm marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="inline-block transition-transform group-open:rotate-90">▸</span>
            ⏰ Horario de bloques
          </summary>
          <div className="mt-3 pl-5">
          <p className="body-parchment mb-3 text-xs text-readable-dim">
            Rango del reloj solar. Por defecto {DEFAULT_BLOCK_START}–{DEFAULT_BLOCK_END}.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-readable-dim">Inicio</span>
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="input-war"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-readable-dim">Fin</span>
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="input-war"
              />
            </label>
          </div>
          </div>
        </details>

        <details className="group border-t border-marble-crack/40 pt-3">
          <summary className="title-carved flex cursor-pointer list-none items-center gap-2 text-sm marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="inline-block transition-transform group-open:rotate-90">▸</span>
            🔔 Notificaciones push
          </summary>
          <div className="mt-3 pl-5">
          <p className="body-parchment mb-3 text-xs text-readable-dim">
            Llegan por <strong>Firebase</strong> aunque tengas la app cerrada (el mismo canal que
            WhatsApp). Además del briefing y el cierre, avisa al empezar y terminar cada bloque, por
            misiones vencidas y por examen a menos de 7 días.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-readable-dim">Briefing matutino</span>
              <input
                type="time"
                value={morning}
                onChange={(e) => setMorning(e.target.value || DEFAULT_MORNING_TIME)}
                className="input-war"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-readable-dim">Cierre nocturno</span>
              <input
                type="time"
                value={night}
                onChange={(e) => setNight(e.target.value || DEFAULT_NIGHT_TIME)}
                className="input-war"
              />
            </label>
          </div>
          <p className="body-parchment mt-2 text-[10px] text-readable-dim">
            Hora de Perú. Por defecto {DEFAULT_MORNING_TIME} y {DEFAULT_NIGHT_TIME}.
          </p>

          {!pushConfigured() && (
            <p className="flavor-brutal mt-3 text-xs text-danger">
              Faltan las variables de entorno de Firebase/Supabase en Netlify (ver DESPLIEGUE.md).
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <EpicButton
              variant="ghost"
              size="sm"
              onClick={() => {
                void enablePush().then((r) =>
                  setPushMsg(r.ok ? '✅ Push activado en este dispositivo' : `❌ ${r.error}`),
                );
              }}
            >
              Activar push
            </EpicButton>
            <EpicButton
              variant="ghost"
              size="sm"
              onClick={() => {
                void diagnose().then(setPushMsg).catch((e) => setPushMsg(`💥 ${String(e)}`));
              }}
            >
              Diagnóstico
            </EpicButton>
          </div>
          {pushMsg && (
            <p className="body-parchment mt-2 whitespace-pre-line text-xs text-highlight">{pushMsg}</p>
          )}
          </div>
        </details>

        <details className="group border-t border-marble-crack/40 pt-3">
          <summary className="title-carved flex cursor-pointer list-none items-center gap-2 text-sm marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="inline-block transition-transform group-open:rotate-90">▸</span>
            🎬 Animaciones y efectos
          </summary>
          <label className="mt-3 flex cursor-pointer items-center gap-3 pl-5">
            <input
              type="checkbox"
              checked={animations}
              onChange={(e) => setAnimations(e.target.checked)}
              className="h-4 w-4 accent-bronze"
            />
            <span className="body-parchment text-sm">Mostrar animaciones y efectos visuales</span>
          </label>
        </details>

        {error && <p className="flavor-brutal text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2 border-t border-marble-crack/40 pt-4">
          <EpicButton variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </EpicButton>
          <EpicButton size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar y reconfigurar'}
          </EpicButton>
        </div>
      </div>
    </EpicModal>
  );
}
