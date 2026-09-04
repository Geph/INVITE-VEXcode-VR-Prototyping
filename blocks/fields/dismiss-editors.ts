declare global {
  interface Window {
    Blockly: any
  }
}

/** Close any active Blockly inline editor so it cannot overwrite picker values on Apply. */
export function dismissBlocklyFieldEditors() {
  if (typeof window === "undefined" || !window.Blockly) return
  const Blockly = window.Blockly
  try {
    Blockly.WidgetDiv?.hide?.()
    const hideDropdown = Blockly.DropDownDiv?.hideWithoutAnimation ?? Blockly.DropDownDiv?.hide
    hideDropdown?.call(Blockly.DropDownDiv)
  } catch {
    /* Blockly may not have dropdown API in all builds */
  }
}
