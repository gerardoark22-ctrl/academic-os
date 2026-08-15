/** Tiers épicos visuales: 5 → 10 → 15 → 20 */
export type EpicTier = 0 | 1 | 2 | 3 | 4;

export interface EpicEvolutionMilestone {
  id: string;
  unlockLevel: number;
  name: string;
  description: string;
  icon: string;
}

export const EPIC_EVOLUTION_MILESTONES: EpicEvolutionMilestone[] = [
  {
    id: 'warrior-aura',
    unlockLevel: 5,
    name: 'Aura de Guerrero',
    description: 'Borde pulsante en stats y avatar. El panel respira con brillo bronce.',
    icon: '⚔️',
  },
  {
    id: 'champion-particles',
    unlockLevel: 10,
    name: 'Partículas del Campeón',
    description: 'Partículas doradas en el bloque de Nivel y marco de Gerardex.',
    icon: '✨',
  },
  {
    id: 'demigod-bg',
    unlockLevel: 15,
    name: 'Fondo del Semidiós',
    description: 'Shimmer rotativo en el panel héroe y aura intensa en el avatar.',
    icon: '👑',
  },
  {
    id: 'titan-inferno',
    unlockLevel: 20,
    name: 'Titán del Olimpo',
    description: 'Fuego, palpitación máxima, partículas épicas y borde legendario.',
    icon: '🔥',
  },
];

export function getEpicTier(level: number): EpicTier {
  if (level >= 20) return 4;
  if (level >= 15) return 3;
  if (level >= 10) return 2;
  if (level >= 5) return 1;
  return 0;
}

export function epicTierName(tier: EpicTier): string {
  return ['Aprendiz', 'Guerrero', 'Campeón', 'Semidiós', 'Titán del Olimpo'][tier];
}

export function epicTierClass(prefix: string, tier: EpicTier): string {
  return `${prefix}-tier-${tier}`;
}

export function isEvolutionUnlocked(unlockLevel: number, playerLevel: number): boolean {
  return playerLevel >= unlockLevel;
}
