import { toCasino, inCasino } from '../build'
import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button, Input } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { engine, inputSystem, InputAction, PointerEventType, Transform } from '@dcl/sdk/ecs'
import { store, toast } from './store'
import { act, autoLogin, login, logout } from './net'
import { uiCardUvs, CARD_TEXTURE } from './table'
import { displayName, handName, fmt, mmss, hasHangul, KR_FONT } from './text'

const C = {
  panel: Color4.create(0.05, 0.03, 0.06, 0.88),
  gold: Color4.fromHexString('#FFD54FFF'),
  goldBtn: Color4.fromHexString('#C9A227FF'),
  red: Color4.fromHexString('#B3122EFF'),
  green: Color4.fromHexString('#1E8E4EFF'),
  blue: Color4.fromHexString('#1F5FBFFF'),
  gray: Color4.fromHexString('#3A3A44FF'),
  white: Color4.White(),
  dim: Color4.fromHexString('#B0B0B8FF'),
  cyan: Color4.fromHexString('#7DF9FFFF'),
  green2: Color4.fromHexString('#6EF29AFF'),
  err: Color4.fromHexString('#FF8A80FF')
}
const kr = (s: string) => (hasHangul(s) ? KR_FONT : undefined)

function Btn(props: { label: string; color: Color4; onClick: () => void; w?: number; h?: number; fs?: number; disabled?: boolean }) {
  return (
    <Button
      value={props.label}
      variant="primary"
      fontSize={props.fs || 15}
      disabled={props.disabled}
      color={C.white}
      uiTransform={{ width: props.w || 110, height: props.h || 40, margin: 4 }}
      uiBackground={{ color: props.disabled ? C.gray : props.color }}
      onMouseDown={() => {
        if (!props.disabled) props.onClick()
      }}
    />
  )
}

function Card(props: { code: string | null; w: number }) {
  return (
    <UiEntity
      uiTransform={{ width: props.w, height: Math.round(props.w * 1.3), margin: 4 }}
      uiBackground={{ textureMode: 'stretch', texture: { src: CARD_TEXTURE }, uvs: uiCardUvs(props.code) }}
    />
  )
}

/* ---------- top-left: account panel ---------- */
function AccountPanel() {
  const v = store.view
  const me = v && v.me
  const status =
    store.status === 'online' ? '' : store.status === 'waking' ? 'Waking the table server up...' : store.status === 'offline' ? 'Reconnecting...' : 'Connecting...'
  const rank = me && v ? v.ranking.findIndex((r) => r.name === me.name) : -1
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { top: 150, right: 16 }, width: 320, flexDirection: 'column' }}
      uiBackground={{ color: C.panel }}
    >
      <UiEntity uiTransform={{ height: 40, width: 320, justifyContent: 'center', alignItems: 'center' }} uiBackground={{ color: C.goldBtn }}>
        <Label value="GOLD HOLD'EM" fontSize={22} color={Color4.fromHexString('#1A0E00FF')} />
      </UiEntity>
      <UiEntity uiTransform={{ flexDirection: 'column', padding: 12 }}>
      {status ? <Label value={status} fontSize={15} color={C.gold} uiTransform={{ height: 22 }} textAlign="middle-left" /> : null}
      {status && store.note ? <Label value={store.note} fontSize={12} color={C.dim} uiTransform={{ height: 18 }} textAlign="middle-left" /> : null}
      {me ? (
        <UiEntity uiTransform={{ flexDirection: 'column' }}>
          <Label value={me.name} fontSrc={kr(me.name)} fontSize={19} color={C.white} uiTransform={{ height: 22 }} textAlign="middle-left" />
          <Label
            value={`Table ● ${fmt(me.chips)}   Bank ● ${fmt(me.bank || 0)}${rank >= 0 ? '   #' + (rank + 1) : ''}`}
            fontSize={16}
            color={C.cyan}
            uiTransform={{ height: 24 }}
            textAlign="middle-left"
          />
          <UiEntity uiTransform={{ flexDirection: 'row', flexWrap: 'wrap', margin: { top: 4 } }}>
            {me.seat == null && !me.broke ? <Btn label={'[E] Sit · buy-in ● ' + fmt(Math.min(v!.cfg.maxBuyIn || 5000, me.bank || 0))} color={C.green} w={200} h={34} fs={13} onClick={() => sitAnywhere()} /> : null}
            {me.seat != null ? <Btn label={store.standArmUntil > Date.now() ? '[Shift+F] Stand up?' : '[Shift+F] Stand up'} color={C.gray} w={140} h={34} fs={14} onClick={() => act('stand', {}, 'You left your seat.')} /> : null}
            {me.seat != null && me.away ? <Btn label="[F] I'm back" color={C.green} w={140} h={34} fs={14} onClick={() => act('away')} /> : null}
            {me.seat != null && !me.away ? <Btn label={store.awayArmUntil > Date.now() ? '[F] Sit out?' : '[F] Sit out'} color={C.gray} w={140} h={34} fs={14} onClick={() => act('away')} /> : null}
            <Btn label={store.logoutArmUntil > Date.now() ? '[Shift+E] Log out?' : '[Shift+E] Log out'} color={C.gray} w={140} h={34} fs={14} onClick={() => logout()} />
          </UiEntity>
          {store.newPin ? (
            <UiEntity uiTransform={{ flexDirection: 'column', margin: { top: 6 }, padding: 6 }} uiBackground={{ color: Color4.create(0.2, 0.15, 0.02, 0.9) }}>
              <Label value={'For the phone version: nickname ' + me.name + ', PIN ' + store.newPin} fontSrc={kr(me.name)} fontSize={13} color={C.gold} uiTransform={{ height: 20 }} textAlign="middle-left" />
              <Btn label="Got it" color={C.gray} w={90} h={26} fs={12} onClick={() => (store.newPin = '')} />
            </UiEntity>
          ) : null}
          {me.seat == null && !me.broke ? (
            <Label value={`Click an open chair: buy-in up to ${fmt(v!.cfg.maxBuyIn || 5000)} gold from your bank.`} fontSize={13} color={C.dim} uiTransform={{ height: 20 }} textAlign="middle-left" />
          ) : null}
        </UiEntity>
      ) : store.status === 'online' ? (
        <UiEntity uiTransform={{ flexDirection: 'column', margin: { top: 6 } }}>
          {store.verified ? (
            <Btn label={'[E] ' + (v && v.linked ? 'Play as ' + v.linked : "PLAY HOLD'EM")} color={C.green} w={290} h={46} fs={17} onClick={() => autoLogin()} />
          ) : (
            <Btn label="[E] PLAY HOLD'EM" color={C.green} w={290} h={46} fs={17} onClick={() => autoLogin()} />
          )}
          <Label
            value={store.verified ? 'Your wallet logs you in. You play with your WOW gold.' : 'Checking your Decentraland wallet' + (store.note ? ' · ' + store.note : '...')}
            fontSize={12}
            color={C.dim}
            uiTransform={{ height: 18 }}
            textAlign="middle-left"
          />

        </UiEntity>
      ) : null}
      </UiEntity>
    </UiEntity>
  )
}

/* ---------- login modal ---------- */
function LoginModal() {
  // gold tables: Decentraland wallets only (no nickname/PIN accounts)
  if (!store.loginOpen || true) return null
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { top: '22%', left: '50%' }, margin: { left: -210 }, width: 420, flexDirection: 'column', padding: 18, alignItems: 'center' }}
      uiBackground={{ color: C.panel }}
    >
      <Label value="Join GYBM Hold'em" fontSize={22} color={C.gold} uiTransform={{ height: 32 }} />
      <Label
        value={'Same accounts and chips as the GYBM web table.\nNew nickname = new account with free chips.'}
        fontSize={13}
        color={C.dim}
        uiTransform={{ height: 40, margin: { bottom: 8 } }}
      />
      <Input
        placeholder="Nickname (1-10 characters)"
        fontSize={16}
        color={C.white}
        placeholderColor={C.dim}
        value={store.formName}
        onChange={(v) => (store.formName = v)}
        uiTransform={{ width: 360, height: 40, margin: 4 }}
        uiBackground={{ color: Color4.create(0.15, 0.12, 0.18, 1) }}
      />
      <Input
        placeholder="PIN (4 digits)"
        fontSize={16}
        color={C.white}
        placeholderColor={C.dim}
        value={store.formPin}
        onChange={(v) => (store.formPin = v.replace(/[^0-9]/g, '').slice(0, 4))}
        onSubmit={() => login(store.formName, store.formPin)}
        uiTransform={{ width: 360, height: 40, margin: 4 }}
        uiBackground={{ color: Color4.create(0.15, 0.12, 0.18, 1) }}
      />
      {store.formError ? <Label value={store.formError} fontSize={13} color={C.err} uiTransform={{ height: 36, width: 380 }} /> : null}
      <UiEntity uiTransform={{ flexDirection: 'row', margin: { top: 8 } }}>
        <Btn label={store.busy ? '...' : 'Enter'} color={C.green} w={160} disabled={store.busy} onClick={() => login(store.formName, store.formPin)} />
        <Btn label="Cancel" color={C.gray} w={120} onClick={() => ((store.loginOpen = false), (store.formError = ''))} />
      </UiEntity>
      <Label value="Logging in here links this wallet: next time it is one click." fontSize={12} color={C.dim} uiTransform={{ height: 22 }} />
    </UiEntity>
  )
}

/* ---------- bottom: my cards + actions ---------- */
function HandPanel() {
  const v = store.view
  const me = v && v.me
  const h = v && v.hand
  if (!v || !me || me.seat == null || !h) return null
  const p = h.ps[me.seat]
  if (!p || !p.cards) return null
  const opts = h.opts
  const live = !h.over
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { bottom: 16, left: '50%' }, margin: { left: -330 }, width: 660, flexDirection: 'row', alignItems: 'flex-end' }}>
      <UiEntity uiTransform={{ flexDirection: 'column', alignItems: 'center', padding: 8, width: 190 }} uiBackground={{ color: C.panel }}>
        <UiEntity uiTransform={{ flexDirection: 'row' }}>
          <Card code={p.cards[0]} w={78} />
          <Card code={p.cards[1]} w={78} />
        </UiEntity>
        <Label value={p.folded ? 'Folded' : handName(h.myBest) || ' '} fontSize={14} color={p.folded ? C.dim : C.gold} uiTransform={{ height: 20 }} />
      </UiEntity>
      {live && opts && !p.folded ? <Actions /> : null}
    </UiEntity>
  )
}

function Actions() {
  const v = store.view!
  const h = v.hand!
  const o = h.opts!
  const bb = h.bb || v.cfg.bb
  const clamp = (x: number) => Math.max(o.minTo, Math.min(o.maxTo, Math.round(x)))
  if (!(store.raiseTo >= o.minTo && store.raiseTo <= o.maxTo)) store.raiseTo = o.minTo
  const left = Math.max(0, store.turnEnd - Date.now())
  const pot = o.pot
  const potTo = (frac: number) => clamp(o.currentBet + (pot + o.toCall) * frac)
  const me = v.me!
  const myBet = me.seat != null && h.ps[me.seat] ? h.ps[me.seat]!.bet : 0
  const send = (type: string, to?: number) => act('act', { type, to, no: h.no })
  const callLabel = o.toCall > 0 ? `Call ${fmt(o.toCall)}${o.toCall >= o.maxTo - myBet ? ' (all-in)' : ''}` : 'Check'
  const allIn = store.raiseTo >= o.maxTo
  return (
    <UiEntity uiTransform={{ flexDirection: 'column', padding: 8, margin: { left: 10 }, width: 460 }} uiBackground={{ color: C.panel }}>
      <UiEntity uiTransform={{ height: 6, width: 440, margin: { bottom: 6 } }} uiBackground={{ color: C.gray }}>
        <UiEntity uiTransform={{ height: 6, width: Math.round((440 * left) / (v.cfg.turnSecs * 1000)) }} uiBackground={{ color: left < 8000 ? C.red : C.gold }} />
      </UiEntity>
      <UiEntity uiTransform={{ flexDirection: 'row' }}>
        <Btn label={store.foldArmUntil > Date.now() ? '[1] Fold?' : '[1] Fold'} color={C.red} w={130} h={44} onClick={() => send('fold')} />
        <Btn label={'[2] ' + callLabel} color={C.green} w={170} h={44} fs={14} onClick={() => send('call')} />
        {o.canRaise ? (
          <Btn label={'[3] ' + (allIn ? 'All-in ' + fmt(o.maxTo) : (o.currentBet > 0 ? 'Raise ' : 'Bet ') + fmt(store.raiseTo))} color={C.goldBtn} w={140} h={44} fs={14} onClick={() => send('raise', store.raiseTo)} />
        ) : null}
      </UiEntity>
      {o.canRaise ? (
        <UiEntity uiTransform={{ flexDirection: 'row', margin: { top: 2 } }}>
          <Btn label="-" color={C.gray} w={44} h={32} onClick={() => (store.raiseTo = clamp(store.raiseTo - bb))} />
          <Btn label="+" color={C.gray} w={44} h={32} onClick={() => (store.raiseTo = clamp(store.raiseTo + bb))} />
          <Btn label="Min" color={C.blue} w={70} h={32} fs={13} onClick={() => (store.raiseTo = o.minTo)} />
          <Btn label="1/2 Pot" color={C.blue} w={76} h={32} fs={13} onClick={() => (store.raiseTo = potTo(0.5))} />
          <Btn label="Pot" color={C.blue} w={66} h={32} fs={13} onClick={() => (store.raiseTo = potTo(1))} />
          <Btn label="All-in" color={C.blue} w={76} h={32} fs={13} onClick={() => (store.raiseTo = o.maxTo)} />
        </UiEntity>
      ) : null}
      <Label value={'Keys: 1 Fold · 2 ' + (o.toCall > 0 ? 'Call' : 'Check') + (o.canRaise ? ' · 3 Raise · 4 Change amount' : '')} fontSize={12} color={C.dim} uiTransform={{ height: 18 }} />
    </UiEntity>
  )
}

/* ---------- broke / recover ---------- */
function BrokePanel() {
  const v = store.view
  const me = v && v.me
  if (!me || !me.broke) return null
  const wait = Math.max(0, me.recoverIn - (Date.now() - store.viewAt))
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { bottom: 200, left: '50%' }, margin: { left: -180 }, width: 360, flexDirection: 'column', alignItems: 'center', padding: 12 }}
      uiBackground={{ color: C.panel }}
    >
      <Label value="Your table stack is gone" fontSize={18} color={C.gold} uiTransform={{ height: 26 }} />
      {!me.canRecover ? (
        <Label value={`Not enough gold in your bank (need ${fmt(v!.cfg.minBuyIn || 500)}).\nHunt in WOW NIGHTSWARM and come back!`} fontSize={14} color={C.dim} uiTransform={{ height: 40 }} />
      ) : wait > 0 ? (
        <Label
          value={`Free chips (${fmt(me.recoverAmt)}) in ${mmss(wait)}${me.recoverLong ? '\n(long wait: every 10th bust)' : ''}`}
          fontSize={14}
          color={C.dim}
          uiTransform={{ height: me.recoverLong ? 40 : 22 }}
        />
      ) : (
        <Btn label={'[E] Rebuy ● ' + fmt(me.recoverAmt) + ' gold'} color={C.green} w={260} h={42} onClick={() => act('recover', {}, 'Rebought from your bank!')} />
      )}
    </UiEntity>
  )
}

/* ---------- kicked + toast ---------- */
function Notices() {
  const now = Date.now()
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 70, left: '50%' }, margin: { left: -260 }, width: 520, flexDirection: 'column', alignItems: 'center' }}>
      {store.kicked ? (
        <UiEntity uiTransform={{ flexDirection: 'column', alignItems: 'center', padding: 10, width: 520 }} uiBackground={{ color: C.panel }}>
          <Label value="Your account was opened on another device." fontSize={15} color={C.white} uiTransform={{ height: 24 }} />
          <Btn label="[E] Play here" color={C.green} w={180} onClick={() => autoLogin()} />
        </UiEntity>
      ) : null}
      {store.toast && store.toastUntil > now ? (
        <UiEntity uiTransform={{ padding: 10, margin: { top: 6 } }} uiBackground={{ color: C.panel }}>
          <Label value={store.toast} fontSrc={kr(store.toast)} fontSize={15} color={C.white} uiTransform={{ height: 22 }} />
        </UiEntity>
      ) : null}
    </UiEntity>
  )
}

export function Ui() {
  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
      <AccountPanel />
      <HandPanel />
      <BrokePanel />
      <Notices />
      <ChipGauge />
      <Banner />
      <LoginModal />
    </UiEntity>
  )
}


/* ---------- bottom-right chip meter ---------- */
function ChipGauge() {
  const v = store.view
  const me = v && v.me
  if (!v || !me) return null
  const shown = store.shownChips < 0 ? me.chips : store.shownChips
  const top = Math.max(1, me.chips, ...v.ranking.map((r) => r.chips))
  const rank = v.ranking.findIndex((r) => r.name === me.name)
  const h = v.hand
  const inPot = h && !h.over && me.seat != null && h.ps[me.seat] ? (h.ps[me.seat] as any).total || h.ps[me.seat]!.bet || 0 : 0
  const delta = store.sessionStart >= 0 ? me.chips - store.sessionStart : 0
  const pct = Math.max(2, Math.min(100, (100 * shown) / top))
  const flash = store.chipFlash && store.chipFlashUntil > Date.now()
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { bottom: 16, right: 16 }, width: 300, flexDirection: 'column', padding: 12 }}
      uiBackground={{ color: C.panel }}
    >
      <UiEntity uiTransform={{ flexDirection: 'row', justifyContent: 'space-between', height: 20 }}>
        <Label value="GOLD AT TABLE" fontSize={13} color={C.dim} textAlign="middle-left" uiTransform={{ width: 120, height: 20 }} />
        <Label value={rank >= 0 ? 'RANK #' + (rank + 1) : ''} fontSize={13} color={C.cyan} textAlign="middle-right" uiTransform={{ width: 140, height: 20 }} />
      </UiEntity>
      <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', height: 46 }}>
        <UiEntity uiTransform={{ width: 30, height: 30, margin: { right: 8 } }} uiBackground={{ color: C.goldBtn }}>
          <Label value="$" fontSize={20} color={Color4.fromHexString('#1A0E00FF')} uiTransform={{ width: 30, height: 30 }} />
        </UiEntity>
        <Label value={fmt(Math.round(shown))} fontSize={34} color={C.gold} textAlign="middle-left" uiTransform={{ width: 150, height: 46 }} />
        {flash ? (
          <Label value={store.chipFlash} fontSize={18} color={store.chipFlash[0] === '+' ? C.green2 : C.err} textAlign="middle-right" uiTransform={{ width: 90, height: 46 }} />
        ) : null}
      </UiEntity>
      <UiEntity uiTransform={{ width: 276, height: 12, margin: { top: 4, bottom: 4 } }} uiBackground={{ color: Color4.create(1, 1, 1, 0.12) }}>
        <UiEntity uiTransform={{ width: `${pct}%`, height: 12 }} uiBackground={{ color: pct >= 99 ? C.gold : C.goldBtn }} />
      </UiEntity>
      <UiEntity uiTransform={{ flexDirection: 'row', justifyContent: 'space-between', height: 18 }}>
        <Label value={rank === 0 ? 'You are #1!' : 'vs #1  ' + fmt(top)} fontSize={12} color={C.dim} textAlign="middle-left" uiTransform={{ width: 130, height: 18 }} />
        <Label
          value={(inPot > 0 ? 'in pot ' + fmt(inPot) + '   ' : '') + (delta !== 0 ? (delta > 0 ? '+' : '') + fmt(delta) + ' today' : '')}
          fontSize={12}
          color={delta >= 0 ? C.green2 : C.err}
          textAlign="middle-right"
          uiTransform={{ width: 146, height: 18 }}
        />
      </UiEntity>
    </UiEntity>
  )
}

/* ---------- YOU WIN / YOU LOSE banner ---------- */
function Banner() {
  const left = store.bannerUntil - Date.now()
  if (!store.banner || left <= 0) return null
  const win = store.bannerWin
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: '28%', left: '50%' }, margin: { left: -300 }, width: 600, height: 90, justifyContent: 'center', alignItems: 'center' }}
      uiBackground={{ color: win ? Color4.create(0.35, 0.24, 0.0, 0.85) : Color4.create(0.25, 0.03, 0.05, 0.85) }}
    >
      <Label value={store.banner} fontSize={win ? 44 : 34} color={win ? C.gold : C.err} uiTransform={{ width: 600, height: 90 }} />
    </UiEntity>
  )
}

/** counts the chip meter toward the real number and notes gains / losses */
function chipMeter(dt: number) {
  const me = store.view && store.view.me
  if (!me) {
    store.shownChips = -1
    store.lastChips = -1
    return
  }
  if (store.sessionStart < 0) store.sessionStart = me.chips
  if (store.shownChips < 0 || store.lastChips < 0) {
    store.shownChips = me.chips
    store.lastChips = me.chips
    return
  }
  if (store.lastChips !== me.chips) {
    const d = me.chips - store.lastChips
    store.chipFlash = (d > 0 ? '+' : '') + fmt(d)
    store.chipFlashUntil = Date.now() + 2200
    store.lastChips = me.chips
  }
  const diff = me.chips - store.shownChips
  if (Math.abs(diff) < 0.5) {
    store.shownChips = me.chips
    return
  }
  store.shownChips += diff * Math.min(1, dt * 4) + Math.sign(diff) * Math.min(Math.abs(diff), dt * 20)
}

/* ---------- hotkeys ----------
 * In a hand (my turn): 1 fold · 2 check/call · 3 bet/raise · 4 cycle amount
 * At the table:        E play / sit / get chips · F sit out / back · Shift+F stand up · Shift+E log out
 * E and F only work near the table so the slot machines keep their own E. */
function nearTable() {
  const t = Transform.getOrNull(engine.PlayerEntity)
  if (!t) return true
  const c = toCasino(t.position.x, t.position.z)
  const dx = c.x - 8, dz = c.z - 10
  return dx * dx + dz * dz < 8 * 8
}

function hotkeys() {
  const pressed = (a: InputAction) => inputSystem.isTriggered(a, PointerEventType.PET_DOWN)
  const k1 = pressed(InputAction.IA_ACTION_3)
  const k2 = pressed(InputAction.IA_ACTION_4)
  const k3 = pressed(InputAction.IA_ACTION_5)
  const k4 = pressed(InputAction.IA_ACTION_6)
  const kE = pressed(InputAction.IA_PRIMARY)
  const kF = pressed(InputAction.IA_SECONDARY)
  if (store.loginOpen) return
  if (kE || kF) {
    if (nearTable()) tableKeys(kE, kF, inputSystem.isPressed(InputAction.IA_MODIFIER))
    return
  }
  if (!k1 && !k2 && !k3 && !k4) return
  const v = store.view
  const h = v && v.hand
  const o = h && h.opts
  if (!v || !h || !o || h.over) return
  store.lastTurnAt = Date.now()
  const send = (type: string, to?: number) => act('act', { type, to, no: h.no })
  if (k1) {
    // folding when a free check is available needs a second press
    if (o.toCall === 0 && store.foldArmUntil < Date.now()) {
      store.foldArmUntil = Date.now() + 2500
      toast('Checking is free. Press 1 again to fold, or 2 to check.', 2500)
      return
    }
    store.foldArmUntil = 0
    send('fold')
  } else if (k2) send('call')
  else if (k3 && o.canRaise) send('raise', store.raiseTo)
  else if (k4 && o.canRaise) {
    const clamp = (x: number) => Math.max(o.minTo, Math.min(o.maxTo, Math.round(x)))
    const pre = [o.minTo, clamp(o.currentBet + (o.pot + o.toCall) * 0.5), clamp(o.currentBet + o.pot + o.toCall), o.maxTo]
      .filter((x, i, a) => a.indexOf(x) === i)
      .sort((a, b) => a - b)
    const next = pre.find((x) => x > store.raiseTo)
    store.raiseTo = next !== undefined ? next : pre[0]
    const label = store.raiseTo >= o.maxTo ? 'All-in ' + fmt(o.maxTo) : (o.currentBet > 0 ? 'Raise to ' : 'Bet ') + fmt(store.raiseTo)
    toast(label + '  (press 3 to confirm)', 1800)
  }
}

/** E / F / Shift+F / Shift+E. Leaving keys (sit out, stand up, log out) need a second press. */
function tableKeys(kE: boolean, kF: boolean, shift: boolean) {
  const v = store.view
  const now = Date.now()
  const me = v && v.me
  if (kE && shift) {
    if (!me) return
    if (store.logoutArmUntil < now) {
      store.logoutArmUntil = now + 2500
      return toast('Press Shift+E again to log out.', 2500)
    }
    store.logoutArmUntil = 0
    return void logout()
  }
  if (kE) {
    if (store.kicked || !me) return void autoLogin()
    if (me.broke && me.canRecover) return void act('recover', {}, 'Rebought from your bank!')
    if (me.seat == null) return void sitAnywhere()
    return
  }
  if (!me || me.seat == null || !kF) return
  if (shift) {
    if (store.standArmUntil < now) {
      store.standArmUntil = now + 2500
      return toast('Press Shift+F again to stand up' + (v && v.hand && !v.hand.over ? ' (folds this hand).' : '.'), 2500)
    }
    store.standArmUntil = 0
    return void act('stand', {}, 'You left your seat.')
  }
  if (me.away) return void act('away')
  if (store.awayArmUntil < now) {
    store.awayArmUntil = now + 2500
    return toast('Press F again to sit out.', 2500)
  }
  store.awayArmUntil = 0
  return void act('away')
}

/** Sit in the first open seat (logs in first when needed). */
async function sitAnywhere() {
  const v = store.view
  if (!v) return
  if (!v.me && !(await autoLogin())) return
  const me = store.view && store.view.me
  if (!me || me.seat != null) return
  if (me.chips <= 0 && (me.bank || 0) < (v.cfg.minBuyIn || 500)) return toast(`You need ${v.cfg.minBuyIn || 500} gold in your bank to sit. Hunt in WOW NIGHTSWARM!`)
  const order = [2, 1, 3, 0, 4]
  const seat = order.find((i) => !store.view!.seats[i])
  if (seat === undefined) return toast('The table is full.')
  await act('sit', { seat }, 'You sat down. Good luck!')
}

export function startUi() {
  // the WOW UI root draws <Ui/> while the hunter is inside the casino
  engine.addSystem(() => {
    if (playerInCasino()) hotkeys()
  })
  engine.addSystem(chipMeter)
}

export { toast, displayName }
export function playerInCasino() {
  const t = Transform.getOrNull(engine.PlayerEntity)
  return !!t && inCasino(t.position.x, t.position.z)
}
