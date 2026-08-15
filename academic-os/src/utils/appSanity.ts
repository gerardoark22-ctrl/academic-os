import type { Player } from '../types';
import { calculateLevel, todayISO } from './gamification';
import { INTERFACE_SKINS } from './cosmetics';
import { getEffectivePanelTheme, isPanelThemeUnlocked, type PanelTheme } from './progressGradients';

export interface SanityReport {
  fixed: string[];
  warnings: string[];
}

/** Repara inconsistencias locales tras cargar IndexedDB */
export function sanitizePlayer(player: Player): { player: Player; report: SanityReport } {
  const fixed: string[] = [];
  const warnings: string[] = [];
  let p = { ...player };

  const computedLevel = calculateLevel(p.xp);
  if (p.level !== computedLevel) {
    // Si la curva bajó (más fácil), alinear celebración para no spam de overlays
    if (computedLevel > p.level) {
      p.lastLevelCelebrated = Math.max(p.lastLevelCelebrated ?? 0, computedLevel);
    }
    p.level = computedLevel;
    fixed.push(`Nivel alineado a XP (${computedLevel})`);
  } else if ((p.lastLevelCelebrated ?? 0) < computedLevel) {
    // Curva más fácil con mismo XP: evita celebrar niveles ya “ganados” al ganar XP
    p.lastLevelCelebrated = computedLevel;
    fixed.push(`Celebración de nivel sincronizada (${computedLevel})`);
  }

  if ((p.todayStudyMinutes ?? 0) < 0) {
    p.todayStudyMinutes = 0;
    fixed.push('Minutos de hoy corregidos');
  }

  const theme = (p.panelTheme ?? 'bronze') as PanelTheme;
  if (!isPanelThemeUnlocked(theme, p.level)) {
    p.panelTheme = getEffectivePanelTheme(p.level, theme);
    fixed.push(`Tema de panel → ${p.panelTheme}`);
  }

  const iface = p.currentInterfaceSkin ?? 'default';
  const ifaceDef = INTERFACE_SKINS.find((s) => s.id === iface);
  if (ifaceDef && p.level < ifaceDef.minLevel) {
    p.currentInterfaceSkin = 'default';
    fixed.push('Skin de interfaz bloqueada → default');
  }

  if (p.goalMetDate && p.goalMetDate > todayISO()) {
    p.goalMetDate = undefined;
    fixed.push('goalMetDate futuro eliminado');
  }

  if (
    p.hadesEmailSlotsPendingFrom
    && p.hadesEmailSlotsPendingFrom <= todayISO()
    && p.hadesEmailSlotsPending
  ) {
    warnings.push('Config de correos pendiente — se aplicará al iniciar sesión');
  }

  if ((p.studyStreak ?? 0) < 0) {
    p.studyStreak = 0;
    fixed.push('Racha negativa corregida');
  }

  if (!p.id) {
    p.id = 'gerardex';
    fixed.push('ID de jugador restaurado');
  }

  if (fixed.length === 0 && p.xp === 0 && p.level > 1) {
    warnings.push('XP en cero con nivel > 1 — revisar backup');
  }

  return { player: p, report: { fixed, warnings } };
}
