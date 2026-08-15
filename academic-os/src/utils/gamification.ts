import { DomainLevel, type GerardexStage, type EpicTitle, type MissionPriority } from '../types';
import { todayLocalISO, daysBetweenLocalISO } from './localTime';
import { daysUntilDue, formatMissionDueShort } from './missionDue';
import { PLAYER_CONFIG } from './playerConfig';
import { migratePriority } from './priorityMigrate';

export const XP_REWARDS = {
  topic: 50,
  unit: 200,
  course: 500,
  mission: 100,
  timeBlock: PLAYER_CONFIG.xpPerBlock,
  dailyStreak: 150,
} as const;

export const gerardexEvolution: Record<number, GerardexStage> = {
  1: { stage: 1, levelRange: '1-10', title: 'Aprendiz', weapon: 'Espada de Madera', armor: 'Túnica Simple' },
  2: { stage: 2, levelRange: '11-25', title: 'Guerrero', weapon: 'Espada de Bronce', armor: 'Coraza de Cuero' },
  3: { stage: 3, levelRange: '26-50', title: 'Héroe', weapon: 'Espada de Hierro', armor: 'Armadura Completa + Escudo' },
  4: { stage: 4, levelRange: '51-75', title: 'Campeón', weapon: 'Espada Legendaria', armor: 'Armadura Reforzada + Capa Roja' },
  5: { stage: 5, levelRange: '76-100', title: 'Leyenda', weapon: 'Espada Divina', armor: 'Armadura Dorada + Corona de Laurel' },
};

export const epicTitles: EpicTitle[] = [
  { id: 1, name: 'El Conquistador de Anatomía', requirement: 'Completa Anatomía al 100%', unlocked: false },
  { id: 2, name: 'Domador del ENARM', requirement: 'Estudia 30 días seguidos', unlocked: false },
  { id: 3, name: 'Hijo de Asclepio', requirement: 'Completa 3 cursos médicos', unlocked: false },
  { id: 4, name: 'Guardián del Tiempo', requirement: 'Cumple 50 bloques de estudio', unlocked: false },
];

export function daysBetween(from: string, to: string): number {
  return Math.max(0, daysBetweenLocalISO(from, to));
}

export function calculateLevel(xp: number): number {
  let level = 1;
  while (xp >= xpThresholdForLevel(level + 1)) level++;
  return level;
}

/**
 * Facilidad de subida de nivel vs curva base (750).
 * 1 = base brutal · 0.75 = 25% más fácil · 0.60 = 40% más fácil · 0.48 = 52% más fácil (20% más que 0.6).
 * Nivel 2 ≈ 360 XP con el factor actual.
 */
export const LEVEL_XP_EASE_FACTOR = 0.48;
const LEVEL_XP_CURVE_BASE = 750 * LEVEL_XP_EASE_FACTOR;

export function xpThresholdForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(Math.pow(level - 1, 2.65) * LEVEL_XP_CURVE_BASE);
}

export function xpForNextLevel(currentLevel: number): number {
  return xpThresholdForLevel(currentLevel + 1);
}

export function xpProgressInLevel(xp: number): { current: number; needed: number; percent: number; remaining: number; nextLevel: number } {
  const level = calculateLevel(xp);
  const currentLevelXp = xpThresholdForLevel(level);
  const nextLevelXp = xpThresholdForLevel(level + 1);
  const current = xp - currentLevelXp;
  const needed = nextLevelXp - currentLevelXp;
  const remaining = Math.max(0, nextLevelXp - xp);
  return {
    current,
    needed,
    remaining,
    nextLevel: level + 1,
    percent: needed > 0 ? Math.round((current / needed) * 100) : 100,
  };
}

export function getGerardexStage(level: number): GerardexStage {
  if (level >= 76) return gerardexEvolution[5];
  if (level >= 51) return gerardexEvolution[4];
  if (level >= 26) return gerardexEvolution[3];
  if (level >= 11) return gerardexEvolution[2];
  return gerardexEvolution[1];
}

export function getDomainFromStudyTime(minutes: number, manualLevel?: DomainLevel): DomainLevel {
  if (manualLevel !== undefined && manualLevel > getDomainFromMinutes(minutes)) {
    return manualLevel;
  }
  return getDomainFromMinutes(minutes);
}

function getDomainFromMinutes(minutes: number): DomainLevel {
  if (minutes >= 180) return DomainLevel.TITAN;
  if (minutes >= 120) return DomainLevel.GOD;
  if (minutes >= 90) return DomainLevel.DEMIGOD;
  if (minutes >= 30) return DomainLevel.HERO;
  return DomainLevel.MORTAL;
}

export function getDomainLabel(level: DomainLevel): string {
  switch (level) {
    case DomainLevel.TITAN: return '🔥 TITÁN';
    case DomainLevel.GOD: return '👑 DIOS';
    case DomainLevel.DEMIGOD: return '⚡ SEMIDIÓS';
    case DomainLevel.HERO: return '⚔️ HÉROE';
    default: return '💀 MORTAL';
  }
}

export function getDomainPercent(level: DomainLevel): number {
  return level;
}

export function calculateCourseProgress(units: { progress: number }[]): number {
  if (units.length === 0) return 0;
  return Math.round(units.reduce((sum, u) => sum + u.progress, 0) / units.length);
}

/** Cuenta ítems checkeables: subtemas si existen, si no el tema entero */
export function countUnitCheckItems(
  topics: { completed?: boolean; subtopics?: { completed: boolean }[] }[],
): { total: number; completed: number } {
  let total = 0;
  let completed = 0;
  for (const t of topics) {
    const subs = t.subtopics ?? [];
    if (subs.length > 0) {
      total += subs.length;
      completed += subs.filter((st) => st.completed).length;
    } else {
      total += 1;
      completed += t.completed ? 1 : 0;
    }
  }
  return { total, completed };
}

/** Progreso de unidad = % de checks completados sobre total de temas/subtemas */
export function calculateUnitProgress(
  topics: { completed?: boolean; subtopics?: { completed: boolean }[] }[],
): number {
  const { total, completed } = countUnitCheckItems(topics);
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

export function getTempleLevel(progress: number): number {
  if (progress >= 100) return 4;
  if (progress >= 75) return 3;
  if (progress >= 50) return 2;
  if (progress >= 25) return 1;
  return 0;
}

export function getTempleLayerLabel(level: number): string {
  const labels = ['Escombros', 'Columnas rotas', 'Templo saqueado', 'Ruina reconquistada'];
  return labels[level] ?? 'Polvo y ceniza';
}

/** Barra de Ira de los Dioses — riesgo de reprobar */
export function godAnger(daysLeft: number, completedTopics: number, totalTopics: number): number {
  if (totalTopics === 0) return 0;
  const risk = 100 - (daysLeft * completedTopics) / totalTopics;
  return Math.max(0, Math.min(100, Math.round(risk)));
}

export function getGodAngerMessage(anger: number): string {
  if (anger <= 30) return 'Los dioses duermen… por ahora';
  if (anger <= 60) return 'Zeus te observa desde las ruinas';
  if (anger <= 70) return 'Truenos sobre mármol roto — prepárate';
  return '¡ZEUS EXIGE SANGRE EN EL CAMPO DE ESTUDIO!';
}

export function getGodAngerColor(anger: number): string {
  if (anger <= 30) return '#5A6B4A';
  if (anger <= 60) return '#8B5A2B';
  return '#5C1010';
}

/** Días en el Inframundo sin estudiar */
export function underworldDays(lastStudyDate: string | null): number {
  if (!lastStudyDate) return 0;
  return Math.max(0, daysBetweenLocalISO(lastStudyDate, todayLocalISO()));
}

export function getMissionXpReward(
  priority: MissionPriority | string,
  complexity: 'light' | 'medium' | 'heavy' = 'medium',
): number {
  const p = migratePriority(priority);
  const base = { odisea: 500, epica: 200, chiste: 100 }[p];
  const mult = { light: 0.75, medium: 1, heavy: 1.5 }[complexity];
  return Math.round(base * mult);
}

export const MISSION_PRIORITY_LABEL: Record<MissionPriority, string> = {
  odisea: 'Odisea',
  epica: 'Épica',
  chiste: 'Chiste',
};

export const MISSION_COMPLEXITY_LABEL: Record<'light' | 'medium' | 'heavy', string> = {
  light: 'Ligera',
  medium: 'Media',
  heavy: 'Pesada',
};

export function daysUntil(dateStr: string): number {
  return daysUntilDue(dateStr);
}

export function formatDate(dateStr: string): string {
  return formatMissionDueShort(dateStr);
}

export function todayISO(): string {
  return todayLocalISO();
}

/** Minutos de estudio válidos solo si lastActiveDate es hoy (Perú). */
export function getEffectiveTodayStudyMinutes(player?: {
  lastActiveDate?: string;
  todayStudyMinutes?: number;
} | null): number {
  if (!player || player.lastActiveDate !== todayISO()) return 0;
  return player.todayStudyMinutes ?? 0;
}

/** Racha efectiva: incluye meta cumplida hoy antes del rollover */
export function getEffectiveStreak(studyStreak: number, goalMetDate: string | null | undefined): number {
  const streak = studyStreak ?? 0;
  return goalMetDate === todayISO() ? streak + 1 : streak;
}

export function generateId(): string {
  return crypto.randomUUID();
}
