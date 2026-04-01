import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2, FileText, Target, ClipboardList, RefreshCw, X, Pencil, Check, Paperclip } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getSprints } from '../lib/sprints'
import { getMeetingsBySprintId, ensureDefaultMeetings, createMeeting, updateMeeting, deleteMeeting } from '../lib/meetings'
import { formatDate } from '../utils/helpers'

const MEETING_TYPE_INFO = {
  planning: { label: '계획', icon: ClipboardList, color: 'text-blue-600 bg-blue-50' },
  retrospective: { label: '회고', icon: RefreshCw, color: 'text-purple-600 bg-purple-50' },
  custom: { label: '회의', icon: FileText, color: 'text-gray-600 bg-gray-50' },
}

export default function MeetingNotes({ projectId, canEdit }) {
  const [sprints, setSprints] = useState([])
  const [expandedSprints, setExpandedSprints] = useState({})
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [meetingsMap, setMeetingsMap] = useState({}) // sprintId -> meetings[]
  const [drafts, setDrafts] = useState({}) // meetingId -> unsaved content

  // Load sprints
  useEffect(() => {
    const all = getSprints(projectId)
    setSprints(all)
    // 가장 최근 스프린트를 자동으로 펼침
    if (all.length > 0) {
      const latest = all[all.length - 1]
      setExpandedSprints({ [latest.id]: true })
      // 기본 회의 생성 & 로드
      const meetings = ensureDefaultMeetings(projectId, latest.id, latest.name)
      setMeetingsMap(prev => ({ ...prev, [latest.id]: meetings }))
    }
  }, [projectId])

  function toggleSprint(sprintId, sprintName) {
    setExpandedSprints(prev => {
      const next = { ...prev, [sprintId]: !prev[sprintId] }
      // 열릴 때 회의 로드
      if (next[sprintId] && !meetingsMap[sprintId]) {
        const meetings = ensureDefaultMeetings(projectId, sprintId, sprintName)
        setMeetingsMap(m => ({ ...m, [sprintId]: meetings }))
      }
      return next
    })
  }

  function loadSprintMeetings(sprintId, sprintName) {
    const meetings = ensureDefaultMeetings(projectId, sprintId, sprintName)
    setMeetingsMap(m => ({ ...m, [sprintId]: meetings }))
    return meetings
  }

  function handleSelectMeeting(meeting, sprintName) {
    setSelectedMeeting({ ...meeting, sprintName })
  }

  function handleAddMeeting(sprintId, sprintName) {
    const meeting = createMeeting(projectId, { sprintId, title: '새 회의' })
    const meetings = loadSprintMeetings(sprintId, sprintName)
    setSelectedMeeting({ ...meeting, sprintName })
  }

  function handleDeleteMeeting(meetingId, sprintId, sprintName) {
    deleteMeeting(projectId, meetingId)
    loadSprintMeetings(sprintId, sprintName)
    if (selectedMeeting?.id === meetingId) setSelectedMeeting(null)
  }

  function handleSaveMeeting(meetingId, updates) {
    const updated = updateMeeting(projectId, meetingId, updates)
    if (!updated) return
    // 사이드바 목록 갱신
    const sprint = sprints.find(s => s.id === updated.sprintId)
    if (sprint) loadSprintMeetings(sprint.id, sprint.name)
    // 선택 상태 갱신
    setSelectedMeeting(prev => prev?.id === meetingId ? { ...updated, sprintName: prev.sprintName } : prev)
  }

  const reversedSprints = useMemo(() => [...sprints].reverse(), [sprints])

  if (sprints.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <div className="text-center">
          <Target size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">스프린트가 없습니다.</p>
          <p className="text-xs mt-1">보드에서 스프린트를 생성하면 회의록을 작성할 수 있습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-0 min-h-[calc(100vh-220px)]">
      {/* Left sidebar - Sprint list & meetings */}
      <div className="w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50/50 overflow-y-auto">
        <div className="px-3 py-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">스프린트 회의록</h3>
        </div>
        <div className="pb-4">
          {reversedSprints.map(sprint => {
            const isExpanded = expandedSprints[sprint.id]
            const meetings = meetingsMap[sprint.id] || []
            const isActive = sprint.status === 'active'
            const isCompleted = sprint.status === 'completed'

            return (
              <div key={sprint.id}>
                {/* Sprint header */}
                <button
                  onClick={() => toggleSprint(sprint.id, sprint.name)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 transition-colors"
                >
                  {isExpanded ? <ChevronDown size={12} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-800 truncate">{sprint.name}</span>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {formatDate(sprint.startDate)} ~ {formatDate(sprint.endDate)}
                    </div>
                  </div>
                </button>

                {/* Meeting list */}
                {isExpanded && (
                  <div className="ml-3 border-l border-gray-200">
                    {meetings.length === 0 && (
                      <div className="px-3 py-2 text-xs text-gray-300">로딩 중...</div>
                    )}
                    {meetings
                      .sort((a, b) => {
                        const order = { planning: 0, retrospective: 1, custom: 2 }
                        if (order[a.type] !== order[b.type]) return order[a.type] - order[b.type]
                        return a.createdAt - b.createdAt
                      })
                      .map(meeting => {
                        const typeInfo = MEETING_TYPE_INFO[meeting.type] || MEETING_TYPE_INFO.custom
                        const isSelected = selectedMeeting?.id === meeting.id
                        const hasDraft = drafts[meeting.id] !== undefined
                        return (
                          <div
                            key={meeting.id}
                            className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors group ${
                              isSelected ? 'bg-indigo-50 border-r-2 border-indigo-500' : 'hover:bg-gray-100'
                            }`}
                          >
                            <button
                              onClick={() => handleSelectMeeting(meeting, sprint.name)}
                              className="flex items-center gap-2 flex-1 min-w-0"
                            >
                              <typeInfo.icon size={12} className={typeInfo.color.split(' ')[0]} />
                              <span className={`text-xs truncate ${isSelected ? 'font-medium text-indigo-700' : 'text-gray-600'}`}>
                                {meeting.title}
                              </span>
                              {hasDraft && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" title="저장하지 않은 변경사항" />}
                            </button>
                            {canEdit && meeting.type === 'custom' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteMeeting(meeting.id, sprint.id, sprint.name) }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all flex-shrink-0"
                                title="삭제"
                              >
                                <Trash2 size={10} />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    {canEdit && (
                      <button
                        onClick={() => handleAddMeeting(sprint.id, sprint.name)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-indigo-600 hover:bg-gray-100 transition-colors w-full"
                      >
                        <Plus size={11} />
                        회의 추가
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Right content - Meeting editor */}
      <div className="flex-1 min-w-0">
        {!selectedMeeting ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <FileText size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">회의를 선택하세요</p>
              <p className="text-xs mt-1">왼쪽 목록에서 회의를 선택하면 내용을 확인하고 편집할 수 있습니다.</p>
            </div>
          </div>
        ) : (
          <MeetingEditor
            key={selectedMeeting.id}
            meeting={selectedMeeting}
            canEdit={canEdit}
            onSave={(updates) => handleSaveMeeting(selectedMeeting.id, updates)}
            drafts={drafts}
            onDraftChange={(meetingId, content) => {
              setDrafts(prev => {
                const next = { ...prev }
                if (content === undefined) delete next[meetingId]
                else next[meetingId] = content
                return next
              })
            }}
          />
        )}
      </div>
    </div>
  )
}

function buildTableHTML(rows, cols) {
  let html = '<table><thead><tr>'
  for (let c = 0; c < cols; c++) html += `<th>제목 ${c + 1}</th>`
  html += '</tr></thead><tbody>'
  for (let r = 0; r < rows - 1; r++) {
    html += '<tr>'
    for (let c = 0; c < cols; c++) html += '<td><br></td>'
    html += '</tr>'
  }
  html += '</tbody></table><p><br></p>'
  return html
}

function TablePicker({ onInsert, onClose }) {
  const [hover, setHover] = useState({ r: 0, c: 0 })
  return (
    <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-2" onMouseLeave={() => setHover({ r: 0, c: 0 })}>
      <div className="text-[10px] text-gray-400 mb-1 text-center">{hover.r > 0 ? `${hover.r} x ${hover.c}` : '크기 선택'}</div>
      <div className="table-picker-grid">
        {Array.from({ length: 36 }, (_, i) => {
          const r = Math.floor(i / 6) + 1
          const c = (i % 6) + 1
          const isActive = r <= hover.r && c <= hover.c
          return (
            <div
              key={i}
              className={`table-picker-cell ${isActive ? 'active' : ''}`}
              onMouseEnter={() => setHover({ r, c })}
              onClick={() => { onInsert(r, c); onClose() }}
            />
          )
        })}
      </div>
    </div>
  )
}

function MeetingEditor({ meeting, canEdit, onSave, drafts, onDraftChange }) {
  const [title, setTitle] = useState(meeting.title)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [showTablePicker, setShowTablePicker] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const editorRef = useRef(null)
  const fileInputRef = useRef(null)
  const initializedRef = useRef(false)
  const composingRef = useRef(false)
  const savedSelectionRef = useRef(null)
  const typeInfo = MEETING_TYPE_INFO[meeting.type] || MEETING_TYPE_INFO.custom

  // 드래프트가 있으면 드래프트 사용, 없으면 저장된 content 사용
  const initialContent = drafts[meeting.id] ?? meeting.content ?? ''

  // Reset when meeting changes
  useEffect(() => {
    initializedRef.current = false
    setTitle(meeting.title)
    setIsEditingTitle(false)
    setSaved(false)
    const content = drafts[meeting.id] ?? meeting.content ?? ''
    setIsDirty(drafts[meeting.id] !== undefined)
    if (editorRef.current) {
      editorRef.current.innerHTML = content
      initializedRef.current = true
    }
  }, [meeting.id])

  // Initialize editor content once
  useEffect(() => {
    if (editorRef.current && !initializedRef.current) {
      editorRef.current.innerHTML = initialContent
      initializedRef.current = true
    }
  }, [])

  // 에디터 포커스 & 셀렉션 보장
  function ensureFocus() {
    const el = editorRef.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    if (!sel.rangeCount || !el.contains(sel.anchorNode)) {
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }

  // 셀렉션 저장/복원 (파일 다이얼로그 등에서 포커스 잃을 때)
  function saveSelection() {
    const sel = window.getSelection()
    if (sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange()
    }
  }
  function restoreSelection() {
    if (savedSelectionRef.current) {
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(savedSelectionRef.current)
    } else {
      ensureFocus()
    }
  }

  function markDirty() {
    setIsDirty(true)
    setSaved(false)
    onDraftChange(meeting.id, editorRef.current?.innerHTML || '')
  }

  function handleSave() {
    const content = editorRef.current?.innerHTML || ''
    onSave({ content })
    setIsDirty(false)
    setSaved(true)
    onDraftChange(meeting.id, undefined)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleTitleSave() {
    setIsEditingTitle(false)
    if (title.trim() && title !== meeting.title) {
      onSave({ title: title.trim() })
    }
  }

  function execCmd(cmd, val = null) {
    ensureFocus()
    document.execCommand(cmd, false, val)
    markDirty()
  }

  // 파일 업로드 처리
  async function handleFileUpload(file) {
    if (!file) return
    const maxSize = file.type.startsWith('image/') ? 5 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > maxSize) {
      alert(`파일은 ${file.type.startsWith('image/') ? '5' : '10'}MB 이하만 업로드할 수 있습니다.`)
      return
    }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const safeName = `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
      const bucket = file.type.startsWith('image/') ? 'task-images' : 'task-images'
      const { error } = await supabase.storage.from(bucket).upload(safeName, file)
      restoreSelection()
      if (!error) {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(safeName)
        if (file.type.startsWith('image/')) {
          document.execCommand('insertHTML', false, `<img src="${urlData.publicUrl}" alt="${file.name}" style="max-width:100%;border-radius:6px;margin:8px 0;" />`)
        } else {
          document.execCommand('insertHTML', false, `<a href="${urlData.publicUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;color:#4f46e5;text-decoration:none;margin:2px 0;">&#128206; ${file.name}</a>&nbsp;`)
        }
      } else {
        // Supabase 실패 시 이미지는 base64 fallback
        if (file.type.startsWith('image/')) {
          const reader = new FileReader()
          reader.onload = (ev) => {
            restoreSelection()
            document.execCommand('insertHTML', false, `<img src="${ev.target.result}" alt="${file.name}" style="max-width:100%;border-radius:6px;margin:8px 0;" />`)
            markDirty()
          }
          reader.readAsDataURL(file)
          setUploading(false)
          return
        } else {
          alert('파일 업로드에 실패했습니다.')
        }
      }
      markDirty()
    } catch {
      alert('파일 업로드에 실패했습니다.')
    }
    setUploading(false)
  }

  // Ctrl+S 저장 단축키
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (isDirty && canEdit) handleSave()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isDirty, canEdit])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeInfo.color}`}>
              <typeInfo.icon size={10} />
              {typeInfo.label}
            </span>
            <span className="text-xs text-gray-400">{meeting.sprintName}</span>
            {isDirty && (
              <span className="text-[10px] text-orange-500 font-medium px-1.5 py-0.5 bg-orange-50 rounded">저장하지 않은 변경사항</span>
            )}
            {saved && (
              <span className="text-[10px] text-green-600 font-medium px-1.5 py-0.5 bg-green-50 rounded flex items-center gap-1">
                <Check size={10} /> 저장됨
              </span>
            )}
          </div>
        </div>

        {isEditingTitle ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') { setTitle(meeting.title); setIsEditingTitle(false) } }}
              className="text-lg font-bold text-gray-900 border-b-2 border-indigo-400 focus:outline-none bg-transparent flex-1"
              autoFocus
            />
            <button onClick={handleTitleSave} className="p-1 rounded hover:bg-green-50 text-green-600"><Check size={16} /></button>
            <button onClick={() => { setTitle(meeting.title); setIsEditingTitle(false) }} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <h2 className="text-lg font-bold text-gray-900">{meeting.title}</h2>
            {canEdit && (
              <button onClick={() => setIsEditingTitle(true)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 text-gray-400 transition-opacity">
                <Pencil size={13} />
              </button>
            )}
          </div>
        )}

        <div className="text-xs text-gray-400 mt-1">
          마지막 수정: {new Date(meeting.updatedAt).toLocaleString('ko-KR')}
          {isDirty && <span className="ml-2 text-orange-400">· Ctrl+S로 저장</span>}
        </div>
      </div>

      {/* Toolbar */}
      {canEdit && (
        <div className="flex items-center gap-0.5 px-6 py-1.5 border-b border-gray-100 bg-gray-50/50 flex-wrap">
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('bold') }}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-600 text-xs font-bold" title="굵게">B</button>
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('italic') }}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-600 text-xs italic" title="기울임">I</button>
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('underline') }}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-600 text-xs underline" title="밑줄">U</button>
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('strikeThrough') }}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-600 text-xs line-through" title="취소선">S</button>
          <div className="w-px h-4 bg-gray-300 mx-1" />
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('formatBlock', '<h1>') }}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-600 text-xs font-bold" title="큰 제목">H1</button>
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('formatBlock', '<h2>') }}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-600 text-xs font-bold" title="제목">H2</button>
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('formatBlock', '<h3>') }}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-600 text-xs font-bold" title="소제목">H3</button>
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('formatBlock', '<p>') }}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-600 text-xs" title="본문">P</button>
          <div className="w-px h-4 bg-gray-300 mx-1" />
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('insertUnorderedList') }}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-600 text-xs" title="글머리 기호">&#8226; 목록</button>
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('insertOrderedList') }}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-600 text-xs" title="번호 매기기">1. 목록</button>
          <div className="w-px h-4 bg-gray-300 mx-1" />
          <div className="relative">
            <button type="button" onMouseDown={e => { e.preventDefault(); setShowTablePicker(s => !s) }}
              className="p-1.5 rounded hover:bg-gray-200 text-gray-600 text-xs" title="표 삽입">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
              </svg>
            </button>
            {showTablePicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowTablePicker(false)} />
                <TablePicker
                  onInsert={(rows, cols) => {
                    ensureFocus()
                    document.execCommand('insertHTML', false, buildTableHTML(rows, cols))
                    markDirty()
                  }}
                  onClose={() => setShowTablePicker(false)}
                />
              </>
            )}
          </div>
          <div className="w-px h-4 bg-gray-300 mx-1" />
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); saveSelection(); fileInputRef.current?.click() }}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-600 text-xs flex items-center gap-1"
            title="파일 첨부"
          >
            <Paperclip size={13} /> 첨부
          </button>
          {uploading && <span className="text-[10px] text-indigo-500 ml-1 animate-pulse">업로드 중...</span>}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv"
            onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); e.target.value = '' }}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50/50">
        <div
          ref={editorRef}
          className={`min-h-[400px] text-sm text-gray-700 leading-relaxed focus:outline-none bg-white border rounded-lg px-5 py-4 shadow-sm ${
            isDirty ? 'border-orange-300' : 'border-gray-200'
          } ${canEdit ? '' : 'pointer-events-none opacity-80'}`}
          contentEditable={canEdit}
          suppressContentEditableWarning
          onCompositionStart={() => { composingRef.current = true }}
          onCompositionEnd={() => { composingRef.current = false; markDirty() }}
          onInput={() => { if (!composingRef.current) markDirty() }}
          data-placeholder="회의 내용을 작성하세요..."
          style={{ whiteSpace: 'pre-wrap' }}
        />
        {canEdit && (
          <div className="flex items-center justify-end gap-2 mt-3">
            {isDirty && <span className="text-xs text-gray-400">Ctrl+S</span>}
            {saved && (
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <Check size={12} /> 저장됨
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                isDirty
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              저장
            </button>
          </div>
        )}
        <style>{`
          [data-placeholder]:empty::before {
            content: attr(data-placeholder);
            color: #c0c0c0;
            pointer-events: none;
          }
        `}</style>
      </div>
    </div>
  )
}
