/**
 * Verifies that a bumper reads "pressed" before the hull's coral collision ends
 * the mission. Mirrors scripts/check-bumper-geometry.mjs so `npm test` still
 * covers what that script covered.
 */
import { describe, expect, it } from "vitest"
import {
  BUMPER_CONTACT_MARGIN_PX,
  BUMPER_FORWARD_PX,
  BUMPER_LATERAL_PX,
  getPlaygroundCanvasSize,
  pointHitsCoral,
  seededRandom,
  type CoralPiece,
} from "@/lib/robot-runtime"

const HULL_COLLISION_RADIUS = 22

function buildCoral(maximized: boolean) {
  const { w: width, h: height } = getPlaygroundCanvasSize(maximized)
  const pieces: CoralPiece[] = []
  const push = (x: number, y: number, seed: number) =>
    pieces.push({ x, y, radius: 12 + seededRandom(seed) * 8, color: "#000" })
  for (let x = 0; x < width; x += 30) {
    push(x + 15, 15, x)
    push(x + 15, height - 15, x + 1000)
  }
  for (let y = 30; y < height - 30; y += 30) {
    push(15, y + 15, y + 2000)
    push(width - 15, y + 15, y + 3000)
  }
  return { pieces, width, height }
}

function bumperPressed(
  x: number,
  y: number,
  rotationDeg: number,
  side: "left" | "right",
  coral: CoralPiece[],
) {
  const rad = (rotationDeg * Math.PI) / 180
  const s = side === "left" ? -1 : 1
  const px = x + Math.sin(rad) * BUMPER_FORWARD_PX + Math.cos(rad) * BUMPER_LATERAL_PX * s
  const py = y - Math.cos(rad) * BUMPER_FORWARD_PX + Math.sin(rad) * BUMPER_LATERAL_PX * s
  return pointHitsCoral(px, py, coral, BUMPER_CONTACT_MARGIN_PX)
}

function hullHitsCoral(x: number, y: number, coral: CoralPiece[]) {
  return coral.some((p) => Math.hypot(x - p.x, y - p.y) < HULL_COLLISION_RADIUS + p.radius)
}

/** Walk the robot 0.25px at a time along `rotationDeg` and report both events. */
function sweep(
  startX: number,
  startY: number,
  rotationDeg: number,
  coral: CoralPiece[],
  width: number,
  height: number,
) {
  const rad = (rotationDeg * Math.PI) / 180
  let firstBumper: number | null = null
  for (let t = 0; t < 2000; t += 0.25) {
    const x = startX + Math.sin(rad) * t
    const y = startY - Math.cos(rad) * t
    if (x < 35 || x > width - 35 || y < 35 || y > height - 35) break
    const bumped =
      bumperPressed(x, y, rotationDeg, "left", coral) ||
      bumperPressed(x, y, rotationDeg, "right", coral)
    if (bumped && firstBumper === null) firstBumper = t
    if (hullHitsCoral(x, y, coral)) {
      return { bumperAt: firstBumper, collisionAt: t }
    }
  }
  return { bumperAt: firstBumper, collisionAt: null }
}

const HEADINGS: Array<[string, number]> = [
  ["north", 0],
  ["east", 90],
  ["south", 180],
  ["west", 270],
  ["northwest", 315],
  ["northeast", 45],
]

describe.each([false, true])("bumper geometry (maximized=%s)", (maximized) => {
  const { pieces, width, height } = buildCoral(maximized)
  const cx = Math.round(width / 2)
  const cy = Math.round(height / 2)

  it.each(HEADINGS)("%s: bumper reads pressed before hull collision", (_name, deg) => {
    const { bumperAt, collisionAt } = sweep(cx, cy, deg, pieces, width, height)
    const lead = bumperAt != null && collisionAt != null ? collisionAt - bumperAt : null
    expect(bumperAt).not.toBeNull()
    expect(lead === null || lead > 2).toBe(true)
  })

  it("does not read as bumped while sitting at field centre", () => {
    const idle =
      bumperPressed(cx, cy, 0, "left", pieces) || bumperPressed(cx, cy, 0, "right", pieces)
    expect(idle).toBe(false)
  })
})
