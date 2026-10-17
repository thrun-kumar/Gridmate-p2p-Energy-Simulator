@echo off
title SolarShare - Peer-to-Peer Energy Trading Simulator
echo ================================================================
echo ☀️ SolarShare: Peer-to-Peer Clean Energy Trading Simulator
echo 🌱 SDG 7: Affordable and Clean Energy ^| Hackathon Demonstration
echo Tagline: Trade Clean Energy. Save Money. Power Your Community.
echo ================================================================
echo Starting SolarShare backend server on port 5000...
echo.

:: Detect Node.js binary
set "NODE_CMD=node"
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
  if exist "%APPDATA%\Antigravity\bin\node.cmd" (
    set "NODE_CMD=%APPDATA%\Antigravity\bin\node.cmd"
  ) else if exist "%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe" (
    set "ELECTRON_RUN_AS_NODE=1"
    set "NODE_CMD=%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe"
  ) else if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_CMD=C:\Program Files\nodejs\node.exe"
  )
)

:: Check if server is already active on port 5000
netstat -ano | findstr :5000 | findstr LISTENING >nul 2>&1
if %ERRORLEVEL% equ 0 (
  echo [OK] SolarShare backend server is ALREADY ACTIVE on port 5000!
  echo Launching application in your browser...
  start http://localhost:5000/login
  start http://127.0.0.1:5000/login
  echo.
  echo Application opened at http://localhost:5000/login
  pause
  exit /b 0
)

cd /d "%~dp0server"

:: Open browser automatically
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:5000/login & start http://127.0.0.1:5000/login"

:: Run Server
call "%NODE_CMD%" src/index.js

pause
