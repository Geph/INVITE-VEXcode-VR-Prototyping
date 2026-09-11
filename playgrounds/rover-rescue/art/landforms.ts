import type { Vec2 } from "@/engine"
import { FIELD_BOUNDS } from "../config"
import { toScreen, type DrawWorld } from "./world-draw"

type Outline = readonly (readonly [number, number])[]

// Traced from the supplied overhead reference, registered on the two bridge centres.
// These are landforms, not the A-E encounter regions used by spawning and sensing.
const LANDFORMS: readonly { fill: string; outlines: readonly Outline[] }[] = [
  { fill: "#48483e", outlines: [
    [[-80,-60],[154,-30],[251,55],[282,125],[233,186],[298,218],[351,238],[427,230],[506,177],[652,149],[800,163],[893,192],[935,262],[899,333],[920,385],[883,451],[907,501],[925,558],[867,624],[877,762],[-80,762],[-40,549],[65,463],[92,338],[56,224]],
    [[816,-55],[914,11],[1025,-21],[1160,14],[1197,94],[1240,147],[1207,221],[1259,280],[1194,344],[1131,366],[1044,333],[973,369],[920,314],[940,254],[880,192],[909,125],[855,89]],
  ] },
  { fill: "#a25544", outlines: [
    [[180,285],[268,298],[347,323],[443,347],[526,332],[603,354],[711,344],[777,356],[796,416],[769,491],[789,554],[795,628],[742,660],[637,649],[538,672],[405,661],[335,700],[182,682],[128,616],[142,527],[166,449],[139,376]],
  ] },
  { fill: "#874e48", outlines: [
    [[265,328],[330,348],[398,350],[458,382],[546,371],[603,395],[710,381],[744,410],[710,451],[646,427],[573,450],[512,415],[437,436],[373,402],[284,400]],
    [[547,448],[592,489],[614,540],[676,562],[688,616],[744,643],[693,656],[627,622],[580,599],[565,546],[532,512]],
  ] },
  { fill: "#bd8c31", outlines: [
    [[193,465],[234,447],[301,449],[359,466],[396,487],[412,541],[388,586],[409,646],[385,703],[332,720],[261,688],[210,704],[160,668],[139,611],[161,562],[157,514]],
    [[465,516],[492,511],[502,532],[512,555],[486,571],[454,568]],
  ] },
  { fill: "#644641", outlines: [
    [[1252,315],[1320,354],[1396,325],[1516,315],[1520,710],[1388,748],[1294,708],[1206,644],[1114,637],[1041,675],[1000,744],[938,720],[933,650],[976,598],[1060,570],[1131,547],[1169,492],[1224,443]],
  ] },
  { fill: "#985f7d", outlines: [
    [[929,345],[979,359],[1033,344],[1087,365],[1147,351],[1215,346],[1240,379],[1230,423],[1252,477],[1216,524],[1200,581],[1154,614],[1087,605],[1038,627],[966,645],[925,629],[911,574],[927,529],[910,465],[928,411]],
  ] },
  { fill: "#a09262", outlines: [
    [[316,163],[427,179],[504,190],[571,197],[650,203],[718,218],[821,207],[865,230],[891,256],[840,268],[753,258],[653,267],[588,250],[544,240],[486,246],[425,222],[365,207]],
  ] },
  { fill: "#77745b", outlines: [
    [[264,76],[357,69],[420,107],[486,110],[555,134],[632,141],[691,158],[650,171],[556,152],[457,151],[384,130],[330,126]],
    [[924,106],[950,121],[939,157],[978,185],[979,234],[1009,260],[996,289],[963,260],[949,206],[914,182]],
  ] },
]

function referencePoint([x, y]: readonly [number, number]): Vec2 {
  return { x: -3500 + (x - 470) * (4630 / 374), y: 1240 - (y - 286) * (3120 / 256) }
}

export function drawLandforms(world: DrawWorld): void {
  const { ctx } = world
  ctx.save()
  // Clip only the artwork at the field edge, so panning never exposes painted void.
  const topLeft = toScreen(world, { x: FIELD_BOUNDS.minX, y: FIELD_BOUNDS.maxY })
  const bottomRight = toScreen(world, { x: FIELD_BOUNDS.maxX, y: FIELD_BOUNDS.minY })
  if (typeof ctx.clip === "function") {
    ctx.beginPath()
    ctx.rect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y)
    ctx.clip()
  }
  for (const layer of LANDFORMS) {
    ctx.fillStyle = layer.fill
    ctx.beginPath()
    for (const outline of layer.outlines) {
      const points = outline.map(p => toScreen(world, referencePoint(p)))
      const first = points[0]
      const last = points[points.length - 1]
      ctx.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2)
      for (let i = 0; i < points.length; i++) {
        const a = points[i]
        const b = points[(i + 1) % points.length]
        ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2)
      }
      ctx.closePath()
    }
    ctx.fill()
  }
  ctx.restore()
}
