/**
 * Renders the block workspace as VEXcode VR Python for the read-only code view.
 *
 * Kept separate from the Blockly JavaScript generators (which drive the
 * simulator) because this one only has to be readable, not runnable.
 */

export interface PyBlock {
  type: string
  getFieldValue(name: string): string
  getInputTargetBlock(name: string): PyBlock | null
  getNextBlock(): PyBlock | null
}

interface PyWorkspace {
  getAllBlocks(ordered: boolean): PyBlock[]
}

const INDENT = "    "

function pyString(raw: string): string {
  return `"${String(raw).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

function pyNumber(raw: string, fallback = 0): string {
  const n = Number(raw)
  return String(Number.isFinite(n) ? n : fallback)
}

/** VEX Python spells units and colours as bare uppercase constants. */
function constant(raw: string): string {
  return String(raw).toUpperCase()
}

const ARITHMETIC_OPS: Record<string, string> = {
  ADD: "+",
  MINUS: "-",
  MULTIPLY: "*",
  DIVIDE: "/",
}

const COMPARE_OPS: Record<string, string> = {
  EQ: "==",
  NEQ: "!=",
  LT: "<",
  GT: ">",
  LTE: "<=",
  GTE: ">=",
}

const RANGE_OPS: Record<string, string> = { LT: "<", LTE: "<=" }

const MATH_FUNCS: Record<string, string> = {
  ABS: "abs",
  SQRT: "math.sqrt",
  SIN: "math.sin",
  COS: "math.cos",
  TAN: "math.tan",
}

const PEN_WIDTHS: Record<string, string> = {
  thin: "THIN",
  medium: "MEDIUM",
  thick: "THICK",
}

/** Reads a value input as a Python expression, or `fallback` if unplugged. */
function input(block: PyBlock, name: string, fallback: string): string {
  return expression(block.getInputTargetBlock(name), fallback)
}

function expression(block: PyBlock | null, fallback: string): string {
  if (!block) return fallback

  switch (block.type) {
    case "math_number":
      return pyNumber(block.getFieldValue("NUM"))

    case "text_string":
      return pyString(block.getFieldValue("TEXT"))

    case "math_arithmetic": {
      const op = ARITHMETIC_OPS[block.getFieldValue("OP")] ?? "+"
      return `(${input(block, "A", "0")} ${op} ${input(block, "B", "0")})`
    }

    case "compare": {
      const op = COMPARE_OPS[block.getFieldValue("OP")] ?? "=="
      return `(${input(block, "A", "0")} ${op} ${input(block, "B", "0")})`
    }

    case "boolean_and":
      return `(${input(block, "A", "False")} and ${input(block, "B", "False")})`

    case "boolean_or":
      return `(${input(block, "A", "False")} or ${input(block, "B", "False")})`

    case "boolean_not":
      return `(not ${input(block, "BOOL", "False")})`

    case "range_compare": {
      const op1 = RANGE_OPS[block.getFieldValue("OP1")] ?? "<"
      const op2 = RANGE_OPS[block.getFieldValue("OP2")] ?? "<"
      // Python chains comparisons natively.
      return `(${input(block, "A", "0")} ${op1} ${input(block, "B", "0")} ${op2} ${input(block, "C", "0")})`
    }

    case "random_int": {
      const from = Number(block.getFieldValue("FROM"))
      const to = Number(block.getFieldValue("TO"))
      const lo = Math.min(Number.isFinite(from) ? from : 0, Number.isFinite(to) ? to : 0)
      const hi = Math.max(Number.isFinite(from) ? from : 0, Number.isFinite(to) ? to : 0)
      return `random.randint(${lo}, ${hi})`
    }

    case "round_number":
      return `round(${input(block, "NUM", "0")}, ${input(block, "PLACES", "0")})`

    case "math_function": {
      const fn = MATH_FUNCS[block.getFieldValue("FUNC")] ?? "abs"
      return `${fn}(${input(block, "NUM", "0")})`
    }

    case "atan2_function":
      return `math.atan2(${input(block, "Y", "1")}, ${input(block, "X", "1")})`

    case "modulo":
      return `(${input(block, "A", "0")} % ${input(block, "B", "1")})`

    case "text_join":
      return `(str(${input(block, "A", '""')}) + str(${input(block, "B", '""')}))`

    case "text_letter_at":
      return `${input(block, "TEXT", '""')}[${input(block, "AT", "1")} - 1]`

    case "text_length":
      return `len(${input(block, "TEXT", '""')})`

    case "text_contains":
      return `(${input(block, "SEARCH", '""')} in ${input(block, "TEXT", '""')})`

    case "convert_type":
      return block.getFieldValue("TYPE") === "TEXT"
        ? `str(${input(block, "VALUE", "0")})`
        : `float(${input(block, "VALUE", "0")})`

    case "bumper_pressed":
      return `${block.getFieldValue("BUMPER")}_bumper.pressed()`

    case "distance_found_object":
      return `${block.getFieldValue("SENSOR")}_distance.found_object()`

    case "distance_in_units":
      return `${block.getFieldValue("SENSOR")}_distance.get_distance(${constant(block.getFieldValue("UNIT"))})`

    case "eye_is_near":
      return `${block.getFieldValue("SENSOR")}_eye.near_object()`

    case "eye_detects_color":
      return `${block.getFieldValue("SENSOR")}_eye.detect(${constant(block.getFieldValue("COLOR"))})`

    case "eye_brightness":
      return `${block.getFieldValue("SENSOR")}_eye.brightness(PERCENT)`

    case "position_value":
      return `location.position(${constant(block.getFieldValue("AXIS"))}, ${constant(block.getFieldValue("UNIT"))})`

    case "position_angle":
      return "location.position_angle(DEGREES)"

    default:
      return fallback
  }
}

/** Renders a statement input, using `pass` when the mouth is empty. */
function body(block: PyBlock, name: string, indent: string): string {
  const child = block.getInputTargetBlock(name)
  if (!child) return `${indent}pass\n`
  return sequence(child, indent)
}

function sequence(block: PyBlock | null, indent: string): string {
  let out = ""
  for (let current = block; current; current = current.getNextBlock()) {
    out += statement(current, indent)
  }
  return out
}

function statement(block: PyBlock, indent: string): string {
  const field = (name: string) => block.getFieldValue(name)

  switch (block.type) {
    case "drive_simple":
      return `${indent}drivetrain.drive(${constant(field("DIRECTION"))})\n`

    case "drive_distance":
      return `${indent}drivetrain.drive_for(${constant(field("DIRECTION"))}, ${pyNumber(field("DISTANCE"), 200)}, ${constant(field("UNIT"))})\n`

    case "turn_simple":
      return `${indent}drivetrain.turn(${constant(field("DIRECTION"))})\n`

    case "turn_degrees":
      return `${indent}drivetrain.turn_for(${constant(field("DIRECTION"))}, ${pyNumber(field("DEGREES"), 90)}, DEGREES)\n`

    case "turn_to_heading":
      return `${indent}drivetrain.turn_to_heading(${pyNumber(field("HEADING"))}, DEGREES)\n`

    case "turn_to_rotation":
      return `${indent}drivetrain.turn_to_rotation(${pyNumber(field("ROTATION"))}, DEGREES)\n`

    case "stop_driving":
      return `${indent}drivetrain.stop()\n`

    case "set_drive_velocity":
      return `${indent}drivetrain.set_drive_velocity(${pyNumber(field("VELOCITY"), 50)}, PERCENT)\n`

    case "set_turn_velocity":
      return `${indent}drivetrain.set_turn_velocity(${pyNumber(field("VELOCITY"), 50)}, PERCENT)\n`

    case "set_drive_heading":
      return `${indent}drivetrain.set_heading(${pyNumber(field("HEADING"))}, DEGREES)\n`

    case "set_drive_rotation":
      return `${indent}drivetrain.set_rotation(${pyNumber(field("ROTATION"))}, DEGREES)\n`

    case "set_drive_timeout":
      return `${indent}drivetrain.set_timeout(${pyNumber(field("TIMEOUT"), 1)}, SECONDS)\n`

    case "energize_magnet":
      return `${indent}magnet.energize(${constant(field("MODE"))})\n`

    case "move_pen":
      return `${indent}pen.move(${constant(field("POSITION"))})\n`

    case "set_pen_width":
      return `${indent}pen.set_pen_width(${PEN_WIDTHS[field("WIDTH")] ?? "MEDIUM"})\n`

    case "set_pen_color":
      return `${indent}pen.set_pen_color(${constant(field("COLOR"))})\n`

    case "print_text":
      return `${indent}brain.print(${input(block, "TEXT", '""')})\n`

    case "set_cursor_next_row":
      return `${indent}brain.new_line()\n`

    case "clear_all_rows":
      return `${indent}brain.clear_all_rows()\n`

    case "set_print_precision":
      return `${indent}brain.set_print_precision(${pyNumber(field("PRECISION"), 1)})\n`

    case "set_print_color":
      return `${indent}brain.set_print_color(${constant(field("COLOR"))})\n`

    case "wait_seconds":
      return `${indent}wait(${pyNumber(field("SECONDS"), 1)}, SECONDS)\n`

    case "wait":
      return `${indent}wait(${input(block, "SECONDS", "1")}, SECONDS)\n`

    case "wait_until":
      return `${indent}while not ${input(block, "CONDITION", "True")}:\n${indent}${INDENT}wait(5, MSEC)\n`

    case "repeat_times":
      return `${indent}for i in range(${pyNumber(field("TIMES"), 10)}):\n${body(block, "DO", indent + INDENT)}`

    case "repeat":
      return `${indent}for i in range(${input(block, "TIMES", "10")}):\n${body(block, "DO", indent + INDENT)}`

    case "forever":
    case "forever_loop":
      return `${indent}while True:\n${body(block, "DO", indent + INDENT)}`

    case "repeat_until":
      return `${indent}while not ${input(block, "CONDITION", "False")}:\n${body(block, "DO", indent + INDENT)}`

    case "while_loop":
      return `${indent}while ${input(block, "CONDITION", "True")}:\n${body(block, "DO", indent + INDENT)}`

    case "if_then":
      return `${indent}if ${input(block, "CONDITION", "True")}:\n${body(block, "DO", indent + INDENT)}`

    case "if_then_else":
      return (
        `${indent}if ${input(block, "CONDITION", "True")}:\n${body(block, "DO", indent + INDENT)}` +
        `${indent}else:\n${body(block, "ELSE", indent + INDENT)}`
      )

    case "if_elseif_else":
      return (
        `${indent}if ${input(block, "CONDITION1", "True")}:\n${body(block, "DO1", indent + INDENT)}` +
        `${indent}elif ${input(block, "CONDITION2", "True")}:\n${body(block, "DO2", indent + INDENT)}` +
        `${indent}else:\n${body(block, "ELSE", indent + INDENT)}`
      )

    case "break_block":
      return `${indent}break\n`

    case "stop_project":
      return `${indent}vr_thread.stop_all()\n`

    case "comment_block":
      return `${indent}# ${field("TEXT")}\n`

    case "switch_code": {
      const code = field("CODE") || ""
      return code
        .split("\n")
        .map((line) => `${indent}${line}`)
        .join("\n")
        .concat("\n")
    }

    default:
      // Value blocks reached as statements, or a block with no Python mapping.
      return `${indent}# unsupported block: ${block.type}\n`
  }
}

/** One statement block (not its next-stack) as a Python snippet for Switch conversion. */
export function blockToPythonSnippet(block: PyBlock): string {
  return statement(block, "").trimEnd() || `# ${block.type}`
}

const HEADER = "# VEXcode VR Python\nfrom vexcode import *\nimport math\nimport random\n\n"

const EMPTY = "# No code yet\n# Add blocks inside when started to see Python code"

export function generatePythonProgram(workspace: PyWorkspace | null): string {
  if (!workspace) return EMPTY

  const blocks = workspace.getAllBlocks(false)
  const whenStartedHats = blocks.filter((b) => b.type === "when_started")
  if (whenStartedHats.length === 0) return EMPTY

  let out = HEADER

  // `when_bumper` hats become their own callbacks, mirroring how the simulator
  // runs them alongside the main program.
  const bumperEvents = blocks.filter((b) => b.type === "when_bumper")
  bumperEvents.forEach((event, index) => {
    const bumper = event.getFieldValue("BUMPER")
    const state = event.getFieldValue("STATE")
    const name = `when_${bumper}_bumper_${state}_${index + 1}`
    out += `def ${name}():\n${body(event, "DO", INDENT)}\n`
  })

  whenStartedHats.forEach((hat, index) => {
    const name = whenStartedHats.length === 1 ? "main" : `main_${index + 1}`
    out += `def ${name}():\n${body(hat, "DO", INDENT)}\n`
  })

  bumperEvents.forEach((event, index) => {
    const bumper = event.getFieldValue("BUMPER")
    const state = event.getFieldValue("STATE")
    out += `vr_thread(when_${bumper}_bumper_${state}_${index + 1})\n`
  })

  whenStartedHats.forEach((_, index) => {
    const name = whenStartedHats.length === 1 ? "main" : `main_${index + 1}`
    out += `vr_thread(${name})\n`
  })
  return out
}
