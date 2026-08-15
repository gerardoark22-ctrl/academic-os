@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo  ========================================
echo   DESBLOQUEAR edicion - Academic OS
echo  ========================================
echo.

if exist "%~dp0CODEBASE.FROZEN" del /f /q "%~dp0CODEBASE.FROZEN"
echo Marcador CODEBASE.FROZEN eliminado.

echo Quitando solo lectura en academic-os\src ...
attrib -R /S /D "%~dp0academic-os\src\*" >nul 2>&1

echo Quitando solo lectura en configs ...
for %%F in (
  "%~dp0academic-os\package.json"
  "%~dp0academic-os\package-lock.json"
  "%~dp0academic-os\vite.config.ts"
  "%~dp0academic-os\tsconfig.json"
  "%~dp0academic-os\tsconfig.app.json"
  "%~dp0academic-os\tsconfig.node.json"
  "%~dp0academic-os\tailwind.config.js"
  "%~dp0academic-os\postcss.config.js"
  "%~dp0academic-os\index.html"
) do if exist %%F attrib -R %%F >nul 2>&1

for %%F in ("%~dp0*.bat" "%~dp0Dockerfile" "%~dp0CLOUD.md") do if exist %%F attrib -R %%F >nul 2>&1

echo.
echo  Codigo desbloqueado. Ya puedes editar en Cursor.
echo.
pause
