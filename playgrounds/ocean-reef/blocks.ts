import type { PythonGenerators } from "@/blocks/common/types"
import type { BlockCategory } from "../types"

function defineMagnetBlocks(Blockly: any) {
  Blockly.Blocks["pg_magnet_energize"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("energize")
        .appendField(
          new Blockly.FieldDropdown([
            ["Magnet", "magnet"],
            ["Electromagnet", "electromagnet"],
          ]),
          "DEVICE",
        )
        .appendField("to")
        .appendField(
          new Blockly.FieldDropdown([
            ["boost", "boost"],
            ["drop", "drop"],
            ["off", "off"],
          ]),
          "MODE",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#9B59B6")
      this.setTooltip("Energize the magnet to boost, drop, or turn off")
    },
  }

  Blockly.JavaScript.forBlock["pg_magnet_energize"] = (block: any) => {
    const device = block.getFieldValue("DEVICE")
    const mode = block.getFieldValue("MODE")
    return `robot.energize('${device}', '${mode}');\n`
  }
}

function defineSensingBlocks(Blockly: any) {
  Blockly.Blocks["pg_sensing_bumper_pressed"] = {
    init: function () {
      this.appendDummyInput()
        .appendField(
          new Blockly.FieldDropdown([
            ["LeftBumper", "left"],
            ["RightBumper", "right"],
          ]),
          "BUMPER",
        )
        .appendField("pressed?")
      this.setOutput(true, "Boolean")
      this.setColour("#14B8A6")
      this.setTooltip("Check if bumper is pressed")
    },
  }
  Blockly.JavaScript.forBlock["pg_sensing_bumper_pressed"] = (block: any) => {
    const bumper = block.getFieldValue("BUMPER")
    return [`robot.bumperPressed('${bumper}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["pg_events_when_bumper"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("when")
        .appendField(
          new Blockly.FieldDropdown([
            ["LeftBumper", "left"],
            ["RightBumper", "right"],
          ]),
          "BUMPER",
        )
        .appendField(
          new Blockly.FieldDropdown([
            ["pressed", "pressed"],
            ["released", "released"],
          ]),
          "STATE",
        )
      this.appendStatementInput("DO").setCheck(null)
      this.setColour("#F4D03F")
      this.setTooltip("Runs the blocks inside whenever the bumper changes state")
    },
  }
  Blockly.JavaScript.forBlock["pg_events_when_bumper"] = () => ""

  Blockly.Blocks["pg_sensing_distance_found"] = {
    init: function () {
      this.appendDummyInput()
        .appendField(
          new Blockly.FieldDropdown([
            ["FrontDistance", "front"],
            ["DownDistance", "down"],
          ]),
          "SENSOR",
        )
        .appendField("found an object?")
      this.setOutput(true, "Boolean")
      this.setColour("#14B8A6")
      this.setTooltip("Check if distance sensor found an object")
    },
  }
  Blockly.JavaScript.forBlock["pg_sensing_distance_found"] = (block: any) => {
    const sensor = block.getFieldValue("SENSOR")
    return [`robot.distanceFoundObject('${sensor}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["pg_sensing_distance"] = {
    init: function () {
      this.appendDummyInput()
        .appendField(
          new Blockly.FieldDropdown([
            ["FrontDistance", "front"],
            ["DownDistance", "down"],
          ]),
          "SENSOR",
        )
        .appendField("in")
        .appendField(
          new Blockly.FieldDropdown([
            ["mm", "mm"],
            ["inches", "inches"],
          ]),
          "UNIT",
        )
      this.setOutput(true, "Number")
      this.setColour("#14B8A6")
      this.setTooltip("Get distance sensor reading")
    },
  }
  Blockly.JavaScript.forBlock["pg_sensing_distance"] = (block: any) => {
    const sensor = block.getFieldValue("SENSOR")
    const unit = block.getFieldValue("UNIT")
    return [`robot.getDistance('${sensor}', '${unit}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["pg_sensing_eye_near"] = {
    init: function () {
      this.appendDummyInput()
        .appendField(
          new Blockly.FieldDropdown([
            ["FrontEye", "front"],
            ["DownEye", "down"],
          ]),
          "SENSOR",
        )
        .appendField("is near object?")
      this.setOutput(true, "Boolean")
      this.setColour("#14B8A6")
      this.setTooltip("Check if eye sensor is near an object")
    },
  }
  Blockly.JavaScript.forBlock["pg_sensing_eye_near"] = (block: any) => {
    const sensor = block.getFieldValue("SENSOR")
    return [`robot.eyeIsNear('${sensor}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["pg_sensing_eye_color"] = {
    init: function () {
      this.appendDummyInput()
        .appendField(
          new Blockly.FieldDropdown([
            ["FrontEye", "front"],
            ["DownEye", "down"],
          ]),
          "SENSOR",
        )
        .appendField("detects")
        .appendField(
          new Blockly.FieldDropdown([
            ["red", "red"],
            ["green", "green"],
            ["blue", "blue"],
            ["yellow", "yellow"],
            ["orange", "orange"],
            ["purple", "purple"],
          ]),
          "COLOR",
        )
        .appendField("?")
      this.setOutput(true, "Boolean")
      this.setColour("#14B8A6")
      this.setTooltip("Check if eye sensor detects a color")
    },
  }
  Blockly.JavaScript.forBlock["pg_sensing_eye_color"] = (block: any) => {
    const sensor = block.getFieldValue("SENSOR")
    const color = block.getFieldValue("COLOR")
    return [`robot.eyeDetectsColor('${sensor}', '${color}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["pg_sensing_eye_brightness"] = {
    init: function () {
      this.appendDummyInput()
        .appendField(
          new Blockly.FieldDropdown([
            ["FrontEye", "front"],
            ["DownEye", "down"],
          ]),
          "SENSOR",
        )
        .appendField("brightness in %")
      this.setOutput(true, "Number")
      this.setColour("#14B8A6")
      this.setTooltip("Get eye sensor brightness percentage")
    },
  }
  Blockly.JavaScript.forBlock["pg_sensing_eye_brightness"] = (block: any) => {
    const sensor = block.getFieldValue("SENSOR")
    return [`robot.eyeBrightness('${sensor}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["pg_sensing_position"] = {
    init: function () {
      this.appendDummyInput().appendField("position")
      this.appendDummyInput()
        .appendField(
          new Blockly.FieldDropdown([
            ["X", "X"],
            ["Y", "Y"],
          ]),
          "AXIS",
        )
        .appendField("in")
        .appendField(
          new Blockly.FieldDropdown([
            ["mm", "MM"],
            ["inches", "INCHES"],
          ]),
          "UNIT",
        )
      this.setOutput(true, "Number")
      this.setColour("#14B8A6")
      this.setTooltip("Get robot position")
    },
  }
  Blockly.JavaScript.forBlock["pg_sensing_position"] = (block: any) => {
    const axis = block.getFieldValue("AXIS")
    const unit = block.getFieldValue("UNIT")
    return [`robot.getPosition('${axis}', '${unit}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["pg_sensing_position_angle"] = {
    init: function () {
      this.appendDummyInput().appendField("position angle in degrees")
      this.setOutput(true, "Number")
      this.setColour("#14B8A6")
      this.setTooltip("Get robot angle")
    },
  }
  Blockly.JavaScript.forBlock["pg_sensing_position_angle"] = () => {
    return [`robot.getPositionAngle()`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }
}

export const oceanReefPythonGenerators: PythonGenerators = {
  expressions: {
    pg_sensing_bumper_pressed: (block) => `${block.getFieldValue("BUMPER")}_bumper.pressed()`,
    pg_sensing_distance_found: (block) => `${block.getFieldValue("SENSOR")}_distance.found_object()`,
    pg_sensing_distance: (block, { constant }) =>
      `${block.getFieldValue("SENSOR")}_distance.get_distance(${constant(block.getFieldValue("UNIT"))})`,
    pg_sensing_eye_near: (block) => `${block.getFieldValue("SENSOR")}_eye.near_object()`,
    pg_sensing_eye_color: (block, { constant }) =>
      `${block.getFieldValue("SENSOR")}_eye.detect(${constant(block.getFieldValue("COLOR"))})`,
    pg_sensing_eye_brightness: (block) => `${block.getFieldValue("SENSOR")}_eye.brightness(PERCENT)`,
    pg_sensing_position: (block, { constant }) =>
      `location.position(${constant(block.getFieldValue("AXIS"))}, ${constant(block.getFieldValue("UNIT"))})`,
    pg_sensing_position_angle: () => "location.position_angle(DEGREES)",
  },
  statements: {
    pg_magnet_energize: (block, indent, { constant }) =>
      `${indent}magnet.energize(${constant(block.getFieldValue("MODE"))})\n`,
  },
}

export const oceanReefBlocks: BlockCategory[] = [
  {
    id: "magnet",
    label: "Magnet",
    colour: "#9B59B6",
    define: defineMagnetBlocks,
    toolbox: [{ kind: "block", type: "pg_magnet_energize" }],
  },
  {
    id: "sensing",
    label: "Sensing",
    colour: "#14B8A6",
    define: defineSensingBlocks,
    toolbox: [
      { kind: "block", type: "pg_sensing_bumper_pressed" },
      { kind: "block", type: "pg_events_when_bumper" },
      { kind: "block", type: "pg_sensing_distance_found" },
      { kind: "block", type: "pg_sensing_distance" },
      { kind: "block", type: "pg_sensing_eye_near" },
      { kind: "block", type: "pg_sensing_eye_color" },
      { kind: "block", type: "pg_sensing_eye_brightness" },
      { kind: "block", type: "pg_sensing_position" },
      { kind: "block", type: "pg_sensing_position_angle" },
    ],
  },
]
