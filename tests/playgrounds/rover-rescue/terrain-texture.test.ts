import { afterEach, describe, expect, it, vi } from "vitest"

class RecordedCanvas {
  signature = 0
  draws = 0
  constructor(readonly width: number, readonly height: number) {}
  getContext() {
    const record = (...values: number[]) => {
      this.draws++
      for (const value of values) this.signature = (Math.imul(this.signature, 31) + Math.round(value * 100)) | 0
    }
    return { fillStyle: "", fillRect: record, beginPath() {}, moveTo: record,
      lineTo: record, closePath() {}, fill() {} }
  }
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

describe("terrain artwork cache", () => {
  it("reuses one texture without repainting on subsequent frames", async () => {
    vi.stubGlobal("OffscreenCanvas", RecordedCanvas)
    const { terrainTexture } = await import("@/playgrounds/rover-rescue/art/terrain-texture")
    const first = terrainTexture(11) as unknown as RecordedCanvas
    const draws = first.draws
    for (let i = 0; i < 20; i++) expect(terrainTexture(11)).toBe(first)
    expect(first.draws).toBe(draws)
    expect(draws).toBeGreaterThan(70000)
    expect(first.width * first.height * 4).toBeLessThan(12_000_000)
  })

  it("recreates the same world art after seed changes without retaining old canvases", async () => {
    vi.stubGlobal("OffscreenCanvas", RecordedCanvas)
    const { terrainTexture } = await import("@/playgrounds/rover-rescue/art/terrain-texture")
    const a = terrainTexture(11) as unknown as RecordedCanvas
    const b = terrainTexture(22) as unknown as RecordedCanvas
    const again = terrainTexture(11) as unknown as RecordedCanvas
    expect(b.signature).not.toBe(a.signature)
    expect(again).not.toBe(a)
    expect(again.signature).toBe(a.signature)
  })

  it("leaves the vector terrain available when offscreen rendering is unavailable", async () => {
    vi.stubGlobal("OffscreenCanvas", undefined)
    const { terrainTexture } = await import("@/playgrounds/rover-rescue/art/terrain-texture")
    expect(terrainTexture(1)).toBeUndefined()
  })
})
