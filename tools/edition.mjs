// Switch the build between the Genesis City estate and the Creator Success test World.
//   node tools/edition.mjs world yourname.dcl.eth   → test World (core game only), parcels moved to 0,0
//   node tools/edition.mjs estate                   → back to the estate at -106,76 (default)
// Writes src/edition.ts and scene.json together. The estate scene.json is kept in tools/scene.estate.json.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scenePath = path.join(root, 'scene.json')
const estatePath = path.join(root, 'tools', 'scene.estate.json')
const flagPath = path.join(root, 'src', 'edition.ts')
const [mode, name] = process.argv.slice(2)

const setFlag = (on) => {
  const src = fs.readFileSync(flagPath, 'utf8').replace(/WORLD_EDITION: boolean = (true|false)/, `WORLD_EDITION: boolean = ${on}`)
  fs.writeFileSync(flagPath, src)
}

if (mode === 'world') {
  if (!name || !/\.(dcl\.)?eth$/.test(name)) {
    console.error('Usage: node tools/edition.mjs world yourname.dcl.eth')
    process.exit(1)
  }
  const cur = JSON.parse(fs.readFileSync(scenePath, 'utf8'))
  if (!cur.worldConfiguration) fs.writeFileSync(estatePath, JSON.stringify(cur, null, 2) + '\n')
  const estate = JSON.parse(fs.readFileSync(estatePath, 'utf8'))
  const [bx, by] = estate.scene.base.split(',').map(Number)
  const shift = (p) => {
    const [x, y] = p.split(',').map(Number)
    return `${x - bx},${y - by}`
  }
  const world = {
    ...estate,
    display: {
      ...estate.display,
      title: 'WOW Nightswarm — test World',
      description:
        'Creator Success test build of WOW NIGHTSWARM: the core horde-survival loop, level-up choices, boss ladder and the Blood Ring PvP block. No casino, no paid gold. Progress saves to your wallet.'
    },
    scene: { parcels: estate.scene.parcels.map(shift), base: '0,0' },
    worldConfiguration: { name }
  }
  fs.writeFileSync(scenePath, JSON.stringify(world, null, 2) + '\n')
  setFlag(true)
  console.log(`World edition ready for ${name} (${world.scene.parcels.length} parcels).`)
} else if (mode === 'estate') {
  if (fs.existsSync(estatePath)) fs.copyFileSync(estatePath, scenePath)
  setFlag(false)
  console.log('Estate edition restored (-106,76).')
} else {
  console.error('Usage: node tools/edition.mjs world <name.dcl.eth> | estate')
  process.exit(1)
}
