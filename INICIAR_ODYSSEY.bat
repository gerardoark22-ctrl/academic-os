@echo off
title Academic OS - Odyssey of Gerardex
echo.
echo  ========================================
echo   ACADEMIC OS: ODYSSEY OF GERARDEX
echo  ========================================
echo.

where npm >nul 2>&1
if %errorlevel% neq 0 (
    set "PATH=C:\Program Files\nodejs;%PATH%"
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js/npm no encontrado.
    echo Instala Node.js desde https://nodejs.org
    pause
    exit /b 1
)

cd /d "%~dp0academic-os"

if not exist "node_modules" (
    echo Instalando dependencias...
    call npm install
)

if not exist "public\icons\gerardex-192.png" (
    echo Generando iconos PWA...
    call npm run icons
)

echo Iniciando Odyssey (desarrollo)...
echo.
echo  URL: http://localhost:5173
echo  Si ves numeros viejos de XP: Ctrl+Shift+R (cache).
echo  Uso diario recomendado — recarga al guardar cambios.
echo  Produccion local + API: INICIAR_ODYSSEY_FULL.bat
echo.
start "" "http://localhost:5173"
call npm run dev
