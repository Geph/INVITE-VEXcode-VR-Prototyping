/**
 * Renders the block workspace as VEXcode VR Python for the read-only code view.
 *
 * Kept as a stable import path. Generators live with each block category;
 * this file registers them and re-exports the assembler.
 */

import { consoleBlocks } from "@/blocks/common/console"
import { control } from "@/blocks/common/control"
import { drawing } from "@/blocks/common/drawing"
import { drivetrain } from "@/blocks/common/drivetrain"
import { events } from "@/blocks/common/events"
import { logic } from "@/blocks/common/logic"
import { operators } from "@/blocks/common/operators"
import {
  blockToPythonSnippet,
  generatePythonProgram,
  registerPythonGenerators,
} from "@/blocks/generators/python"
import { oceanReefPythonGenerators } from "@/playgrounds/ocean-reef/blocks"

export type { PyBlock } from "@/blocks/generators/python"
export { blockToPythonSnippet, generatePythonProgram }

for (const category of [drivetrain, logic, operators, consoleBlocks, control, events, drawing]) {
  registerPythonGenerators(category.pythonGenerators)
}
registerPythonGenerators(oceanReefPythonGenerators)
