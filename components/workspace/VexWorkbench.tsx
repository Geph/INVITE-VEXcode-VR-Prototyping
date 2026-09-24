"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AngleWheelPicker, CompassPicker } from "@/blocks/fields"
import { installAllBlocks } from "@/blocks/registry"
import { flyoutContents } from "@/blocks/toolbox"
import { AIAssistant, type AIAssistantHandle, type SurveyStep } from "@/components/ai-assistant"
import { MissionDayReadout } from "@/components/playground/MissionDayReadout"
import { RoverStatusReadout } from "@/components/playground/RoverStatusReadout"
import { BATTERY_START_PCT, capacityForLevel, type RoverStatus } from "@/playgrounds/rover-rescue"
import { PlaygroundHud } from "@/components/playground/PlaygroundHud"
import { PlaygroundPicker } from "@/components/playground/PlaygroundPicker"
import { PlaygroundWindow } from "@/components/playground/PlaygroundWindow"
import { ZoomControls } from "@/components/playground/ZoomControls"
import { RoverRescueHud, MissionDialog, MissionEndPanel } from "@/playgrounds/rover-rescue/hud"
import { useRoverDay50 } from "@/hooks/useRoverDay50"
import BlocklyCollabOverlay from "@/components/blockly-collab-overlay"
import { BlocklyEditor, type FieldPickerEvent } from "@/components/workspace/BlocklyEditor"
import { railCategoriesFor } from "@/components/workspace/CategoryRail"
import { CelebrationOverlay } from "@/components/workspace/CelebrationOverlay"
import { DEFAULT_ROBOT_CAPABILITIES } from "@/components/workspace/RobotConfigWindow"
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader"
import { updateBlocklyNumberField } from "@/components/workspace/update-blockly-field"
import { isCastleCrashersPlayground, isRoverRescuePlayground } from "@/hooks/playground-motion"
import { CastleCrashersHud, CastleLevelToggle, createCastleCrashersState } from "@/playgrounds/castle-crashers"
import { usePlaygroundDraw } from "@/hooks/usePlaygroundDraw"
import { usePlaygroundMission } from "@/hooks/usePlaygroundMission"
import { usePlaygroundSession } from "@/hooks/usePlaygroundSession"
import { useProgramRunner } from "@/hooks/useProgramRunner"
import { useRoverCamera } from "@/hooks/useRoverCamera"
import { useRoverDebug } from "@/hooks/useRoverDebug"
import { installVexBlockContextMenu } from "@/lib/blockly-context-menu"
import { blockToPythonSnippet, generatePythonProgram } from "@/lib/python-generator"
import { useBlocklyCollab } from "@/lib/use-blockly-collab"
import { reefViewFromMaximized } from "@/hooks/playground-host"
import { recordSessionEvent, type SessionLogSnapshot } from "@/lib/session-log"

const IDLE_ROVER_STATUS: RoverStatus = {
  days: 0,
  batteryPercent: BATTERY_START_PCT,
  level: 1,
  exp: 0,
  stored: 0,
  capacity: capacityForLevel(1),
  standby: false,
  day50Dialog: false,
}

export function VexWorkbench() {
  const blocklyWorkspaceContainerRef = useRef<HTMLDivElement>(null)
  const aiAssistantRef = useRef<AIAssistantHandle>(null)
  const [workspace, setWorkspace] = useState<any>(null)
  const [blocklyLoaded, setBlocklyLoaded] = useState(false)
  const collab = useBlocklyCollab(workspace, blocklyLoaded, blocklyWorkspaceContainerRef)
  const [selectedCategory, setSelectedCategory] = useState<string | null>("drivetrain")
  const [aiStep, setAiStep] = useState<SurveyStep>("main")
  const [roverStatus, setRoverStatus] = useState<RoverStatus>(IDLE_ROVER_STATUS)
  const [codeView, setCodeView] = useState<"blocks" | "python">("blocks")
  // Rover Rescue ships without the Robot config window, so devices stay stock.
  const robotCapabilities = DEFAULT_ROBOT_CAPABILITIES
  const blocklyPickerRef = useRef<{ blockId: string; fieldName: string } | null>(null)
  const [anglePickerState, setAnglePickerState] = useState({ isOpen: false, angle: 90, x: 0, y: 0 })
  const [compassPickerState, setCompassPickerState] = useState({ isOpen: false, heading: 0, x: 0, y: 0 })

  const session = usePlaygroundSession(robotCapabilities.eyeSensor)
  const {
    handleStart,
    handleStep,
    handleStop,
    handleReset,
    isRunning,
    setIsRunning,
    isRunningRef,
    stopRequestedRef,
    isStepping,
    isPausedOnBlock,
    consoleLines,
  } = useProgramRunner({
    workspace,
    robotStateRef: session.robotStateRef,
    setRobotState: session.setRobotState,
    runtimeRef: session.runtimeRef,
    reefStateRef: session.reefStateRef,
    roverStateRef: session.roverStateRef,
    castleStateRef: session.castleStateRef,
    activePlayground: session.activePlayground,
    robotCapabilities,
    getView: () => reefViewFromMaximized(session.playgroundState.isMaximized),
    animateRobotFluidRef: session.animateRobotFluidRef,
    deployTrashFieldRef: session.deployTrashFieldRef,
    cancelRobotAnimation: session.cancelRobotAnimation,
    setGameState: session.setGameState,
    setPenTrail: session.setPenTrail,
    coralGraceUntilRef: session.coralGraceUntilRef,
    trashSpawnIntervalRef: session.trashSpawnIntervalRef,
    syncTrashItems: session.syncTrashItems,
  })

  const day50 = useRoverDay50(session.roverStateRef, setRoverStatus)
  const onReset = useCallback(() => {
    day50.clearEnd()
    if (isCastleCrashersPlayground(session.playgroundId)) {
      const previous = session.castleStateRef.current
      const next = createCastleCrashersState(previous.seed, previous.level)
      session.castleStateRef.current = next
      session.setCastleState(next)
    }
    handleReset()
  }, [day50, handleReset])
  const onStart = useCallback(() => {
    day50.clearEnd()
    if (!isRunningRef.current && isCastleCrashersPlayground(session.playgroundId)) {
      const previous = session.castleStateRef.current
      const next = createCastleCrashersState(previous.seed, previous.level)
      session.castleStateRef.current = next
      session.setCastleState(next)
    }
    handleStart()
  }, [day50, handleStart])

  const roverField = isRoverRescuePlayground(session.playgroundId)
  const castleField = isCastleCrashersPlayground(session.playgroundId)
  const roverViewport = useMemo(
    () => ({ widthPx: session.canvasSize.w, heightPx: session.canvasSize.h }),
    [session.canvasSize.w, session.canvasSize.h],
  )
  const roverCam = useRoverCamera({
    canvasRef: session.canvasRef,
    enabled: roverField && session.playgroundState.isVisible && !session.playgroundState.isMinimized,
    viewport: roverViewport,
    robot: session.robotState,
  })

  useRoverDebug({
    enabled: roverField && session.roverState.debug,
    canvasRef: session.canvasRef,
    camera: roverCam.camera,
    viewport: roverViewport,
    roverStateRef: session.roverStateRef,
    commitState: session.setRoverState,
  })

  const { checkCoralCollision, checkTrashCollision, floatAnimationRef } = usePlaygroundDraw({
    canvasRef: session.canvasRef,
    playgroundId: session.playgroundId,
    activePlayground: session.activePlayground,
    playgroundState: session.playgroundState,
    robotState: session.robotState,
    reefState: session.reefState,
    reefStateRef: session.reefStateRef,
    roverStateRef: session.roverStateRef,
    castleStateRef: session.castleStateRef,
    roverCamera: roverField ? roverCam.camera : null,
    coralPieces: session.coralPieces,
    trashItems: session.trashItems,
    penTrail: session.penTrail,
    isRunning,
    showRuler: session.showRuler,
    runtimeRef: session.runtimeRef,
    commitReefState: session.commitReefState,
    setGameState: session.setGameState,
    gameState: session.gameState,
    onRoverMissionOver: (reason, status) => {
      stopRequestedRef.current = true
      session.cancelRobotAnimation()
      isRunningRef.current = false
      setIsRunning(false)
      const survived = reason === "days"
      const flat = reason === "battery"
      session.setGameState((prev) => ({
        ...prev,
        isGameOver: true,
        missionEndReason: survived ? "complete" : flat ? "battery" : "river",
        gameLost: !survived,
        missionDays: status.days,
        batteryPercent: status.batteryPercent,
        runError: survived ? null : flat ? "The rover ran out of power." : "The rover entered the river.",
      }))
      setRoverStatus(status)
    },
    onCastleState: (state) => {
      if (!state.missionOver) return
      stopRequestedRef.current = true
      session.cancelRobotAnimation()
      isRunningRef.current = false
      setIsRunning(false)
    },
    onRoverStatus: (status) => {
      setRoverStatus(status)
      session.setGameState((prev) => (prev.isGameOver ? prev : { ...prev, missionDays: status.days }))
    },
  })

  const { handleTrash } = usePlaygroundMission({
    enabled: !roverField,
    robotState: session.robotState,
    trashItems: session.trashItems,
    gameState: session.gameState,
    setGameState: session.setGameState,
    isRunning,
    isPausedOnBlock,
    stopRequestedRef,
    isRunningRef,
    setIsRunning,
    cancelRobotAnimation: session.cancelRobotAnimation,
    trashSpawnIntervalRef: session.trashSpawnIntervalRef,
    coralGraceUntilRef: session.coralGraceUntilRef,
    floatAnimationRef,
    syncTrashItems: session.syncTrashItems,
    checkCoralCollision,
    checkTrashCollision,
  })

  const applyPickerValue = useCallback(
    (value: number) => {
      if (!workspace || !blocklyPickerRef.current) return
      const { blockId, fieldName } = blocklyPickerRef.current
      const block = workspace.getBlockById(blockId)
      if (!block) return
      updateBlocklyNumberField(block, workspace, fieldName, value)
    },
    [workspace],
  )

  const handleRegisterBlocks = useCallback((Blockly: any) => {
    installAllBlocks(Blockly, session.activePlayground)
    installVexBlockContextMenu(Blockly)
    ;(window as any).__vexBlockToPython = (block: any) => blockToPythonSnippet(block)
  }, [session.activePlayground])

  const handleFieldPicker = useCallback((event: FieldPickerEvent) => {
    blocklyPickerRef.current = { blockId: event.blockId, fieldName: event.fieldName }
    if (event.blockType === "pg_drivetrain_turn_for" || event.blockType === "pg_drivetrain_turn_to_rotation" || event.blockType === "pg_drivetrain_set_rotation") {
      setAnglePickerState({
        isOpen: true,
        angle: Number(event.value) || 0,
        x: event.clientX,
        y: event.clientY,
      })
    } else if (event.blockType === "pg_drivetrain_turn_to_heading" || event.blockType === "pg_drivetrain_set_heading") {
      setCompassPickerState({
        isOpen: true,
        heading: Number(event.value) || 0,
        x: event.clientX,
        y: event.clientY,
      })
    }
  }, [])

  const toolbox = useMemo(
    () => flyoutContents(selectedCategory, session.activePlayground),
    [selectedCategory, session.activePlayground],
  )

  const railCategories = useMemo(() => railCategoriesFor(session.activePlayground), [session.activePlayground])

  // Switching playgrounds can retire the open category, which would leave the
  // rail with nothing highlighted and the flyout empty.
  useEffect(() => {
    if (selectedCategory && !railCategories.some((category) => category.id === selectedCategory)) {
      setSelectedCategory(railCategories[0]?.id ?? null)
    }
  }, [railCategories, selectedCategory])

  const getPythonCode = useCallback(() => generatePythonProgram(workspace), [workspace])

  const getSessionSnapshot = useCallback((): SessionLogSnapshot => {
    let workspaceXml: string | undefined
    try {
      if (workspace && window.Blockly) {
        workspaceXml = window.Blockly.Xml.domToText(window.Blockly.Xml.workspaceToDom(workspace))
      }
    } catch {
      workspaceXml = undefined
    }
    return {
      playgroundId: session.playgroundId,
      console: consoleLines.map((line) => line.text),
      workspaceXml,
    }
  }, [workspace, session.playgroundId, consoleLines])

  useEffect(() => {
    recordSessionEvent("playground_open", { playgroundId: session.playgroundId })
  }, [session.playgroundId])

  useEffect(() => {
    if (session.gameState.isGameOver) {
      aiAssistantRef.current?.show()
    }
  }, [session.gameState.isGameOver])

  return (
    <div id="vex-app-root" className="h-screen flex flex-col overflow-hidden">
      <WorkspaceHeader
        workspace={workspace}
        codeView={codeView}
        onToggleCodeView={() => setCodeView(codeView === "blocks" ? "python" : "blocks")}
        collab={collab}
        playgroundVisible={session.playgroundState.isVisible}
        playgroundPickerOpen={session.playgroundPickerOpen}
        onOpenPlayground={session.handleOpenPlayground}
        onGetHelp={() => aiAssistantRef.current?.open()}
        onNewProject={() => {
          onReset()
          setCodeView("blocks")
        }}
        getSessionSnapshot={getSessionSnapshot}
      />

      <div id="vex-main" className="flex flex-1 overflow-hidden">
        <BlocklyEditor
          toolbox={toolbox}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          railCategories={railCategories}
          onRegisterBlocks={handleRegisterBlocks}
          onWorkspaceReady={setWorkspace}
          onBlocklyLoaded={() => setBlocklyLoaded(true)}
          onTrash={handleTrash}
          onFieldPicker={handleFieldPicker}
          codeView={codeView}
          pythonCode={getPythonCode()}
          workspaceContainerRef={blocklyWorkspaceContainerRef}
          overlay={
            blocklyLoaded ? <BlocklyCollabOverlay peers={collab.peers} workspace={workspace} /> : null
          }
        />
        <AIAssistant
          key={session.playgroundId}
          isRunning={isRunning}
          ref={aiAssistantRef}
          workspace={workspace}
          surveyStep={aiStep}
          onSurveyStepChange={setAiStep}
          playgroundId={session.playgroundId}
          playground={session.activePlayground}
          robot={session.robotState}
          reefState={session.reefState}
          roverState={session.roverState}
          castleState={session.castleState}
          playgroundVisible={session.playgroundState.isVisible}
          onOpenPlayground={session.handleOpenPlayground}
        />
      </div>

      <PlaygroundPicker
        open={session.playgroundPickerOpen}
        onClose={session.handleClosePlaygroundPicker}
        onChoose={session.handleChoosePlayground}
      />

      {session.playgroundState.isVisible && (
        <PlaygroundWindow
          title={session.selectedPlaygroundName}
          state={session.playgroundState}
          windowRef={session.playgroundRef}
          onMouseDown={session.handlePlaygroundMouseDown}
          onMinimize={session.handleMinimizePlayground}
          onMaximize={session.handleMaximizePlayground}
          onClose={session.handleClosePlayground}
          canvasWidth={session.canvasSize.w}
        >
          <PlaygroundHud
            consoleLines={consoleLines}
            showSensors={session.showSensors}
            showRuler={session.showRuler}
            onToggleSensors={() => session.setShowSensors((on) => !on)}
            onToggleRuler={() => session.setShowRuler((on) => !on)}
            canvasRef={session.canvasRef}
            canvasWidth={session.canvasSize.w}
            canvasHeight={session.canvasSize.h}
            gameState={session.gameState}
            liveSensors={session.liveSensors}
            isRunning={isRunning}
            isStepping={isStepping}
            isPausedOnBlock={isPausedOnBlock}
            onStart={onStart}
            onStep={handleStep}
            onStop={handleStop}
            onReset={onReset}
            aiStep={aiStep}
            onCloseStrategy={() => setAiStep("strategy")}
            chrome={roverField || castleField ? "field" : "reef"}
            gameOverDetail={
              roverField && day50.endView && day50.snapshot ? (
                <MissionEndPanel view={day50.endView} snapshot={day50.snapshot} onRetry={onReset} />
              ) : undefined
            }
            toolbarTrailing={
              roverField ? (
                <div className="flex items-center gap-2">
                  <RoverStatusReadout status={roverStatus} />
                  <MissionDayReadout days={session.gameState.missionDays} standby={roverStatus.standby} />
                </div>
              ) : null
            }
            canvasOverlay={
              roverField ? (
                <>
                  <ZoomControls
                    userScale={roverCam.userScale}
                    minZoom={roverCam.minZoom}
                    maxZoom={roverCam.maxZoom}
                    follow={roverCam.follow}
                    onZoomIn={roverCam.zoomIn}
                    onZoomOut={roverCam.zoomOut}
                    onFitField={roverCam.fitField}
                    onToggleFollow={() => roverCam.setFollow((on) => !on)}
                  />
                  <RoverRescueHud stateRef={session.roverStateRef} />
                  {roverStatus.day50Dialog ? (
                    <MissionDialog
                      days={roverStatus.days}
                      onContinue={day50.onContinue}
                      onViewStatistics={day50.onViewStatistics}
                      onGetCertificate={day50.onGetCertificate}
                    />
                  ) : null}
                </>
              ) : castleField ? (
                <>
                  <CastleCrashersHud stateRef={session.castleStateRef} onRetry={onReset} />
                  <CastleLevelToggle
                    level={session.castleState.level}
                    onChange={(level) => {
                      session.setCastleState(createCastleCrashersState(session.castleState.seed, level))
                      session.applyStartPose(session.playgroundId)
                    }}
                  />
                </>
              ) : null
            }
          />
        </PlaygroundWindow>
      )}

      <CelebrationOverlay show={session.gameState.showCelebration} trashCollected={session.gameState.trashCollected} />

      {anglePickerState.isOpen && (
        <AngleWheelPicker
          value={anglePickerState.angle}
          onApply={applyPickerValue}
          onClose={() => {
            blocklyPickerRef.current = null
            setAnglePickerState((prev) => ({ ...prev, isOpen: false }))
          }}
        />
      )}

      {compassPickerState.isOpen && (
        <CompassPicker
          value={compassPickerState.heading}
          onApply={applyPickerValue}
          onClose={() => {
            blocklyPickerRef.current = null
            setCompassPickerState((prev) => ({ ...prev, isOpen: false }))
          }}
        />
      )}
    </div>
  )
}
