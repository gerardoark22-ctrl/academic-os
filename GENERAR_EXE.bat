@echo off
title Generar Academic OS .exe
cd /d "%~dp0academic_os"
echo.
echo  Compilando (10-15 min la primera vez)...
echo.
pip install -r requirements.txt -q
pip install pyinstaller -q
python build_exe.py
echo.
dir /b "%~dp0dist\*.exe" 2>nul
if errorlevel 1 (
    echo  Si no ves .exe arriba, revisa errores en la ventana.
) else (
    echo.
    echo  Los .exe estan en: %~dp0dist\
)
explorer "%~dp0dist"
pause
