import { useState, useEffect, useCallback } from 'react'
import { Screen, FigmaPageTree, FigmaTreeNode } from '../types'
import './ScreenListPanel.css'

/* ── 노드 타입별 아이콘 ── */
function NodeTypeIcon({ type }: { type: string }) {
  const size = 12
  switch (type) {
    case 'FRAME':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="slp-node-icon slp-icon-frame">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
        </svg>
      )
    case 'COMPONENT':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="slp-node-icon slp-icon-component">
          <path d="M12 2l10 10-10 10L2 12z" stroke="currentColor" strokeWidth="2"/>
        </svg>
      )
    case 'INSTANCE':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="slp-node-icon slp-icon-instance">
          <path d="M12 2l10 10-10 10L2 12z" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="2"/>
        </svg>
      )
    case 'GROUP':
    case 'SECTION':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="slp-node-icon slp-icon-group">
          <path d="M3 7V5a2 2 0 012-2h4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="2"/>
        </svg>
      )
    case 'TEXT':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="slp-node-icon slp-icon-text">
          <path d="M6 4h12M12 4v16M9 20h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      )
    case 'VECTOR':
    case 'LINE':
    case 'ELLIPSE':
    case 'RECTANGLE':
    case 'POLYGON':
    case 'STAR':
    case 'BOOLEAN_OPERATION':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="slp-node-icon slp-icon-shape">
          <path d="M12 3l9 18H3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        </svg>
      )
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="slp-node-icon slp-icon-default">
          <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/>
        </svg>
      )
  }
}

/* ── 트리 노드 컴포넌트 ── */
interface TreeNodeProps {
  node: FigmaTreeNode
  depth: number
  activeNodeId: string | null
  expandedNodes: Set<string>
  screenNodeIds: Set<string>
  onToggle: (id: string) => void
  onSelect: (node: FigmaTreeNode) => void
}

function TreeNodeItem({ node, depth, activeNodeId, expandedNodes, screenNodeIds, onToggle, onSelect }: TreeNodeProps) {
  const hasChildren = node.children && node.children.length > 0
  const isExpanded = expandedNodes.has(node.id)
  const isActive = node.id === activeNodeId
  const hasScreen = screenNodeIds.has(node.id)

  return (
    <div className="slp-tree-node">
      <div
        className={`slp-tree-row ${isActive ? 'active' : ''} ${hasScreen ? 'has-screen' : ''}`}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => onSelect(node)}
        title={`${node.name} (${node.type})`}
      >
        {/* Expand/collapse chevron */}
        <button
          className={`slp-chevron ${hasChildren ? '' : 'invisible'} ${isExpanded ? 'expanded' : ''}`}
          onClick={e => {
            e.stopPropagation()
            if (hasChildren) onToggle(node.id)
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <NodeTypeIcon type={node.type} />

        <span className="slp-tree-name">{node.name}</span>

        {hasScreen && (
          <span className="slp-screen-dot" title="화면 등록됨" />
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="slp-tree-children">
          {node.children!.map(child => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              activeNodeId={activeNodeId}
              expandedNodes={expandedNodes}
              screenNodeIds={screenNodeIds}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── 메인 패널 ── */
interface Props {
  screens: Screen[]
  activeScreenId: string | null
  onSwitchScreen: (id: string) => void
  onAddScreen?: () => void
  onRefresh?: () => void
  onRemoveScreen?: (id: string) => void
  canEdit?: boolean
  figmaTree?: FigmaPageTree[]
  onTreeNodeSelect?: (node: FigmaTreeNode) => void
}

export default function ScreenListPanel({
  screens, activeScreenId, onSwitchScreen, onAddScreen, onRefresh, onRemoveScreen, canEdit,
  figmaTree, onTreeNodeSelect,
}: Props) {
  // Build a set of node IDs that already have a Screen
  const screenNodeIds = new Set(screens.map(s => s.frame.id))

  // Track which tree node is "active" (matches the active screen)
  const activeScreen = screens.find(s => s.id === activeScreenId)
  const activeNodeId = activeScreen?.frame.id ?? null

  // Derive unique pages (fallback when no tree data)
  const pages = Array.from(
    new Map(
      screens.map(s => [
        s.frame.pageId || '__default__',
        { id: s.frame.pageId || '__default__', name: s.frame.pageName || '기본 페이지' }
      ])
    ).values()
  )

  const defaultPage = activeScreen?.frame.pageId || pages[0]?.id || '__default__'
  const [activePageId, setActivePageId] = useState(defaultPage)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree')

  // Follow active screen's page
  useEffect(() => {
    if (activeScreen) {
      const pid = activeScreen.frame.pageId || '__default__'
      setActivePageId(pid)
    }
  }, [activeScreenId, activeScreen])

  // When figmaTree becomes available, switch to tree view and auto-expand pages
  useEffect(() => {
    if (figmaTree && figmaTree.length > 0) {
      setViewMode('tree')
      // Auto-expand all pages and top-level frames
      const initial = new Set<string>()
      for (const page of figmaTree) {
        initial.add(page.id)
        for (const frame of page.frames) {
          initial.add(frame.id)
        }
      }
      setExpandedNodes(initial)
    }
  }, [figmaTree])

  // Auto-expand ancestor path when active node changes
  useEffect(() => {
    if (!figmaTree || !activeNodeId) return
    const path: string[] = []
    const findPath = (nodes: FigmaTreeNode[], target: string): boolean => {
      for (const n of nodes) {
        if (n.id === target) return true
        if (n.children && findPath(n.children, target)) {
          path.push(n.id)
          return true
        }
      }
      return false
    }
    for (const page of figmaTree) {
      if (findPath(page.frames, activeNodeId)) {
        path.push(page.id)
        break
      }
    }
    if (path.length > 0) {
      setExpandedNodes(prev => {
        const next = new Set(prev)
        for (const id of path) next.add(id)
        return next
      })
    }
  }, [activeNodeId, figmaTree])

  const handleToggle = useCallback((id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleTreeSelect = useCallback((node: FigmaTreeNode) => {
    // If there's already a screen for this node, just navigate to it
    const existing = screens.find(s => s.frame.id === node.id)
    if (existing) {
      onSwitchScreen(existing.id)
    } else if (onTreeNodeSelect) {
      // Let the parent create a screen on-the-fly
      onTreeNodeSelect(node)
    }
  }, [screens, onSwitchScreen, onTreeNodeSelect])

  const pageScreens = screens.filter(s => (s.frame.pageId || '__default__') === activePageId)

  // ── Tree View ──
  const renderTreeView = () => {
    if (!figmaTree || figmaTree.length === 0) return null
    return (
      <div className="slp-tree-list">
        {figmaTree.map(page => (
          <div key={page.id} className="slp-tree-page">
            <div
              className={`slp-tree-page-header ${expandedNodes.has(page.id) ? 'expanded' : ''}`}
              onClick={() => handleToggle(page.id)}
            >
              <svg className={`slp-chevron-icon ${expandedNodes.has(page.id) ? 'expanded' : ''}`} width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="slp-node-icon slp-icon-page">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M3 9h18" stroke="currentColor" strokeWidth="1.8"/>
              </svg>
              <span className="slp-tree-page-name">{page.name}</span>
              <span className="slp-tree-count">{page.frames.length}</span>
            </div>
            {expandedNodes.has(page.id) && (
              <div className="slp-tree-page-children">
                {page.frames.map(frame => (
                  <TreeNodeItem
                    key={frame.id}
                    node={frame}
                    depth={1}
                    activeNodeId={activeNodeId}
                    expandedNodes={expandedNodes}
                    screenNodeIds={screenNodeIds}
                    onToggle={handleToggle}
                    onSelect={handleTreeSelect}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  // ── List View (original) ──
  const renderListView = () => (
    <>
      {/* Page tabs (only in explicit list mode) */}
      {viewMode === 'list' && pages.length > 1 && (
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
    </>
  )

  const hasTree = figmaTree && figmaTree.length > 0

  return (
    <aside className="screen-list-panel">
      {/* Header */}
      <div className="slp-header">
        <span className="slp-title">레이어</span>
        <div className="slp-header-actions">
          {hasTree && (
            <div className="slp-view-toggle">
              <button
                className={`slp-view-btn ${viewMode === 'tree' ? 'active' : ''}`}
                onClick={() => setViewMode('tree')}
                title="트리 뷰"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path d="M4 6h16M8 12h12M12 18h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              <button
                className={`slp-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="리스트 뷰"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          )}
          <span className="slp-count">{screens.length}</span>
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

      {/* Content */}
      <div className="slp-content">
        {viewMode === 'tree' && hasTree ? renderTreeView() : renderListView()}

        {/* Add button at bottom (tree mode) */}
        {viewMode === 'tree' && canEdit && onAddScreen && (
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
