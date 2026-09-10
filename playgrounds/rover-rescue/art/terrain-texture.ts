import { createRng } from "@/engine"

// One bounded, world-anchored texture, independent of the simulation RNG.
// 2400 x 1200 resolves the ground in the maximized 3x view (~11 MB).
const WIDTH = 2400
const HEIGHT = 1200
let cached: { seed: number; canvas: OffscreenCanvas } | undefined

export function terrainTexture(seed: number): OffscreenCanvas | undefined {
  if (typeof OffscreenCanvas === "undefined") return undefined
  if (cached?.seed === seed) return cached.canvas
  const canvas = new OffscreenCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext("2d")
  if (!ctx) return undefined
  const rng = createRng(seed).fork("terrain-art")
  ctx.fillStyle = "#808080"
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Low contrast strata and wind-scoured patches, never collision props.
  for (let i = 0; i < 650; i++) {
    const x = rng.next() * WIDTH
    const y = rng.next() * HEIGHT
    const r = 12 + rng.next() * 95
    ctx.fillStyle = i % 3 === 0 ? "rgba(22,25,20,0.22)" : "rgba(233,225,190,0.19)"
    ctx.beginPath()
    for (let j = 0; j < 8; j++) {
      const a = j * Math.PI / 4
      const radius = r * (0.55 + rng.next() * 0.45)
      const px = x + Math.cos(a) * radius
      const py = y + Math.sin(a) * radius * 0.55
      if (j === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
  }
  for (let i = 0; i < 70000; i++) {
    const x = rng.next() * WIDTH
    const y = rng.next() * HEIGHT
    const r = 0.4 + rng.next() * 2.2
    ctx.fillStyle = i % 2 ? "rgba(17,24,19,0.19)" : "rgba(246,239,210,0.22)"
    ctx.fillRect(x, y, r * 1.6, r)
  }
  for (let i = 0; i < 2400; i++) {
    const x = rng.next() * WIDTH
    const y = rng.next() * HEIGHT
    const r = 1.2 + rng.next() * 3.2
    ctx.fillStyle = "rgba(21,27,22,0.35)"
    ctx.beginPath()
    ctx.moveTo(x - r, y)
    ctx.lineTo(x, y - r * 0.55)
    ctx.lineTo(x + r, y)
    ctx.lineTo(x + r * 0.5, y + r * 0.6)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = "rgba(248,240,195,0.3)"
    ctx.fillRect(x - r * 0.5, y - r * 0.35, r, 0.6)
  }
  cached = { seed, canvas }
  return canvas
}
