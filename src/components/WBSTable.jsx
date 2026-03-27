import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, X } from 'lucide-react'
import { getTasks, createTask, updateTask, deleteTask, updateTaskStatus, getProjectParticipants } from '../lib/db'
import { STATUS_OPTIONS, SPRINT_STATUS_OPTIONS, BACKLOG_STATUS, ROLE_COLORS, getStatusInfo, getPriorityInfo, formatDate, getDday } from '../utils/helpers'
import { getActiveSprint, addTaskToSprint, removeTaskFromSprint } from '../lib/sprints'
import TaskModal from './TaskModal'
import SprintBoard from './SprintBoard'
import { notifyStatusChange, notifyTaskCreated, notifyAssigneeChange } from '../lib/slack'

function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
}

export default function WBSTable({ projectId, canEdit = true, currentUser }) {
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState({})
  const [editTask, setEditTask] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [parentForNew, setParentForNew] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [viewingSprint, setViewingSprint] = useState(null)
  const [sprintViewMode, setSprintViewMode] = useState('list')

  // Filter state
  const [filterStatus, setFilterStatus] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')

  const handleSprintChange = useCallback((sprint) => {
    setViewingSprint(sprint)
  }, [])

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

  function openCreate(parentId = null) {
    setParentForNew(parentId)
    setEditTask(null)
    setShowModal(true)
  }

  function openEdit(task) {
    // Normalize DB column names to component field names
    setEditTask({
      ...task,
      parentId: task.parent_id,
      assigneeId: task.assignee_id,
      startDate: task.start_date,
      endDate: task.end_date,
    })
    setShowModal(true)
  }

  async function handleSave(formData) {
    if (saving) return
    setSaving(true)
    setSaveError('')
    if (editTask) {
      const { data, error } = await updateTask(editTask.id, formData)
      if (error) { setSaveError('저장에 실패했습니다. 다시 시도해주세요.'); setSaving(false); return }
      if (data) setTasks(t => t.map(x => x.id === editTask.id ? data : x))
    } else {
      const { data, error } = await createTask(projectId, { ...formData, parentId: parentForNew })
      if (error) {
        const msg = error.code === '23505' ? '같은 이름의 작업이 이미 있습니다.'
          : error.code === '23503' ? '유효하지 않은 참조값이 있습니다.'
          : '작업 생성에 실패했습니다. 다시 시도해주세요.'
        setSaveError(msg); setSaving(false); return
      }
      if (data) {
        setTasks(t => [...t, data])
        // Auto-associate new task with active sprint
        const active = getActiveSprint(projectId)
        if (active) {
          addTaskToSprint(projectId, active.id, data.id)
        }
      }
    }
    setSaving(false)
    setShowModal(false)
  }

  async function handleDelete(id) {
    await deleteTask(id)
    // Remove task and all descendants
    const allIds = getAllDescendants(tasks, id)
    allIds.add(id)
    // Remove from active sprint
    const active = getActiveSprint(projectId)
    if (active) {
      allIds.forEach(tid => removeTaskFromSprint(projectId, active.id, tid))
    }
    setTasks(t => t.filter(x => !allIds.has(x.id)))
  }

  async function handleStatusChange(id, status) {
    const task = tasks.find(t => t.id === id)
    const oldStatus = task ? getStatusInfo(task.status).label : ''
    const newStatus = getStatusInfo(status).label
    await updateTaskStatus(id, status)
    setTasks(t => t.map(x => x.id === id ? { ...x, status } : x))
    notifyStatusChange({ taskName: task?.name || '', oldStatus, newStatus })
  }

  // Determine active sprint taskIds for filtering
  const activeSprintTaskIds = viewingSprint && viewingSprint.status === 'active'
    ? new Set(viewingSprint.taskIds)
    : new Set()

  const isViewingPastSprint = viewingSprint && viewingSprint.status === 'completed'

  // For past sprint view: show only sprint tasks. For normal view: show tasks NOT in active sprint.
  let displayTasks
  if (isViewingPastSprint) {
    displayTasks = tasks.filter(t => viewingSprint.taskIds.includes(t.id))
  } else {
    displayTasks = tasks.filter(t => !activeSprintTaskIds.has(t.id))
  }

  // Apply filters
  if (filterStatus) {
    displayTasks = displayTasks.filter(t => t.status === filterStatus)
  }
  if (filterAssignee) {
    if (filterAssignee === '__unassigned__') {
      displayTasks = displayTasks.filter(t => !t.assignee_id)
    } else {
      displayTasks = displayTasks.filter(t => t.assignee_id === filterAssignee)
    }
  }

  const rootTasks = displayTasks.filter(t => !t.parent_id)
  const childMap = {}
  displayTasks.forEach(t => {
    if (t.parent_id) {
      if (!childMap[t.parent_id]) childMap[t.parent_id] = []
      childMap[t.parent_id].push(t)
    }
  })

  const activeFilterCount = [filterStatus, filterAssignee].filter(Boolean).length

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div>
      <SprintBoard
        projectId={projectId}
        canEdit={canEdit}
        tasks={tasks}
        onSprintChange={handleSprintChange}
        members={members}
        onEditTask={canEdit && !isViewingPastSprint ? openEdit : undefined}
        onStatusChange={canEdit && !isViewingPastSprint ? handleStatusChange : undefined}
        onViewModeChange={setSprintViewMode}
      />

      {sprintViewMode !== 'board' && (<>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">
          작업 목록 ({displayTasks.length}개)
          {isViewingPastSprint && (
            <span className="text-xs text-gray-400 font-normal ml-2">읽기 전용</span>
          )}
        </h3>
        {canEdit && !isViewingPastSprint && (
          <button
            onClick={() => openCreate(null)}
            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            <Plus size={15} />
            작업 추가
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <div className="relative">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className={`pl-3 pr-7 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 appearance-none cursor-pointer bg-white ${
              filterStatus ? 'border-indigo-400 text-indigo-700 bg-indigo-50' : 'border-gray-200 text-gray-600'
            }`}
          >
            <option value="">상태: 전체</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
            className={`pl-3 pr-7 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 appearance-none cursor-pointer bg-white ${
              filterAssignee ? 'border-indigo-400 text-indigo-700 bg-indigo-50' : 'border-gray-200 text-gray-600'
            }`}
          >
            <option value="">담당자: 전체</option>
            <option value="__unassigned__">미배정</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.name}{m.role ? ` (${m.role})` : ''}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {activeFilterCount > 0 && (
          <button
            onClick={() => { setFilterStatus(''); setFilterAssignee('') }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-100 border border-gray-200"
          >
            <X size={11} />
            초기화
            <span className="bg-indigo-100 text-indigo-700 font-semibold rounded-full px-1.5 py-0.5 text-xs leading-none">
              {activeFilterCount}
            </span>
          </button>
        )}
      </div>

      {displayTasks.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <Plus size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">
            {isViewingPastSprint ? '이 스프린트에 작업이 없습니다' :
             activeFilterCount > 0 ? '조건에 맞는 작업이 없습니다' :
             activeSprintTaskIds.size > 0 ? '스프린트에 포함되지 않은 작업이 없습니다' :
             '작업이 없습니다'}
          </p>
          {canEdit && !isViewingPastSprint && activeFilterCount === 0 && (
            <button onClick={() => openCreate(null)} className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              첫 번째 작업 추가하기
            </button>
          )}
          {activeFilterCount > 0 && (
            <button onClick={() => { setFilterStatus(''); setFilterAssignee('') }} className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              필터 초기화
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '1100px' }}>
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 whitespace-nowrap" style={{ width: 40 }}>#</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">작업명</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 whitespace-nowrap" style={{ width: 120 }}>담당자</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 whitespace-nowrap" style={{ width: 100 }}>상태</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 whitespace-nowrap" style={{ width: 80 }}>우선순위</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 whitespace-nowrap" style={{ width: 100 }}>시작일</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 whitespace-nowrap" style={{ width: 100 }}>종료일</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 whitespace-nowrap" style={{ width: 60 }}>D-Day</th>
                <th className="py-2 px-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {rootTasks.map((task, idx) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  index={idx + 1}
                  depth={0}
                  childMap={childMap}
                  collapsed={collapsed}
                  members={members}
                  onToggle={id => setCollapsed(c => ({ ...c, [id]: !c[id] }))}
                  onEdit={canEdit && !isViewingPastSprint ? openEdit : null}
                  onDelete={canEdit && !isViewingPastSprint ? handleDelete : null}
                  onStatusChange={canEdit && !isViewingPastSprint ? handleStatusChange : null}
                  onAddChild={canEdit && !isViewingPastSprint ? openCreate : null}
                  isBacklog={!isViewingPastSprint && !activeSprintTaskIds.has(task.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>)}

      {showModal && (
        <TaskModal
          task={editTask}
          members={members}
          onClose={() => { setShowModal(false); setSaveError('') }}
          onSave={handleSave}
          saving={saving}
          serverError={saveError}
          currentUser={currentUser}
        />
      )}
    </div>
  )
}

function getAllDescendants(tasks, id) {
  const result = new Set()
  const queue = [id]
  while (queue.length > 0) {
    const curr = queue.shift()
    tasks.forEach(t => {
      if (t.parent_id === curr) { result.add(t.id); queue.push(t.id) }
    })
  }
  return result
}

function TaskRow({ task, index, depth, childMap, collapsed, members, onToggle, onEdit, onDelete, onStatusChange, onAddChild, isBacklog }) {
  const children = childMap[task.id] || []
  const hasChildren = children.length > 0
  const isCollapsed = collapsed[task.id]
  const status = getStatusInfo(task.status)
  const priority = getPriorityInfo(task.priority)
  const assignee = members.find(m => m.id === task.assignee_id)
  const dday = getDday(task.end_date)
  const isOverdue = task.end_date && new Date(task.end_date) < new Date() && task.status !== 'done'

  return (
    <>
      <tr
        className="border-b border-gray-100 hover:bg-gray-50 group"
        draggable
        onDragStart={e => {
          e.dataTransfer.setData('text/task-id', task.id)
          e.dataTransfer.effectAllowed = 'move'
        }}
      >
        <td className="py-2 px-3 text-xs text-gray-400">{depth === 0 ? index : ''}</td>
        <td className="py-2 px-3">
          <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 20}px` }}>
            {hasChildren ? (
              <button onClick={() => onToggle(task.id)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
            ) : <span className="w-3.5 flex-shrink-0" />}
            <button onClick={() => onEdit?.(task)} className="text-left text-gray-800 hover:text-indigo-600 font-medium truncate max-w-[300px]">
              {task.name}
            </button>
            {task.description && (
              <span className="text-gray-400 text-xs ml-1 truncate max-w-[200px] inline-block align-middle" title={stripHtml(task.description)}>— {stripHtml(task.description)}</span>
            )}
          </div>
        </td>
        <td className="py-2 px-3 whitespace-nowrap">
          {assignee ? (
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                {assignee.name[0]}
              </div>
              <span className="text-xs text-gray-700 truncate">{assignee.name}</span>
            </div>
          ) : <span className="text-xs text-gray-300">-</span>}
        </td>
        <td className="py-2 px-3 whitespace-nowrap">
          {isBacklog ? (
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${BACKLOG_STATUS.color}`}>
              {BACKLOG_STATUS.label}
            </span>
          ) : (
            <select
              value={task.status || 'todo'}
              onChange={e => onStatusChange?.(task.id, e.target.value)}
              disabled={!onStatusChange}
              className={`text-xs px-2 py-1 rounded-full font-medium border-0 focus:outline-none focus:ring-1 focus:ring-indigo-400 ${status.color} ${onStatusChange ? 'cursor-pointer' : 'cursor-default opacity-80'}`}
            >
              {SPRINT_STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          )}
        </td>
        <td className="py-2 px-3 whitespace-nowrap">
          <span className={`text-xs font-medium ${priority.color}`}>{priority.label}</span>
        </td>
        <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(task.start_date)}</td>
        <td className="py-2 px-3 text-xs whitespace-nowrap">
          <span className={isOverdue ? 'text-red-500 font-medium' : 'text-gray-500'}>{formatDate(task.end_date)}</span>
        </td>
        <td className="py-2 px-3">
          {dday && task.status !== 'done' && (
            <span className={`text-xs font-semibold ${
              dday === 'D-Day' ? 'text-red-600' :
              dday.startsWith('D+') ? 'text-red-400' :
              parseInt(dday.replace('D-','')) <= 3 ? 'text-orange-500' : 'text-gray-500'
            }`}>{dday}</span>
          )}
          {task.status === 'done' && <span className="text-xs text-green-500">✓</span>}
        </td>
        <td className="py-2 px-3">
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onAddChild && <button onClick={() => onAddChild(task.id)} className="p-1 rounded hover:bg-indigo-50 text-gray-400 hover:text-indigo-600" title="하위 작업 추가">
              <Plus size={13} />
            </button>}
            {onEdit && <button onClick={() => onEdit(task)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>}
            {onDelete && <button onClick={() => onDelete(task.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
              <Trash2 size={13} />
            </button>}
          </div>
        </td>
      </tr>
      {!isCollapsed && children.map((child, i) => (
        <TaskRow
          key={child.id}
          task={child}
          index={`${index}.${i + 1}`}
          depth={depth + 1}
          childMap={childMap}
          collapsed={collapsed}
          members={members}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
          onAddChild={onAddChild}
          isBacklog={isBacklog}
        />
      ))}
    </>
  )
}
