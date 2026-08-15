import type { Player, Course, Mission } from '../types';
import { underworldDays } from './gamification';
import { PLAYER_CONFIG } from './playerConfig';

export interface GerardexSkinDef {
  id: string;
  label: string;
  emoji: string;
  unlock: string;
  particle: 'none' | 'gold' | 'lightning' | 'blood' | 'ice' | 'shadow' | 'divine' | 'ember';
  perk: string;
  xpBonus?: number;
  mechanic?: 'combo' | 'night' | 'streak' | 'perfect';
  checkUnlock: (p: Player, extras?: UnlockExtras) => boolean;
}

export interface UnlockExtras {
  perfectDays: number;
  legendaryMissionsDone: number;
  coursesCompleted: number;
  blocksCompleted: number;
}

export function computeUnlockExtras(
  player: Player,
  courses: Course[],
  missions: Mission[],
): UnlockExtras {
  return {
    perfectDays: player.perfectDaysCount ?? 0,
    legendaryMissionsDone: missions.filter((m) => m.completed && m.priority === 'odisea').length,
    coursesCompleted: courses.filter((c) => c.progress >= 100).length,
    blocksCompleted: player.totalBlocksCompleted ?? 0,
  };
}

export const GERARDEX_SKINS: GerardexSkinDef[] = [
  { id: 'default', label: 'Clásico', emoji: '🐕', unlock: 'Inicial', particle: 'none', perk: 'Apariencia base', checkUnlock: () => true },
  { id: 'golden', label: 'Dorado', emoji: '✨', unlock: 'Racha 7 días', particle: 'gold', perk: '+5% XP por bloque', xpBonus: 0.05, checkUnlock: (p) => p.skins.includes('golden') || (p.studyStreak ?? 0) >= 7 },
  { id: 'legendary', label: 'Legendario', emoji: '🗡️', unlock: '1 misión legendaria', particle: 'lightning', perk: 'Combo x2 más XP', mechanic: 'combo', checkUnlock: (p, e) => p.skins.includes('legendary') || (e?.legendaryMissionsDone ?? 0) >= 1 },
  { id: 'spartan', label: 'Espartano', emoji: '🛡️', unlock: 'Nivel 15', particle: 'blood', perk: 'Aura roja + borde sangre', checkUnlock: (p) => p.skins.includes('spartan') || p.level >= 15 },
  { id: 'olympian', label: 'Olímpico', emoji: '⚡', unlock: '5.000 XP', particle: 'divine', perk: '+10% XP global', xpBonus: 0.1, checkUnlock: (p) => p.skins.includes('olympian') || p.xp >= 5000 },
  { id: 'hades', label: 'Inframundo', emoji: '💀', unlock: 'Volver del inframundo', particle: 'shadow', perk: 'Anula XP sucio: 1×/semana o al volver del inframundo', mechanic: 'streak', checkUnlock: (p) => p.skins.includes('hades') },
  { id: 'healer', label: 'Asclepio', emoji: '⚕️', unlock: '3 cursos al 100%', particle: 'divine', perk: 'Mensajes scholar permanentes', checkUnlock: (p, e) => p.skins.includes('healer') || (e?.coursesCompleted ?? 0) >= 3 },
  { id: 'scholar', label: 'Erudito', emoji: '📜', unlock: '10.000 XP', particle: 'gold', perk: '+8% XP en bloques estudio', xpBonus: 0.08, checkUnlock: (p) => p.skins.includes('scholar') || p.xp >= 10000 },
  { id: 'titan', label: 'Titán', emoji: '🏛️', unlock: 'Nivel 50', particle: 'ember', perk: 'Avatar +20% escala visual', checkUnlock: (p) => p.skins.includes('titan') || p.level >= 50 },
  { id: 'perfect', label: 'Día Perfecto', emoji: '🏆', unlock: '7 días perfectos', particle: 'gold', perk: '+25 XP bonus nocturno extra', mechanic: 'perfect', checkUnlock: (p, e) => p.skins.includes('perfect') || (e?.perfectDays ?? 0) >= 7 },
  { id: 'storm', label: 'Tormenta', emoji: '🌩️', unlock: '50 bloques completados', particle: 'lightning', perk: 'Partículas rayo intensas', mechanic: 'combo', checkUnlock: (p, e) => p.skins.includes('storm') || (e?.blocksCompleted ?? 0) >= 50 },
  { id: 'mythic', label: 'Mítico', emoji: '👑', unlock: 'Nivel 100', particle: 'divine', perk: '+15% XP + aura divina', xpBonus: 0.15, checkUnlock: (p) => p.skins.includes('mythic') || p.level >= 100 },
];

export const INTERFACE_SKINS = [
  { id: 'default', label: 'Campo de Ruinas', unlock: 'Inicial', themeClass: 'iface-default', minLevel: 0 },
  { id: 'apollo', label: 'Templo de Apolo', unlock: 'Nivel 25', themeClass: 'iface-apollo', minLevel: 25 },
  { id: 'poseidon', label: 'Palacio de Poseidón', unlock: 'Nivel 50', themeClass: 'iface-poseidon', minLevel: 50 },
  { id: 'hephaestus', label: 'Forja de Hefesto', unlock: 'Nivel 75', themeClass: 'iface-hephaestus', minLevel: 75 },
] as const;

export const COURSE_COLOR_PALETTE = [
  '#DC143C', '#FF4500', '#FF8C00', '#FFD700', '#32CD32', '#00897B',
  '#1E90FF', '#4169E1', '#9370DB', '#FF69B4', '#20B2AA', '#CD853F',
  '#8B4513', '#696969', '#E64A19', '#C2185B',
];

export const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: 'Medicina', emojis: ['🩺', '💊', '🫀', '🧠', '🦴', '🔬', '⚕️', '🏥'] },
  { label: 'Guerra', emojis: ['⚔️', '🛡️', '🗡️', '🏹', '⚡', '🔥', '💀', '👑'] },
  { label: 'Griego', emojis: ['🏛️', '🏺', '📜', '🦉', '🫒', '⚱️', '🎭', '🌿'] },
  { label: 'Estudio', emojis: ['📚', '📖', '✏️', '📝', '🎯', '💡', '🧪', '🔭'] },
];

export function getTitleTone(title: string): 'epic' | 'scholar' | 'warrior' | 'default' {
  const t = title.toLowerCase();
  if (t.includes('conquistador') || t.includes('domador') || t.includes('guardián')) return 'warrior';
  if (t.includes('asclepio') || t.includes('erudito') || t.includes('sabio')) return 'scholar';
  if (t.includes('leyenda') || t.includes('titán') || t.includes('épico')) return 'epic';
  return 'default';
}

export function getGerardexMessageByTitle(title: string, fallback: string): string {
  const tone = getTitleTone(title);
  const msgs: Record<string, string[]> = {
    warrior: ['🐕 Gerardex: "such battle, very conquer, wow"', '🐕 "hooman fights like Kratos today"'],
    scholar: ['🐕 Gerardex: "big brain energy detected"', '🐕 "Gerardex approves the wisdom path"'],
    epic: ['🐕 Gerardex: "*stands on hind legs with tiny crown*"', '🐕 "LEGENDARY hooman behavior"'],
    default: [fallback],
  };
  const pool = msgs[tone];
  return pool[Math.floor(Date.now() / 86400000) % pool.length];
}

export interface RpgStats {
  sabiduria: number;
  resistencia: number;
  disciplina: number;
  velocidad: number;
}

export function computeRpgStats(p: Player, extras: UnlockExtras): RpgStats {
  const xpCap = 50000;
  const sabiduria = Math.min(100, Math.round((p.xp / xpCap) * 100));
  const resistencia = Math.min(100, Math.round(((p.studyStreak ?? 0) / 30) * 100));
  const disciplina = Math.min(100, Math.round((extras.perfectDays / 30) * 100));
  const blocksToday = Math.round((p.todayStudyMinutes ?? 0) / 30);
  const velocidad = Math.min(100, Math.round((blocksToday / 12) * 100));
  return { sabiduria, resistencia, disciplina, velocidad };
}

export function getPanelStateClass(
  streak: number,
  todayMinutes: number,
  minMinutes: number,
  lastStudyDate: string | null,
  dailyBonusLost: boolean,
): 'panel-state-radiant' | 'panel-state-normal' | 'panel-state-dirty' | 'panel-state-hell' {
  const uw = underworldDays(lastStudyDate);
  if (uw > 0) return 'panel-state-hell';
  if (dailyBonusLost && todayMinutes < minMinutes) return 'panel-state-dirty';
  if (streak >= 7 && todayMinutes >= minMinutes) return 'panel-state-radiant';
  return 'panel-state-normal';
}

export type ChestReward =
  | { type: 'xp'; amount: number }
  | { type: 'skin'; skinId: string }
  | { type: 'title'; title: string };

export function rollChestReward(p: Player): ChestReward {
  const roll = Math.random();
  const lockedSkins = GERARDEX_SKINS.filter((s) => s.id !== 'default' && !p.skins.includes(s.id));
  if (roll < 0.15 && lockedSkins.length > 0) {
    const skin = lockedSkins[Math.floor(Math.random() * lockedSkins.length)];
    return { type: 'skin', skinId: skin.id };
  }
  if (roll < 0.25) return { type: 'xp', amount: [50, 100, 150, 250][Math.floor(Math.random() * 4)] };
  return { type: 'xp', amount: [25, 50, 75][Math.floor(Math.random() * 3)] };
}

export function getActiveSkinDef(player: Player): GerardexSkinDef {
  return GERARDEX_SKINS.find((s) => s.id === player.currentSkin) ?? GERARDEX_SKINS[0];
}

export function getSkinXpMultiplier(player: Player): number {
  const skin = getActiveSkinDef(player);
  return 1 + (skin.xpBonus ?? 0);
}

export const PANEL_THEME_PERKS: Record<string, string> = {
  bronze: 'Estilo clásico — bronce de guerra',
  blood: 'Barras rojas + aura agresiva en stats',
  golden: 'Shimmer dorado permanente en progreso',
  inferno: 'Fuego ígneo — panel y avatar pulsantes',
  titan: 'Titán — doble borde, partículas y fondo épico',
};

export const IFACE_PERKS: Record<string, string> = {
  default: 'Ruinas oscuras espartanas',
  apollo: 'Cielo dorado — acentos solares en toda la app',
  poseidon: 'Azul profundo — navegación oceánica',
  hephaestus: 'Forja ígnea — rojos y naranjas intensos',
};

export function getLastChestTimestamp(p: Player): number | null {
  if (p.lastChestAt) {
    const t = new Date(p.lastChestAt).getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (p.lastChestDate) {
    const t = new Date(`${p.lastChestDate}T12:00:00`).getTime();
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

export function msSinceLastChest(p: Player): number | null {
  const last = getLastChestTimestamp(p);
  if (last === null) return null;
  return Date.now() - last;
}

/** Máximo un cofre cada 8 horas */
export function canAwardChest(p: Player): boolean {
  const elapsed = msSinceLastChest(p);
  if (elapsed === null) return true;
  return elapsed >= PLAYER_CONFIG.chestCooldownMs;
}

export function shouldShowDailyChest(p: Player): boolean {
  if (!canAwardChest(p)) return false;
  if ((p.studyStreak ?? 0) >= 3) return true;
  return Math.random() < 0.35;
}
