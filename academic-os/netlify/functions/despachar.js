/**
 * Scheduled function: corre cada 5 minutos (ver netlify.toml) y decide si toca
 * mandar alguna notificación en ese momento.
 *
 * Corre en UTC. El usuario vive en Lima (UTC-5 fijo, sin horario de verano) y
 * las horas del briefing/cierre las elige él dentro de la app, así que un cron
 * fijo no sirve: se consulta cada 5 min y lib/plan.js convierte la hora.
 *
 * Antideduplicado: antes de enviar se reserva la clave `fecha:evento` en la
 * tabla aos_sent (clave = primary key, insert con ignore-duplicates). Si la
 * fila ya existía, PostgREST devuelve vacío y el envío se salta. Sin esto,
 * correr cada 5 min mandaría el mismo aviso 3 veces (ventana de gracia 10 min).
 *
 * Variables de entorno en Netlify:
 *   FIREBASE_SERVICE_ACCOUNT   → JSON completo de la cuenta de servicio (SECRETO)
 *   SUPABASE_URL               → URL del proyecto de Supabase
 *   SUPABASE_SERVICE_ROLE_KEY  → llave service_role de Supabase (SECRETA)
 */

const { duePushes } = require('./lib/plan');
const { tokenDeAcceso, enviarFCM, supaClient } = require('./lib/fcm');

const USER_ID = 'gerardex';

exports.handler = async () => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIREBASE_SERVICE_ACCOUNT } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FIREBASE_SERVICE_ACCOUNT) {
    return { statusCode: 500, body: 'Faltan variables de entorno (ver DESPLIEGUE.md)' };
  }

  const sup = supaClient();

  try {
    const [snap] = await sup('GET', `aos_snapshot?user_id=eq.${USER_ID}&select=*`);
    if (!snap) return ok('sin snapshot: la app todavía no subió datos');

    const eventos = duePushes(
      snap.days,
      { morning: snap.morning, night: snap.night },
      Date.now(),
      { enabled: snap.enabled },
    );
    if (!eventos.length) return ok('nada que enviar en esta ventana');

    const tokens = await sup('GET', 'aos_push_subs?select=token');
    if (!tokens.length) return ok('nadie tiene push activado');

    const accessToken = await tokenDeAcceso();
    const projectId = JSON.parse(FIREBASE_SERVICE_ACCOUNT).project_id;
    let enviados = 0;

    for (const ev of eventos) {
      // Reserva atómica de la clave: si ya estaba, esto devuelve [] y se salta.
      const reservado = await sup('POST', 'aos_sent', { clave: ev.clave });
      if (!reservado.length) continue;

      try {
        await Promise.all(tokens.map((t) => enviarFCM(projectId, accessToken, t.token, ev)));
        enviados++;
      } catch (e) {
        // Si falló el envío se libera la clave, para reintentar en la próxima
        // corrida en vez de perder el aviso del día.
        console.error('envío fallido', ev.clave, e);
        await sup('DELETE', `aos_sent?clave=eq.${encodeURIComponent(ev.clave)}`).catch(() => {});
      }
    }

    return ok(`enviados ${enviados}/${eventos.length}`);
  } catch (e) {
    console.error('despachar', e);
    return { statusCode: 500, body: String(e?.message || e) };
  }
};

const ok = (body) => {
  console.log('despachar:', body);
  return { statusCode: 200, body };
};
