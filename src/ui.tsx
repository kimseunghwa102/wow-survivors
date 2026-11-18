import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { G, startRun, choose, reroll, skipLevel, collectChest, buyMeta, META, MetaKey, metaCost, returnToSanctuary, playAgain, buyArmory, claimDaily, equipped, toggleAuto, equipWeapon } from './game/game'
import { optionLabel, Option } from './game/core'
import { WEAPONS, PASSIVES, STARTERS, MAX_WEAPON_LVL, MAX_PASSIVE_LVL, WeaponId, PassiveId, ARMORY, NUKE_TIER, NUKE, bossFor } from './game/defs'
import { feed, topRuns } from './game/net'
import { save } from './game/persist'
import { play } from './game/sfx'

const tap = (fn: () => void) => () => {
  play('click')
  fn()
}
import { mmss } from './world'

const C = (h: string, a = 1) => {
  const c = Color4.fromHexString(h)
  return Color4.create(c.r, c.g, c.b, a)
}
const PANEL = C('#0B0712', 0.86)
const GOLD = C('#FFD86A')
const WHITE = Color4.White()
const DIM = C('#9AA0AA')

// ───────────────────────── HUD ─────────────────────────
function Bar(props: { frac: number; color: Color4; w: number | string; h: number; bg?: Color4 }) {
  return (
    <UiEntity uiTransform={{ width: props.w as any, height: props.h }} uiBackground={{ color: props.bg ?? C('#000000', 0.6) }}>
      <UiEntity uiTransform={{ width: `${Math.max(0, Math.min(1, props.frac)) * 100}%`, height: '100%' }} uiBackground={{ color: props.color }} />
    </UiEntity>
  )
}

// Right-side HUD column (the left edge is covered by the explorer's minimap / chat)
const RIGHT = 16
function Stat(props: { k: string; v: string; color?: Color4 }) {
  return (
    <UiEntity uiTransform={{ flexDirection: 'column', alignItems: 'flex-start', margin: { right: 14 } }}>
      <Label value={props.k} fontSize={10} color={DIM} uiTransform={{ height: 13 }} textAlign="middle-left" />
      <Label value={`<b>${props.v}</b>`} fontSize={19} color={props.color ?? WHITE} uiTransform={{ height: 24 }} textAlign="middle-left" />
    </UiEntity>
  )
}

function TopHud() {
  const r = G.run
  if (!r) return null
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 0, left: 0 }, width: '100%', height: 8 }}>
      <Bar frac={r.xp / r.need} color={C('#4DA3FF')} w="100%" h={8} bg={C('#000000', 0.5)} />
    </UiEntity>
  )
}

function SidePanel() {
  const r = G.run
  if (!r) return null
  const ws = [...r.weapons.entries()] as [WeaponId, number][]
  const ps = [...r.passives.entries()] as [PassiveId, number][]
  const hpCol = G.hurtFlash > 0 ? C('#FFFFFF') : r.hp / r.maxHp < 0.3 ? C('#FF2A3D') : C('#E0102A')
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 90, right: RIGHT }, width: 250, flexDirection: 'column' }}>
      {/* stats card */}
      <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', padding: 10 }} uiBackground={{ color: PANEL }}>
        <UiEntity uiTransform={{ width: '100%', height: 3, margin: { bottom: 6 } }} uiBackground={{ color: C('#7B3BFF') }} />
        <UiEntity uiTransform={{ flexDirection: 'row', width: '100%', alignItems: 'flex-end' }}>
          <Stat k="LEVEL" v={`${r.level}`} color={C('#8EC5FF')} />
          <Stat k="TIME" v={mmss(r.time)} color={r.time >= 300 ? C('#FF5468') : WHITE} />
          <Stat k="KILLS" v={`${r.kills}`} />
          <Stat k="GOLD" v={`${r.gold}`} color={GOLD} />
        </UiEntity>
        <Label value={`XP  ${Math.floor(r.xp)} / ${r.need}`} fontSize={10} color={DIM} uiTransform={{ height: 14, margin: { top: 4 } }} textAlign="middle-left" />
        <Bar frac={r.xp / r.need} color={C('#4DA3FF')} w="100%" h={8} />
        <Label value={`HP  ${Math.ceil(r.hp)} / ${r.maxHp}`} fontSize={10} color={DIM} uiTransform={{ height: 14, margin: { top: 4 } }} textAlign="middle-left" />
        <Bar frac={r.hp / r.maxHp} color={hpCol} w="100%" h={12} />
      </UiEntity>
      {/* armory weapon + nuke */}
      <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', padding: 8, margin: { top: 6 } }} uiBackground={{ color: PANEL }}>
        <Label value={`<b>${ARMORY[r.equip].name}</b>  ·  ${G.autoAttack ? 'AUTO' : 'hold LEFT CLICK'}`} fontSize={12} color={C(ARMORY[r.equip].color)} uiTransform={{ height: 16 }} textAlign="middle-left" />
        {r.armory >= NUKE_TIER ? (
          <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', width: '100%', margin: { top: 4 } }}>
            <Button
              value={r.canNuke ? '☢ NUKE [F]' : `☢ ${Math.ceil(Math.max(0, r.nukeCd))}s`}
              fontSize={12}
              color={WHITE}
              uiTransform={{ width: 110, height: 26 }}
              uiBackground={{ color: r.canNuke ? C('#D01A1A') : C('#3A2020') }}
              onMouseDown={() => (G.nukeAsk = true)}
            />
            <UiEntity uiTransform={{ width: 110, height: 8, margin: { left: 8 } }} uiBackground={{ color: C('#000000', 0.6) }}>
              <UiEntity uiTransform={{ width: `${Math.round((1 - Math.max(0, r.nukeCd) / NUKE.cd) * 100)}%`, height: '100%' }} uiBackground={{ color: C('#FF3B2E') }} />
            </UiEntity>
          </UiEntity>
        ) : null}
      </UiEntity>
      {/* loadout */}
      <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', padding: 8, margin: { top: 6 } }} uiBackground={{ color: PANEL }}>
        <Label value="<b>SKILLS</b>" fontSize={11} color={DIM} uiTransform={{ height: 15 }} textAlign="middle-left" />
        {ws.map(([id, lv]) => (
          <Label
            key={id}
            value={`${r.evolved.has(id) ? '✦ ' + WEAPONS[id].evo : WEAPONS[id].name}  <b>${lv >= MAX_WEAPON_LVL ? 'MAX' : 'Lv' + lv}</b>`}
            fontSize={13}
            color={C(WEAPONS[id].color)}
            uiTransform={{ height: 18 }}
            textAlign="middle-left"
          />
        ))}
        {ps.length ? <UiEntity uiTransform={{ height: 4 }} /> : null}
        {ps.map(([id, lv]) => (
          <Label key={id} value={`${PASSIVES[id].name}  ${lv >= MAX_PASSIVE_LVL ? 'MAX' : 'Lv' + lv}`} fontSize={12} color={DIM} uiTransform={{ height: 16 }} textAlign="middle-left" />
        ))}
      </UiEntity>
      <Feed />
    </UiEntity>
  )
}

function BossBar() {
  const r = G.run
  const b = r?.boss
  if (!r || !b) return null
  const d = bossFor(b.boss ?? 0)
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 18 }, width: '100%', justifyContent: 'center' }}>
      <UiEntity uiTransform={{ flexDirection: 'column', alignItems: 'center', padding: 6, width: 560 }} uiBackground={{ color: C('#0B0712', 0.8) }}>
        <Label value={`<b>${d.name}</b>  ·  ${d.title}`} fontSize={16} color={C(d.color)} uiTransform={{ height: 22 }} />
        <UiEntity uiTransform={{ width: 540, height: 14 }} uiBackground={{ color: C('#000000', 0.7) }}>
          <UiEntity uiTransform={{ width: `${Math.max(0, (b.hp / b.maxHp) * 100)}%`, height: '100%' }} uiBackground={{ color: C(d.color) }} />
        </UiEntity>
        <Label value={`${Math.max(0, Math.ceil(b.hp)).toLocaleString()} / ${Math.round(b.maxHp).toLocaleString()}`} fontSize={10} color={DIM} uiTransform={{ height: 14 }} />
      </UiEntity>
    </UiEntity>
  )
}

function NextBoss() {
  const r = G.run
  if (!r || r.boss) return null
  const d = bossFor(r.bossIndex)
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 14 }, width: '100%', justifyContent: 'center' }}>
      <Label value={`next boss: <b>${d.name}</b> at Lv ${d.lvl}`} fontSize={12} color={C(d.color, 0.85)} />
    </UiEntity>
  )
}

function Flash() {
  if (G.flash <= 0) return null
  return <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%' }} uiBackground={{ color: C('#FFF3D6', Math.min(0.85, G.flash * 1.6)) }} />
}

function Dock() {
  const on = G.autoAttack
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { bottom: 24, right: 16 }, flexDirection: 'column', alignItems: 'flex-end' }}>
      <Button
        value={G.infoOpen ? '✕ CLOSE UPGRADES [1]' : '📖 UPGRADES [1]'}
        fontSize={15}
        color={WHITE}
        uiTransform={{ width: 210, height: 40, margin: { bottom: 6 } }}
        uiBackground={{ color: G.infoOpen ? C('#7B3BFF') : C('#2A1A40') }}
        onMouseDown={tap(() => (G.infoOpen = !G.infoOpen))}
      />
      {G.run ? (
        <Button
          value={on ? '⚔ AUTO ATTACK  ON [E]' : '⚔ AUTO ATTACK  OFF [E]'}
          fontSize={15}
          color={WHITE}
          uiTransform={{ width: 210, height: 44 }}
          uiBackground={{ color: on ? C('#1FA85A') : C('#3A2A4A') }}
          onMouseDown={toggleAuto}
        />
      ) : null}
      <Label value="keys: 1 upgrades · 2 switch weapon · 3 buy next · E auto · F nuke" fontSize={11} color={DIM} uiTransform={{ height: 16 }} />
    </UiEntity>
  )
}

function Row(props: { left: string; right: string; color?: Color4; rc?: Color4; key?: string }) {
  return (
    <UiEntity uiTransform={{ flexDirection: 'row', width: '100%', height: 18, justifyContent: 'space-between' }}>
      <Label value={props.left} fontSize={12} color={props.color ?? WHITE} uiTransform={{ height: 18 }} textAlign="middle-left" />
      <Label value={props.right} fontSize={12} color={props.rc ?? DIM} uiTransform={{ height: 18 }} textAlign="middle-right" />
    </UiEntity>
  )
}

/** non-blocking overview of every upgrade — open any time with key 1 */
function InfoPanel() {
  if (!G.infoOpen) return null
  const eq = equipped()
  const r = G.run
  const ws = r ? ([...r.weapons.entries()] as [WeaponId, number][]) : []
  const ps = r ? ([...r.passives.entries()] as [PassiveId, number][]) : []
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 90, right: 282 }, width: 380, flexDirection: 'column', padding: 12 }} uiBackground={{ color: C('#0E0818', 0.92) }}>
      <Label value="<b>UPGRADES</b>" fontSize={20} color={GOLD} uiTransform={{ height: 26 }} textAlign="middle-left" />
      <Label value={`Bank ● ${G.bank.toLocaleString()}`} fontSize={13} color={GOLD} uiTransform={{ height: 18 }} textAlign="middle-left" />
      <Label value="<b>ARMORY</b>  (your own attack)" fontSize={13} color={C('#FFB84A')} uiTransform={{ height: 20, margin: { top: 6 } }} textAlign="middle-left" />
      {ARMORY.map((w, i) => {
        const owned = i <= G.armory
        const next = i === G.armory + 1
        const status = i === NUKE_TIER && owned ? 'OWNED · F' : i === eq ? '✓ IN HAND' : owned ? 'owned · press 2' : next ? (G.bank >= w.cost ? `BUY ● ${w.cost.toLocaleString()} · press 3` : `need ● ${w.cost.toLocaleString()}`) : `🔒 ● ${w.cost.toLocaleString()}`
        return (
          <UiEntity key={w.name} uiTransform={{ flexDirection: 'row', width: '100%', height: 22, alignItems: 'center' }}>
            <Label value={`${owned ? '■' : '□'} ${w.name}`} fontSize={12} color={owned ? C(w.color) : DIM} uiTransform={{ width: 150, height: 20 }} textAlign="middle-left" />
            {(next || (owned && i !== eq && i < NUKE_TIER)) ? (
              <Button
                value={status}
                fontSize={11}
                color={WHITE}
                uiTransform={{ width: 210, height: 20 }}
                uiBackground={{ color: next ? (G.bank >= w.cost ? C('#1FA85A') : C('#5A2A2A')) : C('#3A2A5A') }}
                onMouseDown={tap(() => (next ? buyArmory(i) : equipWeapon(i)))}
              />
            ) : (
              <Label value={status} fontSize={11} color={i === eq ? C('#3DFF8E') : DIM} uiTransform={{ width: 210, height: 20 }} textAlign="middle-right" />
            )}
          </UiEntity>
        )
      })}
      {G.armoryMsg ? <Label value={G.armoryMsg} fontSize={12} color={G.armoryMsg.startsWith('✓') ? C('#3DFF8E') : C('#FFB84A')} uiTransform={{ height: 18 }} textAlign="middle-left" /> : null}
      <Label value="<b>ARCANE FORGE</b>  (permanent, buy at the forge)" fontSize={13} color={C('#9FE8FF')} uiTransform={{ height: 20, margin: { top: 6 } }} textAlign="middle-left" />
      {(Object.keys(META) as MetaKey[]).map((k) => (
        <Row key={k} left={META[k].name} right={`${G.meta[k]} / ${META[k].max}${G.meta[k] < META[k].max ? `  · next ● ${metaCost(G.meta[k]).toLocaleString()}` : '  MAX'}`} />
      ))}
      <Label value={r ? `<b>THIS RUN</b>  ·  Lv ${r.level}` : '<b>THIS RUN</b>  ·  start a run in the rift'} fontSize={13} color={C('#FF7AC8')} uiTransform={{ height: 20, margin: { top: 6 } }} textAlign="middle-left" />
      {ws.map(([id, lv]) => {
        const w = WEAPONS[id]
        const asc = r!.evolved.has(id)
        const hint = asc ? 'ASCENDED ✦' : lv >= MAX_WEAPON_LVL ? (r!.p(w.evoWith) > 0 ? 'open a vault to ASCEND' : `ascend: + ${PASSIVES[w.evoWith].name}`) : lv < 4 ? `new form at Lv4` : lv < 7 ? `new form at Lv7` : `max at Lv${MAX_WEAPON_LVL}`
        return <Row key={id} left={`${asc ? w.evo : w.name}  Lv${lv}`} color={C(w.color)} right={hint} rc={asc ? C('#FFFFFF') : DIM} />
      })}
      {ps.map(([id, lv]) => (
        <Row key={id} left={`${PASSIVES[id].name}  Lv${lv}`} color={C(PASSIVES[id].color)} right={`${'●'.repeat(lv)}${'○'.repeat(Math.max(0, MAX_PASSIVE_LVL - lv))}`} />
      ))}
      {r && !ws.length && !ps.length ? <Label value="—" fontSize={12} color={DIM} /> : null}
    </UiEntity>
  )
}

function HpBar() {
  const r = G.run
  if (!r) return null
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { bottom: 70 }, width: '100%', justifyContent: 'center', flexDirection: 'row' }}>
      <Bar frac={r.hp / r.maxHp} color={G.hurtFlash > 0 ? C('#FFFFFF') : C('#E0102A')} w={220} h={8} />
    </UiEntity>
  )
}

function Feed() {
  if (!feed.length) return null
  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', padding: 8, margin: { top: 6 } }} uiBackground={{ color: PANEL }}>
      <Label value="<b>RIFT FEED</b>" fontSize={11} color={C('#FF5468')} uiTransform={{ height: 15 }} textAlign="middle-left" />
      {feed.map((f, i) => (
        <Label key={`${f.t}-${i}`} value={f.text} fontSize={11} color={C(f.color)} uiTransform={{ height: 16 }} textAlign="middle-left" />
      ))}
    </UiEntity>
  )
}

function Banner() {
  if (G.bannerT <= 0 || !G.banner) return null
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 110 }, width: '100%', justifyContent: 'center' }}>
      <UiEntity uiTransform={{ padding: { left: 22, right: 22, top: 8, bottom: 8 } }} uiBackground={{ color: C('#3A0A1A', 0.88) }}>
        <Label value={`<b>${G.banner}</b>`} fontSize={22} color={GOLD} />
      </UiEntity>
    </UiEntity>
  )
}

function LobbyHint() {
  if (G.run || G.phase !== 'idle') return null
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { bottom: 24 }, width: '100%', justifyContent: 'center' }}>
      <UiEntity uiTransform={{ padding: 10, flexDirection: 'column', alignItems: 'center' }} uiBackground={{ color: PANEL }}>
        <Label value="<b>WOW NIGHTSWARM</b>  ·  walk through the east gate to start a run" fontSize={16} color={WHITE} />
        <Label value={`Bank ● ${G.bank}   ·   Best ${mmss(G.best.t)} (Lv ${G.best.l})   ·   Arcane Forge = permanent boosts`} fontSize={13} color={GOLD} />
        <UiEntity uiTransform={{ flexDirection: 'row', margin: { top: 6 } }}>
          {G.daily ? (
            <Button
              value={G.daily.claimable ? `🎁 CLAIM DAILY ● ${G.daily.next}` : `✓ Day ${G.daily.streak} streak · tomorrow ● ${G.daily.next}`}
              fontSize={13}
              color={WHITE}
              uiTransform={{ width: 260, height: 32, margin: 4 }}
              uiBackground={{ color: G.daily.claimable ? C('#C08A00') : C('#2A2A3A') }}
              onMouseDown={tap(claimDaily)}
            />
          ) : null}
          <Button value="⚔ ARMORY" fontSize={13} color={WHITE} uiTransform={{ width: 140, height: 32, margin: 4 }} uiBackground={{ color: C('#7B3BFF') }} onMouseDown={tap(() => (G.armoryOpen = true))} />
        </UiEntity>
        {G.daily?.doubleReady ? <Label value="First run today banks DOUBLE gold!" fontSize={12} color={C('#3DFF8E')} /> : null}
        <Label value={save.status} fontSize={11} color={save.online ? C('#3DFF8E') : DIM} />
      </UiEntity>
    </UiEntity>
  )
}

// ───────────────────────── modals ─────────────────────────
function Modal(props: { title: string; sub?: string; children?: any; color?: Color4 }) {
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }} uiBackground={{ color: C('#000000', 0.45) }}>
      <UiEntity uiTransform={{ flexDirection: 'column', alignItems: 'center', padding: 22, maxWidth: 980 }} uiBackground={{ color: C('#120A1C', 0.96) }}>
        <Label value={`<b>${props.title}</b>`} fontSize={34} color={props.color ?? GOLD} uiTransform={{ height: 44 }} />
        {props.sub ? <Label value={props.sub} fontSize={15} color={DIM} uiTransform={{ height: 22, margin: { bottom: 10 } }} /> : null}
        {props.children}
      </UiEntity>
    </UiEntity>
  )
}

function Card(props: { o: Option; onPick: () => void; key?: string }) {
  const l = optionLabel(props.o)
  return (
    <UiEntity uiTransform={{ width: 210, height: 200, margin: 8, flexDirection: 'column', padding: 12 }} uiBackground={{ color: C('#1E1430') }}>
      <UiEntity uiTransform={{ width: '100%', height: 6, margin: { bottom: 10 } }} uiBackground={{ color: C(l.color) }} />
      <Label value={l.sub} fontSize={12} color={l.isNew ? C('#3DFF8E') : DIM} uiTransform={{ height: 16 }} />
      <Label value={`<b>${l.title}</b>`} fontSize={19} color={C(l.color)} uiTransform={{ height: 30 }} />
      <Label value={l.desc} fontSize={13} color={WHITE} uiTransform={{ height: 60, width: '100%' }} />
      <Button value="CHOOSE" fontSize={15} color={WHITE} uiTransform={{ width: '100%', height: 38 }} uiBackground={{ color: C('#7B3BFF') }} onMouseDown={tap(props.onPick)} />
    </UiEntity>
  )
}

function StartModal() {
  return (
    <Modal title="CHOOSE YOUR FIRST SKILL" sub="Enemies arrive the moment you choose. Other hunters in the arena can attack you.">
      <UiEntity uiTransform={{ flexDirection: 'row' }}>
        {STARTERS.map((w) => (
          <Card key={w} o={{ kind: 'weapon', id: w, to: 1 }} onPick={() => startRun(w)} />
        ))}
      </UiEntity>
    </Modal>
  )
}

function LevelModal() {
  const r = G.run!
  return (
    <Modal title="LEVEL UP!" sub={`Level ${r.level - r.pendingLevels + 1}${r.pendingLevels > 1 ? ` · ${r.pendingLevels - 1} more to pick` : ''} · the horde is frozen`}>
      <UiEntity uiTransform={{ flexDirection: 'row' }}>
        {G.choices.map((o, i) => (
          <Card key={`${i}-${o.kind}`} o={o} onPick={() => choose(o)} />
        ))}
      </UiEntity>
      <UiEntity uiTransform={{ flexDirection: 'row', margin: { top: 8 } }}>
        <Button value={`REROLL (${r.rerolls})`} fontSize={14} color={WHITE} uiTransform={{ width: 150, height: 34, margin: 6 }} uiBackground={{ color: r.rerolls > 0 ? C('#3A2A5A') : C('#222222') }} onMouseDown={tap(reroll)} />
        <Button value="SKIP (+10 gold)" fontSize={14} color={WHITE} uiTransform={{ width: 150, height: 34, margin: 6 }} uiBackground={{ color: C('#2A2A2A') }} onMouseDown={tap(skipLevel)} />
      </UiEntity>
    </Modal>
  )
}

const REEL = ['★', '♦', '☠', '●', '♥', '7']
function ChestModal() {
  const c = G.chest!
  const spinning = c.spin > 0
  const reel = () => REEL[Math.floor(Math.random() * REEL.length)]
  return (
    <Modal title={spinning ? 'JACKPOT VAULT' : c.rolls.length >= 5 ? 'MEGA JACKPOT!!' : c.rolls.length >= 3 ? 'BIG WIN!' : 'VAULT OPENED'} color={spinning ? GOLD : C('#3DFF8E')}>
      {spinning ? (
        <UiEntity uiTransform={{ flexDirection: 'row', margin: 10 }}>
          {[0, 1, 2].map((i) => (
            <UiEntity key={i} uiTransform={{ width: 110, height: 110, margin: 8, justifyContent: 'center', alignItems: 'center' }} uiBackground={{ color: C('#000000') }}>
              <Label value={reel()} fontSize={64} color={GOLD} />
            </UiEntity>
          ))}
        </UiEntity>
      ) : (
        <UiEntity uiTransform={{ flexDirection: 'column', alignItems: 'center' }}>
          {c.rolls.map((o, i) => {
            const l = optionLabel(o)
            return <Label key={i} value={`<b>${l.title}</b>  ·  ${l.sub}`} fontSize={o.kind === 'evolve' ? 24 : 17} color={C(l.color)} uiTransform={{ height: o.kind === 'evolve' ? 34 : 26 }} />
          })}
          <Label value={`+${c.gold} gold`} fontSize={16} color={GOLD} uiTransform={{ height: 26 }} />
          <Button value="COLLECT" fontSize={18} color={WHITE} uiTransform={{ width: 200, height: 42, margin: { top: 10 } }} uiBackground={{ color: C('#7B3BFF') }} onMouseDown={tap(collectChest)} />
        </UiEntity>
      )}
    </Modal>
  )
}

function DeadModal() {
  const s = G.summary
  if (!s) return null
  const rank = s.rank ?? topRuns().findIndex((r) => r.t === s.t) + 1
  return (
    <Modal title={s.killer ? `SLAIN BY ${s.killer.toUpperCase()}` : 'YOU DIED'} color={C('#FF5468')} sub={s.newBest ? 'NEW PERSONAL BEST!' : `Best: ${mmss(G.best.t)}`}>
      <Label value={`Survived ${mmss(s.t)}   ·   Level ${s.l}   ·   ${s.k} kills   ·   ${s.pvpKills} hunters slain`} fontSize={18} color={WHITE} uiTransform={{ height: 28 }} />
      <Label value={s.saving ? 'Saving to your wallet…' : `+${s.gold} gold banked${G.doubleBonus ? ' (DAILY DOUBLE!)' : ''}${s.killer ? ' (30% taken by your killer)' : ''}${rank ? `   ·   Hall of Legends #${rank}` : ''}`} fontSize={15} color={GOLD} uiTransform={{ height: 24 }} />
      <UiEntity uiTransform={{ flexDirection: 'row', margin: { top: 12 } }}>
        <Button value="PLAY AGAIN" fontSize={18} color={WHITE} uiTransform={{ width: 200, height: 44, margin: 6 }} uiBackground={{ color: C('#7B3BFF') }} onMouseDown={tap(playAgain)} />
        <Button value="⚔ ARMORY" fontSize={16} color={WHITE} uiTransform={{ width: 150, height: 44, margin: 6 }} uiBackground={{ color: C('#C08A00') }} onMouseDown={tap(() => (G.armoryOpen = true))} />
        <Button value="SANCTUARY & FORGE" fontSize={16} color={WHITE} uiTransform={{ width: 220, height: 44, margin: 6 }} uiBackground={{ color: C('#2A2A3A') }} onMouseDown={tap(returnToSanctuary)} />
      </UiEntity>
    </Modal>
  )
}

function ShopModal() {
  return (
    <Modal title="ARCANE FORGE" sub={`Bank ● ${G.bank}  ·  ${save.online ? 'permanent boosts saved to your wallet' : 'offline — boosts last this session only'}`}>
      {(Object.keys(META) as MetaKey[]).map((k) => {
        const lv = G.meta[k]
        const max = lv >= META[k].max
        const cost = metaCost(lv)
        return (
          <UiEntity key={k} uiTransform={{ flexDirection: 'row', alignItems: 'center', width: 560, height: 46, margin: 2 }} uiBackground={{ color: C('#1E1430') }}>
            <Label value={`<b>${META[k].name}</b>  ${META[k].desc}`} fontSize={15} color={WHITE} uiTransform={{ width: 330 }} textAlign="middle-left" />
            <Label value={`Lv ${lv}/${META[k].max}`} fontSize={14} color={DIM} uiTransform={{ width: 80 }} />
            <Button value={max ? 'MAX' : G.shopBusy ? '…' : `● ${cost}`} fontSize={14} color={WHITE} uiTransform={{ width: 120, height: 34 }} uiBackground={{ color: max ? C('#333333') : G.bank >= cost ? C('#7B3BFF') : C('#3A2A4A') }} onMouseDown={tap(() => buyMeta(k))} />
          </UiEntity>
        )
      })}
      <Button value="CLOSE" fontSize={15} color={WHITE} uiTransform={{ width: 160, height: 38, margin: { top: 12 } }} uiBackground={{ color: C('#2A2A3A') }} onMouseDown={tap(() => (G.shopOpen = false))} />
    </Modal>
  )
}

function ArmoryModal() {
  const eq = equipped()
  return (
    <Modal title="ARMORY" sub={`Bank ● ${G.bank.toLocaleString()}  ·  your own attack: hold LEFT CLICK in the rift  ·  weapons are kept forever`}>
      {ARMORY.map((w, i) => {
        const owned = i <= G.armory
        const next = i === G.armory + 1
        const isNuke = i === NUKE_TIER
        const inHand = !isNuke && i === eq
        return (
          <UiEntity key={w.name} uiTransform={{ flexDirection: 'row', alignItems: 'center', width: 640, height: 44, margin: 2 }} uiBackground={{ color: inHand ? C('#2A1A40') : C('#1E1430') }}>
            <UiEntity uiTransform={{ width: 6, height: '100%' }} uiBackground={{ color: C(w.color) }} />
            <Label value={`<b>${w.name}</b>`} fontSize={15} color={owned ? C(w.color) : DIM} uiTransform={{ width: 160, margin: { left: 8 } }} textAlign="middle-left" />
            <Label value={w.desc} fontSize={12} color={WHITE} uiTransform={{ width: 260 }} textAlign="middle-left" />
            {owned ? (
              isNuke ? (
                <Label value="OWNED · F key" fontSize={13} color={C('#3DFF8E')} uiTransform={{ width: 150 }} />
              ) : (
                <Button
                  value={inHand ? 'IN HAND' : 'EQUIP'}
                  fontSize={13}
                  color={WHITE}
                  uiTransform={{ width: 150, height: 32 }}
                  uiBackground={{ color: inHand ? C('#3DFF8E', 0.35) : C('#3A2A5A') }}
                  onMouseDown={tap(() => equipWeapon(i))}
                />
              )
            ) : (
              <Button
                value={G.armoryBusy && next ? '…' : next ? (G.bank >= w.cost ? `BUY ● ${w.cost.toLocaleString()}` : `NEED ● ${w.cost.toLocaleString()}`) : `🔒 ● ${w.cost.toLocaleString()}`}
                fontSize={13}
                color={WHITE}
                uiTransform={{ width: 150, height: 32 }}
                uiBackground={{ color: next ? (G.bank >= w.cost ? C('#1FA85A') : C('#6A2A2A')) : C('#222222') }}
                onMouseDown={tap(() => buyArmory(i))}
              />
            )}
          </UiEntity>
        )
      })}
      {G.armoryMsg ? <Label value={`<b>${G.armoryMsg}</b>`} fontSize={15} color={G.armoryMsg.startsWith('✓') ? C('#3DFF8E') : C('#FFB84A')} uiTransform={{ height: 24, margin: { top: 6 } }} /> : null}
      <Label value="Unlock in order. Damage grows with your level during a run." fontSize={12} color={DIM} uiTransform={{ height: 20, margin: { top: 6 } }} />
      <Button value="CLOSE" fontSize={15} color={WHITE} uiTransform={{ width: 160, height: 38, margin: { top: 8 } }} uiBackground={{ color: C('#2A2A3A') }} onMouseDown={tap(() => ((G.armoryOpen = false), (G.armoryMsg = '')))} />
    </Modal>
  )
}

function Hurt() {
  if (G.hurtFlash <= 0) return null
  return <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%' }} uiBackground={{ color: C('#FF0000', 0.18 * (G.hurtFlash / 0.25)) }} />
}

const Root = () => (
  <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
    <Hurt />
    <Flash />
    <TopHud />
    <BossBar />
    <Dock />
    <InfoPanel />
    <NextBoss />
    <SidePanel />
    <HpBar />
    <LobbyHint />
    {G.phase === 'start' ? <StartModal /> : null}
    {G.phase === 'levelup' && G.run ? <LevelModal /> : null}
    {G.phase === 'chest' && G.chest ? <ChestModal /> : null}
    {G.phase === 'dead' ? <DeadModal /> : null}
    {G.shopOpen && G.phase !== 'levelup' && G.phase !== 'chest' ? <ShopModal /> : null}
    {G.armoryOpen && !G.shopOpen && (G.phase === 'idle' || G.phase === 'dead' || G.phase === 'start') ? <ArmoryModal /> : null}
    <Banner />
  </UiEntity>
)

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(Root)
}
