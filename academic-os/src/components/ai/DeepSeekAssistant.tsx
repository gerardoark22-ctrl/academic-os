import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StoneCard, EpicButton, SectionTitle } from '../ui';
import { isDeepSeekConfigured } from '../../utils/deepseekClient';
import { useOracleChat } from '../../hooks/useOracleChat';
import { formatLocalClock, getOracleTimeSnapshot } from '../../utils/localTime';
import type { OracleCoursePriority } from '../../types';

function formatCooldown(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.ceil((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function DeepSeekAssistant() {
  const [expanded, setExpanded] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [input, setInput] = useState('');
  const [peruClock, setPeruClock] = useState(() => formatLocalClock());
  const chatEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    pendingPlan,
    planErrors,
    loading,
    error,
    verdadText,
    cooldownMs,
    profile,
    courses,
    startPlanning,
    sendMessage,
    applyPlan,
    clearPlan,
    runVerdad,
    saveProfile,
    resetChat,
  } = useOracleChat();

  useEffect(() => {
    if (expanded) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, verdadText, expanded]);

  useEffect(() => {
    if (!expanded) return;
    setPeruClock(formatLocalClock());
    const id = window.setInterval(() => setPeruClock(formatLocalClock()), 30_000);
    return () => window.clearInterval(id);
  }, [expanded]);

  const peruSnapshot = getOracleTimeSnapshot();

  if (!isDeepSeekConfigured()) {
    return (
      <StoneCard className="mt-4">
        <p className="body-parchment text-sm">
          DeepSeek no configurado. Añade <code className="text-highlight">VITE_DEEPSEEK_API_KEY</code> en .env.local
        </p>
      </StoneCard>
    );
  }

  const handleSend = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    void sendMessage(text);
  };

  const setCoursePriority = (courseId: string, priority: OracleCoursePriority) => {
    void saveProfile({
      coursePriorities: { ...profile.coursePriorities, [courseId]: priority },
    });
  };

  const setUnitFocus = (courseId: string, unitId: string) => {
    const next = { ...profile.unitFocus };
    if (unitId) next[courseId] = unitId;
    else delete next[courseId];
    void saveProfile({ unitFocus: next });
  };

  return (
    <StoneCard glow className="mt-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <SectionTitle
          title="Oráculo DeepSeek"
          flavor="Coach personal · hora Perú · auto-bloques"
          className="mb-0"
        />
        {expanded && (
          <span className="stat-epic shrink-0 text-xs text-readable-dim" title="America/Lima">
            🇵🇪 {peruClock}
          </span>
        )}
        <span className="stat-epic shrink-0 text-sm text-gold-bright">{expanded ? '▲' : '▼'}</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-4 border-t border-bronze-light/20 pt-4">
              <p className="body-parchment text-xs text-readable-dim">
                Sincronizado con {peruSnapshot.timezoneLabel} · {peruSnapshot.dateLong}
              </p>
              <div className="flex flex-wrap gap-2">
                <EpicButton size="sm" disabled={loading} onClick={() => void startPlanning()}>
                  {loading && messages.length === 0 ? '…' : '📅 Planificar hoy'}
                </EpicButton>
                <EpicButton
                  size="sm"
                  variant="ghost"
                  disabled={loading || cooldownMs > 0}
                  onClick={() => void runVerdad()}
                  title={cooldownMs > 0 ? `Disponible en ${formatCooldown(cooldownMs)}` : undefined}
                >
                  {cooldownMs > 0 ? `⏳ Verdad (${formatCooldown(cooldownMs)})` : '⚡ La Verdad Revelada'}
                </EpicButton>
                {(messages.length > 0 || verdadText) && (
                  <EpicButton size="sm" variant="ghost" disabled={loading} onClick={resetChat}>
                    Limpiar
                  </EpicButton>
                )}
              </div>

              <button
                type="button"
                className="body-parchment w-full text-left text-xs text-readable-dim underline-offset-2 hover:underline"
                onClick={() => setProfileOpen((v) => !v)}
              >
                {profileOpen ? '▾ Ocultar perfil del coach' : '▸ Mi perfil del coach (horario, prioridades, duración)'}
              </button>

              {profileOpen && (
                <div className="rounded border border-bronze-light/25 bg-ink/30 p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="body-parchment text-xs">
                      Desde
                      <input
                        type="time"
                        className="input-war mt-1 w-full"
                        value={profile.scheduleStart ?? '08:00'}
                        onChange={(e) => void saveProfile({ scheduleStart: e.target.value })}
                      />
                    </label>
                    <label className="body-parchment text-xs">
                      Hasta
                      <input
                        type="time"
                        className="input-war mt-1 w-full"
                        value={profile.scheduleEnd ?? '22:00'}
                        onChange={(e) => void saveProfile({ scheduleEnd: e.target.value })}
                      />
                    </label>
                  </div>
                  <label className="body-parchment text-xs block">
                    Duración de bloque
                    <select
                      className="select-war mt-1 w-full"
                      value={profile.blockMinutes ?? 30}
                      onChange={(e) =>
                        void saveProfile({ blockMinutes: Number(e.target.value) as 30 | 45 | 60 })
                      }
                    >
                      <option value={30}>30 min</option>
                      <option value={45}>45 min (~2 slots)</option>
                      <option value={60}>60 min (2 slots)</option>
                    </select>
                  </label>
                  {courses.length > 0 && (
                    <div className="space-y-3">
                      <p className="stat-epic text-xs text-highlight">Prioridad por curso y unidad</p>
                      {courses.map((c) => (
                        <div key={c.id} className="rounded border border-bronze-light/15 bg-ink/20 p-2 space-y-2">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="body-parchment truncate">{c.icon} {c.name}</span>
                            <select
                              className="select-war shrink-0 text-xs"
                              value={profile.coursePriorities?.[c.id] ?? 'exam_only'}
                              onChange={(e) =>
                                setCoursePriority(c.id, e.target.value as OracleCoursePriority)
                              }
                            >
                              <option value="always">Siempre priorizar</option>
                              <option value="exam_only">Solo si hay examen</option>
                            </select>
                          </div>
                          {c.units.length > 0 && (
                            <label className="body-parchment block text-[10px]">
                              Unidad preferida (opcional — el coach igual pregunta)
                              <select
                                className="select-war mt-1 w-full text-xs"
                                value={profile.unitFocus?.[c.id] ?? ''}
                                onChange={(e) => setUnitFocus(c.id, e.target.value)}
                              >
                                <option value="">Libre / preguntar en chat</option>
                                {c.units.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name}{u.examDate ? ` (examen ${u.examDate.slice(5)})` : ''}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(messages.length > 0 || verdadText) && (
                <div className="oracle-chat max-h-72 space-y-3 overflow-y-auto rounded border border-bronze-light/20 bg-ink/25 p-3">
                  {messages.map((m, i) => (
                    <div
                      key={`${m.role}-${i}`}
                      className={[
                        'rounded px-3 py-2 text-sm whitespace-pre-wrap',
                        m.role === 'user'
                          ? 'ml-6 bg-gold-bright/10 text-readable'
                          : 'mr-6 bg-bronze-light/10 body-parchment',
                      ].join(' ')}
                    >
                      {m.content}
                    </div>
                  ))}
                  {verdadText && (
                    <div className="mr-2 rounded border border-red-900/40 bg-red-950/30 px-3 py-3 text-sm whitespace-pre-wrap body-parchment">
                      <p className="stat-epic mb-2 text-xs text-red-300">La Verdad Revelada</p>
                      {verdadText}
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}

              {messages.length > 0 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input-war flex-1"
                    placeholder="Responde al coach o pide ajustes al plan…"
                    value={input}
                    disabled={loading}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  />
                  <EpicButton size="sm" disabled={loading || !input.trim()} onClick={handleSend}>
                    Enviar
                  </EpicButton>
                </div>
              )}

              {pendingPlan.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded border border-gold-bright/30 bg-gold-bright/5 p-3"
                >
                  <p className="stat-epic text-xs text-gold-bright">Borrador — {pendingPlan.length} bloque(s)</p>
                  <ul className="body-parchment mt-2 space-y-1 text-sm">
                    {pendingPlan.map((s) => (
                      <li key={`${s.startTime}-${s.topicId}`}>
                        • {s.startTime} — {s.title}
                      </li>
                    ))}
                  </ul>
                  {planErrors.length > 0 && (
                    <p className="flavor-brutal mt-2 text-xs">{planErrors.join(' · ')}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <EpicButton size="sm" disabled={loading} onClick={() => void applyPlan()}>
                      Aplicar al horario
                    </EpicButton>
                    <EpicButton size="sm" variant="ghost" onClick={clearPlan}>
                      Descartar
                    </EpicButton>
                  </div>
                </motion.div>
              )}

              {error && <p className="flavor-brutal text-sm">{error}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </StoneCard>
  );
}
