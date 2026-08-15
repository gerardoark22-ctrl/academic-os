@echo off
cd /d "%~dp0"
echo.
echo  Academic OS - Elige modo:
echo  [1] Escritorio Windows (app completa)
echo  [2] Web / Android (misma WiFi)
echo  [3] Generar .exe descargable
echo  [4] Android desde cualquier lugar
echo      [A] GRATIS - Cloudflare (PC encendida)
echo      [B] Render ~7 USD/mes (PC apagada, datos guardados)
echo.
set /p modo="Opcion (1/2/3/4): "
if "%modo%"=="2" goto web
if "%modo%"=="3" goto build
if "%modo%"=="4" goto remoto
goto desktop

:desktop
if exist "%~dp0dist\app.exe" (
    start "" "%~dp0dist\app.exe"
    goto end
)
if exist "%~dp0dist\AcademicOS-Escritorio.exe" (
    start "" "%~dp0dist\AcademicOS-Escritorio.exe"
    goto end
)
cd academic_os
python main.py
goto end

:web
call INICIAR_MOVIL.bat
goto end

:build
call GENERAR_EXE.bat
goto end

:remoto
echo.
echo  [A] Gratis - Cloudflare
echo  [B] Render Starter ~7 USD/mes
set /p sub="Elige A o B: "
if /i "%sub%"=="B" (
    call RENDER_STARTER.bat
    goto end
)
call PUBLICAR_NUBE.bat
goto end

:cloud
call PUBLICAR_NUBE.bat
goto end

:end
