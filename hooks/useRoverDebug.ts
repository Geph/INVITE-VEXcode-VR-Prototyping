"use client"

import type React from "react"
import { useEffect, useRef } from "react"
import { screenToWorld, type Camera, type Viewport } from "@/engine"
import { hitDebugHandle } from "@/playgrounds/rover-rescue/art/debug"
import { formatMapSpecAsTypeScript } from "@/playgrounds/rover-rescue/map-spec"
import { riverHazardFromState, type RoverRescueState } from "@/playgrounds/rover-rescue/state"

export function useRoverDebug({
  enabled,
  canvasRef,
  camera,
  viewport,
  roverStateRef,
  commitState,
}: {
  enabled: boolean
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  camera: Camera
  viewport: Viewport
  roverStateRef: React.MutableRefObject<RoverRescueState>
  commitState: (next: RoverRescueState) => void
}) {
  const cameraRef = useRef(camera)
  cameraRef.current = camera
  const dragRef = useRef<ReturnType<typeof hitDebugHandle>>(null)

  useEffect(() => {
    if (!enabled) return
    const canvas = canvasRef.current
    if (!canvas) return

    const pointOnCanvas = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: (clientX - rect.left) * (canvas.width / Math.max(1, rect.width)),
        y: (clientY - rect.top) * (canvas.height / Math.max(1, rect.height)),
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const state = roverStateRef.current
      const hit = hitDebugHandle(
        pointOnCanvas(event.clientX, event.clientY),
        cameraRef.current,
        viewport,
        state.zones,
        state.riverCenterline,
        state.bridges,
      )
      if (!hit) return
      event.preventDefault()
      event.stopPropagation()
      dragRef.current = hit
      canvas.setPointerCapture(event.pointerId)
    }

    const onPointerMove = (event: PointerEvent) => {
      const hit = dragRef.current
      if (!hit) return
      const world = screenToWorld(pointOnCanvas(event.clientX, event.clientY), cameraRef.current, viewport)
      const prev = roverStateRef.current
      if (hit.kind === "zone") {
        const zones = prev.zones.map((zone, index) => {
          if (index !== hit.index) return zone
          const polygonMm = zone.polygonMm.map((vertex, vertexIndex) =>
            vertexIndex === hit.vertex ? { x: world.x, y: world.y } : vertex,
          )
          return { ...zone, polygonMm }
        })
        commitState({ ...prev, zones })
        return
      }
      if (hit.kind === "river") {
        const riverCenterline = prev.riverCenterline.map((vertex, vertexIndex) =>
          vertexIndex === hit.vertex ? { x: world.x, y: world.y } : vertex,
        )
        commitState({ ...prev, riverCenterline })
        return
      }
      const bridges = prev.bridges.map((bridge, index) =>
        index === hit.index ? { ...bridge, centreMm: { x: world.x, y: world.y } } : bridge,
      )
      commitState({ ...prev, bridges })
    }

    const onPointerUp = (event: PointerEvent) => {
      if (!dragRef.current) return
      dragRef.current = null
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "d" && event.key !== "D") return
      const target = event.target as HTMLElement | null
      if (target?.closest("input, textarea, [contenteditable='true'], .blocklyWidgetDiv, #vex-workspace, .blocklyToolboxDiv")) {
        return
      }
      const state = roverStateRef.current
      console.log(
        formatMapSpecAsTypeScript({
          zones: state.zones,
          riverCenterline: state.riverCenterline,
          bridges: state.bridges,
        }),
      )
      void riverHazardFromState(state)
    }

    canvas.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [enabled, canvasRef, viewport, roverStateRef, commitState])
}
