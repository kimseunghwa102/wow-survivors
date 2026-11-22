@echo off
chcp 65001 >nul
cd /d "%~dp0"
title WOW Nightswarm - deploy the Creator Success test World
where node >nul 2>nul || (echo [!] Node.js is not installed. Install the LTS version from https://nodejs.org and run this again. & start https://nodejs.org & pause & exit /b 1)
echo.
echo This publishes the TEST WORLD (core game only: no casino, no gold shop, no raid gate).
echo You need a Decentraland NAME (for example  wownightswarm.dcl.eth ) owned by the wallet you sign with.
echo.
set /p DCLNAME=Type your NAME (like wownightswarm.dcl.eth) and press Enter:
if "%DCLNAME%"=="" (echo No NAME given. & pause & exit /b 1)
echo [1/4] Installing packages (first time only takes a few minutes)...
call npm install --no-audit --no-fund || (pause & exit /b 1)
echo [2/4] Switching to the World edition for %DCLNAME% ...
call node tools/edition.mjs world %DCLNAME% || (pause & exit /b 1)
echo [3/4] Building...
call npx sdk-commands build
if errorlevel 1 goto restore
echo [4/4] Deploying to the Worlds server. A browser tab will open:
echo       connect the wallet that owns %DCLNAME% and click "Sign and Deploy".
call npx sdk-commands deploy --target-content https://worlds-content-server.decentraland.org --skip-build
:restore
echo.
echo Restoring the estate edition (-106,76) so deploy.bat keeps working...
call node tools/edition.mjs estate
call npx sdk-commands build >nul 2>nul
echo.
echo Done. Your test World: https://decentraland.org/play/?realm=%DCLNAME%
echo Put that link in README.md (the "Play the test World" line) before you apply.
pause
