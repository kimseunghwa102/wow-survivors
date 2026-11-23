@echo off
chcp 65001 >nul
cd /d "%~dp0"
title WOW Nightswarm - deploy via another catalyst
echo "Too many requests" = the main Decentraland server is rate-limiting. This sends the scene through another server.
echo [1/2] Building the scene...
call npx sdk-commands build || (pause & exit /b 1)
echo [2/2] Choose a server (1 is closest to Korea):
echo   1) peer-ap1.decentraland.org
echo   2) peer-ec1.decentraland.org
echo   3) peer-wc1.decentraland.org
echo   4) peer-ec2.decentraland.org
set /p P=Number (1-4): 
set T=https://peer-ap1.decentraland.org
if "%P%"=="2" set T=https://peer-ec1.decentraland.org
if "%P%"=="3" set T=https://peer-wc1.decentraland.org
if "%P%"=="4" set T=https://peer-ec2.decentraland.org
echo Deploying through %T% - a browser tab opens: connect the estate wallet and click "Sign and Deploy".
call npx sdk-commands deploy --target %T% --skip-build
echo.
echo If it still says "Too many requests", wait 10-15 minutes or pick another number.
pause
