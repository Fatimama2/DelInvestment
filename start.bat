@echo off
title DEL Invest
cd /d "%~dp0"
echo ============================================================
echo    DEL Invest - PSX
echo    Starting up. A browser tab opens automatically.
echo    KEEP THIS WINDOW OPEN while you use the app.
echo    (Close it to stop the app.)
echo ============================================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js / npm was not found.
  echo Install Node.js 20+ from https://nodejs.org then run this again.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies ^(first run only, ~1 minute^)...
  call npm install
  echo.
)

echo Opening http://localhost:5173 in your browser shortly...
start "" /min cmd /c "ping -n 9 127.0.0.1 >nul & explorer http://localhost:5173"

call npm run dev

echo.
echo The app has stopped. Press any key to close this window.
pause >nul
