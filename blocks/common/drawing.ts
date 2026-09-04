import type { CommonBlockCategory, PythonGenerators } from "./types"

const PEN_WIDTHS: Record<string, string> = {
  thin: "THIN",
  medium: "MEDIUM",
  thick: "THICK",
}

function defineBlocks(Blockly: any) {
  Blockly.Blocks["move_pen"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("Move Pen")
        .appendField(
          new Blockly.FieldDropdown([
            ["down", "down"],
            ["up", "up"],
          ]),
          "POSITION",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#E67E22")
      this.setTooltip("Move the pen up or down")
    },
  }

  Blockly.Blocks["set_pen_width"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set pen to width")
        .appendField(
          new Blockly.FieldDropdown([
            ["thin", "thin"],
            ["medium", "medium"],
            ["thick", "thick"],
          ]),
          "WIDTH",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#E67E22")
      this.setTooltip("Set the pen width")
    },
  }

  Blockly.Blocks["set_pen_color"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set pen to color")
        .appendField(
          new Blockly.FieldDropdown([
            ["black", "black"],
            ["red", "red"],
            ["blue", "blue"],
            ["green", "green"],
            ["yellow", "yellow"],
            ["purple", "purple"],
            ["orange", "orange"],
          ]),
          "COLOR",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#E67E22")
      this.setTooltip("Set the pen color")
    },
  }
}

const jsGenerators = {
  move_pen: (block: any) => {
    const position = block.getFieldValue("POSITION")
    return `robot.movePen('${position}');\n`
  },
  set_pen_width: (block: any) => {
    const width = block.getFieldValue("WIDTH")
    return `robot.setPenWidth('${width}');\n`
  },
  set_pen_color: (block: any) => {
    const color = block.getFieldValue("COLOR")
    return `robot.setPenColor('${color}');\n`
  },
}

const pythonGenerators: PythonGenerators = {
  statements: {
    move_pen: (block, indent, { constant }) => `${indent}pen.move(${constant(block.getFieldValue("POSITION"))})\n`,
    set_pen_width: (block, indent) =>
      `${indent}pen.set_pen_width(${PEN_WIDTHS[block.getFieldValue("WIDTH")] ?? "MEDIUM"})\n`,
    set_pen_color: (block, indent, { constant }) => `${indent}pen.set_pen_color(${constant(block.getFieldValue("COLOR"))})\n`,
  },
}

export const toolboxEntries = [
  { kind: "block", type: "move_pen" },
  { kind: "block", type: "set_pen_width" },
  { kind: "block", type: "set_pen_color" },
]

export const drawing: CommonBlockCategory = {
  defineBlocks,
  toolboxEntries,
  jsGenerators,
  pythonGenerators,
}
