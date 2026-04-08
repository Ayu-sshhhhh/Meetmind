@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [MeetMind] Node.js was not found on this computer.
  echo Install Node.js, then run this file again.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  echo.
  echo [MeetMind] .env file not found.
  echo Copy .env.example to .env and review the local/cloud settings first.
  echo.
  pause
  exit /b 1
)

where npx >nul 2>nul
if errorlevel 1 (
  echo.
  echo [MeetMind] npx was not found on this computer.
  echo Install Node.js with npm, then run this file again.
  echo.
  pause
  exit /b 1
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do set SERVER_PID=%%P

if not defined SERVER_PID (
  echo [MeetMind] Starting local server on http://localhost:3000...
  start "MeetMind Server" cmd /k "cd /d ""%~dp0"" && node server.js"
  timeout /t 2 /nobreak >nul
) else (
  echo [MeetMind] Local server already running on port 3000.
)

echo.
echo [MeetMind] Starting public tunnel...
echo Keep both command windows open while using the public URL.
echo.
npx.cmd --yes localtunnel --port 3000
