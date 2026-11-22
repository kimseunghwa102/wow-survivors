import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button } from '@dcl/sdk/react-ecs'
import { WORLD_EDITION } from './edition'
import { Color4 } from '@dcl/sdk/math'
import { buyPotion, drinkPotion } from './game/game'
import { Ui as CasinoUi, playerInCasino } from './casino/holdem/ui'
import { G, startRun, choose, reroll, skipLevel, collectChest, buyMeta, META, MetaKey, metaCost, returnToSanctuary, playAgain, buyArmory, claimDaily, equipped, toggleAuto, equipWeapon, openGoldShop, buyGold, resumeRun, claimQuest, openQuests, openBoard } from './game/game'
import { optionLabel, Option, ARENA_EVENTS, VAULT_PRIZES, COMBO_TIERS, POTION_DEFS, PotionKind } from './game/core'
import { WEAPONS, PASSIVES, STARTERS, MAX_WEAPON_LVL, MAX_PASSIVE_LVL, WeaponId, PassiveId, ARMORY, NUKE_TIER, NUKE, bossFor, GOLD_PACKS, FIRST_BUY_BONUS, isHoldable, GODS, MAX_GOD_LVL, GOD_UNLOCK, ARTS, ArtId, MAX_ART_LVL } from './game/defs'
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
// game skin: gold-framed panels (nine-slice) and bevelled buttons tinted per use
const nine = (src: string, k = 0.25) => ({ texture: { src }, textureMode: 'nine-slices' as const, textureSlices: { top: k, bottom: k, left: k, right: k } })
const FRAME = nine('images/ui_panel.png')
const MODAL = nine('images/ui_modal.png')
const BTN = (c: Color4) => ({ ...nine('images/ui_btn.png', 0.3), color: c })
const IMG = (src: string) => ({ texture: { src }, textureMode: 'stretch' as const })

function TexBar(props: { frac: number; fill: string; w?: number | string; h: number; white?: boolean; mt?: number }) {
  const f = Math.max(0, Math.min(1, props.frac))
  return (
    <UiEntity uiTransform={{ width: (props.w ?? '100%') as any, height: props.h, margin: { top: props.mt ?? 0 }, padding: 1 }} uiBackground={IMG('images/ui_track.png')}>
      <UiEntity uiTransform={{ width: `${f * 100}%`, height: '100%' }} uiBackground={props.white ? { color: WHITE } : IMG(props.fill)} />
    </UiEntity>
  )
}

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
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 0, left: 0 }, width: '100%', flexDirection: 'column', alignItems: 'center' }}>
      <TexBar frac={r.xp / r.need} fill="images/ui_xp.png" w="100%" h={7} />
      <UiEntity uiTransform={{ margin: { top: 8 }, padding: { left: 26, right: 26, top: 6, bottom: 6 }, alignItems: 'center', justifyContent: 'center' }} uiBackground={FRAME}>
        <Label value={`<b>${mmss(r.time)}</b>`} fontSize={30} color={r.time >= 900 ? C('#FF5468') : C('#FFF1C8')} uiTransform={{ height: 36 }} />
      </UiEntity>
    </UiEntity>
  )
}

function SidePanel() {
  const r = G.run
  if (!r) return null
  const hurt = G.hurtFlash > 0
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 22, right: RIGHT }, width: 250, flexDirection: 'column' }}>
      {/* hero card: level badge, HP, XP, kills */}
      <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', alignItems: 'center', padding: { left: 10, right: 14, top: 12, bottom: 12 } }} uiBackground={FRAME}>
        <UiEntity uiTransform={{ width: 64, height: 64, flexShrink: 0, flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }} uiBackground={IMG('images/ui_badge.png')}>
          <Label value="LV" fontSize={9} color={C('#E8C670')} uiTransform={{ height: 10 }} />
          <Label value={`<b>${r.level}</b>`} fontSize={r.level >= 100 ? 17 : 22} color={WHITE} uiTransform={{ height: 24 }} />
        </UiEntity>
        <UiEntity uiTransform={{ flexDirection: 'column', flexGrow: 1, margin: { left: 10 } }}>
          <UiEntity uiTransform={{ flexDirection: 'row', width: '100%', height: 18, alignItems: 'center', justifyContent: 'space-between' }}>
            <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
              <UiEntity uiTransform={{ width: 14, height: 14 }} uiBackground={IMG('images/ui_heart.png')} />
              <Label value={`${Math.ceil(r.hp)}/${r.maxHp}`} fontSize={12} color={WHITE} uiTransform={{ height: 16, margin: { left: 3 } }} textAlign="middle-left" />
            </UiEntity>
            <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
              <UiEntity uiTransform={{ width: 15, height: 15 }} uiBackground={IMG('images/ui_skull.png')} />
              <Label value={`<b>${r.kills.toLocaleString()}</b>`} fontSize={13} color={WHITE} uiTransform={{ height: 16, margin: { left: 3 } }} textAlign="middle-left" />
            </UiEntity>
          </UiEntity>
          <TexBar frac={r.hp / r.maxHp} fill="images/ui_hp.png" h={14} white={hurt} mt={3} />
          <TexBar frac={r.xp / r.need} fill="images/ui_xp.png" h={7} mt={5} />
          <Label value={`XP ${Math.floor(r.xp)} / ${r.need}`} fontSize={9} color={DIM} uiTransform={{ height: 12 }} textAlign="middle-left" />
        </UiEntity>
      </UiEntity>
      {/* armory weapon + nuke */}
      <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', padding: 8, margin: { top: 6 } }} uiBackground={FRAME}>
        <Label value={`<b>${ARMORY[r.equip].name}</b>  ·  ${G.autoAttack ? 'AUTO' : 'hold LEFT CLICK'}`} fontSize={12} color={C(ARMORY[r.equip].color)} uiTransform={{ height: 16 }} textAlign="middle-left" />
        {r.armory >= NUKE_TIER ? (
          <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', width: '100%', margin: { top: 4 } }}>
            <Button
              value={r.canNuke ? '☢ NUKE [F]' : `☢ ${Math.ceil(Math.max(0, r.nukeCd))}s`}
              fontSize={12}
              color={WHITE}
              uiTransform={{ width: 110, height: 26 }}
              uiBackground={BTN(r.canNuke ? C('#D01A1A') : C('#3A2020'))}
              onMouseDown={() => (G.nukeAsk = true)}
            />
            <UiEntity uiTransform={{ width: 110, height: 8, margin: { left: 8 } }} uiBackground={{ color: C('#000000', 0.6) }}>
              <UiEntity uiTransform={{ width: `${Math.round((1 - Math.max(0, r.nukeCd) / NUKE.cd) * 100)}%`, height: '100%' }} uiBackground={{ color: C('#FF3B2E') }} />
            </UiEntity>
          </UiEntity>
        ) : null}
      </UiEntity>
    </UiEntity>
  )
}

/** bank + run gold not yet banked by the last checkpoint (gold shows up the moment you pick it up) */
const liveBank = () => G.bank + (G.run ? Math.max(0, Math.floor(G.run.gold) - G.runBanked) : 0)

/** the bank, always visible at the right-center of the screen */
function GoldHud() {
  const r = G.run
  const pulse = G.goldPulse > 0
  const status = !save.online ? '● loading your saved gold…' : save.profile?.guest ? '● guest — progress not saved' : '● saved to your wallet'
  return (
    <UiEntity
      uiTransform={{ width: 250, height: 92, flexDirection: 'row', alignItems: 'center', padding: { left: 12, right: 12 } }}
      uiBackground={{ texture: { src: 'images/gold_panel.png' }, textureMode: 'stretch' }}
    >
      <UiEntity uiTransform={{ width: pulse ? 64 : 56, height: pulse ? 64 : 56, flexShrink: 0 }} uiBackground={{ texture: { src: 'images/coin.png' }, textureMode: 'stretch' }} />
      <UiEntity uiTransform={{ flexDirection: 'column', margin: { left: 10 }, flexGrow: 1 }}>
        <Label value="<b>GOLD</b>" fontSize={11} color={C('#E8C670')} uiTransform={{ height: 14 }} textAlign="middle-left" />
        <Label value={save.online ? `<b>${liveBank().toLocaleString()}</b>` : '<b>···</b>'} fontSize={pulse ? 30 : 27} color={pulse ? C('#FFF6C8') : GOLD} uiTransform={{ height: 34 }} textAlign="middle-left" />
        {r && r.gold > 0 ? (
          <Label value={`+${Math.floor(r.gold).toLocaleString()} this run · ● LIVE`} fontSize={11} color={C('#3DFF8E')} uiTransform={{ height: 14 }} textAlign="middle-left" />
        ) : (
          <Label value={status} fontSize={10} color={save.online && !save.profile?.guest ? C('#3DFF8E') : C('#FFB347')} uiTransform={{ height: 14 }} textAlign="middle-left" />
        )}
      </UiEntity>
    </UiEntity>
  )
}

/** arts, two per line (there can be 27 of them) */
function artRows(arts: Map<ArtId, number>) {
  const items = [...arts.entries()].map(([id, lv]) => `${ARTS[id].name} ${lv >= MAX_ART_LVL ? '★' : lv}`)
  const rows: string[] = []
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2).join('  ·  '))
  return rows
}

/** right-center column: gold first, then the run's skills and the kill feed */
function RightMid() {
  const r = G.run
  const ws = r ? ([...r.weapons.entries()] as [WeaponId, number][]) : []
  const ps = r ? ([...r.passives.entries()] as [PassiveId, number][]) : []
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: '42%', right: RIGHT }, width: 250, flexDirection: 'column' }}>
      <GoldHud />
      {r ? (
        <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
          {/* loadout */}
          <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', padding: 8, margin: { top: 6 } }} uiBackground={FRAME}>
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
            {r.gods.size ? <Label value="<b>✦ GOD POWERS</b>" fontSize={11} color={GOLD} uiTransform={{ height: 15, margin: { top: 4 } }} textAlign="middle-left" /> : null}
            {[...r.gods.entries()].map(([id, lv]) => (
              <Label key={`g${id}`} value={`✦ ${GODS[id].name}  <b>${lv >= MAX_GOD_LVL ? 'MAX' : 'Lv' + lv}</b>`} fontSize={13} color={C(GODS[id].color)} uiTransform={{ height: 18 }} textAlign="middle-left" />
            ))}
            {r.arts.size ? <Label value={`<b>✧ ARTS</b>  ${r.arts.size}/${Object.keys(ARTS).length}`} fontSize={11} color={C('#E8D28A')} uiTransform={{ height: 15, margin: { top: 4 } }} textAlign="middle-left" /> : null}
            {artRows(r.arts).map((row, i) => (
              <Label key={`a${i}`} value={row} fontSize={11} color={C('#F2E6C8')} uiTransform={{ height: 15 }} textAlign="middle-left" />
            ))}
            {ps.length ? <UiEntity uiTransform={{ height: 4 }} /> : null}
            {ps.map(([id, lv]) => (
              <Label key={id} value={`${PASSIVES[id].name}  ${lv >= MAX_PASSIVE_LVL ? 'MAX' : 'Lv' + lv}`} fontSize={12} color={DIM} uiTransform={{ height: 16 }} textAlign="middle-left" />
            ))}
          </UiEntity>
          <Feed />
        </UiEntity>
      ) : null}
    </UiEntity>
  )
}

function BossBar() {
  const r = G.run
  const list = r ? r.bossesAlive() : []
  if (!r || !list.length) return null
  const twin = list.length > 1
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 66 }, width: '100%', justifyContent: 'center', flexDirection: 'row' }}>
      {list.map((b, i) => {
        const d = bossFor(b.boss ?? 0)
        return (
          <UiEntity key={`boss${i}`} uiTransform={{ flexDirection: 'column', alignItems: 'center', padding: { left: 16, right: 16, top: 10, bottom: 10 }, width: twin ? 420 : 600, margin: { left: 6, right: 6 } }} uiBackground={FRAME}>
            <Label value={`<b>${d.name}</b>  ·  ${d.title}${b.phase ? (b.phase >= 2 ? '  ·  ⚠ UNLEASHED' : '  ·  ⚠ FURIOUS') : ''}`} fontSize={twin ? 14 : 16} color={C(d.color)} uiTransform={{ height: 22 }} />
            <TexBar frac={b.hp / b.maxHp} fill="images/ui_boss.png" w={twin ? 390 : 560} h={16} />
            <Label value={`${Math.max(0, Math.ceil(b.hp)).toLocaleString()} / ${Math.round(b.maxHp).toLocaleString()}`} fontSize={10} color={DIM} uiTransform={{ height: 14 }} />
          </UiEntity>
        )
      })}
    </UiEntity>
  )
}

function NextBoss() {
  const r = G.run
  if (!r || r.boss) return null
  const d = bossFor(r.bossIndex)
  if (r.ascended || !Number.isFinite(d.lvl))
    return (
      <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 66 }, width: '100%', justifyContent: 'center' }}>
        <Label value="☀ <b>You are God.</b> No one is left above you — only the swarm remains." fontSize={12} color={C('#FFD86A', 0.9)} />
      </UiEntity>
    )
  if (d.god)
    return (
      <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 66 }, width: '100%', justifyContent: 'center' }}>
        <Label value={`the final trial: <b>THE ALMIGHTY</b> at Lv ${d.lvl}`} fontSize={13} color={C('#FFE9A8', 0.95)} />
      </UiEntity>
    )
  const twin = d.twin ? bossFor(r.bossIndex + 1) : null
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 66 }, width: '100%', justifyContent: 'center' }}>
      <Label value={twin ? `next: <b>TWIN BOSSES</b> ${d.name} & ${twin.name} at Lv ${d.lvl}` : `next boss: <b>${d.name}</b> at Lv ${d.lvl}`} fontSize={12} color={C(d.color, 0.85)} />
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
      {WORLD_EDITION ? null : (
      <Button
        value={G.firstPurchase ? '💎 TREASURY [4] · +50%' : '💎 TREASURY [4]'}
        fontSize={15}
        color={WHITE}
        uiTransform={{ width: 210, height: 40, margin: { bottom: 6 } }}
        uiBackground={BTN(C('#C08A00'))}
        onMouseDown={tap(openGoldShop)}
      />
      )}
      <Button
        value={G.infoOpen ? '✕ CLOSE UPGRADES [1]' : '📖 UPGRADES [1]'}
        fontSize={15}
        color={WHITE}
        uiTransform={{ width: 210, height: 40, margin: { bottom: 6 } }}
        uiBackground={BTN(G.infoOpen ? C('#7B3BFF') : C('#2A1A40'))}
        onMouseDown={tap(() => (G.infoOpen = !G.infoOpen))}
      />
      {G.run ? (
        <Button
          value={on ? '⚔ AUTO ATTACK  ON [E]' : '⚔ AUTO ATTACK  OFF [E]'}
          fontSize={15}
          color={WHITE}
          uiTransform={{ width: 210, height: 44 }}
          uiBackground={BTN(on ? C('#1FA85A') : C('#3A2A4A'))}
          onMouseDown={toggleAuto}
        />
      ) : null}
      <Button
        value={G.boardOpen ? '✕ CLOSE RANKINGS' : '🏆 LIVE RANKINGS'}
        fontSize={15}
        color={WHITE}
        uiTransform={{ width: 210, height: 40, margin: { bottom: 6, top: 6 } }}
        uiBackground={BTN(G.boardOpen ? C('#7B3BFF') : C('#2A1A40'))}
        onMouseDown={tap(openBoard)}
      />
      <Label value={G.run && G.phase === 'running' ? 'keys: 1 upgrades · 2 switch weapon · 3 BLOOD POTION · 4 RAGE · E auto · F nuke' : 'keys: 1 upgrades · 2 switch weapon · 3 buy next · 4 gold shop · E auto · F nuke'} fontSize={11} color={DIM} uiTransform={{ height: 16 }} />
    </UiEntity>
  )
}

function PackCard(props: { i: number; key?: string }) {
  const k = GOLD_PACKS[props.i]
  const sel = G.packSel === props.i
  const gold = Math.round(k.gold * (G.firstPurchase ? 1 + FIRST_BUY_BONUS : 1))
  const best = k.tag === 'BEST VALUE'
  return (
    <UiEntity
      uiTransform={{ width: 150, height: 250, margin: 6, flexDirection: 'column', alignItems: 'center', padding: 4 }}
      uiBackground={{ color: sel ? C('#FFD24A') : best ? C('#B07BFF', 0.8) : C('#5A3A10', 0.9) }}
      onMouseDown={tap(() => (G.packSel = props.i))}
    >
      <UiEntity uiTransform={{ width: '100%', height: '100%', flexDirection: 'column', alignItems: 'center' }} uiBackground={{ color: sel ? C('#2A1A08') : C('#160C1E') }}>
        <UiEntity uiTransform={{ width: '100%', height: 22, justifyContent: 'center', alignItems: 'center' }} uiBackground={{ color: k.tag ? (best ? C('#9A3BFF') : k.tag === 'POPULAR' ? C('#1FA85A') : C('#C04B2A')) : C('#000000', 0) }}>
          <Label value={k.tag ? `<b>${k.tag}</b>` : ''} fontSize={12} color={WHITE} />
        </UiEntity>
        <UiEntity uiTransform={{ width: 130, height: 120, margin: { top: 2 } }} uiBackground={{ textureMode: 'stretch', texture: { src: k.img } }} />
        <Label value={`<b>${gold.toLocaleString()}</b>`} fontSize={22} color={GOLD} uiTransform={{ height: 28 }} />
        <Label value={G.firstPurchase ? `${k.gold.toLocaleString()} +50% first buy` : k.bonus ? `includes +${k.bonus}% bonus` : 'gold'} fontSize={11} color={G.firstPurchase ? C('#3DFF8E') : DIM} uiTransform={{ height: 16 }} />
        <UiEntity uiTransform={{ width: 120, height: 34, margin: { top: 8 }, justifyContent: 'center', alignItems: 'center' }} uiBackground={{ color: sel ? C('#FFD24A') : C('#3A2A10') }}>
          <Label value={`<b>$${k.usd}</b>`} fontSize={20} color={sel ? C('#1A0E00') : WHITE} />
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

function GoldShop() {
  if (!G.goldShopOpen) return null
  const gs = G.goldShop
  const k = GOLD_PACKS[G.packSel]
  const gold = Math.round(k.gold * (G.firstPurchase ? 1 + FIRST_BUY_BONUS : 1))
  const after = G.bank + gold
  const unlocks = ARMORY.filter((w, i) => i > G.armory && w.cost <= after)
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }} uiBackground={{ color: C('#000000', 0.55) }}>
      <UiEntity uiTransform={{ width: 880, height: 600, flexDirection: 'column', alignItems: 'center', padding: 22 }} uiBackground={{ textureMode: 'stretch', texture: { src: 'images/shop_bg.jpg' } }}>
        <Label value="<b>◆  THE TREASURY  ◆</b>" fontSize={34} color={GOLD} uiTransform={{ height: 42 }} />
        <Label value={`Gold for the Armory & Arcane Forge · your bank ● ${G.bank.toLocaleString()}`} fontSize={14} color={C('#E8D8FF')} uiTransform={{ height: 20 }} />
        {G.firstPurchase ? (
          <UiEntity uiTransform={{ width: 520, height: 30, margin: { top: 6 }, justifyContent: 'center', alignItems: 'center' }} uiBackground={{ color: C('#1FA85A') }}>
            <Label value="<b>★ FIRST PURCHASE BONUS: +50% GOLD ON ANY PACK ★</b>" fontSize={14} color={WHITE} />
          </UiEntity>
        ) : null}
        <UiEntity uiTransform={{ flexDirection: 'row', margin: { top: 6 } }}>
          {GOLD_PACKS.map((_, i) => (
            <PackCard key={`pk${i}`} i={i} />
          ))}
        </UiEntity>
        <Label
          value={unlocks.length ? `→ with this pack you can unlock: <b>${unlocks.map((w) => w.name).join(', ')}</b>` : `→ ${after.toLocaleString()} gold in your bank after this pack`}
          fontSize={13}
          color={C('#FFB84A')}
          uiTransform={{ height: 20, margin: { top: 2 } }}
        />
        {gs.enabled ? (
          <UiEntity uiTransform={{ flexDirection: 'row', margin: { top: 6 } }}>
            <Button value={G.payBusy ? 'WAITING…' : `PAY $${k.usd} WITH ETH  [2]`} fontSize={16} color={WHITE} uiTransform={{ width: 270, height: 48, margin: 6 }} uiBackground={BTN(C('#4A5BD8'))} onMouseDown={tap(() => void buyGold('ETH'))} />
            <Button value={G.payBusy ? 'WAITING…' : `PAY $${k.usd} WITH MANA  [3]`} fontSize={16} color={WHITE} uiTransform={{ width: 270, height: 48, margin: 6 }} uiBackground={BTN(C('#FF2D55'))} onMouseDown={tap(() => void buyGold('MANA'))} />
          </UiEntity>
        ) : (
          <Label value="The Treasury opens soon" fontSize={16} color={DIM} uiTransform={{ height: 48 }} />
        )}
        {G.payMsg ? <Label value={`<b>${G.payMsg}</b>`} fontSize={13} color={G.payMsg.startsWith('✓') ? C('#3DFF8E') : C('#FFD24A')} uiTransform={{ height: 20 }} /> : null}
        <Label value="🔒 verified on-chain · paid to the creator's wallet · gas fee extra · 1 = next pack · 4 = close" fontSize={11} color={C('#BFAEDF')} uiTransform={{ height: 18, margin: { top: 2 } }} />
        <Button value="CLOSE" fontSize={13} color={WHITE} uiTransform={{ width: 120, height: 30, margin: { top: 4 } }} uiBackground={BTN(C('#2A2A3A'))} onMouseDown={tap(() => (G.goldShopOpen = false))} />
      </UiEntity>
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
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 90, right: 282 }, width: 380, flexDirection: 'column', padding: 12 }} uiBackground={FRAME}>
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
            {(next || (owned && i !== eq && isHoldable(i))) ? (
              <Button
                value={status}
                fontSize={11}
                color={WHITE}
                uiTransform={{ width: 210, height: 20 }}
                uiBackground={BTN(next ? (G.bank >= w.cost ? C('#1FA85A') : C('#5A2A2A')) : C('#3A2A5A'))}
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
      <TexBar frac={r.hp / r.maxHp} fill="images/ui_hp.png" white={G.hurtFlash > 0} w={200} h={9} />
    </UiEntity>
  )
}

function Feed() {
  if (!feed.length) return null
  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', padding: 8, margin: { top: 6 } }} uiBackground={FRAME}>
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
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 140 }, width: '100%', justifyContent: 'center' }}>
      <UiEntity uiTransform={{ padding: { left: 30, right: 30, top: 12, bottom: 12 } }} uiBackground={MODAL}>
        <Label value={`<b>${G.banner}</b>`} fontSize={22} color={GOLD} />
      </UiEntity>
    </UiEntity>
  )
}

function LobbyHint() {
  if (G.run || G.phase !== 'idle') return null
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { bottom: 24 }, width: '100%', justifyContent: 'center' }}>
      <UiEntity uiTransform={{ padding: 10, flexDirection: 'column', alignItems: 'center' }} uiBackground={FRAME}>
        <Label value="<b>WOW NIGHTSWARM</b>  ·  walk through the east gate to start a run" fontSize={16} color={WHITE} />
        <Label value={`Bank ● ${G.bank}   ·   Best ${mmss(G.best.t)} (Lv ${G.best.l})   ·   Arcane Forge = permanent boosts`} fontSize={13} color={GOLD} />
        <UiEntity uiTransform={{ flexDirection: 'row', margin: { top: 6 } }}>
          {G.daily ? (
            <Button
              value={G.daily.claimable ? `🎁 CLAIM DAILY ● ${G.daily.next}` : `✓ Day ${G.daily.streak} streak · tomorrow ● ${G.daily.next}`}
              fontSize={13}
              color={WHITE}
              uiTransform={{ width: 260, height: 32, margin: 4 }}
              uiBackground={BTN(G.daily.claimable ? C('#C08A00') : C('#2A2A3A'))}
              onMouseDown={tap(claimDaily)}
            />
          ) : null}
          <Button value="⚔ ARMORY" fontSize={13} color={WHITE} uiTransform={{ width: 140, height: 32, margin: 4 }} uiBackground={BTN(C('#7B3BFF'))} onMouseDown={tap(() => (G.armoryOpen = true))} />
          <Button
            value={`📜 QUESTS${G.quests ? ` ${G.quests.quests.filter((q) => q.claimed).length}/3` : ''}${G.quests?.quests.some((q) => q.done && !q.claimed) ? ' !' : ''}`}
            fontSize={13}
            color={WHITE}
            uiTransform={{ width: 150, height: 32, margin: 4 }}
            uiBackground={BTN(G.quests?.quests.some((q) => q.done && !q.claimed) ? C('#1FA85A') : C('#3A2A5A'))}
            onMouseDown={tap(openQuests)}
          />
          <Button value="🏆 RANKINGS" fontSize={13} color={WHITE} uiTransform={{ width: 150, height: 32, margin: 4 }} uiBackground={BTN(C('#3A2A5A'))} onMouseDown={tap(openBoard)} />
          <Button
            value={`🧪 POTIONS ${G.profileBelt.hp + G.profileBelt.rage + G.profileBelt.phoenix ? `(${G.profileBelt.hp}/${G.profileBelt.rage}/${G.profileBelt.phoenix})` : '!'}`}
            fontSize={13}
            color={WHITE}
            uiTransform={{ width: 170, height: 32, margin: 4 }}
            uiBackground={BTN(G.profileBelt.hp ? C('#5A1A2A') : C('#A0202E'))}
            onMouseDown={tap(() => (G.potionOpen = !G.potionOpen))}
          />
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
      <UiEntity uiTransform={{ flexDirection: 'column', alignItems: 'center', padding: 34, maxWidth: 1000 }} uiBackground={MODAL}>
        <Label value={`<b>${props.title}</b>`} fontSize={34} color={props.color ?? GOLD} uiTransform={{ height: 44 }} />
        {props.sub ? <Label value={props.sub} fontSize={15} color={DIM} uiTransform={{ height: 22, margin: { bottom: 10 } }} /> : null}
        {props.children}
      </UiEntity>
    </UiEntity>
  )
}

function Card(props: { o: Option; onPick: () => void; key?: string }) {
  const l = optionLabel(props.o)
  const god = props.o.kind === 'god'
  return (
    <UiEntity uiTransform={{ width: 214, height: 210, margin: 8, flexDirection: 'column', padding: 14 }} uiBackground={god ? MODAL : FRAME}>
      <UiEntity uiTransform={{ width: '100%', height: 6, margin: { bottom: 10 } }} uiBackground={{ color: C(l.color) }} />
      <Label value={l.sub} fontSize={12} color={l.isNew ? C('#3DFF8E') : DIM} uiTransform={{ height: 16 }} />
      <Label value={`<b>${l.title}</b>`} fontSize={19} color={C(l.color)} uiTransform={{ height: 30 }} />
      <Label value={l.desc} fontSize={13} color={WHITE} uiTransform={{ height: 60, width: '100%' }} />
      <Button value={god ? '✦ ASCEND' : 'CHOOSE'} fontSize={15} color={WHITE} uiTransform={{ width: '100%', height: 38 }} uiBackground={BTN(god ? C('#C08A00') : C('#7B3BFF'))} onMouseDown={tap(props.onPick)} />
    </UiEntity>
  )
}

function StartModal() {
  const rs = save.resume
  if (rs) {
    const sn = rs.snap
    return (
      <Modal title="YOUR RUN IS WAITING" sub="You left mid-run — everything was saved." color={GOLD}>
        <Label value={`Lv ${sn.level}  ·  ${mmss(sn.time)}  ·  ${sn.kills.toLocaleString()} kills  ·  ● ${sn.gold.toLocaleString()} gold`} fontSize={18} color={WHITE} uiTransform={{ height: 28 }} />
        <Label
          value={sn.weapons.map(([id, lv]) => `${WEAPONS[id]?.name ?? id} Lv${lv}`).join('  ·  ')}
          fontSize={13}
          color={C('#8EC5FF')}
          uiTransform={{ height: 20, margin: { bottom: 10 } }}
        />
        <Button value="▶ RESUME RUN" fontSize={20} color={WHITE} uiTransform={{ width: 320, height: 54, margin: 6 }} uiBackground={BTN(C('#1FA85A'))} onMouseDown={tap(resumeRun)} />
        <Label value={`or start fresh below — the saved run's ● ${sn.gold.toLocaleString()} gold goes to your bank`} fontSize={12} color={DIM} uiTransform={{ height: 18, margin: { top: 8 } }} />
        <UiEntity uiTransform={{ flexDirection: 'row' }}>
          {STARTERS.map((w) => (
            <Button key={w} value={`NEW: ${WEAPONS[w].name}`} fontSize={13} color={WHITE} uiTransform={{ width: 170, height: 34, margin: 4 }} uiBackground={BTN(C('#3A2A5A'))} onMouseDown={tap(() => startRun(w))} />
          ))}
        </UiEntity>
      </Modal>
    )
  }
  return (
    <Modal title="CHOOSE YOUR FIRST SKILL" sub="Enemies arrive the moment you choose. Hunters can only attack each other inside ⚔ THE BLOOD RING (north end).">
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
        <Button value={`REROLL (${r.rerolls})`} fontSize={14} color={WHITE} uiTransform={{ width: 150, height: 34, margin: 6 }} uiBackground={BTN(r.rerolls > 0 ? C('#3A2A5A') : C('#222222'))} onMouseDown={tap(reroll)} />
        <Button value="SKIP (+10 gold)" fontSize={14} color={WHITE} uiTransform={{ width: 150, height: 34, margin: 6 }} uiBackground={BTN(C('#2A2A2A'))} onMouseDown={tap(skipLevel)} />
        <Button
          value={G.autoPick ? 'AUTO-UPGRADE: ON' : 'AUTO-UPGRADE: OFF'}
          fontSize={13}
          color={WHITE}
          uiTransform={{ width: 190, height: 34, margin: 6 }}
          uiBackground={BTN(G.autoPick ? C('#1F7A4A') : C('#3A2A2A'))}
          onMouseDown={tap(() => (G.autoPick = !G.autoPick))}
        />
      </UiEntity>
      <Label value={G.autoPick ? 'routine upgrades are taken for you — this window only opens for new skills, god powers and epic boons' : 'every level-up opens this window'} fontSize={11} color={DIM} uiTransform={{ height: 16 }} />
    </Modal>
  )
}

const REEL = ['★', '♦', '☠', '●', '♥', '7']
function ChestModal() {
  const c = G.chest!
  const spinning = c.spin > 0
  const reel = () => REEL[Math.floor(Math.random() * REEL.length)]
  const pz = c.prize ? VAULT_PRIZES[c.prize] : null
  // boss vaults: reels lock one by one on the prize symbol
  const locked = (i: number) => !!pz && c.spin < 2.4 - i * 0.8
  return (
    <Modal title={spinning ? (c.big ? 'BOSS VAULT ROULETTE' : 'JACKPOT VAULT') : pz ? pz.name + '!' : c.rolls.length >= 5 ? 'MEGA JACKPOT!!' : c.rolls.length >= 3 ? 'BIG WIN!' : 'VAULT OPENED'} color={spinning ? GOLD : pz ? C(pz.color) : C('#3DFF8E')}>
      {spinning ? (
        <UiEntity uiTransform={{ flexDirection: 'row', margin: 10 }}>
          {[0, 1, 2].map((i) => (
            <UiEntity key={i} uiTransform={{ width: 110, height: 110, margin: 8, justifyContent: 'center', alignItems: 'center' }} uiBackground={{ color: locked(i) ? C(pz!.color, 0.25) : C('#000000') }}>
              <Label value={locked(i) ? pz!.sym : reel()} fontSize={64} color={locked(i) ? C(pz!.color) : GOLD} />
            </UiEntity>
          ))}
        </UiEntity>
      ) : (
        <UiEntity uiTransform={{ flexDirection: 'column', alignItems: 'center' }}>
          {pz ? <Label value={`<b>${pz.sym} ${pz.sym} ${pz.sym}  ${pz.name}</b> — ${pz.desc}`} fontSize={18} color={C(pz.color)} uiTransform={{ height: 30, margin: { bottom: 6 } }} /> : null}
          {c.rolls.map((o, i) => {
            const l = optionLabel(o)
            return <Label key={i} value={`<b>${l.title}</b>  ·  ${l.sub}`} fontSize={o.kind === 'evolve' ? 24 : 17} color={C(l.color)} uiTransform={{ height: o.kind === 'evolve' ? 34 : 26 }} />
          })}
          <Label value={`+${c.gold} gold`} fontSize={16} color={GOLD} uiTransform={{ height: 26 }} />
          <Button value="COLLECT" fontSize={18} color={WHITE} uiTransform={{ width: 200, height: 42, margin: { top: 10 } }} uiBackground={BTN(C('#7B3BFF'))} onMouseDown={tap(collectChest)} />
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
      <Label value={s.saving ? 'Saving to your wallet…' : `+${s.gold} gold banked${G.doubleBonus ? ' (DAILY DOUBLE!)' : ''}${s.killer ? ' (your killer took 30% of the unbanked part)' : ''}${rank ? `   ·   Hall of Legends #${rank}` : ''}`} fontSize={15} color={GOLD} uiTransform={{ height: 24 }} />
      <UiEntity uiTransform={{ flexDirection: 'row', margin: { top: 12 } }}>
        <Button value="PLAY AGAIN" fontSize={18} color={WHITE} uiTransform={{ width: 200, height: 44, margin: 6 }} uiBackground={BTN(C('#7B3BFF'))} onMouseDown={tap(playAgain)} />
        <Button value="⚔ ARMORY" fontSize={16} color={WHITE} uiTransform={{ width: 150, height: 44, margin: 6 }} uiBackground={BTN(C('#C08A00'))} onMouseDown={tap(() => (G.armoryOpen = true))} />
        <Button value="SANCTUARY & FORGE" fontSize={16} color={WHITE} uiTransform={{ width: 220, height: 44, margin: 6 }} uiBackground={BTN(C('#2A2A3A'))} onMouseDown={tap(returnToSanctuary)} />
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
          <UiEntity key={k} uiTransform={{ flexDirection: 'row', alignItems: 'center', width: 560, height: 46, margin: 2 }} uiBackground={BTN(C('#3A2858'))}>
            <Label value={`<b>${META[k].name}</b>  ${META[k].desc}`} fontSize={15} color={WHITE} uiTransform={{ width: 330 }} textAlign="middle-left" />
            <Label value={`Lv ${lv}/${META[k].max}`} fontSize={14} color={DIM} uiTransform={{ width: 80 }} />
            <Button value={max ? 'MAX' : G.shopBusy ? '…' : `● ${cost}`} fontSize={14} color={WHITE} uiTransform={{ width: 120, height: 34 }} uiBackground={BTN(max ? C('#333333') : G.bank >= cost ? C('#7B3BFF') : C('#3A2A4A'))} onMouseDown={tap(() => buyMeta(k))} />
          </UiEntity>
        )
      })}
      <Button value="CLOSE" fontSize={15} color={WHITE} uiTransform={{ width: 160, height: 38, margin: { top: 12 } }} uiBackground={BTN(C('#2A2A3A'))} onMouseDown={tap(() => (G.shopOpen = false))} />
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
          <UiEntity key={w.name} uiTransform={{ flexDirection: 'row', alignItems: 'center', width: 640, height: 44, margin: 2 }} uiBackground={BTN(inHand ? C('#5A3A88') : C('#3A2858'))}>
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
                  uiBackground={BTN(inHand ? C('#3DFF8E', 0.35) : C('#3A2A5A'))}
                  onMouseDown={tap(() => equipWeapon(i))}
                />
              )
            ) : (
              <Button
                value={G.armoryBusy && next ? '…' : next ? (G.bank >= w.cost ? `BUY ● ${w.cost.toLocaleString()}` : `NEED ● ${w.cost.toLocaleString()}`) : `🔒 ● ${w.cost.toLocaleString()}`}
                fontSize={13}
                color={WHITE}
                uiTransform={{ width: 150, height: 32 }}
                uiBackground={BTN(next ? (G.bank >= w.cost ? C('#1FA85A') : C('#6A2A2A')) : C('#222222'))}
                onMouseDown={tap(() => buyArmory(i))}
              />
            )}
          </UiEntity>
        )
      })}
      {G.armoryMsg ? <Label value={`<b>${G.armoryMsg}</b>`} fontSize={15} color={G.armoryMsg.startsWith('✓') ? C('#3DFF8E') : C('#FFB84A')} uiTransform={{ height: 24, margin: { top: 6 } }} /> : null}
      <Label value="Unlock in order. Damage grows with your level during a run." fontSize={12} color={DIM} uiTransform={{ height: 20, margin: { top: 6 } }} />
      <Button value="CLOSE" fontSize={15} color={WHITE} uiTransform={{ width: 160, height: 38, margin: { top: 8 } }} uiBackground={BTN(C('#2A2A3A'))} onMouseDown={tap(() => ((G.armoryOpen = false), (G.armoryMsg = '')))} />
    </Modal>
  )
}

function Hurt() {
  if (G.hurtFlash <= 0) return null
  return <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%' }} uiBackground={{ color: C('#FF0000', 0.18 * (G.hurtFlash / 0.25)) }} />
}

// ───────────────────────── potions · low-HP dread ─────────────────────────
function LowHp() {
  const r = G.run
  if (!r || !r.alive || G.phase === 'dead') return null
  const f = r.hp / r.maxHp
  if (f > 0.35) return null
  // the screen bleeds and pulses with your heartbeat
  const beat = Math.pow(Math.max(0, Math.sin(Date.now() / (f < 0.15 ? 140 : 220))), 6)
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'flex-end' }} uiBackground={{ color: C('#8A0000', (0.35 - f) * 0.9 + beat * 0.12) }}>
      {r.potions.hp > 0 && r.potCd <= 0 ? <Label value="<b>PRESS [3] — DRINK!</b>" fontSize={22} color={C('#FFFFFF', 0.5 + beat * 0.5)} uiTransform={{ height: 30, margin: { bottom: 210 } }} /> : null}
    </UiEntity>
  )
}

function PotionBelt() {
  const r = G.run
  if (!r || G.phase === 'dead') return null
  const slot = (k: PotionKind, key: string) => {
    const d = POTION_DEFS[k]
    const n = r.potions[k]
    const cd = k === 'hp' ? r.potCd : 0
    const active = k === 'rage' && r.rageT > 0
    return (
      <UiEntity key={k} uiTransform={{ width: 96, height: 74, margin: 4, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} uiBackground={BTN(active ? C('#7A3A00') : n ? C('#2A1A24') : C('#151018'))}>
        <Label value={`<b>${k === 'phoenix' ? '🔥' : '🧪'} ×${n}</b>`} fontSize={18} color={n ? C(d.color) : DIM} uiTransform={{ height: 24 }} />
        <Label value={d.name} fontSize={10} color={WHITE} uiTransform={{ height: 13 }} />
        <Label value={active ? `RAGE ${r.rageT.toFixed(0)}s` : cd > 0 ? `${cd.toFixed(1)}s` : key === 'auto' ? 'auto' : `[${key}]`} fontSize={11} color={active ? C('#FFB060') : GOLD} uiTransform={{ height: 14 }} />
      </UiEntity>
    )
  }
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { bottom: 18 }, width: '100%', justifyContent: 'center', flexDirection: 'row' }}>
      <UiEntity uiTransform={{ flexDirection: 'row' }} onMouseDown={tap(() => drinkPotion('hp'))}>
        {slot('hp', '3')}
      </UiEntity>
      <UiEntity uiTransform={{ flexDirection: 'row' }} onMouseDown={tap(() => drinkPotion('rage'))}>
        {slot('rage', '4')}
      </UiEntity>
      {slot('phoenix', 'auto')}
    </UiEntity>
  )
}

function PotionShop() {
  const b = G.profileBelt
  const row = (k: PotionKind) => {
    const d = POTION_DEFS[k]
    const full = b[k] >= d.shopMax
    return (
      <UiEntity key={k} uiTransform={{ flexDirection: 'row', alignItems: 'center', width: '100%', height: 58, margin: 3, padding: { left: 10, right: 10 } }} uiBackground={BTN(C('#24182E'))}>
        <UiEntity uiTransform={{ flexDirection: 'column', flexGrow: 1 }}>
          <Label value={`<b>${k === 'phoenix' ? '🔥' : '🧪'} ${d.name}</b>   in belt ${b[k]}/${d.shopMax}`} fontSize={15} color={C(d.color)} uiTransform={{ height: 20 }} textAlign="middle-left" />
          <Label value={d.desc + (k === 'phoenix' ? '' : `  ·  key [${d.key}]`)} fontSize={11} color={WHITE} uiTransform={{ height: 16 }} textAlign="middle-left" />
        </UiEntity>
        <Button value={full ? 'FULL' : `BUY ● ${d.shop.toLocaleString()}`} fontSize={13} color={WHITE} uiTransform={{ width: 140, height: 36 }} uiBackground={BTN(full ? C('#2A2A2A') : G.bank >= d.shop ? C('#1FA85A') : C('#4A2A2A'))} onMouseDown={tap(() => buyPotion(k))} />
      </UiEntity>
    )
  }
  return (
    <Modal title="POTION SHOP" color={C('#FF3B4A')} sub="the horde grows with you — without potions you will not last. Your belt goes into your next run.">
      <UiEntity uiTransform={{ flexDirection: 'column', width: 600, alignItems: 'center' }}>
        {row('hp')}
        {row('rage')}
        {row('phoenix')}
        <Label value="monsters also drop potions: brutes always, bosses three — unused potions are lost when the run ends" fontSize={11} color={DIM} uiTransform={{ height: 18, margin: { top: 6 } }} />
        <Button value="CLOSE" fontSize={14} color={WHITE} uiTransform={{ width: 160, height: 36, margin: { top: 8 } }} uiBackground={BTN(C('#2A2A3A'))} onMouseDown={tap(() => (G.potionOpen = false))} />
      </UiEntity>
    </Modal>
  )
}

// ───────────────────────── combo · arena events ─────────────────────────
function ComboHud() {
  const r = G.run
  const show = r && r.combo >= 10
  const flash = G.comboFlash > 0
  if (!show && !flash) return null
  const n = r?.combo ?? 0
  const tier = COMBO_TIERS.filter(([k]) => n >= k).length
  const col = tier >= 5 ? '#FFFFFF' : tier >= 4 ? '#FFD86A' : tier >= 3 ? '#FF4FD2' : tier >= 2 ? '#FF7A1A' : '#5EF2FF'
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: '38%', left: 24 }, flexDirection: 'column', alignItems: 'flex-start' }}>
      {show ? (
        <UiEntity uiTransform={{ flexDirection: 'column', padding: { left: 14, right: 14, top: 8, bottom: 8 }, width: 210 }} uiBackground={FRAME}>
          <Label value={`<b>${n.toLocaleString()}</b>`} fontSize={n >= 100 ? 40 : 34} color={C(col)} uiTransform={{ height: 44 }} textAlign="middle-left" />
          <Label value={`COMBO  ·  gold ×${r!.comboMul.toFixed(1)}`} fontSize={12} color={WHITE} uiTransform={{ height: 16 }} textAlign="middle-left" />
          <Bar frac={Math.max(0, r!.comboT) / 3} color={C(col)} w="100%" h={5} />
        </UiEntity>
      ) : null}
      {flash ? <Label value={`<b>${G.comboName}</b>`} fontSize={G.comboName.startsWith('COMBO BROKEN') ? 16 : 26} color={G.comboName.startsWith('COMBO BROKEN') ? C('#FF5468') : C(col)} uiTransform={{ height: 34, margin: { top: 6 } }} textAlign="middle-left" /> : null}
    </UiEntity>
  )
}

function ArenaHud() {
  const a = G.run?.arena
  if (!a) return null
  const d = ARENA_EVENTS[a.kind]
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 112 }, width: '100%', justifyContent: 'center' }}>
      <UiEntity uiTransform={{ flexDirection: 'column', alignItems: 'center', padding: { left: 18, right: 18, top: 6, bottom: 6 } }} uiBackground={MODAL}>
        <Label value={`<b>${d.name}</b>  ${a.kind === 'elitehunt' ? `${G.run!.bounties.length} bounties left` : mmss(Math.max(0, a.t))}`} fontSize={18} color={C(d.color)} uiTransform={{ height: 24 }} />
        <Label value={d.desc} fontSize={12} color={WHITE} uiTransform={{ height: 16 }} />
      </UiEntity>
    </UiEntity>
  )
}

// ───────────────────────── quests · attendance · rankings ─────────────────────────
const ATTEND = [100, 150, 250, 400, 600, 800, 1200]
function QuestModal() {
  const q = G.quests
  const d = G.daily
  const streak = d ? (d.claimable ? d.streak : Math.max(0, d.streak - 1)) % 7 : 0
  return (
    <Modal title="DAILY QUESTS" color={GOLD} sub={q ? `new quests in ${mmss(Math.max(0, (q.resetsAt - Date.now()) / 1000))}` : save.online ? 'loading…' : 'connect to the save server to get quests'}>
      <UiEntity uiTransform={{ flexDirection: 'column', width: 620 }}>
        {(q?.quests ?? []).map((x, i) => (
          <UiEntity key={`q${i}`} uiTransform={{ flexDirection: 'row', alignItems: 'center', width: '100%', height: 54, margin: 3, padding: { left: 10, right: 10 } }} uiBackground={BTN(x.claimed ? C('#1A2A1F') : C('#2A1F3A'))}>
            <UiEntity uiTransform={{ flexDirection: 'column', flexGrow: 1 }}>
              <Label value={`<b>${x.text}</b>`} fontSize={14} color={x.claimed ? DIM : WHITE} uiTransform={{ height: 18 }} textAlign="middle-left" />
              <Bar frac={x.progress / x.target} color={x.done ? C('#3DFF8E') : GOLD} w={360} h={8} />
              <Label value={`${x.progress.toLocaleString()} / ${x.target.toLocaleString()}`} fontSize={10} color={DIM} uiTransform={{ height: 13 }} textAlign="middle-left" />
            </UiEntity>
            <Button
              value={x.claimed ? '✓ CLAIMED' : x.done ? `CLAIM ● ${x.reward.toLocaleString()}` : `● ${x.reward.toLocaleString()}`}
              fontSize={13}
              color={WHITE}
              uiTransform={{ width: 150, height: 34 }}
              uiBackground={BTN(x.claimed ? C('#2A2A2A') : x.done ? C('#1FA85A') : C('#3A2A4A'))}
              onMouseDown={tap(() => x.done && !x.claimed && claimQuest(i))}
            />
          </UiEntity>
        ))}
        <Label value="<b>ATTENDANCE</b>  ·  come back every day — day 7 is the big one" fontSize={14} color={GOLD} uiTransform={{ height: 22, margin: { top: 10 } }} textAlign="middle-left" />
        <UiEntity uiTransform={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
          {ATTEND.map((g, i) => {
            const got = i < streak
            const today = d?.claimable && i === streak
            return (
              <UiEntity key={`a${i}`} uiTransform={{ width: 82, height: 74, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: 2 }} uiBackground={BTN(got ? C('#1A3A24') : today ? C('#C08A00') : i === 6 ? C('#4A2A6A') : C('#241A30'))}>
                <Label value={`DAY ${i + 1}`} fontSize={11} color={DIM} uiTransform={{ height: 14 }} />
                <Label value={got ? '✓' : i === 6 ? '👑' : '●'} fontSize={18} color={got ? C('#3DFF8E') : GOLD} uiTransform={{ height: 22 }} />
                <Label value={`<b>${g}</b>`} fontSize={13} color={WHITE} uiTransform={{ height: 16 }} />
              </UiEntity>
            )
          })}
        </UiEntity>
        <UiEntity uiTransform={{ flexDirection: 'row', justifyContent: 'center', width: '100%', margin: { top: 10 } }}>
          {d?.claimable ? <Button value={`🎁 CLAIM DAY ${streak + 1}  ● ${d.next}`} fontSize={14} color={WHITE} uiTransform={{ width: 240, height: 38, margin: 4 }} uiBackground={BTN(C('#C08A00'))} onMouseDown={tap(claimDaily)} /> : null}
          <Button value="CLOSE" fontSize={14} color={WHITE} uiTransform={{ width: 140, height: 38, margin: 4 }} uiBackground={BTN(C('#2A2A3A'))} onMouseDown={tap(openQuests)} />
        </UiEntity>
      </UiEntity>
    </Modal>
  )
}

function BoardModal() {
  const b = save.board
  const tab = G.boardTab
  const rows = tab === 'weekly' ? b?.weekly ?? [] : tab === 'allTime' ? b?.allTime ?? b?.runs ?? [] : []
  const left = b?.weekEndsAt ? Math.max(0, (b.weekEndsAt - Date.now()) / 1000) : 0
  const prizes = b?.prizes ?? []
  const tabBtn = (k: typeof tab, label: string) => (
    <Button key={k} value={label} fontSize={13} color={WHITE} uiTransform={{ width: 146, height: 32, margin: 3 }} uiBackground={BTN(tab === k ? (k === 'gods' ? C('#B8860B') : C('#7B3BFF')) : C('#2A1F3A'))} onMouseDown={tap(() => (G.boardTab = k))} />
  )
  return (
    <Modal title="RANKINGS" color={GOLD} sub={`${b?.live ?? 0} hunting right now · updates live`}>
      <UiEntity uiTransform={{ flexDirection: 'column', width: 620, alignItems: 'center' }}>
        <UiEntity uiTransform={{ flexDirection: 'row' }}>
          {tabBtn('weekly', '📅 THIS WEEK')}
          {tabBtn('allTime', '🏆 ALL-TIME')}
          {tabBtn('slayers', '✦ SLAYERS')}
          {tabBtn('gods', '☀ GODS')}
        </UiEntity>
        {tab === 'weekly' ? <Label value={`resets Monday 00:00 KST · ${Math.floor(left / 86400)}d ${Math.floor((left % 86400) / 3600)}h left · top 10 win gold, top 3 get ♛ Champion`} fontSize={11} color={DIM} uiTransform={{ height: 16 }} /> : null}
        {tab === 'gods' ? (
          <UiEntity uiTransform={{ flexDirection: 'column', width: '100%', alignItems: 'center', margin: { top: 6 } }}>
            <Label value="<b>HALL OF GODS</b> — those who defeated THE ALMIGHTY at Lv 1111" fontSize={14} color={GOLD} uiTransform={{ height: 20 }} />
            <Label value="they wear Divine Radiance and begin every run as God" fontSize={11} color={DIM} uiTransform={{ height: 16 }} />
            {(b?.gods ?? []).length ? (
              (b?.gods ?? []).map((n, i) => <Label key={`g${i}`} value={`☀ <b>${n}</b>`} fontSize={18} color={C('#FFE9A8')} uiTransform={{ height: 26 }} />)
            ) : (
              <Label value="No one has become God… yet." fontSize={15} color={DIM} uiTransform={{ height: 24, margin: { top: 6 } }} />
            )}
          </UiEntity>
        ) : tab === 'slayers' ? (
          <UiEntity uiTransform={{ flexDirection: 'column', width: '100%', alignItems: 'center', margin: { top: 6 } }}>
            <Label value="Hunters who slew NIGHTSWARM at Lv 200 — Void Wings + 100,000 gold" fontSize={12} color={GOLD} uiTransform={{ height: 18 }} />
            {(b?.slayers ?? []).length ? (
              (b?.slayers ?? []).map((n, i) => <Label key={`s${i}`} value={`${i + 1}. <b>${n}</b>`} fontSize={15} color={C('#C9A8FF')} uiTransform={{ height: 22 }} />)
            ) : (
              <Label value="Nobody yet. Will you be the first?" fontSize={14} color={DIM} uiTransform={{ height: 22 }} />
            )}
          </UiEntity>
        ) : (
          <UiEntity uiTransform={{ flexDirection: 'column', width: '100%', margin: { top: 4 } }}>
            {rows.length ? (
              rows.map((x, i) => (
                <UiEntity key={`r${i}`} uiTransform={{ flexDirection: 'row', width: '100%', height: 26, alignItems: 'center', padding: { left: 8, right: 8 } }} uiBackground={{ color: i % 2 ? C('#FFFFFF', 0.03) : C('#FFFFFF', 0.07) }}>
                  <Label value={`<b>${i + 1}</b>`} fontSize={14} color={i < 3 ? GOLD : WHITE} uiTransform={{ width: 34 }} textAlign="middle-left" />
                  <Label value={`${x.n.substring(0, 16)}${x.live ? '  🔴 LIVE' : ''}`} fontSize={14} color={x.live ? C('#FF7A7A') : WHITE} uiTransform={{ width: 250 }} textAlign="middle-left" />
                  <Label value={mmss(x.t)} fontSize={14} color={C('#5EF2FF')} uiTransform={{ width: 80 }} textAlign="middle-left" />
                  <Label value={`Lv ${x.l}`} fontSize={13} color={DIM} uiTransform={{ width: 70 }} textAlign="middle-left" />
                  <Label value={tab === 'weekly' && prizes[i] ? `● ${prizes[i].toLocaleString()}` : `${x.k.toLocaleString()} kills`} fontSize={12} color={tab === 'weekly' ? GOLD : DIM} uiTransform={{ width: 110 }} textAlign="middle-right" />
                </UiEntity>
              ))
            ) : (
              <Label value="No runs yet — be the first on the board!" fontSize={14} color={DIM} uiTransform={{ height: 24 }} />
            )}
          </UiEntity>
        )}
        <Button value="CLOSE" fontSize={14} color={WHITE} uiTransform={{ width: 160, height: 36, margin: { top: 8 } }} uiBackground={BTN(C('#2A2A3A'))} onMouseDown={tap(openBoard)} />
      </UiEntity>
    </Modal>
  )
}

function SlayerReveal() {
  if (G.slayerReveal <= 0) return null
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: '22%' }, width: '100%', justifyContent: 'center' }}>
      <UiEntity uiTransform={{ flexDirection: 'column', alignItems: 'center', padding: 22, width: 640 }} uiBackground={MODAL}>
        <Label value="<b>✦ NIGHTSWARM SLAYER ✦</b>" fontSize={36} color={C('#FFD86A')} uiTransform={{ height: 46 }} />
        <Label value="You slew the World Eater at Lv 200. The rift will remember." fontSize={15} color={WHITE} uiTransform={{ height: 22 }} />
        <Label value="<b>+100,000 GOLD</b>  ·  <b>VOID WINGS</b> (worn now)  ·  title on your name tag" fontSize={15} color={C('#C9A8FF')} uiTransform={{ height: 24, margin: { top: 6 } }} />
        <Label value="Your name is now in the Hall of Slayers forever." fontSize={12} color={DIM} uiTransform={{ height: 18 }} />
      </UiEntity>
    </UiEntity>
  )
}

/** auto-taken upgrade, shown without pausing */
function AutoToast() {
  const t = G.autoToast
  if (!t || G.phase !== 'running') return null
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { bottom: 150 }, width: '100%', justifyContent: 'center' }}>
      <UiEntity uiTransform={{ padding: { left: 12, right: 12, top: 3, bottom: 3 } }} uiBackground={{ color: C('#0C0A14', 0.7 * Math.min(1, t.t * 2)) }}>
        <Label value={t.text} fontSize={14} color={C(t.color, Math.min(1, t.t * 2))} />
      </UiEntity>
    </UiEntity>
  )
}

/** PvP status under the top bar */
function PvpBadge() {
  const r = G.run
  if (!r || G.phase !== 'running' || !G.inArena) return null
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 88 }, width: '100%', justifyContent: 'center' }}>
      <UiEntity uiTransform={{ padding: { left: 10, right: 10, top: 2, bottom: 2 } }} uiBackground={{ color: G.inPvp ? C('#7A0A16', 0.85) : C('#10141E', 0.55) }}>
        <Label value={G.inPvp ? '<b>⚔ BLOOD RING · PvP ON</b>' : '🛡 safe from hunters · PvP only in the Blood Ring'} fontSize={G.inPvp ? 13 : 11} color={G.inPvp ? C('#FFD0D6') : DIM} />
      </UiEntity>
    </UiEntity>
  )
}

/** THE ALMIGHTY has fallen: the hunter becomes God */
function AscendEnding() {
  const t = G.ascendT
  if (t <= 0) return null
  const out = t > 16.5 ? Math.max(0, 1 - (t - 16.5) / 2.5) : 1
  const a = (start: number) => Math.max(0, Math.min(1, (t - start) / 1.3)) * out
  const white = Math.max(0, 1 - t / 2.2)
  const line = (key: string, value: string, size: number, color: string, start: number, h: number) => (
    <Label key={key} value={value} fontSize={size} color={C(color, a(start))} uiTransform={{ height: h }} />
  )
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%' }} uiBackground={{ color: C('#140C02', 0.62 * out) }}>
      <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%' }} uiBackground={{ color: C('#FFF8E6', white) }} />
      <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {line('a', '<b>THE ALMIGHTY HAS FALLEN</b>', 40, '#FFD86A', 0.8, 54)}
        {line('b', 'From the last light of creation, a new God rises —', 18, '#FFF6D8', 3, 34)}
        {line('c', `<b>${G.ascendName.toUpperCase()}</b>`, 66, '#FFE9A8', 5, 86)}
        {line('d', '<b>✦ YOU HAVE BECOME GOD ✦</b>', 36, '#FFFFFF', 6.6, 52)}
        {line('e', 'Divine Radiance  ·  title ✦ GOD ✦  ·  ×2 power  ·  ×2 life  ·  +3 regen — forever', 16, '#FFD86A', 8.6, 28)}
        {line('f', 'Every run from now on begins as God. Your name is in the Hall of Gods.', 15, '#E8E2FF', 10.4, 24)}
        {line('g', 'No one is left above you. From here on, only the swarm remains.', 14, '#B9B2C9', 12.2, 22)}
      </UiEntity>
    </UiEntity>
  )
}

const Root = () => (
  <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
    {playerInCasino() ? <CasinoUi /> : null}
    <Hurt />
    <LowHp />
    <Flash />
    <TopHud />
    <ArenaHud />
    <ComboHud />
    {G.phase === 'running' || G.phase === 'levelup' || G.phase === 'chest' ? <PotionBelt /> : null}
    <BossBar />
    {playerInCasino() ? null : <Dock />}
    <InfoPanel />
    <NextBoss />
    <SidePanel />
    <RightMid />
    <HpBar />
    <LobbyHint />
    {G.phase === 'start' ? <StartModal /> : null}
    {G.phase === 'levelup' && G.run ? <LevelModal /> : null}
    {G.phase === 'chest' && G.chest ? <ChestModal /> : null}
    {G.phase === 'dead' ? <DeadModal /> : null}
    {G.shopOpen && G.phase !== 'levelup' && G.phase !== 'chest' ? <ShopModal /> : null}
    {G.armoryOpen && !G.shopOpen && (G.phase === 'idle' || G.phase === 'dead' || G.phase === 'start') ? <ArmoryModal /> : null}
    {G.potionOpen && !G.run ? <PotionShop /> : null}
    {G.questOpen && (G.phase === 'idle' || G.phase === 'dead' || G.phase === 'start') ? <QuestModal /> : null}
    {G.boardOpen && G.phase !== 'levelup' && G.phase !== 'chest' && !G.questOpen ? <BoardModal /> : null}
    <GoldShop />
    <SlayerReveal />
    <PvpBadge />
    <AutoToast />
    <AscendEnding />
    <Banner />
  </UiEntity>
)

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(Root)
}
