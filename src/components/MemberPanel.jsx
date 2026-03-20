import { useState, useEffect, useCallback } from 'react'
import { UserPlus, Trash2, ChevronDown } from 'lucide-react'
import { getProjectMembers, inviteUserToProject, getFriends, removeProjectMember, updateMemberRole } from '../lib/db'
import Modal from './Modal'

const PERMISSION_ROLES = ['관리자', '멤버']

const ROLE_STYLE = {
  '호스트':  'bg-indigo-100 text-indigo-700',
  '관리자':  'bg-amber-100 text-amber-700',
  '멤버':    'bg-gray-100 text-gray-600',
}

const ROLE_DESC = {
  '관리자': '프로젝트 삭제 제외 모두 수정 가능',
  '멤버':   '뷰만 가능 (수정 불가)',
}

export default function MemberPanel({ projectId, user, isOwner }) {
  const [projectUsers, setProjectUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [friends, setFriends] = useState([])
  const [inviting, setInviting] = useState(null)
  const [inviteRole, setInviteRole] = useState('멤버')
  const [changingRole, setChangingRole] = useState(null) // userId being changed
  const [removing, setRemoving] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: pu }, { data: f }] = await Promise.all([
      getProjectMembers(projectId),
      getFriends(user.id),
    ])
    setProjectUsers(pu || [])
    setFriends(f || [])
    setLoading(false)
  }, [projectId, user.id])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleInvite(friendId) {
    setInviting(friendId)
    await inviteUserToProject(projectId, friendId, user.id, inviteRole)
    setInviting(null)
    setShowInviteModal(false)
    fetchAll()
  }

  async function handleRoleChange(userId, newRole) {
    setChangingRole(userId)
    await updateMemberRole(projectId, userId, newRole)
    setProjectUsers(prev => prev.map(pu =>
      pu.user_id === userId ? { ...pu, role: newRole } : pu
    ))
    setChangingRole(null)
  }

  async function handleRemove(userId) {
    if (!confirm('이 멤버를 프로젝트에서 내보내시겠습니까?')) return
    setRemoving(userId)
    await removeProjectMember(projectId, userId)
    setProjectUsers(prev => prev.filter(pu => pu.user_id !== userId))
    setRemoving(null)
  }

  const invitedIds = new Set([...projectUsers.map(pu => pu.user_id), user.id])
  const invitableFriends = friends.filter(f => !invitedIds.has(f.id))

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
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
        {/* 소유자 (호스트) */}
        <div className="flex items-center justify-between bg-indigo-50 rounded-lg px-3 py-2.5 border border-indigo-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-500 text-white text-xs font-bold flex items-center justify-center">
              {(user.user_metadata?.name || user.email)[0].toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-800">{user.user_metadata?.name || '나'}</div>
              <div className="text-xs text-gray-400">{user.email}</div>
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_STYLE['호스트']}`}>호스트</span>
        </div>

        {/* 초대된 멤버들 */}
        {projectUsers.map(pu => (
          <div key={pu.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5 group">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center">
                {(pu.user?.name || pu.user?.email || '?')[0].toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-800">{pu.user?.name || '-'}</div>
                <div className="text-xs text-gray-400">{pu.user?.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOwner ? (
                <RoleSelector
                  value={pu.role || '멤버'}
                  onChange={newRole => handleRoleChange(pu.user_id, newRole)}
                  loading={changingRole === pu.user_id}
                />
              ) : (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_STYLE[pu.role || '멤버']}`}>
                  {pu.role || '멤버'}
                </span>
              )}
              {isOwner && (
                <button
                  onClick={() => handleRemove(pu.user_id)}
                  disabled={removing === pu.user_id}
                  className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                  title="멤버 내보내기"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        ))}

        {projectUsers.length === 0 && (
          <p className="text-xs text-gray-400 italic px-1 py-2">초대된 참여자가 없습니다</p>
        )}
      </div>

      {/* 권한 안내 */}
      <div className="mt-6 p-3 bg-gray-50 rounded-lg border border-gray-100">
        <p className="text-xs font-semibold text-gray-500 mb-2">권한 안내</p>
        <div className="space-y-1.5">
          {[['호스트', '모든 것을 컨트롤할 수 있음'], ['관리자', ROLE_DESC['관리자']], ['멤버', ROLE_DESC['멤버']]].map(([role, desc]) => (
            <div key={role} className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ROLE_STYLE[role]}`}>{role}</span>
              <span className="text-xs text-gray-500">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 친구 초대 Modal */}
      {showInviteModal && (
        <Modal
          title="친구를 프로젝트에 초대"
          onClose={() => setShowInviteModal(false)}
          size="sm"
        >
          {/* 권한 선택 */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">초대 권한 선택</p>
            <div className="flex gap-2">
              {PERMISSION_ROLES.map(role => (
                <button
                  key={role}
                  onClick={() => setInviteRole(role)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    inviteRole === role
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div>{role}</div>
                  <div className="text-xs font-normal opacity-70 mt-0.5">{ROLE_DESC[role]}</div>
                </button>
              ))}
            </div>
          </div>

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

function RoleSelector({ value, onChange, loading }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border transition-colors ${ROLE_STYLE[value]} border-transparent hover:border-current disabled:opacity-50`}
      >
        {loading ? '...' : value}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 z-10 min-w-[120px]">
          {PERMISSION_ROLES.map(role => (
            <button
              key={role}
              onClick={() => { onChange(role); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 font-medium ${value === role ? 'text-indigo-600' : 'text-gray-700'}`}
            >
              {role}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
