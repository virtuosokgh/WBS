import { useState, useEffect, useRef } from 'react'
import { Badge, BadgeSize, Screen, BADGE_SIZE_PX, BADGE_SIZE_LABELS } from '../types'
import './DescriptionPanel.css'

interface Props {
  screens: Screen[]
  activeScreenId: string | null
  badges: Badge[]
  selectedBadgeId: string | null
  hoveredBadgeId: string | null
  onSelectBadge: (id: string | null) => void
  onUpdateDescription?: (id: string, desc: string) => void
  onUpdateBadgeSize?: (id: string, size: BadgeSize) => void
  onDeleteBadge?: (id: string) => void
  onSwitchScreen: (id: string) => void
}

export default function DescriptionPanel({
  screens,
  activeScreenId,
  badges,
  selectedBadgeId,
  hoveredBadgeId,
  onSelectBadge,
  onUpdateDescription,
  onUpdateBadgeSize,
  onDeleteBadge,
  onSwitchScreen,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftDesc, setDraftDesc] = useState('')
  const [showScreenPicker, setShowScreenPicker] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const badgeListRef = useRef<HTMLDivElement>(null)

  // 캔버스 hover → 패널 해당 엔트리 스크롤
  useEffect(() => {
    if (!hoveredBadgeId || !badgeListRef.current) return
    const el = badgeListRef.current.querySelector(`[data-badge-id="${hoveredBadgeId}"]`) as HTMLElement | null
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [hoveredBadgeId])

  const selectedBadge = badges.find(b => b.id === selectedBadgeId) ?? null

  // 선택된 뱃지 바뀔 때만 편집 상태 초기화
  useEffect(() => {
    if (selectedBadgeId) {
      const badge = badges.find(b => b.id === selectedBadgeId)
      if (badge) {
        setEditingId(badge.id)
        setDraftDesc(badge.description)
      }
    } else {
      setEditingId(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBadgeId])

  // 화면 피커 외부 클릭 닫기
  useEffect(() => {
    if (!showScreenPicker) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowScreenPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showScreenPicker])

  const handleSave = (id: string) => {
    onUpdateDescription?.(id, draftDesc)
    setEditingId(null)
    onSelectBadge(null)   // 저장 후 선택 해제 → 툴바 뱃지 추가 모드로 복귀
  }

  // Figma 링크 복사
  const handleCopyLink = (figmaUrl: string, screenId: string) => {
    navigator.clipboard.writeText(figmaUrl)
    setCopiedId(screenId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // 커서 위치에 [[화면명]] 삽입
  const insertScreenLink = (screenName: string) => {
    const text = `[[${screenName}]]`
    const textarea = textareaRef.current
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = draftDesc.slice(0, start) + text + draftDesc.slice(end)
      setDraftDesc(newValue)
      setTimeout(() => {
        textarea.setSelectionRange(start + text.length, start + text.length)
        textarea.focus()
      }, 0)
    } else {
      setDraftDesc(prev => prev + text)
    }
    setShowScreenPicker(false)
  }

  // 설명 내 [[화면명]] 을 클릭 가능한 링크로 렌더링
  const renderDescWithLinks = (desc: string) => {
    const parts = desc.split(/(\[\[[^\]]+\]\])/g)
    return parts.map((part, i) => {
      const match = part.match(/^\[\[([^\]]+)\]\]$/)
      if (match) {
        const name = match[1]
        const screen = screens.find(s => s.frame.name === name)
        if (screen) {
          return (
            <button
              key={i}
              className="screen-link-chip"
              onClick={e => { e.stopPropagation(); onSwitchScreen(screen.id) }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              {name} →
            </button>
          )
        }
        return <span key={i} className="screen-link-missing">{part}</span>
      }
      return <span key={i}>{part}</span>
    })
  }

  const otherScreens = screens.filter(s => s.id !== activeScreenId)

  return (
    <aside className="desc-panel">

      {/* ── 주석 섹션 ── */}
      <div className="panel-header">
        <h2>주석</h2>
        <span className="annotation-count">{badges.length}개</span>
      </div>

      {badges.length === 0 ? (
        <div className="panel-empty">
          <div className="empty-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2"/>
              <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p>이미지 위에 뱃지를 배치하면<br/>여기서 설명을 입력할 수 있습니다.</p>
        </div>
      ) : (
        <div className="badge-list" ref={badgeListRef}>
          {badges.map((badge, idx) => (
            <div
              key={badge.id}
              data-badge-id={badge.id}
              className={`badge-entry ${badge.id === selectedBadgeId ? 'active' : ''} ${badge.id === hoveredBadgeId && badge.id !== selectedBadgeId ? 'hovered' : ''}`}
              onClick={() => onSelectBadge(badge.id)}
            >
              <div className="entry-header">
                <div
                  className="entry-pin"
                  style={{
                    width: BADGE_SIZE_PX[badge.size ?? 'M'].diameter,
                    height: BADGE_SIZE_PX[badge.size ?? 'M'].diameter,
                    fontSize: BADGE_SIZE_PX[badge.size ?? 'M'].fontSize,
                  }}
                >
                  <span>{badge.label}</span>
                </div>
                <div className="entry-size-btns" onClick={e => e.stopPropagation()}>
                  {BADGE_SIZE_LABELS.map(size => (
                    <button
                      key={size}
                      className={`entry-size-btn ${(badge.size ?? 'M') === size ? 'active' : ''}`}
                      onClick={e => { e.stopPropagation(); onUpdateBadgeSize?.(badge.id, size) }}
                      title={`크기 ${size}로 변경`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <div className="entry-actions">
                  <span className="entry-index">#{idx + 1}</span>
                  <button
                    className="delete-btn"
                    onClick={e => { e.stopPropagation(); onDeleteBadge?.(badge.id) }}
                    title="뱃지 삭제"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>

              {editingId === badge.id ? (
                <div className="entry-edit" onClick={e => e.stopPropagation()}>
                  <textarea
                    ref={textareaRef}
                    value={draftDesc}
                    onChange={e => setDraftDesc(e.target.value)}
                    placeholder="설명을 입력하세요... [[화면명]]으로 화면 링크 삽입"
                    autoFocus
                    rows={4}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave(badge.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                  />
                  <div className="edit-actions">
                    <div className="edit-actions-left" ref={pickerRef}>
                      <button
                        className="btn-link-screen"
                        type="button"
                        onClick={() => setShowScreenPicker(v => !v)}
                        title="화면 링크 삽입"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                          <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        화면 연결
                      </button>
                      {showScreenPicker && (
                        <div className="screen-picker-dropdown">
                          {otherScreens.length > 0 ? (
                            otherScreens.map(s => (
                              <button
                                key={s.id}
                                className="screen-picker-item"
                                onMouseDown={e => { e.preventDefault(); insertScreenLink(s.frame.name) }}
                              >
                                <span className="picker-num">{screens.indexOf(s) + 1}</span>
                                <span className="picker-name">{s.frame.name}</span>
                              </button>
                            ))
                          ) : (
                            <div className="picker-empty">다른 화면이 없습니다</div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="edit-actions-right">
                      <span className="edit-hint">⌘↵ 저장</span>
                      <button className="save-btn" onClick={() => handleSave(badge.id)}>저장</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={`entry-desc ${!badge.description ? 'placeholder' : ''}`}
                  onClick={e => {
                    e.stopPropagation()
                    setEditingId(badge.id)
                    setDraftDesc(badge.description)
                    onSelectBadge(badge.id)
                  }}
                >
                  {badge.description
                    ? renderDescWithLinks(badge.description)
                    : '클릭하여 설명 추가...'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedBadge && (
        <div className="panel-selected-info">
          <span>선택됨: <strong>{selectedBadge.label}</strong></span>
        </div>
      )}
    </aside>
  )
}
