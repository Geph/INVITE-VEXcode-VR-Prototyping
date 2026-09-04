import { dismissBlocklyFieldEditors } from "@/blocks/fields"

/** Push a new number into a Blockly field and refresh the workspace SVG immediately. */
export function updateBlocklyNumberField(
  block: {
    id: string
    setFieldValue: (value: string, name: string) => void
    getFieldValue: (name: string) => string
    getField: (name: string) => {
      setValue: (value: string) => void
      getSvgRoot?: () => SVGElement | null
    } | null
    render?: () => void
  },
  workspace: { render: () => void },
  fieldName: string,
  value: number,
) {
  dismissBlocklyFieldEditors()

  const text = String(Math.round(value))
  const oldText = String(block.getFieldValue(fieldName))
  const Blockly = window.Blockly

  if (Blockly?.Events?.isEnabled?.() && oldText !== text) {
    Blockly.Events.fire(new Blockly.Events.BlockChange(block, "field", fieldName, oldText, text))
  }

  block.setFieldValue(text, fieldName)
  const field = block.getField(fieldName)
  if (field) {
    field.setValue(text)
    const textEl = field.getSvgRoot?.()?.querySelector("text")
    if (textEl) {
      textEl.textContent = text
    }
  }

  block.render?.()
  workspace.render()
}
