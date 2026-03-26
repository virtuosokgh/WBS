import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, Play, CheckCircle2, Plus, Calendar, Target, Clock, X } from 'lucide-react'
import { getSprints, getActiveSprint, getNextSprintNumber, createSprint, completeSprint, addTaskToSprint, removeTaskFromSprint } from '../lib/sprints'
import { formatDate, getStatusInfo, getPriorityInfo, getDday, STATUS_OPTIONS } from '../utils/helpers'
import Modal from './Modal'

const STATUS_BADGE = {
  active: { label: '진행중', className: 'bg-blue-100 text-blue-700' },
  completed: { label: '완료', className: 'bg-green-100 text-green-700' },
  planned: { label: '예정', className: 'bg-gray-100 text-gray-500' },
}

function SprintStatusBadge({ status }) {
  const info = STATUS_BADGE[status] || STATUS_BADGE.planned
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.className}`}>
      {info.label}
    </span>
  )
}

export default function SprintBoard({ projectId, canEdit, tasks, onSprintChange, onRefreshSprints, members, onEditTask, onStatusChange }) {
  const [sprints, setSprints] = useState([])
  const [activeSprint, setActiveSprint] = useState(null)
  const [viewingSprint, setViewingSprint] = useState(null)
  const [expanded, setExpanded] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [showSelector, setShowSelector] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const refresh = useCallback(() => {
    const all = getSprints(projectId)
    setSprints(all)
    const active = all.find(s => s.status === 'active') || null
    setActiveSprint(active)
    setViewingSprint(prev => {
      if (prev) {
        const found = all.find(s => s.id === prev.id)
        if (found) return found
      }
      return active
    })
  }, [projectId])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    onSprintChange?.(viewingSprint)
  }, [viewingSprint, onSprintChange])

  // Expose refresh to parent
  useEffect(() => {
    onRefreshSprints?.(() => refresh)
  }, [onRefreshSprints, refresh])

  function handleCreate(formData) {
    const sprint = createSprint(projectId, formData)
    if (tasks) {
      tasks.forEach(t => {
        if (t.status !== 'done') {
          addTaskToSprint(projectId, sprint.id, t.id)
        }
      })
    }
    setShowCreateModal(false)
    refresh()
  }

  function handleComplete() {
    if (!activeSprint) return
    const incompleteTasks = tasks
      ? tasks.filter(t => activeSprint.taskIds.includes(t.id) && t.status !== 'done')
      : []
    const carryOverIds = incompleteTasks.map(t => t.id)
    completeSprint(projectId, activeSprint.id, carryOverIds)
    setShowCompleteConfirm(false)
    refresh()
  }

  function selectSprint(sprint) {
    setViewingSprint(sprint)
    setShowSelector(false)
  }

  function handleRemoveTask(taskId) {
    if (!activeSprint) return
    removeTaskFromSprint(projectId, activeSprint.id, taskId)
    refresh()
  }

  // Drag & Drop handlers
  function handleDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const taskId = e.dataTransfer.getData('text/task-id')
    if (taskId && activeSprint) {
      addTaskToSprint(projectId, activeSprint.id, taskId)
      refresh()
    }
  }

  const isViewingPast = viewingSprint && viewingSprint.status === 'completed'
  const currentSprint = viewingSprint || activeSprint

  // Sprint tasks
  const sprintTasks = currentSprint
    ? tasks.filter(t => currentSprint.taskIds.includes(t.id))
    : []
  const sprintDoneCount = sprintTasks.filter(t => t.status === 'done').length

  return (
    <div className="mb-4">
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 mb-2"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Target size={14} className="text-indigo-500" />
        스프린트
        {activeSprint && <SprintStatusBadge status={activeSprint.status} />}
        {!activeSprint && sprints.length === 0 && (
          <span className="text-xs text-gray-400 font-normal ml-1">설정되지 않음</span>
        )}
      </button>

      {expanded && (
        <div
          className={`border rounded-lg bg-white transition-colors ${
            dragOver ? 'border-indigo-400 bg-indigo-50/30' : 'border-gray-200'
          }`}
          onDragOver={currentSprint && !isViewingPast ? handleDragOver : undefined}
          onDragLeave={handleDragLeave}
          onDrop={currentSprint && !isViewingPast ? handleDrop : undefined}
        >
          {!currentSprint ? (
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm text-gray-500">활성 스프린트가 없습니다.</p>
              {canEdit && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <Play size={13} />
                  스프린트 시작
                </button>
              )}
            </div>
          ) : (
            <div className="px-4 py-3">
              {/* Sprint header */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0 flex-wrap">
                  {/* Sprint selector */}
                  <div className="relative">
                    <button
                      onClick={() => setShowSelector(s => !s)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
                    >
                      {currentSprint.name}
                      <ChevronDown size={13} className="text-gray-400" />
                    </button>

                    {showSelector && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setShowSelector(false)} />
                        <div className="absolute top-full left-0 mt-1 z-40 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[240px] max-h-[300px] overflow-y-auto">
                          <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            스프린트 기록
                          </div>
                          {sprints.length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-400">기록 없음</div>
                          )}
                          {[...sprints].reverse().map(s => (
                            <button
                              key={s.id}
                              onClick={() => selectSprint(s)}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between gap-2 ${
                                viewingSprint?.id === s.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="truncate font-medium">{s.name}</div>
                                <div className="text-xs text-gray-400">{formatDate(s.startDate)} ~ {formatDate(s.endDate)}</div>
                              </div>
                              <SprintStatusBadge status={s.status} />
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <SprintStatusBadge status={currentSprint.status} />

                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar size={12} />
                    {formatDate(currentSprint.startDate)} ~ {formatDate(currentSprint.endDate)}
                  </div>

                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {sprintDoneCount}/{sprintTasks.length} 완료
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isViewingPast && activeSprint && (
                    <button
                      onClick={() => setViewingSprint(activeSprint)}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50"
                    >
                      <Clock size={12} />
                      현재 스프린트
                    </button>
                  )}
                  {isViewingPast && !activeSprint && canEdit && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50"
                    >
                      <Plus size={12} />
                      새 스프린트
                    </button>
                  )}
                  {!isViewingPast && canEdit && activeSprint && (
                    <button
                      onClick={() => setShowCompleteConfirm(true)}
                      className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium px-2 py-1 rounded hover:bg-green-50"
                    >
                      <CheckCircle2 size={12} />
                      스프린트 완료
                    </button>
                  )}
                  {!activeSprint && !isViewingPast && canEdit && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50"
                    >
                      <Play size={12} />
                      스프린트 시작
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              {sprintTasks.length > 0 && (
                <div className="mt-2">
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.round((sprintDoneCount / sprintTasks.length) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Sprint description */}
              {currentSprint.description && (
                <p className="text-xs text-gray-400 mt-2 truncate" title={currentSprint.description}>
                  {currentSprint.description}
                </p>
              )}

              {/* Sprint task table (full columns) */}
              {sprintTasks.length > 0 && (
                <div className="mt-3 border-t border-gray-100 pt-2">
                  <div className="text-xs font-medium text-gray-500 mb-1.5">스프린트 작업 ({sprintTasks.length})</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs" style={{ minWidth: '700px' }}>
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-400">작업명</th>
                          <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-400 whitespace-nowrap" style={{ width: 90 }}>담당자</th>
                          <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-400 whitespace-nowrap" style={{ width: 80 }}>상태</th>
                          <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-400 whitespace-nowrap" style={{ width: 60 }}>우선순위</th>
                          <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-400 whitespace-nowrap" style={{ width: 80 }}>시작일</th>
                          <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-400 whitespace-nowrap" style={{ width: 80 }}>종료일</th>
                          <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-400 whitespace-nowrap" style={{ width: 50 }}>D-Day</th>
                          {canEdit && !isViewingPast && <th className="py-1.5 px-2" style={{ width: 30 }}></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {sprintTasks.map(t => {
                          const st = getStatusInfo(t.status)
                          const pr = getPriorityInfo(t.priority)
                          const assignee = members ? members.find(m => m.id === t.assignee_id) : null
                          const dday = getDday(t.end_date)
                          const isOverdue = t.end_date && new Date(t.end_date) < new Date() && t.status !== 'done'
                          return (
                            <tr
                              key={t.id}
                              className="border-b border-gray-50 hover:bg-gray-50 group/task cursor-pointer"
                              onClick={() => onEditTask?.(t)}
                            >
                              <td className="py-1.5 px-2">
                                <span className={`font-medium truncate block max-w-[250px] ${t.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700 hover:text-indigo-600'}`}>
                                  {t.name}
                                </span>
                              </td>
                              <td className="py-1.5 px-2 whitespace-nowrap">
                                {assignee ? (
                                  <div className="flex items-center gap-1">
                                    <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                      {assignee.name[0]}
                                    </div>
                                    <span className="text-gray-700 truncate">{assignee.name}</span>
                                  </div>
                                ) : <span className="text-gray-300">-</span>}
                              </td>
                              <td className="py-1.5 px-2 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                <select
                                  value={t.status || 'todo'}
                                  onChange={e => onStatusChange?.(t.id, e.target.value)}
                                  disabled={!onStatusChange || isViewingPast}
                                  className={`text-xs px-1.5 py-0.5 rounded-full font-medium border-0 focus:outline-none focus:ring-1 focus:ring-indigo-400 ${st.color} ${onStatusChange && !isViewingPast ? 'cursor-pointer' : 'cursor-default opacity-80'}`}
                                >
                                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                              </td>
                              <td className="py-1.5 px-2 whitespace-nowrap">
                                <span className={`font-medium ${pr.color}`}>{pr.label}</span>
                              </td>
                              <td className="py-1.5 px-2 text-gray-500 whitespace-nowrap">{formatDate(t.start_date)}</td>
                              <td className="py-1.5 px-2 whitespace-nowrap">
                                <span className={isOverdue ? 'text-red-500 font-medium' : 'text-gray-500'}>{formatDate(t.end_date)}</span>
                              </td>
                              <td className="py-1.5 px-2">
                                {dday && t.status !== 'done' && (
                                  <span className={`font-semibold ${
                                    dday === 'D-Day' ? 'text-red-600' :
                                    dday.startsWith('D+') ? 'text-red-400' :
                                    parseInt(dday.replace('D-','')) <= 3 ? 'text-orange-500' : 'text-gray-500'
                                  }`}>{dday}</span>
                                )}
                                {t.status === 'done' && <span className="text-green-500">✓</span>}
                              </td>
                              {canEdit && !isViewingPast && (
                                <td className="py-1.5 px-2" onClick={e => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleRemoveTask(t.id)}
                                    className="opacity-0 group-hover/task:opacity-100 p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all"
                                    title="스프린트에서 제거"
                                  >
                                    <X size={12} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Drop hint when empty */}
              {sprintTasks.length === 0 && !isViewingPast && (
                <div className="mt-3 border-2 border-dashed border-gray-200 rounded-lg py-4 text-center text-xs text-gray-400">
                  아래 작업 목록에서 작업을 드래그하여 스프린트에 추가하세요
                </div>
              )}

              {/* Drag over indicator */}
              {dragOver && (
                <div className="mt-2 border-2 border-dashed border-indigo-400 rounded-lg py-3 text-center text-xs text-indigo-500 font-medium bg-indigo-50/50">
                  여기에 놓아 스프린트에 추가
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <SprintCreateModal
          projectId={projectId}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}

      {showCompleteConfirm && activeSprint && (
        <SprintCompleteModal
          sprint={activeSprint}
          tasks={tasks}
          onClose={() => setShowCompleteConfirm(false)}
          onConfirm={handleComplete}
        />
      )}
    </div>
  )
}

/* -- Sprint Creation Modal -- */
function SprintCreateModal({ projectId, onClose, onCreate }) {
  const nextNumber = getNextSprintNumber(projectId)
  const [form, setForm] = useState({
    name: `스프린트 ${nextNumber}`,
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: (() => {
      const d = new Date()
      d.setDate(d.getDate() + 14)
      return d.toISOString().split('T')[0]
    })(),
  })
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!form.startDate) e.startDate = '시작일을 입력해주세요.'
    if (!form.endDate) e.endDate = '종료일을 입력해주세요.'
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      e.endDate = '종료일은 시작일 이후여야 합니다.'
    }
    return e
  }

  function handleConfirm() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    onCreate(form)
  }

  return (
    <Modal title="새 스프린트" onClose={onClose} onConfirm={handleConfirm} confirmLabel="스프린트 시작">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">스프린트 이름</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시작일 <span className="text-red-500">*</span></label>
            <input
              type="date" value={form.startDate}
              onChange={e => { setForm(f => ({ ...f, startDate: e.target.value })); setErrors(er => ({ ...er, startDate: '' })) }}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.startDate ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-indigo-500'}`}
            />
            {errors.startDate && <p className="mt-1 text-xs text-red-500">{errors.startDate}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">종료일 <span className="text-red-500">*</span></label>
            <input
              type="date" value={form.endDate}
              onChange={e => { setForm(f => ({ ...f, endDate: e.target.value })); setErrors(er => ({ ...er, endDate: '' })) }}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.endDate ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-indigo-500'}`}
            />
            {errors.endDate && <p className="mt-1 text-xs text-red-500">{errors.endDate}</p>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">스프린트 목표 (선택)</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="이번 스프린트의 목표를 입력하세요"
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>
      </div>
    </Modal>
  )
}

/* -- Sprint Complete Confirmation Modal -- */
function SprintCompleteModal({ sprint, tasks, onClose, onConfirm }) {
  const sprintTasks = tasks.filter(t => sprint.taskIds.includes(t.id))
  const doneTasks = sprintTasks.filter(t => t.status === 'done')
  const incompleteTasks = sprintTasks.filter(t => t.status !== 'done')

  return (
    <Modal title="스프린트 완료" onClose={onClose} onConfirm={onConfirm} confirmLabel="완료하기">
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">{sprint.name}</span>을(를) 완료하시겠습니까?
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
            <div className="text-xs text-green-600 font-medium">완료된 작업</div>
            <div className="text-lg font-bold text-green-700">{doneTasks.length}개</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5">
            <div className="text-xs text-orange-600 font-medium">미완료 작업</div>
            <div className="text-lg font-bold text-orange-700">{incompleteTasks.length}개</div>
          </div>
        </div>
        {incompleteTasks.length > 0 && (
          <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            미완료 작업은 다음 스프린트 생성 시 자동으로 포함됩니다.
          </div>
        )}
      </div>
    </Modal>
  )
}
