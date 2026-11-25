#!/bin/bash
# "Too many requests" = the main Decentraland server is rate-limiting. This sends the scene through another server.
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "[!] Node.js is not installed. Install the LTS version from https://nodejs.org and run this again."; open https://nodejs.org; read -n 1 -s -r -p "Press any key to close"; exit 1; }
echo "[0/2] Installing packages (first time only takes a few minutes)..."
npm install --no-audit --no-fund || { read -n 1 -s -r -p "Press any key to close"; exit 1; }
echo "[1/2] Building the scene..."
npx --no-install sdk-commands build || { read -n 1 -s -r -p "Press any key to close"; exit 1; }
echo "[2/2] Choose a server (1 is closest to Korea):"
echo "  1) peer-ap1.decentraland.org"
echo "  2) peer-ec1.decentraland.org"
echo "  3) peer-wc1.decentraland.org"
echo "  4) peer-ec2.decentraland.org"
read -r -p "Number (1-4): " P
T=https://peer-ap1.decentraland.org
[ "$P" = "2" ] && T=https://peer-ec1.decentraland.org
[ "$P" = "3" ] && T=https://peer-wc1.decentraland.org
[ "$P" = "4" ] && T=https://peer-ec2.decentraland.org
echo "Deploying through $T - a browser tab opens: connect the estate wallet and click \"Sign and Deploy\"."
npx --no-install sdk-commands deploy --target "$T" --skip-build
echo
echo "If it still says \"Too many requests\", wait 10-15 minutes or pick another number."
read -n 1 -s -r -p "Press any key to close"
