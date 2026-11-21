// Shared client state for the in-world GYBM Hold'em table.
// The server (same one as the GYBM web table) is the source of truth; this only mirrors its view.

export type Opts = { toCall: number; minTo: number; maxTo: number; canRaise: boolean; currentBet: number; pot: number }
export type SeatView = { name: string; chips: number; away: boolean; online: boolean; me: boolean; bot: boolean } | null
export type HandPlayer = { name: string; bet: number; folded: boolean; allin: boolean; cards: string[] | null; current: boolean } | null
export type HandView = {
  no: number
  street: number
  board: string[]
  toAct: number
  over: boolean
  sb: number
  bb: number
  button: number
  turnLeft: number
  log: string[]
  pot: number
  ps: HandPlayer[]
  result: { reason: string; wins: Record<string, number>; shown: Record<string, string>; best: Record<string, string[]>; pot: number } | null
  opts: Opts | null
  myBest: string | null
}
export type RankRow = { name: string; chips: number; net: number; handsWon: number; handsPlayed: number; online: boolean; seated: boolean }
export type MeView = {
  name: string
  chips: number
  bank?: number
  seat: number | null
  away: boolean
  busts: number
  broke: boolean
  recoverIn: number
  canRecover: boolean
  recoverLong: boolean
  recoverAmt: number
  bj: boolean
}
export type View = {
  cfg: { start: number; sb: number; bb: number; turnSecs: number; ai: boolean; gold?: boolean; minBuyIn?: number; maxBuyIn?: number }
  me: MeView | null
  seats: SeatView[]
  button: number
  handNo: number
  nextIn: number
  hand: HandView | null
  ranking: RankRow[]
  linked: string | null
}

export type Status = 'starting' | 'waking' | 'connecting' | 'online' | 'offline'

export const store = {
  status: 'starting' as Status,
  verified: false, // wallet proven by signed fetch
  note: '', // last connection problem, shown small in the panel
  noAuto: false, // the player logged out: no automatic wallet login this visit
  newPin: '', // PIN of an account just created from the wallet (for the web version)
  foldArmUntil: 0, // free-check guard for the fold hotkey
  awayArmUntil: 0,
  standArmUntil: 0,
  logoutArmUntil: 0,
  banner: '',
  bannerWin: true,
  bannerUntil: 0,
  shownChips: -1,
  lastChips: -1,
  sessionStart: -1,
  chipFlash: '',
  chipFlashUntil: 0,
  lastTurnAt: 0, // last frame it was my turn (table hotkeys wait a moment after it)
  view: null as View | null,
  viewAt: 0, // Date.now() when the view arrived
  kicked: false,
  // login form
  loginOpen: false,
  formName: '',
  formPin: '',
  formError: '',
  busy: false,
  remembered: null as { name: string; pin: string } | null, // this visit only, to log back in after a reconnect
  // turn timer + raise slider
  turnEnd: 0,
  turnKey: '',
  raiseTo: 0,
  // toast
  toast: '',
  toastUntil: 0,
  // where the turn timer etc. should be shown
  nearTable: true
}

export function toast(msg: string, ms = 3500) {
  store.toast = msg
  store.toastUntil = Date.now() + ms
}
