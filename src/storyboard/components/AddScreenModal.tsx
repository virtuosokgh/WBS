import { useState, useEffect } from 'react'
import { parseFigmaUrl, fetchFigmaNodeMeta, fetchFigmaImageUrl, fetchFigmaImageUrls, FigmaNodeMeta } from '../figmaUtils'
import { FigmaFrame } from '../types'
import './AddScreenModal.css'

interface Props {
  onAdd: (frame: FigmaFrame) => void
  onAddMultiple: (frames: FigmaFrame[]) => void
  onClose: () => void
  existingFrameIds?: string[]
  initialFileKey?: string
  initialMode?: 'url' | 'project'
  figmaToken?: string
  onTokenChange?: (token: string) => void
}

export default function AddScreenModal({
  onAdd,
  onAddMultiple,
  onClose,
  existingFrameIds = [],
  initialFileKey,
  initialMode = 'url',
  figmaToken: externalToken,
  onTokenChange,
}: Props) {
  const token = externalToken || localStorage.getItem('figma_token') || ''
  const [mode, setMode] = useState<'url' | 'project'>(initialMode)

  // ── URL 모드 상태 ──
  const [url, setUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState('')
  const [urlFrames, setUrlFrames] = useState<FigmaNodeMeta[]>([])
  const [urlFileKey, setUrlFileKey] = useState('')

  // ── 프로젝트 모드 상태 ──
  const [projectUrl, setProjectUrl] = useState('')
  const [projectFileKey, setProjectFileKey] = useState(initialFileKey || '')
  const [projectLoading, setProjectLoading] = useState(false)
  const [projectError, setProjectError] = useState('')
  const [projectFrames, setProjectFrames] = useState<FigmaNodeMeta[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)

  // 초기 파일키가 있으면 자동 로드
  useEffect(() => {
    if (initialFileKey && initialMode === 'project') {
      fetchProjectFrames(initialFileKey)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchProjectFrames = async (fileKey: string) => {
    if (!token) { setProjectError('저장된 토큰이 없습니다. 초기화 후 다시 설정해주세요.'); return }
    setProjectLoading(true)
    setProjectError('')
    setProjectFrames([])
    setSelectedIds(new Set())
    try {
      const list = await fetchFigmaNodeMeta(fileKey, null, token)
      if (list.length === 0) throw new Error('파일에 프레임이 없습니다.')
      setProjectFrames(list)
      // 아직 추가되지 않은 프레임만 자동 선택
      const newIds = new Set(list.filter(f => !existingFrameIds.includes(f.id)).map(f => f.id))
      setSelectedIds(newIds)
    } catch (e) {
      setProjectError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setProjectLoading(false)
    }
  }

  const handleProjectFetch = async () => {
    const trimmed = projectUrl.trim()
    if (!trimmed) { setProjectError('Figma URL을 입력해주세요.'); return }
    const parsed = parseFigmaUrl(trimmed)
    if (!parsed) { setProjectError('올바른 Figma URL 형식이 아닙니다.'); return }
    setProjectFileKey(parsed.fileKey)
    await fetchProjectFrames(parsed.fileKey)
  }

  const toggleFrame = (id: string) => {
    if (existingFrameIds.includes(id)) return
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleImportSelected = async () => {
    const toImport = projectFrames.filter(f => selectedIds.has(f.id))
    if (toImport.length === 0) return
    if (!token) { setProjectError('저장된 토큰이 없습니다.'); return }

    setImporting(true)
    setProjectError('')
    setImportProgress(0)
    try {
      const imageUrls = await fetchFigmaImageUrls(projectFileKey, toImport.map(f => f.id), token)
      setImportProgress(50)
      const newFrames: FigmaFrame[] = toImport
        .map(meta => ({
          id: meta.id,
          name: meta.name,
          imageUrl: imageUrls[meta.id] ?? '',
          figmaUrl: `https://www.figma.com/file/${projectFileKey}?node-id=${meta.id.replace(':', '-')}`,
          width: meta.width,
          height: meta.height,
          pageId: meta.pageId,
          pageName: meta.pageName,
        }))
        .filter(f => f.imageUrl)

      if (newFrames.length === 0) throw new Error('이미지를 불러올 수 없습니다.')
      setImportProgress(100)
      onAddMultiple(newFrames)
    } catch (e) {
      setProjectError(e instanceof Error ? e.message : '이미지 불러오기 실패')
    } finally {
      setImporting(false)
    }
  }

  // ── URL 모드 핸들러 ──
  const handleUrlFetch = async () => {
    if (!url.trim()) { setUrlError('Figma URL을 입력해주세요.'); return }
    if (!token) { setUrlError('저장된 토큰이 없습니다. 초기화 후 다시 설정해주세요.'); return }
    setUrlError(''); setUrlLoading(true); setUrlFrames([])
    try {
      const parsed = parseFigmaUrl(url.trim())
      if (!parsed) throw new Error('올바른 Figma URL 형식이 아닙니다.')
      setUrlFileKey(parsed.fileKey)
      if (parsed.nodeId) {
        const metas = await fetchFigmaNodeMeta(parsed.fileKey, parsed.nodeId, token)
        const meta = metas[0]
        const imageUrl = await fetchFigmaImageUrl(parsed.fileKey, meta.id, token)
        onAdd({ id: meta.id, name: meta.name, imageUrl, figmaUrl: url.trim(), width: meta.width, height: meta.height, pageId: meta.pageId || '', pageName: meta.pageName || '' })
      } else {
        const list = await fetchFigmaNodeMeta(parsed.fileKey, null, token)
        if (list.length === 0) throw new Error('파일에 프레임이 없습니다.')
        setUrlFrames(list)
      }
    } catch (e) {
      setUrlError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setUrlLoading(false)
    }
  }

  const handleUrlSelectFrame = async (meta: FigmaNodeMeta) => {
    setUrlLoading(true); setUrlError('')
    try {
      const imageUrl = await fetchFigmaImageUrl(urlFileKey, meta.id, token)
      const nodeUrl = `https://www.figma.com/file/${urlFileKey}?node-id=${meta.id.replace(':', '-')}`
      onAdd({ id: meta.id, name: meta.name, imageUrl, figmaUrl: nodeUrl, width: meta.width, height: meta.height, pageId: meta.pageId || '', pageName: meta.pageName || '' })
    } catch (e) {
      setUrlError(e instanceof Error ? e.message : '이미지를 불러올 수 없습니다.')
    } finally {
      setUrlLoading(false)
    }
  }

  const newCount = selectedIds.size
  const alreadyCount = projectFrames.filter(f => existingFrameIds.includes(f.id)).length

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="3" width="20" height="14" rx="2" stroke="var(--accent)" strokeWidth="2"/>
              <path d="M8 21h8M12 17v4" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <h2>화면 추가</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* 탭 */}
        <div className="modal-tabs">
          <button
            className={`modal-tab ${mode === 'url' ? 'active' : ''}`}
            onClick={() => setMode('url')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            URL로 추가
          </button>
          <button
            className={`modal-tab ${mode === 'project' ? 'active' : ''}`}
            onClick={() => setMode('project')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            프로젝트 전체 불러오기
          </button>
        </div>

        <div className="modal-body">
          {/* ── URL 모드 ── */}
          {mode === 'url' ? (
            <>
              <div className="setup-field">
                <label>Figma URL</label>
                <input
                  type="text"
                  placeholder="https://www.figma.com/file/... or /design/..."
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleUrlFetch()}
                  autoFocus
                />
                <span className="field-hint">특정 프레임 URL이면 바로 로드됩니다. 파일 URL이면 프레임을 선택합니다.</span>
              </div>
              {urlError && <div className="setup-error">{urlError}</div>}
              <button className="btn-primary" onClick={handleUrlFetch} disabled={urlLoading}>
                {urlLoading ? '불러오는 중...' : '프레임 불러오기'}
              </button>
              {urlFrames.length > 0 && (
                <div className="frame-list">
                  <p className="frame-list-title">프레임을 선택하세요</p>
                  {urlFrames.map(f => (
                    <button
                      key={f.id}
                      className="frame-item"
                      onClick={() => handleUrlSelectFrame(f)}
                      disabled={urlLoading}
                    >
                      <span className="frame-name">{f.name}</span>
                      <span className="frame-size">{Math.round(f.width)} × {Math.round(f.height)}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* ── 프로젝트 모드 ── */
            <>
              {!initialFileKey && (
                <div className="setup-field">
                  <label>Figma 파일 URL</label>
                  <div className="field-row">
                    <input
                      type="text"
                      placeholder="https://www.figma.com/file/... (파일 전체 URL)"
                      value={projectUrl}
                      onChange={e => setProjectUrl(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleProjectFetch()}
                      autoFocus
                    />
                    <button
                      className="btn-fetch-inline"
                      onClick={handleProjectFetch}
                      disabled={projectLoading}
                    >
                      {projectLoading ? '...' : '불러오기'}
                    </button>
                  </div>
                  <span className="field-hint">파일 URL을 입력하면 모든 페이지의 프레임 목록이 표시됩니다.</span>
                </div>
              )}

              {projectLoading && (
                <div className="project-loading">
                  <div className="spinner-sm" />
                  <span>프레임 목록을 불러오는 중...</span>
                </div>
              )}

              {projectError && <div className="setup-error">{projectError}</div>}

              {projectFrames.length > 0 && (
                <>
                  <div className="project-frame-header">
                    <span className="project-frame-count">
                      총 {projectFrames.length}개
                      {alreadyCount > 0 && (
                        <span className="already-count"> · {alreadyCount}개 이미 추가됨</span>
                      )}
                    </span>
                    <div className="project-select-actions">
                      <button
                        className="btn-text-sm"
                        onClick={() => {
                          const newIds = new Set(
                            projectFrames.filter(f => !existingFrameIds.includes(f.id)).map(f => f.id)
                          )
                          setSelectedIds(newIds)
                        }}
                      >
                        전체 선택
                      </button>
                      <span className="select-divider">·</span>
                      <button className="btn-text-sm" onClick={() => setSelectedIds(new Set())}>
                        전체 해제
                      </button>
                    </div>
                  </div>

                  <div className="project-frame-list">
                    {projectFrames.map(f => {
                      const isExisting = existingFrameIds.includes(f.id)
                      const isChecked = selectedIds.has(f.id) || isExisting
                      return (
                        <div
                          key={f.id}
                          className={`project-frame-item ${isExisting ? 'existing' : ''} ${isChecked && !isExisting ? 'checked' : ''}`}
                          onClick={() => toggleFrame(f.id)}
                        >
                          <div className={`pf-checkbox ${isChecked ? 'checked' : ''} ${isExisting ? 'disabled' : ''}`}>
                            {isChecked && (
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                          <span className="pf-name">{f.name}</span>
                          <span className="pf-size">{Math.round(f.width)} × {Math.round(f.height)}</span>
                          {isExisting && <span className="pf-existing-tag">추가됨</span>}
                        </div>
                      )
                    })}
                  </div>

                  {importing && (
                    <div className="import-progress">
                      <div className="import-progress-bar" style={{ width: `${importProgress}%` }} />
                      <span>{newCount}개 화면 이미지 불러오는 중...</span>
                    </div>
                  )}

                  <button
                    className="btn-primary"
                    onClick={handleImportSelected}
                    disabled={importing || newCount === 0}
                  >
                    {importing
                      ? `${newCount}개 불러오는 중...`
                      : newCount === 0
                        ? '추가할 화면을 선택하세요'
                        : `선택한 ${newCount}개 화면 추가`}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
