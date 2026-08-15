import { getGerardexStage } from './gamification';

export type LevelUpCelebration = {
  type: 'level-up';
  level: number;
  title: string;
  weapon: string;
  armor: string;
};

export type GeneralCelebration =
  | { type: 'perfect-day'; xpBonus: number; nightBonus: number }
  | { type: 'level-down'; level: number; title: string }
  | { type: 'achievement'; name: string; emoji: string };

export type ActiveCelebration = LevelUpCelebration | GeneralCelebration;

export function levelUpCelebrationFor(level: number): LevelUpCelebration {
  const stage = getGerardexStage(level);
  return {
    type: 'level-up',
    level,
    title: stage.title,
    weapon: stage.weapon,
    armor: stage.armor,
  };
}

export function levelUpsBetween(fromLevel: number, toLevel: number, lastCelebrated: number): LevelUpCelebration[] {
  if (toLevel <= fromLevel) return [];
  const start = Math.max(fromLevel + 1, lastCelebrated + 1);
  const items: LevelUpCelebration[] = [];
  for (let lvl = start; lvl <= toLevel; lvl++) {
    items.push(levelUpCelebrationFor(lvl));
  }
  return items;
}
