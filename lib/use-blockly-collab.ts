"use client"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"

export interface CollabPeer {
  id: string
  name: string
  color: string
  cursor: { x: number; y: number } | null
  selectedBlockIds: string[]
}

export interface CollabState {
  connected: boolean
  synced: boolean
  peers: CollabPeer[]
  roomId: string
  localId: string
  localName: string
  localColor: string
  error: string | null
}

const PEER_COLORS = ["#E74C3C", "#3498DB", "#27AE60", "#F39C12", "#9B59B6", "#1ABC9C"]

function randomPeerName(): string {
  return `Learner ${Math.floor(100 + Math.random() * 900)}`
}

export function getCollabRoomFromUrl(): string {
  if (typeof window === "undefined") return "default"
  const room = new URLSearchParams(window.location.search).get("room")?.trim()
  return room || "default"
}

export function collabWsUrl(roomId: string): string {
  const path = encodeURIComponent(roomId)

  if (typeof window !== "undefined") {
    const envBase = process.env.NEXT_PUBLIC_COLLAB_WS_URL?.replace(/\/$/, "")
    if (envBase) return `${envBase}/${path}`

    const collabPort = process.env.NEXT_PUBLIC_COLLAB_WS_PORT ?? "1234"
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    return `${protocol}//${window.location.hostname}:${collabPort}/${path}`
  }

  const base = process.env.NEXT_PUBLIC_COLLAB_WS_URL?.replace(/\/$/, "") ?? "ws://localhost:1234"
  return `${base}/${path}`
}

type BlocklyWorkspace = {
  clear: () => void
  getAllBlocks: (ordered: boolean) => { type: string; id: string }[]
  getBlockById: (id: string) => { getSvgRoot?: () => SVGElement | null } | null
  getSelected?: () => { id: string } | null
  newBlock: (type: string) => {
    initSvg: () => void
    render: () => void
    moveBy: (x: number, y: number) => void
    setDeletable: (v: boolean) => void
    setMovable: (v: boolean) => void
  }
  addChangeListener: (cb: (event: { type?: string }) => void) => void
  removeChangeListener: (cb: (event: { type?: string }) => void) => void
}

function ensureWhenStarted(Blockly: typeof window.Blockly, workspace: BlocklyWorkspace) {
  const hasStart = workspace.getAllBlocks(false).some((b) => b.type === "when_started")
  if (hasStart) return
  const whenStarted = workspace.newBlock("when_started")
  whenStarted.initSvg()
  whenStarted.render()
  whenStarted.moveBy(50, 50)
  whenStarted.setDeletable(false)
  whenStarted.setMovable(true)
}

function getSelectedBlockIds(workspace: BlocklyWorkspace): string[] {
  const selected = workspace.getSelected?.()
  return selected?.id ? [selected.id] : []
}

export function useBlocklyCollab(
  workspace: BlocklyWorkspace | null,
  blocklyLoaded: boolean,
  containerRef: RefObject<HTMLElement | null>,
): CollabState {
  const [state, setState] = useState<CollabState>({
    connected: false,
    synced: false,
    peers: [],
    roomId: "default",
    localId: "",
    localName: "",
    localColor: PEER_COLORS[0],
    error: null,
  })

  const applyingRemoteRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cursorThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const localIdRef = useRef("")
  const localNameRef = useRef("")
  const localColorRef = useRef(PEER_COLORS[0])
  const lastXmlRef = useRef("")
  const peersRef = useRef<Map<string, CollabPeer>>(new Map())
  const canPublishRef = useRef(false)
  const receivedWorkspaceRef = useRef(false)

  const updatePeersState = useCallback(() => {
    setState((prev) => ({
      ...prev,
      peers: [...peersRef.current.values()],
    }))
  }, [])

  useEffect(() => {
    if (!workspace || !blocklyLoaded || typeof window === "undefined" || !window.Blockly) return

    const roomId = getCollabRoomFromUrl()
    const localName = randomPeerName()
    const localColor = PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)]
    localNameRef.current = localName
    localColorRef.current = localColor

    const Blockly = window.Blockly
    const url = collabWsUrl(roomId)

    const serializeWorkspace = (): string => {
      const dom = Blockly.Xml.workspaceToDom(workspace)
      return Blockly.Xml.domToText(dom)
    }

    const applyRemoteXml = (xmlText: string) => {
      if (xmlText === lastXmlRef.current) return
      lastXmlRef.current = xmlText
      applyingRemoteRef.current = true
      Blockly.Events.disable()
      try {
        workspace.clear()
        if (xmlText) {
          const dom = Blockly.Xml.textToDom(xmlText)
          Blockly.Xml.domToWorkspace(dom, workspace)
        }
        ensureWhenStarted(Blockly, workspace)
      } finally {
        Blockly.Events.enable()
        applyingRemoteRef.current = false
      }
    }

    const send = (payload: object) => {
      const ws = wsRef.current
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
    }

    const pushLocalXml = () => {
      if (applyingRemoteRef.current || !canPublishRef.current) return
      const xml = serializeWorkspace()
      if (xml === lastXmlRef.current) return
      lastXmlRef.current = xml
      send({ type: "workspace", xml })
    }

    const ensurePeer = (id: string, name?: string, color?: string) => {
      if (!peersRef.current.has(id)) {
        peersRef.current.set(id, {
          id,
          name: name ?? "Learner",
          color: color ?? "#94a3b8",
          cursor: null,
          selectedBlockIds: [],
        })
        updatePeersState()
      }
      return peersRef.current.get(id)!
    }

    const pushSelection = () => {
      if (applyingRemoteRef.current) return
      send({
        type: "selection",
        blockIds: getSelectedBlockIds(workspace),
      })
    }

    const pushCursor = (x: number, y: number, visible: boolean) => {
      send({ type: "cursor", x, y, visible })
    }

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      canPublishRef.current = false
      receivedWorkspaceRef.current = false
      setState((prev) => ({
        ...prev,
        connected: true,
        synced: false,
        roomId,
        localName,
        localColor,
        error: null,
      }))
      send({ type: "presence", name: localName, color: localColor })
      send({ type: "request-sync" })
      setTimeout(() => {
        if (!receivedWorkspaceRef.current) {
          canPublishRef.current = true
          pushLocalXml()
        }
      }, 500)
    }

    ws.onmessage = (event) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(event.data as string)
      } catch {
        return
      }

      if (msg.type === "welcome" && typeof msg.id === "string") {
        localIdRef.current = msg.id
        setState((prev) => ({ ...prev, localId: msg.id as string }))
        return
      }

      if (msg.type === "presence" && Array.isArray(msg.peers)) {
        const remoteIds = new Set<string>()
        for (const p of msg.peers as { id: string; name: string; color: string }[]) {
          if (p.id === localIdRef.current) continue
          remoteIds.add(p.id)
          const existing = peersRef.current.get(p.id)
          peersRef.current.set(p.id, {
            id: p.id,
            name: p.name,
            color: p.color,
            cursor: existing?.cursor ?? null,
            selectedBlockIds: existing?.selectedBlockIds ?? [],
          })
        }
        for (const id of peersRef.current.keys()) {
          if (!remoteIds.has(id)) peersRef.current.delete(id)
        }
        updatePeersState()
        setState((prev) => ({ ...prev, roomId, localName }))
        return
      }

      if (msg.type === "workspace" && typeof msg.xml === "string") {
        receivedWorkspaceRef.current = true
        canPublishRef.current = true
        applyRemoteXml(msg.xml)
        setState((prev) => ({ ...prev, synced: true, roomId, localName }))
        return
      }

      if (msg.type === "cursor" && typeof msg.id === "string" && msg.id !== localIdRef.current) {
        const peer = ensurePeer(
          msg.id as string,
          msg.name as string | undefined,
          msg.color as string | undefined,
        )
        peersRef.current.set(msg.id as string, {
          ...peer,
          cursor:
            msg.visible === false
              ? null
              : {
                  x: Number(msg.x) || 0,
                  y: Number(msg.y) || 0,
                },
        })
        updatePeersState()
        return
      }

      if (msg.type === "selection" && typeof msg.id === "string" && msg.id !== localIdRef.current) {
        const peer = ensurePeer(
          msg.id as string,
          msg.name as string | undefined,
          msg.color as string | undefined,
        )
        peersRef.current.set(msg.id as string, {
          ...peer,
          selectedBlockIds: Array.isArray(msg.blockIds) ? (msg.blockIds as string[]) : [],
        })
        updatePeersState()
      }
    }

    ws.onerror = () => {
      setState((prev) => ({
        ...prev,
        connected: false,
        error: "Could not reach collaboration server — run npm run dev:all",
        roomId,
        localName,
      }))
    }

    ws.onclose = () => {
      peersRef.current.clear()
      setState((prev) => ({
        ...prev,
        connected: false,
        synced: false,
        peers: [],
        roomId,
        localName,
      }))
    }

    let selectionDebounce: ReturnType<typeof setTimeout> | null = null

    const onWorkspaceChange = () => {
      if (applyingRemoteRef.current) return
      if (selectionDebounce) clearTimeout(selectionDebounce)
      selectionDebounce = setTimeout(pushSelection, 80)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(pushLocalXml, 150)
    }

    workspace.addChangeListener(onWorkspaceChange)

    const container = containerRef.current
    const onMouseMove = (e: MouseEvent) => {
      if (!container) return
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      if (cursorThrottleRef.current) return
      cursorThrottleRef.current = setTimeout(() => {
        cursorThrottleRef.current = null
        pushCursor(x, y, true)
      }, 40)
    }

    const onMouseLeave = () => pushCursor(0, 0, false)

    container?.addEventListener("mousemove", onMouseMove)
    container?.addEventListener("mouseleave", onMouseLeave)

    return () => {
      workspace.removeChangeListener(onWorkspaceChange)
      if (selectionDebounce) clearTimeout(selectionDebounce)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (cursorThrottleRef.current) clearTimeout(cursorThrottleRef.current)
      container?.removeEventListener("mousemove", onMouseMove)
      container?.removeEventListener("mouseleave", onMouseLeave)
      pushCursor(0, 0, false)
      ws.close()
      wsRef.current = null
      peersRef.current.clear()
    }
  }, [workspace, blocklyLoaded, containerRef, updatePeersState])

  return state
}
