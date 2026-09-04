"use client"

import type { RefObject } from "react"

export function PlaygroundCanvas({
  canvasRef,
  width,
  height,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>
  width: number
  height: number
}) {
  return (
    <div id="vex-playground-canvas-row" className="flex">
      <canvas id="vex-playground-canvas" ref={canvasRef} width={width} height={height} />
    </div>
  )
}
