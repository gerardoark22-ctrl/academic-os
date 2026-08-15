/**
 * node scripts/check-despacho.cjs
 *
 * Lo más fácil de romper del sistema son dos cosas: la conversión Lima <-> UTC
 * (la función corre en UTC, el usuario vive en UTC-5) y el antideduplicado (si
 * falla, cada aviso sale 3 veces porque el cron corre cada 5 minutos). Esto las
 * prueba sin red y sin Supabase.
 */

const assert = require('node:assert');
const { limaNow, limaToMs, planDay, duePushes, GRACIA_MIN } = require('../netlify/functions/lib/plan');

// ── Lima <-> UTC ────────────────────────────────────────────────────────────

// 12:00 UTC son las 07:00 en Lima.
assert.deepStrictEqual(limaNow(Date.parse('2026-08-15T12:00:00Z')).hhmm, '07:00');
assert.deepStrictEqual(limaNow(Date.parse('2026-08-15T12:00:00Z')).fecha, '2026-08-15');

// Cruce de día: 02:00 UTC del 16 siguen siendo las 21:00 del 15 en Lima.
const cruce = limaNow(Date.parse('2026-08-16T02:00:00Z'));
assert.strictEqual(cruce.fecha, '2026-08-15', 'la fecha de Lima va un día atrás de madrugada UTC');
assert.strictEqual(cruce.hhmm, '21:00');

// Perú no tiene horario de verano: enero y julio dan el mismo desfase.
assert.strictEqual(limaNow(Date.parse('2026-01-15T12:00:00Z')).hhmm, '07:00');
assert.strictEqual(limaNow(Date.parse('2026-07-15T12:00:00Z')).hhmm, '07:00');

// Ida y vuelta.
assert.strictEqual(limaToMs('2026-08-15', '07:00'), Date.parse('2026-08-15T12:00:00Z'));
const ms = limaToMs('2026-08-15', '22:00');
assert.deepStrictEqual([limaNow(ms).fecha, limaNow(ms).hhmm], ['2026-08-15', '22:00']);

// ── Los 6 disparadores ──────────────────────────────────────────────────────

const day = {
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
const times = { morning: '07:00', night: '22:00' };

const plan = planDay(day, times);
assert.deepStrictEqual(
  plan.map((e) => e.hhmm),
  ['07:00', '08:00', '08:30', '09:00', '13:00', '22:00'],
  JSON.stringify(plan.map((e) => [e.hhmm, e.title])),
);
assert.ok(!plan.some((e) => e.title.includes('Hecho')), 'un bloque completado no genera avisos');
assert.strictEqual(new Set(plan.map((e) => e.clave)).size, plan.length, 'las claves son únicas');
assert.ok(plan.every((e) => e.clave.startsWith('2026-08-15:')), 'toda clave lleva la fecha');

// ── Ventana + antideduplicado ───────────────────────────────────────────────

const dias = [day];
const en = (hhmm, extraMin = 0) => limaToMs('2026-08-15', hhmm) + extraMin * 60000;

// Justo a la hora sale; un minuto antes todavía no.
assert.deepStrictEqual(duePushes(dias, times, en('07:00')).map((e) => e.clave), ['2026-08-15:briefing']);
assert.deepStrictEqual(duePushes(dias, times, en('07:00', -1)), []);

// Dentro de la gracia sigue vivo; pasada la gracia ya no (no revive a las 3pm).
assert.strictEqual(duePushes(dias, times, en('07:00', GRACIA_MIN)).length, 1);
assert.strictEqual(duePushes(dias, times, en('07:00', GRACIA_MIN + 1)).length, 0);

// Un día que no es hoy no dispara nada (nada de briefings de ayer a destiempo).
assert.deepStrictEqual(duePushes(dias, times, limaToMs('2026-08-16', '07:00')), []);

// Simulación del antideduplicado real: aos_sent es una primary key, o sea un Set.
// Correr cada 5 min dentro de la ventana de gracia debe enviar UNA sola vez.
const enviados = new Set();
let envios = 0;
for (let min = 0; min <= 30; min += 5) {
  for (const ev of duePushes(dias, times, en('07:00', min))) {
    if (enviados.has(ev.clave)) continue; // insert ... on conflict do nothing
    enviados.add(ev.clave);
    envios++;
  }
}
assert.strictEqual(envios, 1, 'el briefing se envía una sola vez pese a 7 corridas del cron');

// Un día completo: ~6 avisos, cada uno una sola vez.
const delDia = new Set();
for (let min = 0; min < 24 * 60; min += 5) {
  for (const ev of duePushes(dias, times, en('00:00', min))) delDia.add(ev.clave);
}
assert.strictEqual(delDia.size, plan.length, `se esperaban ${plan.length} avisos únicos en el día`);
assert.ok(delDia.size >= 5 && delDia.size <= 8, 'objetivo de 5-8 avisos al día');

// Cambiar la hora del briefing mueve el disparo (es configurable, por eso el cron cada 5 min).
assert.strictEqual(duePushes(dias, { morning: '05:30', night: '22:00' }, en('05:30')).length, 1);

console.log('ok — Lima/UTC, los 6 disparadores y el antideduplicado');
