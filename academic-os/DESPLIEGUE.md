# Cómo poner Academic OS en internet con notificaciones

Guía para hacerlo paso a paso sin saber programar. Son 6 pasos y toma ~30 minutos
la primera vez. Al final vas a tener la app en una dirección web, instalable en el
celular, mandándote notificaciones aunque la tengas cerrada.

**Cómo funciona, en una frase:** la app vive en tu celular, sube cada rato un
resumen de tu día a Supabase (una base de datos gratis), y un robot en Netlify
revisa ese resumen cada 5 minutos y te manda la notificación por Firebase (el
mismo canal por el que te llegan los mensajes de WhatsApp).

---

## Paso 1 — Registrar la app en Firebase

Vas a reusar el proyecto que ya tienes de NoMimir. No se toca nada de NoMimir:
solo se agrega otra "app web" adentro.

1. Entra a https://console.firebase.google.com y abre el proyecto **nomimir-ff0ef**.
2. Arriba a la izquierda, la rueda ⚙️ → **Project settings**.
3. Baja hasta **Your apps** y pulsa el ícono **`</>`** (Web).
4. Nombre de la app: `Academic OS`. **No** marques Firebase Hosting. Pulsa **Register app**.
5. Te muestra un bloque de código con un `firebaseConfig`. **No cierres esa pantalla**:
   de ahí salen dos valores que vas a necesitar en el paso 5:
   - `apiKey` → empieza con `AIza...`
   - `appId` → algo tipo `1:735184722544:web:xxxxxxxx`

   (`projectId`, `authDomain` y `messagingSenderId` son los mismos de NoMimir y ya
   están escritos más abajo en esta guía.)

### La llave VAPID

1. Sigue en **Project settings** → pestaña **Cloud Messaging**.
2. Sección **Web configuration** → **Web Push certificates**.
3. Si ya hay un par de llaves, copia el texto de la columna **Key pair**. Si no hay,
   pulsa **Generate key pair** y copia lo que aparece.
4. Es una cadena larga que empieza con `B...`. Esa es tu `VITE_FIREBASE_VAPID_KEY`.

> Puedes usar la misma llave VAPID de NoMimir sin problema: es del proyecto, no de la app.

### El "service account" (la llave secreta del servidor)

1. **Project settings** → pestaña **Service accounts**.
2. Pulsa **Generate new private key** → **Generate key**. Se descarga un archivo `.json`.
3. Ábrelo con el Bloc de notas y **copia todo el contenido**, desde la primera `{`
   hasta la última `}`. Eso completo es el valor de `FIREBASE_SERVICE_ACCOUNT`.
4. ⚠️ Esta llave es **secreta de verdad**. No la pegues en ningún archivo del
   proyecto, no la subas a GitHub, no se la mandes a nadie. Solo va en Netlify.

---

## Paso 2 — Crear las tablas en Supabase

1. Entra a https://supabase.com y abre tu proyecto (`ytfpvmnxchkwiujphxeb`).
2. Menú izquierdo → **SQL Editor** → **New query**.
3. Abre el archivo `supabase_schema.sql` de este proyecto, copia **todo** y pégalo ahí.
4. Pulsa **Run**. Debe decir "Success".

Eso crea 3 tablas nuevas (`aos_snapshot`, `aos_push_subs`, `aos_sent`). Todas empiezan
con `aos_` y no tocan nada de NoMimir.

### Las dos llaves de Supabase

Menú izquierdo → **Project Settings** (rueda ⚙️) → **API**:

- **Project URL** → `https://ytfpvmnxchkwiujphxeb.supabase.co` (ya lo sabes, es público).
- **anon / public** → llave larga que empieza con `eyJ...`. Es **pública**, se puede
  exponer en el navegador. Va en `VITE_SUPABASE_ANON_KEY`.
- **service_role** → otra llave `eyJ...` marcada como secreta. ⚠️ **Esta sí es secreta**:
  solo va en Netlify, en `SUPABASE_SERVICE_ROLE_KEY`. Nunca en el navegador.

---

## Paso 3 — Subir el código a GitHub

Si ya está en GitHub, salta al paso 4.

1. Crea una cuenta en https://github.com si no tienes.
2. Crea un repositorio nuevo (puede ser privado).
3. Sube la carpeta `academic-os` siguiendo las instrucciones que te da GitHub en pantalla.

---

## Paso 4 — Conectar el repo a Netlify

1. Entra a https://app.netlify.com y crea la cuenta (gratis, con el mismo GitHub).
2. **Add new site** → **Import an existing project** → **GitHub** → elige tu repositorio.
3. Netlify te va a preguntar por la configuración de build. Ponle:
   - **Base directory**: `academic-os` (solo si el repo tiene la carpeta `academic-os` adentro;
     si el repo ES la carpeta, déjalo vacío)
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`

   (Estos tres ya están en el archivo `netlify.toml`, así que normalmente los detecta solo.)
4. **No pulses Deploy todavía** → primero pulsa **Add environment variables** (o hazlo
   después en Site configuration → Environment variables) y sigue el paso 5.

---

## Paso 5 — Las variables de entorno

En Netlify: **Site configuration** → **Environment variables** → **Add a variable** →
una por una. Cópialas exactamente como están escritas (mayúsculas incluidas).

### Públicas (las usa el navegador)

| Variable | Valor | De dónde sale |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | `AIza...` | Firebase → Project settings → tu app web Academic OS → `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `nomimir-ff0ef.firebaseapp.com` | ya es este, cópialo tal cual |
| `VITE_FIREBASE_PROJECT_ID` | `nomimir-ff0ef` | ya es este, cópialo tal cual |
| `VITE_FIREBASE_SENDER_ID` | `735184722544` | ya es este, cópialo tal cual |
| `VITE_FIREBASE_APP_ID` | `1:735184722544:web:...` | Firebase → tu app web Academic OS → `appId` |
| `VITE_FIREBASE_VAPID_KEY` | `B...` | Firebase → Cloud Messaging → Web Push certificates |
| `VITE_SUPABASE_URL` | `https://ytfpvmnxchkwiujphxeb.supabase.co` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Supabase → Project Settings → API → **anon public** |

### Secretas (las usa solo el servidor)

| Variable | Valor | De dónde sale |
|---|---|---|
| `SUPABASE_URL` | `https://ytfpvmnxchkwiujphxeb.supabase.co` | la misma URL de arriba |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase → Project Settings → API → **service_role** ⚠️ secreta |
| `FIREBASE_SERVICE_ACCOUNT` | `{ "type": "service_account", ... }` | el archivo `.json` completo del paso 1 ⚠️ secreta |

> Si te equivocaste en alguna, la corriges y pulsas **Deploys → Trigger deploy → Deploy site**
> para que el cambio agarre. Las `VITE_*` solo se aplican al volver a hacer build.

Ahora sí: **Deploy site**. En 1-2 minutos te da una dirección tipo
`https://algo-random-123.netlify.app`. Esa es tu app.

---

## Paso 6 — Instalar en el celular y activar el push

1. Abre esa dirección en **Chrome del celular** (no en el navegador de Samsung).
2. Menú de los 3 puntitos → **Instalar aplicación** / **Agregar a pantalla de inicio**.
3. Ábrela desde el ícono nuevo (no desde el navegador).
4. Adentro: ⚙️ **Configuración** → sección **🔔 Notificaciones push** → botón **Activar push**.
5. Android te va a preguntar si permites notificaciones → **Permitir**.
6. Debe decir "✅ Push activado en este dispositivo".

### Probar que llega

Abre en cualquier navegador:

```
https://TU-SITIO.netlify.app/.netlify/functions/probar
```

(reemplaza `TU-SITIO` por el nombre real de tu sitio). En pantalla debe decir
"Enviado a 1 dispositivo(s)" y en unos segundos te llega la notificación al celular.

**Prueba de verdad:** cierra la app del todo (deslízala fuera de las recientes),
bloquea la pantalla, y vuelve a abrir esa dirección desde otro dispositivo. Si llega
igual, ya está: el push funciona con la app cerrada.

**Prueba del horario:** en ⚙️ Configuración pon el "Briefing matutino" 5 minutos
adelantado a la hora actual, guarda, y espera. El robot revisa cada 5 minutos, así
que puede tardar hasta 5 minutos extra en salir. Después devuelve la hora a 07:00.

---

## Si algo no llega

Revisa en este orden:

1. **En la app**: ⚙️ Configuración → **Diagnóstico**. Te dice exactamente qué falta
   (permiso, service worker, snapshot).
2. **¿Hay token?** Supabase → **Table Editor** → tabla `aos_push_subs`. Tiene que haber
   al menos una fila. Si está vacía, el "Activar push" falló.
3. **¿Hay snapshot?** Tabla `aos_snapshot`: debe haber una fila con la fecha de hoy y
   la columna `days` llena. Si está vieja, abre la app un momento para que se actualice.
4. **¿Qué está haciendo el robot?** Netlify → **Logs** → **Functions** → `despachar`.
   Ahí ves cada corrida y qué decidió ("nada que enviar", "enviados 1/1", o el error).
5. **¿Se mandó y no lo viste?** Tabla `aos_sent`: si la clave del día ya está ahí, el
   sistema cree que ya lo mandó. Borra esa fila para que se reintente.

Un detalle de Android: el push llega igual con la app cerrada, pero si pones el celular
en "ahorro de batería extremo" Android puede retrasar la entrega unos minutos. No la
mata como pasaba con las alarmas locales, solo la demora.

---

## Qué te va a llegar (5-8 avisos al día)

| Cuándo | Qué dice |
|---|---|
| 07:00 (configurable) | Briefing: qué vence hoy, cuántos bloques, examen cercano |
| Al empezar cada bloque | "▶️ Arranca [bloque]" |
| Al terminar cada bloque | "⏱️ ¿Completaste [bloque]?" |
| 13:00 | Misiones vencidas — el tono se pone peor mientras más días de atraso |
| 09:00 | Examen a 7 días o menos (uno por día) |
| 22:00 (configurable) | Cierre: qué quedó sin marcar y qué arrastras a mañana |

Las horas del briefing y del cierre se cambian en ⚙️ Configuración, en hora de Perú.

---

## Para el que toque el código después

- `netlify/functions/despachar.js` — el robot de cada 5 minutos (cron en `netlify.toml`).
- `netlify/functions/lib/plan.js` — hora de Lima, los 6 disparadores y los textos.
- `netlify/functions/lib/fcm.js` — el JWT de Google firmado con `crypto`, sin librerías.
- `src/utils/push.ts` — permiso, token de FCM y subida del snapshot.
- `public/sw.js` — service worker: recibe el push y hace instalable la PWA.
- `npm run check` — prueba la conversión Lima↔UTC y el antideduplicado sin tocar la red.
  Córrelo antes de tocar horarios o claves de envío.
