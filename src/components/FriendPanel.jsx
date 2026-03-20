import { useState, useEffect, useCallback } from 'react'
import { UserPlus, UserCheck, UserX, Search, Users, X, Check, Loader2, Bell, Calendar } from 'lucide-react'
import {
  getFriends, getPendingReceived, getPendingSent,
  sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend,
  getPendingInvitations, acceptInvitation, declineInvitation,
} from '../lib/db'
import { formatDate } from '../utils/helpers'
import Footer from './Footer'

export default function FriendPanel({ user, onBack, onRefreshProjects }) {
  const [activeTab, setActiveTab] = useState('friends') // 'friends' | 'invitations'

  // 친구 탭 state
  const [friends, setFriends] = useState([])
  const [received, setReceived] = useState([])
  const [sent, setSent] = useState([])
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [searchEmail, setSearchEmail] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchSuccess, setSearchSuccess] = useState('')

  // 프로젝트 요청 탭 state
  const [invitations, setInvitations] = useState([])
  const [loadingInv, setLoadingInv] = useState(true)

  const fetchFriends = useCallback(async () => {
    setLoadingFriends(true)
    const [{ data: f }, { data: r }, { data: s }] = await Promise.all([
      getFriends(user.id),
      getPendingReceived(user.id),
      getPendingSent(user.id),
    ])
    setFriends(f || [])
    setReceived(r || [])
    setSent(s || [])
    setLoadingFriends(false)
  }, [user.id])

  const fetchInvitations = useCallback(async () => {
    setLoadingInv(true)
    const { data } = await getPendingInvitations(user.id)
    setInvitations(data || [])
    setLoadingInv(false)
  }, [user.id])

  useEffect(() => { fetchFriends() }, [fetchFriends])
  useEffect(() => { fetchInvitations() }, [fetchInvitations])

  // 친구 탭 핸들러
  async function handleSendRequest(e) {
    e.preventDefault()
    if (!searchEmail.trim()) return
    setSearching(true)
    setSearchError('')
    setSearchSuccess('')
    const { error, profile } = await sendFriendRequest(user.id, searchEmail.trim())
    if (error) {
      setSearchError(error.message)
    } else {
      setSearchSuccess(`${profile?.name || searchEmail} 님에게 친구 요청을 보냈습니다!`)
      setSearchEmail('')
      fetchFriends()
    }
    setSearching(false)
  }

  async function handleAcceptFriend(friendshipId) {
    await acceptFriendRequest(friendshipId)
    fetchFriends()
  }

  async function handleDeclineFriend(friendshipId) {
    await declineFriendRequest(friendshipId)
    fetchFriends()
  }

  async function handleRemoveFriend(friendshipId) {
    await removeFriend(friendshipId)
    fetchFriends()
  }

  // 프로젝트 요청 탭 핸들러
  async function handleAcceptInv(inv) {
    await acceptInvitation(inv.project_id, user.id)
    setInvitations(list => list.filter(x => x.id !== inv.id))
    if (onRefreshProjects) onRefreshProjects()
  }

  async function handleDeclineInv(inv) {
    await declineInvitation(inv.project_id, user.id)
    setInvitations(list => list.filter(x => x.id !== inv.id))
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">친구 / 프로젝트 요청</h1>
            <p className="text-sm text-gray-500">친구를 추가하고 프로젝트 초대를 관리하세요</p>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'friends' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users size={14} />
            친구
            {received.length > 0 && (
              <span className="bg-orange-400 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                {received.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'invitations' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Bell size={14} />
            프로젝트 요청
            {invitations.length > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                {invitations.length}
              </span>
            )}
          </button>
        </div>

        {/* ─── 친구 탭 ─── */}
        {activeTab === 'friends' && (
          <div className="space-y-6">
            {/* 친구 요청 보내기 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <UserPlus size={16} className="text-indigo-500" />
                이메일로 친구 추가
              </h2>
              <form onSubmit={handleSendRequest} className="flex gap-2">
                <div className="flex-1 relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={searchEmail}
                    onChange={e => { setSearchEmail(e.target.value); setSearchError(''); setSearchSuccess('') }}
                    placeholder="친구의 이메일 주소"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!searchEmail.trim() || searching}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {searching ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  요청 보내기
                </button>
              </form>
              {searchError && <p className="mt-2 text-xs text-red-500">{searchError}</p>}
              {searchSuccess && (
                <p className="mt-2 text-xs text-green-600 flex items-center gap-1">
                  <Check size={12} /> {searchSuccess}
                </p>
              )}
            </div>

            {loadingFriends ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* 받은 친구 요청 */}
                {received.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center">{received.length}</div>
                      받은 친구 요청
                    </h2>
                    <div className="space-y-2">
                      {received.map(req => (
                        <div key={req.id} className="flex items-center justify-between bg-white rounded-xl border border-orange-100 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-700 font-bold flex items-center justify-center text-sm">
                              {(req.requester?.name || req.requester?.email || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{req.requester?.name || '-'}</div>
                              <div className="text-xs text-gray-400">{req.requester?.email}</div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAcceptFriend(req.id)}
                              className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                            >
                              <Check size={12} /> 수락
                            </button>
                            <button
                              onClick={() => handleDeclineFriend(req.id)}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                            >
                              <X size={12} /> 거절
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 친구 목록 */}
                <section>
                  <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Users size={15} className="text-indigo-500" />
                    친구 ({friends.length}명)
                  </h2>
                  {friends.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                      <Users size={36} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">아직 친구가 없습니다</p>
                      <p className="text-xs mt-1">이메일로 친구를 추가해보세요</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {friends.map(friend => (
                        <div key={friend.friendshipId} className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm flex-shrink-0">
                              {(friend.name || friend.email || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{friend.name || '이름 없음'}</div>
                              <div className="text-xs text-gray-400">{friend.email}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveFriend(friend.friendshipId)}
                            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors border border-gray-200 hover:border-red-200 ml-2 flex-shrink-0"
                            title="친구 삭제"
                          >
                            <UserX size={13} />
                            삭제
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* 보낸 요청 대기 중 */}
                {sent.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                      보낸 요청 대기 중 ({sent.length})
                    </h2>
                    <div className="space-y-2">
                      {sent.map(req => (
                        <div key={req.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3 opacity-70">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 font-bold flex items-center justify-center text-sm">
                              {(req.addressee?.name || req.addressee?.email || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-700">{req.addressee?.name || '-'}</div>
                              <div className="text-xs text-gray-400">{req.addressee?.email}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">요청 중</span>
                            <button onClick={() => handleDeclineFriend(req.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all" title="요청 취소">
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {/* ─── 프로젝트 요청 탭 ─── */}
        {activeTab === 'invitations' && (
          <div>
            {loadingInv ? (
              <div className="flex items-center justify-center py-24">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : invitations.length === 0 ? (
              <div className="text-center py-24 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                <Bell size={40} className="mx-auto mb-3 opacity-25" />
                <p className="text-sm font-medium">대기 중인 프로젝트 초대가 없습니다</p>
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
                        onClick={() => handleAcceptInv(inv)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                      >
                        <Check size={14} /> 수락
                      </button>
                      <button
                        onClick={() => handleDeclineInv(inv)}
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
        )}
      </div>
      <Footer />
    </div>
  )
}
