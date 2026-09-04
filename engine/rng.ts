/**
 * Seeded PRNG (mulberry32) with independent forked streams.
 * Not the Ocean Reef `seededRandom` hash — that stays in lib/robot-runtime.ts.
 */

export interface SeededRng {
  /** Next value in [0, 1). */
  next(): number
  /** Inclusive integer in [min, max]. */
  int(min: number, max: number): number
  pick<T>(array: readonly T[]): T
  /** Independent stream derived from this seed and `label`. */
  fork(label: string): SeededRng
  readonly seed: number
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashLabel(seed: number, label: string): number {
  let h = seed >>> 0
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 0x9e3779b9)
  }
  return h >>> 0
}

export function createRng(seed: number): SeededRng {
  const next = mulberry32(seed)
  const rng: SeededRng = {
    seed: seed >>> 0,
    next,
    int(min: number, max: number) {
      const lo = Math.ceil(Math.min(min, max))
      const hi = Math.floor(Math.max(min, max))
      if (hi < lo) return lo
      return lo + Math.floor(next() * (hi - lo + 1))
    },
    pick<T>(array: readonly T[]): T {
      if (array.length === 0) {
        throw new RangeError("pick() from empty array")
      }
      return array[Math.floor(next() * array.length)] as T
    },
    fork(label: string) {
      return createRng(hashLabel(seed, label))
    },
  }
  return rng
}
