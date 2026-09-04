"use client"

import type { ReactNode, Ref } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { dismissBlocklyFieldEditors } from "@/blocks/fields"
import { isBlocklyFieldEditorTarget } from "@/lib/blockly-widget-form"
import { generateWhenStartedJavaScript } from "@/lib/robot-runtime"
import { CategoryRail } from "./CategoryRail"
import { DeletedBlocksModal, TrashcanButton } from "./Trashcan"
import { useBlocklyInjection, useBlocklyLoader, useBlocklyWidgetFix } from "./use-blockly-workspace"

export interface FieldPickerEvent {
  blockId: string
  blockType: string
  fieldName: string
  value: string
  direction?: string
  clientX: number
  clientY: number
}

export interface BlocklyEditorProps {
  toolbox: unknown[]
  selectedCategory: string | null
  onSelectCategory: (category: string) => void
  onRegisterBlocks: (Blockly: any) => void
  onWorkspaceReady: (workspace: any) => void
  onBlocklyLoaded?: () => void
  onCodeChange?: (code: string) => void
  onTrash?: () => void
  onFieldPicker?: (event: FieldPickerEvent) => void
  codeView: "blocks" | "python"
  pythonCode: string
  workspaceContainerRef?: Ref<HTMLDivElement>
  overlay?: ReactNode
}

const PICKER_FIELDS: Record<string, string> = {
  turn_degrees: "DEGREES",
  turn_to_rotation: "ROTATION",
  set_drive_rotation: "ROTATION",
  turn_to_heading: "HEADING",
  set_drive_heading: "HEADING",
  drive_distance: "DISTANCE",
}

export function BlocklyEditor({
  toolbox,
  selectedCategory,
  onSelectCategory,
  onRegisterBlocks,
  onWorkspaceReady,
  onBlocklyLoaded,
  onCodeChange,
  onTrash,
  onFieldPicker,
  codeView,
  pythonCode,
  workspaceContainerRef,
  overlay,
}: BlocklyEditorProps) {
  const blocklyDivRef = useRef<HTMLDivElement>(null)
  const { blocklyLoaded, blocklyLoadError } = useBlocklyLoader(onRegisterBlocks)
  const workspace = useBlocklyInjection(blocklyLoaded, blocklyDivRef, onWorkspaceReady)
  useBlocklyWidgetFix(blocklyLoaded)

  useEffect(() => {
    if (blocklyLoaded) onBlocklyLoaded?.()
  }, [blocklyLoaded, onBlocklyLoaded])

  const [deletedBlocks, setDeletedBlocks] = useState<string | null>(null)
  const [showDeletedBlocks, setShowDeletedBlocks] = useState(false)

  useEffect(() => {
    if (!workspace || !blocklyLoaded) return
    workspace.updateToolbox({
      kind: "flyoutToolbox",
      contents: toolbox,
    })
    workspace.getToolbox()?.setSelectedItem(null)
  }, [toolbox, workspace, blocklyLoaded])

  useEffect(() => {
    if (!workspace || !onCodeChange) return
    const emit = () => {
      onCodeChange(generateWhenStartedJavaScript(workspace, window.Blockly.JavaScript))
    }
    emit()
    workspace.addChangeListener(emit)
    return () => workspace.removeChangeListener(emit)
  }, [workspace, onCodeChange])

  useEffect(() => {
    if (!workspace || !blocklyLoaded || !onFieldPicker) return

    const openCustomPicker = (e: PointerEvent) => {
      const target = e.target as Element
      if (isBlocklyFieldEditorTarget(target)) return

      const blockSvg = target.closest(".blocklyDraggable")
      if (!blockSvg) return

      const blockId = blockSvg.getAttribute("data-id")
      if (!blockId) return

      const block = workspace.getBlockById(blockId)
      if (!block) return

      const fieldName = PICKER_FIELDS[block.type]
      if (!fieldName) return

      const field = block.getField(fieldName) as { getSvgRoot?: () => SVGElement | null } | null
      const fieldSvg = field?.getSvgRoot?.()
      if (!fieldSvg || !(target instanceof Node) || !fieldSvg.contains(target)) return

      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      dismissBlocklyFieldEditors()

      onFieldPicker({
        blockId: block.id,
        blockType: block.type,
        fieldName,
        value: block.getFieldValue(fieldName),
        direction: block.type === "drive_distance" ? block.getFieldValue("DIRECTION") || "forward" : undefined,
        clientX: e.clientX,
        clientY: e.clientY,
      })
    }

    const workspaceSvg = workspace.getParentSvg()
    if (workspaceSvg) workspaceSvg.addEventListener("pointerdown", openCustomPicker, true)
    return () => {
      if (workspaceSvg) workspaceSvg.removeEventListener("pointerdown", openCustomPicker, true)
    }
  }, [blocklyLoaded, workspace, onFieldPicker])

  const handleTrash = useCallback(() => {
    if (workspace) {
      const xml = window.Blockly.Xml.workspaceToDom(workspace)
      setDeletedBlocks(window.Blockly.Xml.domToText(xml))
      workspace.clear()
    }
    onTrash?.()
  }, [workspace, onTrash])

  const handleRestoreBlocks = useCallback(() => {
    if (workspace && deletedBlocks) {
      const xml = window.Blockly.Xml.textToDom(deletedBlocks)
      window.Blockly.Xml.domToWorkspace(xml, workspace)
      setShowDeletedBlocks(false)
    }
  }, [workspace, deletedBlocks])

  return (
    <>
      <CategoryRail
        selectedCategory={selectedCategory}
        onSelectCategory={onSelectCategory}
        footer={
          <TrashcanButton
            hasDeleted={Boolean(deletedBlocks)}
            onClick={() => (deletedBlocks ? setShowDeletedBlocks(true) : handleTrash())}
          />
        }
      />

      <div id="vex-blockly-workspace" ref={workspaceContainerRef} className="flex-1 relative">
        {!blocklyLoaded && (
          <div id="vex-blockly-loading" className="absolute inset-0 flex items-center justify-center">
            {blocklyLoadError ? (
              <p className="text-red-600">Could not load the block editor: {blocklyLoadError}</p>
            ) : (
              <p className="text-gray-600">Loading Blockly...</p>
            )}
          </div>
        )}
        <div
          id="vex-blockly-canvas"
          ref={blocklyDivRef}
          className="w-full h-full"
          style={{ display: codeView === "blocks" ? "block" : "none" }}
        />
        {codeView === "blocks" && overlay}
        {codeView === "python" && (
          <div id="vex-python-code-view" className="w-full h-full bg-gray-900 text-gray-100 font-mono text-sm overflow-auto p-4">
            <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed">
              <code>{pythonCode}</code>
            </pre>
          </div>
        )}
      </div>

      <DeletedBlocksModal
        open={Boolean(showDeletedBlocks && deletedBlocks)}
        onClose={() => setShowDeletedBlocks(false)}
        onRestore={handleRestoreBlocks}
        onClear={() => {
          setDeletedBlocks(null)
          setShowDeletedBlocks(false)
        }}
      />
    </>
  )
}
