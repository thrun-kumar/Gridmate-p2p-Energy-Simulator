@echo off
title SolarShare - Automated Verification Test Suite
echo ================================================================
echo ☀️ SolarShare: Running 30-Scenario Automated Verification Suite
echo 🌱 SDG 7: Clean Energy and Green Technology
echo ================================================================
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

cd /d "%~dp0server"
call "%NODE_CMD%" src/tests/simulation.test.js

echo.
pause
