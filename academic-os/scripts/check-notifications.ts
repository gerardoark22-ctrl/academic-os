/** npx tsx scripts/check-notifications.ts — los 6 disparadores y el escalado. */
import assert from 'node:assert';
import { planDay, morningBody, overdueBody, examBody, type DayData } from '../src/utils/localNotifications';

const day: DayData = {
  date: '2026-08-15',
  blocks: [
    { id: 'b1', title: 'Neuro', startTime: '08:00', endTime: '08:30', completed: false },
    { id: 'b2', title: 'Hecho', startTime: '10:00', endTime: '10:30', completed: true },
  ],
  dueToday: ['Leer cap 3'],
  overdue: [{ title: 'Seminario', daysOverdue: 4 }],
  exam: { name: 'Neuro — U2', daysLeft: 3 },
  goalMinutes: 180,
};

const hhmm = (ms: number) =>
  new Date(ms).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour12: false });

const p = planDay(day, { morning: '07:00', night: '22:00' });
assert.deepStrictEqual(
  p.map((x) => hhmm(x.atMs)),
  ['07:00:00', '08:00:00', '08:30:00', '09:00:00', '13:00:00', '22:00:00'],
  JSON.stringify(p.map((x) => [hhmm(x.atMs), x.title])),
);
assert.strictEqual(p.filter((x) => x.blockId).length, 1, 'solo el fin de bloque lleva acciones');
assert.ok(!p.some((x) => x.title.includes('Hecho')), 'un bloque completado no genera avisos');

const body = morningBody(day);
assert.ok(body.includes('Leer cap 3') && body.includes('en 3d'), body);

assert.ok(overdueBody([{ title: 'X', daysOverdue: 1 }])[0].startsWith('⏳'));
assert.ok(overdueBody([{ title: 'X', daysOverdue: 4 }])[0].startsWith('🔥'));
assert.ok(overdueBody([{ title: 'X', daysOverdue: 9 }])[0].startsWith('☠️'));
assert.ok(examBody({ name: 'X', daysLeft: 0 })[0].includes('HOY'));
assert.ok(examBody({ name: 'X', daysLeft: 1 })[0].includes('MAÑANA'));

// Sin bloques ni pendientes el briefing no sale vacío.
assert.ok(
  morningBody({ ...day, blocks: [], dueToday: [], overdue: [], exam: null }).includes('Día limpio'),
);

console.log('ok — planDay y redacción');
