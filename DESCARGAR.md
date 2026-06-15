# Academic OS — Guía de descarga e instalación

## Windows (escritorio)

### Opción rápida (sin compilar)
1. Doble clic en **`INICIAR.bat`** → opción **1** (Escritorio)

### Opción descargable (.exe)
1. Doble clic en **`GENERAR_EXE.bat`**
2. Espera a que termine (5–10 min la primera vez)
3. En la carpeta **`dist/`** encontrarás:
   - **`AcademicOS-Escritorio.exe`** — app completa de escritorio
   - **`AcademicOS-Web.exe`** — servidor para usar en PC y Android

Puedes copiar esos `.exe` a otra PC o compartirlos en un USB.

---

## Android (teléfono / tablet)

CustomTkinter **no funciona en Android**. La versión móvil es una **app web instalable (PWA)**.

### Paso 1 — Inicia el servidor en tu PC
- Doble clic en **`INICIAR_MOVIL.bat`**  
  o **`INICIAR.bat`** → opción **2**

Verás algo como:
```
Android: http://192.168.1.50:8765
```

### Paso 2 — Conecta el teléfono
1. El teléfono debe estar en la **misma red WiFi** que la PC
2. Abre **Chrome** en Android
3. Escribe la URL que muestra la consola (ej. `http://192.168.1.50:8765`)

### Paso 3 — Instalar como app
1. En Chrome: menú **⋮** (tres puntos)
2. Toca **“Añadir a pantalla de inicio”** o **“Instalar app”**
3. Confirma → aparece el icono 📚 en tu pantalla de inicio

¡Listo! Funciona como una app nativa (pantalla completa, sin barra del navegador).

### Firewall de Windows
Si el teléfono no conecta, permite el puerto **8765** en el firewall o desactiva temporalmente el firewall privado para probar.

---

## Resumen de archivos

| Archivo | Uso |
|---------|-----|
| `INICIAR.bat` | Menú: escritorio / web / generar exe |
| `INICIAR_MOVIL.bat` | Solo modo web + Android |
| `GENERAR_EXE.bat` | Crear `.exe` descargables |
| `dist/AcademicOS-Escritorio.exe` | App Windows portable |
| `dist/AcademicOS-Web.exe` | Servidor web + PWA |

---

## Datos
- La base de datos `academic_os.db` se guarda junto a la app
- PC escritorio y modo web **comparten los mismos datos** si usas la misma carpeta

## Requisitos
- Python 3.10+ (solo si no usas el .exe)
- Android: Chrome 80+
