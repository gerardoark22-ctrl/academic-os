# Academic OS v2

Aplicación de gestión académica — **Windows** (escritorio) y **Android** (PWA).

## Inicio rápido

| Plataforma | Cómo abrir |
|------------|------------|
| **Windows escritorio** | Doble clic `INICIAR.bat` → opción 1 |
| **Android (móvil)** | `INICIAR_MOVIL.bat` en PC → abrir URL en Chrome → Instalar app |
| **Descargable .exe** | `GENERAR_EXE.bat` → carpeta `dist/` |

Ver guía completa: **[DESCARGAR.md](../DESCARGAR.md)**

## Instalación desarrollo

```powershell
cd academic_os
pip install -r requirements.txt
python main.py          # Escritorio
python run_web.py       # Web + Android
```

## Stack

- Python 3.10+ · CustomTkinter (escritorio) · FastAPI + PWA (móvil)
- SQLite · DeepSeek IA · plyer · matplotlib

## Módulos

| Módulo | Escritorio | Móvil (PWA) |
|--------|------------|-------------|
| Dashboard | ✅ | ✅ |
| Cursos | ✅ | ✅ (ver + dominio) |
| TimeBlocking | ✅ | ✅ |
| Gestor Tareas | ✅ | ✅ |
| Riesgo | ✅ | ✅ |
| Estadísticas | ✅ | — |
| Configuración | ✅ | ✅ |

## Android

1. PC y teléfono en la **misma WiFi**
2. Ejecuta `INICIAR_MOVIL.bat`
3. Chrome → URL mostrada (ej. `http://192.168.x.x:8765`)
4. **Añadir a pantalla de inicio**

## Datos

- `academic_os.db` — se crea automáticamente
- Export/import JSON desde Configuración (escritorio)
