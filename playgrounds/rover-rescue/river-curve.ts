import type { Vec2 } from "@/engine"

/** Smooth the editable survey handles before deriving either visible or lethal banks. */
export function sampleRiverCurve(handles: readonly Vec2[]): Vec2[] {
  if (handles.length < 3) return handles.map(p => ({ ...p }))
  const out: Vec2[] = []
  for (let i = 0; i < handles.length - 1; i++) {
    const a = handles[Math.max(0, i - 1)]
    const b = handles[i]
    const c = handles[i + 1]
    const d = handles[Math.min(handles.length - 1, i + 2)]
    const steps = Math.min(32, Math.max(8, Math.ceil(Math.hypot(c.x - b.x, c.y - b.y) / 80)))
    for (let j = 0; j < steps; j++) {
      const t = j / steps
      const t2 = t * t
      const t3 = t2 * t
      const interpolate = (p0: number, p1: number, p2: number, p3: number) =>
        (2 * t3 - 3 * t2 + 1) * p1 + (t3 - 2 * t2 + t) * (p2 - p0) * 0.5 +
        (-2 * t3 + 3 * t2) * p2 + (t3 - t2) * (p3 - p1) * 0.5
      out.push({ x: interpolate(a.x, b.x, c.x, d.x), y: interpolate(a.y, b.y, c.y, d.y) })
    }
  }
  out.push({ ...handles[handles.length - 1] })
  return out
}

/** Continue the channel beyond its survey endpoints so bank caps sit off the map. */
export function sampleRiverChannel(handles: readonly Vec2[], widthMm: number): Vec2[] {
  const points = sampleRiverCurve(handles)
  if (points.length < 2) return points
  const first = points[0], last = points[points.length - 1]
  const after = points.find(p => p.x !== first.x || p.y !== first.y)
  const before = points.slice().reverse().find(p => p.x !== last.x || p.y !== last.y)
  if (!after || !before) return points
  const extend = (end: Vec2, inside: Vec2): Vec2 => {
    const dx = end.x - inside.x, dy = end.y - inside.y
    const scale = widthMm * 2 / Math.hypot(dx, dy)
    return { x: end.x + dx * scale, y: end.y + dy * scale }
  }
  return [extend(first, after), ...points, extend(last, before)]
}
