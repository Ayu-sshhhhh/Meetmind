@echo off
setlocal
cd /d "%~dp0"

if not exist ".env" (
  echo.
  echo [MeetMind] .env file not found.
  echo Copy .env.example to .env and review the local/cloud settings first.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [MeetMind] Node.js was not found on this computer.
  echo Install Node.js, then run this file again.
  echo.
  pause
  exit /b 1
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  echo [MeetMind] Stopping existing server on port 3000...
  taskkill /PID %%P /F >nul 2>nul
)

start "MeetMind Server" cmd /k "cd /d ""%~dp0"" && node server.js"
timeout /t 2 /nobreak >nul
start "" http://localhost:3000
