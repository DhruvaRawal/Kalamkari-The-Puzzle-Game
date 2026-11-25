/**
 * Seeded mulberry32. The RNG state is a plain uint32 stored in GameState, so the engine stays pure:
 * every draw returns the value and the next state.
 */
export type RngState = number;

export const createRng = (seed: number): RngState => (seed >>> 0) || 0x9e3779b9;

export function nextFloat(state: RngState): [number, RngState] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

export function nextInt(state: RngState, maxExclusive: number): [number, RngState] {
  const [f, next] = nextFloat(state);
  return [Math.floor(f * maxExclusive), next];
}

/** Fisher–Yates; returns a new array. */
export function shuffle<T>(items: readonly T[], state: RngState): [T[], RngState] {
  const out = items.slice();
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    let j: number;
    [j, s] = nextInt(s, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return [out, s];
}

/** A non-cryptographic seed for hosts that don't care about reproducibility. */
export const randomSeed = (): number => Math.floor(Math.random() * 0xffffffff);
