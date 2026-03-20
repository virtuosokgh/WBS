import { useState } from 'react'
import Modal from './Modal'
import { STATUS_OPTIONS, PRIORITY_OPTIONS, ROLE_COLORS } from '../utils/helpers'

export default function TaskModal({ task, members, onClose, onSave, saving = false, serverError = '' }) {
  const [form, setForm] = useState({
    name: task?.name || '',
    description: task?.description || '',
    assigneeId: task?.assigneeId || '',
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    startDate: task?.startDate || '',
    endDate: task?.endDate || '',
    note: task?.note || '',
  })
  const [errors, setErrors] = useState({})

  function clearError(field) {
    setErrors(e => ({ ...e, [field]: '' }))
  }

  function validate() {
    const e = {}
    if (!form.name.trim()) e.name = '작업명을 입력해주세요.'
    if (!form.assigneeId) e.assigneeId = '담당자를 선택해주세요.'
    if (!form.startDate) e.startDate = '시작일을 선택해주세요.'
    if (!form.endDate) e.endDate = '종료일을 선택해주세요.'
    if (form.startDate && form.endDate && form.endDate < form.startDate)
      e.endDate = '종료일은 시작일 이후여야 합니다.'
    return e
  }

  function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    onSave({ ...form, name: form.name.trim() })
  }

  const isValid = form.name.trim() && form.assigneeId && form.startDate && form.endDate

  return (
    <Modal
      title={task ? '작업 수정' : '새 작업'}
      onClose={onClose}
      onConfirm={handleSave}
      confirmLabel={saving ? '저장 중...' : task ? '저장' : '추가'}
      confirmDisabled={saving}
      size="lg"
    >
      <div className="space-y-4">
        {/* 작업명 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            작업명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => { setForm(f => ({ ...f, name: e.target.value })); clearError('name') }}
            placeholder="작업명을 입력하세요"
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-colors ${
              errors.name ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-indigo-500'
            }`}
            autoFocus
          />
          {errors.name && <p className="mt-1 text-xs text-red-500">⚠ {errors.name}</p>}
        </div>

        {/* 설명 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="작업 설명 (선택)"
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* 상태 & 우선순위 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              상태 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, status: s.value }))}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                    form.status === s.value
                      ? `border-transparent ${s.color}`
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              우선순위 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {PRIORITY_OPTIONS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, priority: p.value }))}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                    form.priority === p.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 담당자 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            담당자 <span className="text-red-500">*</span>
          </label>
          {members.length === 0 ? (
            <div className="border border-amber-200 bg-amber-50 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-700">프로젝트 참여자가 없습니다. 팀원 탭에서 먼저 친구를 초대해주세요.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {members.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setForm(f => ({ ...f, assigneeId: m.id })); clearError('assigneeId') }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                      form.assigneeId === m.id
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                      form.assigneeId === m.id ? 'bg-indigo-200 text-indigo-700' : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {m.name[0]}
                    </div>
                    {m.name}
                    {m.role && (
                      <span className={`text-xs px-1 rounded font-medium ${ROLE_COLORS[m.role] || 'bg-gray-100 text-gray-600'}`}>
                        {m.role}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {errors.assigneeId && <p className="mt-1.5 text-xs text-red-500">⚠ {errors.assigneeId}</p>}
            </>
          )}
        </div>

        {/* 날짜 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              시작일 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.startDate}
              onChange={e => { setForm(f => ({ ...f, startDate: e.target.value })); clearError('startDate') }}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-colors ${
                errors.startDate ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-indigo-500'
              }`}
            />
            {errors.startDate && <p className="mt-1 text-xs text-red-500">⚠ {errors.startDate}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              종료일 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.endDate}
              onChange={e => { setForm(f => ({ ...f, endDate: e.target.value })); clearError('endDate') }}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-colors ${
                errors.endDate ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-indigo-500'
              }`}
            />
            {errors.endDate && <p className="mt-1 text-xs text-red-500">⚠ {errors.endDate}</p>}
          </div>
        </div>

        {/* 메모 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
          <textarea
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            placeholder="추가 메모 (선택)"
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* 서버 에러 */}
        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-lg">
            ⚠ {serverError}
          </div>
        )}
      </div>
    </Modal>
  )
}
