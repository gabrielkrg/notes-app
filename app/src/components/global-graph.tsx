import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { buildNoteGraph, groupLinkCounts, type GraphEdge, type GraphNode, type Pages } from '@/content.ts'
import { cn } from '@/lib/utils'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 4

type SimNode = GraphNode & { x: number; y: number; vx: number; vy: number; fixed: boolean }
type SimLink = { source: SimNode; target: SimNode }
type View = { x: number; y: number; k: number }
type Drag =
  | { kind: 'node'; id: string; pointerId: number; x: number; y: number; moved: boolean }
  | { kind: 'pan'; pointerId: number; x: number; y: number; view: View; moved?: boolean }

function groupFill(group: string) {
  if (!group) return 'var(--muted-foreground)'
  let hash = 2166136261
  for (let i = 0; i < group.length; i += 1) {
    hash ^= group.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `oklch(0.58 0.13 ${Math.abs(hash) % 360})`
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function groupLabel(group: string, pages: Pages) {
  if (!group) return 'Root'
  const index = pages[`${group}/index.md`] || pages[`${group}/index.txt`] || pages[`${group}/index.html`]
  if (index?.navLabel || index?.title) return index.navLabel || index.title
  return group.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function seedPositions(nodes: GraphNode[], width: number, height: number): SimNode[] {
  const cx = width / 2
  const cy = height / 2
  const groups: string[] = []
  const members = new Map<string, GraphNode[]>()
  for (const node of nodes) {
    if (!members.has(node.group)) {
      members.set(node.group, [])
      groups.push(node.group)
    }
    members.get(node.group)!.push(node)
  }

  const ring = Math.min(width, height) * 0.32
  const placed = new Map<string, SimNode>()
  groups.forEach((group, groupIndex) => {
    const angle = (groupIndex / Math.max(groups.length, 1)) * Math.PI * 2
    const gx = cx + Math.cos(angle) * ring
    const gy = cy + Math.sin(angle) * ring
    const bunch = members.get(group) || []
    const spread = 18 + bunch.length * 6
    bunch.forEach((node, index) => {
      const local = (index / Math.max(bunch.length, 1)) * Math.PI * 2
      placed.set(node.id, {
        ...node,
        x: gx + Math.cos(local) * spread,
        y: gy + Math.sin(local) * spread,
        vx: 0,
        vy: 0,
        fixed: false,
      })
    })
  })
  return nodes.map((node) => placed.get(node.id)!).filter(Boolean)
}

function tick(sim: SimNode[], links: SimLink[], width: number, height: number) {
  const cx = width / 2
  const cy = height / 2
  const count = sim.length
  const repulsion = 2800
  const spring = 0.02
  const rest = 112
  const center = 0.006
  const damp = 0.86
  const padding = 36

  for (let i = 0; i < count; i += 1) {
    const a = sim[i]
    for (let j = i + 1; j < count; j += 1) {
      const b = sim[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist2 = dx * dx + dy * dy || 1
      const dist = Math.sqrt(dist2)
      const overlap = dist - padding
      const collide = overlap < 0 ? overlap * 0.08 : 0
      const force = repulsion / dist2 - collide
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      if (!a.fixed) {
        a.vx -= fx
        a.vy -= fy
      }
      if (!b.fixed) {
        b.vx += fx
        b.vy += fy
      }
    }
    if (!a.fixed) {
      a.vx += (cx - a.x) * center
      a.vy += (cy - a.y) * center
    }
  }

  for (const link of links) {
    const dx = link.target.x - link.source.x
    const dy = link.target.y - link.source.y
    const dist = Math.hypot(dx, dy) || 1
    const force = (dist - rest) * spring
    const fx = (dx / dist) * force
    const fy = (dy / dist) * force
    if (!link.source.fixed) {
      link.source.vx += fx
      link.source.vy += fy
    }
    if (!link.target.fixed) {
      link.target.vx -= fx
      link.target.vy -= fy
    }
  }

  for (const node of sim) {
    if (node.fixed) continue
    node.vx *= damp
    node.vy *= damp
    node.x += node.vx
    node.y += node.vy
  }
}

function screenToWorld(event: { clientX: number; clientY: number }, svg: SVGSVGElement, view: View) {
  const rect = svg.getBoundingClientRect()
  return {
    x: (event.clientX - rect.left - view.x) / view.k,
    y: (event.clientY - rect.top - view.y) / view.k,
  }
}

export function GlobalGraph({ pages, onGo }: { pages: Pages; onGo: (route: string) => void }) {
  const graph = useMemo(() => buildNoteGraph(pages), [pages])
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<SimNode[]>([])
  const viewRef = useRef<View>({ x: 0, y: 0, k: 1 })
  const dragRef = useRef<Drag | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [nodes, setNodes] = useState<SimNode[]>([])
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 })
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [hoverGroup, setHoverGroup] = useState<string | null>(null)

  const degree = useMemo(() => {
    const counts = new Map(graph.nodes.map((node) => [node.id, 0]))
    for (const edge of graph.edges) {
      counts.set(edge.source, (counts.get(edge.source) || 0) + 1)
      counts.set(edge.target, (counts.get(edge.target) || 0) + 1)
    }
    return counts
  }, [graph])

  const linked = useMemo(() => {
    const map = new Map(graph.nodes.map((node) => [node.id, new Set()]))
    for (const edge of graph.edges) {
      map.get(edge.source)?.add(edge.target)
      map.get(edge.target)?.add(edge.source)
    }
    return map
  }, [graph])

  const groups = useMemo(() => {
    const seen: string[] = []
    for (const node of graph.nodes) {
      if (!seen.includes(node.group)) seen.push(node.group)
    }
    return seen
  }, [graph.nodes])

  const linkCounts = useMemo(() => groupLinkCounts(graph), [graph])
  const groupOf = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node.group])),
    [graph.nodes],
  )

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (!box) return
      setSize({ width: box.width, height: box.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!size.width || !size.height || graph.nodes.length === 0) {
      simRef.current = []
      setNodes([])
      return undefined
    }

    const sim = seedPositions(graph.nodes, size.width, size.height)
    const byId = new Map(sim.map((node) => [node.id, node]))
    const links = graph.edges
      .map((edge) => ({
        source: byId.get(edge.source),
        target: byId.get(edge.target),
      }))
      .filter((edge): edge is SimLink => Boolean(edge.source && edge.target))

    const steps = prefersReducedMotion() ? 180 : 40
    for (let i = 0; i < steps; i += 1) tick(sim, links, size.width, size.height)
    simRef.current = sim
    setNodes(sim.map((node) => ({ ...node })))

    if (prefersReducedMotion()) return undefined

    let frame = 0
    let ticks = 0
    const run = () => {
      ticks += 1
      tick(sim, links, size.width, size.height)
      if (ticks % 2 === 0) setNodes(sim.map((node) => ({ ...node })))
      if (ticks < 220) frame = window.requestAnimationFrame(run)
    }
    frame = window.requestAnimationFrame(run)
    return () => window.cancelAnimationFrame(frame)
  }, [graph, size.width, size.height])

  useEffect(() => {
    viewRef.current = view
  }, [view])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined
    const wrap = el
    function onWheel(event: WheelEvent) {
      event.preventDefault()
      const current = viewRef.current
      const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08
      const nextK = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.k * factor))
      const rect = wrap.getBoundingClientRect()
      const mx = event.clientX - rect.left
      const my = event.clientY - rect.top
      const next = {
        k: nextK,
        x: mx - ((mx - current.x) / current.k) * nextK,
        y: my - ((my - current.y) / current.k) * nextK,
      }
      viewRef.current = next
      setView(next)
    }
    wrap.addEventListener('wheel', onWheel, { passive: false })
    return () => wrap.removeEventListener('wheel', onWheel)
  }, [graph.nodes.length])

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return
    const svg = svgRef.current
    const target = event.target
    const id = target instanceof SVGElement ? target.dataset.nodeId : null
    if (id) {
      const node = simRef.current.find((item) => item.id === id)
      if (!node) return
      node.fixed = true
      dragRef.current = {
        kind: 'node',
        id,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        moved: false,
      }
    } else {
      dragRef.current = {
        kind: 'pan',
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        view: { ...viewRef.current },
      }
    }
    svg?.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 3) drag.moved = true
    if (drag.kind === 'pan') {
      const next = {
        ...drag.view,
        x: drag.view.x + (event.clientX - drag.x),
        y: drag.view.y + (event.clientY - drag.y),
      }
      viewRef.current = next
      setView(next)
      return
    }
    const svg = svgRef.current
    if (!svg) return
    const world = screenToWorld(event, svg, viewRef.current)
    const node = simRef.current.find((item) => item.id === drag.id)
    if (!node) return
    node.x = world.x
    node.y = world.y
    node.vx = 0
    node.vy = 0
    setNodes(simRef.current.map((item) => ({ ...item })))
  }

  function onPointerUp(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (drag.kind === 'node') {
      const node = simRef.current.find((item) => item.id === drag.id)
      if (node) node.fixed = false
      if (!drag.moved && node) onGo(node.route)
    }
    dragRef.current = null
  }

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  const hoveredNodeGroup = hoverId ? groupOf.get(hoverId) : null
  const neighborSet = hoverId ? new Set([hoverId, ...(linked.get(hoverId) || [])]) : null

  function nodeActive(node: SimNode) {
    if (hoverGroup !== null) return node.group === hoverGroup
    if (neighborSet) return neighborSet.has(node.id)
    return true
  }

  function edgeRole(edge: GraphEdge) {
    if (hoverGroup !== null) {
      const sourceIn = groupOf.get(edge.source) === hoverGroup
      const targetIn = groupOf.get(edge.target) === hoverGroup
      if (sourceIn && targetIn) return 'internal'
      if (sourceIn || targetIn) return 'incident'
      return 'off'
    }
    if (neighborSet) {
      return neighborSet.has(edge.source) && neighborSet.has(edge.target) ? 'on' : 'off'
    }
    return 'on'
  }

  const noteCount = graph.nodes.length
  const linkCount = graph.edges.length
  const noteLabel = `${noteCount} ${noteCount === 1 ? 'note' : 'notes'}`
  const linkLabel = `${linkCount} ${linkCount === 1 ? 'link' : 'links'}`

  if (noteCount === 0) {
    return (
      <div className="absolute inset-0 overflow-auto bg-background">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-6 py-8">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Notes
          </p>
          <h1 className="font-heading text-3xl font-medium tracking-tight">Graph</h1>
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex min-h-0 flex-col bg-background">
      <header className="grid shrink-0 gap-2 border-b px-6 pt-8 pb-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Notes
        </p>
        <h1 className="font-heading text-3xl font-medium tracking-tight">Graph</h1>
        <p className="text-sm text-muted-foreground">
          {noteLabel} · {linkLabel}. Click a note to open it.
        </p>
      </header>
      <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden">
        <Card size="sm" className="absolute top-4 right-4 z-10 w-60">
          <CardHeader>
            <CardTitle>Folders</CardTitle>
            <CardDescription>Hover a folder to isolate its notes and links.</CardDescription>
          </CardHeader>
          <ul className="grid gap-0.5 px-2 pb-3">
            {groups.map((group) => {
              const count = linkCounts.get(group) || 0
              const active = hoverGroup === group || hoveredNodeGroup === group
              return (
                <li key={group || 'root'}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/40',
                      active && 'bg-muted/40',
                    )}
                    onPointerEnter={() => setHoverGroup(group)}
                    onPointerLeave={() => setHoverGroup((current) => (current === group ? null : current))}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full ring-1 ring-foreground/10"
                      style={{ background: groupFill(group) }}
                    />
                    <span className="min-w-0 flex-1 truncate">{groupLabel(group, pages)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {count} {count === 1 ? 'link' : 'links'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
        <svg
          ref={svgRef}
          className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
          role="img"
          aria-label="Note link graph"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {graph.edges.map((edge) => {
              const source = byId.get(edge.source)
              const target = byId.get(edge.target)
              if (!source || !target) return null
              const role = edgeRole(edge)
              const on = role !== 'off'
              return (
                <line
                  key={`${edge.source}->${edge.target}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  className={role === 'internal' ? 'stroke-foreground' : 'stroke-border'}
                  strokeWidth={role === 'internal' ? 2 : on ? 1.4 : 1}
                  opacity={role === 'internal' ? 0.95 : role === 'incident' ? 0.35 : on ? 0.9 : 0.08}
                />
              )
            })}
            {nodes.map((node) => {
              const active = nodeActive(node)
              const hovered = hoverId === node.id
              const radius = 5 + Math.min(degree.get(node.id) || 0, 7)
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x} ${node.y})`}
                  opacity={active ? 1 : 0.1}
                >
                  <circle
                    r={radius}
                    fill={groupFill(node.group)}
                    stroke="var(--background)"
                    strokeWidth="2"
                    data-node-id={node.id}
                    className="cursor-pointer"
                    onPointerEnter={() => setHoverId(node.id)}
                    onPointerLeave={() => setHoverId((current) => (current === node.id ? null : current))}
                  />
                  <text
                    y={radius + 14}
                    textAnchor="middle"
                    className="pointer-events-none font-sans"
                    fill="var(--foreground)"
                    stroke="var(--background)"
                    strokeWidth={hovered ? 4 : 3}
                    paintOrder="stroke"
                    fontSize={hovered ? 12 : 11}
                    fontWeight={hovered ? 500 : 400}
                  >
                    {node.title}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
      </div>
    </div>
  )
}
