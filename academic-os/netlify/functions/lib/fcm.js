/**
 * Envío a FCM v1 sin librerías: el access_token de Google se saca firmando un
 * JWT con la llave privada del service account usando el módulo `crypto` de
 * Node. Es exactamente lo que hace firebase-admin por dentro. Copiado de
 * NoMimir, donde ya está probado en producción.
 */

const crypto = require('crypto');

const base64url = (s) => Buffer.from(s).toString('base64url');

async function tokenDeAcceso() {
  const cuenta = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  const ahora = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: cuenta.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: ahora,
      exp: ahora + 3600,
    }),
  );
  const firma = crypto
    .createSign('RSA-SHA256')
    .update(`${header}.${claims}`)
    .sign(cuenta.private_key, 'base64url');
  const jwt = `${header}.${claims}.${firma}`;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  });
  const data = await r.json();
  if (!data.access_token) throw new Error('No se pudo obtener access_token: ' + JSON.stringify(data));
  return data.access_token;
}

async function enviarFCM(projectId, accessToken, token, { title, body }) {
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        // Urgency alta: sin esto Android puede retener el push (Doze/ahorro de
        // batería) hasta que se abra la app, en vez de despertarla al toque.
        webpush: { headers: { Urgency: 'high' } },
        android: { priority: 'high' },
      },
    }),
  });
  if (!r.ok) throw new Error(`FCM ${r.status}: ${await r.text()}`);
}

/** Cliente REST de Supabase con la llave service_role (se salta RLS). */
function supaClient() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  return async function sup(method, path, body) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'content-type': 'application/json',
        prefer: 'return=representation,resolution=ignore-duplicates',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error(`Supabase ${path}: ${r.status} ${await r.text()}`);
    const texto = await r.text();
    return texto ? JSON.parse(texto) : [];
  };
}

module.exports = { tokenDeAcceso, enviarFCM, supaClient };
