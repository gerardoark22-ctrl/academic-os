# Academic OS en Render — Starter (~$7/mes)

Guía para tener la app **siempre disponible** en Android (cualquier red, laptop apagada) con **datos guardados**.

**Costo:** ~$7.25/mes (Starter $7 + disco 1 GB $0.25)

---

## Antes de empezar

- [ ] Código en GitHub (`SUBIR_GITHUB.bat`)
- [ ] Cuenta en [render.com](https://render.com) con tarjeta (pide verificación $1, se devuelve)
- [ ] Plan workspace: **Hobby** (gratis, suficiente)

---

## Paso 1 — Crear el servicio

1. [dashboard.render.com](https://dashboard.render.com) → **New +**
2. Elige **Blueprint** (recomendado — lee `render.yaml` del repo)
   - O **Web Service** manual si prefieres
3. Conecta GitHub → repo **`academic-os`**
4. Render detectará `render.yaml` con plan **starter** y disco

Si creas **Web Service** manual:

| Campo | Valor |
|-------|--------|
| Name | `academic-os` |
| Region | Oregon (o el más cercano) |
| Branch | `main` o `master` |
| Runtime | **Docker** |
| Instance type | **Starter** ($7/mes) |
| Health Check Path | `/api/health` |

---

## Paso 2 — Variables de entorno

En el servicio → **Environment**:

| Variable | Valor |
|----------|--------|
| `ACADEMIC_OS_DATA` | `/var/data` |
| `ACADEMIC_OS_CLOUD` | `1` |
| `DEEPSEEK_API_KEY` | `sk-tu-clave` (opcional) |

---

## Paso 3 — Disco persistente

En el servicio → **Disks** → **Add disk**:

| Campo | Valor |
|-------|--------|
| Name | `academic-data` |
| Mount path | `/var/data` |
| Size | `1` GB |

> Si usaste Blueprint, el disco puede crearse solo. Verifica que exista.

---

## Paso 4 — Desplegar

1. Clic **Create** / **Apply**
2. Espera 5–15 min (primera vez compila Docker)
3. Estado **Live** = listo
4. Tu URL: `https://academic-os-xxxx.onrender.com`

---

## Paso 5 — Android

1. Chrome en el teléfono → abre tu URL de Render
2. Menú **⋮** → **Añadir a pantalla de inicio**
3. Usa la app como nativa desde cualquier red

---

## Qué obtienes con Starter

| | |
|---|---|
| Laptop apagada | ✅ Funciona |
| Cualquier WiFi / 4G | ✅ |
| Datos guardados | ✅ (disco en `/var/data`) |
| Duerme por inactividad | ❌ No (a diferencia del plan Free) |
| Costo | ~$7.25/mes |

---

## Actualizar la app

Cada `git push` a GitHub redeploya automáticamente:

```powershell
cd C:\AcademicOS
git add .
git commit -m "Actualizacion"
git push
```

---

## Problemas comunes

**Build falla**  
Revisa **Logs** en Render. Suele ser timeout en Docker la primera vez — reintenta Deploy.

**La app abre pero sin datos**  
Comprueba que `ACADEMIC_OS_DATA` = `/var/data` y que el disco está montado en esa ruta.

**Quiero bajar a Free**  
Cambia instance a Free en Settings, pero **pierdes el disco** y los datos no persisten.

---

## Comparación con Cloudflare (gratis)

| | Render Starter | Cloudflare (`INICIAR_INTERNET.bat`) |
|---|---|---|
| Precio | ~$7/mes | $0 |
| PC encendida | No necesaria | Sí |
| URL fija | ✅ | Cambia cada vez |

Puedes usar **ambos**: Render para el día a día en el móvil, escritorio en Windows para edición intensa.

---

## Notificaciones push (app cerrada)

El proceso FastAPI está vivo 24/7 en Starter, así que el scheduler vive **dentro**
del servidor (`academic_os/api/push.py`, tick cada 60 s, hora de Perú UTC-5).
No hace falta cron, GitHub Actions ni pings.

**Claves VAPID.** Si no defines nada, el servidor genera el par al primer
`GET /api/push/public-key` y lo guarda en la BD del disco `/var/data`
(sobrevive reinicios y deploys). Para fijarlas tú:

```bash
python -c "import base64;from cryptography.hazmat.primitives.asymmetric import ec;from cryptography.hazmat.primitives import serialization;k=ec.generate_private_key(ec.SECP256R1());b=lambda x:base64.urlsafe_b64encode(x).decode().rstrip('=');print('VAPID_PRIVATE_KEY=',b(k.private_numbers().private_value.to_bytes(32,'big')));print('VAPID_PUBLIC_KEY=',b(k.public_key().public_bytes(serialization.Encoding.X962,serialization.PublicFormat.UncompressedPoint)))"
```

Env vars opcionales en Render: `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY` y
`ACADEMICOS_OWNER_EMAIL` (va en el claim `sub:` del VAPID).
⚠️ Cambiar las claves invalida las suscripciones ya registradas: hay que volver
a pulsar "Activar en este dispositivo" en Configuración.

**Probar sin esperar a las 7am**

1. Abre la PWA en el Android (instalada, HTTPS), Configuración → 🔔 Notificaciones
   push → *Activar en este dispositivo* → acepta el permiso.
2. Cierra la app del todo.
3. `curl -X POST https://<tu-app>.onrender.com/api/push/test`
   (o el botón *Enviar push de prueba* desde otro dispositivo).
4. `GET /api/push/status` muestra suscripciones, snapshot del día y avisos ya
   enviados hoy.
