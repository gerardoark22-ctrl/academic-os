/**
 * Prueba manual: abre https://TU-SITIO.netlify.app/.netlify/functions/probar
 * en el navegador y debería llegarte un push al celular en segundos.
 * Sin antideduplicado a propósito: es para probar cuantas veces haga falta.
 */

const { tokenDeAcceso, enviarFCM, supaClient } = require('./lib/fcm');
const { limaNow } = require('./lib/plan');

exports.handler = async () => {
  try {
    const tokens = await supaClient()('GET', 'aos_push_subs?select=token');
    if (!tokens.length) return { statusCode: 200, body: 'No hay ningún token: activa el push en la app primero.' };

    const accessToken = await tokenDeAcceso();
    const projectId = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT).project_id;
    const ahora = limaNow(Date.now());

    await Promise.all(
      tokens.map((t) =>
        enviarFCM(projectId, accessToken, t.token, {
          title: '🔔 Prueba de Academic OS',
          body: `Si ves esto con la app cerrada, el push funciona. Son las ${ahora.hhmm} en Lima.`,
        }),
      ),
    );
    return { statusCode: 200, body: `Enviado a ${tokens.length} dispositivo(s). Revisa el celular.` };
  } catch (e) {
    console.error('probar', e);
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
