"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { type Camera, type Vec2, type Viewport } from "@/engine"
import {
  CAMERA,
  FIELD_BOUNDS,
  FIT_USER_ZOOM,
  FOLLOW_ROVER,
  MAX_USER_ZOOM,
  MIN_USER_ZOOM,
} from "@/playgrounds/rover-rescue/config"
import {
  cameraFromUserScale,
  clampRoverCamera,
  fitFieldCamera,
  panRoverCamera,
  zoomRoverAt,
  zoomToUserScale,
} from "@/playgrounds/rover-rescue/camera"
import type { HostRobotPose } from "./program-types"

const ZOOM_STEP = 1.25
/** A drag shorter than this stays a click, so a tap does not cancel follow mode. */
const PAN_SLOP_PX = 3

/** Capture keeps the drag alive off-canvas; a stale pointer id must not throw. */
function capturePointer(canvas: HTMLCanvasElement, pointerId: number): void {
  try {
    canvas.setPointerCapture(pointerId)
  } catch {
    // Pointer already released.
  }
}

function sameCamera(a: Camera, b: Camera): boolean {
  return a.zoom === b.zoom && a.centerMm.x === b.centerMm.x && a.centerMm.y === b.centerMm.y
}

interface PanGesture {
  x: number
  y: number
  cam: Camera
  active: boolean
}

export function useRoverCamera({
  canvasRef,
  enabled,
  viewport,
  robot,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  enabled: boolean
  viewport: Viewport
  robot: HostRobotPose
}) {
  const [userScale, setUserScale] = useState(FIT_USER_ZOOM)
  const [follow, setFollow] = useState<boolean>(FOLLOW_ROVER && CAMERA.follow)
  const [camera, setCamera] = useState<Camera>(() =>
    cameraFromUserScale(FIT_USER_ZOOM, { x: 0, y: 0 }, viewport),
  )
  const panningRef = useRef<PanGesture | null>(null)
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null)
  const cameraRef = useRef(camera)
  cameraRef.current = camera
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport
  const followRef = useRef(follow)
  followRef.current = follow
  const robotRef = useRef(robot)
  robotRef.current = robot
  const wasEnabledRef = useRef(false)

  const applyCamera = useCallback((next: Camera) => {
    const view = viewportRef.current
    const clamped = clampRoverCamera(next, view)
    cameraRef.current = clamped
    // Same pose means no state change; re-setting it would spin the follow effect.
    setCamera((prev) => (sameCamera(prev, clamped) ? prev : clamped))
    setUserScale(zoomToUserScale(clamped.zoom, view))
  }, [])

  const fitField = useCallback(() => {
    setFollow(false)
    applyCamera(fitFieldCamera(viewportRef.current))
  }, [applyCamera])

  const zoomBy = useCallback((factor: number, screenPoint?: Vec2) => {
    const view = viewportRef.current
    const origin = screenPoint ?? { x: view.widthPx / 2, y: view.heightPx / 2 }
    const zoomed = zoomRoverAt(cameraRef.current, origin, factor, view)
    const pose = robotRef.current
    applyCamera(
      followRef.current ? { centerMm: { x: pose.x, y: pose.y }, zoom: zoomed.zoom } : zoomed,
    )
  }, [applyCamera])

  useEffect(() => {
    if (!enabled) {
      wasEnabledRef.current = false
      viewportRef.current = viewport
      return
    }
    const previousViewport = viewportRef.current
    const scale = !wasEnabledRef.current
      ? FIT_USER_ZOOM
      : zoomToUserScale(cameraRef.current.zoom, previousViewport) || FIT_USER_ZOOM
    wasEnabledRef.current = true
    viewportRef.current = viewport
    const next = cameraFromUserScale(scale, cameraRef.current.centerMm, viewport)
    applyCamera(follow ? { ...next, centerMm: { x: robot.x, y: robot.y } } : next)
  }, [enabled, viewport.widthPx, viewport.heightPx])

  useEffect(() => {
    if (!enabled || !follow || panningRef.current?.active) return
    applyCamera({
      centerMm: { x: robot.x, y: robot.y },
      zoom: cameraRef.current.zoom,
    })
  }, [enabled, follow, robot.x, robot.y, applyCamera])

  useEffect(() => {
    if (!enabled) return
    const canvas = canvasRef.current
    if (!canvas) return

    const pointOnCanvas = (clientX: number, clientY: number): Vec2 => {
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / Math.max(1, rect.width)
      const scaleY = canvas.height / Math.max(1, rect.height)
      return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const view = viewportRef.current
      const point = pointOnCanvas(event.clientX, event.clientY)
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      const zoomed = zoomRoverAt(cameraRef.current, point, factor, view)
      const pose = robotRef.current
      applyCamera(
        followRef.current ? { centerMm: { x: pose.x, y: pose.y }, zoom: zoomed.zoom } : zoomed,
      )
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.button !== 1) return
      // Middle-drag would otherwise start the browser autoscroll cursor.
      if (event.button === 1) event.preventDefault()
      const start = pointOnCanvas(event.clientX, event.clientY)
      panningRef.current = { x: start.x, y: start.y, cam: cameraRef.current, active: false }
      capturePointer(canvas, event.pointerId)
    }

    const onPointerMove = (event: PointerEvent) => {
      const view = viewportRef.current
      const point = pointOnCanvas(event.clientX, event.clientY)
      const pan = panningRef.current
      if (!pan) return
      const dx = point.x - pan.x
      const dy = point.y - pan.y
      if (!pan.active) {
        if (Math.hypot(dx, dy) < PAN_SLOP_PX) return
        // Re-anchor so the field does not jump by the slop distance.
        panningRef.current = { x: point.x, y: point.y, cam: cameraRef.current, active: true }
        setFollow(false)
        canvas.style.cursor = "grabbing"
        return
      }
      applyCamera(panRoverCamera(pan.cam, { x: dx, y: dy }, view))
    }

    const endPan = (event: PointerEvent) => {
      if (panningRef.current) {
        panningRef.current = null
        canvas.style.cursor = "grab"
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      }
    }

    const touchDistance = (touches: TouchList) => {
      if (touches.length < 2) return 0
      return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)
    }

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        // A second finger turns the one-finger pan into a pinch zoom.
        panningRef.current = null
        pinchRef.current = { distance: touchDistance(event.touches), zoom: cameraRef.current.zoom }
      }
    }

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !pinchRef.current) return
      event.preventDefault()
      const distance = touchDistance(event.touches)
      if (pinchRef.current.distance <= 0) return
      const rect = canvas.getBoundingClientRect()
      const mid = {
        x: ((event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left) * (canvas.width / Math.max(1, rect.width)),
        y: ((event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top) * (canvas.height / Math.max(1, rect.height)),
      }
      const factor = distance / pinchRef.current.distance
      applyCamera(zoomRoverAt({ ...cameraRef.current, zoom: pinchRef.current.zoom }, mid, factor, viewportRef.current))
    }

    const onTouchEnd = () => {
      pinchRef.current = null
    }

    const priorStyle = {
      cursor: canvas.style.cursor,
      touchAction: canvas.style.touchAction,
      userSelect: canvas.style.userSelect,
    }
    canvas.style.cursor = "grab"
    // Let one finger drag the field instead of scrolling the page.
    canvas.style.touchAction = "none"
    canvas.style.userSelect = "none"

    canvas.addEventListener("wheel", onWheel, { passive: false })
    canvas.addEventListener("pointerdown", onPointerDown)
    canvas.addEventListener("pointermove", onPointerMove)
    canvas.addEventListener("pointerup", endPan)
    canvas.addEventListener("pointercancel", endPan)
    canvas.addEventListener("touchstart", onTouchStart, { passive: true })
    canvas.addEventListener("touchmove", onTouchMove, { passive: false })
    canvas.addEventListener("touchend", onTouchEnd)
    return () => {
      panningRef.current = null
      canvas.style.cursor = priorStyle.cursor
      canvas.style.touchAction = priorStyle.touchAction
      canvas.style.userSelect = priorStyle.userSelect
      canvas.removeEventListener("wheel", onWheel)
      canvas.removeEventListener("pointerdown", onPointerDown)
      canvas.removeEventListener("pointermove", onPointerMove)
      canvas.removeEventListener("pointerup", endPan)
      canvas.removeEventListener("pointercancel", endPan)
      canvas.removeEventListener("touchstart", onTouchStart)
      canvas.removeEventListener("touchmove", onTouchMove)
      canvas.removeEventListener("touchend", onTouchEnd)
    }
  }, [enabled, canvasRef, applyCamera])

  return {
    camera,
    userScale,
    follow,
    fieldBounds: FIELD_BOUNDS,
    minZoom: MIN_USER_ZOOM,
    maxZoom: MAX_USER_ZOOM,
    setFollow,
    fitField,
    zoomIn: () => zoomBy(ZOOM_STEP),
    zoomOut: () => zoomBy(1 / ZOOM_STEP),
    applyCamera,
  }
}
