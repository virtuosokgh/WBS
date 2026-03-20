import { useState, useEffect, useCallback } from 'react'
import { parseFigmaUrl } from '../figmaUtils'
import './SpecPanel.css'

interface Props {
  figmaUrl: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FigmaNode = Record<string, any> & {
  id: string
  name: string
  type: string
  children?: FigmaNode[]
}

async function figmaFetch(path: string, token: string) {
  const res = await fetch(`https://api.figma.com${path}`, {
    headers: { 'X-Figma-Token': token },
  })
  if (!res.ok) throw new Error(`Figma API ${res.status}`)
  return res.json()
}

function toHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
}

function formatFill(fill: FigmaNode): { label: string; swatch: string | null } {
  if (fill.type === 'SOLID') {
    const c = fill.color as { r: number; g: number; b: number }
    const opacity = fill.opacity ?? 1
    const hex = toHex(c.r, c.g, c.b)
    const swatch = `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${opacity})`
    const label = opacity < 1 ? `${hex}  ${Math.round(opacity * 100)}%` : hex
    return { label, swatch }
  }
  const labels: Record<string, string> = {
    GRADIENT_LINEAR: '선형 그라디언트',
    GRADIENT_RADIAL: '방사형 그라디언트',
    GRADIENT_ANGULAR: '각도 그라디언트',
    IMAGE: '이미지',
  }
  return { label: labels[fill.type] ?? fill.type, swatch: null }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="spec-section">
      <div className="spec-section-title">{title}</div>
      {children}
    </div>
  )
}

function Row({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="spec-row">
      <span className="spec-label">{label}</span>
      <span className={`spec-value ${mono ? 'mono' : ''}`}>{value}</span>
    </div>
  )
}

function NodeSpec({ node }: { node: FigmaNode }) {
  const bbox = node.absoluteBoundingBox as { width: number; height: number } | undefined
  const hasLayout = node.layoutMode && node.layoutMode !== 'NONE'
  const fills: FigmaNode[] = (node.fills ?? []).filter((f: FigmaNode) => f.visible !== false)
  const strokes: FigmaNode[] = (node.strokes ?? []).filter((f: FigmaNode) => f.visible !== false)
  const effects: FigmaNode[] = (node.effects ?? []).filter((e: FigmaNode) => e.visible !== false)

  const ALIGN_LABELS: Record<string, string> = {
    MIN: '시작',
    CENTER: '중앙',
    MAX: '끝',
    SPACE_BETWEEN: '균등 분배',
    BASELINE: '기준선',
  }

  return (
    <div className="spec-props">
      {bbox && (
        <Section title="크기">
          <Row label="W" value={`${Math.round(bbox.width)}px`} />
          <Row label="H" value={`${Math.round(bbox.height)}px`} />
          {node.cornerRadius != null && <Row label="반지름" value={`${node.cornerRadius}px`} />}
          {node.opacity != null && node.opacity < 1 && (
            <Row label="불투명도" value={`${Math.round(node.opacity * 100)}%`} />
          )}
        </Section>
      )}

      {hasLayout && (
        <Section title="오토 레이아웃">
          <Row label="방향" value={node.layoutMode === 'HORIZONTAL' ? '가로 (행)' : '세로 (열)'} />
          {node.itemSpacing != null && <Row label="간격" value={`${node.itemSpacing}px`} />}
          {node.paddingTop != null && <Row label="패딩 상" value={`${node.paddingTop}px`} />}
          {node.paddingBottom != null && <Row label="패딩 하" value={`${node.paddingBottom}px`} />}
          {node.paddingLeft != null && <Row label="패딩 좌" value={`${node.paddingLeft}px`} />}
          {node.paddingRight != null && <Row label="패딩 우" value={`${node.paddingRight}px`} />}
          {node.primaryAxisAlignItems && (
            <Row label="주축 정렬" value={ALIGN_LABELS[node.primaryAxisAlignItems] ?? node.primaryAxisAlignItems} />
          )}
          {node.counterAxisAlignItems && (
            <Row label="교차 정렬" value={ALIGN_LABELS[node.counterAxisAlignItems] ?? node.counterAxisAlignItems} />
          )}
        </Section>
      )}

      {fills.length > 0 && (
        <Section title="채우기">
          {fills.map((f, i) => {
            const { label, swatch } = formatFill(f)
            return (
              <div key={i} className="spec-row">
                <span className="spec-label">채우기 {fills.length > 1 ? i + 1 : ''}</span>
                <span className="spec-value mono spec-color-value">
                  {swatch && <span className="spec-color-swatch" style={{ background: swatch }} />}
                  {label}
                </span>
              </div>
            )
          })}
        </Section>
      )}

      {strokes.length > 0 && (
        <Section title="테두리">
          {strokes.map((s, i) => {
            const { label, swatch } = formatFill(s)
            return (
              <div key={i} className="spec-row">
                <span className="spec-label">선 {strokes.length > 1 ? i + 1 : ''}</span>
                <span className="spec-value mono spec-color-value">
                  {swatch && <span className="spec-color-swatch" style={{ background: swatch }} />}
                  {label}
                </span>
              </div>
            )
          })}
          {node.strokeWeight != null && <Row label="두께" value={`${node.strokeWeight}px`} />}
          {node.strokeAlign && <Row label="위치" value={node.strokeAlign} />}
        </Section>
      )}

      {node.type === 'TEXT' && node.style && (
        <Section title="텍스트">
          {node.style.fontFamily && <Row label="폰트" value={node.style.fontFamily} />}
          {node.style.fontSize && <Row label="크기" value={`${node.style.fontSize}px`} />}
          {node.style.fontWeight && <Row label="굵기" value={String(node.style.fontWeight)} />}
          {node.style.lineHeightPx && (
            <Row label="줄 높이" value={`${Math.round(node.style.lineHeightPx)}px`} />
          )}
          {node.style.letterSpacing != null && (
            <Row label="자간" value={`${node.style.letterSpacing}px`} />
          )}
          {node.style.textAlignHorizontal && (
            <Row label="정렬" value={node.style.textAlignHorizontal} />
          )}
          {node.characters && (
            <div className="spec-row spec-text-preview">
              <span className="spec-label">내용</span>
              <span className="spec-value" style={{ fontFamily: node.style.fontFamily }}>
                {node.characters.length > 60
                  ? node.characters.slice(0, 60) + '…'
                  : node.characters}
              </span>
            </div>
          )}
        </Section>
      )}

      {effects.length > 0 && (
        <Section title="효과">
          {effects.map((e, i) => {
            const typeLabel: Record<string, string> = {
              DROP_SHADOW: '드롭 섀도우',
              INNER_SHADOW: '이너 섀도우',
              LAYER_BLUR: '레이어 블러',
              BACKGROUND_BLUR: '배경 블러',
            }
            const parts: string[] = []
            if (e.radius != null) parts.push(`블러 ${e.radius}px`)
            if (e.offset) parts.push(`X: ${e.offset.x}  Y: ${e.offset.y}`)
            if (e.spread != null) parts.push(`스프레드 ${e.spread}px`)
            return (
              <Row key={i} label={typeLabel[e.type] ?? e.type} value={parts.join('  ') || '—'} />
            )
          })}
        </Section>
      )}
    </div>
  )
}

function NodeTree({
  node, depth, selected, onSelect,
}: {
  node: FigmaNode
  depth: number
  selected: string | null
  onSelect: (n: FigmaNode) => void
}) {
  const [open, setOpen] = useState(depth < 1)
  const hasChildren = Array.isArray(node.children) && node.children.length > 0

  const TYPE_COLORS: Record<string, string> = {
    FRAME: '#7c6ef7',
    COMPONENT: '#e040fb',
    INSTANCE: '#a855f7',
    TEXT: '#38bdf8',
    RECTANGLE: '#34d399',
    ELLIPSE: '#34d399',
    GROUP: '#94a3b8',
    VECTOR: '#fb923c',
    SECTION: '#f59e0b',
  }

  return (
    <div>
      <div
        className={`spec-tree-node ${selected === node.id ? 'selected' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => {
          onSelect(node)
          if (hasChildren) setOpen(v => !v)
        }}
      >
        {hasChildren ? (
          <svg
            className={`spec-chevron ${open ? 'open' : ''}`}
            width="10" height="10" viewBox="0 0 24 24" fill="none"
          >
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        ) : (
          <span className="spec-leaf-dot" />
        )}
        <span
          className="spec-node-type"
          style={{ color: TYPE_COLORS[node.type] ?? '#94a3b8' }}
        >
          {node.type}
        </span>
        <span className="spec-node-name">{node.name}</span>
      </div>
      {open && hasChildren && node.children!.map((child: FigmaNode) => (
        <NodeTree
          key={child.id}
          node={child}
          depth={depth + 1}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

export default function SpecPanel({ figmaUrl }: Props) {
  const [rootNode, setRootNode] = useState<FigmaNode | null>(null)
  const [selectedNode, setSelectedNode] = useState<FigmaNode | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [noToken, setNoToken] = useState(false)

  const load = useCallback(async () => {
    const token = localStorage.getItem('figma_token') || ''
    if (!token) { setNoToken(true); return }
    const parsed = parseFigmaUrl(figmaUrl)
    if (!parsed) { setError('Figma URL을 파싱할 수 없습니다.'); return }
    const { fileKey, nodeId } = parsed
    if (!nodeId) { setError('노드 ID 정보가 없습니다.'); return }

    setLoading(true)
    setError('')
    setNoToken(false)
    try {
      const data = await figmaFetch(
        `/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`,
        token,
      )
      const node = data.nodes?.[nodeId]?.document as FigmaNode | undefined
      if (!node) throw new Error('노드를 찾을 수 없습니다.')
      setRootNode(node)
      setSelectedNode(node)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [figmaUrl])

  useEffect(() => { load() }, [load])

  if (noToken) {
    return (
      <div className="spec-panel spec-panel-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" opacity=".4">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
        <p>Figma 토큰이 설정되지 않았습니다</p>
        <p style={{ fontSize: 11, opacity: 0.6 }}>화면 추가 시 Figma 토큰을 입력해주세요</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="spec-panel spec-panel-empty">
        <div className="spec-spinner" />
        <p>스펙 불러오는 중…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="spec-panel spec-panel-empty">
        <p style={{ color: '#f38ba8' }}>{error}</p>
        <button className="spec-reload-btn" onClick={load}>다시 시도</button>
      </div>
    )
  }

  if (!rootNode) return null

  return (
    <div className="spec-panel">
      <div className="spec-header">
        <span className="spec-header-title">디자인 스펙</span>
        <a
          href={figmaUrl}
          target="_blank"
          rel="noreferrer"
          className="spec-open-btn"
          title="Figma에서 열기"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Figma 열기
        </a>
      </div>

      <div className="spec-body">
        <div className="spec-tree">
          <NodeTree
            node={rootNode}
            depth={0}
            selected={selectedNode?.id ?? null}
            onSelect={setSelectedNode}
          />
        </div>
        {selectedNode && (
          <div className="spec-props-panel">
            <div className="spec-node-header">
              <span className="spec-node-type-badge">{selectedNode.type}</span>
              <span className="spec-node-name-title">{selectedNode.name}</span>
            </div>
            <NodeSpec node={selectedNode} />
          </div>
        )}
      </div>
    </div>
  )
}
