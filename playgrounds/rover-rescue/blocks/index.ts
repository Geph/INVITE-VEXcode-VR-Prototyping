import type { PythonGenerators } from "@/blocks/common/types"
import type { BlockCategory } from "../../types"
import { resourcesCategory, resourcesPythonGenerators } from "./resources"
import { sensingCategory, sensingPythonGenerators } from "./sensing"

export const roverRescueBlocks: BlockCategory[] = [sensingCategory, resourcesCategory]

export const roverRescuePythonGenerators: PythonGenerators = {
  expressions: { ...sensingPythonGenerators.expressions },
  statements: { ...resourcesPythonGenerators.statements },
}
