import { useState, useCallback, useMemo, useEffect } from 'react'
import { Badge, BadgeSize, Screen, FigmaFrame, SavedProject } from './types'
import { parseFigmaUrl, fetchFigmaNodeMeta, fetchFigmaImageUrls } from './figmaUtils'
import FigmaSetup from './components/FigmaSetup'
import Toolbar from './components/Toolbar'
import ImageCanvas from './components/ImageCanvas'
import DescriptionPanel from './components/DescriptionPanel'
import AddScreenModal from './components/AddScreenModal'
import LibraryModal, { loadProjects, persistProjects } from './components/LibraryModal'
import SpecView from './components/SpecView'
import AutoPlanModal from './components/AutoPlanModal'
import { exportAsHtml } from './exportHtml'
import { saveFlowchart, FlowchartData } from './FlowchartView'
import './storyboard.css'

const CURRENT_KEY = 'sb_current'

function loadCurrentScreens(): Screen[] {
  try {
    const raw = localStorage.getItem(CURRENT_KEY)
    if (raw) return JSON.parse(raw) as Screen[]
  } catch {}
  return []
}

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

interface ModalConfig {
  mode: 'url' | 'project'
  fileKey?: string
}

interface Props {
  initialScreenId?: string | null
}

export default function StoryboardApp({ initialScreenId }: Props = {}) {
  const [screens, setScreens] = useState<Screen[]>(loadCurrentScreens)
  const [activeScreenId, setActiveScreenId] = useState<string | null>(
    () => loadCurrentScreens()[0]?.id ?? null
  )
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null)
  const [hoveredBadgeId, setHoveredBadgeId] = useState<string | null>(null)
  const [pendingBadge, setPendingBadge] = useState<{ label: string; size: BadgeSize } | null>(null)
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null)
  const [exporting, setExporting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showSpec, setShowSpec] = useState(false)
  const [showAutoPlan, setShowAutoPlan] = useState(false)

  useEffect(() => {
    if (screens.length > 0) {
      localStorage.setItem(CURRENT_KEY, JSON.stringify(screens))
    } else {
      localStorage.removeItem(CURRENT_KEY)
    }
  }, [screens])

  // 외부에서 특정 화면으로 이동 요청
  useEffect(() => {
    if (initialScreenId && screens.some(s => s.id === initialScreenId)) {
      setActiveScreenId(initialScreenId)
      setSelectedBadgeId(null)
    }
  }, [initialScreenId, screens])

  const activeScreen = screens.find(s => s.id === activeScreenId) ?? null
  const activeBadges = activeScreen?.badges ?? []
  const activeFrame = activeScreen?.frame ?? null

  const figmaFileKey = useMemo(() => {
    if (screens.length === 0) return null
    const parsed = parseFigmaUrl(screens[0].frame.figmaUrl)
    return parsed?.fileKey ?? null
  }, [screens])

  const existingFrameIds = useMemo(() => screens.map(s => s.frame.id), [screens])

  const handleSwitchScreen = useCallback((id: string) => {
    setActiveScreenId(id)
    setSelectedBadgeId(null)
    setPendingBadge(null)
  }, [])

  const handleAddScreen = useCallback((frame: FigmaFrame) => {
    const newScreen: Screen = { id: generateId(), frame, badges: [] }
    setScreens(prev => [...prev, newScreen])
    setActiveScreenId(newScreen.id)
    setSelectedBadgeId(null)
    setModalConfig(null)
  }, [])

  const handleAddScreens = useCallback((frames: FigmaFrame[]) => {
    if (frames.length === 0) return
    const newScreens: Screen[] = frames.map(frame => ({ id: generateId(), frame, badges: [] }))
    setScreens(prev => [...prev, ...newScreens])
    setActiveScreenId(newScreens[0].id)
    setSelectedBadgeId(null)
    setModalConfig(null)
  }, [])

  const handleRemoveScreen = useCallback((id: string) => {
    setScreens(prev => {
      const next = prev.filter(s => s.id !== id)
      if (activeScreenId === id && next.length > 0) {
        setActiveScreenId(next[0].id)
        setSelectedBadgeId(null)
      }
      return next
    })
  }, [activeScreenId])

  const handleAddBadge = useCallback((label: string, size: BadgeSize) => {
    setPendingBadge({ label, size })
    setSelectedBadgeId(null)
  }, [])

  const handleBadgePlace = useCallback((x: number, y: number) => {
    if (!pendingBadge || !activeScreenId) return
    const newBadge: Badge = {
      id: generateId(),
      label: pendingBadge.label,
      x,
      y,
      description: '',
      size: pendingBadge.size,
    }
    setScreens(prev => prev.map(s =>
      s.id === activeScreenId ? { ...s, badges: [...s.badges, newBadge] } : s
    ))
    setSelectedBadgeId(newBadge.id)
    setPendingBadge(null)
  }, [pendingBadge, activeScreenId])

  const handleBadgeMove = useCallback((id: string, x: number, y: number) => {
    if (!activeScreenId) return
    setScreens(prev => prev.map(s =>
      s.id === activeScreenId
        ? { ...s, badges: s.badges.map(b => b.id === id ? { ...b, x, y } : b) }
        : s
    ))
  }, [activeScreenId])

  const handleUpdateDescription = useCallback((id: string, desc: string) => {
    if (!activeScreenId) return
    setScreens(prev => prev.map(s =>
      s.id === activeScreenId
        ? { ...s, badges: s.badges.map(b => b.id === id ? { ...b, description: desc } : b) }
        : s
    ))
  }, [activeScreenId])

  const handleUpdateBadgeSize = useCallback((id: string, size: BadgeSize) => {
    if (!activeScreenId) return
    const currentBadges = screens.find(s => s.id === activeScreenId)?.badges ?? []
    const otherCount = currentBadges.filter(b => b.id !== id).length

    if (otherCount > 0) {
      const changeAll = confirm(
        `현재 화면의 모든 뱃지(${currentBadges.length}개)를 "${size}" 크기로 변경하시겠습니까?\n\n확인 → 전체 변경\n취소 → 선택한 뱃지만 변경`
      )
      setScreens(prev => prev.map(s =>
        s.id === activeScreenId
          ? {
              ...s,
              badges: changeAll
                ? s.badges.map(b => ({ ...b, size }))
                : s.badges.map(b => b.id === id ? { ...b, size } : b),
            }
          : s
      ))
    } else {
      setScreens(prev => prev.map(s =>
        s.id === activeScreenId
          ? { ...s, badges: s.badges.map(b => b.id === id ? { ...b, size } : b) }
          : s
      ))
    }
  }, [activeScreenId, screens])

  const handleDeleteBadge = useCallback((id: string) => {
    if (!activeScreenId) return
    setScreens(prev => prev.map(s =>
      s.id === activeScreenId
        ? { ...s, badges: s.badges.filter(b => b.id !== id) }
        : s
    ))
    setSelectedBadgeId(prev => prev === id ? null : prev)
  }, [activeScreenId])

  const handleSync = useCallback(async () => {
    if (!figmaFileKey) { alert('동기화할 Figma 파일 정보가 없습니다.'); return }
    const token = localStorage.getItem('figma_token') || ''
    if (!token) { alert('저장된 토큰이 없습니다.'); return }

    setSyncing(true)
    try {
      const frames = await fetchFigmaNodeMeta(figmaFileKey, null, token)
      if (frames.length === 0) throw new Error('파일에 프레임이 없습니다.')

      const allIds = frames.map(f => f.id)
      const imageUrls = await fetchFigmaImageUrls(figmaFileKey, allIds, token)

      const existingIdSet = new Set(screens.map(s => s.frame.id))
      const newFrames = frames.filter(f => !existingIdSet.has(f.id) && imageUrls[f.id])
      const updatedCount = screens.filter(s => imageUrls[s.frame.id]).length
      const addedCount = newFrames.length

      setScreens(prev => {
        const updated = prev.map(s => {
          const newUrl = imageUrls[s.frame.id]
          return newUrl ? { ...s, frame: { ...s.frame, imageUrl: newUrl } } : s
        })
        const added: Screen[] = newFrames.map(f => ({
          id: generateId(),
          frame: {
            id: f.id,
            name: f.name,
            imageUrl: imageUrls[f.id],
            figmaUrl: `https://www.figma.com/file/${figmaFileKey}?node-id=${f.id.replace(':', '-')}`,
            width: f.width,
            height: f.height,
          },
          badges: [],
        }))
        return [...updated, ...added]
      })

      if (addedCount > 0) {
        alert(`동기화 완료!\n• ${addedCount}개 새 화면 추가\n• ${updatedCount}개 화면 이미지 업데이트`)
      } else {
        alert(`동기화 완료! ${updatedCount}개 화면 이미지를 최신으로 업데이트했습니다.`)
      }
    } catch (e) {
      alert('동기화 실패: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSyncing(false)
    }
  }, [figmaFileKey, screens])

  const handleSaveProject = useCallback(() => {
    if (screens.length === 0) { alert('저장할 화면이 없습니다.'); return }
    const existing = loadProjects()
    const now = new Date()
    const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
    const project: SavedProject = {
      id: Math.random().toString(36).slice(2, 9),
      name: `스냅샷 ${dateStr} ${timeStr}`,
      savedAt: Date.now(),
      screens,
    }
    persistProjects([project, ...existing])
  }, [screens])

  const handleAutoPlanApply = useCallback((updatedScreens: Screen[], flowchart: FlowchartData) => {
    setScreens(updatedScreens)
    saveFlowchart(flowchart)
    setShowAutoPlan(false)
  }, [])

  const handleLoadProject = useCallback((project: SavedProject) => {
    if (screens.length > 0 && !confirm('현재 작업을 버리고 저장된 스냅샷을 불러오시겠습니까?')) return
    setScreens(project.screens)
    setActiveScreenId(project.screens[0]?.id ?? null)
    setSelectedBadgeId(null)
    setPendingBadge(null)
  }, [screens])

  const handleExport = useCallback(async () => {
    if (screens.length === 0 || exporting) return
    setExporting(true)
    try {
      await exportAsHtml(screens)
    } catch (e) {
      alert('내보내기 실패: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setExporting(false)
    }
  }, [screens, exporting])

  // 첫 화면 설정
  if (screens.length === 0) {
    return (
      <div className="sb-root">
        <FigmaSetup
          onFramesLoaded={(frames) => {
            const newScreens: Screen[] = frames.map(frame => ({ id: generateId(), frame, badges: [] }))
            setScreens(newScreens)
            setActiveScreenId(newScreens[0].id)
          }}
        />
      </div>
    )
  }

  return (
    <div className="sb-root">
      <div className="app">
        <Toolbar
          pendingLabel={pendingBadge?.label ?? null}
          pendingSize={pendingBadge?.size}
          badgeCount={activeBadges.length}
          selectedBadge={activeBadges.find(b => b.id === selectedBadgeId) ?? null}
          onAddBadge={handleAddBadge}
          onCancelPending={() => setPendingBadge(null)}
          onUpdateBadgeSize={handleUpdateBadgeSize}
          onDeselectBadge={() => setSelectedBadgeId(null)}
          onExport={handleExport}
          exporting={exporting}
          onSave={handleSaveProject}
          onOpenLibrary={() => setShowLibrary(true)}
          showSpec={showSpec}
          onToggleSpec={() => setShowSpec(v => !v)}
          onAutoPlan={() => setShowAutoPlan(true)}
        />
        <div className="app-body">
          {activeFrame && showSpec ? (
            <SpecView frame={activeFrame} />
          ) : (
            <>
              {activeFrame && (
                <ImageCanvas
                  frame={activeFrame}
                  badges={activeBadges}
                  selectedBadgeId={selectedBadgeId}
                  pendingBadge={pendingBadge}
                  onBadgePlace={handleBadgePlace}
                  onBadgeMove={handleBadgeMove}
                  onBadgeSelect={setSelectedBadgeId}
                  onBadgeSizeChange={handleUpdateBadgeSize}
                  onBadgeHover={setHoveredBadgeId}
                />
              )}
              <DescriptionPanel
                screens={screens}
                activeScreenId={activeScreenId}
                badges={activeBadges}
                selectedBadgeId={selectedBadgeId}
                hoveredBadgeId={hoveredBadgeId}
                onSelectBadge={setSelectedBadgeId}
                onUpdateDescription={handleUpdateDescription}
                onUpdateBadgeSize={handleUpdateBadgeSize}
                onDeleteBadge={handleDeleteBadge}
                onSwitchScreen={handleSwitchScreen}
                onAddScreen={() => setModalConfig({ mode: 'url' })}
                onRefresh={handleSync}
                onRemoveScreen={handleRemoveScreen}
              />
            </>
          )}
        </div>

        {modalConfig && (
          <AddScreenModal
            initialMode={modalConfig.mode}
            initialFileKey={modalConfig.fileKey}
            existingFrameIds={existingFrameIds}
            onAdd={handleAddScreen}
            onAddMultiple={handleAddScreens}
            onClose={() => setModalConfig(null)}
          />
        )}

        {showLibrary && (
          <LibraryModal
            onLoad={handleLoadProject}
            onClose={() => setShowLibrary(false)}
          />
        )}

        {showAutoPlan && (
          <AutoPlanModal
            screens={screens}
            onApply={handleAutoPlanApply}
            onClose={() => setShowAutoPlan(false)}
          />
        )}

      </div>
    </div>
  )
}
