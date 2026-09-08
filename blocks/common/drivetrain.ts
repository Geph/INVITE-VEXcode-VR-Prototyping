import { vexRunArrowField } from "@/lib/vex-blockly-theme"
import type { CommonBlockCategory, PythonGenerators } from "./types"

function defineBlocks(Blockly: any) {
  Blockly.Blocks["drive_simple"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("drive")
        .appendField(
          new Blockly.FieldDropdown([
            ["forward", "forward"],
            ["reverse", "reverse"],
          ]),
          "DIRECTION",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Drive the robot forward or reverse")
    },
  }

  Blockly.Blocks["drive_distance"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("drive")
        .appendField(
          new Blockly.FieldDropdown([
            ["forward", "forward"],
            ["reverse", "reverse"],
          ]),
          "DIRECTION",
        )
        .appendField("for")
        .appendField(new Blockly.FieldNumber(200, 0, 5000), "DISTANCE")
        .appendField(
          new Blockly.FieldDropdown(
            [
              ["mm", "mm"],
              ["inches", "inches"],
            ],
            (newValue: string) => {
              if (newValue !== this.getFieldValue("UNIT")) {
                this.setWarningText("Units changed — check your distance value.")
                setTimeout(() => this.setWarningText(null), 4000)
              }
              return newValue
            },
          ),
          "UNIT",
        )
        .appendField(vexRunArrowField(Blockly), "RUN_ARROW")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Drive the robot a specific distance")
    },
  }

  Blockly.Blocks["turn_simple"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("turn")
        .appendField(
          new Blockly.FieldDropdown([
            ["right", "right"],
            ["left", "left"],
          ]),
          "DIRECTION",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Turn the robot right or left")
    },
  }

  Blockly.Blocks["turn_degrees"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("turn")
        .appendField(
          new Blockly.FieldDropdown([
            ["right", "right"],
            ["left", "left"],
          ]),
          "DIRECTION",
        )
        .appendField("for")
        .appendField(new Blockly.FieldNumber(90, 0, 360, 1), "DEGREES")
        .appendField("degrees")
        .appendField(vexRunArrowField(Blockly), "RUN_ARROW")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Turn the robot a specific number of degrees")
    },
  }

  Blockly.Blocks["turn_to_heading"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("turn to heading")
        .appendField(new Blockly.FieldNumber(90, 0, 359, 1), "HEADING")
        .appendField("degrees")
        .appendField(vexRunArrowField(Blockly), "RUN_ARROW")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Turn to a specific heading (compass)")
    },
  }

  Blockly.Blocks["turn_to_rotation"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("turn to rotation")
        .appendField(new Blockly.FieldNumber(90, 0, 360, 1), "ROTATION")
        .appendField("degrees")
        .appendField(vexRunArrowField(Blockly), "RUN_ARROW")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Turn to a specific rotation")
    },
  }

  Blockly.Blocks["stop_driving"] = {
    init: function () {
      this.appendDummyInput().appendField("stop driving")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Stop the robot")
    },
  }

  Blockly.Blocks["set_drive_velocity"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set drive velocity to")
        .appendField(new Blockly.FieldNumber(50, 0, 100), "VELOCITY")
        .appendField("%")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#5A9FE2")
      this.setTooltip("Set the drive velocity")
    },
  }

  Blockly.Blocks["set_turn_velocity"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set turn velocity to")
        .appendField(new Blockly.FieldNumber(50, 0, 100), "VELOCITY")
        .appendField("%")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#5A9FE2")
      this.setTooltip("Set the turn velocity")
    },
  }

  Blockly.Blocks["set_drive_heading"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set drive heading to")
        .appendField(new Blockly.FieldNumber(0, 0, 359, 1), "HEADING")
        .appendField("degrees")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#5A9FE2")
      this.setTooltip("Set the drive heading")
    },
  }

  Blockly.Blocks["set_drive_rotation"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set drive rotation to")
        .appendField(new Blockly.FieldNumber(0, 0, 360, 1), "ROTATION")
        .appendField("degrees")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#5A9FE2")
      this.setTooltip("Set the drive rotation")
    },
  }

  Blockly.Blocks["drive_is_done"] = {
    init: function () {
      this.appendDummyInput().appendField("drive is done?")
      this.setOutput(true, "Boolean")
      this.setColour("#5A9FE2")
      this.setTooltip("True when the last drive finished, including if the rover was blocked")
    },
  }

  Blockly.Blocks["set_drive_timeout"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set drive timeout to")
        .appendField(new Blockly.FieldNumber(1, 0), "TIMEOUT")
        .appendField("seconds")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#5A9FE2")
      this.setTooltip("Set the drive timeout")
    },
  }
}

const jsGenerators = {
  drive_simple: (block: any) => {
    const direction = block.getFieldValue("DIRECTION")
    return `await robot.drive('${direction}');\n`
  },
  drive_distance: (block: any) => {
    const direction = block.getFieldValue("DIRECTION")
    const distance = Number(block.getFieldValue("DISTANCE")) || 0
    const unit = block.getFieldValue("UNIT")
    return `await robot.drive('${direction}', ${distance}, '${unit}');\n`
  },
  turn_simple: (block: any) => {
    const direction = block.getFieldValue("DIRECTION")
    return `await robot.turn('${direction}');\n`
  },
  turn_degrees: (block: any) => {
    const direction = block.getFieldValue("DIRECTION")
    const degrees = block.getFieldValue("DEGREES")
    return `await robot.turn('${direction}', ${degrees});\n`
  },
  turn_to_heading: (block: any) => {
    const heading = block.getFieldValue("HEADING")
    return `await robot.turnToHeading(${heading});\n`
  },
  turn_to_rotation: (block: any) => {
    const rotation = block.getFieldValue("ROTATION")
    return `await robot.turnToRotation(${rotation});\n`
  },
  stop_driving: () => `robot.stopDriving();\n`,
  set_drive_velocity: (block: any) => {
    const velocity = block.getFieldValue("VELOCITY")
    return `robot.setDriveVelocity(${velocity});\n`
  },
  set_turn_velocity: (block: any) => {
    const velocity = block.getFieldValue("VELOCITY")
    return `robot.setTurnVelocity(${velocity});\n`
  },
  set_drive_heading: (block: any) => {
    const heading = block.getFieldValue("HEADING")
    return `robot.setDriveHeading(${heading});\n`
  },
  set_drive_rotation: (block: any) => {
    const rotation = block.getFieldValue("ROTATION")
    return `robot.setDriveRotation(${rotation});\n`
  },
  set_drive_timeout: (block: any) => {
    const timeout = block.getFieldValue("TIMEOUT")
    return `await robot.setDriveTimeout(${timeout});\n`
  },
  drive_is_done: () => ["robot.driveIsDone()", 99],
}

const pythonGenerators: PythonGenerators = {
  expressions: {
    drive_is_done: () => "drivetrain.is_done()",
  },
  statements: {
    drive_simple: (block, indent, { constant }) =>
      `${indent}drivetrain.drive(${constant(block.getFieldValue("DIRECTION"))})\n`,
    drive_distance: (block, indent, { constant, pyNumber }) =>
      `${indent}drivetrain.drive_for(${constant(block.getFieldValue("DIRECTION"))}, ${pyNumber(block.getFieldValue("DISTANCE"), 200)}, ${constant(block.getFieldValue("UNIT"))})\n`,
    turn_simple: (block, indent, { constant }) =>
      `${indent}drivetrain.turn(${constant(block.getFieldValue("DIRECTION"))})\n`,
    turn_degrees: (block, indent, { constant, pyNumber }) =>
      `${indent}drivetrain.turn_for(${constant(block.getFieldValue("DIRECTION"))}, ${pyNumber(block.getFieldValue("DEGREES"), 90)}, DEGREES)\n`,
    turn_to_heading: (block, indent, { pyNumber }) =>
      `${indent}drivetrain.turn_to_heading(${pyNumber(block.getFieldValue("HEADING"))}, DEGREES)\n`,
    turn_to_rotation: (block, indent, { pyNumber }) =>
      `${indent}drivetrain.turn_to_rotation(${pyNumber(block.getFieldValue("ROTATION"))}, DEGREES)\n`,
    stop_driving: (_block, indent) => `${indent}drivetrain.stop()\n`,
    set_drive_velocity: (block, indent, { pyNumber }) =>
      `${indent}drivetrain.set_drive_velocity(${pyNumber(block.getFieldValue("VELOCITY"), 50)}, PERCENT)\n`,
    set_turn_velocity: (block, indent, { pyNumber }) =>
      `${indent}drivetrain.set_turn_velocity(${pyNumber(block.getFieldValue("VELOCITY"), 50)}, PERCENT)\n`,
    set_drive_heading: (block, indent, { pyNumber }) =>
      `${indent}drivetrain.set_heading(${pyNumber(block.getFieldValue("HEADING"))}, DEGREES)\n`,
    set_drive_rotation: (block, indent, { pyNumber }) =>
      `${indent}drivetrain.set_rotation(${pyNumber(block.getFieldValue("ROTATION"))}, DEGREES)\n`,
    set_drive_timeout: (block, indent, { pyNumber }) =>
      `${indent}drivetrain.set_timeout(${pyNumber(block.getFieldValue("TIMEOUT"), 1)}, SECONDS)\n`,
  },
}

export const toolboxEntries = [
  { kind: "block", type: "drive_simple" },
  { kind: "block", type: "drive_distance" },
  { kind: "block", type: "turn_simple" },
  { kind: "block", type: "turn_degrees" },
  { kind: "block", type: "turn_to_heading" },
  { kind: "block", type: "turn_to_rotation" },
  { kind: "block", type: "stop_driving" },
  { kind: "block", type: "drive_is_done" },
  { kind: "block", type: "set_drive_velocity" },
  { kind: "block", type: "set_turn_velocity" },
  { kind: "block", type: "set_drive_heading" },
  { kind: "block", type: "set_drive_rotation" },
  { kind: "block", type: "set_drive_timeout" },
]

export const drivetrain: CommonBlockCategory = {
  defineBlocks,
  toolboxEntries,
  jsGenerators,
  pythonGenerators,
}
