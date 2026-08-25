/**
 * Canvas artwork for the Coral Reef Cleanup playground.
 *
 * Kept separate from the simulation so the playground and the "predict" preview
 * render the same robot and reef. Nothing here reads or writes simulation
 * state: callers position the context, these helpers only paint.
 */

import { seededRandom, type CoralPiece } from "./robot-runtime"

const HEX = /^#([0-9a-f]{6})$/i

function toRgb(hex: string): [number, number, number] {
  const match = typeof hex === "string" ? HEX.exec(hex.trim()) : null
  if (!match) return [255, 107, 107]
  const n = Number.parseInt(match[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mix(hex: string, target: [number, number, number], amount: number): string {
  const [r, g, b] = toRgb(hex)
  const t = Math.max(0, Math.min(1, amount))
  const lerp = (from: number, to: number) => Math.round(from + (to - from) * t)
  return `rgb(${lerp(r, target[0])}, ${lerp(g, target[1])}, ${lerp(b, target[2])})`
}

const lighten = (hex: string, amount: number) => mix(hex, [255, 236, 214], amount)
/** Shaded toward a warm reef brown rather than black, so shadows stay organic. */
const darken = (hex: string, amount: number) => mix(hex, [58, 26, 38], amount)

export type CoralKind = "brain" | "branch" | "fan" | "polyps" | "tube"

export const CORAL_KINDS: CoralKind[] = ["brain", "branch", "fan", "polyps", "tube"]

/**
 * Reef palette. Weighted toward coral reds and oranges with a few reef pinks
 * and one purple accent, and kept clear of the submarine's yellow.
 */
export const CORAL_COLORS = [
  "#E8503F",
  "#F2704A",
  "#D93F5B",
  "#E8537A",
  "#F28A3C",
  "#C9436B",
  "#B3479B",
  "#DD5A45",
]

/** Coral rubble the colonies grow out of. One flat tone so pieces merge. */
const REEF_ROCK = "#8A6660"
const REEF_ROCK_TOP = "#9D7972"

/**
 * Paints the rubble bed under the whole reef.
 *
 * Drawn as a separate pass before any colonies: every mound uses the same flat
 * colour, so overlapping pieces fuse into one continuous ledge instead of
 * stamping a dark puddle under each colony.
 */
export function drawReefBed(ctx: CanvasRenderingContext2D, pieces: CoralPiece[]): void {
  ctx.save()
  ctx.fillStyle = REEF_ROCK
  for (const piece of pieces) {
    ctx.save()
    ctx.translate(piece.x, piece.y)
    ctx.rotate(piece.angle ?? 0)
    ctx.beginPath()
    ctx.ellipse(0, piece.radius * 0.36, piece.radius * 1.08, piece.radius * 0.62, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.fillStyle = REEF_ROCK_TOP
  for (const piece of pieces) {
    ctx.save()
    ctx.translate(piece.x, piece.y)
    ctx.rotate(piece.angle ?? 0)
    ctx.beginPath()
    ctx.ellipse(0, piece.radius * 0.3, piece.radius * 0.88, piece.radius * 0.44, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.restore()
}

/**
 * Paints one reef colony in playground coordinates.
 *
 * `piece.angle` rotates the colony so it grows away from its wall; everything
 * stays inside `piece.radius` so the art matches the collision envelope.
 */
export function drawCoralPiece(ctx: CanvasRenderingContext2D, piece: CoralPiece): void {
  const r = piece.radius
  const seed = piece.seed ?? Math.round(piece.x * 31 + piece.y * 17)
  const kind = piece.kind ?? CORAL_KINDS[Math.floor(seededRandom(seed) * CORAL_KINDS.length)]
  const rnd = (k: number) => seededRandom(seed + k * 13.37)

  ctx.save()
  ctx.translate(piece.x, piece.y)
  ctx.rotate(piece.angle ?? 0)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"

  switch (kind) {
    case "brain": {
      const dome = ctx.createRadialGradient(-r * 0.28, -r * 0.42, r * 0.08, 0, -r * 0.05, r * 1.05)
      dome.addColorStop(0, lighten(piece.color, 0.3))
      dome.addColorStop(0.65, piece.color)
      dome.addColorStop(1, darken(piece.color, 0.3))
      ctx.fillStyle = dome
      ctx.beginPath()
      ctx.ellipse(0, r * 0.02, r * 0.92, r * 0.8, 0, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = darken(piece.color, 0.42)
      ctx.lineWidth = Math.max(0.9, r * 0.09)
      for (let i = 0; i < 4; i++) {
        const y = -r * 0.46 + i * r * 0.32
        const wob = r * (0.16 + rnd(i) * 0.12)
        ctx.beginPath()
        ctx.moveTo(-r * 0.72, y)
        ctx.quadraticCurveTo(-r * 0.24, y + wob, 0, y)
        ctx.quadraticCurveTo(r * 0.24, y - wob, r * 0.72, y)
        ctx.stroke()
      }
      break
    }

    case "branch": {
      const count = 3 + Math.floor(rnd(1) * 3)
      for (let i = 0; i < count; i++) {
        const spread = (count === 1 ? 0 : i / (count - 1) - 0.5) * 1.5
        const len = r * (0.95 + rnd(i + 2) * 0.45)
        const tipX = Math.sin(spread) * len
        const tipY = -Math.cos(spread) * len + r * 0.24
        const rootX = Math.sin(spread) * r * 0.22
        const ctrlX = tipX * 0.45
        const ctrlY = (tipY + r * 0.24) * 0.5

        ctx.beginPath()
        ctx.moveTo(rootX, r * 0.3)
        ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY)
        ctx.strokeStyle = darken(piece.color, 0.24)
        ctx.lineWidth = r * 0.32
        ctx.stroke()
        // Re-stroking the same path thinner leaves a highlight down the branch.
        ctx.strokeStyle = lighten(piece.color, 0.18)
        ctx.lineWidth = r * 0.13
        ctx.stroke()

        // A short twig keeps the colony from reading as a bundle of rods.
        if (i % 2 === 0) {
          const twigX = tipX + Math.sin(spread + 0.9) * r * 0.4
          const twigY = tipY - Math.cos(spread + 0.9) * r * 0.4
          ctx.beginPath()
          ctx.moveTo(ctrlX, ctrlY)
          ctx.quadraticCurveTo((ctrlX + twigX) / 2, (ctrlY + twigY) / 2, twigX, twigY)
          ctx.strokeStyle = darken(piece.color, 0.24)
          ctx.lineWidth = r * 0.2
          ctx.stroke()
          ctx.fillStyle = lighten(piece.color, 0.4)
          ctx.beginPath()
          ctx.arc(twigX, twigY, r * 0.11, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.fillStyle = lighten(piece.color, 0.4)
        ctx.beginPath()
        ctx.arc(tipX, tipY, r * 0.14, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }

    case "fan": {
      const h = r * 1.25
      const w = r * 0.9
      // Translucent membrane, then ribs over it, so the fan reads as lacy
      // rather than as a solid scallop shell.
      ctx.globalAlpha = 0.55
      const web = ctx.createLinearGradient(0, r * 0.3, 0, -h)
      web.addColorStop(0, darken(piece.color, 0.25))
      web.addColorStop(1, lighten(piece.color, 0.2))
      ctx.fillStyle = web
      ctx.beginPath()
      ctx.moveTo(0, r * 0.3)
      ctx.bezierCurveTo(-w, -h * 0.15, -w * 0.8, -h * 0.92, 0, -h * 0.86)
      ctx.bezierCurveTo(w * 0.8, -h * 0.92, w, -h * 0.15, 0, r * 0.3)
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = 1

      ctx.strokeStyle = piece.color
      ctx.lineWidth = Math.max(1, r * 0.11)
      for (let i = -3; i <= 3; i++) {
        const t = i / 3
        const tipX = t * w * 0.92
        const tipY = -h * (1 - Math.abs(t) * 0.24)
        ctx.beginPath()
        ctx.moveTo(0, r * 0.28)
        ctx.quadraticCurveTo(t * w * 0.34, -h * 0.5, tipX, tipY)
        ctx.stroke()
        ctx.fillStyle = lighten(piece.color, 0.35)
        ctx.beginPath()
        ctx.arc(tipX, tipY, r * 0.09, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }

    case "polyps": {
      const count = 4 + Math.floor(rnd(3) * 3)
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2
        const dist = r * (0.24 + rnd(i + 5) * 0.4)
        const cx = Math.cos(a) * dist
        const cy = Math.sin(a) * dist * 0.68 - r * 0.16
        const rr = r * (0.3 + rnd(i + 9) * 0.18)
        const bulb = ctx.createRadialGradient(cx - rr * 0.35, cy - rr * 0.4, rr * 0.1, cx, cy, rr)
        bulb.addColorStop(0, lighten(piece.color, 0.4))
        bulb.addColorStop(0.7, piece.color)
        bulb.addColorStop(1, darken(piece.color, 0.3))
        ctx.fillStyle = bulb
        ctx.beginPath()
        ctx.arc(cx, cy, rr, 0, Math.PI * 2)
        ctx.fill()

        // Pores stop the cluster from reading as a bunch of grapes.
        ctx.fillStyle = darken(piece.color, 0.4)
        for (let p = 0; p < 3; p++) {
          const pa = rnd(i * 4 + p) * Math.PI * 2
          const pd = rr * 0.45 * rnd(i * 4 + p + 30)
          ctx.beginPath()
          ctx.arc(cx + Math.cos(pa) * pd, cy + Math.sin(pa) * pd, rr * 0.14, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      break
    }

    case "tube": {
      const count = 3 + Math.floor(rnd(2) * 2)
      for (let i = 0; i < count; i++) {
        const cx = (i - (count - 1) / 2) * r * 0.52
        const h = r * (0.7 + rnd(i + 7) * 0.85)
        const w = r * 0.22
        const top = -h + r * 0.3
        const wall = ctx.createLinearGradient(cx - w, 0, cx + w, 0)
        wall.addColorStop(0, darken(piece.color, 0.36))
        wall.addColorStop(0.42, lighten(piece.color, 0.16))
        wall.addColorStop(1, darken(piece.color, 0.3))
        ctx.fillStyle = wall
        ctx.beginPath()
        ctx.roundRect(cx - w, top, w * 2, h, w)
        ctx.fill()

        ctx.fillStyle = lighten(piece.color, 0.28)
        ctx.beginPath()
        ctx.ellipse(cx, top + w * 0.3, w * 0.92, w * 0.5, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = darken(piece.color, 0.55)
        ctx.beginPath()
        ctx.ellipse(cx, top + w * 0.34, w * 0.55, w * 0.28, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
  }

  ctx.restore()
}

/* -------------------------------------------------------------------------- */
/*  Submarine                                                                  */
/* -------------------------------------------------------------------------- */

/** Local frame: the sub points along -Y, matching a heading of 0 degrees. */
const HULL_NOSE = 32
const HULL_TAIL = 25
const HULL_HALF_W = 14
const TAIL_HALF_W = 6.5

/** A long hull with a pointed bow and a blunt, propeller-ended stern. */
function hullPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath()
  ctx.moveTo(0, -HULL_NOSE)
  ctx.bezierCurveTo(7.5, -30, HULL_HALF_W, -18, HULL_HALF_W, -3)
  ctx.bezierCurveTo(HULL_HALF_W, 12, 11, 21, TAIL_HALF_W, HULL_TAIL)
  ctx.lineTo(-TAIL_HALF_W, HULL_TAIL)
  ctx.bezierCurveTo(-11, 21, -HULL_HALF_W, 12, -HULL_HALF_W, -3)
  ctx.bezierCurveTo(-HULL_HALF_W, -18, -7.5, -30, 0, -HULL_NOSE)
  ctx.closePath()
}

export interface SubmarineOptions {
  /** 1 draws a ~28x57 px hull. */
  scale?: number
  /** Forward lamp cone; the strongest cue for which way the sub is pointing. */
  headlamp?: boolean
  /** Drop shadow on the sea floor. */
  shadow?: boolean
  /** Front-corner bumper pads, matching the contact points the runtime probes. */
  bumpers?: boolean
}

/**
 * Paints the robot submarine centred on the current origin and pointing at -Y.
 * Callers translate and rotate first; this only draws.
 */
export function drawSubmarine(ctx: CanvasRenderingContext2D, options: SubmarineOptions = {}): void {
  const { scale = 1, headlamp = true, shadow = true, bumpers = true } = options

  ctx.save()
  ctx.scale(scale, scale)
  ctx.lineJoin = "round"
  ctx.lineCap = "round"

  if (shadow) {
    ctx.save()
    ctx.translate(2.5, 3.5)
    ctx.fillStyle = "rgba(18, 46, 74, 0.20)"
    hullPath(ctx)
    ctx.fill()
    ctx.restore()
  }

  if (headlamp) {
    const beam = ctx.createLinearGradient(0, -HULL_NOSE, 0, -HULL_NOSE - 30)
    beam.addColorStop(0, "rgba(255, 246, 199, 0.55)")
    beam.addColorStop(1, "rgba(255, 246, 199, 0)")
    ctx.fillStyle = beam
    ctx.beginPath()
    ctx.moveTo(-3, -HULL_NOSE + 2)
    ctx.lineTo(-13, -HULL_NOSE - 30)
    ctx.lineTo(13, -HULL_NOSE - 30)
    ctx.lineTo(3, -HULL_NOSE + 2)
    ctx.closePath()
    ctx.fill()
  }

  // --- Stern hardware, drawn first so the hull overlaps its roots. ---

  ctx.fillStyle = "#6C7789"
  ctx.beginPath()
  ctx.roundRect(-2, HULL_TAIL - 3, 4, 9, 2)
  ctx.fill()

  ctx.save()
  ctx.translate(0, HULL_TAIL + 7)
  ctx.fillStyle = "#59636F"
  for (let i = 0; i < 4; i++) {
    ctx.save()
    ctx.rotate((i * Math.PI) / 2 + Math.PI / 4)
    ctx.beginPath()
    ctx.ellipse(0, 4.6, 2.2, 4.6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.fillStyle = "#94A0AE"
  ctx.beginPath()
  ctx.arc(0, 0, 2.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = "#D98E12"
  ctx.strokeStyle = "#7A4F05"
  ctx.lineWidth = 1.3

  // Stern stabilisers, kept short so the silhouette stays sub-like.
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * 5, 16)
    ctx.lineTo(side * 17, 22)
    ctx.lineTo(side * 17, 25.5)
    ctx.lineTo(side * 5, 21.5)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  // Small bow planes.
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * 11, -12)
    ctx.lineTo(side * 19, -6.5)
    ctx.lineTo(side * 18.5, -3.5)
    ctx.lineTo(side * 11.5, -6)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  // --- Hull ---

  const hull = ctx.createLinearGradient(-HULL_HALF_W, 0, HULL_HALF_W, 0)
  hull.addColorStop(0, "#A96E09")
  hull.addColorStop(0.3, "#F7C82F")
  hull.addColorStop(0.5, "#FFEBA4")
  hull.addColorStop(0.72, "#F5C21F")
  hull.addColorStop(1, "#9E680A")
  ctx.fillStyle = hull
  ctx.strokeStyle = "#7A4F05"
  ctx.lineWidth = 2
  hullPath(ctx)
  ctx.fill()
  ctx.stroke()

  // Lengthwise panel seams stretch the form and read as hull plating.
  ctx.strokeStyle = "rgba(122, 79, 5, 0.35)"
  ctx.lineWidth = 1
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * 8.5, -14)
    ctx.quadraticCurveTo(side * 10, 2, side * 6, 19)
    ctx.stroke()
  }

  // Darker collar marking the bow section.
  ctx.strokeStyle = "rgba(122, 79, 5, 0.5)"
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(-9.6, -16.5)
  ctx.quadraticCurveTo(0, -19.5, 9.6, -16.5)
  ctx.stroke()

  // --- Conning tower ---

  // Cast shadow first, so the tower reads as sitting on top of the hull rather
  // than as a hole cut into it.
  ctx.fillStyle = "rgba(96, 62, 6, 0.4)"
  ctx.beginPath()
  ctx.roundRect(-5, -7.4, 11.6, 15, 4)
  ctx.fill()

  const sail = ctx.createLinearGradient(-6, 0, 6, 0)
  sail.addColorStop(0, "#C98A12")
  sail.addColorStop(0.32, "#F8CE49")
  sail.addColorStop(0.62, "#E3A81C")
  sail.addColorStop(1, "#A5700B")
  ctx.fillStyle = sail
  ctx.strokeStyle = "#6B4404"
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(-5.8, -9, 11.6, 15, 4)
  ctx.fill()
  ctx.stroke()

  ctx.strokeStyle = "rgba(255, 244, 205, 0.75)"
  ctx.lineWidth = 1.1
  ctx.beginPath()
  ctx.moveTo(-3.4, -7.6)
  ctx.quadraticCurveTo(-4.6, -6.6, -4.6, -3.4)
  ctx.stroke()

  // Red fin, raked forward off the tower.
  ctx.fillStyle = "#E7402F"
  ctx.strokeStyle = "#A82A1E"
  ctx.lineWidth = 1.1
  ctx.beginPath()
  ctx.moveTo(0, -14.5)
  ctx.lineTo(-4.2, -8)
  ctx.lineTo(4.2, -8)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // --- Bow viewport: the clearest read on which end is the front. ---

  ctx.fillStyle = "#C9A227"
  ctx.beginPath()
  ctx.arc(0, -23, 6.4, 0, Math.PI * 2)
  ctx.fill()

  const glass = ctx.createRadialGradient(-1.7, -25, 0.7, 0, -23, 5.4)
  glass.addColorStop(0, "#EFFAFF")
  glass.addColorStop(0.4, "#7CC5EA")
  glass.addColorStop(1, "#276F99")
  ctx.fillStyle = glass
  ctx.strokeStyle = "#7A4F05"
  ctx.lineWidth = 1.3
  ctx.beginPath()
  ctx.arc(0, -23, 5.1, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = "rgba(255, 255, 255, 0.8)"
  ctx.beginPath()
  ctx.ellipse(-1.7, -24.8, 1.9, 1.1, -0.6, 0, Math.PI * 2)
  ctx.fill()

  if (bumpers) {
    // Muted and offset back from the viewport, so the pair reads as fenders
    // rather than as a pair of eyes.
    for (const side of [-1, 1]) {
      ctx.save()
      ctx.translate(side * 9.2, -14.5)
      ctx.rotate(side * 0.62)
      ctx.fillStyle = "#6A5330"
      ctx.beginPath()
      ctx.roundRect(-2.4, -1.1, 4.8, 2.2, 1.1)
      ctx.fill()
      ctx.restore()
    }
  }

  // Chevron aft of the tower, pointing the way the sub travels.
  ctx.strokeStyle = "rgba(122, 79, 5, 0.55)"
  ctx.lineWidth = 2.1
  ctx.beginPath()
  ctx.moveTo(-5.5, 15)
  ctx.lineTo(0, 10)
  ctx.lineTo(5.5, 15)
  ctx.stroke()

  ctx.restore()
}
