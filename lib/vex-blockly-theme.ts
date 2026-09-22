/**
 * VEXcode VR look for the block editor: chunky Zelos geometry, white value
 * fields, and the ▶ marker VEX draws on blocks that take a parameter.
 *
 * Field and arrow colours are finished in `globals.css`, because Blockly has no
 * theme hook for the per-field border rect or the dropdown caret.
 */

/** Right-pointing triangle, sized to sit inside a Zelos statement row. */
const RUN_ARROW_DATA_URI =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="14" viewBox="0 0 12 14">' +
      '<path d="M1.5 1 L11 7 L1.5 13 Z" fill="#0f172a"/>' +
      "</svg>",
  )

export function createVexTheme(Blockly: {
  Theme: { defineTheme: (name: string, def: unknown) => unknown }
  Themes: { Zelos: unknown }
}) {
  return Blockly.Theme.defineTheme("vexcode", {
    base: Blockly.Themes.Zelos,
    componentStyles: {
      workspaceBackgroundColour: "#f7f8fb",
      flyoutBackgroundColour: "#eef2f7",
      flyoutForegroundColour: "#0f172a",
      flyoutOpacity: 1,
      scrollbarColour: "#c3cfdf",
      scrollbarOpacity: 0.8,
      insertionMarkerColour: "#0f172a",
      insertionMarkerOpacity: 0.35,
      cursorColour: "#0f172a",
    },
    fontStyle: {
      family: "Geist, system-ui, -apple-system, 'Segoe UI', sans-serif",
      weight: "700",
      size: 11,
    },
  })
}

/**
 * The marker VEX puts at the end of blocks that run to completion. Decorative:
 * it reads as "this block finishes before the next one starts".
 */
export function vexRunArrowField(Blockly: { FieldImage: new (...args: unknown[]) => unknown }) {
  return new Blockly.FieldImage(RUN_ARROW_DATA_URI, 12, 14, "runs to completion")
}
