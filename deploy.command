#!/bin/bash
# WOW Nightswarm — deploy the estate (-106,76). Double-click in Finder.
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "[!] Node.js is not installed. Install the LTS version from https://nodejs.org and run this again."; open https://nodejs.org; read -n 1 -s -r -p "Press any key to close"; exit 1; }
if [ -d .git ] && command -v git >/dev/null 2>&1; then echo "[0/3] Checking for updates..."; git pull --ff-only -q || true; fi
echo "[1/3] Installing packages (first time only takes a few minutes)..."
npm install --no-audit --no-fund || { read -n 1 -s -r -p "Press any key to close"; exit 1; }
echo "[2/3] Building the scene..."
npx sdk-commands build || { read -n 1 -s -r -p "Press any key to close"; exit 1; }
echo "[3/3] Deploying to Decentraland. A browser tab will open:"
echo "      connect the wallet that owns the Wow Casino estate and click \"Sign and Deploy\"."
npm run deploy
echo
echo "Done. Visit https://decentraland.org/play/?position=-106,76"
read -n 1 -s -r -p "Press any key to close"
