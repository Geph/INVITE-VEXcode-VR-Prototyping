"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { screenToWorld, type Camera, type Vec2, type Viewport } from "@/engine"
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
  clampUserScale,
  fitFieldCamera,
  zoomRoverAt,
  zoomToUserScale,
} from "@/playgrounds/rover-rescue/camera"
import type { HostRobotPose } from "./program-types"

const ZOOM_STEP = 1.25

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
  const [cursorWorld, setCursorWorld] = useState<Vec2 | null>(null)
  const [camera, setCamera] = useState<Camera>(() =>
    cameraFromUserScale(FIT_USER_ZOOM, { x: 0, y: 0 }, viewport),
  )
  const spaceHeldRef = useRef(false)
  const panningRef = useRef<{ x: number; y: number; cam: Camera } | null>(null)
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null)
  const cameraRef = useRef(camera)
  cameraRef.current = camera
  const viewportRef = useRef(viewport)
  const wasEnabledRef = useRef(false)

  const applyCamera = useCallback((next: Camera) => {
    const clamped = clampRoverCamera(next, viewport)
    cameraRef.current = clamped
    setCamera(clamped)
    setUserScale(zoomToUserScale(clamped.zoom, viewport))
  }, [viewport])

  const fitField = useCallback(() => {
    setFollow(false)
    applyCamera(fitFieldCamera(viewport))
  }, [applyCamera, viewport])

  const zoomBy = useCallback((factor: number, screenPoint?: Vec2) => {
    const origin = screenPoint ?? { x: viewport.widthPx / 2, y: viewport.heightPx / 2 }
    applyCamera(zoomRoverAt(cameraRef.current, origin, factor, viewport))
  }, [applyCamera, viewport])

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
    if (!enabled || !follow) return
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
      const point = pointOnCanvas(event.clientX, event.clientY)
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      applyCamera(zoomRoverAt(cameraRef.current, point, factor, viewport))
    }

    const onPointerDown = (event: PointerEvent) => {
      const pan = event.button === 1 || (event.button === 0 && spaceHeldRef.current)
      if (!pan) return
      event.preventDefault()
      setFollow(false)
      panningRef.current = { x: event.clientX, y: event.clientY, cam: cameraRef.current }
      canvas.setPointerCapture(event.pointerId)
    }

    const onPointerMove = (event: PointerEvent) => {
      const point = pointOnCanvas(event.clientX, event.clientY)
      setCursorWorld(screenToWorld(point, cameraRef.current, viewport))
      const pan = panningRef.current
      if (!pan) return
      const zoom = Math.max(cameraRef.current.zoom, 1e-9)
      applyCamera({
        centerMm: {
          x: pan.cam.centerMm.x - (event.clientX - pan.x) / zoom,
          y: pan.cam.centerMm.y + (event.clientY - pan.y) / zoom,
        },
        zoom: pan.cam.zoom,
      })
    }

    const endPan = (event: PointerEvent) => {
      if (panningRef.current) {
        panningRef.current = null
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      }
    }

    const onPointerLeave = () => {
      if (!panningRef.current) setCursorWorld(null)
    }

    const touchDistance = (touches: TouchList) => {
      if (touches.length < 2) return 0
      return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)
    }

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
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
      applyCamera(zoomRoverAt({ ...cameraRef.current, zoom: pinchRef.current.zoom }, mid, factor, viewport))
    }

    const onTouchEnd = () => {
      pinchRef.current = null
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") spaceHeldRef.current = true
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") spaceHeldRef.current = false
    }

    canvas.addEventListener("wheel", onWheel, { passive: false })
    canvas.addEventListener("pointerdown", onPointerDown)
    canvas.addEventListener("pointermove", onPointerMove)
    canvas.addEventListener("pointerup", endPan)
    canvas.addEventListener("pointercancel", endPan)
    canvas.addEventListener("pointerleave", onPointerLeave)
    canvas.addEventListener("touchstart", onTouchStart, { passive: true })
    canvas.addEventListener("touchmove", onTouchMove, { passive: false })
    canvas.addEventListener("touchend", onTouchEnd)
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      canvas.removeEventListener("wheel", onWheel)
      canvas.removeEventListener("pointerdown", onPointerDown)
      canvas.removeEventListener("pointermove", onPointerMove)
      canvas.removeEventListener("pointerup", endPan)
      canvas.removeEventListener("pointercancel", endPan)
      canvas.removeEventListener("pointerleave", onPointerLeave)
      canvas.removeEventListener("touchstart", onTouchStart)
      canvas.removeEventListener("touchmove", onTouchMove)
      canvas.removeEventListener("touchend", onTouchEnd)
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [enabled, canvasRef, viewport, applyCamera])

  return {
    camera,
    userScale,
    follow,
    cursorWorld,
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
