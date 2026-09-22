/** Small, explicit VEX Python command adapter, not a general Python interpreter.
 * Unsupported syntax fails visibly. Never insert learner text into JavaScript.
 */
type Value = string | number | boolean
const CONSTANTS: Record<string, Value> = {
  FORWARD: "forward", REVERSE: "reverse", LEFT: "left", RIGHT: "right",
  MM: "mm", INCHES: "inches", DEGREES: "degrees", PERCENT: "percent",
  SECONDS: "seconds", MSEC: "msec", True: true, False: false,
  UP: "up", DOWN: "down", BLACK: "black", RED: "red", GREEN: "green",
  BLUE: "blue", YELLOW: "yellow", PURPLE: "purple", ORANGE: "orange",
}

export function compileSwitchPython(source: string): string {
  const lines = source.replace(/\r/g, "").split("\n")
  const output: string[] = []
  const loops: number[] = []
  let loopId = 0
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw.trim() || raw.trim().startsWith("#")) continue
    try {
      if (/\t/.test(raw)) throw new Error("Use spaces for indentation")
      const indent = raw.length - raw.trimStart().length
      while (loops.length && indent <= loops[loops.length - 1]) { output.push("}"); loops.pop() }
      if (indent !== loops.length * 4) throw new Error("Use four spaces inside each repeat loop")
      const line = raw.trim()
      const repeat = /^for\s+\w+\s+in\s+range\((\d+)\):(?:\s*#.*)?$/.exec(line)
      if (repeat) {
        const count = Number(repeat[1])
        if (count > 10000) throw new Error("A repeat may run at most 10000 times")
        const id = `switchRepeat${loopId++}`
        output.push(`for (let ${id} = 0; ${id} < ${count}; ${id}++) { await robot.wait(0);`)
        loops.push(indent)
        continue
      }
      if (line === "pass") { output.push("await robot.wait(0);"); continue }
      const call = /^([a-zA-Z_][\w.]*)\((.*)\)\s*(?:#.*)?$/.exec(line)
      if (!call) throw new Error("Use VEX command calls or for … in range(number) loops")
      output.push(command(call[1], parseArgs(call[2])))
    } catch (error) {
      throw new Error(`Switch Python line ${i + 1}: ${error instanceof Error ? error.message : "Invalid command"}`)
    }
  }
  while (loops.length) { output.push("}"); loops.pop() }
  return output.join("\n")
}

function parseArgs(text: string): Value[] {
  const args: Value[] = []
  let rest = text.trim()
  while (rest) {
    const match = /^(?:wait\s*=\s*)?("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[+-]?(?:\d+(?:\.\d*)?|\.\d+)|[A-Za-z_]\w*)\s*(,|$)/.exec(rest)
    if (!match) throw new Error("Arguments must be numbers, quoted text, or VEX constants; expressions are not supported")
    const token = match[1]
    let value: Value
    if (token.startsWith('"')) value = JSON.parse(token) as string
    else if (token.startsWith("'")) value = token.slice(1, -1).replace(/\\([\\'nrt])/g, (_, c: string) => ({ n: "\n", r: "\r", t: "\t" }[c] ?? c))
    else if (Object.hasOwn(CONSTANTS, token)) value = CONSTANTS[token]
    else if (Number.isFinite(Number(token))) value = Number(token)
    else throw new Error(`Unknown constant ${token}`)
    args.push(value)
    rest = rest.slice(match[0].length).trim()
  }
  return args
}

function command(name: string, args: Value[]): string {
  const emit = (method: string, values = args) => `await robot.${method}(${values.map(v => JSON.stringify(v)).join(", ")});`
  const count = (min: number, max = min) => {
    if (args.length < min || args.length > max) throw new Error(`${name} expects ${min === max ? min : `${min}–${max}`} arguments`)
  }
  const number = (index: number) => {
    if (typeof args[index] !== "number") throw new Error(`${name}: argument ${index + 1} must be a number`)
    return args[index] as number
  }
  const choice = (index: number, values: Value[]) => {
    if (!values.includes(args[index])) throw new Error(`${name}: invalid argument ${index + 1}`)
  }
  const simple: Record<string, string> = {
    "drivetrain.set_drive_velocity": "setDriveVelocity", "drivetrain.set_turn_velocity": "setTurnVelocity",
    "drivetrain.set_heading": "setDriveHeading", "drivetrain.set_rotation": "setDriveRotation",
    "drivetrain.turn_to_heading": "turnToHeading", "drivetrain.turn_to_rotation": "turnToRotation",
  }
  if (Object.hasOwn(simple, name)) {
    count(1, 2); number(0)
    if (args.length === 2) choice(1, [name.includes("velocity") ? "percent" : "degrees"])
    return emit(simple[name], [args[0]])
  }
  if (name === "drivetrain.drive" || name === "drivetrain.drive_for") {
    count(name.endsWith("_for") ? 3 : 1, name.endsWith("_for") ? 4 : 1)
    choice(0, ["forward", "reverse"])
    if (args.length > 1) { number(1); choice(2, ["mm", "inches"]) }
    if (args.length === 4) choice(3, [true, false])
    return emit("drive")
  }
  if (name === "drivetrain.turn" || name === "drivetrain.turn_for") {
    count(name.endsWith("_for") ? 3 : 1, name.endsWith("_for") ? 4 : 1)
    choice(0, ["left", "right"])
    if (args.length > 1) { number(1); choice(2, ["degrees"]) }
    if (args.length === 4) choice(3, [true, false])
    return emit("turn", args.length === 1 ? args : [args[0], args[1], args[3] ?? true])
  }
  if (name === "wait" || name === "drivetrain.set_timeout") {
    count(1, 2); const n = number(0)
    if (args.length === 2) choice(1, ["seconds", "msec"])
    return emit(name === "wait" ? "wait" : "setDriveTimeout", [args[1] === "msec" ? n / 1000 : n])
  }
  if (name === "print" || name === "brain.print") { count(1); return emit("print") + (name === "print" ? "robot.setCursorNextRow();" : "") }
  const noArgs: Record<string, string> = { "drivetrain.stop": "stopDriving", "brain.new_line": "setCursorNextRow", "brain.clear": "clearAllRows", "stop_project": "stop" }
  if (Object.hasOwn(noArgs, name)) { count(0); return emit(noArgs[name]) }
  if (name === "pen.move") { count(1); choice(0, ["up", "down"]); return emit("movePen") }
  if (name === "pen.set_pen_color") { count(1); return emit("setPenColor") }
  throw new Error(`Unsupported command ${name}. Supported: drivetrain, wait, print, brain console, and pen commands`)
}
