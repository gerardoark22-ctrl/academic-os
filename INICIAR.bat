@echo off
cd /d "%~dp0"
echo.
echo  Academic OS - Elige modo:
echo  [1] Escritorio Windows (app completa)
echo  [2] Web / Android (misma WiFi)
echo  [3] Generar .exe descargable
echo  [4] Publicar en la nube (Android desde cualquier lugar)
echo.
set /p modo="Opcion (1/2/3/4): "
if "%modo%"=="2" goto web
if "%modo%"=="3" goto build
if "%modo%"=="4" goto cloud
goto desktop

:desktop
cd academic_os
python main.py
goto end

:web
call INICIAR_MOVIL.bat
goto end

:build
call GENERAR_EXE.bat
goto end

:cloud
call PUBLICAR_NUBE.bat
goto end

:end
