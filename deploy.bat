@echo off
chcp 65001 >nul
cd /d "%~dp0"
title WOW Survivors - Decentraland deploy
where node >nul 2>nul || (echo [!] Node.js is not installed. Install the LTS version from https://nodejs.org and run this again. & start https://nodejs.org & pause & exit /b 1)
echo [1/3] Installing packages (first time only takes a few minutes)...
call npm install --no-audit --no-fund || (pause & exit /b 1)
echo [2/3] Building the scene...
call npx sdk-commands build || (pause & exit /b 1)
echo [3/3] Deploying to Decentraland. A browser tab will open:
echo       connect the wallet that owns the Wow Casino estate and click "Sign and Deploy".
call npm run deploy
echo.
echo Done. Visit https://decentraland.org/play/?position=-106,76
pause
