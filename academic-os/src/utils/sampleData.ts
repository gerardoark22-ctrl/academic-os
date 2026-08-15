import type { Course, Mission, Player, TimeBlock } from '../types';
import { DomainLevel } from '../types';

function uid(): string {
  return crypto.randomUUID();
}

const today = new Date();
const inDays = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

export const sampleCourses: Course[] = [
  {
    id: 'course-cardio',
    name: 'Cardiología',
    icon: '❤️',
    progress: 65,
    templeLevel: 2,
    units: [
      {
        id: 'unit-cardio-1',
        name: 'Anatomía Cardíaca',
        progress: 100,
        topics: [
          { id: 'topic-1-1', name: 'Cavidades', domainLevel: DomainLevel.GOD, studyTime: 150, lastStudied: inDays(-2), completed: true, subtopics: [] },
          { id: 'topic-1-2', name: 'Válvulas', domainLevel: DomainLevel.GOD, studyTime: 120, lastStudied: inDays(-3), completed: true, subtopics: [] },
          { id: 'topic-1-3', name: 'Vasos', domainLevel: DomainLevel.TITAN, studyTime: 200, lastStudied: inDays(-1), completed: true, subtopics: [] },
        ],
        tasks: [],
      },
      {
        id: 'unit-cardio-2',
        name: 'Fisiología',
        progress: 50,
        topics: [
          { id: 'topic-2-1', name: 'Ciclo cardíaco', domainLevel: DomainLevel.DEMIGOD, studyTime: 100, lastStudied: inDays(-1), completed: false, subtopics: [] },
          { id: 'topic-2-2', name: 'Conducción', domainLevel: DomainLevel.HERO, studyTime: 45, lastStudied: inDays(-4), completed: false, subtopics: [] },
        ],
        tasks: [],
      },
      {
        id: 'unit-cardio-3',
        name: 'Patología',
        progress: 0,
        examDate: inDays(3),
        topics: [
          { id: 'topic-3-1', name: 'Insuficiencia cardíaca', domainLevel: DomainLevel.MORTAL, studyTime: 0, lastStudied: null, completed: false, subtopics: [] },
          { id: 'topic-3-2', name: 'Arritmias', domainLevel: DomainLevel.MORTAL, studyTime: 0, lastStudied: null, completed: false, subtopics: [] },
        ],
        tasks: [],
      },
    ],
  },
  {
    id: 'course-anatomia',
    name: 'Anatomía',
    icon: '🦴',
    progress: 60,
    templeLevel: 2,
    units: [
      {
        id: 'unit-anat-1',
        name: 'Miembros Superiores',
        progress: 80,
        topics: [
          { id: 'topic-a-1', name: 'Huesos del brazo', domainLevel: DomainLevel.GOD, studyTime: 130, lastStudied: inDays(-2), completed: false, subtopics: [] },
          { id: 'topic-a-2', name: 'Músculos del antebrazo', domainLevel: DomainLevel.DEMIGOD, studyTime: 90, lastStudied: inDays(-5), completed: false, subtopics: [] },
        ],
        tasks: [],
      },
      {
        id: 'unit-anat-2',
        name: 'Tórax',
        progress: 40,
        topics: [
          { id: 'topic-a-3', name: 'Caja torácica', domainLevel: DomainLevel.HERO, studyTime: 60, lastStudied: inDays(-3), completed: false, subtopics: [] },
          { id: 'topic-a-4', name: 'Diafragma', domainLevel: DomainLevel.MORTAL, studyTime: 15, lastStudied: inDays(-7), completed: false, subtopics: [] },
        ],
        tasks: [],
      },
    ],
  },
];

export const sampleMissions: Mission[] = [
  {
    id: uid(),
    title: 'Examen de Cardiología',
    type: 'exam',
    courseId: 'course-cardio',
    courseName: 'Cardiología',
    dueDate: inDays(3),
    priority: 'odisea',
    complexity: 'heavy',
    xpReward: 750,
    completed: false,
  },
  {
    id: uid(),
    title: 'Tarea de Anatomía — Miembros',
    type: 'task',
    courseId: 'course-anatomia',
    courseName: 'Anatomía',
    dueDate: inDays(7),
    priority: 'epica',
    complexity: 'medium',
    xpReward: 200,
    completed: false,
  },
  {
    id: uid(),
    title: 'Leer Capítulo 5 — Fisiología',
    type: 'reading',
    courseId: 'course-cardio',
    courseName: 'Cardiología',
    dueDate: inDays(14),
    priority: 'chiste',
    complexity: 'medium',
    xpReward: 100,
    completed: false,
  },
  {
    id: uid(),
    title: 'Práctica de Fisiología',
    type: 'task',
    courseId: 'course-cardio',
    courseName: 'Cardiología',
    dueDate: inDays(-2),
    priority: 'chiste',
    complexity: 'medium',
    xpReward: 100,
    completed: true,
  },
];

export const samplePlayer: Player = {
  id: 'gerardex',
  level: 42,
  xp: 17640,
  titles: ['Guardián del Tiempo'],
  weapons: ['Espada de Hierro'],
  skins: ['default'],
  currentSkin: 'default',
  lastStudyDate: inDays(-1),
  studyStreak: 5,
};

export function generateTimeBlocks(date: string): TimeBlock[] {
  const blocks: TimeBlock[] = [];
  for (let hour = 6; hour < 23; hour++) {
    for (const min of [0, 30]) {
      const start = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      const endHour = min === 30 ? hour + 1 : hour;
      const endMin = min === 30 ? '00' : '30';
      const end = `${String(endHour).padStart(2, '0')}:${endMin}`;

      const isStudyBlock = hour === 7 && min === 0;
      blocks.push({
        id: uid(),
        date,
        startTime: start,
        endTime: end,
        type: hour >= 22 ? 'rest' : isStudyBlock ? 'study' : 'rest',
        title: isStudyBlock ? 'Estudiar Cardiología' : hour >= 22 ? 'Descanso' : '',
        courseId: isStudyBlock ? 'course-cardio' : undefined,
        topicId: isStudyBlock ? 'topic-2-1' : undefined,
        completed: false,
      });
    }
  }
  return blocks;
}

export const freshPlayer: Player = {
  id: 'gerardex',
  level: 1,
  xp: 0,
  titles: [],
  weapons: [],
  skins: ['default'],
  currentSkin: 'default',
  lastStudyDate: null,
  studyStreak: 0,
  hadesEmailEnabled: true,
};

export async function seedDatabase(
  db: {
    player: { count: () => Promise<number>; put: (p: Player) => Promise<unknown> };
    courses: { bulkPut: (c: Course[]) => Promise<unknown> };
    missions: { bulkPut: (m: Mission[]) => Promise<unknown> };
    timeblocks: { bulkPut: (t: TimeBlock[]) => Promise<unknown> };
  },
): Promise<void> {
  const count = await db.player.count();
  if (count > 0) return;

  const today = new Date().toISOString().split('T')[0];
  await db.player.put(freshPlayer);
  await db.courses.bulkPut([]);
  await db.missions.bulkPut([]);
  await db.timeblocks.bulkPut(generateTimeBlocks(today));
}
