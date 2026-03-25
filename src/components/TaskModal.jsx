import { useState, useRef, useCallback } from 'react'
import Modal from './Modal'
import { STATUS_OPTIONS, PRIORITY_OPTIONS, ROLE_COLORS } from '../utils/helpers'
import { supabase } from '../lib/supabase'

/* ── Rich Description Editor (Jira-like) ── */
function RichEditor({ value, onChange }) {
  const editorRef = useRef(null)
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const execCmd = useCallback((cmd, val = null) => {
    document.execCommand(cmd, false, val)
    editorRef.current?.focus()
    // sync
    onChange(editorRef.current?.innerHTML || '')
  }, [onChange])

  const handleInput = useCallback(() => {
    onChange(editorRef.current?.innerHTML || '')
  }, [onChange])

  const handleImageUpload = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) {
      alert('이미지는 5MB 이하만 업로드할 수 있습니다.')
      return
    }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `task-img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
      const { error } = await supabase.storage.from('task-images').upload(fileName, file)
      if (error) {
        // If bucket doesn't exist, use base64 fallback
        const reader = new FileReader()
        reader.onload = (e) => {
          execCmd('insertImage', e.target.result)
        }
        reader.readAsDataURL(file)
      } else {
        const { data: urlData } = supabase.storage.from('task-images').getPublicUrl(fileName)
        execCmd('insertImage', urlData.publicUrl)
      }
    } catch {
      // Fallback: embed as base64
      const reader = new FileReader()
      reader.onload = (e) => {
        execCmd('insertImage', e.target.result)
      }
      reader.readAsDataURL(file)
    } finally {
      setUploading(false)
    }
  }, [execCmd])

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file) handleImageUpload(file)
    e.target.value = ''
  }, [handleImageUpload])

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items
    if (items) {
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          handleImageUpload(item.getAsFile())
          return
        }
      }
    }
  }, [handleImageUpload])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file?.type.startsWith('image/')) {
      handleImageUpload(file)
    }
  }, [handleImageUpload])

  const TB = ({ icon, cmd, val, title }) => (
    <button
      type="button"
      className="rich-tb-btn"
      onMouseDown={e => { e.preventDefault(); execCmd(cmd, val) }}
      title={title}
      dangerouslySetInnerHTML={{ __html: icon }}
    />
  )

  return (
    <div className="rich-editor-wrap">
      <div className="rich-toolbar">
        <TB icon="<b>B</b>" cmd="bold" title="굵게 (Ctrl+B)" />
        <TB icon="<i>I</i>" cmd="italic" title="기울임 (Ctrl+I)" />
        <TB icon="<u>U</u>" cmd="underline" title="밑줄 (Ctrl+U)" />
        <TB icon="<s>S</s>" cmd="strikeThrough" title="취소선" />
        <span className="rich-tb-sep" />
        <TB icon="H1" cmd="formatBlock" val="h3" title="제목" />
        <TB icon="H2" cmd="formatBlock" val="h4" title="소제목" />
        <span className="rich-tb-sep" />
        <TB icon="&bull;" cmd="insertUnorderedList" title="글머리 기호" />
        <TB icon="1." cmd="insertOrderedList" title="번호 매기기" />
        <span className="rich-tb-sep" />
        <TB icon="&ldquo;" cmd="formatBlock" val="blockquote" title="인용" />
        <TB icon="&mdash;" cmd="insertHorizontalRule" title="구분선" />
        <span className="rich-tb-sep" />
        <button
          type="button"
          className="rich-tb-btn"
          onMouseDown={e => { e.preventDefault(); fileInputRef.current?.click() }}
          title="이미지 업로드"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
        {uploading && <span className="rich-tb-uploading">업로드 중...</span>}
      </div>
      <div
        ref={editorRef}
        className="rich-editor-body"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        dangerouslySetInnerHTML={{ __html: value }}
        data-placeholder="작업에 대한 상세 설명을 입력하세요. 이미지를 붙여넣거나 드래그할 수 있습니다."
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  )
}

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

        {/* 설명 (Rich Editor) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
          <RichEditor
            value={form.description}
            onChange={v => setForm(f => ({ ...f, description: v }))}
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
