/** VEX motion blocks store this as a field with values "true" / "false". */
export const AND_DONT_WAIT_FIELD = "anddontwait_mutator"

export const AND_DONT_WAIT_BLOCK_TYPES = [
  "pg_drivetrain_drive_for",
  "pg_drivetrain_turn_for",
] as const

export function isAndDontWait(block: { getFieldValue: (name: string) => string }): boolean {
  return block.getFieldValue(AND_DONT_WAIT_FIELD) === "true"
}

export function attachAndDontWaitField(block: {
  appendDummyInput: (name?: string) => { appendField: (field: unknown, name?: string) => unknown }
  getInput: (name: string) => { setVisible?: (visible: boolean) => void } | null
}, Blockly: { FieldLabelSerializable: new (text: string) => unknown }): void {
  block.appendDummyInput("ANDDONTWAIT").appendField(new Blockly.FieldLabelSerializable("false"), AND_DONT_WAIT_FIELD)
  block.getInput("ANDDONTWAIT")?.setVisible?.(false)
}

export function syncAndDontWaitLabel(block: {
  getFieldValue: (name: string) => string
  getInput: (name: string) => unknown
  appendDummyInput: (name?: string) => { appendField: (text: string) => unknown }
  removeInput: (name: string) => void
}): void {
  const on = isAndDontWait(block)
  const existing = block.getInput("ANDDONTWAIT_LABEL")
  if (on && !existing) {
    block.appendDummyInput("ANDDONTWAIT_LABEL").appendField("and don't wait")
  } else if (!on && existing) {
    block.removeInput("ANDDONTWAIT_LABEL")
  }
}

export function setAndDontWait(
  block: {
    setFieldValue: (value: string, name: string) => void
    getFieldValue: (name: string) => string
    getInput: (name: string) => unknown
    appendDummyInput: (name?: string) => { appendField: (text: string) => unknown }
    removeInput: (name: string) => void
  },
  value: boolean,
): void {
  block.setFieldValue(value ? "true" : "false", AND_DONT_WAIT_FIELD)
  syncAndDontWaitLabel(block)
}
