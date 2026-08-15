@echo off
title Academic OS - Odyssey (Full Stack)
echo.
echo  ========================================
echo   ACADEMIC OS: ODYSSEY OF GERARDEX
echo   Backend SQLite + PWA React
echo  ========================================
echo.

set "NODE=C:\Program Files\nodejs\npm.cmd"
if not exist "%NODE%" (
    where npm >nul 2>&1 || (
        echo [ERROR] Node.js no encontrado. Ejecuta INICIAR_ODYSSEY.bat primero.
        pause
        exit /b 1
    )
)

cd /d "%~dp0academic-os"

if not exist "node_modules" (
    echo Instalando dependencias frontend...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install fallo.
        pause
        exit /b 1
    )
)

echo.
echo  Compilando version FINAL de la PWA (siempre actualiza dist/)...
echo  Esto tarda ~1 minuto la primera vez.
echo.
call npm run icons 2>nul
call npm run build
if errorlevel 1 (
    echo.
    echo [ERROR] La compilacion fallo. Revisa errores arriba.
    pause
    exit /b 1
)

cd /d "%~dp0"

echo.
echo  ========================================
echo   Listo. Servidor en http://localhost:8765
echo   Si ves version vieja: Ctrl+Shift+R
echo   o borra datos del sitio en el navegador.
echo  ========================================
echo.
start "" "http://localhost:8765"
python main_web.py
