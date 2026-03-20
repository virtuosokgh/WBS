import { useState, useEffect, useCallback } from 'react'
import { Plus, FolderOpen, Trash2, Calendar, Users, ChevronRight, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getProjects, createProject, updateProject, deleteProject, getPendingInvitations } from '../lib/db'
import { formatDate, getDday } from '../utils/helpers'
import Modal from './Modal'
import Footer from './Footer'

export default function ProjectList({ onSelectProject, user, onOpenFriends }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [editProject, setEditProject] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', startDate: '', endDate: '' })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: proj }, { data: inv }] = await Promise.all([
      getProjects(),
      getPendingInvitations(user.id),
    ])
    setProjects(proj || [])
    setPendingCount((inv || []).length)
    setLoading(false)
  }, [user.id])

  useEffect(() => { fetchAll() }, [fetchAll])

  function openCreate() {
    setEditProject(null)
    setForm({ name: '', description: '', startDate: '', endDate: '' })
    setShowModal(true)
  }

  function openEdit(e, project) {
    e.stopPropagation()
    setEditProject(project)
    setForm({
      name: project.name,
      description: project.description || '',
      startDate: project.start_date || '',
      endDate: project.end_date || '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    if (editProject) {
      const { data } = await updateProject(editProject.id, form)
      if (data) setProjects(p => p.map(x => x.id === editProject.id ? data : x))
    } else {
      const { data } = await createProject({ ...form, ownerId: user.id })
      if (data) setProjects(p => [data, ...p])
    }
    setShowModal(false)
  }

  async function handleDelete() {
    await deleteProject(deleteConfirm.id)
    setProjects(p => p.filter(x => x.id !== deleteConfirm.id))
    setDeleteConfirm(null)
  }

  async function handleWithdraw() {
    setWithdrawing(true)
    const { error } = await supabase.rpc('delete_own_account')
    if (error) {
      alert(`탈퇴 실패: ${error.message}`)
      setWithdrawing(false)
      return
    }
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">PlanIt</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              안녕하세요, <span className="font-medium text-gray-700">{user.user_metadata?.name || user.email}</span> 님
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenFriends}
              className="relative flex items-center gap-1.5 text-gray-500 hover:text-indigo-600 px-3 py-2 rounded-lg text-sm border border-gray-200 hover:border-indigo-300 transition-colors"
            >
              <Users size={15} />
              친구
              {pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center leading-none">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              새 프로젝트
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg text-sm border border-gray-200 hover:border-gray-300 transition-colors"
              title="로그아웃"
            >
              <LogOut size={15} />
            </button>
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="flex items-center gap-1.5 text-gray-400 hover:text-red-500 px-3 py-2 rounded-lg text-sm border border-gray-200 hover:border-red-200 transition-colors"
              title="회원탈퇴"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="18" y1="8" x2="23" y2="13"/>
                <line x1="23" y1="8" x2="18" y2="13"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Project Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <FolderOpen size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">프로젝트가 없습니다</p>
            <p className="text-sm mt-1">새 프로젝트를 만들어 일정을 관리해보세요</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                userId={user.id}
                onClick={() => onSelectProject(project.id)}
                onEdit={e => openEdit(e, project)}
                onDelete={e => { e.stopPropagation(); setDeleteConfirm(project) }}
              />
            ))}
          </div>
        )}
      </div>

      <Footer />

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal
          title={editProject ? '프로젝트 수정' : '새 프로젝트'}
          onClose={() => setShowModal(false)}
          onConfirm={handleSave}
          confirmLabel={editProject ? '저장' : '만들기'}
          confirmDisabled={!form.name.trim()}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                프로젝트명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="프로젝트 이름을 입력하세요"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="프로젝트 설명 (선택)"
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                <input type="date" value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                <input type="date" value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* 회원탈퇴 Confirm */}
      {showWithdrawModal && (
        <Modal
          title="회원탈퇴"
          onClose={() => setShowWithdrawModal(false)}
          onConfirm={handleWithdraw}
          confirmLabel={withdrawing ? '탈퇴 중...' : '탈퇴하기'}
          confirmVariant="danger"
          confirmDisabled={withdrawing}
        >
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
              <svg className="text-red-500 flex-shrink-0 mt-0.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div className="text-sm text-red-700">
                <p className="font-semibold mb-1">탈퇴 시 다음 데이터가 모두 삭제됩니다</p>
                <ul className="text-xs space-y-0.5 text-red-600 list-disc list-inside">
                  <li>내가 만든 모든 프로젝트 및 WBS 작업</li>
                  <li>친구 관계 및 요청 내역</li>
                  <li>계정 정보</li>
                </ul>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-800">{user.email}</span> 계정을 탈퇴합니다.<br/>
              이 작업은 <span className="text-red-600 font-medium">절대 되돌릴 수 없습니다.</span>
            </p>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <Modal
          title="프로젝트 삭제"
          onClose={() => setDeleteConfirm(null)}
          onConfirm={handleDelete}
          confirmLabel="삭제"
          confirmVariant="danger"
        >
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">"{deleteConfirm.name}"</span> 프로젝트와 모든 작업 데이터가 삭제됩니다.
            이 작업은 되돌릴 수 없습니다.
          </p>
        </Modal>
      )}
    </div>
  )
}

function ProjectCard({ project, userId, onClick, onEdit, onDelete }) {
  const isOwner = project.owner_id === userId
  const dday = getDday(project.end_date)

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
              {project.name}
            </h3>
            {!isOwner && (
              <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded flex-shrink-0">참여</span>
            )}
          </div>
          {project.description && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{project.description}</p>
          )}
        </div>
        {isOwner && (
          <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500 mt-3">
        {/* 참여 프로젝트면 관리자 표시 */}
        {!isOwner && project.owner && (
          <span className="flex items-center gap-1 text-indigo-500">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            관리자: {project.owner.name || project.owner.email}
          </span>
        )}
        {project.end_date && (
          <span className="flex items-center gap-1">
            <Calendar size={11} />
            {formatDate(project.end_date)}
          </span>
        )}
        {dday && (
          <span className={`font-semibold ${
            dday === 'D-Day' ? 'text-red-600' :
            dday.startsWith('D+') ? 'text-red-400' :
            parseInt(dday.replace('D-','')) <= 7 ? 'text-orange-500' : 'text-gray-500'
          }`}>{dday}</span>
        )}
        <span className="ml-auto">
          <ChevronRight size={13} className="text-gray-300 group-hover:text-indigo-400 transition-colors" />
        </span>
      </div>
    </div>
  )
}
