@echo off
title Academic OS - Android desde cualquier lugar
echo.
echo  ============================================
echo   GRATIS - Elige como quieres conectar
echo  ============================================
echo.
echo  [1] Internet GRATIS (Cloudflare)  RECOMENDADO
echo      URL publica, datos en tu PC, PC encendida
echo.
echo  [2] Solo misma WiFi (mas simple)
echo      INICIAR_MOVIL.bat
echo.
echo  [3] Ver guia completa (CLOUD.md)
echo  [4] Render Starter ~7 USD/mes (PC apagada)
echo.
set /p op="Opcion (1/2/3/4): "
if "%op%"=="2" (
    call "%~dp0INICIAR_MOVIL.bat"
    goto end
)
if "%op%"=="3" (
    start "" "%~dp0CLOUD.md"
    goto end
)
if "%op%"=="4" (
    call "%~dp0RENDER_STARTER.bat"
    goto end
)
call "%~dp0INICIAR_INTERNET.bat"
:end
