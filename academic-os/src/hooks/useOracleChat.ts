import { useCallback, useMemo, useState } from 'react';
import {
  isDeepSeekConfigured,
  oracleChat,
  revealTruth,
  type DeepSeekMessage,
} from '../utils/deepseekClient';
import {
  buildOracleStudyContext,
  buildVerdadContext,
  defaultOracleProfile,
  parseOracleBlockPlan,
  stripOraclePlanFromDisplay,
  validateOracleBlockPlan,
  verdadCooldownRemaining,
} from '../utils/oracleContext';
import { usePlayerStore } from '../stores/playerStore';
import { useCoursesStore } from '../stores/coursesStore';
import { useSortedActiveMissions } from './useActiveMissions';
import { useTimeStore } from '../stores/timeStore';
import { todayISO } from '../utils/gamification';
import type { OracleBlockPlanItem, OracleProfile } from '../types';

export function useOracleChat() {
  const player = usePlayerStore((s) => s.player);
  const updateOracleProfile = usePlayerStore((s) => s.updateOracleProfile);
  const markVerdadRevealed = usePlayerStore((s) => s.markVerdadRevealed);
  const courses = useCoursesStore((s) => s.courses);
  const missions = useSortedActiveMissions();
  const blocks = useTimeStore((s) => s.blocks);
  const loadBlocks = useTimeStore((s) => s.load);
  const applyOracleBlockPlan = useTimeStore((s) => s.applyOracleBlockPlan);

  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [pendingPlan, setPendingPlan] = useState<OracleBlockPlanItem[]>([]);
  const [planErrors, setPlanErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verdadText, setVerdadText] = useState<string | null>(null);

  const profile: OracleProfile = useMemo(
    () => ({ ...defaultOracleProfile(), ...player?.oracleProfile }),
    [player?.oracleProfile],
  );

  const today = todayISO();

  const cooldownMs = verdadCooldownRemaining(player?.lastVerdadAt);

  const getStudyContext = useCallback(
    () =>
      buildOracleStudyContext({
        player,
        courses,
        blocks,
        missions,
        profile,
        today,
        now: new Date(),
      }),
    [player, courses, blocks, missions, profile, today],
  );

  const toApiMessages = useCallback(
    (history: { role: 'user' | 'assistant'; content: string }[]): DeepSeekMessage[] => [
      { role: 'user', content: `CONTEXTO ACTUAL:\n${getStudyContext()}` },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ],
    [getStudyContext],
  );

  const handleAssistantReply = useCallback(
    (raw: string) => {
      const display = stripOraclePlanFromDisplay(raw);
      const plan = parseOracleBlockPlan(raw);
      if (plan) {
        const { valid, errors } = validateOracleBlockPlan(plan, courses, {
          planDate: today,
          now: new Date(),
        });
        setPendingPlan(valid);
        setPlanErrors(errors);
      }
      return display;
    },
    [courses, today],
  );

  const startPlanning = useCallback(async () => {
    if (!isDeepSeekConfigured()) return;
    setLoading(true);
    setError(null);
    setVerdadText(null);
    setPendingPlan([]);
    setPlanErrors([]);
    try {
      await loadBlocks(today);
      const seed = [{ role: 'user' as const, content: 'Inicia planificación de bloques para hoy.' }];
      setMessages(seed);
      const raw = await oracleChat(toApiMessages(seed));
      const display = handleAssistantReply(raw);
      setMessages([...seed, { role: 'assistant', content: display }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error del oráculo');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [handleAssistantReply, toApiMessages, loadBlocks, today]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!isDeepSeekConfigured() || !text.trim()) return;
      setLoading(true);
      setError(null);
      const next = [...messages, { role: 'user' as const, content: text.trim() }];
      setMessages(next);
      try {
        const raw = await oracleChat(toApiMessages(next));
        const display = handleAssistantReply(raw);
        setMessages([...next, { role: 'assistant', content: display }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error del oráculo');
      } finally {
        setLoading(false);
      }
    },
    [messages, handleAssistantReply, toApiMessages],
  );

  const applyPlan = useCallback(async () => {
    if (pendingPlan.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const blockMinutes = profile.blockMinutes ?? 30;
      const applyErrors = await applyOracleBlockPlan(pendingPlan, today, blockMinutes);
      if (applyErrors.length > 0) {
        setPlanErrors(applyErrors);
      } else {
        setPendingPlan([]);
        setPlanErrors([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron aplicar los bloques');
    } finally {
      setLoading(false);
    }
  }, [pendingPlan, today, profile.blockMinutes, applyOracleBlockPlan]);

  const clearPlan = useCallback(() => {
    setPendingPlan([]);
    setPlanErrors([]);
  }, []);

  const runVerdad = useCallback(async () => {
    if (!isDeepSeekConfigured() || cooldownMs > 0) return;
    setLoading(true);
    setError(null);
    try {
      const ctx = buildVerdadContext({
        player,
        courses,
        blocks,
        missions,
        today,
        now: new Date(),
      });
      const text = await revealTruth(ctx);
      setVerdadText(text);
      await markVerdadRevealed();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al revelar la verdad');
    } finally {
      setLoading(false);
    }
  }, [cooldownMs, player, courses, blocks, missions, today, markVerdadRevealed]);

  const saveProfile = useCallback(
    async (patch: Partial<OracleProfile>) => {
      await updateOracleProfile(patch);
    },
    [updateOracleProfile],
  );

  const resetChat = useCallback(() => {
    setMessages([]);
    setPendingPlan([]);
    setPlanErrors([]);
    setError(null);
    setVerdadText(null);
  }, []);

  return {
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
  };
}
