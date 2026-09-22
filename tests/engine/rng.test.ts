import { describe, expect, it } from "vitest"
import { createRng } from "@/engine/rng"

describe("createRng", () => {
  it("is deterministic for a given seed", () => {
    const a = createRng(42)
    const b = createRng(42)
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()])
  })

  it("draws different streams for different seeds", () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next())
  })

  it("keeps next() in [0, 1)", () => {
    const rng = createRng(7)
    for (let i = 0; i < 50; i++) {
      const n = rng.next()
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(1)
    }
  })

  it("returns inclusive ints and picks from an array", () => {
    const rng = createRng(99)
    for (let i = 0; i < 40; i++) {
      const n = rng.int(3, 5)
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(5)
    }
    expect(rng.int(5, 3)).toBeGreaterThanOrEqual(3)
    expect(["a", "b", "c"]).toContain(rng.pick(["a", "b", "c"]))
    expect(() => rng.pick([])).toThrow(RangeError)
  })

  it("forks independent labelled streams", () => {
    const root = createRng(1)
    const minerals = root.fork("minerals")
    const enemies = root.fork("enemies")
    expect(minerals.next()).not.toBe(enemies.next())
    expect(root.fork("minerals").next()).toBe(createRng(1).fork("minerals").next())
    expect(root.fork("minerals").seed).not.toBe(root.seed)
  })
})
