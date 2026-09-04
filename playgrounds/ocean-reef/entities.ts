import {
  CORAL_REEF_START_MM,
  CORAL_REEF_TRASH_COUNT,
  fieldMmToPixel,
  pointHitsCoral,
  seededRandom,
  type CoralPiece,
} from "@/lib/robot-runtime"
import { CORAL_COLORS, CORAL_KINDS } from "./art"
import { MM_PER_PIXEL, TRASH_COUNT } from "./config"

export type TrashType = "bottle" | "can" | "wrapper" | "bag"

export interface OceanReefCoral {
  xMm: number
  yMm: number
  radiusMm: number
  color: string
  kind: (typeof CORAL_KINDS)[number]
  angle: number
  seed: number
}

export interface OceanReefTrash {
  id: number
  xMm: number
  yMm: number
  type: TrashType
  scale: number
  floatOffset: number
  isCollected: boolean
}

export interface OceanReefView {
  widthPx: number
  heightPx: number
  maximized: boolean
}

export interface OceanReefState {
  view: OceanReefView
  coral: OceanReefCoral[]
  trash: OceanReefTrash[]
  trashCollected: number
  batteryPercent: number
  magnetEnergized: boolean
  missionOver: boolean
  missionReason?: "coral" | "battery" | "complete"
}

function pxToMm(px: number, canvasSize: number): number {
  return (px - canvasSize / 2) * MM_PER_PIXEL
}

function radiusPxToMm(radiusPx: number): number {
  return radiusPx * MM_PER_PIXEL
}

/** Same border walk as the old workspace, stored in world mm. */
export function createCoralPieces(view: OceanReefView): OceanReefCoral[] {
  const { widthPx: width, heightPx: height } = view
  const pieces: OceanReefCoral[] = []

  const pushPiece = (x: number, y: number, seed: number, angle: number) => {
    pieces.push({
      xMm: pxToMm(x, width),
      yMm: pxToMm(y, height),
      radiusMm: radiusPxToMm(12 + seededRandom(seed) * 8),
      color: CORAL_COLORS[Math.floor(seededRandom(seed + 1) * CORAL_COLORS.length)]!,
      kind: CORAL_KINDS[Math.floor(seededRandom(seed + 2) * CORAL_KINDS.length)]!,
      angle,
      seed,
    })
  }

  for (let x = 0; x < width; x += 30) {
    pushPiece(x + 15, 15, x, Math.PI)
    pushPiece(x + 15, height - 15, x + 1000, 0)
  }
  for (let y = 30; y < height - 30; y += 30) {
    pushPiece(15, y + 15, y + 2000, Math.PI / 2)
    pushPiece(width - 15, y + 15, y + 3000, -Math.PI / 2)
  }

  return pieces
}

export function coralToPixelPieces(coral: OceanReefCoral[], view: OceanReefView): CoralPiece[] {
  return coral.map((piece) => {
    const pos = fieldMmToPixel(piece.xMm, piece.yMm, view.widthPx, view.heightPx)
    return {
      x: pos.x,
      y: pos.y,
      radius: piece.radiusMm / MM_PER_PIXEL,
      color: piece.color,
      kind: piece.kind,
      angle: piece.angle,
      seed: piece.seed,
    }
  })
}

export function trashToPixelItems(
  trash: OceanReefTrash[],
  view: OceanReefView,
): Array<{ x: number; y: number; isCollected: boolean; type: TrashType }> {
  return trash.map((item) => {
    const pos = fieldMmToPixel(item.xMm, item.yMm, view.widthPx, view.heightPx)
    return { x: pos.x, y: pos.y, isCollected: item.isCollected, type: item.type }
  })
}

/** Same placement as `createInitialTrashItems`, plus the workspace float/scale extras. */
export function createTrashItems(view: OceanReefView, coral: OceanReefCoral[], count = TRASH_COUNT): OceanReefTrash[] {
  const types: TrashType[] = ["bottle", "can", "wrapper", "bag"]
  const items: OceanReefTrash[] = []
  const margin = 55
  const { widthPx: canvasW, heightPx: canvasH } = view
  const spawn = fieldMmToPixel(CORAL_REEF_START_MM.x, CORAL_REEF_START_MM.y, canvasW, canvasH)
  const pixelCoral = coralToPixelPieces(coral, view)
  let attempts = 0

  while (items.length < count && attempts < count * 50) {
    attempts++
    const x = margin + seededRandom(attempts) * (canvasW - margin * 2)
    const y = margin + seededRandom(attempts + 500) * (canvasH - margin * 2)
    if (pointHitsCoral(x, y, pixelCoral, 28)) continue
    if (Math.hypot(x - spawn.x, y - spawn.y) < 70) continue

    const i = items.length
    items.push({
      id: i,
      xMm: pxToMm(x, canvasW),
      yMm: pxToMm(y, canvasH),
      type: types[Math.floor(seededRandom(attempts + 1000) * types.length)]!,
      scale: 0.85 + seededRandom(i) * 0.15,
      floatOffset: seededRandom(i + 20) * Math.PI * 2,
      isCollected: false,
    })
  }

  return items
}

export function createOceanReefState(seed: number, view?: Partial<OceanReefView>): OceanReefState {
  const maximized = view?.maximized ?? false
  const widthPx = view?.widthPx ?? (maximized ? 600 : 400)
  const heightPx = view?.heightPx ?? widthPx
  const resolved: OceanReefView = { widthPx, heightPx, maximized }
  void seed
  const coral = createCoralPieces(resolved)
  return {
    view: resolved,
    coral,
    trash: createTrashItems(resolved, coral, CORAL_REEF_TRASH_COUNT),
    trashCollected: 0,
    batteryPercent: 100,
    magnetEnergized: false,
    missionOver: false,
  }
}
