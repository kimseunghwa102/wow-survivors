import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { G, startRun, choose, reroll, skipLevel, collectChest, buyMeta, META, MetaKey, metaCost, returnToSanctuary, playAgain } from './game/game'
import { optionLabel, Option } from './game/core'
import { WEAPONS, PASSIVES, STARTERS, MAX_WEAPON_LVL, MAX_PASSIVE_LVL, WeaponId, PassiveId } from './game/defs'
import { feed, topRuns } from './game/net'
import { save } from './game/persist'
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

function TopHud() {
  const r = G.run
  if (!r) return null
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 0, left: 0 }, width: '100%', flexDirection: 'column', alignItems: 'center' }}>
      <UiEntity uiTransform={{ width: '100%', height: 14 }}>
        <Bar frac={r.xp / r.need} color={C('#3A8BFF')} w="100%" h={14} />
      </UiEntity>
      <UiEntity uiTransform={{ width: '100%', height: 54, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: { left: 16, right: 16 } }}>
        <Label value={`<b>LV ${r.level}</b>`} fontSize={22} color={WHITE} />
        <Label value={`<b>${mmss(r.time)}</b>`} fontSize={30} color={r.time >= 300 ? C('#FF5468') : WHITE} />
        <Label value={`<b>☠ ${r.kills}   ● ${r.gold}</b>`} fontSize={20} color={GOLD} />
      </UiEntity>
    </UiEntity>
  )
}

function HpBar() {
  const r = G.run
  if (!r) return null
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { bottom: 70 }, width: '100%', justifyContent: 'center', flexDirection: 'row' }}>
      <UiEntity uiTransform={{ flexDirection: 'column', alignItems: 'center' }}>
        <Label value={`${Math.ceil(r.hp)} / ${r.maxHp}`} fontSize={14} color={WHITE} uiTransform={{ height: 18 }} />
        <Bar frac={r.hp / r.maxHp} color={G.hurtFlash > 0 ? C('#FFFFFF') : C('#E0102A')} w={320} h={14} />
      </UiEntity>
    </UiEntity>
  )
}

function Loadout() {
  const r = G.run
  if (!r) return null
  const ws = [...r.weapons.entries()] as [WeaponId, number][]
  const ps = [...r.passives.entries()] as [PassiveId, number][]
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 80, left: 12 }, flexDirection: 'column', padding: 8, width: 230 }} uiBackground={{ color: PANEL }}>
      {ws.map(([id, lv]) => (
        <Label
          key={id}
          value={`${r.evolved.has(id) ? '★ ' + WEAPONS[id].evo : WEAPONS[id].name}  ${lv >= MAX_WEAPON_LVL ? 'MAX' : 'Lv' + lv}`}
          fontSize={13}
          color={C(WEAPONS[id].color)}
          uiTransform={{ height: 18 }}
          textAlign="middle-left"
        />
      ))}
      {ps.length ? <UiEntity uiTransform={{ height: 6 }} /> : null}
      {ps.map(([id, lv]) => (
        <Label key={id} value={`${PASSIVES[id].name}  ${lv >= MAX_PASSIVE_LVL ? 'MAX' : 'Lv' + lv}`} fontSize={12} color={DIM} uiTransform={{ height: 16 }} textAlign="middle-left" />
      ))}
    </UiEntity>
  )
}

function Feed() {
  if (!feed.length) return null
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 80, right: 12 }, width: 300, flexDirection: 'column', padding: 8 }} uiBackground={{ color: PANEL }}>
      <Label value="<b>ARENA</b>" fontSize={13} color={C('#FF5468')} uiTransform={{ height: 18 }} textAlign="middle-left" />
      {feed.map((f, i) => (
        <Label key={`${f.t}-${i}`} value={f.text} fontSize={12} color={C(f.color)} uiTransform={{ height: 17 }} textAlign="middle-left" />
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
        <Label value="<b>WOW SURVIVORS</b>  ·  walk through the east gate to start a run" fontSize={16} color={WHITE} />
        <Label value={`Bank ● ${G.bank}   ·   Best ${mmss(G.best.t)} (Lv ${G.best.l})   ·   Shrine of Power = permanent boosts`} fontSize={13} color={GOLD} />
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
      <Button value="CHOOSE" fontSize={15} color={WHITE} uiTransform={{ width: '100%', height: 38 }} uiBackground={{ color: C('#7B3BFF') }} onMouseDown={props.onPick} />
    </UiEntity>
  )
}

function StartModal() {
  return (
    <Modal title="CHOOSE YOUR WEAPON" sub="Enemies arrive the moment you choose. Other hunters in the arena can attack you.">
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
        <Button value={`REROLL (${r.rerolls})`} fontSize={14} color={WHITE} uiTransform={{ width: 150, height: 34, margin: 6 }} uiBackground={{ color: r.rerolls > 0 ? C('#3A2A5A') : C('#222222') }} onMouseDown={reroll} />
        <Button value="SKIP (+10 gold)" fontSize={14} color={WHITE} uiTransform={{ width: 150, height: 34, margin: 6 }} uiBackground={{ color: C('#2A2A2A') }} onMouseDown={skipLevel} />
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
    <Modal title={spinning ? 'TREASURE!' : c.rolls.length >= 5 ? 'JACKPOT!!' : c.rolls.length >= 3 ? 'BIG WIN!' : 'TREASURE!'} color={spinning ? GOLD : C('#3DFF8E')}>
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
          <Button value="COLLECT" fontSize={18} color={WHITE} uiTransform={{ width: 200, height: 42, margin: { top: 10 } }} uiBackground={{ color: C('#7B3BFF') }} onMouseDown={collectChest} />
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
      <Label value={s.saving ? 'Saving to your wallet…' : `+${s.gold} gold banked${s.killer ? ' (30% taken by your killer)' : ''}${rank ? `   ·   Hall of Legends #${rank}` : ''}`} fontSize={15} color={GOLD} uiTransform={{ height: 24 }} />
      <UiEntity uiTransform={{ flexDirection: 'row', margin: { top: 12 } }}>
        <Button value="PLAY AGAIN" fontSize={18} color={WHITE} uiTransform={{ width: 200, height: 44, margin: 6 }} uiBackground={{ color: C('#7B3BFF') }} onMouseDown={playAgain} />
        <Button value="SANCTUARY & SHRINE" fontSize={16} color={WHITE} uiTransform={{ width: 220, height: 44, margin: 6 }} uiBackground={{ color: C('#2A2A3A') }} onMouseDown={returnToSanctuary} />
      </UiEntity>
    </Modal>
  )
}

function ShopModal() {
  return (
    <Modal title="SHRINE OF POWER" sub={`Bank ● ${G.bank}  ·  ${save.online ? 'permanent boosts saved to your wallet' : 'offline — boosts last this session only'}`}>
      {(Object.keys(META) as MetaKey[]).map((k) => {
        const lv = G.meta[k]
        const max = lv >= META[k].max
        const cost = metaCost(lv)
        return (
          <UiEntity key={k} uiTransform={{ flexDirection: 'row', alignItems: 'center', width: 560, height: 46, margin: 2 }} uiBackground={{ color: C('#1E1430') }}>
            <Label value={`<b>${META[k].name}</b>  ${META[k].desc}`} fontSize={15} color={WHITE} uiTransform={{ width: 330 }} textAlign="middle-left" />
            <Label value={`Lv ${lv}/${META[k].max}`} fontSize={14} color={DIM} uiTransform={{ width: 80 }} />
            <Button value={max ? 'MAX' : G.shopBusy ? '…' : `● ${cost}`} fontSize={14} color={WHITE} uiTransform={{ width: 120, height: 34 }} uiBackground={{ color: max ? C('#333333') : G.bank >= cost ? C('#7B3BFF') : C('#3A2A4A') }} onMouseDown={() => buyMeta(k)} />
          </UiEntity>
        )
      })}
      <Button value="CLOSE" fontSize={15} color={WHITE} uiTransform={{ width: 160, height: 38, margin: { top: 12 } }} uiBackground={{ color: C('#2A2A3A') }} onMouseDown={() => (G.shopOpen = false)} />
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
    <TopHud />
    <Loadout />
    <Feed />
    <HpBar />
    <Banner />
    <LobbyHint />
    {G.phase === 'start' ? <StartModal /> : null}
    {G.phase === 'levelup' && G.run ? <LevelModal /> : null}
    {G.phase === 'chest' && G.chest ? <ChestModal /> : null}
    {G.phase === 'dead' ? <DeadModal /> : null}
    {G.shopOpen && G.phase !== 'levelup' && G.phase !== 'chest' ? <ShopModal /> : null}
  </UiEntity>
)

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(Root)
}
