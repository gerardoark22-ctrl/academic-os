import type { Course, Mission, Topic } from '../types';
import { daysUntilDue } from './missionDue';
import { collectActionableTopics } from './missionFeasibility';

export interface CreativeQuestCopy {
  title: string;
  description: string;
  icon: string;
}

function pick<T>(arr: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return arr[Math.abs(h) % arr.length];
}

function courseLabel(name: string): string {
  const short = name.trim().slice(0, 28);
  return short || 'tu curso';
}

function missionIcon(m: Mission): string {
  if (m.priority === 'odisea') return '🗡️';
  if (m.type === 'exam') return '📝';
  if (m.type === 'reading') return '📖';
  return '📜';
}

/** Meta diaria — objetivo binario (target 1 en sync) */
export function creativeDailyGoalQuest(goalMinutes: number): CreativeQuestCopy {
  const seed = `daily-goal-${goalMinutes}`;
  return pick(
    [
      {
        title: 'Luz del crisol',
        description: `Alcanza tu meta diaria (${goalMinutes} min).`,
        icon: '☀️',
      },
      {
        title: 'Juramento del guerrero',
        description: `Hoy el reloj exige ${goalMinutes} minutos de honor.`,
        icon: '🔥',
      },
      {
        title: 'Ofrenda al sol',
        description: `Tu meta diaria (${goalMinutes} min) abre las puertas del Ágora.`,
        icon: '🏛️',
      },
    ],
    seed,
  );
}

/** Encargo del tablero — nunca copia el título de la tarea */
export function creativeBoardMissionQuest(m: Mission, scope: 'daily' | 'weekly'): CreativeQuestCopy {
  const course = courseLabel(m.courseName);
  const days = daysUntilDue(m.dueDate);
  const seed = `${scope}-${m.id}-${m.priority}-${m.type}`;

  if (m.type === 'exam') {
    return pick(
      [
        {
          title: 'El juicio del Olimpo',
          description: `Enfrenta el examen pendiente en ${course} — el oráculo no admite excusas.`,
          icon: '📝',
        },
        {
          title: 'Prueba de fuego',
          description: `Una batalla escrita aguarda en ${course}. Ciérrala esta ${scope === 'daily' ? 'jornada' : 'semana'}.`,
          icon: '⚡',
        },
        {
          title: 'Campana de Atenea',
          description: `Tu evaluación en ${course} pide un cierre épico.`,
          icon: '🏛️',
        },
      ],
      seed,
    );
  }

  if (m.priority === 'odisea') {
    return pick(
      [
        {
          title: 'Contrato de la Mesa Redonda',
          description: `Un encargo legendario en ${course} exige tu firma de victoria.`,
          icon: '🗡️',
        },
        {
          title: 'Misión de sangre y tinta',
          description: `El tablero te señala el desafío más grave de ${course}.`,
          icon: '🩸',
        },
      ],
      seed,
    );
  }

  if (days <= 0) {
    return pick(
      [
        {
          title: 'Última luz del día',
          description: `Algo en ${course} vence hoy — Gerardex te observa con ojos de juez.`,
          icon: '⚠️',
        },
        {
          title: 'El muro antes del ocaso',
          description: `Cierra hoy un pendiente urgente de ${course}.`,
          icon: '🌅',
        },
      ],
      seed,
    );
  }

  if (days <= 3) {
    return pick(
      [
        {
          title: 'Mensajero del Ágora',
          description: `Un encargo de ${course} golpea la puerta — quedan pocos días.`,
          icon: '📯',
        },
        {
          title: 'La lanza del amanecer',
          description: `Antes de que venza, conquista una misión abierta en ${course}.`,
          icon: '☀️',
        },
      ],
      seed,
    );
  }

  return pick(
    [
      {
        title: 'Sello del estratega',
        description: `Marca como hecha una misión del tablero en ${course}.`,
        icon: missionIcon(m),
      },
      {
        title: 'Deuda con el tablero',
        description: `Honra un compromiso pendiente en ${course} — sin prisa, pero sin olvido.`,
        icon: '📜',
      },
      {
        title: 'Cazar la tarea fantasma',
        description: `Un espíritu pendiente ronda ${course}. Exorcízalo completándolo.`,
        icon: '👻',
      },
      {
        title: scope === 'weekly' ? 'Campaña del tablero' : 'Patrulla del tablero',
        description: `Avanza una misión activa de ${course} antes de que crezca el caos.`,
        icon: '🛡️',
      },
    ],
    seed,
  );
}

/** Tema de curso — nunca copia el nombre del tema */
export function creativeTopicQuest(course: Course, topic: Topic): CreativeQuestCopy {
  const label = courseLabel(course.name);
  const seed = `${course.id}-${topic.id}-${topic.domainLevel}`;

  const heavy = (topic.domainLevel ?? 0) >= 50;
  const medium = (topic.domainLevel ?? 0) >= 25;

  if (heavy) {
    return pick(
      [
        {
          title: 'Fortaleza del saber',
          description: `Un bastión difícil en ${label} aún resiste — domínalo hoy.`,
          icon: course.icon || '🏰',
        },
        {
          title: 'Asedio intelectual',
          description: `Gerardex huele un tema duro en ${label}. Conquístalo.`,
          icon: '⚔️',
        },
      ],
      seed,
    );
  }

  if (medium) {
    return pick(
      [
        {
          title: 'Runas olvidadas',
          description: `Desbloquea progreso en un tema intermedio de ${label}.`,
          icon: course.icon || '📚',
        },
        {
          title: 'Mapa sin explorar',
          description: `Una frontera de ${label} pide tu machete de estudio.`,
          icon: '🗺️',
        },
      ],
      seed,
    );
  }

  return pick(
    [
      {
        title: 'Semilla de dominio',
        description: `Planta victoria en un tema nuevo de ${label}.`,
        icon: course.icon || '🌱',
      },
      {
        title: 'Primer asalto al temario',
        description: `Avanza un tema abierto en ${label} — un paso, un bloque, un triunfo.`,
        icon: '✨',
      },
      {
        title: 'Biblioteca en llamas (metafórica)',
        description: `Rescata conocimiento olvidado en ${label}.`,
        icon: '🔥',
      },
    ],
    seed,
  );
}

/** Bloque vinculado a un curso */
export function creativeCourseStudyQuest(course: Course): CreativeQuestCopy {
  const label = courseLabel(course.name);
  const seed = `course-study-${course.id}`;

  return pick(
    [
      {
        title: 'Embajada al campo aliado',
        description: `Completa un bloque dedicado a ${label}.`,
        icon: course.icon || '🏛️',
      },
      {
        title: 'Rituales del curso elegido',
        description: `Hoy ${label} reclama al menos un bloque de honor.`,
        icon: '☀️',
      },
      {
        title: 'Vanguardia del conocimiento',
        description: `Defiende tu progreso en ${label} con un bloque conquistado.`,
        icon: '⚔️',
      },
      {
        title: 'Ofrenda a las musas',
        description: `Un bloque de estudio en ${label} calma a Gerardex.`,
        icon: '🐕',
      },
    ],
    seed,
  );
}

/** Meta semanal por curso */
export function creativeWeeklyCourseQuest(course: Course, target: number): CreativeQuestCopy {
  const label = courseLabel(course.name);
  const seed = `week-course-${course.id}-${target}`;

  return pick(
    [
      {
        title: 'Asedio semanal',
        description: `Completa ${target} bloques ligados a ${label} esta semana.`,
        icon: course.icon || '⚔️',
      },
      {
        title: 'Tres campanas de guerra',
        description: `${label} espera ${target} victorias en el horario de la semana.`,
        icon: '🔔',
      },
      {
        title: 'Garrison del saber',
        description: `Mantén ${target} bloques activos en ${label} antes del domingo.`,
        icon: '🛡️',
      },
    ],
    seed,
  );
}

export const GENERIC_DAILY_COPY = {
  blocks: [
    { title: 'Primer sangrado del día', description: 'Completa tu primer bloque de estudio hoy.', icon: '⚔️' },
    { title: 'Cadena de hierro', description: 'Conquista bloques en el campo de batalla diario.', icon: '⛓️' },
  ],
  minutes: [
    { title: 'Calentamiento espartano', description: 'Acumula minutos en el crisol del día.', icon: '⏳' },
    { title: 'Reloj de arena de guerra', description: 'El tiempo estudiado hoy es tu moneda.', icon: '⌛' },
  ],
  consecutive: [
    { title: 'Combo de guerra', description: 'Completa bloques seguidos sin rendirte.', icon: '⚡' },
    { title: 'Furia de Ares', description: 'Encadena bloques como un berserker disciplinado.', icon: '🔥' },
  ],
  assign: [
    { title: 'Planifica la batalla', description: 'Dibuja el mapa del día en tu horario.', icon: '🗓️' },
    { title: 'Llena el campo', description: 'Asigna bloques antes de que caiga la noche.', icon: '🏛️' },
  ],
  xp: [
    { title: 'Botín del guerrero', description: 'Gana XP conquistando bloques, temas y metas hoy.', icon: '💎' },
    { title: 'Monedas de Ares', description: 'Cada punto de XP es una cicatriz de honor.', icon: '🪙' },
    { title: 'Tesoro de Gerardex', description: 'Gerardex huele el XP desde lejos — dale de comer.', icon: '🐕' },
  ],
} as const;

export const GENERIC_WEEKLY_COPY = {
  weekBlocks: [
    { title: 'Campo de batalla semanal', description: 'Bloques conquistados en los siete días.', icon: '⚔️' },
    { title: 'Muralla de la semana', description: 'Cada bloque es un ladrillo de tu fortaleza.', icon: '🧱' },
  ],
  weekMinutes: [
    { title: 'Maratón espartano', description: 'Minutos totales en el crisol semanal.', icon: '⏳' },
    { title: 'Templo de Atenea', description: 'Horas acumuladas honran a las musas.', icon: '🏛️' },
  ],
  weekMissions: [
    { title: 'Cazar sombras del tablero', description: 'Cierra misiones del tablero — cualquiera cuenta.', icon: '📜' },
    { title: 'Conquista del Ágora', description: 'Reduce la lista de pendientes del tablero.', icon: '🗡️' },
  ],
  weekTopics: [
    { title: 'Dominio disperso', description: 'Avanza temas en cualquiera de tus cursos.', icon: '📚' },
    { title: 'Cartógrafo del saber', description: 'Marca progreso en el mapa de temas.', icon: '🗺️' },
  ],
  weekGoalDays: [
    { title: 'Juramentos cumplidos', description: 'Días en los que alcanzas tu meta diaria.', icon: '☀️' },
    { title: 'Disciplina constante', description: 'La racha de metas diarias define al guerrero.', icon: '🔥' },
  ],
  weekXp: [
    { title: 'Saqueo semanal', description: 'XP acumulado en la odisea de siete días.', icon: '💎' },
    { title: 'Arca del héroe', description: 'Cada XP semanal alimenta tu leyenda.', icon: '🏺' },
  ],
  weekAssign: [
    { title: 'Cartografía del tiempo', description: 'Llena el horario con bloques asignados esta semana.', icon: '🗓️' },
    { title: 'Arquitecto del crisol', description: 'Planifica tu semana bloque a bloque.', icon: '🏛️' },
  ],
} as const;

export function pickGeneric<T extends { title: string; description: string; icon: string }>(
  pool: readonly T[],
  seed: string,
): T {
  return pick([...pool], seed);
}

export function collectOpenTopics(courses: Course[]): Array<{ course: Course; unitId: string; topic: Topic }> {
  return collectActionableTopics(courses);
}
