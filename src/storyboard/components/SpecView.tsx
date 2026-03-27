import { useState, useEffect, useCallback, useRef } from 'react'
import { FigmaFrame } from '../types'
import { parseFigmaUrl } from '../figmaUtils'
import './SpecView.css'

// ── Types ────────────────────────────────────────────────────────────────────
type BBox = { x: number; y: number; width: number; height: number }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FNode = Record<string, any> & {
  id: string; name: string; type: string
  absoluteBoundingBox?: BBox
  children?: FNode[]
}
interface NodeInfo { node: FNode; depth: number; parent: FNode | null }

// ── API ──────────────────────────────────────────────────────────────────────
async function fetchTree(figmaUrl: string, token: string): Promise<FNode | null> {
  const parsed = parseFigmaUrl(figmaUrl)
  if (!parsed?.nodeId) return null
  const res = await fetch(
    `https://api.figma.com/v1/files/${parsed.fileKey}/nodes?ids=${encodeURIComponent(parsed.nodeId)}`,
    { headers: { 'X-Figma-Token': token } },
  )
  if (!res.ok) throw new Error(`Figma API ${res.status}`)
  const data = await res.json()
  return data.nodes?.[parsed.nodeId]?.document ?? null
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function buildList(root: FNode, maxDepth = 4): NodeInfo[] {
  const list: NodeInfo[] = []
  function walk(node: FNode, depth: number, parent: FNode | null) {
    if (node.absoluteBoundingBox) list.push({ node, depth, parent })
    if (depth < maxDepth && node.children) {
      for (const c of node.children) walk(c, depth + 1, node)
    }
  }
  walk(root, 0, null)
  return list
}

function hitTest(nodes: NodeInfo[], frameBox: BBox, relX: number, relY: number): NodeInfo | null {
  const fw = frameBox.width, fh = frameBox.height
  let best: NodeInfo | null = null
  for (const info of nodes) {
    const b = info.node.absoluteBoundingBox!
    const nx = (b.x - frameBox.x) / fw, ny = (b.y - frameBox.y) / fh
    const nw = b.width / fw, nh = b.height / fh
    if (relX >= nx && relX <= nx + nw && relY >= ny && relY <= ny + nh) {
      if (!best || info.depth > best.depth) best = info
    }
  }
  return best
}

function toPct(bbox: BBox, frameBox: BBox) {
  return {
    left:   ((bbox.x - frameBox.x) / frameBox.width)  * 100,
    top:    ((bbox.y - frameBox.y) / frameBox.height) * 100,
    width:  (bbox.width  / frameBox.width)  * 100,
    height: (bbox.height / frameBox.height) * 100,
  }
}

function toPctStyle(bbox: BBox, frameBox: BBox) {
  const p = toPct(bbox, frameBox)
  return { left: `${p.left}%`, top: `${p.top}%`, width: `${p.width}%`, height: `${p.height}%` }
}

function getSpacing(node: FNode, parent: FNode | null) {
  if (!parent?.absoluteBoundingBox || !node.absoluteBoundingBox) return null
  const n = node.absoluteBoundingBox, p = parent.absoluteBoundingBox
  return {
    top:    Math.round(n.y - p.y),
    bottom: Math.round((p.y + p.height) - (n.y + n.height)),
    left:   Math.round(n.x - p.x),
    right:  Math.round((p.x + p.width) - (n.x + n.width)),
  }
}

function toHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
}

// ── Spacing Annotation Chips ─────────────────────────────────────────────────
function SpacingAnnotations({
  nodeBox, parentBox, frameBox, spacing,
}: {
  nodeBox: BBox
  parentBox: BBox | null
  frameBox: BBox
  spacing: { top: number; bottom: number; left: number; right: number }
}) {
  const n = toPct(nodeBox, frameBox)
  const p = parentBox ? toPct(parentBox, frameBox) : null

  type Chip = { value: number; style: React.CSSProperties }
  const chips: Chip[] = []

  if (p && spacing.top > 0) chips.push({
    value: spacing.top,
    style: { left: `${n.left + n.width / 2}%`, top: `${p.top + (n.top - p.top) / 2}%`, transform: 'translate(-50%, -50%)' },
  })
  if (p && spacing.bottom > 0) chips.push({
    value: spacing.bottom,
    style: { left: `${n.left + n.width / 2}%`, top: `${n.top + n.height + (p.top + p.height - n.top - n.height) / 2}%`, transform: 'translate(-50%, -50%)' },
  })
  if (p && spacing.left > 0) chips.push({
    value: spacing.left,
    style: { left: `${p.left + (n.left - p.left) / 2}%`, top: `${n.top + n.height / 2}%`, transform: 'translate(-50%, -50%)' },
  })
  if (p && spacing.right > 0) chips.push({
    value: spacing.right,
    style: { left: `${n.left + n.width + (p.left + p.width - n.left - n.width) / 2}%`, top: `${n.top + n.height / 2}%`, transform: 'translate(-50%, -50%)' },
  })

  return (
    <>
      {chips.map((chip, i) => (
        <div key={i} className="spec-chip" style={chip.style}>{chip.value}</div>
      ))}
      {/* Spacing lines */}
      {p && spacing.top > 0 && (
        <div className="spec-spacing-line vertical" style={{
          left: `${n.left + n.width / 2}%`, top: `${p.top}%`,
          height: `${n.top - p.top}%`, width: 0,
        }} />
      )}
      {p && spacing.bottom > 0 && (
        <div className="spec-spacing-line vertical" style={{
          left: `${n.left + n.width / 2}%`, top: `${n.top + n.height}%`,
          height: `${p.top + p.height - n.top - n.height}%`, width: 0,
        }} />
      )}
      {p && spacing.left > 0 && (
        <div className="spec-spacing-line horizontal" style={{
          top: `${n.top + n.height / 2}%`, left: `${p.left}%`,
          width: `${n.left - p.left}%`, height: 0,
        }} />
      )}
      {p && spacing.right > 0 && (
        <div className="spec-spacing-line horizontal" style={{
          top: `${n.top + n.height / 2}%`, left: `${n.left + n.width}%`,
          width: `${p.left + p.width - n.left - n.width}%`, height: 0,
        }} />
      )}
    </>
  )
}

// ── Node Properties Panel ────────────────────────────────────────────────────
const ALIGN_LABELS: Record<string, string> = {
  MIN: '시작', CENTER: '중앙', MAX: '끝', SPACE_BETWEEN: '균등 분배', BASELINE: '기준선',
}
const TYPE_COLORS: Record<string, string> = {
  FRAME: '#4F46E5', COMPONENT: '#e040fb', INSTANCE: '#a855f7', TEXT: '#0ea5e9',
  RECTANGLE: '#10b981', ELLIPSE: '#10b981', GROUP: '#94a3b8', VECTOR: '#f97316',
}

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="sv-row">
      <span className="sv-label">{label}</span>
      <span className="sv-value">{value}</span>
    </div>
  )
}
function PropSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sv-section">
      <div className="sv-section-title">{title}</div>
      {children}
    </div>
  )
}

function NodePropsPanel({ info }: { info: NodeInfo }) {
  const { node } = info
  const bbox = node.absoluteBoundingBox as BBox | undefined
  const hasLayout = node.layoutMode && node.layoutMode !== 'NONE'
  const fills: FNode[] = (node.fills ?? []).filter((f: FNode) => f.visible !== false)
  const strokes: FNode[] = (node.strokes ?? []).filter((f: FNode) => f.visible !== false)
  const effects: FNode[] = (node.effects ?? []).filter((e: FNode) => e.visible !== false)

  function formatFill(f: FNode): { label: string; swatch: string | null } {
    if (f.type === 'SOLID') {
      const c = f.color as { r: number; g: number; b: number }
      const opacity = f.opacity ?? 1
      const hex = toHex(c.r, c.g, c.b)
      const swatch = `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${opacity})`
      return { label: opacity < 1 ? `${hex}  ${Math.round(opacity * 100)}%` : hex, swatch }
    }
    const labels: Record<string, string> = {
      GRADIENT_LINEAR: '선형 그라디언트', GRADIENT_RADIAL: '방사 그라디언트', IMAGE: '이미지',
    }
    return { label: labels[f.type] ?? f.type, swatch: null }
  }

  return (
    <div className="sv-props">
      {/* Node header */}
      <div className="sv-node-header">
        <span className="sv-type-badge" style={{ color: TYPE_COLORS[node.type] ?? '#6b7280' }}>
          {node.type}
        </span>
        <span className="sv-node-name">{node.name}</span>
        {info.parent && (
          <span className="sv-parent-name">in {info.parent.name}</span>
        )}
      </div>

      {/* Size */}
      {bbox && (
        <PropSection title="크기">
          <PropRow label="W" value={`${Math.round(bbox.width)}px`} />
          <PropRow label="H" value={`${Math.round(bbox.height)}px`} />
          {node.cornerRadius != null && <PropRow label="반지름" value={`${node.cornerRadius}px`} />}
          {node.opacity != null && node.opacity < 1 && (
            <PropRow label="불투명도" value={`${Math.round(node.opacity * 100)}%`} />
          )}
        </PropSection>
      )}

      {/* Auto Layout */}
      {hasLayout && (
        <PropSection title="오토 레이아웃">
          <PropRow label="방향" value={node.layoutMode === 'HORIZONTAL' ? '가로 (행)' : '세로 (열)'} />
          {node.itemSpacing != null && <PropRow label="간격" value={`${node.itemSpacing}px`} />}
          {node.paddingTop != null && <PropRow label="패딩 상" value={`${node.paddingTop}px`} />}
          {node.paddingBottom != null && <PropRow label="패딩 하" value={`${node.paddingBottom}px`} />}
          {node.paddingLeft != null && <PropRow label="패딩 좌" value={`${node.paddingLeft}px`} />}
          {node.paddingRight != null && <PropRow label="패딩 우" value={`${node.paddingRight}px`} />}
          {node.primaryAxisAlignItems && (
            <PropRow label="주축 정렬" value={ALIGN_LABELS[node.primaryAxisAlignItems] ?? node.primaryAxisAlignItems} />
          )}
          {node.counterAxisAlignItems && (
            <PropRow label="교차 정렬" value={ALIGN_LABELS[node.counterAxisAlignItems] ?? node.counterAxisAlignItems} />
          )}
        </PropSection>
      )}

      {/* Fills */}
      {fills.length > 0 && (
        <PropSection title="채우기">
          {fills.map((f, i) => {
            const { label, swatch } = formatFill(f)
            return (
              <div key={i} className="sv-row">
                <span className="sv-label">색상</span>
                <span className="sv-value sv-color-row">
                  {swatch && <span className="sv-swatch" style={{ background: swatch }} />}
                  {label}
                </span>
              </div>
            )
          })}
        </PropSection>
      )}

      {/* Strokes */}
      {strokes.length > 0 && (
        <PropSection title="테두리">
          {strokes.map((s, i) => {
            const { label, swatch } = formatFill(s)
            return (
              <div key={i} className="sv-row">
                <span className="sv-label">선 색상</span>
                <span className="sv-value sv-color-row">
                  {swatch && <span className="sv-swatch" style={{ background: swatch }} />}
                  {label}
                </span>
              </div>
            )
          })}
          {node.strokeWeight != null && <PropRow label="두께" value={`${node.strokeWeight}px`} />}
        </PropSection>
      )}

      {/* Typography */}
      {node.type === 'TEXT' && node.style && (
        <PropSection title="텍스트">
          {node.style.fontFamily && <PropRow label="폰트" value={String(node.style.fontFamily)} />}
          {node.style.fontSize && <PropRow label="크기" value={`${node.style.fontSize}px`} />}
          {node.style.fontWeight && <PropRow label="굵기" value={String(node.style.fontWeight)} />}
          {node.style.lineHeightPx && (
            <PropRow label="줄 높이" value={`${Math.round(node.style.lineHeightPx as number)}px`} />
          )}
          {node.style.letterSpacing != null && (
            <PropRow label="자간" value={`${node.style.letterSpacing}px`} />
          )}
          {node.characters && (
            <div className="sv-row sv-text-preview">
              <span className="sv-label">내용</span>
              <span className="sv-value sv-text-content">{
                String(node.characters).length > 80
                  ? String(node.characters).slice(0, 80) + '…'
                  : String(node.characters)
              }</span>
            </div>
          )}
        </PropSection>
      )}

      {/* Effects */}
      {effects.length > 0 && (
        <PropSection title="효과">
          {effects.map((e, i) => {
            const typeLabel: Record<string, string> = {
              DROP_SHADOW: '드롭 섀도우', INNER_SHADOW: '이너 섀도우',
              LAYER_BLUR: '레이어 블러', BACKGROUND_BLUR: '배경 블러',
            }
            const parts: string[] = []
            if (e.radius != null) parts.push(`블러 ${e.radius}px`)
            if (e.offset) parts.push(`X ${e.offset.x}  Y ${e.offset.y}`)
            return <PropRow key={i} label={typeLabel[e.type] ?? e.type} value={parts.join('  ') || '—'} />
          })}
        </PropSection>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
interface Props { frame: FigmaFrame; figmaToken?: string }

export default function SpecView({ frame, figmaToken: externalToken }: Props) {
  const [root, setRoot] = useState<FNode | null>(null)
  const [nodes, setNodes] = useState<NodeInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [noToken, setNoToken] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [hovered, setHovered] = useState<NodeInfo | null>(null)
  const [selected, setSelected] = useState<NodeInfo | null>(null)
  const prevUrl = useRef('')

  // Fetch tree when frame changes
  useEffect(() => {
    if (prevUrl.current === frame.figmaUrl) return
    prevUrl.current = frame.figmaUrl

    const token = externalToken || localStorage.getItem('figma_token') || ''
    if (!token) { setNoToken(true); return }
    setNoToken(false)
    setLoading(true)
    setError('')
    setRoot(null)
    setNodes([])
    setSelected(null)
    setHovered(null)
    fetchTree(frame.figmaUrl, token)
      .then(tree => {
        if (tree) { setRoot(tree); setNodes(buildList(tree)) }
        setLoading(false)
      })
      .catch(e => { setError(e instanceof Error ? e.message : String(e)); setLoading(false) })
  }, [frame.figmaUrl])

  // Reset image load on frame change
  useEffect(() => { setImgLoaded(false) }, [frame.imageUrl])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!root?.absoluteBoundingBox) return
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = (e.clientX - rect.left) / rect.width
    const relY = (e.clientY - rect.top) / rect.height
    setHovered(hitTest(nodes, root.absoluteBoundingBox, relX, relY))
  }, [nodes, root])

  const handleClick = useCallback(() => {
    setSelected(hovered)
  }, [hovered])

  const frameBox = root?.absoluteBoundingBox
  const activeInfo = hovered ?? selected
  const spacing = activeInfo ? getSpacing(activeInfo.node, activeInfo.parent) : null

  return (
    <div className="spec-view">
      {/* ── Left: image + overlay ── */}
      <div className="sv-canvas-area">
        <div className="sv-image-outer">
          <img
            src={frame.imageUrl}
            alt={frame.name}
            className={`sv-img ${imgLoaded ? 'loaded' : ''}`}
            onLoad={() => setImgLoaded(true)}
            draggable={false}
          />
          {imgLoaded && frameBox && (
            <div
              className="sv-overlay"
              onMouseMove={handleMouseMove}
              onClick={handleClick}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Hovered node highlight */}
              {hovered?.node.absoluteBoundingBox && (
                <div
                  className="sv-rect hovered"
                  style={toPctStyle(hovered.node.absoluteBoundingBox, frameBox)}
                />
              )}
              {/* Selected node highlight */}
              {selected?.node.absoluteBoundingBox && selected.node.id !== hovered?.node.id && (
                <div
                  className="sv-rect selected"
                  style={toPctStyle(selected.node.absoluteBoundingBox, frameBox)}
                />
              )}
              {/* Parent highlight */}
              {activeInfo?.parent?.absoluteBoundingBox && (
                <div
                  className="sv-rect parent"
                  style={toPctStyle(activeInfo.parent.absoluteBoundingBox, frameBox)}
                />
              )}
              {/* Spacing annotations */}
              {activeInfo?.node.absoluteBoundingBox && spacing && (
                <SpacingAnnotations
                  nodeBox={activeInfo.node.absoluteBoundingBox}
                  parentBox={activeInfo.parent?.absoluteBoundingBox ?? null}
                  frameBox={frameBox}
                  spacing={spacing}
                />
              )}
              {/* Node name tooltip near cursor */}
              {hovered && (
                <NodeTooltip info={hovered} frameBox={frameBox} />
              )}
            </div>
          )}
          {/* Loading badge overlaid on image */}
          {loading && imgLoaded && (
            <div className="sv-loading-badge">스펙 로딩 중…</div>
          )}
        </div>
      </div>

      {/* ── Right: properties panel ── */}
      <div className="sv-side-panel">
        {noToken && (
          <div className="sv-empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" opacity=".35">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <p>Figma 토큰이 없습니다</p>
            <p className="sv-empty-sub">화면 추가 시 입력해주세요</p>
          </div>
        )}
        {loading && !root && !noToken && (
          <div className="sv-empty">
            <div className="sv-spinner" />
            <p>스펙 불러오는 중…</p>
          </div>
        )}
        {error && (
          <div className="sv-empty">
            <p style={{ color: '#ef4444', fontSize: 11 }}>{error}</p>
          </div>
        )}
        {!loading && !error && !noToken && !selected && root && (
          <div className="sv-empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" opacity=".3">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5"/>
              <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <p>요소를 클릭하면</p>
            <p className="sv-empty-sub">스펙이 여기 표시됩니다</p>
            {hovered && (
              <div className="sv-hovered-preview">
                <span style={{ color: TYPE_COLORS[hovered.node.type] ?? '#6b7280', fontWeight: 700, fontSize: 10 }}>
                  {hovered.node.type}
                </span>
                <span>{hovered.node.name}</span>
              </div>
            )}
          </div>
        )}
        {selected && <NodePropsPanel info={selected} />}
      </div>
    </div>
  )
}

// ── Node Tooltip ──────────────────────────────────────────────────────────────
function NodeTooltip({ info, frameBox }: { info: NodeInfo; frameBox: BBox }) {
  const b = info.node.absoluteBoundingBox!
  const pct = toPct(b, frameBox)
  return (
    <div
      className="sv-tooltip"
      style={{ left: `${pct.left}%`, top: `${Math.max(0, pct.top - 2)}%`, transform: 'translateY(-100%)' }}
    >
      <span className="sv-tooltip-type" style={{ color: TYPE_COLORS[info.node.type] ?? '#94a3b8' }}>
        {info.node.type}
      </span>
      <span>{info.node.name}</span>
      <span className="sv-tooltip-size">
        {Math.round(b.width)} × {Math.round(b.height)}
      </span>
    </div>
  )
}
