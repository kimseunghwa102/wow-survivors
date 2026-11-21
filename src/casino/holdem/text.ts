// The server speaks Korean (it also serves the Korean web table). In-world text is shown in English,
// because not every Decentraland client can draw Hangul. Player names are shown as they are.

export const AI_NAME = 'AI 알파'
export const displayName = (n: string) => (n === AI_NAME ? 'AI Alpha' : n)
export const hasHangul = (s: string) => /[ᄀ-ᇿ㄰-㆏가-힯]/.test(s)
/** Google Fonts family for names that contain Hangul (falls back to the default font where unsupported) */
export const KR_FONT = 'Noto Sans KR'

const HANDS: Record<string, string> = {
  하이카드: 'High Card',
  원페어: 'One Pair',
  투페어: 'Two Pair',
  트리플: 'Three of a Kind',
  스트레이트: 'Straight',
  플러시: 'Flush',
  풀하우스: 'Full House',
  포카드: 'Four of a Kind',
  '스트레이트 플러시': 'Straight Flush',
  '로열 플러시': 'Royal Flush'
}
export const handName = (k: string | null | undefined) => (k ? HANDS[k] || k : '')

const LOG: [RegExp, string][] = [
  [/ 시간초과 체크/g, ' timed out (check)'],
  [/ 시간초과 폴드/g, ' timed out (fold)'],
  [/퇴장 \(폴드\)/g, 'left the table'],
  [/자리 비켜줌/g, 'made room'],
  [/연결 끊김/g, 'disconnected'],
  [/블랙잭으로 이동/g, 'went to blackjack'],
  [/ \(올인\)/g, ' (all-in)'],
  [/ 폴드/g, ' folds'],
  [/ 체크/g, ' checks'],
  [/ 콜 /g, ' calls '],
  [/ 벳 /g, ' bets '],
  [/ 레이즈 /g, ' raises to '],
  [/쇼다운/g, 'Showdown'],
  [/AI 알파/g, 'AI Alpha']
]
export function logLine(s: string) {
  let t = s
  for (const [re, to] of LOG) t = t.replace(re, to)
  return t
}

const ERRORS: [string, string][] = [
  ['이미 앉아', 'You are already seated.'],
  ['방금 다른 사람이 앉았', 'Someone just took that seat.'],
  ['닉네임은 1~10자', 'Nickname must be 1-10 characters.'],
  ['PIN은 숫자 4자리', 'PIN must be 4 digits.'],
  ['PIN이 달라요', 'That nickname exists and the PIN is wrong. New here? Pick another nickname.'],
  ['여러 번 틀렸', 'Too many wrong PINs. Try again in a few minutes.'],
  ['AI 플레이어 이름', 'That name is reserved. Pick another one.'],
  ['내 차례가 아니', 'It is not your turn.'],
  ['레이즈할 수 없', 'That raise amount is not allowed.'],
  ['칩이 남아 있으면', 'You still have chips.'],
  ['핸드가 끝난 뒤', 'After this hand ends.'],
  ['블랙잭 판이 끝', 'Finish your blackjack round first.'],
  ['먼저 입장', 'Log in first.'],
  ['등록 인원이 가득', 'Registration is full.'],
  ['시도가 너무 많', 'Too many attempts. Rejoin the scene and try again.'],
  ['서버 오류', 'Server error. Try again.']
]
export function errorText(msg: string | undefined, fallback = 'Could not do that.') {
  if (!msg) return fallback
  for (const [k, v] of ERRORS) if (msg.indexOf(k) >= 0) return v
  return fallback
}

export function fmt(n: number) {
  const s = String(Math.floor(Math.abs(n)))
  let out = ''
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ','
    out += s[i]
  }
  return (n < 0 ? '-' : '') + out
}
export function mmss(ms: number) {
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const pad = (x: number) => (x < 10 ? '0' + x : '' + x)
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`
}
