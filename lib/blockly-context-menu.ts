/** VEXcode VR–style block context menu for Blockly. */

type BlocklyScope = {
  block?: any
}

type RegistryItem = {
  id: string
  scopeType: unknown
  weight: number
  displayText: string | ((scope: BlocklyScope) => string)
  preconditionFn: (scope: BlocklyScope) => string
  callback: (scope: BlocklyScope) => void
}

const HAT_TYPES = new Set(["when_started", "when_bumper"])

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.rate = 0.95
  window.speechSynthesis.speak(utter)
}

function safeUnregister(
  registry: { getItem: (id: string) => unknown; unregister: (id: string) => void },
  id: string,
) {
  if (registry.getItem(id)) registry.unregister(id)
}

/**
 * Replace Blockly's default block menu with the VEXcode VR item set and labels.
 * Safe to call more than once.
 */
export function installVexBlockContextMenu(Blockly: {
  ContextMenuRegistry: {
    registry: {
      getItem: (id: string) => unknown
      unregister: (id: string) => void
      register: (item: RegistryItem) => void
    }
    ScopeType: { BLOCK: unknown }
  }
  Msg: Record<string, string>
  Events?: { setGroup: (group: boolean | string) => void }
}): void {
  const registry = Blockly.ContextMenuRegistry.registry
  const ScopeType = Blockly.ContextMenuRegistry.ScopeType

  for (const id of [
    "blockDuplicate",
    "blockComment",
    "blockInline",
    "blockCollapseExpand",
    "blockDisable",
    "blockDelete",
    "blockHelp",
    "vexDuplicate",
    "vexDisable",
    "vexDelete",
    "vexHelp",
    "vexConvertSwitch",
    "vexRead",
  ]) {
    safeUnregister(registry, id)
  }

  const register = (item: RegistryItem) => {
    registry.register(item)
  }

  register({
    id: "vexDuplicate",
    scopeType: ScopeType.BLOCK,
    weight: 1,
    displayText: Blockly.Msg.DUPLICATE_BLOCK || "Duplicate",
    preconditionFn(scope) {
      const block = scope.block
      if (!block || block.isShadow?.()) return "hidden"
      if (typeof block.isDuplicatable === "function" && !block.isDuplicatable()) return "disabled"
      return "enabled"
    },
    callback(scope) {
      const block = scope.block
      if (!block) return
      if (typeof block.duplicate === "function") {
        block.duplicate()
        return
      }
      const xml = (window as any).Blockly?.Xml
      if (!xml) return
      const dom = xml.blockToDom(block, true)
      const copy = xml.domToBlock(dom, block.workspace)
      if (!copy) return
      const xy = block.getRelativeToSurfaceXY()
      copy.moveBy(xy.x + 30, xy.y + 30)
    },
  })

  register({
    id: "vexDisable",
    scopeType: ScopeType.BLOCK,
    weight: 2,
    displayText(scope) {
      const block = scope.block
      if (block && !block.isEnabled()) return Blockly.Msg.ENABLE_BLOCK || "Enable Block"
      return Blockly.Msg.DISABLE_BLOCK || "Disable Block"
    },
    preconditionFn(scope) {
      const block = scope.block
      if (!block || block.isInFlyout || block.isShadow?.()) return "hidden"
      if (typeof block.getInheritedDisabled === "function" && block.getInheritedDisabled()) {
        return "disabled"
      }
      return "enabled"
    },
    callback(scope) {
      const block = scope.block
      if (!block) return
      Blockly.Events?.setGroup?.(true)
      block.setEnabled(!block.isEnabled())
      Blockly.Events?.setGroup?.(false)
    },
  })

  register({
    id: "vexDelete",
    scopeType: ScopeType.BLOCK,
    weight: 3,
    displayText: Blockly.Msg.DELETE_BLOCK || "Delete Block",
    preconditionFn(scope) {
      const block = scope.block
      if (!block || block.isShadow?.()) return "hidden"
      if (!block.isDeletable()) return "disabled"
      if (block.type === "when_started") {
        const hats = block.workspace.getAllBlocks(false).filter((b: { type: string }) => b.type === "when_started")
        if (hats.length <= 1) return "disabled"
      }
      return "enabled"
    },
    callback(scope) {
      const block = scope.block
      if (!block || !block.isDeletable()) return
      Blockly.Events?.setGroup?.(true)
      block.dispose(true)
      Blockly.Events?.setGroup?.(false)
    },
  })

  register({
    id: "vexHelp",
    scopeType: ScopeType.BLOCK,
    weight: 4,
    displayText: "Block Help",
    preconditionFn(scope) {
      return scope.block ? "enabled" : "hidden"
    },
    callback(scope) {
      const block = scope.block
      if (!block) return
      const url = typeof block.getHelpUrl === "function" ? block.getHelpUrl() : ""
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer")
        return
      }
      const tip = typeof block.toString === "function" ? block.toString(120) : block.type
      window.alert(tip ? `Help: ${tip}` : "No help is available for this block yet.")
    },
  })

  register({
    id: "vexConvertSwitch",
    scopeType: ScopeType.BLOCK,
    weight: 5,
    displayText: "Convert Block to Switch Block",
    preconditionFn(scope) {
      const block = scope.block
      if (!block || block.isShadow?.()) return "hidden"
      if (HAT_TYPES.has(block.type)) return "disabled"
      if (!block.previousConnection && !block.outputConnection) return "disabled"
      return "enabled"
    },
    callback(scope) {
      const block = scope.block
      if (!block || HAT_TYPES.has(block.type)) return

      const ws = block.workspace
      const xy = block.getRelativeToSurfaceXY()
      const python =
        typeof (window as any).__vexBlockToPython === "function"
          ? String((window as any).__vexBlockToPython(block) || "").trim()
          : `# ${block.type}`

      Blockly.Events?.setGroup?.(true)

      const prevConn = block.previousConnection?.targetConnection ?? null
      const nextBlock = typeof block.getNextBlock === "function" ? block.getNextBlock() : null

      // Detach this block from the stack without deleting its neighbours.
      block.unplug?.(true)
      block.dispose(false)

      const switchBlock = ws.newBlock("switch_code")
      switchBlock.setFieldValue(python || `# python`, "CODE")
      switchBlock.initSvg?.()
      switchBlock.render?.()

      if (prevConn && switchBlock.previousConnection) {
        prevConn.connect(switchBlock.previousConnection)
      } else {
        switchBlock.moveBy(xy.x, xy.y)
      }
      if (nextBlock?.previousConnection && switchBlock.nextConnection) {
        switchBlock.nextConnection.connect(nextBlock.previousConnection)
      }

      Blockly.Events?.setGroup?.(false)
    },
  })

  register({
    id: "vexRead",
    scopeType: ScopeType.BLOCK,
    weight: 6,
    displayText: "Read Block",
    preconditionFn(scope) {
      return scope.block ? "enabled" : "hidden"
    },
    callback(scope) {
      const block = scope.block
      if (!block) return
      const text = (typeof block.toString === "function" ? block.toString(200) : "") || block.type
      speak(text)
    },
  })
}
