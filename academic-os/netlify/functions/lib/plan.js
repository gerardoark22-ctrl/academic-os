/**
 * Lógica pura del despacho: hora de Lima, los 6 disparadores y la redacción.
 *
 * Vive aparte de despachar.js para poder probarla sin red ni Supabase
 * (`node scripts/check-despacho.cjs`). Es el puerto directo de lo que estaba en
 * src/utils/localNotifications.ts (borrado con Capacitor): la redacción y el
 * escalado de tono ya estaban afinados, no se reescribieron.
 *
 * Perú no tiene horario de verano: UTC-5 fijo todo el año. Por eso el desfase
 * es una constante y no hace falta ninguna librería de zonas horarias.
 */

const LIMA_OFFSET_MIN = -5 * 60;

/** Fecha y hora en Lima de un instante dado. */
function limaNow(nowMs) {
  const d = new Date(nowMs + LIMA_OFFSET_MIN * 60000);
  const p = (n) => String(n).padStart(2, '0');
  return {
    fecha: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
    hhmm: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
    minutos: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

/** Instante UTC (ms) de una fecha+hora de Lima. */
function limaToMs(fecha, hhmm) {
  const [y, m, d] = fecha.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  return Date.UTC(y, m - 1, d, h, min) - LIMA_OFFSET_MIN * 60000;
}

const minutos = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

// ── Redacción ───────────────────────────────────────────────────────────────

function morningBody(d) {
  const lineas = [];
  const pendientes = d.blocks.filter((b) => !b.completed);
  if (d.dueToday.length) {
    lineas.push(`📌 ${d.dueToday.length} para hoy: ${d.dueToday.slice(0, 3).join(', ')}`);
  }
  if (d.overdue.length) lineas.push(`🔥 ${d.overdue.length} vencida(s)`);
  if (pendientes.length) {
    const primero = pendientes.reduce((a, b) => (a.startTime <= b.startTime ? a : b));
    lineas.push(`⏱️ ${pendientes.length} bloque(s) — arranca ${primero.startTime} ${primero.title}`);
  }
  if (d.exam) lineas.push(`🎯 ${d.exam.name} en ${d.exam.daysLeft}d`);
  if (!lineas.length) lineas.push('Día limpio: sin pendientes ni bloques cargados. Carga tu plan.');
  return lineas.join('\n');
}

function nightBody(d) {
  const lineas = [];
  const sinHacer = d.blocks.filter((b) => !b.completed);
  lineas.push(`Bloques ${d.blocks.length - sinHacer.length}/${d.blocks.length} · meta ${d.goalMinutes} min`);
  if (sinHacer.length) {
    lineas.push('❌ Sin marcar: ' + sinHacer.slice(0, 4).map((b) => b.title).join(', '));
  }
  if (d.overdue.length) lineas.push(`⚠️ Mañana arrastras ${d.overdue.length} misión(es) vencida(s)`);
  if (!sinHacer.length) lineas.push('✅ Todo marcado. Duerme tranquilo.');
  return lineas.join('\n');
}

function overdueBody(venc) {
  const peor = venc.reduce((m, x) => Math.max(m, x.daysOverdue), 0);
  const titulos = venc.slice(0, 3).map((m) => m.title).join(', ');
  if (peor >= 7) {
    return [`☠️ ${venc.length} misiones podridas (+${peor}d)`, `${titulos}. Ya no es olvido, es abandono.`];
  }
  if (peor >= 3) {
    return [`🔥 ${venc.length} vencidas hace ${peor} días`, `${titulos}. Cada día que pasa cuesta más.`];
  }
  return [`⏳ ${venc.length} misión(es) vencida(s)`, `${titulos}. Márcala o muévela, pero no la ignores.`];
}

function examBody(examen) {
  const d = examen.daysLeft;
  if (d <= 1) return [d === 1 ? '🚨 EXAMEN MAÑANA' : '🚨 EXAMEN HOY', examen.name];
  if (d <= 3) return [`⚔️ ${examen.name}: ${d} días`, 'Ya no hay margen. Hoy toca repasar sí o sí.'];
  return [`🎯 ${examen.name}: ${d} días`, 'Sigue empujando temas: en 3 días esto se pone feo.'];
}

const EXAM_HOUR = '09:00';
const OVERDUE_HOUR = '13:00';
const DEFAULT_MORNING = '07:00';
const DEFAULT_NIGHT = '22:00';

/**
 * Los 6 disparadores de un día. `clave` es lo que evita reenvíos: incluye la
 * fecha, así que cada evento se manda una sola vez por día por más que la
 * función corra cada 5 minutos.
 */
function planDay(d, times) {
  const morning = times.morning || DEFAULT_MORNING;
  const night = times.night || DEFAULT_NIGHT;
  const out = [
    { clave: `${d.date}:briefing`, hhmm: morning, title: '☀️ Briefing del día', body: morningBody(d) },
    { clave: `${d.date}:cierre`, hhmm: night, title: '🌙 Cierre del día', body: nightBody(d) },
  ];

  for (const b of d.blocks) {
    if (b.completed) continue;
    out.push({
      clave: `${d.date}:bloque-inicio:${b.id}`,
      hhmm: b.startTime,
      title: `▶️ ${b.title}`,
      body: `Bloque ${b.startTime}–${b.endTime}. Empieza ahora.`,
    });
    out.push({
      clave: `${d.date}:bloque-fin:${b.id}`,
      hhmm: b.endTime,
      title: `⏱️ ¿Completaste ${b.title}?`,
      body: `El bloque ${b.startTime}–${b.endTime} terminó.`,
    });
  }

  if (d.overdue.length) {
    const [title, body] = overdueBody(d.overdue);
    out.push({ clave: `${d.date}:vencidas`, hhmm: OVERDUE_HOUR, title, body });
  }

  if (d.exam && d.exam.daysLeft >= 0 && d.exam.daysLeft <= 7) {
    const [title, body] = examBody(d.exam);
    out.push({ clave: `${d.date}:examen`, hhmm: EXAM_HOUR, title, body });
  }

  return out.sort((a, b) => minutos(a.hhmm) - minutos(b.hhmm));
}

/** Ventana de tolerancia: un evento sigue "vivo" hasta 10 min después de su hora. */
const GRACIA_MIN = 10;

/**
 * Qué toca enviar AHORA. `days` es lo que subió el cliente (hoy y mañana); se
 * usa el que coincide con la fecha de Lima. Nada de días pasados: si la app
 * estuvo cerrada toda la noche, no se dispara un briefing de ayer a destiempo.
 */
function duePushes(days, times, nowMs, graciaMin = GRACIA_MIN) {
  const ahora = limaNow(nowMs);
  const hoy = (days || []).find((d) => d && d.date === ahora.fecha);
  if (!hoy) return [];
  return planDay(hoy, times || {}).filter((e) => {
    const delta = ahora.minutos - minutos(e.hhmm);
    return delta >= 0 && delta <= graciaMin;
  });
}

module.exports = {
  LIMA_OFFSET_MIN,
  GRACIA_MIN,
  limaNow,
  limaToMs,
  minutos,
  morningBody,
  nightBody,
  overdueBody,
  examBody,
  planDay,
  duePushes,
};
