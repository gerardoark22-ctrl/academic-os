@echo off
title Academic OS - Render Starter (~7 USD/mes)
echo.
echo  ============================================
echo   RENDER STARTER - Guia de despliegue
echo   ~7 USD/mes + disco (datos guardados)
echo  ============================================
echo.
echo  Requisitos:
echo   [1] Codigo en GitHub (SUBIR_GITHUB.bat)
echo   [2] Cuenta en render.com con tarjeta
echo.
echo  En Render:
echo   - New + ^> Blueprint ^> repo academic-os
echo   - O Web Service + Docker + Instance STARTER
echo   - Disco: /var/data  1 GB
echo   - Variables: ACADEMIC_OS_DATA=/var/data
echo                ACADEMIC_OS_CLOUD=1
echo.
start "" "%~dp0RENDER_STARTER.md"
start https://dashboard.render.com
pause
