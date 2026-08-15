# 🏛️ Academic OS: Odyssey of Gerardex

Progressive Web App de gestión académica gamificada para estudiantes de medicina. Estética de la Antigua Grecia con mecánicas de XP, templos, misiones épicas y time blocking.

## Stack

- **React 18+** + TypeScript
- **TailwindCSS** + Framer Motion
- **Zustand** (estado global)
- **Dexie/IndexedDB** (persistencia offline)
- **Vite** + service worker propio (`public/sw.js`, sin vite-plugin-pwa)
- **Netlify Functions + Firebase Cloud Messaging** para las notificaciones push
  (ver [DESPLIEGUE.md](DESPLIEGUE.md))

## Inicio rápido

### Solo PWA (desarrollo)
```bash
cd academic-os
npm install
npm run icons
npm run dev
```
Abre http://localhost:5173

### Full stack (PWA + SQLite backend)
1. Compila la PWA: `npm run build` (desde `academic-os/`)
2. Ejecuta `INICIAR_ODYSSEY_FULL.bat` en la raíz del repo
3. Abre http://localhost:8765 — FastAPI sirve la PWA y la API

### Atajos Windows
| Script | Qué hace |
|--------|----------|
| `INICIAR_ODYSSEY.bat` | Solo frontend Vite (dev) |
| `INICIAR_ODYSSEY_FULL.bat` | Backend Python + PWA compilada |

## Sincronización con Academic OS (Python)

La PWA puede conectarse al backend FastAPI existente:

1. `.env` → `VITE_API_URL=http://localhost:8765`
2. Botón **🔗 Sync** en el header importa cursos, temas y tareas desde SQLite
3. Al completar misiones/bloques, se reflejan en el backend si los IDs vienen de la migración

## Importar datos existentes

El botón **📥** acepta:
- **Backup Gerardex** (formato IndexedDB)
- **Export JSON** de la app Python (`Configuración → Exportar JSON`)

El migrador convierte automáticamente dominios, prioridades y estructura de cursos.

## Módulos

| Módulo | Descripción |
|--------|-------------|
| **Ágora** | Dashboard con Gerardex, templos, misiones, barra de Ira |
| **Biblioteca** | Cursos → Unidades → Temas con escalas de dominio |
| **Misiones** | Tablero épico de tareas y exámenes |
| **Reloj de Sol** | Time blocking vertical con drag & drop |

## Gamificación

- **Gerardex**: avatar 8-bit que evoluciona en 5 etapas (Aprendiz → Leyenda)
- **XP**: temas (+50), unidades (+200), cursos (+500), misiones (+100), bloques (+25)
- **Dominio**: Mortal → Héroe → Semidiós → Dios → Titán
- **Templos**: cada curso construye un templo conforme avanzas
- **Ira de los Dioses**: barra de riesgo de reprobar
- **Inframundo**: contador de días sin estudiar

## Persistencia

Los datos se guardan en **IndexedDB** (`AcademicOsDB`) con auto-save cada 30 segundos. Usa el botón 💾 en el header para exportar un backup JSON.

## PWA / Offline

Tras la primera carga, la app funciona **100% offline**. El service worker cachea assets estáticos y fuentes de Google.

## Datos de ejemplo

Al primer arranque se cargan 2 cursos (Cardiología, Anatomía) con misiones y bloques de tiempo de demostración.

## Estructura

```
academic-os/
├── public/          manifest, iconos
├── src/
│   ├── components/  gerardex, temple, missions, timeblocking, ui
│   ├── stores/      player, courses, missions, time
│   ├── utils/       gamification, notifications, db
│   └── hooks/       useAppInit, useNotifications
└── package.json
```

## Migración desde Academic OS (Python)

Esta PWA es independiente del backend Python/SQLite existente. Para migrar datos:

1. Exporta JSON desde la app Python (Configuración → Exportar)
2. Adapta el formato al esquema IndexedDB (ver `src/utils/db.ts`)
3. Importa via el botón de backup (próximamente: import directo)

---

⚡ **¡Construye tu Olimpo del Conocimiento!**
