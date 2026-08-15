# Academic OS — Usarlo en el celular y sincronizar con la laptop

## Cómo funciona (importante entender esto)

La app guarda tus datos **dentro del navegador** de cada dispositivo
(IndexedDB). Por eso funciona sin internet. La consecuencia: el celular y la
laptop tienen **cada uno su propia copia**.

Para unirlas, el servidor de tu PC guarda un **estado compartido**: cada equipo
sube el suyo cuando cambia algo y baja el del otro cuando entra. El botón ☁️
arriba a la derecha muestra cómo va:

| Ícono | Significado |
|-------|-------------|
| ☁️ | Sincronizado |
| ⏳ | Sincronizando |
| 📴 | Sin conexión al servidor — sigues trabajando, sube cuando vuelva |
| ⚠️ | Editaste en los dos equipos: tócalo y elige cuál gana |
| ❌ | Error (normalmente token incorrecto) |

Sincroniza solo cuando **la PC está encendida** con `INICIAR_INTERNET.bat`
abierto. Sin eso el celular funciona igual, pero guarda los cambios para
después.

---

## Paso a paso (2 minutos)

1. Doble clic en **`INICIAR_INTERNET.bat`**
2. Espera la línea `https://xxxx.trycloudflare.com`
3. Abre esa URL en **Chrome** del Android
4. Menú **⋮** → **Añadir a pantalla de inicio**
5. Toca el botón **☁️** arriba a la derecha → **"Conectar con tu correo"**
6. Pon tu correo (`gerardoark22@gmail.com`) → te llega un código de 6 dígitos
   → escríbelo → listo, conectado

El código vence en 5 minutos y sirve una sola vez. Una vez conectado, ese
navegador queda recordado — no vuelves a pedir código salvo que borres los
datos del navegador o toques "Desconectar" en el mismo botón ☁️.

Solo tu correo (`ACADEMICOS_OWNER_EMAIL` en el `.env`) puede pedir códigos;
cualquier otro correo lo rechaza sin enviar nada.

### ⚠️ La URL gratuita cambia cada vez

`trycloudflare.com` te da una dirección distinta en cada arranque. Para el
navegador, una URL nueva es **otro sitio**: aparecerá vacío al entrar. No
perdiste nada — al entrar con `?t=TU_TOKEN` la app baja todo del servidor.

Si te molesta repetirlo, con una cuenta gratuita de Cloudflare se puede crear
un túnel con nombre fijo (requiere un dominio propio). No está configurado acá.

---

## Tu token

El botón ☁️ lo consigue solo, pidiéndolo con tu correo — no necesitas copiarlo
a mano. Igual vive en `academic_os/.env`, línea `ACADEMICOS_TOKEN=`, por si
algún día necesitas verlo. Sirve para que alguien que adivine tu URL no pueda
leer ni borrar tus datos.

Si borras esa línea, la API deja de pedir token (cómodo en tu WiFi, **no**
recomendado con el túnel abierto).

---

## Dónde están tus datos realmente

| Lugar | Qué guarda |
|-------|-----------|
| Navegador del celular | Tu copia local (funciona offline) |
| Navegador de la laptop | Su propia copia local |
| `academic_os.db` en la PC | El estado compartido que une a las dos |

**Haz backup igual.** El botón 💾 exporta un JSON. Si formateas la PC o borras
los datos del navegador, es lo único que te salva.

---

## Otras opciones

### Misma WiFi, sin túnel
`INICIAR_MOVIL.bat` → abre `http://192.168.x.x:8765` en el celular. Solo
funciona en tu casa, pero la URL no cambia (mientras el router te dé la misma
IP), así que el navegador conserva los datos.

### Render (nube, PC apagada)
El plan gratis **no** tiene disco persistente: los datos del servidor se borran
en cada reinicio. `render.yaml` está configurado con plan **Starter (de pago)**.
Si lo despliegas como *Blueprint*, Render aplicará ese plan de pago — no el
gratuito. Para uso real con la PC encendida, quédate con Cloudflare.

---

## Si algo falla

**El servidor no arranca / se cierra solo**
Versiones incompatibles de FastAPI. Ejecuta:
`pip install -U "fastapi>=0.115" "uvicorn[standard]>=0.27"`

**El botón ☁️ sale ❌**
Token vencido o inválido. Tócalo, "Desconectar", y vuelve a conectar con tu
correo.

**No te llega el código al correo**
Revisa `ACADEMICOS_SMTP_PASS` en `academic_os/.env` — Gmail necesita una
"contraseña de aplicación" (no tu contraseña normal), se genera en
myaccount.google.com/apppasswords. Si ya tenías una y dejó de funcionar,
puede haber sido revocada: genera una nueva.

**El botón ☁️ sale 📴**
La PC está apagada, suspendida, o cerraste la ventana del túnel.

**Sale ⚠️ (conflicto)**
Editaste en los dos equipos sin sincronizar. Tócalo y elige cuál conserva. Lo
descartado queda respaldado en el servidor (`odyssey_state_prev`).

**Quiero comprobar que el sync funciona**
`cd academic_os` y `python test_sync.py` — usa una base de prueba aparte.
