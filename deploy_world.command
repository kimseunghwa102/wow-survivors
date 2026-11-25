#!/bin/bash
# Publish the Creator Success TEST WORLD (core game only). Needs a Decentraland NAME (yourname.dcl.eth).
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "[!] Node.js is not installed. Install the LTS version from https://nodejs.org and run this again."; open https://nodejs.org; read -n 1 -s -r -p "Press any key to close"; exit 1; }
read -r -p "Type your NAME (like wownightswarm.dcl.eth) and press Enter: " DCLNAME
[ -z "$DCLNAME" ] && { echo "No NAME given."; read -n 1 -s -r -p "Press any key to close"; exit 1; }
npm install --no-audit --no-fund || exit 1
node tools/edition.mjs world "$DCLNAME" || exit 1
if npx --no-install sdk-commands build; then
  npx --no-install sdk-commands deploy --target-content https://worlds-content-server.decentraland.org --skip-build
fi
echo "Restoring the estate edition (-106,76)..."
node tools/edition.mjs estate
npx --no-install sdk-commands build >/dev/null 2>&1
echo "Your test World: https://decentraland.org/play/?realm=$DCLNAME"
read -n 1 -s -r -p "Press any key to close"
