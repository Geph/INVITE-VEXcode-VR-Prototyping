import type { Camera, Viewport } from "@/engine"
import { worldToScreen } from "@/engine"
import { hexVertices } from "../layout"

type Point = { x: number; y: number }
let waterTile: HTMLCanvasElement | null = null
const patterns = new WeakMap<CanvasRenderingContext2D, CanvasPattern>()

/** Periodic Voronoi caustics, baked once rather than rebuilt in the animation loop. */
function makeWaterTile(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null
  const tile = document.createElement("canvas"); tile.width = tile.height = 384
  const ctx = tile.getContext("2d")
  if (!ctx) return null
  ctx.fillStyle = "#098ba9"; ctx.fillRect(0, 0, 384, 384)
  const points: Point[] = []
  const noise = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v) }
  for (let y = -1; y <= 6; y++) for (let x = -1; x <= 6; x++) {
    const id = ((y + 6) % 6) * 6 + ((x + 6) % 6)
    points.push({ x: (x + 0.2 + noise(id) * 0.6) * 64, y: (y + 0.2 + noise(id + 67) * 0.6) * 64 })
  }
  for (const p of points) {
    let poly: Point[] = [{ x: p.x - 100, y: p.y - 100 }, { x: p.x + 100, y: p.y - 100 },
      { x: p.x + 100, y: p.y + 100 }, { x: p.x - 100, y: p.y + 100 }]
    for (const q of points) {
      if (p === q || Math.hypot(p.x - q.x, p.y - q.y) > 170) continue
      const nx = q.x - p.x, ny = q.y - p.y, d = (q.x * q.x + q.y * q.y - p.x * p.x - p.y * p.y) / 2
      const clipped: Point[] = []
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length]
        const da = a.x * nx + a.y * ny - d, db = b.x * nx + b.y * ny - d
        if (da <= 0) clipped.push(a)
        if ((da <= 0) !== (db <= 0)) {
          const t = da / (da - db); clipped.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
        }
      }
      poly = clipped
    }
    if (poly.length < 3) continue
    const g = ctx.createRadialGradient(p.x - 8, p.y - 12, 1, p.x, p.y, 55)
    g.addColorStop(0, "#007798"); g.addColorStop(0.75, "#0b94b0"); g.addColorStop(1, "#28adc0")
    ctx.beginPath()
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], c = poly[(i + 2) % poly.length]
      if (i === 0) ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2)
      ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2)
    }
    ctx.closePath(); ctx.fillStyle = g; ctx.fill()
    ctx.strokeStyle = "#76deea35"; ctx.lineWidth = 9; ctx.stroke()
    ctx.strokeStyle = "#89e9f15a"; ctx.lineWidth = 3; ctx.stroke()
    ctx.strokeStyle = "#b3f3ed88"; ctx.lineWidth = 0.9; ctx.stroke()
  }
  // Refract the cellular highlights into irregular ripples. The displacement is
  // periodic in both axes, so the cached texture still tiles without seams.
  const source = ctx.getImageData(0, 0, 384, 384)
  const warped = ctx.createImageData(384, 384)
  const tau = Math.PI * 2
  for (let y = 0; y < 384; y++) for (let x = 0; x < 384; x++) {
    const sx = (x + 18 * Math.sin(tau * y / 128) + 10 * Math.sin(tau * (x + y) / 192) + 384) % 384
    const sy = (y + 17 * Math.sin(tau * x / 192) + 9 * Math.sin(tau * (y - x) / 128) + 384) % 384
    const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0
    const shade = 0.9 + 0.12 * Math.sin(tau * (x + y) / 384) + 0.07 * Math.cos(tau * y / 128)
    const dst = (y * 384 + x) * 4
    for (let channel = 0; channel < 3; channel++) {
      const sample = (dx: number, dy: number) => source.data[(((y0 + dy) % 384) * 384 + (x0 + dx) % 384) * 4 + channel]
      warped.data[dst + channel] = ((sample(0, 0) * (1 - fx) + sample(1, 0) * fx) * (1 - fy)
        + (sample(0, 1) * (1 - fx) + sample(1, 1) * fx) * fy) * shade
    }
    warped.data[dst + 3] = 255
  }
  ctx.putImageData(warped, 0, 0)
  return tile
}

export function drawCastleField(ctx: CanvasRenderingContext2D, cam: Camera, viewport: Viewport, elapsedMs: number, showIsland = true): void {
  ctx.save(); ctx.fillStyle = "#098da9"; ctx.fillRect(0, 0, viewport.widthPx, viewport.heightPx)
  if (!waterTile) waterTile = makeWaterTile()
  let pattern = patterns.get(ctx)
  if (!pattern && waterTile) {
    pattern = ctx.createPattern(waterTile, "repeat") ?? undefined
    if (pattern) patterns.set(ctx, pattern)
  }
  if (pattern) {
    const scale = cam.zoom * 3.4
    const origin = worldToScreen({ x: 0, y: 0 }, cam, viewport)
    ctx.save(); ctx.translate(origin.x, origin.y); ctx.scale(scale, scale); ctx.fillStyle = pattern
    ctx.fillRect(-origin.x / scale, -origin.y / scale, viewport.widthPx / scale, viewport.heightPx / scale); ctx.restore()
    ctx.fillStyle = `rgba(99,213,226,${0.025 + Math.sin(elapsedMs / 2500) * 0.015})`
    ctx.fillRect(0, 0, viewport.widthPx, viewport.heightPx)
  }
  if (!showIsland) { ctx.restore(); return }
  const verts = hexVertices().map((p) => worldToScreen(p, cam, viewport))
  ctx.beginPath(); ctx.moveTo(verts[0].x, verts[0].y)
  for (const v of verts.slice(1)) ctx.lineTo(v.x, v.y)
  ctx.closePath(); ctx.fillStyle = "#496f38"; ctx.fill()
  ctx.lineJoin = "miter"; ctx.lineWidth = 70 * cam.zoom; ctx.strokeStyle = "#882b1d"; ctx.stroke(); ctx.restore()
}
