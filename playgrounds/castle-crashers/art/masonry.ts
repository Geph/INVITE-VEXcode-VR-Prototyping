import type { CastlePiece } from "../state"

const TAU = Math.PI * 2
function polygon(ctx: CanvasRenderingContext2D, points: number[][], fill: string) {
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1])
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y)
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill()
}
function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = fill; ctx.fill()
}
function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h)
}

function roof(ctx: CanvasRenderingContext2D, w: number, h: number, gold: boolean) {
  rect(ctx, -w / 2 - 5, -h / 2 - 5, w + 10, h + 10, "#d6e7e9")
  polygon(ctx, [[-w / 2, -h / 2], [w / 2, -h / 2], [0, 0]], "#a13d34")
  polygon(ctx, [[w / 2, -h / 2], [w / 2, h / 2], [0, 0]], "#762922")
  polygon(ctx, [[w / 2, h / 2], [-w / 2, h / 2], [0, 0]], "#8c302b")
  polygon(ctx, [[-w / 2, h / 2], [-w / 2, -h / 2], [0, 0]], "#ad483b")
  ctx.strokeStyle = gold ? "#d7b645" : "#823329"; ctx.lineWidth = gold ? 8 : 2
  ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, h / 2)
  ctx.moveTo(w / 2, -h / 2); ctx.lineTo(-w / 2, h / 2); ctx.stroke()
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const x = -w * 0.39 + col * w * 0.24, y = -h * 0.38 + row * h * 0.24
    rect(ctx, x, y, 7, 3, (row + col) % 2 ? "#bc706049" : "#63272150")
  }
  rect(ctx, -7, -7, 14, 14, "#d6b558")
  if (gold) for (const x of [-w / 2, w / 2]) for (const y of [-h / 2, h / 2]) {
    rect(ctx, x - 9, y - 9, 18, 18, "#f0f2dd")
  }
}

function wall(ctx: CanvasRenderingContext2D, w: number, h: number, blue: boolean, topple: number) {
  const face = h * (blue ? 1 + topple * 1.5 : 1 + topple * 0.8)
  rect(ctx, -w / 2 + 8, -face / 2 + 11, w, face, "#27322532")
  rect(ctx, -w / 2, -face / 2, w, face, blue ? "#88c1de" : "#747775")
  rect(ctx, -w / 2, -face / 2, w, face * 0.18, blue ? "#bce2eb" : "#959894")
  rect(ctx, -w / 2, face / 2 - 12, w, 12, blue ? "#478abb" : "#646865")
  if (blue) rect(ctx, -w / 2 + 4, -face / 2 + 15, w - 8, Math.max(12, face - 31), topple > 0.3 ? "#d5eaf0" : "#64abe4")
  ctx.strokeStyle = blue ? "#f3fbfb66" : "#b1b1a742"; ctx.lineWidth = 2
  ctx.beginPath()
  for (let row = 0; row < 3; row++) {
    const y = -face / 2 + row * face / 3
    ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y)
    for (let x = -w / 2 + (row % 2 ? 28 : 0); x < w / 2; x += 56) {
      ctx.moveTo(x, y); ctx.lineTo(x, y + face / 3)
    }
  }
  ctx.stroke()
  for (let x = -w / 2 + 5; x < w / 2 - 8; x += blue ? 39 : 52) {
    const size = blue ? 25 : 32
    rect(ctx, x, -face / 2 - 3, size, 12, blue ? "#d7f0f4" : "#90928e")
    rect(ctx, x + 3, -face / 2 - 3, size - 3, 3, blue ? "#f2ffff" : "#a0a19b")
    if (blue && topple < 0.3) rect(ctx, x, face / 2 - 9, size, 10, "#b4daef")
    if (topple > 0.3) rect(ctx, x + 7, -face / 2 + 32, 7, 12, blue ? "#718f9d" : "#535953")
  }
}

function turret(ctx: CanvasRenderingContext2D, w: number, h: number, topple: number) {
  const r = Math.min(w, h) / 2
  if (topple > 0.2) {
    const length = h * (0.7 + topple * 1.1)
    rect(ctx, -r, -length, r * 2, length, "#757974")
    rect(ctx, -r + 10, -length, r * 0.35, length, "#8a8e87")
    rect(ctx, r * 0.55, -length, r * 0.45, length, "#626862")
    for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) {
      rect(ctx, -r + 20 + col * r * 0.57, -length + 18 + row * length / 5, 9, 7, "#a0a29a66")
    }
    ctx.fillStyle = "#414843"; ctx.beginPath(); ctx.ellipse(0, -length, r, r * 0.45, 0, 0, TAU); ctx.fill()
    ctx.strokeStyle = "#969a92"; ctx.lineWidth = 6; ctx.stroke()
    ctx.fillStyle = "#82857e"; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.45, 0, 0, TAU); ctx.fill()
    return
  }
  disc(ctx, 6, 8, r + 2, "#26302233"); disc(ctx, 0, 0, r, "#737970"); disc(ctx, -2, -2, r - 10, "#92958b")
  disc(ctx, 0, 1, r - 19, "#797e75")
  ctx.strokeStyle = "#696f67"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r - 9, 0, TAU); ctx.stroke()
  for (let i = 0; i < 10; i++) {
    ctx.save(); ctx.rotate(i * TAU / 10); rect(ctx, -10, -r, 20, 12, i < 5 ? "#92958c" : "#858980"); ctx.restore()
  }
}

function tower(ctx: CanvasRenderingContext2D, w: number, h: number, topple: number) {
  if (topple < 0.2) { roof(ctx, w * 0.9, h * 0.9, false); return }
  // A fallen tower exposes its pale drum and red conical roof on the ground.
  const length = h * (0.4 + topple * 1.3), bottom = h * 0.45, top = bottom - length
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0)
  g.addColorStop(0, "#458cb7"); g.addColorStop(0.3, "#d9eef1"); g.addColorStop(0.65, "#edf7f5"); g.addColorStop(1, "#9ac6db")
  ctx.fillStyle = g; ctx.fillRect(-w / 2, top, w, length)
  for (let row = 0; row < 4; row++) {
    rect(ctx, -w / 2, top + row * length / 4, w, 8, row % 2 ? "#659dc3" : "#b9d8e3")
    for (let col = 0; col < 4; col++) rect(ctx, -w * 0.39 + col * w * 0.24, top + 13 + row * length / 4, 7, 11, "#607e90")
  }
  const tip = top - h * (0.5 + topple * 0.9)
  polygon(ctx, [[-w * 0.56, top], [0, tip], [0, top + 7]], "#a64232")
  polygon(ctx, [[0, top + 7], [0, tip], [w * 0.56, top]], "#772a27")
  polygon(ctx, [[-7, tip + 23], [0, tip - 5], [7, tip + 23]], "#c4a74d")
  rect(ctx, -w / 2, bottom - 9, w, 12, "#4e8eb6")
  for (let i = 0; i < 3; i++) rect(ctx, -w * 0.28 + i * w * 0.21, top - 12 - i * 17, 5, 4, "#c071535c")
}

function rock(ctx: CanvasRenderingContext2D, w: number, h: number, id: string) {
  const seed = Array.from(id).reduce((a, c) => a + c.charCodeAt(0), 0)
  const points = Array.from({ length: 11 }, (_, i) => {
    const a = i * TAU / 11, r = 0.43 + Math.sin(seed + i * 7) * 0.055
    return [Math.cos(a) * w * r, Math.sin(a) * h * r]
  })
  ctx.save(); ctx.translate(5, 8); polygon(ctx, points, "#2c3e2933"); ctx.restore()
  polygon(ctx, points, "#b6beb0")
  for (let i = 0; i < points.length; i++) {
    polygon(ctx, [points[i], points[(i + 1) % points.length], [-w * 0.12, -h * 0.14]],
      ["#c4cbbb", "#cbd1c3", "#b8c0b1", "#a5ae9f", "#b3bcac"][i % 5])
  }
  polygon(ctx, [[-w * 0.25, -h * 0.15], [-w * 0.04, -h * 0.33], [w * 0.2, -h * 0.1], [w * 0.12, h * 0.16], [-w * 0.15, h * 0.15]], "#c3cbbd")
  ctx.strokeStyle = "#e3e6d747"; ctx.lineWidth = 3; ctx.stroke()
}

export function paintPiece(ctx: CanvasRenderingContext2D, p: CastlePiece): void {
  const w = p.halfWMm * 2, h = p.halfHMm * 2
  switch (p.kind) {
    case "rock": rock(ctx, w, h, p.id); break
    case "wall": wall(ctx, w, h, false, p.topple); break
    case "castle-wall": wall(ctx, w, h, true, p.topple); break
    case "turret": turret(ctx, w, h, p.topple); break
    case "tower": tower(ctx, w, h, p.topple); break
    case "roof": roof(ctx, w, h, true); break
    case "keep":
      rect(ctx, -w / 2 + 9, -h / 2 + 12, w, h, "#29372740")
      rect(ctx, -w / 2, -h / 2, w, h, "#8a8d82")
      rect(ctx, -w / 2 + 27, -h / 2 + 27, w - 54, h - 54, "#497eb1")
      ctx.strokeStyle = "#c0d9e3"; ctx.lineWidth = 10; ctx.strokeRect(-w / 2 + 18, -h / 2 + 18, w - 36, h - 36)
      for (const x of [-w / 2, w / 2 - 62]) for (const y of [-h / 2, h / 2 - 62]) {
        rect(ctx, x - 4, y - 4, 70, 70, "#b5c6c5"); rect(ctx, x, y, 60, 60, "#f0f3e9")
        rect(ctx, x + 5, y + 5, 48, 6, "#ffffff")
      }
      break
    case "ramp":
      rect(ctx, -w / 2, -h / 2, w, h, "#8d8c82")
      for (let x = -w / 2; x < w / 2; x += 22) {
        rect(ctx, x, -h / 2, 3, h, "#6f756c"); rect(ctx, x + 4, -h / 2 + 5, 3, h - 10, "#aaa99e")
      }
      break
    case "tree":
      rect(ctx, -8, 0, 16, h * 0.6, "#695239")
      for (let i = 0; i < 7; i++) disc(ctx, Math.cos(i * TAU / 7) * w * 0.2, Math.sin(i * TAU / 7) * h * 0.2, w * 0.27,
        i % 2 ? "#345a2f" : "#557845")
      disc(ctx, -5, -8, w * 0.25, "#62824b")
      break
  }
}
