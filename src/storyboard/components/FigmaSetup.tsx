import { useState } from 'react'
import { parseFigmaUrl, fetchFigmaNodeMeta, fetchFigmaImageUrl, fetchFigmaImageUrls, fetchFigmaNodeTree } from '../figmaUtils'
import { FigmaFrame, FigmaPageTree } from '../types'
import './FigmaSetup.css'

interface Props {
  onFramesLoaded: (frames: FigmaFrame[], tree?: FigmaPageTree[]) => void
}

export default function FigmaSetup({ onFramesLoaded }: Props) {
  const savedToken = localStorage.getItem('figma_token') || ''
  const [token, setToken] = useState(savedToken)
  const [showTokenField, setShowTokenField] = useState(!savedToken)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const handleFetch = async () => {
    if (!token.trim()) { setError('Figma Personal Access Token을 입력해주세요.'); return }
    if (!url.trim()) { setError('Figma URL을 입력해주세요.'); return }

    setError('')
    setLoading(true)
    setStatus('')

    try {
      localStorage.setItem('figma_token', token.trim())
      const parsed = parseFigmaUrl(url.trim())
      if (!parsed) throw new Error('올바른 Figma URL 형식이 아닙니다.')

      if (parsed.nodeId) {
        // 특정 노드 URL → 단일 화면 즉시 로드
        setStatus('프레임 정보 가져오는 중...')
        const metas = await fetchFigmaNodeMeta(parsed.fileKey, parsed.nodeId, token.trim())
        const meta = metas[0]
        setStatus('이미지 내보내는 중...')
        const imageUrl = await fetchFigmaImageUrl(parsed.fileKey, meta.id, token.trim())
        onFramesLoaded([{
          id: meta.id,
          name: meta.name,
          imageUrl,
          figmaUrl: url.trim(),
          width: meta.width,
          height: meta.height,
          pageId: meta.pageId || '',
          pageName: meta.pageName || '',
        }])
      } else {
        // 파일 URL → 전체 프레임 자동 수집 후 각각 별도 화면으로 추가
        setStatus('프레임 목록 분석 중...')
        const [list, tree] = await Promise.all([
          fetchFigmaNodeMeta(parsed.fileKey, null, token.trim()),
          fetchFigmaNodeTree(parsed.fileKey, token.trim()).catch(() => [] as FigmaPageTree[]),
        ])
        if (list.length === 0) throw new Error('파일에 프레임이 없습니다.')

        setStatus(`${list.length}개 화면 이미지 가져오는 중...`)
        const ids = list.map(f => f.id)
        const imageUrls = await fetchFigmaImageUrls(parsed.fileKey, ids, token.trim())

        const frames: FigmaFrame[] = list
          .filter(f => imageUrls[f.id])
          .map(f => ({
            id: f.id,
            name: f.name,
            imageUrl: imageUrls[f.id],
            figmaUrl: `https://www.figma.com/file/${parsed.fileKey}?node-id=${f.id.replace(':', '-')}`,
            width: f.width,
            height: f.height,
            pageId: f.pageId,
            pageName: f.pageName,
          }))

        if (frames.length === 0) throw new Error('가져올 수 있는 프레임이 없습니다.')
        onFramesLoaded(frames, tree)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.'
      if (msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
        setError('토큰 권한이 없거나 만료됐습니다. Figma Personal Access Token을 확인해주세요.')
      } else if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
        setError('파일을 찾을 수 없습니다. URL이 올바른지 확인해주세요.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
      setStatus('')
    }
  }

  return (
    <div className="setup-overlay">
      <div className="setup-card">
        <div className="setup-logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#7c6ef7"/>
            <path d="M8 10h6a4 4 0 010 8H8V10z" fill="white" opacity=".9"/>
            <circle cx="20" cy="22" r="4" fill="white" opacity=".7"/>
          </svg>
          <span>Storyboard</span>
        </div>

        <h1>Figma 디자인 연결</h1>
        <p className="setup-desc">
          Figma Personal Access Token과 파일 URL을 입력하면<br/>
          전체 프레임을 화면별로 자동 분리해서 불러옵니다.
        </p>

        <div className="setup-field">
          <label>
            Personal Access Token
            <a href="https://www.figma.com/developers/api#access-tokens" target="_blank" rel="noreferrer" className="help-link">
              발급 방법 ↗
            </a>
          </label>
          {!showTokenField ? (
            <div className="token-saved-row">
              <div className="token-saved-badge">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                토큰 저장됨
              </div>
              <button
                type="button"
                className="token-change-btn"
                onClick={() => setShowTokenField(true)}
              >
                변경
              </button>
            </div>
          ) : (
            <input
              type="password"
              placeholder="figd_xxxxxxxxxxxx..."
              value={token}
              onChange={e => setToken(e.target.value)}
              autoComplete="off"
              autoFocus={!savedToken}
            />
          )}
        </div>

        <div className="setup-field">
          <label>Figma URL</label>
          <input
            type="text"
            placeholder="https://www.figma.com/file/... or /design/..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && handleFetch()}
          />
          <span className="field-hint">
            파일 URL → 모든 프레임을 개별 화면으로 자동 분리 &nbsp;|&nbsp; 특정 프레임 URL → 단일 화면 추가
          </span>
        </div>

        {error && <div className="setup-error">{error}</div>}

        {loading && status && (
          <div className="setup-loading">
            <div className="setup-spinner" />
            <span>{status}</span>
          </div>
        )}

        <button
          className="btn-primary"
          onClick={handleFetch}
          disabled={loading}
        >
          {loading ? '불러오는 중...' : '디자인 불러오기'}
        </button>
      </div>
    </div>
  )
}
