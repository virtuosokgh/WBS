import { useState, useEffect, useCallback } from 'react'
import { X, Bell, Check, Calendar } from 'lucide-react'
import { getPendingInvitations, acceptInvitation, declineInvitation } from '../lib/db'
import { formatDate } from '../utils/helpers'

export default function ParticipationModal({ user, onClose, onRefreshProjects }) {
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchInvitations = useCallback(async () => {
    setLoading(true)
    const { data } = await getPendingInvitations(user.id)
    setInvitations(data || [])
    setLoading(false)
  }, [user.id])

  useEffect(() => { fetchInvitations() }, [fetchInvitations])

  async function handleAccept(inv) {
    await acceptInvitation(inv.project_id, user.id)
    setInvitations(i => i.filter(x => x.id !== inv.id))
    onRefreshProjects()
  }

  async function handleDecline(inv) {
    await declineInvitation(inv.project_id, user.id)
    setInvitations(i => i.filter(x => x.id !== inv.id))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-indigo-500" />
            <h2 className="font-bold text-gray-900">초대 요청</h2>
            {invitations.length > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {invitations.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-14 text-gray-400">
              <Bell size={40} className="mx-auto mb-3 opacity-25" />
              <p className="text-sm font-medium">대기 중인 초대가 없습니다</p>
              <p className="text-xs mt-1 text-gray-300">초대를 받으면 여기에 표시됩니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invitations.map(inv => (
                <div key={inv.id} className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                  <p className="font-semibold text-gray-900 mb-0.5">{inv.project?.name || '(프로젝트명 없음)'}</p>
                  {inv.project?.description && (
                    <p className="text-xs text-gray-500 mb-1">{inv.project.description}</p>
                  )}
                  {inv.project?.end_date && (
                    <p className="text-xs text-gray-400 flex items-center gap-1 mb-2">
                      <Calendar size={11} />
                      {formatDate(inv.project.start_date)} ~ {formatDate(inv.project.end_date)}
                    </p>
                  )}
                  <p className="text-xs text-indigo-600 mb-3">
                    <span className="font-medium">{inv.inviter?.name || inv.inviter?.email || '알 수 없음'}</span> 님이 초대했습니다
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(inv)}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                    >
                      <Check size={14} /> 수락
                    </button>
                    <button
                      onClick={() => handleDecline(inv)}
                      className="flex-1 text-sm text-gray-600 hover:text-gray-800 py-2 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                    >
                      거절
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
