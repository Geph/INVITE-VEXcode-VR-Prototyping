import { describe, expect, it } from "vitest"
import { fitToBounds } from "@/engine"
import { FIELD_BOUNDS, START_POSE } from "@/playgrounds/rover-rescue/config"
import { renderRoverRescue } from "@/playgrounds/rover-rescue/render"
import { createRoverRescueState } from "@/playgrounds/rover-rescue/state"

const VIEWPORT = { widthPx: 400, heightPx: 400 }

/** beginPath / fill / stroke / fillRect / fillText stay cheap at 1x fit. */
const PATH_OP_CEILING = 120

function createCountingContext(width = VIEWPORT.widthPx, height = VIEWPORT.heightPx) {
  let ops = 0
  const count = () => {
    ops += 1
  }
  const ctx = {
    canvas: { width, height },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    scale() {},
    setTransform() {},
    beginPath: count,
    closePath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    bezierCurveTo() {},
    arc() {},
    rect() {},
    fill: count,
    stroke: count,
    fillRect: count,
    strokeRect: count,
    fillText: count,
    strokeText: count,
    clip() {},
    drawImage() {},
    shadowColor: "",
    shadowBlur: 0,
    globalCompositeOperation: "source-over",
    measureText() {
      return { width: 0 }
    },
    createLinearGradient() {
      return { addColorStop() {} }
    },
    createRadialGradient() {
      return { addColorStop() {} }
    },
  }
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    pathOps: () => ops,
  }
}

describe("rover-rescue render budget", () => {
  it("keeps full-field 1x path operations under the ceiling", () => {
    const { ctx, pathOps } = createCountingContext()
    const cam = fitToBounds(FIELD_BOUNDS, VIEWPORT)
    renderRoverRescue(
      ctx,
      createRoverRescueState(1),
      {
        xMm: START_POSE.xMm,
        yMm: START_POSE.yMm,
        headingDeg: START_POSE.headingDeg,
        driveVelocity: 50,
        turnVelocity: 50,
        driveTimeoutMs: null,
      },
      cam,
    )
    expect(pathOps()).toBeGreaterThan(8)
    expect(pathOps()).toBeLessThanOrEqual(PATH_OP_CEILING)
  })
})
