import { useState } from 'react'
import { Badge, BadgeSize, BADGE_SIZE_LABELS, BADGE_SIZE_PX } from '../types'
import './Toolbar.css'

interface Props {
  pendingLabel: string | null
  pendingSize?: BadgeSize
  selectedBadge?: Badge | null
  onCancelPending: () => void
  onAddBadge?: (label: string, size: BadgeSize) => void
  onUpdateBadgeSize?: (id: string, size: BadgeSize) => void
  onDeselectBadge?: () => void
  onExport: () => void
  exporting?: boolean
  onSave?: () => void
  onOpenLibrary?: () => void
  showSpec?: boolean
  onToggleSpec?: () => void
  onAutoPlan?: () => void
  onNewProject?: () => void
  canEdit?: boolean
}

export default function Toolbar({
  pendingLabel,
  pendingSize,
  selectedBadge,
  onCancelPending,
  onAddBadge,
  onUpdateBadgeSize,
  onDeselectBadge,
  onExport,
  exporting = false,
  onSave,
  onOpenLibrary,
  showSpec = false,
  onToggleSpec,
  onAutoPlan,
  onNewProject,
  canEdit = true,
}: Props) {
  const [badgeInput, setBadgeInput] = useState('')
  const [badgeSize, setBadgeSize] = useState<BadgeSize>('M')

  function handleAddBadge() {
    const label = badgeInput.trim()
    if (!label || !onAddBadge) return
    onAddBadge(label, badgeSize)
    setBadgeInput('')
  }

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <div className="toolbar-brand">
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="7" fill="#7c6ef7"/>
            <path d="M8 10h6a4 4 0 010 8H8V10z" fill="white" opacity=".9"/>
            <circle cx="20" cy="22" r="4" fill="white" opacity=".7"/>
          </svg>
          <span>Storyboard</span>
        </div>
        <div className="toolbar-divider" />
        {canEdit && onNewProject && (
          <button className="btn-ghost" onClick={onNewProject} title="새 Figma URL로 변경">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 2v6h6M12 18v-6M9 15h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            새 작업
          </button>
        )}
        <button className="btn-ghost auto-plan" onClick={onAutoPlan} title="Claude AI로 자동 기획 생성">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          자동 기획
        </button>
      </div>

      <div className="toolbar-center">
        {!canEdit ? (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>뷰 전용 모드</span>
        ) : pendingLabel ? (
          <div className="pending-notice">
            <div
              className="pending-badge-preview"
              style={{
                width: BADGE_SIZE_PX[pendingSize ?? 'M'].diameter,
                height: BADGE_SIZE_PX[pendingSize ?? 'M'].diameter,
                fontSize: BADGE_SIZE_PX[pendingSize ?? 'M'].fontSize,
              }}
            >
              {pendingLabel}
            </div>
            <span>
              <strong>"{pendingLabel}"</strong> 뱃지를 이미지에 클릭하여 배치하세요
            </span>
            <button className="btn-cancel" onClick={onCancelPending}>취소</button>
          </div>
        ) : selectedBadge ? (
          <div className="selected-badge-group">
            <div
              className="selected-badge-preview"
              style={{
                width: BADGE_SIZE_PX[selectedBadge.size ?? 'M'].diameter,
                height: BADGE_SIZE_PX[selectedBadge.size ?? 'M'].diameter,
                fontSize: BADGE_SIZE_PX[selectedBadge.size ?? 'M'].fontSize,
              }}
            >
              {selectedBadge.label}
            </div>
            <span className="selected-badge-label">뱃지 크기</span>
            <div className="size-selector" role="group" aria-label="선택된 뱃지 크기 변경">
              {BADGE_SIZE_LABELS.map(size => (
                <button
                  key={size}
                  className={`size-option ${(selectedBadge.size ?? 'M') === size ? 'active' : ''}`}
                  onClick={() => onUpdateBadgeSize?.(selectedBadge.id, size)}
                  title={`크기 ${size}로 변경`}
                  style={{
                    width:    BADGE_SIZE_PX[size].diameter * 0.72,
                    height:   BADGE_SIZE_PX[size].diameter * 0.72,
                    fontSize: BADGE_SIZE_PX[size].fontSize - 1,
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
            <button
              className="deselect-btn"
              onClick={onDeselectBadge}
              title="선택 해제"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        ) : canEdit && onAddBadge ? (
          <div className="badge-input-group">
            <input
              className="badge-input"
              type="text"
              value={badgeInput}
              onChange={e => setBadgeInput(e.target.value.slice(0, 6))}
              onKeyDown={e => { if (e.key === 'Enter') handleAddBadge() }}
              placeholder="뱃지 텍스트"
              maxLength={6}
            />
            <div className="size-selector" role="group" aria-label="뱃지 크기 선택">
              {BADGE_SIZE_LABELS.map(size => (
                <button
                  key={size}
                  className={`size-option ${badgeSize === size ? 'active' : ''}`}
                  onClick={() => setBadgeSize(size)}
                  title={`크기 ${size}`}
                  style={{
                    width: BADGE_SIZE_PX[size].diameter * 0.72,
                    height: BADGE_SIZE_PX[size].diameter * 0.72,
                    fontSize: BADGE_SIZE_PX[size].fontSize - 1,
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
            <button
              className="btn-add-badge"
              onClick={handleAddBadge}
              disabled={!badgeInput.trim()}
              title="뱃지 추가"
            >
              + 뱃지 추가
            </button>
          </div>
        ) : null}
      </div>

      <div className="toolbar-actions">
        {canEdit && onSave && (
          <button className="btn-ghost save" onClick={onSave} title="현재 스토리보드 저장">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            저장
          </button>
        )}
        {canEdit && onOpenLibrary && (
          <button className="btn-ghost library" onClick={onOpenLibrary} title="저장된 스토리보드 라이브러리">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M3 5a2 2 0 012-2h4a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM13 5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM13 15a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            라이브러리
          </button>
        )}
        <div className="toolbar-divider" />
        <button
          className={`btn-ghost spec-toggle ${showSpec ? 'active' : ''}`}
          onClick={onToggleSpec}
          title={showSpec ? '스토리보드 보기로 전환' : 'Figma 디자인 스펙 보기'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            <path d="M14 17.5h7M17.5 14v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {showSpec ? '스토리보드 보기' : '디자인 스펙 보기'}
        </button>
        <div className="toolbar-divider" />
        <button className="btn-ghost" onClick={onExport} disabled={exporting} title="공유 파일 내보내기">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {exporting ? '내보내는 중...' : '공유 파일 내보내기'}
        </button>
      </div>
    </header>
  )
}
