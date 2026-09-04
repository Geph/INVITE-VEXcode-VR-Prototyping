import { consoleBlocks } from "./common/console"
import { control } from "./common/control"
import { drawing } from "./common/drawing"
import { drivetrain } from "./common/drivetrain"
import { events } from "./common/events"
import { logic } from "./common/logic"
import { operators } from "./common/operators"
import { installCategory, type CommonBlockCategory } from "./common/types"
import type { BlockCategory } from "@/playgrounds/types"

export interface RegisteredCategory {
  id: string
  label: string
  heading: { title: string; subtitle: string }
  categories: CommonBlockCategory[]
}

export const COMMON_CATEGORIES: RegisteredCategory[] = [
  {
    id: "drivetrain",
    label: "Drivetrain",
    heading: { title: "Drivetrain", subtitle: "Drivetrain - Actions" },
    categories: [drivetrain],
  },
  {
    id: "operators",
    label: "Operators",
    heading: { title: "Operators", subtitle: "Operators - Math and Text" },
    categories: [operators],
  },
  {
    id: "logic",
    label: "Logic",
    heading: { title: "Logic", subtitle: "Logic - Control" },
    categories: [logic],
  },
  {
    id: "drawing",
    label: "Drawing",
    heading: { title: "Drawing", subtitle: "Drawing - Pen" },
    categories: [drawing],
  },
  {
    id: "console",
    label: "Console",
    heading: { title: "Console", subtitle: "Console - Output" },
    categories: [consoleBlocks],
  },
  {
    id: "loops",
    label: "Switch",
    heading: { title: "Switch", subtitle: "Switch - Functions" },
    categories: [events, control],
  },
]

export function commonCategoriesToInstall(): CommonBlockCategory[] {
  return [drivetrain, operators, logic, drawing, consoleBlocks, events, control]
}

export function toolboxEntriesFor(
  id: string,
  playground?: { blocks: BlockCategory[] },
): unknown[] {
  const common = COMMON_CATEGORIES.find((category) => category.id === id)
  if (common) return common.categories.flatMap((category) => category.toolboxEntries)
  return playground?.blocks.find((category) => category.id === id)?.toolbox ?? []
}

export function installAllBlocks(Blockly: any, playground: { blocks: BlockCategory[] }) {
  for (const category of commonCategoriesToInstall()) installCategory(Blockly, category)
  for (const category of playground.blocks) category.define(Blockly)
}
