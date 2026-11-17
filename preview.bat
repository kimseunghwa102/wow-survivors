@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Install Node.js LTS from https://nodejs.org first & start https://nodejs.org & pause & exit /b 1)
call npm install --no-audit --no-fund
call npm run start
