/**
 * Keep Blockly field editors (dropdowns, number/text inputs) usable in our layout.
 *
 * Blockly 13 mounts `.blocklyDropDownDiv` / `.blocklyWidgetDiv` under the workspace
 * injection/focus root and hides them via a popover focus-loss handler. Reparenting
 * them to `document.body` or capturing pointer events on the container breaks open,
 * select, and type interactions.
 */

export const VEX_WIDGET_NODE_SELECTOR = ".blocklyWidgetDiv, .blocklyDropDownDiv"

function bindWidgetEvents(el: HTMLElement) {
  if (el.dataset.vexWidgetBound === "1") return
  el.dataset.vexWidgetBound = "1"
  // Bubble phase only: children (menu items, inputs) must receive the event first.
  // Stopping in capture on this node prevented dropdown selection entirely.
  const stop = (e: Event) => e.stopPropagation()
  el.addEventListener("mousedown", stop)
  el.addEventListener("pointerdown", stop)
  el.addEventListener("touchstart", stop)
}

export function ensureBlocklyWidgetDivReady(): void {
  if (typeof document === "undefined") return

  document.querySelectorAll<HTMLElement>(VEX_WIDGET_NODE_SELECTOR).forEach((el) => {
    // Do not move these nodes. Blockly appends them to the injection/focus root
    // on show; yanking them to <body> trips focus-loss and closes the editor.
    el.style.pointerEvents = "auto"
    el.style.position = "" // undo older `position: fixed` overrides if still inline

    // DropDownDiv is shown via visibility/opacity, not display. A leftover
    // `display: none` from old picker code permanently blocks menus.
    if (el.classList.contains("blocklyDropDownDiv") && el.style.display === "none") {
      el.style.display = ""
    }

    bindWidgetEvents(el)
  })
}

export function isBlocklyFieldEditorTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      `${VEX_WIDGET_NODE_SELECTOR}, .blocklyHtmlInput, .blocklyMenu, .blocklyDropdownMenu`,
    ),
  )
}

export function isTypingInFormField(): boolean {
  if (typeof document === "undefined") return false
  const active = document.activeElement
  if (!active) return false
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return true
  if (active.closest(`${VEX_WIDGET_NODE_SELECTOR}, .blocklyMenu`)) return true
  return active.getAttribute("contenteditable") === "true"
}
