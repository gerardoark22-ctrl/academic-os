@echo off
title Academic OS - Modo Web (Android + PC)
cd /d "%~dp0academic_os"
echo Instalando dependencias web si faltan...
pip install -q fastapi "uvicorn[standard]" 2>nul
python run_web.py
pause
