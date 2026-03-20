import { useState, useRef, useCallback } from 'react'
import { Screen } from '../types'
import { FlowchartData, FlowNode, FlowEdge } from '../FlowchartView'
import './AutoPlanModal.css'

// ── Re-export autoLayout (duplicated from FlowchartView) ─────────────────────
function autoLayout(nodes: FlowNode[], edges: FlowEdge[]): Map<string, { x: number; y: number }> {
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

// ── API Types ─────────────────────────────────────────────────────────────────
interface ApiBadge {
  label: string | number
  x: number
  y: number
  description?: string
}

interface ApiScreen {
  screenId: string
  badges: ApiBadge[]
}

interface ApiFlowNode {
  id: string
  label: string
  type?: string
  screenId?: string
}

interface ApiFlowEdge {
  id?: string
  from: string
  to: string
  label?: string
}

interface ApiResult {
  screens?: ApiScreen[]
  flowchart?: {
    nodes?: ApiFlowNode[]
    edges?: ApiFlowEdge[]
  }
}

// ── Apply Results ─────────────────────────────────────────────────────────────
function applyResults(screens: Screen[], result: ApiResult): { updatedScreens: Screen[]; flowchart: FlowchartData } {
  const generateId = () => Math.random().toString(36).slice(2, 9)

  const updatedScreens = screens.map(screen => {
    const found = result.screens?.find(s => s.screenId === screen.id)
    if (!found?.badges?.length) return screen
    return {
      ...screen,
      badges: found.badges.map(b => ({
        id: generateId(),
        label: String(b.label),
        x: Number(b.x),
        y: Number(b.y),
        description: String(b.description || ''),
        size: 'M' as const,
      }))
    }
  })

  const rawNodes = result.flowchart?.nodes ?? []
  const rawEdges = result.flowchart?.edges ?? []
  const positions = autoLayout(
    rawNodes.map(n => ({ ...n, type: n.type ?? 'screen', x: 0, y: 0, width: 180, height: 110 })),
    rawEdges.map((e, i) => ({ id: e.id ?? `e${i}`, from: e.from, to: e.to, label: e.label }))
  )

  const screenById = new Map(screens.map(s => [s.id, s]))
  const nodes: FlowNode[] = rawNodes.map(n => {
    const pos = positions.get(n.id) ?? { x: 60, y: 60 }
    const screen = screenById.get(n.screenId ?? '')
    return {
      id: n.id,
      label: n.label,
      type: n.type ?? 'screen',
      screenId: n.screenId,
      imageUrl: screen?.frame.imageUrl,
      x: pos.x,
      y: pos.y,
      width: 180,
      height: 110,
    }
  })

  return {
    updatedScreens,
    flowchart: {
      nodes,
      edges: rawEdges.map((e, i) => ({
        id: e.id ?? `e${i}`,
        from: e.from,
        to: e.to,
        label: e.label,
      }))
    }
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  screens: Screen[]
  onApply: (updatedScreens: Screen[], flowchart: FlowchartData) => void
  onClose: () => void
}

type State = 'key_setup' | 'mode_select' | 'loading' | 'error' | 'success'
type Mode = 'spec' | 'direct'

// ── Component ─────────────────────────────────────────────────────────────────
export default function AutoPlanModal({ screens, onApply, onClose }: Props) {
  const hasKey = !!localStorage.getItem('claude_api_key')
  const [state, setState] = useState<State>(hasKey ? 'mode_select' : 'key_setup')
  const [mode, setMode] = useState<Mode>('direct')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [specFile, setSpecFile] = useState<File | null>(null)
  const [specText, setSpecText] = useState<string | null>(null)
  const [specPdfBase64, setSpecPdfBase64] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [progressText, setProgressText] = useState('')
  const [result, setResult] = useState<{ updatedScreens: Screen[]; flowchart: FlowchartData } | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const saveApiKey = useCallback(() => {
    const key = apiKeyInput.trim()
    if (!key) return
    localStorage.setItem('claude_api_key', key)
    setState('mode_select')
  }, [apiKeyInput])

  const handleFileSelect = useCallback(async (file: File) => {
    setSpecFile(file)
    setSpecText(null)
    setSpecPdfBase64(null)
    if (file.name.endsWith('.pdf')) {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const base64 = dataUrl.split(',')[1]
        setSpecPdfBase64(base64)
      }
      reader.readAsDataURL(file)
    } else {
      const text = await file.text()
      setSpecText(text)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  const runClaude = useCallback(async () => {
    const apiKey = localStorage.getItem('claude_api_key') ?? ''
    if (!apiKey) { setState('key_setup'); return }

    setState('loading')
    setProgressText(`${screens.length}개 화면을 분석 중입니다...`)

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content: unknown[] = []

      if (specText) {
        content.push({ type: 'text', text: `기획서 내용:\n${specText}` })
      } else if (specPdfBase64) {
        content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: specPdfBase64 } })
      }

      screens.forEach((screen, i) => {
        content.push({ type: 'text', text: `[화면 ${i + 1}/${screens.length}] ID: ${screen.id}, 이름: ${screen.frame.name}` })
        content.push({ type: 'image', source: { type: 'url', url: screen.frame.imageUrl } })
      })

      content.push({
        type: 'text',
        text: `위 ${screens.length}개 Figma 화면을 분석하여 각 화면에 주요 UI 요소에 대한 뱃지 주석을 생성하고, 화면 간 플로우차트를 만들어주세요.\n\n반드시 다음 JSON 형식으로만 응답해주세요 (마크다운 코드블록 없이 순수 JSON):\n{"screens":[{"screenId":"화면ID","badges":[{"label":"1","x":0.35,"y":0.42,"description":"한국어 UI 요소 설명"}]}],"flowchart":{"nodes":[{"id":"node1","label":"화면명","type":"screen","screenId":"화면ID"}],"edges":[{"id":"e1","from":"node1","to":"node2","label":"전환 조건"}]}}`
      })

      setProgressText('Claude AI가 화면을 분석 중입니다 (최대 1~2분)...')

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 8192,
          system: '당신은 UX 분석 전문가입니다. Figma 화면을 분석하여 각 UI 요소에 대한 상세한 한국어 주석을 생성하고 플로우차트를 만드는 것이 전문입니다. 항상 지정된 JSON 형식으로만 응답합니다.',
          messages: [{ role: 'user', content }]
        })
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`API 오류 ${response.status}: ${errText}`)
      }

      const data = await response.json()
      const rawText: string = data.content?.[0]?.text ?? ''

      // Extract JSON from response
      const firstBrace = rawText.indexOf('{')
      const lastBrace = rawText.lastIndexOf('}')
      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error('응답에서 JSON을 찾을 수 없습니다.')
      }
      const jsonStr = rawText.slice(firstBrace, lastBrace + 1)
      const parsed: ApiResult = JSON.parse(jsonStr)

      const applied = applyResults(screens, parsed)
      setResult(applied)
      setState('success')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setState('error')
    }
  }, [screens, specText, specPdfBase64])

  const handleApply = useCallback(() => {
    if (!result) return
    onApply(result.updatedScreens, result.flowchart)
  }, [result, onApply])

  return (
    <div className="ap-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ap-modal">
        <div className="ap-header">
          <div className="ap-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            자동 기획 생성
          </div>
          <button className="ap-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* API Key Setup */}
        {(state === 'key_setup' || (state === 'mode_select' && !localStorage.getItem('claude_api_key'))) && (
          <div className="ap-apikey-box">
            <div className="ap-apikey-notice">
              Claude API 키가 필요합니다. Anthropic Console에서 발급받은 키를 입력해주세요. 키는 브라우저에만 저장됩니다.
            </div>
            <div className="ap-apikey-row">
              <input
                type="password"
                className="ap-apikey-input"
                placeholder="sk-ant-..."
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveApiKey()}
              />
              <button className="ap-apikey-save" onClick={saveApiKey}>저장</button>
            </div>
          </div>
        )}

        {/* Key setup only - show an extra note */}
        {state === 'key_setup' && (
          <p style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 8 }}>
            키를 저장하면 모드 선택으로 이동합니다
          </p>
        )}

        {/* Mode Selection */}
        {state === 'mode_select' && (
          <>
            {/* Show API key box if key exists for reference */}
            {localStorage.getItem('claude_api_key') && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>API 키</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#374151', flex: 1 }}>
                    {localStorage.getItem('claude_api_key')!.slice(0, 12)}••••••••••••
                  </span>
                  <button
                    style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => { localStorage.removeItem('claude_api_key'); setState('key_setup'); setApiKeyInput('') }}
                  >
                    변경
                  </button>
                </div>
              </div>
            )}

            <div className="ap-section-label">실행 방식 선택</div>
            <div className="ap-mode-grid">
              <div
                className={`ap-mode-card ${mode === 'spec' ? 'active' : ''}`}
                onClick={() => setMode('spec')}
              >
                <div className="ap-mode-icon">📄</div>
                <div className="ap-mode-title">기획서 첨부</div>
                <div className="ap-mode-desc">기획 문서를 함께 전달하여 더 정확한 분석</div>
              </div>
              <div
                className={`ap-mode-card ${mode === 'direct' ? 'active' : ''}`}
                onClick={() => setMode('direct')}
              >
                <div className="ap-mode-icon">⚡</div>
                <div className="ap-mode-title">바로 실행</div>
                <div className="ap-mode-desc">화면만으로 AI가 자동 분석 및 주석 생성</div>
              </div>
            </div>

            {/* File upload for spec mode */}
            {mode === 'spec' && (
              <>
                {specFile ? (
                  <div className="ap-file-info">
                    <span style={{ fontSize: 16 }}>📎</span>
                    <span className="ap-file-name">{specFile.name}</span>
                    <button
                      className="ap-file-remove"
                      onClick={() => { setSpecFile(null); setSpecText(null); setSpecPdfBase64(null) }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div
                    className={`ap-dropzone ${isDragOver ? 'dragover' : ''}`}
                    onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="ap-dropzone-icon">📂</div>
                    <div className="ap-dropzone-text">파일을 드래그하거나 클릭하여 선택</div>
                    <div className="ap-dropzone-sub">.txt, .md, .pdf 파일 지원</div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.md,.pdf"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) handleFileSelect(file)
                      }}
                    />
                  </div>
                )}
              </>
            )}

            <button
              className="ap-run-btn"
              onClick={runClaude}
              disabled={mode === 'spec' && !specFile}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              실행 ({screens.length}개 화면 분석)
            </button>
          </>
        )}

        {/* Loading state */}
        {state === 'loading' && (
          <div className="ap-loading">
            <div className="ap-spinner" />
            <div className="ap-loading-title">분석 중...</div>
            <div className="ap-progress-text">{progressText}</div>
          </div>
        )}

        {/* Error state */}
        {state === 'error' && (
          <>
            <div className="ap-error">
              <div className="ap-error-title">오류가 발생했습니다</div>
              <div className="ap-error-msg">{errorMsg}</div>
              <button className="ap-retry-btn" onClick={() => setState('mode_select')}>다시 시도</button>
            </div>
          </>
        )}

        {/* Success state */}
        {state === 'success' && result && (
          <div className="ap-success">
            <div className="ap-success-icon">✅</div>
            <div className="ap-success-title">분석 완료!</div>
            <div className="ap-success-desc">
              {result.updatedScreens.filter(s => s.badges.length > 0).length}개 화면에 뱃지 주석이 생성되었습니다.
              <br />
              {result.flowchart.nodes.length}개 노드, {result.flowchart.edges.length}개 연결로 플로우차트가 생성되었습니다.
            </div>
            <button className="ap-success-apply" onClick={handleApply}>
              적용하기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
