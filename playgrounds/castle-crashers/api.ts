import type { BlockCategory, PlaygroundApiDeps } from "../types"
import type { Block } from "blockly"
import type { CastleCrashersState } from "./state"
import { normalizeDegrees } from "@/engine"

/** GPS uses physical world coordinates, independent of drivetrain zeroing. */
export function createCastleCrashersApi(deps: PlaygroundApiDeps<CastleCrashersState>) {
  return {
    getPosition(axis: string, unit: string) {
      const mm = axis.toUpperCase() === "X" ? deps.robot.current.xMm : deps.robot.current.yMm
      return unit.toLowerCase() === "inches" ? mm / 25.4 : mm
    },
    getPositionAngle: () => normalizeDegrees(deps.robot.current.headingDeg),
  }
}

export const castleCrashersBlocks: BlockCategory[] = [{
  id: "sensing", label: "Sensing", colour: "#14B8A6",
  toolbox: [{ kind: "block", type: "pg_sensing_position" }, { kind: "block", type: "pg_sensing_position_angle" }],
  define(Blockly) {
    Blockly.Blocks.pg_sensing_position = {
      init(this: Block) {
        this.jsonInit({
          message0: "position %1 in %2",
          args0: [
            { type: "field_dropdown", name: "AXIS", options: [["X", "X"], ["Y", "Y"]] },
            { type: "field_dropdown", name: "UNIT", options: [["mm", "MM"], ["inches", "INCHES"]] },
          ], output: "Number", colour: "#14B8A6", tooltip: "Robot position on the Castle field",
        })
      },
    }
    Blockly.Blocks.pg_sensing_position_angle = {
      init(this: Block) { this.jsonInit({ message0: "position angle in degrees", output: "Number", colour: "#14B8A6", tooltip: "Physical heading: north is 0°, clockwise" }) },
    }
    Blockly.JavaScript.forBlock.pg_sensing_position = (block: Pick<Block, "getFieldValue">) => [
      `robot.getPosition(${JSON.stringify(block.getFieldValue("AXIS"))}, ${JSON.stringify(block.getFieldValue("UNIT"))})`, Blockly.JavaScript.ORDER_FUNCTION_CALL,
    ]
    Blockly.JavaScript.forBlock.pg_sensing_position_angle = () => ["robot.getPositionAngle()", Blockly.JavaScript.ORDER_FUNCTION_CALL]
  },
}]
