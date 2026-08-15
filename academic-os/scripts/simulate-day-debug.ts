/**
 * Simulación interna: rollover, meta diaria, level-ups, misiones.
 * Ejecutar: npm run simulate
 */
import { calculateLevel, xpThresholdForLevel, todayISO, LEVEL_XP_EASE_FACTOR } from '../src/utils/gamification';
import { addDaysLocalISO, todayLocalISO } from '../src/utils/localTime';
import { levelUpsBetween } from '../src/utils/celebrationPipeline';
import {
  isDailyGoalMetForToday,
  resolveTodayStudyMinutes,
} from '../src/utils/studyProgress';
import { generateDailyMissions, buildGenContext } from '../src/utils/dailyMissionGenerator';
import { computeMissionProgress, actionCompletedToday } from '../src/utils/dailyMissionSync';
import { mergeDailyMissionProgress } from '../src/utils/questRegen';
import type { DailyMission } from '../src/types';
import type { Player, TimeBlock, Course, Mission } from '../src/types';
import { createDefaultPlayer } from '../src/utils/defaultPlayer';
import { PLAYER_CONFIG } from '../src/utils/playerConfig';
import { getSchedulePeriods, blockInSchedulePeriod } from '../src/utils/dayPeriods';
import {
  applyPendingHadesEmailConfig,
  shouldDispatchHadesEmailSlot,
  getSlotSettings,
} from '../src/utils/hadesEmailConfig';
import { evaluateHadesTriggers } from '../src/utils/hadesRules';

let passed = 0;
let failed = 0;

const TODAY = todayLocalISO();
const YESTERDAY = addDaysLocalISO(TODAY, -1);

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

function block(date: string, completed: boolean, minutes = 30): TimeBlock {
  return {
    id: `b-${date}-${Math.random().toString(36).slice(2, 7)}`,
    date,
    startTime: '09:00',
    endTime: '09:30',
    title: 'Estudio',
    type: 'study',
    completed,
    completionRecord: completed ? { blockXp: 10, goalBonus: 0, minutes } : undefined,
  };
}

function simulateRollover(player: Player, newDate: string): Player {
  if (player.lastActiveDate === newDate) return player;
  return {
    ...player,
    yesterdayStudyMinutes: player.todayStudyMinutes ?? 0,
    todayStudyMinutes: 0,
    consecutiveBlocks: 0,
    lastActiveDate: newDate,
    goalMetDate: undefined,
  };
}

console.log(`\n📅 Simulando con hoy=${TODAY} ayer=${YESTERDAY}\n`);

console.log('=== 1. Meta diaria — minutos obsoletos ===');
{
  const player: Player = {
    ...createDefaultPlayer(),
    lastActiveDate: YESTERDAY,
    todayStudyMinutes: 180,
    goalMetDate: YESTERDAY,
  };
  const todayBlocks = [block(TODAY, true)];
  const stale = resolveTodayStudyMinutes(player, todayBlocks);
  assert(stale === 0, `Sin sesión hoy (lastActiveDate ayer), meta en 0 aunque haya bloques (${stale})`);

  const rolled = simulateRollover(player, TODAY);
  assert(rolled.todayStudyMinutes === 0, 'Rollover pone todayStudyMinutes en 0');
  assert(rolled.goalMetDate === undefined, 'Rollover limpia goalMetDate');

  const afterRoll = resolveTodayStudyMinutes(rolled, todayBlocks);
  assert(afterRoll === 30, `Tras rollover + 1 bloque hoy = ${afterRoll} min`);
}

console.log('\n=== 2. Meta cumplida — coherencia ===');
{
  const player: Player = {
    ...createDefaultPlayer(),
    lastActiveDate: TODAY,
    todayStudyMinutes: 180,
    dailyGoalMinutes: 180,
  };
  const blocks = Array.from({ length: 6 }, (_, i) => ({
    ...block(TODAY, true, 30),
    id: `goal-block-${i}`,
    startTime: `${String(6 + i).padStart(2, '0')}:00`,
  }));
  assert(isDailyGoalMetForToday(player, blocks), 'Meta cumplida con bloques contrato completados');

  const stalePlayer = { ...player, lastActiveDate: YESTERDAY, todayStudyMinutes: 180 };
  assert(!isDailyGoalMetForToday(stalePlayer, []), 'Meta NO cumplida si lastActiveDate no es hoy y sin bloques');
}

console.log('\n=== 3. Level-ups encadenados ===');
{
  const ups = levelUpsBetween(3, 5, 0);
  assert(ups.length === 2, `Subir 3→5 genera 2 overlays (${ups.length})`);
  assert(ups[0].level === 4 && ups[1].level === 5, 'Niveles 4 y 5 en orden');

  const skip = levelUpsBetween(3, 5, 4);
  assert(skip.length === 1 && skip[0].level === 5, 'lastLevelCelebrated=4 solo celebra 5');
}

console.log('\n=== 4. Misiones realizables ===');
{
  const courses: Course[] = [
    {
      id: 'c1',
      name: 'Anatomía',
      icon: '🫀',
      color: '#f00',
      units: [
        {
          id: 'u1',
          name: 'U1',
          topics: [{ id: 't1', name: 'T1', completed: true, domainLevel: 10, subtopics: [] }],
          progress: 100,
          tasks: [],
        },
      ],
      progress: 100,
    },
    {
      id: 'c2',
      name: 'Farmaco',
      icon: '💊',
      color: '#0f0',
      units: [
        {
          id: 'u2',
          name: 'U2',
          topics: [{ id: 't2', name: 'T2', completed: false, domainLevel: 80, subtopics: [] }],
          progress: 50,
          tasks: [],
        },
      ],
      progress: 50,
    },
  ];
  const missions: Mission[] = [];
  const todayBlocks: TimeBlock[] = [
    { ...block(TODAY, false), id: 'empty1', title: '', type: 'rest' },
    { ...block(TODAY, false), courseId: 'c2' },
  ];

  const player = { ...createDefaultPlayer(), dailyGoalMinutes: 180 };
  const daily = generateDailyMissions(buildGenContext(courses, missions, todayBlocks, player));
  assert(daily.some((m) => m.kind === 'daily_goal'), 'Siempre hay meta diaria');
  const kinds = new Set(daily.map((m) => m.kind));
  assert(kinds.size === daily.length, `Misiones diarias con tipos distintos (${kinds.size}/${daily.length})`);
  assert(
    !daily.some((m) => m.kind === 'complete_topic' && m.refTopicId === 't1'),
    'No pide tema ya completado (c1)',
  );
  const topicQuests = daily.filter((m) => m.kind === 'complete_topic');
  if (topicQuests.length > 0) {
    assert(
      topicQuests.every((m) => m.refTopicId === 't2'),
      'complete_topic solo apunta a temas pendientes',
    );
  } else {
    assert(true, 'Sin complete_topic (pool aleatorio) — OK');
  }
  assert(
    !daily.some((m) => m.kind === 'course_study' && m.refCourseId === 'c1'),
    'No pide estudio en curso sin pendientes (c1)',
  );
  assert(daily.length <= PLAYER_CONFIG.dailyMissionCount, `Máximo ${PLAYER_CONFIG.dailyMissionCount} misiones`);
}

console.log('\n=== 5. Misión daily_goal tras rollover ===');
{
  const player: Player = {
    ...createDefaultPlayer(),
    lastActiveDate: TODAY,
    todayStudyMinutes: 0,
    dailyGoalMinutes: 180,
  };
  const missions = generateDailyMissions(buildGenContext([], [], [], player));
  const goal = missions.find((m) => m.kind === 'daily_goal')!;
  const prog = computeMissionProgress(goal, { player, missions: [], courses: [], todayBlocks: [] });
  assert(prog === 0, `daily_goal progress=0 tras rollover (${prog})`);
}

console.log('\n=== 6. Primer bloque no arrastra minutos de ayer ===');
{
  const player: Player = {
    ...createDefaultPlayer(),
    lastActiveDate: YESTERDAY,
    todayStudyMinutes: 180,
  };
  const base = player.lastActiveDate === TODAY ? (player.todayStudyMinutes ?? 0) : 0;
  const after = base + PLAYER_CONFIG.blockMinutes;
  assert(after === 30, `Primer bloque del día nuevo = 30 min, no 210 (${after})`);
}

console.log('\n=== 7. todayISO() === todayLocalISO() ===');
{
  assert(todayISO() === TODAY, 'todayISO y todayLocalISO coinciden (Perú)');
}

console.log('\n=== 8. XP thresholds (40% más fácil) ===');
{
  const oldL2 = Math.floor(Math.pow(1, 2.65) * 750);
  const newL2 = xpThresholdForLevel(2);
  assert(LEVEL_XP_EASE_FACTOR === 0.6, 'Factor de facilidad = 0.6 (40% más fácil)');
  assert(newL2 === Math.floor(oldL2 * 0.6), `Nivel 2 = ${newL2} XP (60% de ${oldL2})`);
  let okCurve = true;
  for (let l = 2; l <= 20; l++) {
    if (xpThresholdForLevel(l) <= xpThresholdForLevel(l - 1)) okCurve = false;
  }
  assert(okCurve, 'Umbrales XP crecen con el nivel');
  assert(calculateLevel(0) === 1, 'XP 0 = nivel 1');
  assert(calculateLevel(newL2) === 2, `Con ${newL2} XP subes a nivel 2`);
  assert(calculateLevel(newL2 - 1) === 1, 'Justo bajo umbral L2 = nivel 1');
  assert(calculateLevel(562) >= 2, 'XP legacy 562 ya no queda atrapado en nivel 1');
}

console.log('\n=== 9. Turnos según horario del reloj ===');
{
  const early = getSchedulePeriods({ start: '01:00', end: '21:00' });
  assert(early.length === 3, 'Horario largo genera 3 turnos');
  assert(blockInSchedulePeriod('01:00', 'morning', { start: '01:00', end: '21:00' }), '01:00 cae en mañana del rango 1–21');
  assert(!blockInSchedulePeriod('12:00', 'morning', { start: '01:00', end: '21:00' }), '12:00 no es mañana en rango 1–21');
  assert(blockInSchedulePeriod('20:30', 'evening', { start: '01:00', end: '21:00' }), '20:30 cae en noche del rango 1–21');
}

console.log('\n=== 10. Correos Hades — config y dispatch ===');
{
  const player: Player = {
    ...createDefaultPlayer(),
    lastActiveDate: TODAY,
    hadesEmailSlotsPending: { sixPm: { hour: 19, minute: 0, frequency: 'daily' } },
    hadesEmailSlotsPendingFrom: TODAY,
  };
  const { player: applied, applied: did } = applyPendingHadesEmailConfig(player);
  assert(did, 'Config pendiente se aplica cuando effectiveFrom es hoy');
  assert(getSlotSettings(applied, 'sixPm').hour === 19, 'Hora sixPm aplicada');

  const triggers = evaluateHadesTriggers(applied, [], [], 0);
  assert(
    !shouldDispatchHadesEmailSlot('sixPm', triggers, {
      ...applied,
      hadesEmailSlotsActive: { sixPm: { hour: 18, minute: 0, frequency: 'disabled' } },
    }),
    'Slot desactivado no dispara',
  );
}

console.log('\n=== 11. Meta — bloques vs contador jugador ===');
{
  const player: Player = {
    ...createDefaultPlayer(),
    lastActiveDate: TODAY,
    todayStudyMinutes: 999,
  };
  const blocks = [block(TODAY, true, 30)];
  const resolved = resolveTodayStudyMinutes(player, blocks);
  assert(resolved === 30, `Bloques mandan sobre contador inflado (${resolved}, no 999)`);
}

console.log('\n=== 12. Level-up tras penalización ===');
{
  const { levelUpsBetween } = await import('../src/utils/celebrationPipeline');
  assert(levelUpsBetween(3, 4, 5).length === 0, 'lastCelebrated alto bloquea overlay');
  assert(levelUpsBetween(3, 4, 3).length === 1, 'Tras bajar a 3 celebra recuperación a 4');
  assert(levelUpsBetween(3, 5, 3).length === 2, 'Recuperación multi-nivel');
}

console.log('\n=== 13. Desafíos diarios — solo acciones de hoy ===');
{
  const player = { ...createDefaultPlayer(), lastActiveDate: TODAY, xp: 500 };
  const courses: Course[] = [
    {
      id: 'c1',
      name: 'Bio',
      icon: '🧬',
      color: '#f00',
      units: [
        {
          id: 'u1',
          name: 'U1',
          topics: [
            { id: 't-old', name: 'Ayer', completed: true, completedOn: YESTERDAY, domainLevel: 50, subtopics: [], studyTime: 60, lastStudied: YESTERDAY },
            { id: 't-today', name: 'Hoy', completed: true, completedOn: TODAY, domainLevel: 50, subtopics: [], studyTime: 30, lastStudied: TODAY },
          ],
          progress: 100,
          tasks: [],
        },
      ],
      progress: 100,
    },
  ];
  const missions: Mission[] = [
    { id: 'm-old', title: 'Vieja', type: 'task', courseId: 'c1', courseName: 'Bio', dueDate: '', priority: 'epica', xpReward: 10, completed: true, completedOn: YESTERDAY },
    { id: 'm-today', title: 'Hoy', type: 'task', courseId: 'c1', courseName: 'Bio', dueDate: '', priority: 'epica', xpReward: 10, completed: true, completedOn: TODAY },
  ];
  const ctx = { player, missions, courses, todayBlocks: [], xpBaseline: 400 };

  const topicOld: DailyMission = {
    id: 'd1', date: TODAY, title: '', description: '', kind: 'complete_topic', complexity: 'medium', required: false,
    target: 1, progress: 0, completed: false, xpReward: 10, icon: '⚔',
    refCourseId: 'c1', refUnitId: 'u1', refTopicId: 't-old',
  };
  const topicToday: DailyMission = { ...topicOld, id: 'd2', refTopicId: 't-today' };
  const missionOld: DailyMission = {
    id: 'd3', date: TODAY, title: '', description: '', kind: 'complete_mission', complexity: 'medium', required: false,
    target: 1, progress: 0, completed: false, xpReward: 10, icon: '📜', refMissionId: 'm-old',
  };
  const missionToday: DailyMission = { ...missionOld, id: 'd4', refMissionId: 'm-today' };
  const earnXp: DailyMission = {
    id: 'd5', date: TODAY, title: '', description: '', kind: 'earn_xp', complexity: 'medium', required: false,
    target: 50, progress: 0, completed: false, xpReward: 10, icon: '✨',
  };

  assert(computeMissionProgress(topicOld, ctx) === 0, 'Tema completado ayer no cuenta');
  assert(computeMissionProgress(topicToday, ctx) === 1, 'Tema completado hoy sí cuenta');
  assert(computeMissionProgress(missionOld, ctx) === 0, 'Misión completada ayer no cuenta');
  assert(computeMissionProgress(missionToday, ctx) === 1, 'Misión completada hoy sí cuenta');
  assert(computeMissionProgress(earnXp, ctx) === 100, 'earn_xp desde baseline del día');

  const yesterdayPlayer = { ...player, lastActiveDate: YESTERDAY };
  assert(computeMissionProgress(earnXp, { ...ctx, player: yesterdayPlayer }) === 0, 'earn_xp no cuenta si lastActiveDate no es hoy');

  assert(actionCompletedToday(YESTERDAY, true, TODAY) === false, 'completedOn ayer ≠ hoy');
  assert(actionCompletedToday(TODAY, true, TODAY) === true, 'completedOn hoy = hoy');
  assert(actionCompletedToday(undefined, true, TODAY, TODAY) === true, 'legacy lastStudied hoy');
  assert(actionCompletedToday(undefined, true, TODAY, YESTERDAY) === false, 'legacy lastStudied ayer no cuenta');
}

console.log('\n=== 14. Regen diaria no arrastra auto-completado ===');
{
  const prev: DailyMission[] = [{
    id: 'old', date: TODAY, title: 'Viejo', description: '', kind: 'complete_topic', complexity: 'medium', required: false,
    target: 1, progress: 1, completed: true, xpReward: 10, icon: '⚔', refTopicId: 't1', refCourseId: 'c1', refUnitId: 'u1',
  }];
  const fresh: DailyMission[] = [{
    id: 'new', date: TODAY, title: 'Nuevo', description: '', kind: 'complete_topic', complexity: 'medium', required: false,
    target: 1, progress: 0, completed: false, xpReward: 10, icon: '⚔', refTopicId: 't1', refCourseId: 'c1', refUnitId: 'u1',
  }];
  const merged = mergeDailyMissionProgress(prev, fresh);
  assert(!merged[0].completed && merged[0].progress === 0, 'Merge no conserva auto-completado');
}

console.log('\n=== 15. Misiones distintas por día ===');
{
  const player = { ...createDefaultPlayer(), dailyGoalMinutes: 180 };
  const dayA = generateDailyMissions(buildGenContext([], [], [], player, '2026-06-20'));
  const dayB = generateDailyMissions(buildGenContext([], [], [], player, '2026-06-21'));
  const kindsA = dayA.map((m) => m.kind).join(',');
  const kindsB = dayB.map((m) => m.kind).join(',');
  assert(kindsA !== kindsB || dayA[1]?.title !== dayB[1]?.title, 'Seed por fecha varía misiones');
}

console.log('\n=== 16. Sanity — rebalance de curva XP ===');
{
  const { sanitizePlayer } = await import('../src/utils/appSanity');
  const base = createDefaultPlayer();
  const stale: Player = {
    ...base,
    xp: 450,
    level: 1,
    lastLevelCelebrated: 1,
  };
  const { player: fixed, report } = sanitizePlayer(stale);
  assert(fixed.level === 2, `450 XP → nivel 2 tras rebalance (${fixed.level})`);
  assert((fixed.lastLevelCelebrated ?? 0) >= 2, 'lastLevelCelebrated alineado');
  assert(report.fixed.some((f) => f.includes('Nivel') || f.includes('Celebración')), 'Sanity reporta fix');
}

console.log(`\n--- Resultado: ${passed} OK, ${failed} FAIL ---\n`);
process.exit(failed > 0 ? 1 : 0);
