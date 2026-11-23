// The GYBM casino scene is the casino's own frame (no rotation): every spot of the parcel is "in the casino".
export function toCasino(x: number, z: number) {
  return { x, z }
}
export function inCasino(_x: number, _z: number) {
  return true
}
