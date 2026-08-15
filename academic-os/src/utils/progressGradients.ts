/** Degradé rojo → amarillo → verde con aura según % */

export type ProgressVariant = 'xp' | 'study' | 'course' | 'streak' | 'urgency';

export function getProgressGradient(percent: number, _variant: ProgressVariant = 'xp'): string {
  const p = Math.max(0, Math.min(100, percent));

  if (p <= 15) {
    return 'linear-gradient(90deg, #4A0000 0%, #8B0000 40%, #B22222 100%)';
  }
  if (p <= 35) {
    return 'linear-gradient(90deg, #8B0000 0%, #DC143C 35%, #FF4500 70%, #FF6347 100%)';
  }
  if (p <= 55) {
    return 'linear-gradient(90deg, #DC143C 0%, #FF6347 25%, #FF8C00 55%, #FFA500 100%)';
  }
  if (p <= 75) {
    return 'linear-gradient(90deg, #FF6347 0%, #FFA500 30%, #FFD700 65%, #FFEC8B 100%)';
  }
  if (p < 100) {
    return 'linear-gradient(90deg, #FFD700 0%, #ADFF2F 40%, #32CD32 75%, #228B22 100%)';
  }
  return 'linear-gradient(90deg, #FFD700 0%, #32CD32 25%, #00FA9A 50%, #32CD32 75%, #FFD700 100%)';
}

export function getProgressGlow(percent: number): string {
  const p = Math.max(0, Math.min(100, percent));

  if (p >= 100) {
    return '0 0 8px #32CD32, 0 0 20px rgba(50,205,50,0.7), 0 0 40px rgba(0,250,154,0.35)';
  }
  if (p >= 75) {
    return '0 0 8px #ADFF2F, 0 0 18px rgba(173,255,47,0.55), 0 0 32px rgba(50,205,50,0.25)';
  }
  if (p >= 55) {
    return '0 0 8px #FFD700, 0 0 16px rgba(255,215,0,0.6), 0 0 28px rgba(255,165,0,0.3)';
  }
  if (p >= 35) {
    return '0 0 8px #FF6347, 0 0 14px rgba(255,99,71,0.55), 0 0 24px rgba(255,140,0,0.25)';
  }
  return '0 0 6px #DC143C, 0 0 12px rgba(220,20,60,0.5), 0 0 20px rgba(139,0,0,0.3)';
}

export function getProgressAura(percent: number): string {
  const p = Math.max(0, Math.min(100, percent));

  if (p >= 100) return '0 0 24px rgba(50,205,50,0.45), 0 0 48px rgba(0,250,154,0.2)';
  if (p >= 75) return '0 0 20px rgba(173,255,47,0.35), 0 0 36px rgba(255,215,0,0.15)';
  if (p >= 55) return '0 0 18px rgba(255,215,0,0.35)';
  if (p >= 35) return '0 0 16px rgba(255,99,71,0.35)';
  return '0 0 14px rgba(220,20,60,0.35)';
}

export function getProgressLabelColor(percent: number): string {
  if (percent >= 75) return '#ADFF2F';
  if (percent >= 55) return '#FFD700';
  if (percent >= 35) return '#FFA500';
  return '#FF6347';
}

export type PanelTheme = 'bronze' | 'blood' | 'golden' | 'inferno' | 'titan';

export interface PanelThemeDef {
  label: string;
  class: string;
  unlockLevel: number;
  description: string;
  effect: string;
}

export const PANEL_THEMES: Record<PanelTheme, PanelThemeDef> = {
  bronze: {
    label: 'Bronce de Guerra',
    class: 'panel-theme-bronze',
    unlockLevel: 1,
    description: 'Estilo clásico espartano — rebordes bronce y sombras profundas.',
    effect: 'Panel y avatar con marco bronce estándar.',
  },
  blood: {
    label: 'Sangre Seca',
    class: 'panel-theme-blood',
    unlockLevel: 5,
    description: 'Bordes carmesí, aura agresiva y stats con acento rojo.',
    effect: 'Todo el panel héroe adopta tonos de batalla sangrienta.',
  },
  golden: {
    label: 'Oro Divino',
    class: 'panel-theme-golden',
    unlockLevel: 10,
    description: 'Shimmer dorado permanente en progreso y marco del avatar.',
    effect: 'Brillo solar en barras XP y borde del contenedor.',
  },
  inferno: {
    label: 'Forja Ígnea',
    class: 'panel-theme-inferno',
    unlockLevel: 15,
    description: 'Gradientes naranja-fuego, pulsación en el marco del avatar.',
    effect: 'Panel con calor animado y stats resaltados en fuego.',
  },
  titan: {
    label: 'Titán del Olimpo',
    class: 'panel-theme-titan',
    unlockLevel: 20,
    description: 'Máximo impacto: doble borde, partículas y fondo épico rotativo.',
    effect: 'Transformación total del panel héroe y aura legendaria.',
  },
};

export const PANEL_THEME_ORDER: PanelTheme[] = ['bronze', 'blood', 'golden', 'inferno', 'titan'];

export function isPanelThemeUnlocked(theme: PanelTheme, playerLevel: number): boolean {
  return playerLevel >= PANEL_THEMES[theme].unlockLevel;
}

export function getEffectivePanelTheme(playerLevel: number, selected?: PanelTheme): PanelTheme {
  const theme = selected ?? 'bronze';
  return isPanelThemeUnlocked(theme, playerLevel) ? theme : 'bronze';
}

export const SKIN_OPTIONS = [
  { id: 'default', label: 'Clásico', unlock: 'Inicial' },
  { id: 'golden', label: 'Dorado ✨', unlock: 'Racha 7 días' },
  { id: 'legendary', label: 'Legendario 🗡️', unlock: 'Misión legendaria' },
];
