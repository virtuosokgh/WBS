import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Users, List, BarChart2, Layout, Pencil, Trash2, LogOut, Check, X, Layers, GitBranch, ChevronDown, Bell, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, getDday, STATUS_OPTIONS } from '../utils/helpers'
import { updateProject, deleteProject, getUserProjectRole } from '../lib/db'
import WBSTable from './WBSTable'
import MemberPanel from './MemberPanel'
import GanttView from './GanttView'
import StoryboardView from './StoryboardView'
import FlowchartView from '../storyboard/FlowchartView'
import MeetingNotes from './MeetingNotes'
import Footer from './Footer'
import { getSlackWebhookUrl, setSlackWebhookUrl } from '../lib/slack'
import Modal from './Modal'

const TABS = [
  { id: 'wbs', label: '보드', icon: List },
  { id: 'gantt', label: '간트차트', icon: BarChart2 },
  { id: 'meetings', label: '회의록', icon: FileText },
  {
    id: 'planning',
    label: '기획',
    icon: Layout,
    subs: [
      { id: 'storyboard', label: '스토리보드', icon: Layers },
      { id: 'flowchart', label: '플로우차트', icon: GitBranch },
    ]
  },
  { id: 'members', label: '팀원', icon: Users },
]

// URL hash에서 탭 파싱
function parseFromHash() {
  const hash = window.location.hash
  const tabMatch = hash.match(/[?&]tab=([^&]+)/)
  const subMatch = hash.match(/[?&]sub=([^&]+)/)
  let tab = tabMatch ? tabMatch[1] : 'wbs'
  let sub = subMatch ? subMatch[1] : 'storyboard'
  // backward compat: ?tab=storyboard → planning/storyboard
  if (tab === 'storyboard') { tab = 'planning'; sub = 'storyboard' }
  // validate
  const validTabs = TABS.map(t => t.id)
  if (!validTabs.includes(tab)) tab = 'wbs'
  return { tab, sub }
}

export default function ProjectDetail({ projectId, user, onBack, onDeleted }) {
  const [activeTab, setActiveTab] = useState(() => parseFromHash().tab)
  const [activeSub, setActiveSub] = useState(() => parseFromHash().sub)
  const [targetScreenId, setTargetScreenId] = useState(null)

  function changeTab(tabId, subId) {
    setActiveTab(tabId)
    if (subId) setActiveSub(subId)
    const base = `/project/${projectId}`
    if (tabId === 'wbs') window.location.hash = base
    else if (tabId === 'planning') {
      const s = subId ?? activeSub
      window.location.hash = `${base}?tab=planning&sub=${s}`
    } else {
      window.location.hash = `${base}?tab=${tabId}`
    }
  }

  function goToScreen(screenId) {
    setTargetScreenId(screenId)
    changeTab('planning', 'storyboard')
  }

  const [project, setProject] = useState(null)
  const [userRole, setUserRole] = useState(null) // '호스트' | '관리자' | '멤버'
  const [loading, setLoading] = useState(true)

  // 이름 인라인 편집
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [savingName, setSavingName] = useState(false)
  const nameInputRef = useRef(null)

  // Slack 설정
  const [showSlackModal, setShowSlackModal] = useState(false)

  // 삭제
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    supabase.from('projects').select('*').eq('id', projectId).single()
      .then(async ({ data }) => {
        setProject(data)
        if (data) {
          if (data.owner_id === user.id) {
            setUserRole('호스트')
          } else {
            const role = await getUserProjectRole(projectId, user.id)
            setUserRole(role)
          }
        }
        setLoading(false)
      })
  }, [projectId, user.id])

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [editingName])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  function startEditName() {
    setNameValue(project.name)
    setEditingName(true)
  }

  async function saveName() {
    if (!nameValue.trim() || nameValue.trim() === project.name) {
      setEditingName(false)
      return
    }
    setSavingName(true)
    const { data } = await updateProject(projectId, {
      name: nameValue.trim(),
      description: project.description,
      startDate: project.start_date,
      endDate: project.end_date,
    })
    if (data) setProject(p => ({ ...p, name: nameValue.trim() }))
    setSavingName(false)
    setEditingName(false)
  }

  function cancelEditName() {
    setEditingName(false)
    setNameValue('')
  }

  async function handleDelete() {
    setDeleting(true)
    await deleteProject(projectId)
    setDeleting(false)
    onDeleted()
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!project) return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <button onClick={onBack} className="text-gray-500 hover:text-gray-700">← 돌아가기</button>
      <p className="mt-4 text-gray-500">프로젝트를 찾을 수 없습니다.</p>
    </div>
  )

  const isOwner = project.owner_id === user.id
  const canEdit = userRole === '호스트' || userRole === '관리자'
  const dday = getDday(project.end_date)

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-3 py-3">
            {/* 뒤로가기 */}
            <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors flex-shrink-0">
              <ArrowLeft size={16} />
              목록
            </button>
            <div className="h-4 w-px bg-gray-200 flex-shrink-0" />

            {/* 프로젝트명 (편집 모드) */}
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={nameInputRef}
                    value={nameValue}
                    onChange={e => setNameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') cancelEditName() }}
                    className="font-bold text-gray-900 text-lg border-b-2 border-indigo-500 bg-transparent focus:outline-none min-w-0 flex-1 max-w-sm"
                    maxLength={60}
                  />
                  <button
                    onClick={saveName}
                    disabled={savingName || !nameValue.trim()}
                    className="p-1 rounded-md text-green-600 hover:bg-green-50 disabled:opacity-40 flex-shrink-0"
                    title="저장 (Enter)"
                  >
                    <Check size={15} />
                  </button>
                  <button
                    onClick={cancelEditName}
                    className="p-1 rounded-md text-gray-400 hover:bg-gray-100 flex-shrink-0"
                    title="취소 (Esc)"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 group">
                  <h1 className="font-bold text-gray-900 text-lg truncate">{project.name}</h1>
                  {userRole && userRole !== '호스트' && (
                    <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                      userRole === '관리자' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                    }`}>{userRole}</span>
                  )}
                  {canEdit && (
                    <button
                      onClick={startEditName}
                      className="p-1 rounded-md text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                      title="프로젝트명 수정"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </div>
              )}
              {project.description && !editingName && (
                <p className="text-xs text-gray-500 truncate">{project.description}</p>
              )}
            </div>

            {/* 날짜 + D-Day */}
            <div className="hidden md:flex items-center gap-4 text-xs text-gray-500 flex-shrink-0">
              {project.start_date && project.end_date && (
                <span>{formatDate(project.start_date)} ~ {formatDate(project.end_date)}</span>
              )}
              {dday && (
                <span className={`font-semibold ${
                  dday === 'D-Day' ? 'text-red-600' :
                  dday.startsWith('D+') ? 'text-red-400' :
                  parseInt(dday.replace('D-','')) <= 7 ? 'text-orange-500' : 'text-gray-600'
                }`}>{dday}</span>
              )}
            </div>

            {/* 액션 버튼 */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {userRole === '호스트' && !editingName && (
                <>
                  {/* 삭제 버튼 */}
                  {confirmDelete ? (
                    <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                      <span className="text-xs text-red-600 font-medium">삭제할까요?</span>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded font-medium disabled:opacity-50"
                      >
                        {deleting ? '삭제 중...' : '삭제'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="text-xs text-gray-500 hover:text-gray-700 px-1"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors"
                      title="프로젝트 삭제"
                    >
                      <Trash2 size={14} />
                      <span className="hidden sm:inline">삭제</span>
                    </button>
                  )}
                </>
              )}

              {/* Slack 알림 설정 */}
              {canEdit && (
                <button
                  onClick={() => setShowSlackModal(true)}
                  className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg transition-colors ${
                    getSlackWebhookUrl(projectId)
                      ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                      : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                  title="Slack 알림 설정"
                >
                  <Bell size={14} />
                  <span className="hidden sm:inline">알림</span>
                </button>
              )}

              {/* 로그아웃 */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100 px-2 py-1.5 rounded-lg transition-colors"
                title="로그아웃"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => changeTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon size={15} />
                {tab.label}
                {tab.subs && <ChevronDown size={12} className={`transition-transform ${activeTab === tab.id ? 'rotate-180' : ''}`} />}
              </button>
            ))}
          </div>
          {activeTab === 'planning' && (
            <div className="flex border-t border-gray-100">
              {TABS.find(t => t.id === 'planning').subs.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => { setActiveSub(sub.id); changeTab('planning', sub.id) }}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                    activeSub === sub.id ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <sub.icon size={12} />
                  {sub.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'meetings' ? (
        <div className="flex-1 max-w-6xl mx-auto w-full">
          <MeetingNotes projectId={projectId} canEdit={canEdit} />
        </div>
      ) : (
        <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
          {activeTab === 'wbs' && <WBSTable projectId={projectId} canEdit={canEdit} currentUser={user} />}
          {activeTab === 'gantt' && <GanttView projectId={projectId} onGoToScreen={goToScreen} canEdit={canEdit} />}
          {activeTab === 'planning' && activeSub === 'storyboard' && (
            <StoryboardView projectId={projectId} projectName={project?.name} initialScreenId={targetScreenId} canEdit={canEdit} />
          )}
          {activeTab === 'planning' && activeSub === 'flowchart' && (
            <FlowchartView projectId={projectId} />
          )}
          {activeTab === 'members' && <MemberPanel projectId={projectId} user={user} isOwner={isOwner} />}
        </div>
      )}

      <Footer />

      {/* Slack 설정 모달 */}
      {showSlackModal && (
        <SlackSettingsModal projectId={projectId} onClose={() => setShowSlackModal(false)} />
      )}
    </div>
  )
}

function SlackSettingsModal({ projectId, onClose }) {
  const [url, setUrl] = useState(getSlackWebhookUrl(projectId))
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setSlackWebhookUrl(projectId, url)
    setSaved(true)
    setTimeout(() => onClose(), 800)
  }

  function handleRemove() {
    setSlackWebhookUrl(projectId, '')
    setUrl('')
    setSaved(true)
    setTimeout(() => onClose(), 800)
  }

  return (
    <Modal title="Slack 알림 설정" onClose={onClose} onConfirm={handleSave} confirmLabel={saved ? '저장됨 ✓' : '저장'} size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Slack Incoming Webhook URL을 설정하면 작업 상태 변경, 담당자 변경, 댓글 등록 시 알림을 받을 수 있습니다.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
          <input
            type="url"
            value={url}
            onChange={e => { setUrl(e.target.value); setSaved(false) }}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
        </div>

        <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-xs text-gray-500 space-y-1">
          <p className="font-medium text-gray-600">설정 방법:</p>
          <p>1. Slack에서 원하는 채널의 설정 → 연동 → Incoming Webhook 추가</p>
          <p>2. Webhook URL을 복사하여 위에 붙여넣기</p>
          <p>3. 저장하면 변경사항이 해당 채널로 알림됩니다</p>
        </div>

        {getSlackWebhookUrl(projectId) && (
          <button
            onClick={handleRemove}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            알림 해제
          </button>
        )}
      </div>
    </Modal>
  )
}
