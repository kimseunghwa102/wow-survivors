# WOW Nightswarm

A survivors-like horde arena for Decentraland (SDK7). Survive endless night swarms, pick an upgrade at every level, and climb a ladder of 48 original bosses up to THE ALMIGHTY at Lv 1111, while other hunters share your arena and can fight you in the Blood Ring.

This repository is the working game project for the **Decentraland Creator Success V0** application.

## Play

- **Test scene (Genesis City):** [decentraland.org/play/?position=-106,76](https://decentraland.org/play/?position=-106,76) — 12 parcels, live since 2026-11-17. We don't own a NAME yet, so the test scene runs on our LAND estate; `deploy_world.bat` publishes the same game to a World once we have one.
- **Game Design Document:** [design/gdd.md](design/gdd.md)

The scene is a test build. Mobile performance, the Hunt Party co-op mode and balancing are the work proposed for V0, as documented in the GDD.

## What is playable now

- Auto-firing skills plus a manual Armory weapon (fists → frying pan → … → doomsday nuke)
- Three-card level-ups with reroll and skip; 27 arts, 20 boons with rarities, 6 skill ascensions
- 48 named bosses, random arena events (Blood Moon, Gold Rush, Elite Hunt), boss vaults
- The Blood Ring: an opt-in PvP block with bounties; other hunters' skills are visible to everyone
- Progress saved to your wallet: gold, Arcane Forge upgrades, Armory, daily quests, login streak, live / weekly / all-time boards

## Run locally

1. Install [Node.js](https://nodejs.org) (LTS) or the Decentraland Creator Hub.
2. `npm install`
3. `npm start` — opens the local preview.

Build the test-World edition: `node tools/edition.mjs world yourname.dcl.eth`, then `npm run build`. Switch back with `node tools/edition.mjs estate`. On Windows, `deploy_world.bat` does all of this and deploys.

## Layout

| Path | What it is |
|---|---|
| `src/game/` | Game simulation (`core.ts`), definitions (`defs.ts`), controller, rendering, network sync |
| `src/world.ts`, `src/ui.tsx` | Fortress, signs, boards and the game UI |
| `src/edition.ts` | Estate vs test-World build flag |
| `server/` | Save server (Node + Postgres): wallet-signed saves, quests, streaks, boards, anti-cheat caps |
| `blender/` | Blender scripts that build every model, effect and sound |
| `design/` | GDD and Creator Success notes |

Game names, bosses and models are original to this project; see the GDD header for the content declaration.

Created by [@bitcoinisnotall](https://x.com/bitcoinisnotall).
