# Academic OS — Android desde cualquier lugar (nube)

Publica la app en internet para abrirla desde el teléfono **sin tener la PC encendida** ni estar en la misma WiFi.

---

## Opción recomendada: Render.com (gratis)

### Requisitos
- Cuenta en [render.com](https://render.com) (gratis con GitHub)
- El proyecto en un repositorio de GitHub

### Pasos

#### 1. Sube el proyecto a GitHub

**A) Crea el repositorio en GitHub (obligatorio primero)**
1. Abre [github.com/new](https://github.com/new)
2. Nombre: `academic-os` (exactamente así)
3. **No** añadas README, .gitignore ni licencia
4. Clic en **Create repository**

**B) Sube el código desde PowerShell**

Opción fácil: doble clic en **`SUBIR_GITHUB.bat`**

O manualmente (reemplaza `TU_USUARIO` por tu usuario real, ej. `gerardoark22-ctrl`):

```powershell
cd C:\AcademicOS

# Si origin ya existe con URL incorrecta, corrígela:
git remote set-url origin https://github.com/gerardoark22-ctrl/academic-os.git

# Si no existe origin:
# git remote add origin https://github.com/gerardoark22-ctrl/academic-os.git

git add .
git commit -m "Academic OS"    # si dice "nothing to commit", está bien — ya está guardado

git branch -M main             # renombra master → main (opcional)
git push -u origin main
```

**Errores comunes**

| Error | Solución |
|-------|----------|
| `remote origin already exists` | `git remote set-url origin https://github.com/TU_USUARIO/academic-os.git` |
| `src refspec main does not match any` | Tu rama es `master` → usa `git push -u origin master` o `git branch -M main` |
| `Repository not found` | Crea el repo en github.com/new **antes** del push |
| `nothing to commit` | Normal si ya hiciste commit; sigue con `git push` |

#### 2. Crear servicio en Render
1. Entra a [dashboard.render.com](https://dashboard.render.com)
2. **New +** → **Blueprint** (lee `render.yaml` automáticamente)
3. Conecta tu repositorio de GitHub
4. Confirma el despliegue

#### 3. Variables de entorno
En Render → tu servicio → **Environment**:

| Variable | Valor |
|----------|--------|
| `ACADEMIC_OS_DATA` | `/var/data` |
| `ACADEMIC_OS_CLOUD` | `1` |
| `DEEPSEEK_API_KEY` | tu clave `sk-...` (opcional) |

#### 4. Disco persistente
En **Disks** → Add disk:
- **Mount path:** `/var/data`
- **Size:** 1 GB

Sin esto, los datos se pierden al reiniciar.

#### 5. URL y Android
Tras el deploy tendrás:
```
https://academic-os-xxxx.onrender.com
```

En Android: Chrome → esa URL → **⋮** → **Añadir a pantalla de inicio**

> El plan gratis “duerme” tras inactividad; la primera carga puede tardar ~1 min.

---

## Opción rápida: ngrok (sin subir a GitHub)

1. `python run_web.py` en la PC
2. `ngrok http 8765`
3. Abre la URL `https://xxxx.ngrok-free.app` en el celular

La PC debe estar encendida.

---

## Resumen

| Método | Cualquier red | PC encendida |
|--------|---------------|--------------|
| **Render** | ✅ | ❌ |
| **ngrok** | ✅ | ✅ |
| **WiFi local** | Solo misma red | ✅ |
