import { useRef, useState, useCallback, useEffect } from 'react'
import { Badge, BadgeSize, FigmaFrame, BADGE_SIZE_LABELS, BADGE_SIZE_PX } from '../types'
import './ImageCanvas.css'

interface Props {
  frame: FigmaFrame
  badges: Badge[]
  selectedBadgeId: string | null
  pendingBadge: { label: string; size: BadgeSize } | null
  onBadgePlace: (x: number, y: number) => void
  onBadgeMove: (id: string, x: number, y: number) => void
  onBadgeSelect: (id: string | null) => void
  onBadgeSizeChange: (id: string, size: BadgeSize) => void
  onBadgeHover: (id: string | null) => void
}

export default function ImageCanvas({
  frame,
  badges,
  selectedBadgeId,
  pendingBadge,
  onBadgePlace,
  onBadgeMove,
  onBadgeSelect,
  onBadgeSizeChange,
  onBadgeHover,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragOffset = useRef({ dx: 0, dy: 0 })

  // 화면(frame) 전환 시 로딩/에러 상태 초기화
  useEffect(() => {
    setImgLoaded(false)
    setImgError(false)
  }, [frame.imageUrl])

  const getImageRect = useCallback((): DOMRect | null => {
    return imgRef.current?.getBoundingClientRect() ?? null
  }, [])

  const clientToRatio = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const rect = getImageRect()
    if (!rect) return null
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    }
  }, [getImageRect])

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (!pendingBadge) return
    const ratio = clientToRatio(e.clientX, e.clientY)
    if (!ratio) return
    onBadgePlace(ratio.x, ratio.y)
  }, [pendingBadge, clientToRatio, onBadgePlace])

  const handleBadgeMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    e.preventDefault()
    onBadgeSelect(id)
    setDraggingId(id)

    const rect = getImageRect()
    if (!rect) return
    const badge = badges.find(b => b.id === id)
    if (!badge) return

    const badgeClientX = rect.left + badge.x * rect.width
    const badgeClientY = rect.top + badge.y * rect.height
    dragOffset.current = {
      dx: e.clientX - badgeClientX,
      dy: e.clientY - badgeClientY,
    }
  }, [badges, onBadgeSelect, getImageRect])

  useEffect(() => {
    if (!draggingId) return

    const handleMouseMove = (e: MouseEvent) => {
      const ratio = clientToRatio(
        e.clientX - dragOffset.current.dx,
        e.clientY - dragOffset.current.dy
      )
      if (ratio) onBadgeMove(draggingId, ratio.x, ratio.y)
    }
    const handleMouseUp = () => setDraggingId(null)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingId, clientToRatio, onBadgeMove])

  return (
    <div
      className={`canvas-container ${pendingBadge ? 'placing' : ''}`}
      ref={containerRef}
    >
      <div
        className="canvas-image-wrap"
        onClick={handleCanvasClick}
      >
        {!imgLoaded && !imgError && (
          <div className="canvas-loading">
            <div className="spinner" />
            <span>이미지 불러오는 중...</span>
          </div>
        )}

        {imgError && (
          <div className="canvas-error">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" opacity=".4">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p>이미지를 불러올 수 없습니다</p>
            <p className="canvas-error-sub">Figma 이미지 URL이 만료되었을 수 있습니다.<br/>우측 상단 <strong>Figma 동기화</strong> 버튼을 눌러 새로고침하세요.</p>
          </div>
        )}

        <img
          ref={imgRef}
          src={frame.imageUrl}
          alt=""
          className={`canvas-image ${imgLoaded ? 'visible' : ''}`}
          onLoad={() => { setImgLoaded(true); setImgError(false) }}
          onError={() => { setImgError(true); setImgLoaded(false) }}
          draggable={false}
        />

        {imgLoaded && badges.map(badge => (
          <BadgePin
            key={badge.id}
            badge={badge}
            isSelected={badge.id === selectedBadgeId}
            isDragging={badge.id === draggingId}
            onMouseDown={(e) => handleBadgeMouseDown(e, badge.id)}
            onClick={(e) => { e.stopPropagation(); onBadgeSelect(badge.id) }}
            onSizeChange={(size) => onBadgeSizeChange(badge.id, size)}
            onHover={(hovering) => onBadgeHover(hovering ? badge.id : null)}
          />
        ))}

        {imgLoaded && (
          <a
            href={frame.figmaUrl}
            target="_blank"
            rel="noreferrer"
            className="figma-link-float"
            onClick={e => e.stopPropagation()}
            title="Figma에서 디자인 스펙 확인"
          >
            <FigmaIcon />
            <span>Figma 스펙 확인 ↗</span>
          </a>
        )}

        {pendingBadge && imgLoaded && (
          <div className="placing-hint">
            클릭하여 <strong>"{pendingBadge.label}"</strong> 뱃지를 배치하세요
          </div>
        )}
      </div>
    </div>
  )
}

function BadgePin({
  badge,
  isSelected,
  isDragging,
  onMouseDown,
  onClick,
  onSizeChange,
  onHover,
}: {
  badge: Badge
  isSelected: boolean
  isDragging: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onClick: (e: React.MouseEvent) => void
  onSizeChange: (size: BadgeSize) => void
  onHover: (hovering: boolean) => void
}) {
  const sizePx = BADGE_SIZE_PX[badge.size ?? 'M']
  return (
    <div
      className={`badge-pin ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{
        left: `${badge.x * 100}%`,
        top: `${badge.y * 100}%`,
        width: sizePx.diameter,
        height: sizePx.diameter,
        fontSize: sizePx.fontSize,
      }}
      onMouseDown={onMouseDown}
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      title={badge.description || badge.label}
    >
      <span>{badge.label}</span>

      {/* 선택 시 크기 팝업 */}
      {isSelected && !isDragging && (
        <div
          className="badge-size-popup"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          {BADGE_SIZE_LABELS.map(size => (
            <button
              key={size}
              className={`size-popup-btn ${(badge.size ?? 'M') === size ? 'active' : ''}`}
              onMouseDown={e => { e.stopPropagation(); e.preventDefault() }}
              onClick={e => { e.stopPropagation(); onSizeChange(size) }}
              title={`크기 ${size}로 변경`}
              style={{
                width: BADGE_SIZE_PX[size].diameter * 0.68,
                height: BADGE_SIZE_PX[size].diameter * 0.68,
                fontSize: BADGE_SIZE_PX[size].fontSize - 1,
              }}
            >
              {size}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FigmaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 38 57" fill="none">
      <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" fill="#1ABCFE"/>
      <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 0 1-19 0z" fill="#0ACF83"/>
      <path d="M19 0v19h9.5a9.5 9.5 0 0 0 0-19H19z" fill="#FF7262"/>
      <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="#F24E1E"/>
      <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="#A259FF"/>
    </svg>
  )
}
