"use client"

import type React from "react"
import { useEffect, useState } from "react"
import {
  Cog,
  Eye,
  Gauge,
  GripVertical,
  Magnet,
  Maximize,
  Minimize,
  Minimize2,
  RefreshCw,
  Settings,
  Target,
  Wrench,
  X,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export interface RobotDeviceCapabilities {
  eyeSensor: boolean
  bumperSensor: boolean
  arm: boolean
  gyro: boolean
  gps: boolean
  inertial: boolean
  rangeFinder: boolean
  lineTracker: boolean
}

export const DEFAULT_ROBOT_CAPABILITIES: RobotDeviceCapabilities = {
  eyeSensor: true,
  bumperSensor: true,
  arm: false,
  gyro: false,
  gps: false,
  inertial: false,
  rangeFinder: false,
  lineTracker: false,
}

interface RobotConfigChrome {
  x: number
  y: number
  isDragging: boolean
  dragStartX: number
  dragStartY: number
  isMinimized: boolean
  isMaximized: boolean
}

export function RobotConfigWindow({
  open,
  capabilities,
  onCapabilitiesChange,
  onClose,
}: {
  open: boolean
  capabilities: RobotDeviceCapabilities
  onCapabilitiesChange: React.Dispatch<React.SetStateAction<RobotDeviceCapabilities>>
  onClose: () => void
}) {
  const [chrome, setChrome] = useState<RobotConfigChrome>({
    x: 400,
    y: 150,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    isMinimized: false,
    isMaximized: false,
  })

  useEffect(() => {
    setChrome((prev) => ({ ...prev, x: Math.max(16, window.innerWidth / 2 - 200) }))
  }, [])

  useEffect(() => {
    if (open) setChrome((prev) => ({ ...prev, isMinimized: false }))
  }, [open])

  const handleMinimize = () => {
    setChrome((prev) => ({ ...prev, isMinimized: !prev.isMinimized }))
  }

  const handleMaximize = () => {
    setChrome((prev) => ({ ...prev, isMaximized: !prev.isMaximized }))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return
    if (!(e.target as HTMLElement).closest(".robot-config-header")) return

    setChrome((prev) => ({
      ...prev,
      isDragging: true,
      dragStartX: e.clientX - prev.x,
      dragStartY: e.clientY - prev.y,
    }))
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (chrome.isDragging) {
        setChrome((prev) => ({
          ...prev,
          x: e.clientX - prev.dragStartX,
          y: e.clientY - prev.dragStartY,
        }))
      }
    }

    const handleMouseUp = () => {
      setChrome((prev) => ({ ...prev, isDragging: false }))
    }

    if (chrome.isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [chrome.isDragging])

  if (!open) return null

  return (
    <div
      id="vex-robot-config-window"
      className="fixed bg-white z-50"
      style={{
        left: `${chrome.x}px`,
        top: `${chrome.y}px`,
        width: chrome.isMaximized ? "560px" : "460px",
        height: chrome.isMaximized ? "500px" : "auto",
      }}
      onMouseDown={handleMouseDown}
    >
      <div
        id="vex-robot-config-header"
        className="robot-config-header text-white p-3 flex items-center justify-between cursor-move"
      >
        <div className="flex items-center gap-2">
          <GripVertical className="h-5 w-5" />
          <span id="vex-robot-config-title" className="font-bold text-lg">
            Devices
          </span>
        </div>
        <div id="vex-robot-config-window-controls" className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 hover:bg-white/20 text-white"
            onClick={handleMinimize}
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 hover:bg-white/20 text-white"
            onClick={handleMaximize}
          >
            {chrome.isMaximized ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 hover:bg-white/20 text-white"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!chrome.isMinimized && (
        <div id="vex-robot-config-body" className="p-5">
          {/* Grid of device cards matching VEX VR style */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {/* Controller - always enabled */}
            <div className="flex flex-col items-center justify-center p-3 border-2 border-blue-500 bg-blue-50 rounded-lg cursor-default relative">
              <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </div>
              <Cog className="h-10 w-10 text-gray-700 mb-1" />
              <span className="text-xs font-medium text-center">CONTROLLER</span>
            </div>

            {/* Drivetrain - always enabled */}
            <div className="flex flex-col items-center justify-center p-3 border-2 border-blue-500 bg-blue-50 rounded-lg cursor-default relative">
              <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </div>
              <Settings className="h-10 w-10 text-gray-700 mb-1" />
              <span className="text-xs font-medium text-center">DRIVETRAIN</span>
            </div>

            {/* Eye/Vision Sensor */}
            <div
              className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg cursor-pointer relative transition-all ${
                capabilities.eyeSensor
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 bg-white hover:bg-gray-50"
              }`}
              onClick={() => onCapabilitiesChange((prev) => ({ ...prev, eyeSensor: !prev.eyeSensor }))}
            >
              {capabilities.eyeSensor && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
              <Eye className="h-10 w-10 text-gray-700 mb-1" />
              <span className="text-xs font-medium text-center">VISION</span>
            </div>

            {/* Bumper Sensor */}
            <div
              className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg cursor-pointer relative transition-all ${
                capabilities.bumperSensor
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 bg-white hover:bg-gray-50"
              }`}
              onClick={() => onCapabilitiesChange((prev) => ({ ...prev, bumperSensor: !prev.bumperSensor }))}
            >
              {capabilities.bumperSensor && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
              <Target className="h-10 w-10 text-gray-700 mb-1" />
              <span className="text-xs font-medium text-center">BUMPER</span>
            </div>

            {/* Inertial Sensor */}
            <div
              className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg cursor-pointer relative transition-all ${
                capabilities.inertial
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 bg-white hover:bg-gray-50"
              }`}
              onClick={() => onCapabilitiesChange((prev) => ({ ...prev, inertial: !prev.inertial }))}
            >
              {capabilities.inertial && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
              <Gauge className="h-10 w-10 text-gray-700 mb-1" />
              <span className="text-xs font-medium text-center">INERTIAL</span>
            </div>

            {/* Gyro Sensor */}
            <div
              className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg cursor-pointer relative transition-all ${
                capabilities.gyro ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white hover:bg-gray-50"
              }`}
              onClick={() => onCapabilitiesChange((prev) => ({ ...prev, gyro: !prev.gyro }))}
            >
              {capabilities.gyro && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
              <RefreshCw className="h-10 w-10 text-gray-700 mb-1" />
              <span className="text-xs font-medium text-center">GYRO</span>
            </div>

            {/* GPS Sensor */}
            <div
              className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg cursor-pointer relative transition-all ${
                capabilities.gps ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white hover:bg-gray-50"
              }`}
              onClick={() => onCapabilitiesChange((prev) => ({ ...prev, gps: !prev.gps }))}
            >
              {capabilities.gps && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
              <Zap className="h-10 w-10 text-gray-700 mb-1" />
              <span className="text-xs font-medium text-center">GPS</span>
            </div>

            {/* Electromagnet */}
            <div
              className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg cursor-pointer relative transition-all ${
                capabilities.rangeFinder
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 bg-white hover:bg-gray-50"
              }`}
              onClick={() => onCapabilitiesChange((prev) => ({ ...prev, rangeFinder: !prev.rangeFinder }))}
            >
              {capabilities.rangeFinder && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
              <Magnet className="h-10 w-10 text-gray-700 mb-1" />
              <span className="text-xs font-medium text-center">
                ELECTRO-
                <br />
                MAGNET
              </span>
            </div>

            {/* Arm */}
            <div
              className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg cursor-pointer relative transition-all ${
                capabilities.arm ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white hover:bg-gray-50"
              }`}
              onClick={() => onCapabilitiesChange((prev) => ({ ...prev, arm: !prev.arm }))}
            >
              {capabilities.arm && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
              <Wrench className="h-10 w-10 text-gray-700 mb-1" />
              <span className="text-xs font-medium text-center">ARM</span>
            </div>

            {/* 2-Wire Motor */}
            <div
              className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg cursor-pointer relative transition-all ${
                capabilities.lineTracker
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 bg-white hover:bg-gray-50"
              }`}
              onClick={() => onCapabilitiesChange((prev) => ({ ...prev, lineTracker: !prev.lineTracker }))}
            >
              {capabilities.lineTracker && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
              <Zap className="h-10 w-10 text-gray-700 mb-1" />
              <span className="text-xs font-medium text-center">
                2-WIRE
                <br />
                MOTOR
              </span>
            </div>
          </div>

          {/* Bottom buttons matching VEX VR style */}
          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button
              size="sm"
              variant="outline"
              className="px-6 bg-transparent"
              onClick={() => {
                onCapabilitiesChange(DEFAULT_ROBOT_CAPABILITIES)
                onClose()
              }}
            >
              CANCEL
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 px-6" onClick={onClose}>
              DONE
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
