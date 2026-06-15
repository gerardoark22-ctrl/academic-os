@echo off
title Subir Academic OS a GitHub
cd /d "%~dp0"
echo.
echo  PASO A — Crear el repo en GitHub (solo una vez)
echo  -----------------------------------------------
echo  1. Abre: https://github.com/new
echo  2. Nombre del repositorio: academic-os
echo  3. Dejalo PUBLICO o PRIVADO (como quieras)
echo  4. NO marques "Add a README" ni .gitignore
echo  5. Clic en "Create repository"
echo.
pause
echo.
echo  PASO B — Subir codigo desde esta PC
echo  ------------------------------------
set REPO=https://github.com/gerardoark22-ctrl/academic-os.git
git remote set-url origin %REPO% 2>nul
git remote add origin %REPO% 2>nul
git add .
git commit -m "Academic OS" 2>nul
git branch -M main 2>nul
git push -u origin main
if errorlevel 1 (
    echo.
    echo  Si fallo, prueba con la rama master:
    git push -u origin master
)
echo.
pause
