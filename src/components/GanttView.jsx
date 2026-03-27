import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Search, X, ChevronDown, ExternalLink, Package, Monitor, Upload, FileText, Bold, Italic, Underline, List, ListOrdered, Image } from 'lucide-react'
import { getTasks, getProjectParticipants, updateTaskLinks } from '../lib/db'
import { getStatusInfo, ROLE_COLORS, formatDate, STATUS_OPTIONS } from '../utils/helpers'
import { getSprints } from '../lib/sprints'
import Modal from './Modal'

const DAY_WIDTH = 28
const ROW_HEIGHT = 44

export default function GanttView({ projectId, onGoToScreen }) {
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  // ── 필터 상태 ──
  const [searchText, setSearchText] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // ── 링크 모달 ──
  const [activeModal, setActiveModal] = useState(null) // { type, task }

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: t }, { data: m }] = await Promise.all([
      getTasks(projectId),
      getProjectParticipants(projectId),
    ])
    setTasks(t || [])
    setMembers(m || [])
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSaveLinks(taskId, updates) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t))
    await updateTaskLinks(taskId, updates)
    setActiveModal(null)
  }

  function openModal(type, task) {
    if (type === 'screen' && task.screen_ref) {
      // 연결된 화면으로 바로 이동
      onGoToScreen && onGoToScreen(task.screen_ref)
    } else {
      setActiveModal({ type, task })
    }
  }

  // ── 날짜 있는 작업 + 필터 적용 ──
  const filteredTasks = useMemo(() => {
    return tasks
      .filter(t => t.start_date && t.end_date)
      .filter(t => !searchText || t.name.toLowerCase().includes(searchText.toLowerCase()))
      .filter(t => {
        if (!filterAssignee) return true
        if (filterAssignee === '__unassigned__') return !t.assignee_id
        return t.assignee_id === filterAssignee
      })
      .filter(t => !filterStatus || t.status === filterStatus)
  }, [tasks, searchText, filterAssignee, filterStatus])

  const activeFilterCount = [searchText, filterAssignee, filterStatus].filter(Boolean).length

  // Load sprints
  const sprints = useMemo(() => getSprints(projectId), [projectId, tasks])

  const { minDate, days } = useMemo(() => {
    // Fixed 30-day range: today - 15 days to today + 15 days
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const min = new Date(now)
    min.setDate(min.getDate() - 15)
    const max = new Date(now)
    max.setDate(max.getDate() + 15)

    const dayList = []
    const cursor = new Date(min)
    while (cursor <= max) {
      dayList.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    return { minDate: min, days: dayList }
  }, [filteredTasks])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const tasksWithDates = tasks.filter(t => t.start_date && t.end_date)
  if (tasksWithDates.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-sm">시작일과 종료일이 설정된 작업이 없습니다</p>
        <p className="text-xs mt-1">WBS 탭에서 작업에 날짜를 설정해주세요</p>
      </div>
    )
  }

  function getBarStyle(task) {
    const start = new Date(task.start_date)
    const end = new Date(task.end_date)
    const left = Math.round((start - minDate) / (1000 * 60 * 60 * 24)) * DAY_WIDTH
    const width = Math.max((Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1) * DAY_WIDTH, DAY_WIDTH)
    return { left, width }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayLeft = minDate
    ? Math.round((today - minDate) / (1000 * 60 * 60 * 24)) * DAY_WIDTH
    : null

  // 월 그룹
  const months = []
  let curMonth = null
  let curCount = 0
  days.forEach(d => {
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (key !== curMonth) {
      if (curMonth !== null) months.push({ key: curMonth, count: curCount })
      curMonth = key
      curCount = 1
    } else { curCount++ }
  })
  if (curMonth) months.push({ key: curMonth, count: curCount })

  const STATUS_BAR_COLORS = {
    backlog: 'bg-gray-300',
    todo: 'bg-gray-400',
    in_progress: 'bg-blue-400',
    test_request: 'bg-orange-400',
    review: 'bg-yellow-400',
    done_no_test: 'bg-emerald-400',
    done: 'bg-green-400',
  }

  function clearFilters() {
    setSearchText('')
    setFilterAssignee('')
    setFilterStatus('')
  }

  return (
    <div className="space-y-3">
      {/* ── 필터 바 ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="작업명 검색..."
            className="w-full pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />
          {searchText && (
            <button onClick={() => setSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="relative">
          <select
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
            className={`pl-3 pr-7 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 appearance-none cursor-pointer bg-white ${
              filterAssignee ? 'border-indigo-400 text-indigo-700 bg-indigo-50' : 'border-gray-200 text-gray-600'
            }`}
          >
            <option value="">담당자 전체</option>
            <option value="__unassigned__">미배정</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.name}{m.role ? ` (${m.role})` : ''}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className={`pl-3 pr-7 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 appearance-none cursor-pointer bg-white ${
              filterStatus ? 'border-indigo-400 text-indigo-700 bg-indigo-50' : 'border-gray-200 text-gray-600'
            }`}
          >
            <option value="">상태 전체</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-100 border border-gray-200"
          >
            <X size={11} />
            초기화
            <span className="bg-indigo-100 text-indigo-700 font-semibold rounded-full px-1.5 py-0.5 text-xs leading-none">
              {activeFilterCount}
            </span>
          </button>
        )}

        <span className="text-xs text-gray-400 ml-auto">
          {filteredTasks.length}/{tasksWithDates.length}개 표시
        </span>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-sm">조건에 맞는 작업이 없습니다</p>
          <button onClick={clearFilters} className="mt-2 text-xs text-indigo-600 hover:text-indigo-800">
            필터 초기화
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-xl" style={{ overflow: 'visible' }}>
          <div className="flex" style={{ minWidth: `${440 + days.length * DAY_WIDTH}px` }}>
            {/* Left: 작업명 + 액션 버튼 */}
            <div className="flex-shrink-0 w-[440px] border-r border-gray-200">
              {/* 헤더 */}
              <div className="h-12 border-b border-gray-200 flex items-end px-3 pb-1 bg-gray-50">
                <span className="text-xs font-semibold text-gray-500 flex-1">작업명</span>
                <div className="flex items-center flex-shrink-0" style={{ width: 220 }}>
                  <span className="text-xs font-semibold text-gray-500 text-center" style={{ width: 46 }}>Jira</span>
                  <span className="text-xs font-semibold text-gray-500 text-center" style={{ width: 52 }}>산출물</span>
                  <span className="text-xs font-semibold text-gray-500 text-center" style={{ width: 42 }}>기획</span>
                  <span className="text-xs font-semibold text-gray-500 text-center" style={{ width: 80 }}>상태</span>
                </div>
              </div>

              {/* 스프린트 라벨 행 (왼쪽 정렬용) */}
              {sprints.length > 0 && minDate && (
                <div className="border-b border-gray-100 bg-gray-50/50 flex items-center px-3" style={{ height: 24 }}>
                  <span className="text-[10px] text-gray-400 font-medium">스프린트</span>
                </div>
              )}

              {filteredTasks.map(task => {
                const assignee = members.find(m => m.id === task.assignee_id)
                const status = getStatusInfo(task.status)
                const hasDeliverable = !!(task.deliverable_url || task.deliverable_image || task.deliverable_text)

                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-1.5 px-3 border-b border-gray-100"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* 작업명 + 담당자 */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-800 truncate">{task.name}</div>
                      {assignee ? (
                        <div className="text-xs text-gray-400">
                          <span>{assignee.name}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-300">미배정</div>
                      )}
                    </div>

                    {/* 액션 버튼 3개 + 상태 - 고정 너비 */}
                    <div className="flex items-center flex-shrink-0" style={{ width: 220 }}>
                      <button
                        onClick={() => openModal('jira', task)}
                        className={`flex items-center justify-center gap-0.5 py-1 rounded text-[10px] font-medium transition-colors ${
                          task.jira_url
                            ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                        style={{ width: 46 }}
                      >
                        <ExternalLink size={11} />
                        <span>Jira</span>
                      </button>

                      <button
                        onClick={() => openModal('deliverable', task)}
                        className={`flex items-center justify-center gap-0.5 py-1 rounded text-[10px] font-medium transition-colors ${
                          hasDeliverable
                            ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                        style={{ width: 52 }}
                      >
                        <Package size={11} />
                        <span>산출물</span>
                      </button>

                      <button
                        onClick={() => openModal('screen', task)}
                        className={`flex items-center justify-center gap-0.5 py-1 rounded text-[10px] font-medium transition-colors ${
                          task.screen_ref
                            ? 'text-violet-600 bg-violet-50 hover:bg-violet-100'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                        style={{ width: 42 }}
                      >
                        <Monitor size={11} />
                        <span>기획</span>
                      </button>

                      {/* 상태 배지 */}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium text-center whitespace-nowrap truncate ${status.color}`} style={{ width: 80 }}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Right: 바 영역 */}
            <div className="flex-1" style={{ overflow: 'visible' }}>
              {/* 월 헤더 */}
              <div className="flex border-b border-gray-200 bg-gray-50" style={{ height: 24 }}>
                {months.map(m => {
                  const [year, month] = m.key.split('-')
                  return (
                    <div
                      key={m.key}
                      className="flex-shrink-0 border-r border-gray-200 flex items-center px-2"
                      style={{ width: m.count * DAY_WIDTH }}
                    >
                      <span className="text-xs font-semibold text-gray-600">
                        {year}년 {parseInt(month) + 1}월
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* 일 헤더 */}
              <div className="flex border-b border-gray-200 bg-gray-50" style={{ height: 24 }}>
                {days.map(d => {
                  const isToday = d.toDateString() === today.toDateString()
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6
                  return (
                    <div
                      key={d.toISOString()}
                      className={`flex-shrink-0 flex items-center justify-center border-r border-gray-100 text-xs ${
                        isToday ? 'bg-indigo-100 text-indigo-700 font-bold' :
                        isWeekend ? 'text-red-400 bg-red-50/50' :
                        'text-gray-400'
                      }`}
                      style={{ width: DAY_WIDTH }}
                    >
                      {d.getDate()}
                    </div>
                  )
                })}
              </div>

              {/* 스프린트 라벨 전용 행 */}
              {sprints.length > 0 && minDate && (
                <div className="relative border-b border-gray-100" style={{ height: 24 }}>
                  {sprints.map(sprint => {
                    const sStart = new Date(sprint.startDate)
                    const sEnd = new Date(sprint.endDate)
                    sStart.setHours(0,0,0,0)
                    sEnd.setHours(0,0,0,0)
                    const sLeft = Math.round((sStart - minDate) / 86400000) * DAY_WIDTH
                    const sWidth = Math.max((Math.round((sEnd - sStart) / 86400000) + 1) * DAY_WIDTH, DAY_WIDTH)
                    const isActive = sprint.status === 'active'
                    return (
                      <div key={sprint.id + '-label'} className={`absolute top-0 bottom-0 flex items-center justify-center overflow-hidden ${
                        isActive ? 'bg-indigo-100/80' : 'bg-gray-100/60'
                      }`} style={{ left: sLeft, width: sWidth, zIndex: 5 }}>
                        <div className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${
                          isActive ? 'text-indigo-700' : 'text-gray-500'
                        }`}>
                          {sprint.name} ({formatDate(sprint.startDate)} ~ {formatDate(sprint.endDate)})
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* 행 */}
              <div className="relative">
                {/* 스프린트 범위 배경 - 전체 높이로 표시 */}
                {sprints.length > 0 && minDate && sprints.map(sprint => {
                  const sStart = new Date(sprint.startDate)
                  const sEnd = new Date(sprint.endDate)
                  sStart.setHours(0,0,0,0)
                  sEnd.setHours(0,0,0,0)
                  const sLeft = Math.round((sStart - minDate) / 86400000) * DAY_WIDTH
                  const sWidth = Math.max((Math.round((sEnd - sStart) / 86400000) + 1) * DAY_WIDTH, DAY_WIDTH)
                  const isActive = sprint.status === 'active'
                  return (
                    <div key={sprint.id + '-bg'} className="absolute top-0 bottom-0" style={{ left: sLeft, width: sWidth, zIndex: 1 }}>
                      {/* 배경 */}
                      <div className={`absolute inset-0 ${isActive ? 'bg-indigo-50/60' : 'bg-gray-100/40'}`} />
                      {/* 좌우 경계선 */}
                      <div className={`absolute top-0 bottom-0 left-0 w-px ${isActive ? 'bg-indigo-300' : 'bg-gray-300'}`} style={{ opacity: 0.7 }} />
                      <div className={`absolute top-0 bottom-0 right-0 w-px ${isActive ? 'bg-indigo-300' : 'bg-gray-300'}`} style={{ opacity: 0.7 }} />
                    </div>
                  )
                })}

                {todayLeft !== null && todayLeft >= 0 && todayLeft <= days.length * DAY_WIDTH && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-indigo-500 z-10 opacity-50"
                    style={{ left: todayLeft + DAY_WIDTH / 2 }}
                  />
                )}
                {days.map((d, i) => {
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6
                  return isWeekend ? (
                    <div
                      key={d.toISOString()}
                      className="absolute top-0 bottom-0 bg-gray-50/70"
                      style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
                    />
                  ) : null
                })}

                {filteredTasks.map((task, taskIdx) => {
                  const { left, width } = getBarStyle(task)
                  const assignee = members.find(m => m.id === task.assignee_id)
                  const barColor = STATUS_BAR_COLORS[task.status] || 'bg-gray-300'
                  const hasDeliverable = !!(task.deliverable_url || task.deliverable_image || task.deliverable_text)
                  return (
                    <div
                      key={task.id}
                      className="relative border-b border-gray-100 flex items-center"
                      style={{ height: ROW_HEIGHT, zIndex: 2 }}
                    >
                      <div
                        className={`absolute rounded-md ${barColor} flex items-center px-1.5 group/bar cursor-pointer`}
                        style={{ left, width: Math.max(width, 24), height: 26, overflow: 'visible', zIndex: 3 }}
                      >
                        {width >= 80 && <span className="text-xs text-white font-medium truncate flex-1">{task.name}</span>}
                        {width < 80 && <span className="text-[10px] text-white font-medium truncate flex-1">{formatDate(task.end_date)}</span>}
                        {/* 바 위 아이콘 - 항상 표시 */}
                        <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
                          {task.jira_url && <ExternalLink size={11} className="text-white/80" />}
                          {hasDeliverable && <Package size={11} className="text-white/80" />}
                          {task.screen_ref && <Monitor size={11} className="text-white/80" />}
                        </div>
                        {/* 커스텀 툴팁 - 항상 위로 표시 */}
                        <div
                          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 pointer-events-none opacity-0 group-hover/bar:opacity-100 transition-opacity duration-150"
                          style={{ zIndex: 999 }}
                        >
                          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                            <div className="font-semibold mb-0.5">{task.name}</div>
                            <div className="text-gray-300">{formatDate(task.start_date)} ~ {formatDate(task.end_date)}</div>
                            {assignee && <div className="text-gray-400 mt-0.5">담당: {assignee.name}</div>}
                          </div>
                          <div className="absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-transparent top-full border-t-4 border-t-gray-900" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 모달 ── */}
      {activeModal?.type === 'jira' && (
        <JiraModal
          task={activeModal.task}
          onClose={() => setActiveModal(null)}
          onSave={updates => handleSaveLinks(activeModal.task.id, updates)}
        />
      )}
      {activeModal?.type === 'deliverable' && (
        <DeliverableModal
          task={activeModal.task}
          onClose={() => setActiveModal(null)}
          onSave={updates => handleSaveLinks(activeModal.task.id, updates)}
        />
      )}
      {activeModal?.type === 'screen' && (
        <ScreenPickerModal
          task={activeModal.task}
          onClose={() => setActiveModal(null)}
          onSave={updates => handleSaveLinks(activeModal.task.id, updates)}
        />
      )}
    </div>
  )
}

// ──────────────────────────────────────────
// Jira 링크 모달
// ──────────────────────────────────────────
function JiraModal({ task, onClose, onSave }) {
  const [url, setUrl] = useState(task.jira_url || '')
  const [err, setErr] = useState('')

  function handleSave() {
    const trimmed = url.trim()
    if (!trimmed) { setErr('URL을 입력해주세요.'); return }
    try { new URL(trimmed) } catch { setErr('올바른 URL 형식이 아닙니다.'); return }
    onSave({ jira_url: trimmed })
  }

  return (
    <Modal title="Jira 티켓 링크" onClose={onClose} onConfirm={handleSave} confirmLabel="저장" size="sm">
      <div className="space-y-3">
        {task.jira_url && (
          <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg">
            <ExternalLink size={13} className="text-blue-400 flex-shrink-0" />
            <span className="text-xs text-blue-700 truncate flex-1">{task.jira_url}</span>
            <a
              href={task.jira_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:text-blue-700 font-medium flex-shrink-0"
            >
              열기
            </a>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            티켓 URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={url}
            onChange={e => { setUrl(e.target.value); setErr('') }}
            placeholder="https://your-company.atlassian.net/browse/PROJ-123"
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              err ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'
            }`}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          {err && <p className="mt-1 text-xs text-red-500">⚠ {err}</p>}
        </div>
        {task.jira_url && (
          <button
            onClick={() => onSave({ jira_url: '' })}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            링크 제거
          </button>
        )}
      </div>
    </Modal>
  )
}

// ──────────────────────────────────────────
// 산출물 모달 (URL / 이미지 / 텍스트)
// ──────────────────────────────────────────
function DeliverableModal({ task, onClose, onSave }) {
  const hasImage = !!task.deliverable_image
  const hasText = !!task.deliverable_text
  const [tab, setTab] = useState(hasText ? 'text' : hasImage ? 'image' : 'url')
  const [url, setUrl] = useState(task.deliverable_url || '')
  const [image, setImage] = useState(task.deliverable_image || '')
  const [text, setText] = useState(task.deliverable_text || '')
  const [err, setErr] = useState('')
  const fileRef = useRef(null)
  const textEditorRef = useRef(null)
  const textFileRef = useRef(null)

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setErr('5MB 이하 이미지만 업로드 가능합니다.'); return }
    const reader = new FileReader()
    reader.onload = ev => { setImage(ev.target.result || ''); setErr('') }
    reader.readAsDataURL(file)
  }

  function handleTextImage(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setErr('5MB 이하 이미지만 업로드 가능합니다.'); return }
    const reader = new FileReader()
    reader.onload = ev => {
      document.execCommand('insertImage', false, ev.target.result)
      textEditorRef.current?.focus()
      setText(textEditorRef.current?.innerHTML || '')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleTextPaste(e) {
    const items = e.clipboardData?.items
    if (items) {
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          const reader = new FileReader()
          reader.onload = ev => {
            document.execCommand('insertImage', false, ev.target.result)
            setText(textEditorRef.current?.innerHTML || '')
          }
          reader.readAsDataURL(file)
          return
        }
      }
    }
  }

  function execTextCmd(cmd, val = null) {
    document.execCommand(cmd, false, val)
    textEditorRef.current?.focus()
    setText(textEditorRef.current?.innerHTML || '')
  }

  function handleSave() {
    if (tab === 'url') {
      const trimmed = url.trim()
      if (!trimmed) { setErr('URL을 입력해주세요.'); return }
      try { new URL(trimmed) } catch { setErr('올바른 URL 형식이 아닙니다.'); return }
      onSave({ deliverable_url: trimmed, deliverable_image: '', deliverable_text: '' })
    } else if (tab === 'image') {
      if (!image) { setErr('이미지를 선택해주세요.'); return }
      onSave({ deliverable_url: '', deliverable_image: image, deliverable_text: '' })
    } else {
      const trimmed = text.replace(/<br\s*\/?>$/i, '').trim()
      if (!trimmed) { setErr('내용을 입력해주세요.'); return }
      onSave({ deliverable_url: '', deliverable_image: '', deliverable_text: trimmed })
    }
  }

  const tabs = [
    { key: 'url', label: 'URL 링크', icon: ExternalLink },
    { key: 'image', label: '이미지', icon: Image },
    { key: 'text', label: '텍스트', icon: FileText },
  ]

  return (
    <Modal title="산출물" onClose={onClose} onConfirm={handleSave} confirmLabel="저장" size="md">
      <div className="space-y-4">
        {/* 탭 */}
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setErr('') }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'url' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              산출물 URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={e => { setUrl(e.target.value); setErr('') }}
              placeholder="https://..."
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                err ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'
              }`}
              autoFocus
            />
            {url && (
              <a
                href={url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-indigo-600 hover:text-indigo-800"
              >
                <ExternalLink size={11} /> 링크 열기
              </a>
            )}
          </div>
        )}

        {tab === 'image' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이미지 <span className="text-red-500">*</span>
            </label>
            {image ? (
              <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                <img src={image} alt="산출물" className="w-full max-h-52 object-contain" />
                <button
                  onClick={() => setImage('')}
                  className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md text-red-400 hover:text-red-600 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-lg py-10 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors flex flex-col items-center gap-2"
              >
                <Upload size={24} />
                <span className="text-sm">클릭하여 이미지 선택</span>
                <span className="text-xs">최대 5MB · PNG, JPG, GIF</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>
        )}

        {tab === 'text' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              산출물 내용 <span className="text-red-500">*</span>
            </label>
            {/* 간이 리치 에디터 툴바 */}
            <div className="flex items-center gap-0.5 p-1.5 border border-b-0 border-gray-300 rounded-t-lg bg-gray-50">
              <button type="button" onMouseDown={e => { e.preventDefault(); execTextCmd('bold') }}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-600" title="굵게">
                <Bold size={14} />
              </button>
              <button type="button" onMouseDown={e => { e.preventDefault(); execTextCmd('italic') }}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-600" title="기울임">
                <Italic size={14} />
              </button>
              <button type="button" onMouseDown={e => { e.preventDefault(); execTextCmd('underline') }}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-600" title="밑줄">
                <Underline size={14} />
              </button>
              <div className="w-px h-4 bg-gray-300 mx-1" />
              <button type="button" onMouseDown={e => { e.preventDefault(); execTextCmd('insertUnorderedList') }}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-600" title="글머리 기호">
                <List size={14} />
              </button>
              <button type="button" onMouseDown={e => { e.preventDefault(); execTextCmd('insertOrderedList') }}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-600" title="번호 매기기">
                <ListOrdered size={14} />
              </button>
              <div className="w-px h-4 bg-gray-300 mx-1" />
              <button type="button" onMouseDown={e => { e.preventDefault(); textFileRef.current?.click() }}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-600" title="이미지 삽입">
                <Image size={14} />
              </button>
            </div>
            <div
              ref={textEditorRef}
              className="w-full border border-gray-300 rounded-b-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[180px] max-h-[360px] overflow-y-auto"
              contentEditable
              suppressContentEditableWarning
              onInput={() => setText(textEditorRef.current?.innerHTML || '')}
              onPaste={handleTextPaste}
              dangerouslySetInnerHTML={{ __html: text }}
              data-placeholder="산출물에 대한 설명을 입력하세요. 이미지를 붙여넣을 수 있습니다."
              style={{ whiteSpace: 'pre-wrap' }}
            />
            <input ref={textFileRef} type="file" accept="image/*" className="hidden" onChange={handleTextImage} />
            <p className="mt-1 text-xs text-gray-400">이미지를 복사/붙여넣기하거나 툴바의 이미지 버튼으로 삽입할 수 있습니다.</p>
          </div>
        )}

        {err && <p className="text-xs text-red-500">⚠ {err}</p>}

        {(task.deliverable_url || task.deliverable_image || task.deliverable_text) && (
          <button
            onClick={() => onSave({ deliverable_url: '', deliverable_image: '', deliverable_text: '' })}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            산출물 제거
          </button>
        )}
      </div>
    </Modal>
  )
}

// ──────────────────────────────────────────
// 스토리보드 화면 연결 모달
// ──────────────────────────────────────────
function ScreenPickerModal({ task, onClose, onSave }) {
  const [screens, setScreens] = useState([])
  const [selected, setSelected] = useState(task.screen_ref || '')

  useEffect(() => {
    try {
      const raw = localStorage.getItem('sb_current')
      if (raw) setScreens(JSON.parse(raw))
    } catch {}
  }, [])

  function handleSave() {
    if (!selected) return
    const screen = screens.find(s => s.id === selected)
    onSave({ screen_ref: selected, screen_name: screen?.frame?.name || '' })
  }

  return (
    <Modal
      title="스토리보드 화면 연결"
      onClose={onClose}
      onConfirm={handleSave}
      confirmLabel="연결"
      confirmDisabled={!selected}
      size="sm"
    >
      {screens.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Monitor size={36} className="mx-auto mb-3 opacity-25" />
          <p className="text-sm">스토리보드에 화면이 없습니다</p>
          <p className="text-xs mt-1">스토리보드 탭에서 먼저 화면을 추가해주세요.</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {screens.map((screen, idx) => (
            <button
              key={screen.id}
              onClick={() => setSelected(screen.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors border ${
                selected === screen.id
                  ? 'bg-violet-50 border-violet-300 shadow-sm'
                  : 'border-gray-100 hover:bg-gray-50 hover:border-gray-200'
              }`}
            >
              {screen.frame?.imageUrl ? (
                <img
                  src={screen.frame.imageUrl} alt=""
                  className="w-12 h-8 object-cover rounded flex-shrink-0 bg-gray-100 border border-gray-100"
                />
              ) : (
                <div className="w-12 h-8 bg-gray-100 rounded flex-shrink-0 flex items-center justify-center">
                  <Monitor size={14} className="text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">
                  {screen.frame?.name || `화면 ${idx + 1}`}
                </div>
                {screen.badges?.length > 0 && (
                  <div className="text-xs text-gray-400">{screen.badges.length}개 배지</div>
                )}
              </div>
              {selected === screen.id && (
                <div className="w-4 h-4 rounded-full bg-violet-500 flex-shrink-0 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {task.screen_ref && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            현재 연결: <span className="font-medium text-violet-600">{task.screen_name || task.screen_ref}</span>
          </span>
          <button
            onClick={() => onSave({ screen_ref: '', screen_name: '' })}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            연결 해제
          </button>
        </div>
      )}
    </Modal>
  )
}
