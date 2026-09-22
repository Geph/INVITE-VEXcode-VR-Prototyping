/**
 * Room-based WebSocket relay: shared Blockly XML + live cursors/selection.
 */
import http from "node:http"
import os from "node:os"
import { WebSocketServer } from "ws"

const host = process.env.HOST ?? "0.0.0.0"
const port = Number(process.env.PORT ?? 1234)

function lanAddresses() {
  const ips = new Set()
  for (const ifaces of Object.values(os.networkInterfaces())) {
    if (!ifaces) continue
    for (const iface of ifaces) {
      const v4 = iface.family === "IPv4" || iface.family === 4
      if (v4 && !iface.internal) ips.add(iface.address)
    }
  }
  return [...ips]
}

/** @type {Map<string, { latestXml: string | null, clients: Map<WebSocket, { id: string, name: string, color: string }> }>} */
const rooms = new Map()
let nextClientId = 1

function getRoomId(req) {
  const pathname = new URL(req.url ?? "/", "http://x").pathname
  const id = decodeURIComponent(pathname.replace(/^\//, "")).trim()
  return id || "default"
}

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { latestXml: null, clients: new Map() })
  }
  return rooms.get(roomId)
}

function peerList(room) {
  return [...room.clients.values()].map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
  }))
}

function broadcast(roomId, payload, except) {
  const room = rooms.get(roomId)
  if (!room) return
  const text = typeof payload === "string" ? payload : JSON.stringify(payload)
  for (const [socket] of room.clients) {
    if (socket !== except && socket.readyState === 1) socket.send(text)
  }
}

function broadcastPresence(roomId) {
  const room = rooms.get(roomId)
  if (!room) return
  broadcast(roomId, { type: "presence", peers: peerList(room) })
}

function sendWorkspace(ws, xml) {
  if (xml && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: "workspace", xml }))
  }
}

const httpServer = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" })
  res.end("VEX Blockly collaboration server\n")
})

const wss = new WebSocketServer({ noServer: true })

wss.on("connection", (ws, req) => {
  const roomId = getRoomId(req)
  const room = getRoom(roomId)
  const clientId = `p${nextClientId++}`
  room.clients.set(ws, { id: clientId, name: "Learner", color: "#94a3b8" })

  ws.send(JSON.stringify({ type: "welcome", id: clientId }))
  broadcastPresence(roomId)
  sendWorkspace(ws, room.latestXml)

  ws.on("message", (raw) => {
    let parsed
    try {
      parsed = JSON.parse(raw.toString())
    } catch {
      return
    }

    const meta = room.clients.get(ws)
    if (!meta) return

    switch (parsed.type) {
      case "presence":
        meta.name = typeof parsed.name === "string" ? parsed.name : meta.name
        meta.color = typeof parsed.color === "string" ? parsed.color : meta.color
        broadcastPresence(roomId)
        break

      case "request-sync":
        sendWorkspace(ws, room.latestXml)
        break

      case "workspace":
        if (typeof parsed.xml === "string") {
          room.latestXml = parsed.xml
          broadcast(roomId, { type: "workspace", xml: parsed.xml }, ws)
        }
        break

      case "cursor":
        broadcast(
          roomId,
          {
            type: "cursor",
            id: meta.id,
            name: meta.name,
            color: meta.color,
            x: parsed.x,
            y: parsed.y,
            visible: parsed.visible !== false,
          },
          ws,
        )
        break

      case "selection":
        broadcast(
          roomId,
          {
            type: "selection",
            id: meta.id,
            name: meta.name,
            color: meta.color,
            blockIds: Array.isArray(parsed.blockIds) ? parsed.blockIds : [],
          },
          ws,
        )
        break

      default:
        break
    }
  })

  ws.on("close", () => {
    const meta = room.clients.get(ws)
    room.clients.delete(ws)
    if (room.clients.size === 0) {
      rooms.delete(roomId)
    } else {
      broadcastPresence(roomId)
      if (meta) {
        broadcast(roomId, {
          type: "cursor",
          id: meta.id,
          visible: false,
        })
        broadcast(roomId, {
          type: "selection",
          id: meta.id,
          blockIds: [],
        })
      }
    }
  })
})

httpServer.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request)
  })
})

httpServer.listen(port, host, () => {
  console.log(`Collaboration WebSocket listening on port ${port} (all interfaces)`)
  console.log(`  Local:   ws://localhost:${port}/<room-id>`)
  for (const ip of lanAddresses()) {
    console.log(`  Network: ws://${ip}:${port}/<room-id>`)
  }
})
