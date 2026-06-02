/** Keep Blockly inline fields (text/number inputs) editable in our layout. */

const WIDGET_SELECTOR = ".blocklyWidgetDiv, .blocklyDropDownDiv"

function bindWidgetEvents(el: HTMLElement) {
  if (el.dataset.vexWidgetBound === "1") return
  el.dataset.vexWidgetBound = "1"
  const stop = (e: Event) => e.stopPropagation()
  el.addEventListener("mousedown", stop, true)
  el.addEventListener("pointerdown", stop, true)
  el.addEventListener("click", stop, true)
  el.addEventListener("keydown", stop, true)
  el.addEventListener("keyup", stop, true)
}

export function ensureBlocklyWidgetDivReady(): void {
  if (typeof document === "undefined") return

  document.querySelectorAll<HTMLElement>(WIDGET_SELECTOR).forEach((el) => {
    if (el.parentElement !== document.body) {
      document.body.appendChild(el)
    }
    el.style.position = "fixed"
    el.style.pointerEvents = "auto"
    el.style.zIndex = "10000"
    bindWidgetEvents(el)
  })
}

export function isBlocklyFieldEditorTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest(WIDGET_SELECTOR + ", .blocklyHtmlInput"))
}

export function isTypingInFormField(): boolean {
  if (typeof document === "undefined") return false
  const active = document.activeElement
  if (!active) return false
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return true
  if (active.closest(WIDGET_SELECTOR)) return true
  return active.getAttribute("contenteditable") === "true"
}
