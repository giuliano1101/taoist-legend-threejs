@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22 or newer, then try again.
  pause
  exit /b 1
)
if exist "TaoistLegend.exe" (
  start "" "TaoistLegend.exe"
  exit /b 0
)
echo Opening the game in your browser. Click or press a key if audio is blocked.
node server.mjs --open
pause
