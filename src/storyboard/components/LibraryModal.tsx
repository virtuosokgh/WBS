import { useState } from 'react'
import { SavedProject } from '../types'
import './LibraryModal.css'

const STORAGE_KEY = 'sb_projects'

export function loadProjects(): SavedProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as SavedProject[]
  } catch {}
  return []
}

export function persistProjects(projects: SavedProject[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
}

interface Props {
  onLoad: (project: SavedProject) => void
  onClose: () => void
}

export default function LibraryModal({ onLoad, onClose }: Props) {
  const [projects, setProjects] = useState<SavedProject[]>(loadProjects)

  const handleDelete = (id: string) => {
    if (!confirm('이 스토리보드를 삭제하시겠습니까?')) return
    const updated = projects.filter(p => p.id !== id)
    persistProjects(updated)
    setProjects(updated)
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const totalBadges = (p: SavedProject) =>
    p.screens.reduce((acc, s) => acc + s.badges.length, 0)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="library-modal" onClick={e => e.stopPropagation()}>
        <div className="library-header">
          <div className="library-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 5a2 2 0 012-2h4a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM13 5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM13 15a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>저장된 스토리보드 라이브러리</span>
          </div>
          <button className="library-close-btn" onClick={onClose} title="닫기">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="library-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" opacity=".25">
              <path d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"
                stroke="currentColor" strokeWidth="1.5"/>
              <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <p className="library-empty-title">저장된 스토리보드가 없습니다</p>
            <p className="library-empty-sub">
              툴바의 <strong>저장</strong> 버튼으로 현재 작업을 저장하세요.
            </p>
          </div>
        ) : (
          <div className="library-list">
            {projects.map(p => (
              <div className="library-item" key={p.id}>
                <div className="library-item-thumb">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="3" width="20" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M2 8h20" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M7 12h4M7 15h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="library-item-info">
                  <span className="library-item-name">{p.name}</span>
                  <span className="library-item-meta">
                    {p.screens.length}개 화면 &nbsp;·&nbsp; {totalBadges(p)}개 주석 &nbsp;·&nbsp; {formatDate(p.savedAt)}
                  </span>
                </div>
                <div className="library-item-actions">
                  <button
                    className="btn-load-project"
                    onClick={() => { onLoad(p); onClose() }}
                  >
                    불러오기
                  </button>
                  <button
                    className="btn-delete-project"
                    onClick={() => handleDelete(p.id)}
                    title="삭제"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
