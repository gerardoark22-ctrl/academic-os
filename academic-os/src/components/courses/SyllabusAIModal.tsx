import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { EpicModal, EpicButton } from '../ui';
import {
  parseSyllabus,
  suggestWeeklyStudyPlan,
  isDeepSeekConfigured,
  type SyllabusDraft,
  type SyllabusUnitDraft,
  type SyllabusMissionDraft,
  type WeeklyPlanDay,
} from '../../utils/deepseekClient';
import { useTimeStore } from '../../stores/timeStore';
import { defaultWeekStart, weekLabel } from '../../utils/weeklyPlanApply';

export interface SyllabusImportPayload {
  draft: SyllabusDraft;
  missions: SyllabusMissionDraft[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  courseName: string;
  courseIcon: string;
  courseColor: string;
  onImport: (payload: SyllabusImportPayload) => Promise<string>;
}

type Step = 'paste' | 'loading' | 'review' | 'importing' | 'plan' | 'done';

function buildCourseSummary(draft: SyllabusDraft, name: string): string {
  const lines = [`Curso: ${name}`];
  for (const u of draft.units) {
    lines.push(`Unidad: ${u.name}${u.examDate ? ` (examen ${u.examDate})` : ''}`);
    for (const t of u.topics) {
      lines.push(`  Tema: ${t.name}`);
      for (const s of t.subtopics) lines.push(`    - ${s}`);
    }
  }
  return lines.join('\n');
}

export function SyllabusAIModal({ open, onClose, courseName, courseIcon, courseColor, onImport }: Props) {
  const [step, setStep] = useState<Step>('paste');
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<SyllabusDraft | null>(null);
  const [missions, setMissions] = useState<SyllabusMissionDraft[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlanDay[] | null>(null);
  const [importedCourseId, setImportedCourseId] = useState<string | null>(null);
  const [weekNext, setWeekNext] = useState(false);
  const [planResult, setPlanResult] = useState<{ applied: number; skipped: number } | null>(null);
  const [applyingPlan, setApplyingPlan] = useState(false);
  const applyWeeklyPlan = useTimeStore((s) => s.applyWeeklyPlan);
  const [error, setError] = useState('');

  const reset = () => {
    setStep('paste');
    setText('');
    setDraft(null);
    setMissions([]);
    setWeeklyPlan(null);
    setImportedCourseId(null);
    setPlanResult(null);
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const syncMissionsFromDraft = (d: SyllabusDraft) => {
    const next = d.units
      .map((u, idx) => (u.examDate ? {
        unitIndex: idx,
        title: `Examen: ${u.name}`,
        dueDate: u.examDate,
        enabled: true,
      } : null))
      .filter((m): m is SyllabusMissionDraft => m !== null);
    setMissions(next);
  };

  const handleParse = async () => {
    if (!text.trim()) return;
    if (!isDeepSeekConfigured()) {
      setError('Configura VITE_DEEPSEEK_API_KEY en .env.local');
      return;
    }
    setError('');
    setStep('loading');
    try {
      const result = await parseSyllabus(text);
      setDraft(result);
      setMissions(result.suggestedMissions ?? []);
      setStep('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar');
      setStep('paste');
    }
  };

  const updateUnit = (idx: number, patch: Partial<SyllabusUnitDraft>) => {
    if (!draft) return;
    const units = draft.units.map((u, i) => (i === idx ? { ...u, ...patch } : u));
    const next = { ...draft, units };
    setDraft(next);
    syncMissionsFromDraft(next);
  };

  const updateTopic = (uIdx: number, tIdx: number, name: string) => {
    if (!draft) return;
    const units = draft.units.map((u, i) =>
      i === uIdx ? { ...u, topics: u.topics.map((t, j) => (j === tIdx ? { ...t, name } : t)) } : u,
    );
    setDraft({ ...draft, units });
  };

  const updateSubtopic = (uIdx: number, tIdx: number, sIdx: number, name: string) => {
    if (!draft) return;
    const units = draft.units.map((u, i) =>
      i === uIdx
        ? {
            ...u,
            topics: u.topics.map((t, j) =>
              j === tIdx ? { ...t, subtopics: t.subtopics.map((s, k) => (k === sIdx ? name : s)) } : t,
            ),
          }
        : u,
    );
    setDraft({ ...draft, units });
  };

  const toggleMission = (idx: number) => {
    setMissions((prev) => prev.map((m, i) => (i === idx ? { ...m, enabled: !m.enabled } : m)));
  };

  const handleImport = async () => {
    if (!draft) return;
    setStep('importing');
    setError('');
    try {
      const name = courseName.trim() || draft.units[0]?.name || 'Curso IA';
      const courseId = await onImport({ draft, missions });
      setImportedCourseId(courseId);
      if (isDeepSeekConfigured()) {
        setStep('plan');
        const summary = buildCourseSummary(draft, name);
        const plan = await suggestWeeklyStudyPlan(summary);
        setWeeklyPlan(plan.length > 0 ? plan : null);
      } else {
        setStep('done');
        setTimeout(handleClose, 1400);
      }
    } catch {
      setError('No se pudo importar el temario');
      setStep('review');
    }
  };

  const handleApplyPlan = async () => {
    if (!weeklyPlan?.length) return;
    setApplyingPlan(true);
    setError('');
    try {
      const monday = defaultWeekStart(weekNext);
      const result = await applyWeeklyPlan(weeklyPlan, monday, importedCourseId ?? undefined);
      setPlanResult(result);
    } catch {
      setError('No se pudo aplicar el plan al horario');
    } finally {
      setApplyingPlan(false);
    }
  };

  const finish = () => {
    setStep('done');
    setTimeout(handleClose, 1200);
  };

  const missionCount = useMemo(() => missions.filter((m) => m.enabled).length, [missions]);

  return (
    <EpicModal
      open={open}
      onClose={handleClose}
      title="🧠 IA Syllabus"
      flavor={`${courseIcon} ${courseName || 'Nuevo curso'} · modo Kratos · tú apruebas todo`}
    >
      {step === 'paste' && (
        <div className="space-y-4">
          <p className="body-parchment text-sm">
            Pega el syllabus. La IA organiza unidades → temas → subtemas y sugiere misiones de examen (tú decides cuáles crear).
          </p>
          <textarea
            className="input-war min-h-[220px] w-full resize-y font-mono text-sm"
            placeholder="Unidad 1 — Anatomía (examen 15/07/2026)&#10;Tema: Sistema óseo..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {error && <p className="flavor-brutal text-sm">{error}</p>}
          <EpicButton className="w-full" disabled={!text.trim()} onClick={handleParse}>
            Procesar con IA
          </EpicButton>
        </div>
      )}

      {step === 'loading' && (
        <div className="flex flex-col items-center py-12">
          <motion.span animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="text-4xl">
            🧠
          </motion.span>
          <p className="title-carved mt-4 text-gold-bright">Forjando temario...</p>
        </div>
      )}

      {step === 'review' && draft && (
        <div className="space-y-4">
          <p className="label-clear text-sm">Revisa, edita y elige misiones de examen</p>
          <div className="max-h-[40vh] space-y-3 overflow-y-auto pr-1">
            {draft.units.map((unit, uIdx) => (
              <div key={uIdx} className="panel-epic p-3" style={{ borderLeft: `4px solid ${courseColor}` }}>
                <input
                  className="input-war mb-2 w-full !py-1 font-epic text-sm"
                  value={unit.name}
                  onChange={(e) => updateUnit(uIdx, { name: e.target.value })}
                />
                <label className="text-readable-dim mb-2 flex items-center gap-2 text-xs">
                  Fecha examen
                  <input
                    type="date"
                    className="input-war !py-0.5 text-xs"
                    value={unit.examDate ?? ''}
                    onChange={(e) => updateUnit(uIdx, { examDate: e.target.value || undefined })}
                  />
                </label>
                {unit.topics.map((topic, tIdx) => (
                  <div key={tIdx} className="ml-2 mt-2 border-l border-bronze-light/30 pl-3">
                    <input
                      className="input-war mb-1 w-full !py-1 text-sm"
                      value={topic.name}
                      onChange={(e) => updateTopic(uIdx, tIdx, e.target.value)}
                    />
                    {topic.subtopics.map((sub, sIdx) => (
                      <input
                        key={sIdx}
                        className="input-war mb-1 ml-2 w-[calc(100%-0.5rem)] !py-0.5 text-xs opacity-90"
                        value={sub}
                        onChange={(e) => updateSubtopic(uIdx, tIdx, sIdx, e.target.value)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {missions.length > 0 && (
            <div className="panel-epic p-3">
              <p className="label-clear mb-2 text-sm">Misiones sugeridas — tú decides</p>
              {missions.map((m, idx) => (
                <label key={idx} className="mb-2 flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={m.enabled}
                    onChange={() => toggleMission(idx)}
                    className="h-4 w-4 accent-gold-bright"
                  />
                  <span className={m.enabled ? 'text-highlight' : 'text-readable-dim line-through'}>
                    {m.title} — {m.dueDate}
                  </span>
                </label>
              ))}
            </div>
          )}

          {error && <p className="flavor-brutal text-sm">{error}</p>}
          <div className="flex gap-2">
            <EpicButton variant="ghost" className="flex-1" onClick={() => setStep('paste')}>← Volver</EpicButton>
            <EpicButton className="flex-1" onClick={handleImport}>
              Importar{missionCount > 0 ? ` + ${missionCount} misión${missionCount !== 1 ? 'es' : ''}` : ''}
            </EpicButton>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="flex flex-col items-center py-12">
          <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1, repeat: Infinity }} className="text-4xl">
            ⚔
          </motion.span>
          <p className="title-carved mt-4 text-gold-bright">Importando temario Kratos...</p>
        </div>
      )}

      {step === 'plan' && (
        <div className="space-y-4">
          <p className="label-clear text-base">Plan semanal — revisa y aplica borrador al horario</p>
          {weeklyPlan && weeklyPlan.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <EpicButton size="sm" variant={!weekNext ? 'gold' : 'ghost'} onClick={() => setWeekNext(false)}>
                  Esta semana
                </EpicButton>
                <EpicButton size="sm" variant={weekNext ? 'gold' : 'ghost'} onClick={() => setWeekNext(true)}>
                  Próxima semana
                </EpicButton>
                <span className="text-readable-dim text-sm">{weekLabel(defaultWeekStart(weekNext))}</span>
              </div>
              <div className="max-h-[40vh] space-y-2 overflow-y-auto">
                {weeklyPlan.map((day, i) => (
                  <div key={i} className="panel-epic p-3">
                    <p className="title-carved !text-base capitalize text-gold-bright">{day.day}</p>
                    {day.note && <p className="body-parchment mb-2 text-sm">{day.note}</p>}
                    <ul className="space-y-1.5">
                      {day.blocks.map((b, j) => (
                        <li key={j} className="text-readable text-base">
                          <span className="stat-epic text-sm">{b.startTime}</span> · {b.title} ({b.durationMin} min)
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {planResult && (
                <p className="flavor-brutal text-center text-sm">
                  ✓ {planResult.applied} bloques asignados{planResult.skipped > 0 ? ` · ${planResult.skipped} omitidos (ocupados)` : ''}
                </p>
              )}
              {error && <p className="flavor-brutal text-sm">{error}</p>}
              <div className="flex gap-2">
                <EpicButton className="flex-1" disabled={applyingPlan} onClick={handleApplyPlan}>
                  Aplicar borrador al horario
                </EpicButton>
                <EpicButton variant="ghost" className="flex-1" onClick={finish}>Continuar</EpicButton>
              </div>
            </>
          ) : (
            <>
              <p className="body-parchment text-center text-base">Sin plan generado</p>
              <EpicButton className="w-full" onClick={finish}>Continuar al curso</EpicButton>
            </>
          )}
        </div>
      )}

      {step === 'done' && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flavor-brutal py-8 text-center text-lg">
          ✓ Temario importado — modo Kratos activo
        </motion.p>
      )}
    </EpicModal>
  );
}
