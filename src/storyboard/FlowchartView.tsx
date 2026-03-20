import './FlowchartView.css'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface FlowNode {
  id: string
  label: string
  type: string
  screenId?: string
  imageUrl?: string
  x: number
  y: number
  width: number
  height: number
}

export interface FlowEdge {
  id: string
  from: string
  to: string
  label?: string
}

export interface FlowchartData {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

// ── Storage ───────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'sb_flowchart'

export function saveFlowchart(data: FlowchartData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function loadFlowchart(): FlowchartData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as FlowchartData
  } catch {}
  return null
}

// ── Auto Layout ───────────────────────────────────────────────────────────────
export function autoLayout(nodes: FlowNode[], edges: FlowEdge[]): Map<string, { x: number; y: number }> {
  const inDegree = new Map<string, number>()
  nodes.forEach(n => inDegree.set(n.id, 0))
  edges.forEach(e => inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1))
  const depth = new Map<string, number>()
  const roots = nodes.filter(n => (inDegree.get(n.id) ?? 0) === 0)
  const queue: Array<{ id: string; d: number }> = roots.map(n => ({ id: n.id, d: 0 }))
  while (queue.length > 0) {
    const { id, d } = queue.shift()!
    if ((depth.get(id) ?? -1) >= d) continue
    depth.set(id, d)
    edges.filter(e => e.from === id).forEach(e => queue.push({ id: e.to, d: d + 1 }))
  }
  nodes.forEach((n, i) => { if (!depth.has(n.id)) depth.set(n.id, i) })
  const layers = new Map<number, string[]>()
  nodes.forEach(n => {
    const d = depth.get(n.id) ?? 0
    if (!layers.has(d)) layers.set(d, [])
    layers.get(d)!.push(n.id)
  })
  const NODE_W = 180, NODE_H = 110, COL_GAP = 100, ROW_GAP = 70, MARGIN = 60
  const positions = new Map<string, { x: number; y: number }>()
  let col = 0
  for (const [, nodeIds] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
    nodeIds.forEach((id, row) => {
      positions.set(id, { x: MARGIN + col * (NODE_W + COL_GAP), y: MARGIN + row * (NODE_H + ROW_GAP) })
    })
    col++
  }
  return positions
}

// ── Edge Path ─────────────────────────────────────────────────────────────────
function edgePath(from: FlowNode, to: FlowNode): string {
  const fx = from.x + from.width, fy = from.y + from.height / 2
  const tx = to.x, ty = to.y + to.height / 2
  const cx = (fx + tx) / 2
  return `M ${fx} ${fy} C ${cx} ${fy} ${cx} ${ty} ${tx} ${ty}`
}

// ── Node type colors ──────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  screen: '#4F46E5',
  process: '#0891B2',
  decision: '#D97706',
  start: '#16A34A',
  end: '#DC2626',
}

function getTypeColor(type: string): string {
  return TYPE_COLORS[type] ?? '#6b7280'
}

// ── FlowchartView Component ───────────────────────────────────────────────────
export default function FlowchartView() {
  const data = loadFlowchart()

  if (!data || data.nodes.length === 0) {
    return (
      <div className="fc-wrap" style={{ minHeight: 400 }}>
        <div className="fc-empty">
          <svg className="fc-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="fc-empty-title">플로우차트가 없습니다</div>
          <div className="fc-empty-sub">스토리보드 탭에서 자동 기획을 실행하면 플로우차트가 자동으로 생성됩니다</div>
        </div>
      </div>
    )
  }

  const { nodes, edges } = data

  // Calculate canvas size
  const maxX = Math.max(...nodes.map(n => n.x + n.width)) + 60
  const maxY = Math.max(...nodes.map(n => n.y + n.height)) + 60

  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  return (
    <div className="fc-wrap" style={{ minHeight: 400 }}>
      <div className="fc-canvas" style={{ width: maxX, height: maxY }}>
        {/* SVG layer for edges */}
        <svg className="fc-svg" style={{ width: maxX, height: maxY }}>
          <defs>
            <marker
              id="fc-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0 0 L0 6 L8 3 z" fill="#9ca3af" />
            </marker>
          </defs>
          {edges.map(edge => {
            const fromNode = nodeMap.get(edge.from)
            const toNode = nodeMap.get(edge.to)
            if (!fromNode || !toNode) return null
            const d = edgePath(fromNode, toNode)
            const midX = (fromNode.x + fromNode.width + toNode.x) / 2
            const midY = (fromNode.y + fromNode.height / 2 + toNode.y + toNode.height / 2) / 2
            return (
              <g key={edge.id}>
                <path
                  d={d}
                  fill="none"
                  stroke="#d1d5db"
                  strokeWidth="1.5"
                  markerEnd="url(#fc-arrow)"
                />
                {edge.label && (
                  <text
                    x={midX}
                    y={midY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fc-edge-label"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Node cards */}
        {nodes.map(node => (
          <div
            key={node.id}
            className="fc-node"
            style={{
              left: node.x,
              top: node.y,
              width: node.width,
              height: node.height,
            }}
          >
            {node.imageUrl && (
              <img
                src={node.imageUrl}
                alt={node.label}
                className="fc-node-img"
              />
            )}
            <div className="fc-node-body">
              <div className="fc-node-name">{node.label}</div>
              <div className="fc-node-meta">
                <span
                  className="fc-type-dot"
                  style={{ background: getTypeColor(node.type) }}
                />
                <span className="fc-type-label">{node.type}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
