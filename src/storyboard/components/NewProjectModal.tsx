import { useState } from 'react'
import { parseFigmaUrl, fetchFigmaNodeMeta, fetchFigmaImageUrl, fetchFigmaImageUrls } from '../figmaUtils'
import { FigmaFrame } from '../types'
import './NewProjectModal.css'

interface Props {
  onFramesLoaded: (frames: FigmaFrame[]) => void
  onClose: () => void
}

export default function NewProjectModal({ onFramesLoaded, onClose }: Props) {
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
        }])
      } else {
        setStatus('프레임 목록 분석 중...')
        const list = await fetchFigmaNodeMeta(parsed.fileKey, null, token.trim())
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
          }))

        if (frames.length === 0) throw new Error('가져올 수 있는 프레임이 없습니다.')
        onFramesLoaded(frames)
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="np-modal" onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="np-header">
          <div className="np-title">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="7" fill="#7c6ef7"/>
              <path d="M8 10h6a4 4 0 010 8H8V10z" fill="white" opacity=".9"/>
              <circle cx="20" cy="22" r="4" fill="white" opacity=".7"/>
            </svg>
            새 스토리보드 시작
          </div>
          <button className="np-close-btn" onClick={onClose} title="닫기" disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div className="np-body">
          <p className="np-desc">
            Figma URL을 입력하면 전체 프레임을 화면별로 자동 분리해 새 스토리보드로 시작합니다.
          </p>

          {/* 토큰 */}
          <div className="np-field">
            <label>
              Personal Access Token
              <a href="https://www.figma.com/developers/api#access-tokens" target="_blank" rel="noreferrer" className="np-help-link">
                발급 방법 ↗
              </a>
            </label>
            {!showTokenField ? (
              <div className="np-token-saved">
                <div className="np-token-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  토큰 저장됨
                </div>
                <button className="np-token-change" onClick={() => setShowTokenField(true)}>변경</button>
              </div>
            ) : (
              <input
                type="password"
                className="np-input"
                placeholder="figd_xxxxxxxxxxxx..."
                value={token}
                onChange={e => setToken(e.target.value)}
                autoComplete="off"
              />
            )}
          </div>

          {/* URL */}
          <div className="np-field">
            <label>Figma URL</label>
            <input
              type="text"
              className="np-input"
              placeholder="https://www.figma.com/file/... or /design/..."
              value={url}
              onChange={e => { setUrl(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && !loading && handleFetch()}
              autoFocus
              disabled={loading}
            />
            <span className="np-hint">
              파일 URL → 모든 프레임을 개별 화면으로 자동 분리&nbsp;&nbsp;|&nbsp;&nbsp;특정 프레임 URL → 단일 화면
            </span>
          </div>

          {error && (
            <div className="np-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}>
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {error}
            </div>
          )}

          {loading && status && (
            <div className="np-loading">
              <div className="np-spinner" />
              <span>{status}</span>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="np-footer">
          <button className="np-btn-cancel" onClick={onClose} disabled={loading}>
            취소
          </button>
          <button className="np-btn-primary" onClick={handleFetch} disabled={loading || !url.trim()}>
            {loading ? '불러오는 중...' : '새 스토리보드 시작'}
          </button>
        </div>
      </div>
    </div>
  )
}
