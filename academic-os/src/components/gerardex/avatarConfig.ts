/** Ruta pública del avatar de Gerardex */
export const GERARDEX_AVATAR_SRC = '/icons/gerardex-avatar.png';

export type AvatarVisualState = 'radiant' | 'strong' | 'normal' | 'tired' | 'dirty';

/** Evolución por nivel + estado diario */
export const STAGE_FILTERS: Record<number, string> = {
  1: 'brightness(1.05) saturate(1.05)',
  2: 'sepia(0.2) contrast(1.05) saturate(0.95)',
  3: 'sepia(0.35) contrast(1.1) saturate(0.9) brightness(0.95)',
  4: 'sepia(0.45) contrast(1.15) saturate(0.85) brightness(0.9) drop-shadow(0 0 4px rgba(92,16,16,0.3))',
  5: 'sepia(0.5) contrast(1.2) saturate(0.8) brightness(0.85) drop-shadow(0 0 8px rgba(92,16,16,0.45))',
};

export const STATE_FILTERS: Record<AvatarVisualState, string> = {
  radiant: 'brightness(1.15) saturate(1.2) drop-shadow(0 0 12px rgba(255,215,0,0.5))',
  strong: 'brightness(1.08) saturate(1.1) drop-shadow(0 0 8px rgba(255,180,0,0.35))',
  normal: 'none',
  tired: 'brightness(0.85) saturate(0.7) sepia(0.15)',
  dirty: 'brightness(0.7) saturate(0.5) sepia(0.4) contrast(0.9) grayscale(0.25)',
};

export function combineFilters(stage: number, state: AvatarVisualState, goldenSkin?: boolean): string {
  const base = STAGE_FILTERS[stage] ?? 'none';
  const stateF = STATE_FILTERS[state];
  const golden = goldenSkin ? ' hue-rotate(-10deg) saturate(1.3) brightness(1.1)' : '';
  if (stateF === 'none') return `${base}${golden}`.trim();
  return `${base} ${stateF}${golden}`.trim();
}

export const STAGE_BORDER_COLORS = ['#B8AA96', '#8B7344', '#8B5A2B', '#7A2828', '#5C1010'];

export const STATE_BORDER: Record<AvatarVisualState, string> = {
  radiant: '#FFD700',
  strong: '#CD853F',
  normal: '#8B7344',
  tired: '#6B5A4A',
  dirty: '#4A4035',
};

export const STAGE_GLOW: Record<number, string | undefined> = {
  3: '0 0 12px rgba(139, 90, 43, 0.25)',
  4: '0 0 16px rgba(122, 40, 40, 0.35)',
  5: '0 0 20px rgba(92, 16, 16, 0.45)',
};

export const STATE_GLOW: Record<AvatarVisualState, string | undefined> = {
  radiant: '0 0 40px rgba(255, 215, 0, 0.7), 0 0 80px rgba(255, 140, 0, 0.35)',
  strong: '0 0 30px rgba(255, 200, 0, 0.45)',
  normal: undefined,
  tired: undefined,
  dirty: '0 0 8px rgba(60, 50, 40, 0.5)',
};

export const STAGE_OVERLAY: Record<number, string | undefined> = {
  4: 'linear-gradient(135deg, transparent 60%, rgba(92,16,16,0.08) 100%)',
  5: 'linear-gradient(180deg, rgba(92,16,16,0.06) 0%, transparent 40%, rgba(42,35,24,0.1) 100%)',
};

export const STATE_OVERLAY: Record<AvatarVisualState, string | undefined> = {
  radiant: 'linear-gradient(180deg, rgba(255,215,0,0.12) 0%, transparent 50%)',
  strong: 'linear-gradient(180deg, rgba(255,180,0,0.08) 0%, transparent 40%)',
  normal: undefined,
  tired: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 60%)',
  dirty: 'linear-gradient(180deg, rgba(80,60,40,0.35) 0%, rgba(40,30,20,0.2) 100%)',
};
