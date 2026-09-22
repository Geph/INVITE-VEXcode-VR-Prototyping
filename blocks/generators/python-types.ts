export interface PyBlock {
  type: string
  getFieldValue(name: string): string
  getInputTargetBlock(name: string): PyBlock | null
  getNextBlock(): PyBlock | null
}

export interface PyWorkspace {
  getAllBlocks(ordered: boolean): PyBlock[]
}

export interface PyGenContext {
  input(block: PyBlock, name: string, fallback: string): string
  expression(block: PyBlock | null, fallback: string): string
  body(block: PyBlock, name: string, indent: string): string
  stack(block: PyBlock, indent: string): string
  pyString(raw: string): string
  pyNumber(raw: string, fallback?: number): string
  constant(raw: string): string
}
