/**
 * Renders the block workspace as VEXcode VR Python for the read-only code view.
 *
 * Kept as a stable import path. Generators live with each block category;
 * this file registers them and re-exports the assembler.
 */

import { commonCategoriesToInstall } from "@/blocks/registry"
import {
  blockToPythonSnippet,
  generatePythonProgram,
  registerPythonGenerators,
} from "@/blocks/generators/python"
import { oceanReefPythonGenerators } from "@/playgrounds/ocean-reef/blocks"

export type { PyBlock } from "@/blocks/generators/python"
export { blockToPythonSnippet, generatePythonProgram }

for (const category of commonCategoriesToInstall()) {
  registerPythonGenerators(category.pythonGenerators)
}
registerPythonGenerators(oceanReefPythonGenerators)
