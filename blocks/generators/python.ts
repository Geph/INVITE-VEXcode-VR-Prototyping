import type { PythonGenerators } from "@/blocks/common/types"
import type { PyBlock, PyGenContext, PyWorkspace } from "./python-types"

export type { PyBlock, PyGenContext, PyWorkspace } from "./python-types"

const INDENT = "    "

const expressionFns = new Map<string, NonNullable<PythonGenerators["expressions"]>[string]>()
const statementFns = new Map<string, NonNullable<PythonGenerators["statements"]>[string]>()

export function registerPythonGenerators(gens: PythonGenerators) {
  if (gens.expressions) {
    for (const [type, fn] of Object.entries(gens.expressions)) expressionFns.set(type, fn)
  }
  if (gens.statements) {
    for (const [type, fn] of Object.entries(gens.statements)) statementFns.set(type, fn)
  }
}

export function pyString(raw: string): string {
  return `"${String(raw).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

export function pyNumber(raw: string, fallback = 0): string {
  const n = Number(raw)
  return String(Number.isFinite(n) ? n : fallback)
}

/** VEX Python spells units and colours as bare uppercase constants. */
export function constant(raw: string): string {
  return String(raw).toUpperCase()
}

export function input(block: PyBlock, name: string, fallback: string): string {
  return expression(block.getInputTargetBlock(name), fallback)
}

export function expression(block: PyBlock | null, fallback: string): string {
  if (!block) return fallback
  const fn = expressionFns.get(block.type)
  if (fn) return fn(block, ctx)
  return fallback
}

/** Renders a statement input, using `pass` when the mouth is empty. */
export function body(block: PyBlock, name: string, indent: string): string {
  const child = block.getInputTargetBlock(name)
  if (!child) return `${indent}pass\n`
  return sequence(child, indent)
}

/** Renders the stack under a cap hat, using `pass` when nothing is attached. */
export function stack(block: PyBlock, indent: string): string {
  const child = block.getNextBlock()
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
  const fn = statementFns.get(block.type)
  if (fn) return fn(block, indent, ctx)
  return `${indent}# unsupported block: ${block.type}\n`
}

const ctx: PyGenContext = {
  input,
  expression,
  body,
  stack,
  pyString,
  pyNumber,
  constant,
}

/** One statement block (not its next-stack) as a Python snippet for Switch conversion. */
export function blockToPythonSnippet(block: PyBlock): string {
  return statement(block, "").trimEnd() || `# ${block.type}`
}

const HEADER = "# VEXcode VR Python\nfrom vexcode import *\nimport math\nimport random\n\n"

const EMPTY = "# No code yet\n# Add blocks under when started to see Python code"

export function generatePythonProgram(workspace: PyWorkspace | null): string {
  if (!workspace) return EMPTY

  const blocks = workspace.getAllBlocks(false)
  const whenStartedHats = blocks.filter((b) => b.type === "pg_events_when_started")
  if (whenStartedHats.length === 0) return EMPTY

  let out = HEADER

  // `pg_events_when_bumper` hats become their own callbacks, mirroring how the
  // simulator runs them alongside the main program.
  const bumperEvents = blocks.filter((b) => b.type === "pg_events_when_bumper")
  bumperEvents.forEach((event, index) => {
    const bumper = event.getFieldValue("BUMPER")
    const state = event.getFieldValue("STATE")
    const name = `when_${bumper}_bumper_${state}_${index + 1}`
    out += `def ${name}():\n${body(event, "DO", INDENT)}\n`
  })

  const broadcastEvents = blocks.filter((b) => b.type === "pg_events_when_broadcasted")
  broadcastEvents.forEach((event, index) => {
    const raw = String(event.getFieldValue("OBJECT") || "message1").replace(/\W/g, "_") || "message"
    const name = `when_broadcasted_${raw}_${index + 1}`
    out += `def ${name}():\n${body(event, "SUBSTACK", INDENT)}\n`
  })

  whenStartedHats.forEach((hat, index) => {
    const name = whenStartedHats.length === 1 ? "main" : `main_${index + 1}`
    out += `def ${name}():\n${stack(hat, INDENT)}\n`
  })

  bumperEvents.forEach((event, index) => {
    const bumper = event.getFieldValue("BUMPER")
    const state = event.getFieldValue("STATE")
    out += `vr_thread(when_${bumper}_bumper_${state}_${index + 1})\n`
  })

  broadcastEvents.forEach((event, index) => {
    const raw = String(event.getFieldValue("OBJECT") || "message1").replace(/\W/g, "_") || "message"
    out += `vr_thread(when_broadcasted_${raw}_${index + 1})\n`
  })

  whenStartedHats.forEach((_, index) => {
    const name = whenStartedHats.length === 1 ? "main" : `main_${index + 1}`
    out += `vr_thread(${name})\n`
  })
  return out
}
