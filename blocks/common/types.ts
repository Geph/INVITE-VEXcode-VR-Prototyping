import type { PyBlock, PyGenContext } from "@/blocks/generators/python-types"

export type JsGenerator = (block: any) => string | [string, number] | any[]

export type PyExpressionGenerator = (block: PyBlock, ctx: PyGenContext) => string
export type PyStatementGenerator = (block: PyBlock, indent: string, ctx: PyGenContext) => string

export interface PythonGenerators {
  expressions?: Record<string, PyExpressionGenerator>
  statements?: Record<string, PyStatementGenerator>
}

export interface CommonBlockCategory {
  defineBlocks(Blockly: any): void
  toolboxEntries: unknown[]
  jsGenerators: Record<string, JsGenerator>
  pythonGenerators: PythonGenerators
}

/** Define visual blocks, then attach the matching JavaScript generators. */
export function installCategory(Blockly: any, category: CommonBlockCategory) {
  category.defineBlocks(Blockly)
  for (const [type, fn] of Object.entries(category.jsGenerators)) {
    Blockly.JavaScript.forBlock[type] = fn
  }
}
