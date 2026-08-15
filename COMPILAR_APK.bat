@echo off
REM Recompila el APK de debug de Academic OS para Android.
REM Sale en: academic-os\android\app\build\outputs\apk\debug\app-debug.apk
setlocal
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
cd /d "%~dp0academic-os" || exit /b 1

call npm run build || exit /b 1
call npx cap sync android || exit /b 1
cd android || exit /b 1
call gradlew.bat assembleDebug || exit /b 1

echo.
echo APK listo: %CD%\app\build\outputs\apk\debug\app-debug.apk
endlocal
