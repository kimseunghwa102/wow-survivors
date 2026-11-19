import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { engine, inputSystem, InputAction, PointerEventType } from '@dcl/sdk/ecs'
import { R, bank, tier, bestLevel, serverNow, equip, nuke, openGoldShop, buyGold, cosmeticsOwned } from './game'
import { ARMORY, NUKE_TIER, BOSS, COSMETICS, RARITY_COLOR, cosmetic, GOLD_PACKS, FIRST_BUY_BONUS, RAID, SKILLS, skillDps, skillTier } from './defs'
import { goHome } from './world'

const C = (hex: string, a = 1) => Color4.fromHexString(hex + Math.round(a * 255).toString(16).padStart(2, '0'))
const GOLD = C('#FFD86A')
const WHITE = C('#FFFFFF')
const DIM = C('#9AA0AA')
const RED = C('#FF5468')
const RIGHT = 16
// the castle's game skin
const nine = (src: string, k = 0.25) => ({ texture: { src }, textureMode: 'nine-slices' as const, textureSlices: { top: k, bottom: k, left: k, right: k } })
const FRAME = nine('images/ui_panel.png')
const MODAL = nine('images/ui_modal.png')
const BTN = (c: Color4) => ({ ...nine('images/ui_btn.png', 0.3), color: c })
const IMG = (src: string) => ({ texture: { src }, textureMode: 'stretch' as const })
const tap = (fn: () => void) => () => fn()
const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : Math.round(n).toLocaleString())

function TexBar(props: { frac: number; fill: string; w?: number | string; h: number; white?: boolean; mt?: number }) {
  const f = Math.max(0, Math.min(1, props.frac))
  return (
    <UiEntity uiTransform={{ width: (props.w ?? '100%') as any, height: props.h, margin: { top: props.mt ?? 0 }, padding: 1 }} uiBackground={IMG('images/ui_track.png')}>
      <UiEntity uiTransform={{ width: `${f * 100}%`, height: '100%' }} uiBackground={props.white ? { color: WHITE } : IMG(props.fill)} />
    </UiEntity>
  )
}

function hms(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function BossBar() {
  const r = R.raid
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 12 }, width: '100%', justifyContent: 'center' }}>
      <UiEntity uiTransform={{ width: 720, flexDirection: 'column', alignItems: 'center', padding: { left: 18, right: 18, top: 12, bottom: 12 } }} uiBackground={FRAME}>
        <Label value={`<b>${BOSS.name}</b>`} fontSize={26} color={C('#FF7A4A')} uiTransform={{ height: 30 }} />
        <Label value={r && r.alive ? `${BOSS.title}  ·  phase ${R.phase + 1}/3  ·  co-op world boss` : BOSS.title} fontSize={12} color={C('#E8C8FF')} uiTransform={{ height: 16 }} />
        {r ? (
          r.alive ? (
            <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', alignItems: 'center' }}>
              <TexBar frac={r.hp / r.maxHp} fill="images/ui_boss.png" w={680} h={20} mt={6} />
              <Label value={`${fmt(r.hp)} / ${fmt(r.maxHp)}  (${((r.hp / r.maxHp) * 100).toFixed(1)}%)`} fontSize={13} color={WHITE} uiTransform={{ height: 18 }} />
            </UiEntity>
          ) : (
            <Label value={`<b>SLAIN${r.killer ? ` by ${r.killer}` : ''}</b> · rises again at midnight KST in ${hms(r.respawnAt - serverNow())}`} fontSize={15} color={GOLD} uiTransform={{ height: 26, margin: { top: 6 } }} />
          )
        ) : (
          <Label value={R.status} fontSize={13} color={DIM} uiTransform={{ height: 24, margin: { top: 6 } }} />
        )}
      </UiEntity>
    </UiEntity>
  )
}

function HeroCard() {
  const t = tier()
  const w = ARMORY[t]
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 22, right: RIGHT }, width: 250, flexDirection: 'column' }}>
      <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', alignItems: 'center', padding: { left: 10, right: 14, top: 12, bottom: 12 } }} uiBackground={FRAME}>
        <UiEntity uiTransform={{ width: 64, height: 64, flexShrink: 0, flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }} uiBackground={IMG('images/ui_badge.png')}>
          <Label value="BEST" fontSize={8} color={C('#E8C670')} uiTransform={{ height: 10 }} />
          <Label value={`<b>${bestLevel()}</b>`} fontSize={bestLevel() >= 100 ? 17 : 22} color={WHITE} uiTransform={{ height: 24 }} />
        </UiEntity>
        <UiEntity uiTransform={{ flexDirection: 'column', flexGrow: 1, margin: { left: 10 } }}>
          <UiEntity uiTransform={{ flexDirection: 'row', width: '100%', height: 18, alignItems: 'center' }}>
            <UiEntity uiTransform={{ width: 14, height: 14 }} uiBackground={IMG('images/ui_heart.png')} />
            <Label value={R.dead ? 'DEAD' : `${Math.ceil(R.hp)}/${R.maxHp}`} fontSize={12} color={R.dead ? RED : WHITE} uiTransform={{ height: 16, margin: { left: 3 } }} textAlign="middle-left" />
          </UiEntity>
          <TexBar frac={R.hp / R.maxHp} fill="images/ui_hp.png" h={14} white={R.hurtFlash > 0} mt={3} />
          <Label value={`my damage today: <b>${fmt(R.raid?.myDmg ?? 0)}</b>`} fontSize={11} color={C('#FFB84A')} uiTransform={{ height: 16, margin: { top: 4 } }} textAlign="middle-left" />
        </UiEntity>
      </UiEntity>
      <UiEntity uiTransform={{ width: '100%', padding: { left: 12, right: 12, top: 7, bottom: 7 }, margin: { top: 6 }, flexDirection: 'column' }} uiBackground={FRAME}>
        <Label value={`<b>${w.name}</b>  ·  hold LEFT CLICK`} fontSize={12} color={C(w.color)} uiTransform={{ height: 16 }} textAlign="middle-left" />
        <Label value={`${fmt((RAID.dps[t] - (t >= NUKE_TIER ? RAID.nukeDps : 0)) * RAID.levelScale(bestLevel()))} dmg/s vs the reaper · range ${w.range}m`} fontSize={10} color={DIM} uiTransform={{ height: 14 }} textAlign="middle-left" />
        {t >= NUKE_TIER ? <Label value={R.nukeCd > 0 ? `☢ nuke recharging ${Math.ceil(R.nukeCd)}s` : '☢ NUKE READY — press F'} fontSize={11} color={R.nukeCd > 0 ? DIM : C('#FF3B2E')} uiTransform={{ height: 15 }} textAlign="middle-left" /> : null}
      </UiEntity>
      <UiEntity uiTransform={{ width: '100%', padding: { left: 12, right: 12, top: 7, bottom: 7 }, margin: { top: 6 }, flexDirection: 'column' }} uiBackground={FRAME}>
        {R.build && R.build.weapons.length ? (
          <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
            <Label value={`<b>YOUR BUILD</b> · Lv ${R.build.level} (latest castle run)`} fontSize={11} color={GOLD} uiTransform={{ height: 15 }} textAlign="middle-left" />
            {R.build.weapons.map(([id, lv]) => (
              <Label
                key={id}
                value={`${SKILLS[id]?.name ?? id} Lv${lv}${skillTier(R.build!, id) === 3 ? ' ★' : ''} · ${fmt(skillDps(R.build!, id))}/s`}
                fontSize={10}
                color={C(SKILLS[id]?.color ?? '#FFFFFF')}
                uiTransform={{ height: 13 }}
                textAlign="middle-left"
              />
            ))}
          </UiEntity>
        ) : (
          <Label value="no build yet — play a run in the castle and your skills will fight here too" fontSize={10} color={C('#FFB84A')} uiTransform={{ height: 28 }} textAlign="middle-left" />
        )}
      </UiEntity>
    </UiEntity>
  )
}

function GoldHud() {
  return (
    <UiEntity uiTransform={{ width: 250, height: 92, flexDirection: 'row', alignItems: 'center', padding: { left: 12, right: 12 } }} uiBackground={IMG('images/gold_panel.png')}>
      <UiEntity uiTransform={{ width: 56, height: 56, flexShrink: 0 }} uiBackground={IMG('images/coin.png')} />
      <UiEntity uiTransform={{ flexDirection: 'column', margin: { left: 10 }, flexGrow: 1 }}>
        <Label value="<b>GOLD</b>" fontSize={11} color={C('#E8C670')} uiTransform={{ height: 14 }} textAlign="middle-left" />
        <Label value={R.online ? `<b>${bank().toLocaleString()}</b>` : '<b>···</b>'} fontSize={27} color={GOLD} uiTransform={{ height: 34 }} textAlign="middle-left" />
        <Label value={R.online ? '● shared with the castle' : '● loading your saved gold…'} fontSize={10} color={R.online ? C('#3DFF8E') : C('#FFB347')} uiTransform={{ height: 14 }} textAlign="middle-left" />
      </UiEntity>
    </UiEntity>
  )
}

function RightMid() {
  const r = R.raid
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: '46%', right: RIGHT }, width: 250, flexDirection: 'column' }}>
      <GoldHud />
      <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', padding: 10, margin: { top: 6 } }} uiBackground={FRAME}>
        <Label value="<b>TODAY'S HUNTERS</b>" fontSize={12} color={C('#FF7A4A')} uiTransform={{ height: 16 }} textAlign="middle-left" />
        {(r?.top ?? []).map((t, i) => (
          <UiEntity key={`t${i}`} uiTransform={{ flexDirection: 'row', width: '100%', height: 16, justifyContent: 'space-between' }}>
            <Label value={`${i + 1}. ${t.n}`} fontSize={11} color={t.n === R.name ? GOLD : WHITE} uiTransform={{ height: 16 }} textAlign="middle-left" />
            <Label value={`${fmt(t.d)}  ${r ? ((t.d / r.maxHp) * 100).toFixed(1) : 0}%`} fontSize={11} color={DIM} uiTransform={{ height: 16 }} textAlign="middle-right" />
          </UiEntity>
        ))}
        {!r?.top.length ? <Label value="no one has struck yet — be the first" fontSize={11} color={DIM} uiTransform={{ height: 16 }} textAlign="middle-left" /> : null}
        <Label value="≥0.15% of his health = guaranteed loot" fontSize={10} color={C('#3DFF8E')} uiTransform={{ height: 15, margin: { top: 4 } }} textAlign="middle-left" />
      </UiEntity>
      {R.party.length ? (
        <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', padding: 8, margin: { top: 6 } }} uiBackground={FRAME}>
          {R.party.map((p, i) => (
            <Label key={`p${i}`} value={`${p.n} hits for ${fmt(p.d)}`} fontSize={11} color={C(p.c)} uiTransform={{ height: 15 }} textAlign="middle-left" />
          ))}
        </UiEntity>
      ) : null}
    </UiEntity>
  )
}

function Dock() {
  const t = tier()
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { bottom: 24, right: RIGHT }, flexDirection: 'column', alignItems: 'flex-end' }}>
      <Button value="💎 TREASURY [4]" fontSize={14} color={WHITE} uiTransform={{ width: 210, height: 40, margin: { bottom: 6 } }} uiBackground={BTN(C('#C08A00'))} onMouseDown={tap(openGoldShop)} />
      <Button value={`✦ RELICS [1]${cosmeticsOwned().length ? ` · ${cosmeticsOwned().length}` : ''}`} fontSize={14} color={WHITE} uiTransform={{ width: 210, height: 40, margin: { bottom: 6 } }} uiBackground={BTN(C('#6A3AB8'))} onMouseDown={tap(() => (R.cosOpen = !R.cosOpen))} />
      {t >= NUKE_TIER ? <Button value={R.nukeCd > 0 ? `☢ NUKE ${Math.ceil(R.nukeCd)}s` : '☢ NUKE [F]'} fontSize={14} color={WHITE} uiTransform={{ width: 210, height: 40, margin: { bottom: 6 } }} uiBackground={BTN(R.nukeCd > 0 ? C('#3A2A2A') : C('#C0281E'))} onMouseDown={tap(nuke)} /> : null}
      <Button value={`⚔ AUTO ATTACK ${R.auto ? 'ON' : 'OFF'} [E]`} fontSize={14} color={WHITE} uiTransform={{ width: 210, height: 40, margin: { bottom: 6 } }} uiBackground={BTN(R.auto ? C('#1FA85A') : C('#3A2A4A'))} onMouseDown={tap(() => (R.auto = !R.auto))} />
      <Button value="⟲ RETURN TO CASTLE [3]" fontSize={13} color={WHITE} uiTransform={{ width: 210, height: 36 }} uiBackground={BTN(C('#3A2858'))} onMouseDown={tap(goHome)} />
      <Label value="LEFT CLICK attack · E auto · F nuke · 1 relics · 3 castle · 4 treasury" fontSize={11} color={DIM} uiTransform={{ height: 16 }} />
    </UiEntity>
  )
}

function Relics() {
  if (!R.cosOpen) return null
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 200, right: 282 }, width: 380, flexDirection: 'column', padding: 14 }} uiBackground={FRAME}>
      <Label value="<b>RELICS OF THE PALE SOVEREIGN</b>" fontSize={16} color={GOLD} uiTransform={{ height: 22 }} textAlign="middle-left" />
      <Label value="dropped by the reaper · worn in the raid and the castle" fontSize={11} color={DIM} uiTransform={{ height: 16 }} textAlign="middle-left" />
      {COSMETICS.map((c) => {
        const n = R.inv.items[c.id] ?? 0
        const on = R.inv.cosmetic === c.id || R.inv.title === c.id
        return (
          <UiEntity key={c.id} uiTransform={{ flexDirection: 'row', width: '100%', height: 30, alignItems: 'center', margin: { top: 3 } }}>
            <UiEntity uiTransform={{ flexDirection: 'column', width: 240 }}>
              <Label value={`${n ? '■' : '□'} ${c.name}${n > 1 ? ` ×${n}` : ''}`} fontSize={12} color={n ? C(RARITY_COLOR[c.rarity]) : DIM} uiTransform={{ height: 15 }} textAlign="middle-left" />
              <Label value={`${c.rarity.toUpperCase()} · ${c.desc}`} fontSize={9} color={DIM} uiTransform={{ height: 12 }} textAlign="middle-left" />
            </UiEntity>
            {n ? (
              <Button value={on ? '✓ WORN' : 'WEAR'} fontSize={11} color={WHITE} uiTransform={{ width: 110, height: 24 }} uiBackground={BTN(on ? C('#1FA85A') : C('#3A2A5A'))} onMouseDown={tap(() => void equip(on && !c.title ? null : c.id))} />
            ) : (
              <Label value="🔒" fontSize={12} color={DIM} uiTransform={{ width: 110, height: 24 }} />
            )}
          </UiEntity>
        )
      })}
      {R.cosMsg ? <Label value={R.cosMsg} fontSize={11} color={R.cosMsg.startsWith('✓') ? C('#3DFF8E') : C('#FFB84A')} uiTransform={{ height: 16, margin: { top: 4 } }} textAlign="middle-left" /> : null}
    </UiEntity>
  )
}

function LootModal() {
  const l = R.loot
  if (!l) return null
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }} uiBackground={{ color: C('#000000', 0.6) }}>
      <UiEntity uiTransform={{ flexDirection: 'column', alignItems: 'center', padding: 34, width: 640 }} uiBackground={MODAL}>
        <Label value="<b>THE REAPER FALLS</b>" fontSize={34} color={GOLD} uiTransform={{ height: 42 }} />
        <Label value="your share of the spoils" fontSize={14} color={C('#E8C8FF')} uiTransform={{ height: 20 }} />
        <UiEntity uiTransform={{ flexDirection: 'row', margin: { top: 10 }, flexWrap: 'wrap', justifyContent: 'center' }}>
          {l.items.map((id, i) => {
            const c = cosmetic(id)
            return (
              <UiEntity key={`l${i}`} uiTransform={{ width: 132, height: 92, margin: 5, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 6 }} uiBackground={BTN(C(c ? RARITY_COLOR[c.rarity] : '#888888'))}>
                <Label value={`<b>${c?.rarity.toUpperCase() ?? ''}</b>`} fontSize={10} color={C('#1A0E00')} uiTransform={{ height: 14 }} />
                <Label value={`<b>${c?.name ?? id}</b>`} fontSize={12} color={C('#1A0E00')} uiTransform={{ height: 40 }} />
              </UiEntity>
            )
          })}
        </UiEntity>
        <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', margin: { top: 10 } }}>
          <UiEntity uiTransform={{ width: 40, height: 40 }} uiBackground={IMG('images/coin.png')} />
          <Label value={`<b>+${l.gold.toLocaleString()} GOLD</b>`} fontSize={26} color={GOLD} uiTransform={{ height: 40, margin: { left: 8 } }} />
        </UiEntity>
        <Label value="relics are in RELICS [1] — wear them here and in the castle" fontSize={12} color={DIM} uiTransform={{ height: 18, margin: { top: 6 } }} />
        <Button value="CLAIM" fontSize={18} color={WHITE} uiTransform={{ width: 200, height: 46, margin: { top: 10 } }} uiBackground={BTN(C('#1FA85A'))} onMouseDown={tap(() => ((R.loot = null), (R.cosOpen = true)))} />
      </UiEntity>
    </UiEntity>
  )
}

function DeathOverlay() {
  if (!R.dead) return null
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }} uiBackground={{ color: C('#2A0006', 0.55) }}>
      <Label value="<b>REAPED</b>" fontSize={72} color={RED} uiTransform={{ height: 90 }} />
      <Label value={`you rise again at the rift in ${Math.ceil(R.deadT)}…`} fontSize={20} color={WHITE} uiTransform={{ height: 28 }} />
    </UiEntity>
  )
}

function PackCard(props: { i: number; key?: string }) {
  const k = GOLD_PACKS[props.i]
  const sel = R.packSel === props.i
  const gold = Math.round(k.gold * (R.firstPurchase ? 1 + FIRST_BUY_BONUS : 1))
  const best = k.tag === 'BEST VALUE'
  return (
    <UiEntity uiTransform={{ width: 150, height: 250, margin: 6, flexDirection: 'column', alignItems: 'center', padding: 4 }} uiBackground={{ color: sel ? C('#FFD24A') : best ? C('#B07BFF', 0.8) : C('#5A3A10', 0.9) }} onMouseDown={tap(() => (R.packSel = props.i))}>
      <UiEntity uiTransform={{ width: '100%', height: '100%', flexDirection: 'column', alignItems: 'center' }} uiBackground={{ color: sel ? C('#2A1A08') : C('#160C1E') }}>
        <UiEntity uiTransform={{ width: '100%', height: 22, justifyContent: 'center', alignItems: 'center' }} uiBackground={{ color: k.tag ? (best ? C('#9A3BFF') : k.tag === 'POPULAR' ? C('#1FA85A') : C('#C04B2A')) : C('#000000', 0) }}>
          <Label value={k.tag ? `<b>${k.tag}</b>` : ''} fontSize={12} color={WHITE} />
        </UiEntity>
        <UiEntity uiTransform={{ width: 130, height: 120, margin: { top: 2 } }} uiBackground={IMG(k.img)} />
        <Label value={`<b>${gold.toLocaleString()}</b>`} fontSize={22} color={GOLD} uiTransform={{ height: 28 }} />
        <Label value={R.firstPurchase ? `${k.gold.toLocaleString()} +50% first buy` : k.bonus ? `includes +${k.bonus}% bonus` : 'gold'} fontSize={11} color={R.firstPurchase ? C('#3DFF8E') : DIM} uiTransform={{ height: 16 }} />
        <UiEntity uiTransform={{ width: 120, height: 34, margin: { top: 8 }, justifyContent: 'center', alignItems: 'center' }} uiBackground={{ color: sel ? C('#FFD24A') : C('#3A2A10') }}>
          <Label value={`<b>$${k.usd}</b>`} fontSize={20} color={sel ? C('#1A0E00') : WHITE} />
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

function GoldShop() {
  if (!R.goldShopOpen) return null
  const k = GOLD_PACKS[R.packSel]
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }} uiBackground={{ color: C('#000000', 0.55) }}>
      <UiEntity uiTransform={{ width: 880, height: 600, flexDirection: 'column', alignItems: 'center', padding: 22 }} uiBackground={IMG('images/shop_bg.jpg')}>
        <Label value="<b>◆  THE TREASURY  ◆</b>" fontSize={34} color={GOLD} uiTransform={{ height: 42 }} />
        <Label value={`Gold for the Armory & Arcane Forge · your bank ● ${bank().toLocaleString()}`} fontSize={14} color={C('#E8D8FF')} uiTransform={{ height: 20 }} />
        {R.firstPurchase ? (
          <UiEntity uiTransform={{ width: 520, height: 30, margin: { top: 6 }, justifyContent: 'center', alignItems: 'center' }} uiBackground={{ color: C('#1FA85A') }}>
            <Label value="<b>★ FIRST PURCHASE BONUS: +50% GOLD ON ANY PACK ★</b>" fontSize={14} color={WHITE} />
          </UiEntity>
        ) : null}
        <UiEntity uiTransform={{ flexDirection: 'row', margin: { top: 6 } }}>
          {GOLD_PACKS.map((_, i) => (
            <PackCard key={`pk${i}`} i={i} />
          ))}
        </UiEntity>
        <Label value="weapons are bought in the castle Armory — the reaper fears Zeus' Thunder and Divine Ascension" fontSize={13} color={C('#FFB84A')} uiTransform={{ height: 20, margin: { top: 2 } }} />
        {R.goldShop.enabled ? (
          <UiEntity uiTransform={{ flexDirection: 'row', margin: { top: 6 } }}>
            <Button value={R.payBusy ? 'WAITING…' : `PAY $${k.usd} WITH ETH`} fontSize={16} color={WHITE} uiTransform={{ width: 270, height: 48, margin: 6 }} uiBackground={BTN(C('#4A5BD8'))} onMouseDown={tap(() => void buyGold('ETH'))} />
            <Button value={R.payBusy ? 'WAITING…' : `PAY $${k.usd} WITH MANA`} fontSize={16} color={WHITE} uiTransform={{ width: 270, height: 48, margin: 6 }} uiBackground={BTN(C('#FF2D55'))} onMouseDown={tap(() => void buyGold('MANA'))} />
          </UiEntity>
        ) : (
          <Label value="The Treasury opens soon" fontSize={16} color={DIM} uiTransform={{ height: 48 }} />
        )}
        {R.payMsg ? <Label value={`<b>${R.payMsg}</b>`} fontSize={13} color={R.payMsg.startsWith('✓') ? C('#3DFF8E') : C('#FFD24A')} uiTransform={{ height: 20 }} /> : null}
        <Label value="🔒 verified on-chain · paid to the creator's wallet · gas fee extra · 4 = close" fontSize={11} color={C('#BFAEDF')} uiTransform={{ height: 18, margin: { top: 2 } }} />
        <Button value="CLOSE" fontSize={13} color={WHITE} uiTransform={{ width: 120, height: 30, margin: { top: 4 } }} uiBackground={BTN(C('#2A2A3A'))} onMouseDown={tap(() => (R.goldShopOpen = false))} />
      </UiEntity>
    </UiEntity>
  )
}

function Banner() {
  if (R.bannerT <= 0 || !R.banner) return null
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 170 }, width: '100%', justifyContent: 'center' }}>
      <UiEntity uiTransform={{ padding: { left: 30, right: 30, top: 12, bottom: 12 } }} uiBackground={MODAL}>
        <Label value={`<b>${R.banner}</b>`} fontSize={22} color={GOLD} />
      </UiEntity>
    </UiEntity>
  )
}

const Ui = () => (
  <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
    <BossBar />
    <HeroCard />
    <RightMid />
    <Dock />
    <Relics />
    <DeathOverlay />
    <GoldShop />
    <LootModal />
    <Banner />
  </UiEntity>
)

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(Ui)
  // hotkeys (the cursor is usually locked during the fight)
  engine.addSystem(() => {
    if (inputSystem.isTriggered(InputAction.IA_ACTION_3, PointerEventType.PET_DOWN)) R.cosOpen = !R.cosOpen
    if (inputSystem.isTriggered(InputAction.IA_ACTION_5, PointerEventType.PET_DOWN)) goHome()
    if (inputSystem.isTriggered(InputAction.IA_ACTION_6, PointerEventType.PET_DOWN)) {
      if (R.goldShopOpen) R.goldShopOpen = false
      else openGoldShop()
    }
  })
}
