#!/bin/bash
# WOW Nightswarm REAPER RAID (-91,71) — sign with the wallet that owns -91,71
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "[!] Node.js is not installed. Install the LTS version from https://nodejs.org and run this again."; open https://nodejs.org; read -n 1 -s -r -p "Press any key to close"; exit 1; }
npm install --no-audit --no-fund || exit 1
npx --no-install sdk-commands build || exit 1
npm run deploy
echo "Done. Visit https://decentraland.org/play/?position=-91,71"
read -n 1 -s -r -p "Press any key to close"
