import { useState, useEffect } from 'react'
import { Screen } from '../types'
import './ScreenListPanel.css'

interface Props {
  screens: Screen[]
  activeScreenId: string | null
  onSwitchScreen: (id: string) => void
  onAddScreen?: () => void
  onRefresh?: () => void
  onRemoveScreen?: (id: string) => void
  canEdit?: boolean
}

export default function ScreenListPanel({
  screens, activeScreenId, onSwitchScreen, onAddScreen, onRefresh, onRemoveScreen, canEdit
}: Props) {
  // Derive unique pages
  const pages = Array.from(
    new Map(
      screens.map(s => [
        s.frame.pageId || '__default__',
        { id: s.frame.pageId || '__default__', name: s.frame.pageName || '기본 페이지' }
      ])
    ).values()
  )

  const activeScreen = screens.find(s => s.id === activeScreenId)
  const defaultPage = activeScreen?.frame.pageId || pages[0]?.id || '__default__'
  const [activePageId, setActivePageId] = useState(defaultPage)

  // Follow active screen's page
  useEffect(() => {
    if (activeScreen) {
      const pid = activeScreen.frame.pageId || '__default__'
      setActivePageId(pid)
    }
  }, [activeScreenId])

  const pageScreens = screens.filter(s => (s.frame.pageId || '__default__') === activePageId)

  return (
    <aside className="screen-list-panel">
      {/* Page tabs */}
      {pages.length > 1 && (
        <div className="slp-pages">
          {pages.map(page => (
            <button
              key={page.id}
              className={`slp-page-tab ${page.id === activePageId ? 'active' : ''}`}
              onClick={() => setActivePageId(page.id)}
              title={page.name}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M3 9h18" stroke="currentColor" strokeWidth="1.8"/>
              </svg>
              <span>{page.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="slp-header">
        <span className="slp-title">
          {pages.length === 1 ? (pages[0]?.name || '레이어') : pages.find(p => p.id === activePageId)?.name || '레이어'}
        </span>
        <div className="slp-header-actions">
          <span className="slp-count">{pageScreens.length}</span>
          {canEdit && onRefresh && (
            <button className="slp-refresh-btn" onClick={onRefresh} title="Figma에서 새로고침">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Frame list */}
      <div className="slp-list">
        {pageScreens.map((screen) => (
          <div
            key={screen.id}
            className={`slp-item ${screen.id === activeScreenId ? 'active' : ''}`}
            onClick={() => onSwitchScreen(screen.id)}
          >
            <div className="slp-thumb">
              {screen.frame.imageUrl
                ? <img src={screen.frame.imageUrl} alt={screen.frame.name} />
                : <div className="slp-thumb-placeholder" />
              }
            </div>
            <div className="slp-item-info">
              <span className="slp-item-name" title={screen.frame.name}>{screen.frame.name}</span>
              {screen.badges.length > 0 && (
                <span className="slp-badge-count">{screen.badges.length}개</span>
              )}
            </div>
            {canEdit && onRemoveScreen && pageScreens.length > 1 && (
              <button
                className="slp-remove-btn"
                onClick={e => {
                  e.stopPropagation()
                  if (confirm(`"${screen.frame.name}" 화면을 삭제하시겠습니까?`)) {
                    onRemoveScreen(screen.id)
                  }
                }}
                title="화면 삭제"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        ))}

        {canEdit && onAddScreen && (
          <button className="slp-add-btn" onClick={onAddScreen}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            화면 추가
          </button>
        )}
      </div>
    </aside>
  )
}
