@echo off
title Academic OS - Publicar en la nube
echo.
echo  ============================================
echo   PUBLICAR EN LA NUBE (Android desde cualquier lugar)
echo  ============================================
echo.
echo  1. Lee la guia: CLOUD.md
echo  2. Sube el proyecto a GitHub
echo  3. Crea cuenta en https://render.com
echo  4. New + ^> Blueprint ^> conecta tu repo
echo  5. Anade disco en /var/data (1 GB)
echo  6. Variable DEEPSEEK_API_KEY con tu clave
echo.
echo  Tu URL sera algo como: https://academic-os-xxxx.onrender.com
echo  En Android: Chrome ^> URL ^> Anadir a pantalla de inicio
echo.
start "" "%~dp0CLOUD.md"
pause
