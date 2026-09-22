/**
 * Verifies that a bumper reads "pressed" before the hull's coral collision ends
 * the mission. Mirrors the playground geometry from lib/robot-runtime.ts and
 * components/vex-workspace.tsx.
 */
import {
  BUMPER_CONTACT_MARGIN_PX,
  BUMPER_FORWARD_PX,
  BUMPER_LATERAL_PX,
  getPlaygroundCanvasSize,
  pointHitsCoral,
  seededRandom,
} from "../lib/robot-runtime.ts"

const HULL_COLLISION_RADIUS = 22

function buildCoral(maximized) {
  const { w: width, h: height } = getPlaygroundCanvasSize(maximized)
  const pieces = []
  const push = (x, y, seed) =>
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

function bumperPressed(x, y, rotationDeg, side, coral) {
  const rad = (rotationDeg * Math.PI) / 180
  const s = side === "left" ? -1 : 1
  const px = x + Math.sin(rad) * BUMPER_FORWARD_PX + Math.cos(rad) * BUMPER_LATERAL_PX * s
  const py = y - Math.cos(rad) * BUMPER_FORWARD_PX + Math.sin(rad) * BUMPER_LATERAL_PX * s
  return pointHitsCoral(px, py, coral, BUMPER_CONTACT_MARGIN_PX)
}

function hullHitsCoral(x, y, coral) {
  return coral.some(
    (p) => Math.hypot(x - p.x, y - p.y) < HULL_COLLISION_RADIUS + p.radius,
  )
}

/** Walk the robot 0.25px at a time along `rotationDeg` and report both events. */
function sweep(startX, startY, rotationDeg, coral, width, height) {
  const rad = (rotationDeg * Math.PI) / 180
  let firstBumper = null
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

let failures = 0
for (const maximized of [false, true]) {
  const { pieces, width, height } = buildCoral(maximized)
  const cx = Math.round(width / 2)
  const cy = Math.round(height / 2)
  const headings = [
    ["north", 0],
    ["east", 90],
    ["south", 180],
    ["west", 270],
    ["northwest", 315],
    ["northeast", 45],
  ]
  for (const [name, deg] of headings) {
    const { bumperAt, collisionAt } = sweep(cx, cy, deg, pieces, width, height)
    const lead = bumperAt != null && collisionAt != null ? collisionAt - bumperAt : null
    const ok = bumperAt != null && (collisionAt == null || lead > 2)
    if (!ok) failures++
    const size = maximized ? "maximized" : "normal"
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${size.padEnd(10)} ${name.padEnd(10)} ` +
        `bumper@${bumperAt ?? "never"}px collision@${collisionAt ?? "never"}px ` +
        `lead=${lead == null ? "n/a" : lead.toFixed(2) + "px"}`,
    )
  }
}

// Robot must not read as bumped while sitting at its start position.
for (const maximized of [false, true]) {
  const { pieces, width, height } = buildCoral(maximized)
  const idle =
    bumperPressed(Math.round(width / 2), Math.round(height / 2), 0, "left", pieces) ||
    bumperPressed(Math.round(width / 2), Math.round(height / 2), 0, "right", pieces)
  if (idle) failures++
  console.log(`${idle ? "FAIL" : "PASS"}  no false press at field center (maximized=${maximized})`)
}

process.exit(failures === 0 ? 0 : 1)
