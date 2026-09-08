import { describe, expect, it } from "vitest"
import { generatePythonProgram } from "@/lib/python-generator"
import type { PyBlock } from "@/blocks/generators/python-types"

function block(
  type: string,
  options: { fields?: Record<string, string>; inputs?: Record<string, PyBlock | null>; next?: PyBlock | null } = {},
): PyBlock {
  const node: PyBlock = {
    type,
    getFieldValue(name) {
      return options.fields?.[name] ?? ""
    },
    getInputTargetBlock(name) {
      return options.inputs?.[name] ?? null
    },
    getNextBlock() {
      return options.next ?? null
    },
  }
  return node
}

function workspace(...blocks: PyBlock[]) {
  return { getAllBlocks: () => blocks }
}

const HEADER = "# VEXcode VR Python\nfrom vexcode import *\nimport math\nimport random\n\n"

describe("generatePythonProgram characterisation", () => {
  it("emits the empty stub when there is no pg_events_when_started hat", () => {
    expect(generatePythonProgram(null)).toBe(
      "# No code yet\n# Add blocks under when started to see Python code",
    )
    expect(generatePythonProgram(workspace(block("pg_drivetrain_drive_for")))).toBe(
      "# No code yet\n# Add blocks under when started to see Python code",
    )
  })

  it("emits pass for a bare pg_events_when_started hat", () => {
    expect(generatePythonProgram(workspace(block("pg_events_when_started")))).toBe(
      `${HEADER}def main():\n    pass\n\nvr_thread(main)\n`,
    )
  })

  it("emits one statement from each common category plus Ocean Reef sensing", () => {
    const stack = block("pg_events_when_started", {
      next: block("pg_drivetrain_drive_for", {
        fields: { DIRECTION: "forward", DISTANCE: "200", UNIT: "mm" },
        next: block("pg_control_wait", {
          fields: { SECONDS: "1" },
          next: block("pg_control_if_then", {
            inputs: {
              CONDITION: block("pg_operator_comparison", {
                fields: { OP: "EQ" },
                inputs: {
                  A: block("math_number", { fields: { NUM: "1" } }),
                  B: block("math_number", { fields: { NUM: "1" } }),
                },
              }),
              DO: block("pg_looks_set_pen_width", {
                fields: { WIDTH: "medium" },
                next: block("pg_looks_print", {
                  inputs: { TEXT: block("pg_operator_string", { fields: { TEXT: "hi" } }) },
                }),
              }),
            },
            next: block("pg_magnet_energize", {
              fields: { DEVICE: "magnet", MODE: "boost" },
            }),
          }),
        }),
      }),
    })
    expect(generatePythonProgram(workspace(stack))).toBe(
      `${HEADER}def main():\n` +
        `    drivetrain.drive_for(FORWARD, 200, MM)\n` +
        `    wait(1, SECONDS)\n` +
        `    if (1 == 1):\n` +
        `        pen.set_pen_width(MEDIUM)\n` +
        `        brain.print("hi")\n` +
        `    magnet.energize(BOOST)\n` +
        `\nvr_thread(main)\n`,
    )
  })

  it("emits Python for all eight Rover Rescue sensing blocks and drive_is_done", () => {
    const stack = block("pg_events_when_started", {
      next: block("pg_control_if_then", {
        inputs: {
          CONDITION: block("pg_operator_and_or", {
            fields: { OP: "AND" },
            inputs: {
              A: block("pg_sensing_ai_sees", { fields: { KIND: "minerals" } }),
              B: block("pg_sensing_ai_smells", { fields: { KIND: "enemy" } }),
            },
          }),
          DO: block("pg_looks_print", {
            inputs: {
              TEXT: block("pg_sensing_ai_sees_distance", { fields: { KIND: "base", UNIT: "mm" } }),
            },
            next: block("pg_looks_print", {
              inputs: {
                TEXT: block("pg_sensing_ai_sees_direction", { fields: { KIND: "minerals" } }),
              },
              next: block("pg_looks_print", {
                inputs: {
                  TEXT: block("pg_sensing_ai_sees_location", { fields: { KIND: "enemy", AXIS: "X", UNIT: "mm" } }),
                },
                next: block("pg_looks_print", {
                  inputs: { TEXT: block("pg_sensing_distance_found") },
                  next: block("pg_looks_print", {
                    inputs: { TEXT: block("pg_sensing_object_distance", { fields: { UNIT: "mm" } }) },
                    next: block("pg_looks_print", {
                      inputs: { TEXT: block("pg_sensing_drive_is_done") },
                    }),
                  }),
                }),
              }),
            }),
          }),
        },
      }),
    })
    expect(generatePythonProgram(workspace(stack))).toBe(
      `${HEADER}def main():\n` +
        `    if (rover.sees(MINERALS) and rover.detects(ENEMY)):\n` +
        `        brain.print(rover.get_distance(BASE, MM))\n` +
        `        brain.print(rover.angle(MINERALS))\n` +
        `        brain.print(rover.location(ENEMY, X, MM))\n` +
        `        brain.print(distance.found_object())\n` +
        `        brain.print(distance.get_distance(MM))\n` +
        `        brain.print(drivetrain.is_done())\n` +
        `\nvr_thread(main)\n`,
    )
  })

  it("emits a bumper hat alongside the main thread", () => {
    const whenStarted = block("pg_events_when_started", {
      next: block("pg_drivetrain_stop_driving"),
    })
    const bumper = block("pg_events_when_bumper", {
      fields: { BUMPER: "left", STATE: "pressed" },
              inputs: { DO: block("pg_drivetrain_turn", { fields: { DIRECTION: "right" } }) },
    })
    expect(generatePythonProgram(workspace(whenStarted, bumper))).toBe(
      `${HEADER}def when_left_bumper_pressed_1():\n` +
        `    drivetrain.turn(RIGHT)\n` +
        `\ndef main():\n` +
        `    drivetrain.stop()\n` +
        `\nvr_thread(when_left_bumper_pressed_1)\n` +
        `vr_thread(main)\n`,
    )
  })

  it("emits operators that the rename later remaps (and/or/not/random)", () => {
    const stack = block("pg_events_when_started", {
      next: block("pg_control_if_then", {
        inputs: {
          CONDITION: block("pg_operator_not", {
            inputs: {
              BOOL: block("pg_operator_and_or", {
                fields: { OP: "OR" },
                inputs: {
                  A: block("pg_operator_random", { fields: { FROM: "1", TO: "4" } }),
                  B: block("pg_sensing_bumper_pressed", { fields: { BUMPER: "left" } }),
                },
              }),
            },
          }),
          DO: block("pg_control_forever", { inputs: { DO: block("pg_control_wait", { inputs: { SECONDS: block("math_number", { fields: { NUM: "1" } }) } }) } }),
        },
      }),
    })
    expect(generatePythonProgram(workspace(stack))).toBe(
      `${HEADER}def main():\n` +
        `    if (not (random.randint(1, 4) or left_bumper.pressed())):\n` +
        `        while True:\n` +
        `            wait(1, SECONDS)\n` +
        `\nvr_thread(main)\n`,
    )
  })
})
