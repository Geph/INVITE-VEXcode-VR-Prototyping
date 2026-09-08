import { vexRunArrowField } from "@/lib/vex-blockly-theme"
import { attachAndDontWaitField, isAndDontWait, syncAndDontWaitLabel } from "./anddontwait"
import type { CommonBlockCategory, PythonGenerators } from "./types"

function defineBlocks(Blockly: any) {
  Blockly.Blocks["pg_drivetrain_drive"] = {
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

  Blockly.Blocks["pg_drivetrain_drive_for"] = {
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
      attachAndDontWaitField(this, Blockly)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Drive the robot a specific distance")
      this.onchange = function () {
        syncAndDontWaitLabel(this)
      }
    },
  }

  Blockly.Blocks["pg_drivetrain_turn"] = {
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

  Blockly.Blocks["pg_drivetrain_turn_for"] = {
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
      attachAndDontWaitField(this, Blockly)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Turn the robot a specific number of degrees")
      this.onchange = function () {
        syncAndDontWaitLabel(this)
      }
    },
  }

  Blockly.Blocks["pg_drivetrain_turn_to_heading"] = {
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

  Blockly.Blocks["pg_drivetrain_turn_to_rotation"] = {
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

  Blockly.Blocks["pg_drivetrain_stop_driving"] = {
    init: function () {
      this.appendDummyInput().appendField("stop driving")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#4A90E2")
      this.setTooltip("Stop the robot")
    },
  }

  Blockly.Blocks["pg_drivetrain_set_drive_velocity"] = {
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

  Blockly.Blocks["pg_drivetrain_set_turn_velocity"] = {
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

  Blockly.Blocks["pg_drivetrain_set_heading"] = {
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

  Blockly.Blocks["pg_drivetrain_set_rotation"] = {
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

  Blockly.Blocks["pg_sensing_drive_is_done"] = {
    init: function () {
      this.appendDummyInput().appendField("drive is done?")
      this.setOutput(true, "Boolean")
      this.setColour("#5A9FE2")
      this.setTooltip("True when the last drive finished, including if the rover was blocked")
    },
  }

  Blockly.Blocks["pg_drivetrain_set_timeout"] = {
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
  pg_drivetrain_drive: (block: any) => {
    const direction = block.getFieldValue("DIRECTION")
    return `await robot.drive('${direction}');\n`
  },
  pg_drivetrain_drive_for: (block: any) => {
    const direction = block.getFieldValue("DIRECTION")
    const distance = Number(block.getFieldValue("DISTANCE")) || 0
    const unit = block.getFieldValue("UNIT")
    const waitArg = isAndDontWait(block) ? ", false" : ""
    const call = `robot.drive('${direction}', ${distance}, '${unit}'${waitArg})`
    return isAndDontWait(block) ? `${call};\n` : `await ${call};\n`
  },
  pg_drivetrain_turn: (block: any) => {
    const direction = block.getFieldValue("DIRECTION")
    return `await robot.turn('${direction}');\n`
  },
  pg_drivetrain_turn_for: (block: any) => {
    const direction = block.getFieldValue("DIRECTION")
    const degrees = block.getFieldValue("DEGREES")
    const waitArg = isAndDontWait(block) ? ", false" : ""
    const call = `robot.turn('${direction}', ${degrees}${waitArg})`
    return isAndDontWait(block) ? `${call};\n` : `await ${call};\n`
  },
  pg_drivetrain_turn_to_heading: (block: any) => {
    const heading = block.getFieldValue("HEADING")
    return `await robot.turnToHeading(${heading});\n`
  },
  pg_drivetrain_turn_to_rotation: (block: any) => {
    const rotation = block.getFieldValue("ROTATION")
    return `await robot.turnToRotation(${rotation});\n`
  },
  pg_drivetrain_stop_driving: () => `robot.stopDriving();\n`,
  pg_drivetrain_set_drive_velocity: (block: any) => {
    const velocity = block.getFieldValue("VELOCITY")
    return `robot.setDriveVelocity(${velocity});\n`
  },
  pg_drivetrain_set_turn_velocity: (block: any) => {
    const velocity = block.getFieldValue("VELOCITY")
    return `robot.setTurnVelocity(${velocity});\n`
  },
  pg_drivetrain_set_heading: (block: any) => {
    const heading = block.getFieldValue("HEADING")
    return `robot.setDriveHeading(${heading});\n`
  },
  pg_drivetrain_set_rotation: (block: any) => {
    const rotation = block.getFieldValue("ROTATION")
    return `robot.setDriveRotation(${rotation});\n`
  },
  pg_drivetrain_set_timeout: (block: any) => {
    const timeout = block.getFieldValue("TIMEOUT")
    return `await robot.setDriveTimeout(${timeout});\n`
  },
  pg_sensing_drive_is_done: () => ["robot.driveIsDone()", 99],
}

const pythonGenerators: PythonGenerators = {
  expressions: {
    pg_sensing_drive_is_done: () => "drivetrain.is_done()",
  },
  statements: {
    pg_drivetrain_drive: (block, indent, { constant }) =>
      `${indent}drivetrain.drive(${constant(block.getFieldValue("DIRECTION"))})\n`,
    pg_drivetrain_drive_for: (block, indent, { constant, pyNumber }) => {
      const wait = isAndDontWait(block) ? ", wait=False" : ""
      return `${indent}drivetrain.drive_for(${constant(block.getFieldValue("DIRECTION"))}, ${pyNumber(block.getFieldValue("DISTANCE"), 200)}, ${constant(block.getFieldValue("UNIT"))}${wait})\n`
    },
    pg_drivetrain_turn: (block, indent, { constant }) =>
      `${indent}drivetrain.turn(${constant(block.getFieldValue("DIRECTION"))})\n`,
    pg_drivetrain_turn_for: (block, indent, { constant, pyNumber }) => {
      const wait = isAndDontWait(block) ? ", wait=False" : ""
      return `${indent}drivetrain.turn_for(${constant(block.getFieldValue("DIRECTION"))}, ${pyNumber(block.getFieldValue("DEGREES"), 90)}, DEGREES${wait})\n`
    },
    pg_drivetrain_turn_to_heading: (block, indent, { pyNumber }) =>
      `${indent}drivetrain.turn_to_heading(${pyNumber(block.getFieldValue("HEADING"))}, DEGREES)\n`,
    pg_drivetrain_turn_to_rotation: (block, indent, { pyNumber }) =>
      `${indent}drivetrain.turn_to_rotation(${pyNumber(block.getFieldValue("ROTATION"))}, DEGREES)\n`,
    pg_drivetrain_stop_driving: (_block, indent) => `${indent}drivetrain.stop()\n`,
    pg_drivetrain_set_drive_velocity: (block, indent, { pyNumber }) =>
      `${indent}drivetrain.set_drive_velocity(${pyNumber(block.getFieldValue("VELOCITY"), 50)}, PERCENT)\n`,
    pg_drivetrain_set_turn_velocity: (block, indent, { pyNumber }) =>
      `${indent}drivetrain.set_turn_velocity(${pyNumber(block.getFieldValue("VELOCITY"), 50)}, PERCENT)\n`,
    pg_drivetrain_set_heading: (block, indent, { pyNumber }) =>
      `${indent}drivetrain.set_heading(${pyNumber(block.getFieldValue("HEADING"))}, DEGREES)\n`,
    pg_drivetrain_set_rotation: (block, indent, { pyNumber }) =>
      `${indent}drivetrain.set_rotation(${pyNumber(block.getFieldValue("ROTATION"))}, DEGREES)\n`,
    pg_drivetrain_set_timeout: (block, indent, { pyNumber }) =>
      `${indent}drivetrain.set_timeout(${pyNumber(block.getFieldValue("TIMEOUT"), 1)}, SECONDS)\n`,
  },
}

export const toolboxEntries = [
  { kind: "block", type: "pg_drivetrain_drive" },
  { kind: "block", type: "pg_drivetrain_drive_for" },
  { kind: "block", type: "pg_drivetrain_turn" },
  { kind: "block", type: "pg_drivetrain_turn_for" },
  { kind: "block", type: "pg_drivetrain_turn_to_heading" },
  { kind: "block", type: "pg_drivetrain_turn_to_rotation" },
  { kind: "block", type: "pg_drivetrain_stop_driving" },
  { kind: "block", type: "pg_sensing_drive_is_done" },
  { kind: "block", type: "pg_drivetrain_set_drive_velocity" },
  { kind: "block", type: "pg_drivetrain_set_turn_velocity" },
  { kind: "block", type: "pg_drivetrain_set_heading" },
  { kind: "block", type: "pg_drivetrain_set_rotation" },
  { kind: "block", type: "pg_drivetrain_set_timeout" },
]

export const drivetrain: CommonBlockCategory = {
  defineBlocks,
  toolboxEntries,
  jsGenerators,
  pythonGenerators,
}
