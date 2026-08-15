@echo off
title Academic OS - Internet GRATIS (Cloudflare)
cd /d "%~dp0academic_os"

echo.
echo  ============================================
echo   ACADEMIC OS - URL publica GRATIS
echo   (Cloudflare Tunnel - sin pagar nada)
echo  ============================================
echo.

pip install -q "fastapi>=0.115" "uvicorn[standard]>=0.27" 2>nul

where cloudflared >nul 2>&1
if not errorlevel 1 goto tunel_ok

echo  Instalando cloudflared, solo la primera vez...
winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
if not errorlevel 1 goto tunel_ok

echo.
echo  No se pudo instalar automaticamente.
echo  Descarga manual: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
pause
exit /b 1

:tunel_ok

echo  Iniciando servidor local...
start "AcademicOS-Server" /min cmd /c "cd /d %~dp0academic_os && python run_web.py"
timeout /t 4 /nobreak >nul

echo.
echo  Creando tunel hacia internet...
echo  ----------------------------------------
echo  BUSCA abajo una linea como:
echo    https://algo-random.trycloudflare.com
echo.
echo  1. Abre esa URL en Chrome del Android
echo  2. Menu - Anadir a pantalla de inicio
echo  3. Toca el boton de la nube (arriba a la derecha)
echo     y conecta con tu correo (te llega un codigo)
echo.
echo  IMPORTANTE: Deja esta ventana ABIERTA
echo  y la PC encendida mientras uses la app.
echo.
echo  OJO: esta URL gratuita CAMBIA cada vez que
echo  reinicias el tunel. Tus datos no se pierden:
echo  quedan en la PC, y al entrar con tu correo
echo  el celular los vuelve a bajar.
echo  ----------------------------------------
echo.

cloudflared tunnel --url http://localhost:8765
