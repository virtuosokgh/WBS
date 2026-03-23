import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Badge, BadgeSize, Screen, FigmaFrame, FigmaPageTree, FigmaTreeNode, SavedProject } from './types'
import { parseFigmaUrl, fetchFigmaNodeMeta, fetchFigmaImageUrls, fetchFigmaNodeTree, fetchFigmaNodeImage } from './figmaUtils'
import FigmaSetup from './components/FigmaSetup'
import Toolbar from './components/Toolbar'
import ImageCanvas from './components/ImageCanvas'
import DescriptionPanel from './components/DescriptionPanel'
import AddScreenModal from './components/AddScreenModal'
import LibraryModal, { loadProjects, persistProjects } from './components/LibraryModal'
import SpecView from './components/SpecView'
import ScreenListPanel from './components/ScreenListPanel'
import AutoPlanModal from './components/AutoPlanModal'
import { exportAsHtml } from './exportHtml'
import { FlowchartData } from './FlowchartView'
import { getStoryboard, upsertStoryboard } from '../lib/db'
import './storyboard.css'

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

interface ModalConfig {
  mode: 'url' | 'project'
  fileKey?: string
}

interface Props {
  initialScreenId?: string | null
  projectId?: string | null
  canEdit?: boolean
}

export default function StoryboardApp({ initialScreenId, projectId, canEdit = true }: Props = {}) {
  const [screens, setScreens] = useState<Screen[]>([])
  const [flowchartData, setFlowchartData] = useState<FlowchartData | null>(null)
  const [loadingFromDb, setLoadingFromDb] = useState(!!projectId)
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null)
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null)
  const [hoveredBadgeId, setHoveredBadgeId] = useState<string | null>(null)
  const [pendingBadge, setPendingBadge] = useState<{ label: string; size: BadgeSize } | null>(null)
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null)
  const [exporting, setExporting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showSpec, setShowSpec] = useState(false)
  const [showAutoPlan, setShowAutoPlan] = useState(false)
  const [figmaTree, setFigmaTree] = useState<FigmaPageTree[]>([])
  const [treeLoading, setTreeLoading] = useState(false)

  // Load from Supabase on mount
  useEffect(() => {
    if (!projectId) {
      // fallback: localStorage (no project context)
      try {
        const raw = localStorage.getItem('sb_current')
        if (raw) {
          const s = JSON.parse(raw) as Screen[]
          setScreens(s)
          setActiveScreenId(s[0]?.id ?? null)
        }
      } catch {}
      return
    }
    setLoadingFromDb(true)
    getStoryboard(projectId).then(({ data }) => {
      if (data?.screens?.length) {
        const s = data.screens as Screen[]
        setScreens(s)
        setActiveScreenId(s[0]?.id ?? null)
      }
      if (data?.flowchart) {
        setFlowchartData(data.flowchart as FlowchartData)
      }
      setLoadingFromDb(false)
    })
  }, [projectId])

  // Auto-save to Supabase (debounced) when canEdit
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!projectId || !canEdit || loadingFromDb) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      upsertStoryboard(projectId, screens, undefined)
    }, 1500)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [screens, projectId, canEdit, loadingFromDb])

  // External screen navigation
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

  // Fetch the full Figma document tree when we have a fileKey
  const treeFetchedRef = useRef(false)
  useEffect(() => {
    if (!figmaFileKey || treeFetchedRef.current || figmaTree.length > 0) return
    const token = localStorage.getItem('figma_token') || ''
    if (!token) return
    treeFetchedRef.current = true
    setTreeLoading(true)
    fetchFigmaNodeTree(figmaFileKey, token)
      .then(tree => setFigmaTree(tree))
      .catch(() => { /* tree is supplementary, don't block on failure */ })
      .finally(() => setTreeLoading(false))
  }, [figmaFileKey, figmaTree.length])

  // Handle tree node selection: create a screen on-the-fly if needed
  const handleTreeNodeSelect = useCallback(async (node: FigmaTreeNode) => {
    // Check if screen already exists
    const existing = screens.find(s => s.frame.id === node.id)
    if (existing) {
      setActiveScreenId(existing.id)
      setSelectedBadgeId(null)
      return
    }

    if (!figmaFileKey) return
    const token = localStorage.getItem('figma_token') || ''
    if (!token) return

    try {
      const imageUrl = await fetchFigmaNodeImage(figmaFileKey, node.id, token)
      const frame: FigmaFrame = {
        id: node.id,
        name: node.name,
        imageUrl,
        figmaUrl: `https://www.figma.com/file/${figmaFileKey}?node-id=${node.id.replace(':', '-')}`,
        width: node.width || 0,
        height: node.height || 0,
        pageId: node.pageId || '',
        pageName: node.pageName || '',
      }
      const newScreen: Screen = { id: generateId(), frame, badges: [] }
      setScreens(prev => [...prev, newScreen])
      setActiveScreenId(newScreen.id)
      setSelectedBadgeId(null)
    } catch (e) {
      alert('노드 이미지를 가져올 수 없습니다: ' + (e instanceof Error ? e.message : String(e)))
    }
  }, [screens, figmaFileKey])

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
    alert('스냅샷이 라이브러리에 저장되었습니다.')
  }, [screens])

  const handleAutoPlanApply = useCallback(async (updatedScreens: Screen[], flowchart: FlowchartData) => {
    setScreens(updatedScreens)
    setFlowchartData(flowchart)
    if (projectId) {
      await upsertStoryboard(projectId, updatedScreens, flowchart)
    } else {
      localStorage.setItem('sb_flowchart', JSON.stringify(flowchart))
    }
    setShowAutoPlan(false)
  }, [projectId])

  const handleLoadProject = useCallback((project: SavedProject) => {
    if (screens.length > 0 && !confirm('현재 작업을 버리고 저장된 스냅샷을 불러오시겠습니까?')) return
    setScreens(project.screens)
    setActiveScreenId(project.screens[0]?.id ?? null)
    setSelectedBadgeId(null)
    setPendingBadge(null)
  }, [screens])

  const handleNewProject = useCallback(() => {
    if (screens.length > 0 && !confirm('현재 스토리보드를 초기화하고 새 Figma URL을 입력하시겠습니까?')) return
    setScreens([])
    setActiveScreenId(null)
    setSelectedBadgeId(null)
    setPendingBadge(null)
    setFigmaTree([])
    treeFetchedRef.current = false
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

  // Loading state
  if (loadingFromDb) {
    return (
      <div className="sb-root">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 14 }}>
          스토리보드 불러오는 중...
        </div>
      </div>
    )
  }

  // No screens yet
  if (screens.length === 0) {
    if (!canEdit) {
      return (
        <div className="sb-root">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: '#9ca3af' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4zM4 14a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3z" stroke="currentColor" strokeWidth="1.5"/></svg>
            <p style={{ fontSize: 15, fontWeight: 600 }}>스토리보드가 아직 없습니다</p>
            <p style={{ fontSize: 13 }}>호스트 또는 관리자가 Figma URL을 등록하면 여기서 볼 수 있습니다</p>
          </div>
        </div>
      )
    }
    return (
      <div className="sb-root">
        <FigmaSetup
          onFramesLoaded={(frames, tree) => {
            const newScreens: Screen[] = frames.map(frame => ({ id: generateId(), frame, badges: [] }))
            setScreens(newScreens)
            setActiveScreenId(newScreens[0].id)
            if (tree && tree.length > 0) {
              setFigmaTree(tree)
            }
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
          selectedBadge={activeBadges.find(b => b.id === selectedBadgeId) ?? null}
          onCancelPending={() => setPendingBadge(null)}
          onUpdateBadgeSize={canEdit ? handleUpdateBadgeSize : undefined}
          onDeselectBadge={() => setSelectedBadgeId(null)}
          onExport={handleExport}
          exporting={exporting}
          onSave={canEdit ? handleSaveProject : undefined}
          onOpenLibrary={canEdit ? () => setShowLibrary(true) : undefined}
          showSpec={showSpec}
          onToggleSpec={() => setShowSpec(v => !v)}
          onAutoPlan={canEdit ? () => setShowAutoPlan(true) : undefined}
          onNewProject={canEdit ? handleNewProject : undefined}
          canEdit={canEdit}
        />
        <div className="app-body">
          <ScreenListPanel
            screens={screens}
            activeScreenId={activeScreenId}
            onSwitchScreen={handleSwitchScreen}
            onAddScreen={canEdit ? () => setModalConfig({ mode: 'url' }) : undefined}
            onRefresh={canEdit ? handleSync : undefined}
            onRemoveScreen={canEdit ? handleRemoveScreen : undefined}
            canEdit={canEdit}
            figmaTree={figmaTree}
            onTreeNodeSelect={canEdit ? handleTreeNodeSelect : undefined}
          />
          {activeFrame && showSpec ? (
            <SpecView frame={activeFrame} />
          ) : (
            <>
              {activeFrame && (
                <ImageCanvas
                  frame={activeFrame}
                  badges={activeBadges}
                  selectedBadgeId={selectedBadgeId}
                  pendingBadge={canEdit ? pendingBadge : null}
                  onBadgePlace={canEdit ? handleBadgePlace : () => {}}
                  onBadgeMove={canEdit ? handleBadgeMove : () => {}}
                  onBadgeSelect={setSelectedBadgeId}
                  onBadgeSizeChange={canEdit ? handleUpdateBadgeSize : undefined}
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
                onUpdateDescription={canEdit ? handleUpdateDescription : undefined}
                onUpdateBadgeSize={canEdit ? handleUpdateBadgeSize : undefined}
                onDeleteBadge={canEdit ? handleDeleteBadge : undefined}
                onSwitchScreen={handleSwitchScreen}
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
