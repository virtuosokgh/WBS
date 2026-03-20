import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, User, UserPlus } from 'lucide-react'
import { getTeamMembers, addTeamMember, updateTeamMember, deleteTeamMember, getProjectMembers, inviteUserToProject, getFriends } from '../lib/db'
import { ROLES, ROLE_COLORS } from '../utils/helpers'
import Modal from './Modal'

export default function MemberPanel({ projectId, user, isOwner }) {
  const [members, setMembers] = useState([])
  const [projectUsers, setProjectUsers] = useState([]) // 초대된 시스템 유저
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [editMember, setEditMember] = useState(null)
  const [form, setForm] = useState({ name: '', role: 'FE', email: '' })
  const [friends, setFriends] = useState([])
  const [inviting, setInviting] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: m }, { data: pu }, { data: f }] = await Promise.all([
      getTeamMembers(projectId),
      getProjectMembers(projectId),
      getFriends(user.id),
    ])
    setMembers(m || [])
    setProjectUsers(pu || [])
    setFriends(f || [])
    setLoading(false)
  }, [projectId, user.id])

  useEffect(() => { fetchAll() }, [fetchAll])

  function openCreate() {
    setEditMember(null)
    setForm({ name: '', role: 'FE', email: '' })
    setShowModal(true)
  }

  function openEdit(member) {
    setEditMember(member)
    setForm({ name: member.name, role: member.role, email: member.email || '' })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    if (editMember) {
      const { data } = await updateTeamMember(editMember.id, form)
      if (data) setMembers(m => m.map(x => x.id === editMember.id ? data : x))
    } else {
      const { data } = await addTeamMember(projectId, form)
      if (data) setMembers(m => [...m, data])
    }
    setShowModal(false)
  }

  async function handleDelete(id) {
    await deleteTeamMember(id)
    setMembers(m => m.filter(x => x.id !== id))
  }

  async function handleInvite(friendId) {
    setInviting(friendId)
    await inviteUserToProject(projectId, friendId, user.id)
    setInviting(null)
    setShowInviteModal(false)
    fetchAll()
  }

  const byRole = ROLES.reduce((acc, role) => {
    acc[role] = members.filter(m => m.role === role)
    return acc
  }, {})

  // 이미 초대된 친구 제외
  const invitedIds = new Set([...projectUsers.map(pu => pu.user_id), user.id])
  const invitableFriends = friends.filter(f => !invitedIds.has(f.id))

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-8">
      {/* 프로젝트 참여자 (시스템 유저) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">프로젝트 참여자</h3>
          {isOwner && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <UserPlus size={15} />
              친구 초대
            </button>
          )}
        </div>

        <div className="space-y-2">
          {/* 소유자 */}
          <div className="flex items-center justify-between bg-indigo-50 rounded-lg px-3 py-2 border border-indigo-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-indigo-500 text-white text-xs font-bold flex items-center justify-center">
                {(user.user_metadata?.name || user.email)[0].toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-800">{user.user_metadata?.name || '나'}</div>
                <div className="text-xs text-gray-400">{user.email}</div>
              </div>
            </div>
            <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">소유자</span>
          </div>

          {/* 초대된 멤버들 */}
          {projectUsers.map(pu => (
            <div key={pu.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 group">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center">
                  {(pu.user?.name || pu.user?.email || '?')[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-800">{pu.user?.name || '-'}</div>
                  <div className="text-xs text-gray-400">{pu.user?.email}</div>
                </div>
              </div>
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">멤버</span>
            </div>
          ))}

          {projectUsers.length === 0 && (
            <p className="text-xs text-gray-400 italic px-1">초대된 참여자가 없습니다</p>
          )}
        </div>
      </div>

      {/* WBS 담당자 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">WBS 담당자 ({members.length}명)</h3>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            <Plus size={15} />
            담당자 추가
          </button>
        </div>

        {members.length === 0 ? (
          <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
            <User size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">등록된 담당자가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {ROLES.map(role => {
              const roleMembers = byRole[role]
              if (!roleMembers?.length) return null
              return (
                <div key={role}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[role]}`}>{role}</span>
                    <span className="text-xs text-gray-400">{roleMembers.length}명</span>
                  </div>
                  <div className="space-y-1.5">
                    {roleMembers.map(member => (
                      <MemberRow key={member.id} member={member} onEdit={() => openEdit(member)} onDelete={() => handleDelete(member.id)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 담당자 추가/수정 Modal */}
      {showModal && (
        <Modal
          title={editMember ? '담당자 수정' : '담당자 추가'}
          onClose={() => setShowModal(false)}
          onConfirm={handleSave}
          confirmLabel={editMember ? '저장' : '추가'}
          confirmDisabled={!form.name.trim()}
          size="sm"
        >
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이름 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="이름 입력"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">직무</label>
              <div className="grid grid-cols-4 gap-1.5">
                {ROLES.map(role => (
                  <button
                    key={role}
                    onClick={() => setForm(f => ({ ...f, role }))}
                    className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      form.role === role ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일 (선택)</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* 친구 초대 Modal */}
      {showInviteModal && (
        <Modal
          title="친구를 프로젝트에 초대"
          onClose={() => setShowInviteModal(false)}
          size="sm"
        >
          {invitableFriends.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <UserPlus size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">초대할 수 있는 친구가 없습니다</p>
              <p className="text-xs mt-1 text-gray-300">친구 탭에서 먼저 친구를 추가해주세요</p>
            </div>
          ) : (
            <div className="space-y-2">
              {invitableFriends.map(friend => (
                <div key={friend.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold flex items-center justify-center">
                      {(friend.name || friend.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-800">{friend.name}</div>
                      <div className="text-xs text-gray-400">{friend.email}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleInvite(friend.id)}
                    disabled={inviting === friend.id}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                  >
                    {inviting === friend.id ? '초대 중...' : '초대'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

function MemberRow({ member, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 group">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
          {member.name[0]}
        </div>
        <div>
          <div className="text-sm font-medium text-gray-800">{member.name}</div>
          {member.email && <div className="text-xs text-gray-400">{member.email}</div>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[member.role] || 'bg-gray-100 text-gray-600'}`}>{member.role}</span>
        <button onClick={onEdit} className="ml-1 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}
