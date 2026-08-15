@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo  ========================================
echo   BLOQUEAR edicion de codigo - Academic OS
echo  ========================================
echo.

> "%~dp0CODEBASE.FROZEN" (
  echo Academic OS — codigo congelado
  echo Fecha: %date% %time%
  echo Ejecutar DESBLOQUEAR_CODIGO.bat para editar de nuevo.
)

echo [1/4] Marcador CODEBASE.FROZEN creado.

echo [2/4] Solo lectura: academic-os\src ...
attrib +R /S /D "%~dp0academic-os\src\*" >nul 2>&1

echo [3/4] Solo lectura: configs academic-os ...
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
) do if exist %%F attrib +R %%F >nul 2>&1

echo [4/4] Solo lectura: scripts raiz (.bat, Dockerfile, CLOUD.md) ...
for %%F in ("%~dp0*.bat" "%~dp0Dockerfile" "%~dp0CLOUD.md") do if exist %%F attrib +R %%F >nul 2>&1

echo.
echo  Listo. Codigo bloqueado para edicion.
echo  Usa la app con INICIAR.bat — no edites desde Cursor.
echo  Desbloquear: DESBLOQUEAR_CODIGO.bat
echo.
pause
