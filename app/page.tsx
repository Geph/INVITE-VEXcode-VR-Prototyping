"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Play,
  Circle,
  Square,
  GripVertical,
  X,
  Minimize,
  Maximize,
  Minimize2,
  Maximize2,
  MessageSquare,
} from "lucide-react"

declare global {
  interface Window {
    Blockly: any
  }
}

// Robot state interface
interface RobotState {
  x: number
  y: number
  rotation: number
  driveVelocity: number
  turnVelocity: number
  heading: number
}

// Draggable playground state
interface PlaygroundState {
  x: number
  y: number
  isDragging: boolean
  dragStartX: number
  dragStartY: number
  isVisible: boolean
  isMinimized: boolean
  isMaximized: boolean
}

// Draggable AI Assistant state
interface AIAssistantState {
  x: number
  y: number
  isDragging: boolean
  dragStartX: number
  dragStartY: number
  isVisible: boolean
  isMinimized: boolean
  isMaximized: boolean
}

interface CategoryState {
  selectedCategory: string | null
}

export default function BlocklyEditor() {
  const blocklyDivRef = useRef<HTMLDivElement>(null)
  const playgroundRef = useRef<HTMLDivElement>(null)
  const aiAssistantRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [workspace, setWorkspace] = useState<any>(null)
  const [blocklyLoaded, setBlocklyLoaded] = useState(false)
  const [robotState, setRobotState] = useState<RobotState>({
    x: 200,
    y: 200,
    rotation: 0,
    driveVelocity: 50,
    turnVelocity: 50,
    heading: 0,
  })

  const [playgroundState, setPlaygroundState] = useState<PlaygroundState>({
    x: window.innerWidth - 500,
    y: 100,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    isVisible: true,
    isMinimized: false,
    isMaximized: false,
  })

  const [aiAssistantState, setAIAssistantState] = useState<AIAssistantState>({
    x: window.innerWidth - 500,
    y: window.innerHeight - 500,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    isVisible: false,
    isMinimized: false,
    isMaximized: false,
  })

  const [categoryState, setCategoryState] = useState<CategoryState>({
    selectedCategory: null,
  })

  const handlePlaygroundMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".playground-header")) {
      setPlaygroundState((prev) => ({
        ...prev,
        isDragging: true,
        dragStartX: e.clientX - prev.x,
        dragStartY: e.clientY - prev.y,
      }))
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (playgroundState.isDragging) {
        setPlaygroundState((prev) => ({
          ...prev,
          x: e.clientX - prev.dragStartX,
          y: e.clientY - prev.dragStartY,
        }))
      }
    }

    const handleMouseUp = () => {
      setPlaygroundState((prev) => ({ ...prev, isDragging: false }))
    }

    if (playgroundState.isDragging) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [playgroundState.isDragging])

  useEffect(() => {
    if (typeof window !== "undefined" && !window.Blockly) {
      const script = document.createElement("script")
      script.src = "https://unpkg.com/blockly/blockly.min.js"
      script.onload = () => {
        const Blockly = window.Blockly

        defineDrivetrainBlocks(Blockly)

        setBlocklyLoaded(true)
      }
      document.body.appendChild(script)
    } else if (window.Blockly) {
      const Blockly = window.Blockly
      defineDrivetrainBlocks(Blockly)
      setBlocklyLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!blocklyLoaded || !blocklyDivRef.current || workspace) return

    const Blockly = window.Blockly

    const ws = Blockly.inject(blocklyDivRef.current, {
      toolbox: {
        kind: "flyoutToolbox",
        contents: [],
      },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 1.0,
        maxScale: 3,
        minScale: 0.3,
        scaleSpeed: 1.2,
      },
      trashcan: true,
    })

    setWorkspace(ws)
  }, [blocklyLoaded, workspace])

  useEffect(() => {
    if (!workspace || !window.Blockly) return

    const Blockly = window.Blockly
    let blocks: any[] = []

    switch (categoryState.selectedCategory) {
      case "drivetrain":
        blocks = [
          { kind: "block", type: "drive_simple" },
          { kind: "block", type: "drive_distance" },
          { kind: "block", type: "turn_simple" },
          { kind: "block", type: "turn_degrees" },
          { kind: "block", type: "turn_to_heading" },
          { kind: "block", type: "turn_to_rotation" },
          { kind: "block", type: "stop_driving" },
          { kind: "block", type: "set_drive_velocity" },
          { kind: "block", type: "set_turn_velocity" },
          { kind: "block", type: "set_drive_heading" },
          { kind: "block", type: "set_drive_rotation" },
          { kind: "block", type: "set_drive_timeout" },
        ]
        break
      case "logic":
        blocks = [
          { kind: "block", type: "controls_if" },
          { kind: "block", type: "logic_compare" },
          { kind: "block", type: "logic_operation" },
          { kind: "block", type: "logic_boolean" },
        ]
        break
      case "loops":
        blocks = [
          { kind: "block", type: "controls_repeat_ext" },
          { kind: "block", type: "controls_whileUntil" },
        ]
        break
    }

    workspace.updateToolbox({ kind: "flyoutToolbox", contents: blocks })
  }, [categoryState.selectedCategory, workspace])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.fillStyle = "#f9fafb"
    ctx.fillRect(0, 0, width, height)

    // Grid
    ctx.strokeStyle = "#e5e7eb"
    ctx.lineWidth = 1
    for (let i = 0; i <= width; i += 20) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, height)
      ctx.stroke()
    }
    for (let i = 0; i <= height; i += 20) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(canvas.width, i)
      ctx.stroke()
    }

    // Draw rulers
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(width - 30, 0, 30, height) // Right ruler
    ctx.fillRect(0, height - 30, width - 30, 30) // Bottom ruler

    ctx.strokeStyle = "#666666"
    ctx.fillStyle = "#666666"
    ctx.font = "10px sans-serif"
    ctx.lineWidth = 1

    // Right ruler markings
    for (let i = 0; i <= height; i += 50) {
      ctx.beginPath()
      ctx.moveTo(width - 30, i)
      ctx.lineTo(width - 20, i)
      ctx.stroke()
      if (i % 100 === 0) {
        ctx.save()
        ctx.translate(width - 15, i)
        ctx.rotate(Math.PI / 2)
        ctx.fillText(`${i}`, 0, 0)
        ctx.restore()
      }
    }

    // Bottom ruler markings
    for (let i = 0; i <= width - 30; i += 50) {
      ctx.beginPath()
      ctx.moveTo(i, height - 30)
      ctx.lineTo(i, height - 20)
      ctx.stroke()
      if (i % 100 === 0) {
        ctx.fillText(`${i}`, i - 10, height - 10)
      }
    }

    // Draw robot
    ctx.save()
    ctx.translate(robotState.x, robotState.y)
    ctx.rotate((robotState.rotation * Math.PI) / 180)

    // Robot body
    ctx.fillStyle = "#4A90E2"
    ctx.beginPath()
    ctx.roundRect(-20, -20, 40, 40, 5)
    ctx.fill()

    // Direction arrow
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.moveTo(20, 0)
    ctx.lineTo(8, -8)
    ctx.lineTo(8, 8)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }, [robotState, playgroundState.isMaximized])

  const handleRun = async () => {
    if (!workspace || !window.Blockly) return

    const Blockly = window.Blockly
    const code = Blockly.JavaScript.workspaceToCode(workspace)

    const canvasWidth = playgroundState.isMaximized ? 568 : 368
    const canvasHeight = playgroundState.isMaximized ? 568 : 368
    setRobotState({
      x: canvasWidth / 2,
      y: canvasHeight / 2,
      rotation: 0,
      driveVelocity: 50,
      turnVelocity: 50,
      heading: 0,
    })

    const robotAPI = {
      drive: async (direction: string, distance?: number, unit?: string) => {
        const dist = distance || 100
        const multiplier = direction === "forward" ? 1 : -1
        const pixels = unit === "mm" ? dist / 5 : dist

        await animateRobot((state) => ({
          ...state,
          x: state.x + pixels * multiplier * Math.cos((state.rotation * Math.PI) / 180),
          y: state.y + pixels * multiplier * Math.sin((state.rotation * Math.PI) / 180),
        }))
      },
      turn: async (direction: string, degrees?: number) => {
        const angle = degrees || 90
        const multiplier = direction === "right" ? 1 : -1

        await animateRobot((state) => ({
          ...state,
          rotation: state.rotation + angle * multiplier,
        }))
      },
      turnToHeading: async (heading: number) => {
        await animateRobot((state) => ({
          ...state,
          rotation: heading,
        }))
      },
      turnToRotation: async (rotation: number) => {
        await animateRobot((state) => ({
          ...state,
          rotation: rotation,
        }))
      },
      stopDriving: () => {},
      setDriveVelocity: (velocity: number) => {
        setRobotState((prev) => ({ ...prev, driveVelocity: velocity }))
      },
      setTurnVelocity: (velocity: number) => {
        setRobotState((prev) => ({ ...prev, turnVelocity: velocity }))
      },
      setDriveHeading: (heading: number) => {
        setRobotState((prev) => ({ ...prev, heading: heading }))
      },
      setDriveRotation: (rotation: number) => {
        setRobotState((prev) => ({ ...prev, rotation: rotation }))
      },
      setDriveTimeout: (seconds: number) => {
        return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
      },
    }

    const animateRobot = (updateFn: (state: RobotState) => RobotState) => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          setRobotState((prev) => updateFn(prev))
          resolve()
        }, 300)
      })
    }

    try {
      const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
      const execFunc = new AsyncFunction("robot", code)
      await execFunc(robotAPI)
    } catch (error: any) {
      console.error("Execution error:", error)
    }
  }

  const handleClear = () => {
    if (workspace) {
      workspace.clear()
      const canvasWidth = playgroundState.isMaximized ? 568 : 368
      const canvasHeight = playgroundState.isMaximized ? 568 : 368
      setRobotState({
        x: canvasWidth / 2,
        y: canvasHeight / 2,
        rotation: 0,
        driveVelocity: 50,
        turnVelocity: 50,
        heading: 0,
      })
    }
  }

  const handleSave = () => {
    if (!workspace || !window.Blockly) return

    const Blockly = window.Blockly
    const xml = Blockly.Xml.workspaceToDom(workspace)
    const xmlText = Blockly.Xml.domToText(xml)

    const blob = new Blob([xmlText], { type: "text/xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "robot-program.xml"
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleOpen = () => {
    if (!workspace || !window.Blockly) return

    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".xml"
    input.onchange = (e: any) => {
      const file = e.target.files[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const xmlText = event.target?.result as string
        const Blockly = window.Blockly
        const xml = Blockly.utils.xml.textToDom(xmlText)
        workspace.clear()
        Blockly.Xml.domToWorkspace(xml, workspace)
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleSelectCategory = (category: string) => {
    if (!workspace || !window.Blockly) return

    setCategoryState({ selectedCategory: category })

    const Blockly = window.Blockly
    workspace.clear()

    let blocks: any[] = []
    if (category === "drivetrain") {
      blocks = [
        { type: "drive_simple" },
        { type: "drive_distance" },
        { type: "turn_simple" },
        { type: "turn_degrees" },
        { type: "turn_to_heading" },
        { type: "turn_to_rotation" },
        { type: "stop_driving" },
        { type: "set_drive_velocity" },
        { type: "set_turn_velocity" },
        { type: "set_drive_heading" },
        { type: "set_drive_rotation" },
        { type: "set_drive_timeout" },
      ]
    }

    // This part is to render blocks in the toolbox if it's not a flyout
    // For flyout toolbox, it's handled in the useEffect that updates the toolbox
    // const flyoutWorkspace = new Blockly.WorkspaceSvg(new Blockly.Options({ scrollbars: false }))
    // const flyoutBlocks: any[] = []

    // blocks.forEach((blockInfo, index) => {
    //   const block = flyoutWorkspace.newBlock(blockInfo.type)
    //   block.initSvg()
    //   block.render()
    //   block.moveBy(20, index * 80) // Increased spacing from 70 to 80 for taller blocks
    //   flyoutBlocks.push(block)
    // })

    workspace.getToolbox()?.setSelectedItem(null)
  }

  const handleOpenPlayground = () => {
    setPlaygroundState((prev) => ({ ...prev, isVisible: true, isMinimized: false }))
  }

  const handleClosePlayground = () => {
    setPlaygroundState((prev) => ({ ...prev, isVisible: false }))
  }

  const handleMinimizePlayground = () => {
    setPlaygroundState((prev) => ({ ...prev, isMinimized: !prev.isMinimized }))
  }

  const handleMaximizePlayground = () => {
    setPlaygroundState((prev) => ({ ...prev, isMaximized: !prev.isMaximized }))
  }

  const handleOpenAIAssistant = () => {
    setAIAssistantState((prev) => ({ ...prev, isVisible: true, isMinimized: false }))
  }

  const handleCloseAIAssistant = () => {
    setAIAssistantState((prev) => ({ ...prev, isVisible: false }))
  }

  const handleMinimizeAIAssistant = () => {
    setAIAssistantState((prev) => ({ ...prev, isMinimized: !prev.isMinimized }))
  }

  const handleMaximizeAIAssistant = () => {
    setAIAssistantState((prev) => ({ ...prev, isMaximized: !prev.isMaximized }))
  }

  const handleAIAssistantMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return
    if (!(e.target as HTMLElement).closest(".ai-assistant-header")) return

    setAIAssistantState((prev) => ({
      ...prev,
      isDragging: true,
      dragStartX: e.clientX - prev.x,
      dragStartY: e.clientY - prev.y,
    }))
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (aiAssistantState.isDragging) {
        setAIAssistantState((prev) => ({
          ...prev,
          x: e.clientX - prev.dragStartX,
          y: e.clientY - prev.dragStartY,
        }))
      }
    }

    const handleMouseUp = () => {
      setAIAssistantState((prev) => ({ ...prev, isDragging: false }))
    }

    if (aiAssistantState.isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [aiAssistantState.isDragging])

  return (
    <div className="h-screen flex flex-col bg-[#E8EEF7]">
      {/* Header */}
      <div className="h-14 bg-gradient-to-r from-[#1976D2] to-[#2196F3] flex items-center justify-between px-4 text-white shadow-md">
        <div className="flex items-center gap-4">
          <div className="bg-[#FF6B35] px-3 py-1.5 rounded font-bold text-sm">VR</div>
          <div className="flex items-center gap-2 text-sm">
            <button className="hover:bg-white/10 px-3 py-1.5 rounded transition-colors" onClick={handleSave}>
              File
            </button>
            <button className="hover:bg-white/10 px-3 py-1.5 rounded transition-colors" onClick={handleOpen}>
              Tools
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">VEXcode Project</span>
          <span className="text-xs text-white/70">Not Saving</span>
        </div>
        <div className="flex items-center gap-2">
          {!playgroundState.isVisible && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenPlayground}
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              Open Playground
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-white hover:bg-white/20 relative"
            onClick={handleOpenAIAssistant}
          >
            <MessageSquare className="h-5 w-5" />
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold">AI</span>
          </Button>
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/20" onClick={handleRun}>
            <Play className="h-4 w-4 mr-1" />
            START
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Category Icons */}
        <div className="w-16 bg-[#D6E4F5] border-r border-gray-300 flex flex-col items-center py-4 gap-2">
          <Button
            variant="ghost"
            size="icon"
            className={`w-12 h-12 rounded-lg transition-colors ${
              categoryState.selectedCategory === "drivetrain"
                ? "bg-[#4A90E2] text-white"
                : "bg-[#4A90E2]/20 text-[#4A90E2] hover:bg-[#4A90E2]/30"
            }`}
            onClick={() => handleSelectCategory("drivetrain")}
            title="Drivetrain"
          >
            <Circle className="h-6 w-6" fill="currentColor" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-12 h-12 rounded-lg bg-[#9B59B6]/20 text-[#9B59B6] hover:bg-[#9B59B6]/30"
            title="Magnet"
          >
            <Square className="h-6 w-6" fill="currentColor" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-12 h-12 rounded-lg bg-[#E67E22]/20 text-[#E67E22] hover:bg-[#E67E22]/30"
            title="Drawing"
          >
            <Square className="h-6 w-6" fill="currentColor" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-12 h-12 rounded-lg bg-[#27AE60]/20 text-[#27AE60] hover:bg-[#27AE60]/30"
            title="Sensing"
          >
            <Circle className="h-6 w-6" fill="currentColor" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-12 h-12 rounded-lg bg-[#7F8C8D]/20 text-[#7F8C8D] hover:bg-[#7F8C8D]/30"
            title="Console"
          >
            <Square className="h-6 w-6" fill="currentColor" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-12 h-12 rounded-lg bg-[#3498DB]/20 text-[#3498DB] hover:bg-[#3498DB]/30"
            title="Logic"
          >
            <Circle className="h-6 w-6" fill="currentColor" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-12 h-12 rounded-lg bg-[#2ECC71]/20 text-[#2ECC71] hover:bg-[#2ECC71]/30"
            title="Switch"
          >
            <Square className="h-6 w-6" fill="currentColor" />
          </Button>
        </div>

        {/* Blockly Workspace */}
        <div className="flex-1 relative">
          {!blocklyLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-600">Loading Blockly...</p>
            </div>
          )}
          <div ref={blocklyDivRef} className="w-full h-full" />
        </div>
      </div>

      {/* Playground Window */}
      {blocklyLoaded && playgroundState.isVisible && (
        <div
          ref={playgroundRef}
          onMouseDown={handlePlaygroundMouseDown}
          className="fixed bg-white rounded-lg shadow-2xl border-2 border-gray-300 z-50 transition-all duration-200"
          style={{
            left: `${playgroundState.x}px`,
            top: `${playgroundState.y}px`,
            cursor: playgroundState.isDragging ? "grabbing" : "auto",
            width: playgroundState.isMaximized ? "600px" : "400px",
          }}
        >
          <div className="playground-header bg-gradient-to-r from-[#1976D2] to-[#2196F3] text-white px-4 py-2 rounded-t-lg flex items-center justify-between cursor-grab active:cursor-grabbing">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-white/70" />
              <h3 className="font-semibold text-sm">Playground</h3>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  handleMinimizePlayground()
                }}
              >
                {playgroundState.isMinimized ? <Maximize className="h-4 w-4" /> : <Minimize className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  handleMaximizePlayground()
                }}
              >
                {playgroundState.isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClosePlayground()
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {!playgroundState.isMinimized && (
            <div className="p-4">
              <canvas
                ref={canvasRef}
                width={playgroundState.isMaximized ? 568 : 368}
                height={playgroundState.isMaximized ? 568 : 368}
                className="border-2 border-gray-300 rounded bg-white"
              />
            </div>
          )}
        </div>
      )}

      {blocklyLoaded && aiAssistantState.isVisible && (
        <div
          ref={aiAssistantRef}
          onMouseDown={handleAIAssistantMouseDown}
          className="fixed bg-white rounded-lg shadow-2xl border-2 border-gray-300 z-50 transition-all duration-200"
          style={{
            left: `${aiAssistantState.x}px`,
            top: `${aiAssistantState.y}px`,
            cursor: aiAssistantState.isDragging ? "grabbing" : "auto",
            width: aiAssistantState.isMaximized ? "600px" : "400px",
            height: aiAssistantState.isMinimized ? "auto" : aiAssistantState.isMaximized ? "600px" : "400px",
          }}
        >
          <div className="ai-assistant-header bg-gradient-to-r from-[#9B59B6] to-[#8E44AD] text-white px-4 py-2 rounded-t-lg flex items-center justify-between cursor-grab active:cursor-grabbing">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-white/70" />
              <h3 className="font-semibold text-sm">AI Assistant</h3>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  handleMinimizeAIAssistant()
                }}
              >
                {aiAssistantState.isMinimized ? <Maximize className="h-4 w-4" /> : <Minimize className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  handleMaximizeAIAssistant()
                }}
              >
                {aiAssistantState.isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  handleCloseAIAssistant()
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {!aiAssistantState.isMinimized && (
            <div className="p-4 h-full overflow-auto">
              <div className="text-gray-600 text-sm">
                <p className="mb-2">Ask me anything about programming your robot!</p>
                <textarea
                  className="w-full h-32 p-2 border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Type your question here..."
                />
                <Button className="mt-2 bg-[#9B59B6] hover:bg-[#8E44AD] text-white">Send</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function defineDrivetrainBlocks(Blockly: any) {
  Blockly.Blocks["drive_simple"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("drive")
        .appendField(
          new Blockly.FieldDropdown([
            ["forward", "forward"],
            ["reverse", "reverse"],
          ]),
          "DIRECTION",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Drive the robot forward or reverse")
    },
  }

  Blockly.JavaScript.forBlock["drive_simple"] = (block: any) => {
    const direction = block.getFieldValue("DIRECTION")
    return `await robot.drive('${direction}');\n`
  }

  Blockly.Blocks["drive_distance"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("drive")
        .appendField(
          new Blockly.FieldDropdown([
            ["forward", "forward"],
            ["reverse", "reverse"],
          ]),
          "DIRECTION",
        )
        .appendField("for")
        .appendField(new Blockly.FieldNumber(200, 0), "DISTANCE")
        .appendField(
          new Blockly.FieldDropdown([
            ["mm", "mm"],
            ["inches", "inches"],
          ]),
          "UNIT",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Drive the robot a specific distance")
    },
  }

  Blockly.JavaScript.forBlock["drive_distance"] = (block: any) => {
    const direction = block.getFieldValue("DIRECTION")
    const distance = block.getFieldValue("DISTANCE")
    const unit = block.getFieldValue("UNIT")
    return `await robot.drive('${direction}', ${distance}, '${unit}');\n`
  }

  Blockly.Blocks["turn_simple"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("turn")
        .appendField(
          new Blockly.FieldDropdown([
            ["right", "right"],
            ["left", "left"],
          ]),
          "DIRECTION",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Turn the robot right or left")
    },
  }

  Blockly.JavaScript.forBlock["turn_simple"] = (block: any) => {
    const direction = block.getFieldValue("DIRECTION")
    return `await robot.turn('${direction}');\n`
  }

  Blockly.Blocks["turn_degrees"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("turn")
        .appendField(
          new Blockly.FieldDropdown([
            ["right", "right"],
            ["left", "left"],
          ]),
          "DIRECTION",
        )
        .appendField("for")
        .appendField(new Blockly.FieldNumber(90, 0), "DEGREES")
        .appendField("degrees")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Turn the robot a specific number of degrees")
    },
  }

  Blockly.JavaScript.forBlock["turn_degrees"] = (block: any) => {
    const direction = block.getFieldValue("DIRECTION")
    const degrees = block.getFieldValue("DEGREES")
    return `await robot.turn('${direction}', ${degrees});\n`
  }

  Blockly.Blocks["turn_to_heading"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("turn to heading")
        .appendField(new Blockly.FieldNumber(90, 0, 359), "HEADING")
        .appendField("degrees")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Turn to a specific heading")
    },
  }

  Blockly.JavaScript.forBlock["turn_to_heading"] = (block: any) => {
    const heading = block.getFieldValue("HEADING")
    return `await robot.turnToHeading(${heading});\n`
  }

  Blockly.Blocks["turn_to_rotation"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("turn to rotation")
        .appendField(new Blockly.FieldNumber(90, 0), "ROTATION")
        .appendField("degrees")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Turn to a specific rotation")
    },
  }

  Blockly.JavaScript.forBlock["turn_to_rotation"] = (block: any) => {
    const rotation = block.getFieldValue("ROTATION")
    return `await robot.turnToRotation(${rotation});\n`
  }

  Blockly.Blocks["stop_driving"] = {
    init: function () {
      this.appendDummyInput().appendField("stop driving")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Stop the robot")
    },
  }

  Blockly.JavaScript.forBlock["stop_driving"] = () => `robot.stopDriving();\n`

  Blockly.Blocks["set_drive_velocity"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set drive velocity to")
        .appendField(new Blockly.FieldNumber(50, 0, 100), "VELOCITY")
        .appendField("%")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#5A9FE2")
      this.setTooltip("Set the drive velocity")
    },
  }

  Blockly.JavaScript.forBlock["set_drive_velocity"] = (block: any) => {
    const velocity = block.getFieldValue("VELOCITY")
    return `robot.setDriveVelocity(${velocity});\n`
  }

  Blockly.Blocks["set_turn_velocity"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set turn velocity to")
        .appendField(new Blockly.FieldNumber(50, 0, 100), "VELOCITY")
        .appendField("%")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#5A9FE2")
      this.setTooltip("Set the turn velocity")
    },
  }

  Blockly.JavaScript.forBlock["set_turn_velocity"] = (block: any) => {
    const velocity = block.getFieldValue("VELOCITY")
    return `robot.setTurnVelocity(${velocity});\n`
  }

  Blockly.Blocks["set_drive_heading"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set drive heading to")
        .appendField(new Blockly.FieldNumber(0, 0, 359), "HEADING")
        .appendField("degrees")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#5A9FE2")
      this.setTooltip("Set the drive heading")
    },
  }

  Blockly.JavaScript.forBlock["set_drive_heading"] = (block: any) => {
    const heading = block.getFieldValue("HEADING")
    return `robot.setDriveHeading(${heading});\n`
  }

  Blockly.Blocks["set_drive_rotation"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set drive rotation to")
        .appendField(new Blockly.FieldNumber(0, 0), "ROTATION")
        .appendField("degrees")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#5A9FE2")
      this.setTooltip("Set the drive rotation")
    },
  }

  Blockly.JavaScript.forBlock["set_drive_rotation"] = (block: any) => {
    const rotation = block.getFieldValue("ROTATION")
    return `robot.setDriveRotation(${rotation});\n`
  }

  Blockly.Blocks["set_drive_timeout"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set drive timeout to")
        .appendField(new Blockly.FieldNumber(1, 0), "TIMEOUT")
        .appendField("seconds")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#5A9FE2")
      this.setTooltip("Set the drive timeout")
    },
  }

  Blockly.JavaScript.forBlock["set_drive_timeout"] = (block: any) => {
    const timeout = block.getFieldValue("TIMEOUT")
    return `await robot.setDriveTimeout(${timeout});\n`
  }
}
