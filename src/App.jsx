import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import AuthPage from './components/AuthPage'
import ProjectList from './components/ProjectList'
import ProjectDetail from './components/ProjectDetail'
import FriendPanel from './components/FriendPanel'

// ── 해시 파싱 (Supabase 인증 리다이렉트와 충돌 방지) ──
function parseHash() {
  const hash = window.location.hash
  // Supabase 이메일 인증 / 비밀번호 재설정 리다이렉트는 무시
  if (hash.includes('access_token=') || hash.includes('type=signup') || hash.includes('type=recovery')) {
    return null
  }
  if (hash.startsWith('#/project/')) {
    const id = hash.slice('#/project/'.length).split('?')[0]
    if (id) return { view: 'detail', projectId: id }
  }
  if (hash === '#/friends') return { view: 'friends', projectId: null }
  return { view: 'projects', projectId: null }
}

function pushHash(view, projectId = null, tab = null) {
  if (view === 'detail' && projectId) {
    window.location.hash = tab && tab !== 'wbs'
      ? `/project/${projectId}?tab=${tab}`
      : `/project/${projectId}`
  } else if (view === 'friends') {
    window.location.hash = '/friends'
  } else {
    window.location.hash = '/'
  }
}

// ── 새로고침 시 뷰 복원: 컴포넌트 생성 전에 동기적으로 해시 파싱 ──
const _initialRoute = parseHash() || { view: 'projects', projectId: null }

export default function App() {
  const [session, setSession] = useState(undefined)
  const [view, setView] = useState(_initialRoute.view)
  const [currentProjectId, setCurrentProjectId] = useState(_initialRoute.projectId)
  const [projectListKey, setProjectListKey] = useState(0)

  useEffect(() => {
    // 세션 확인 후 세션 없으면 projects로 리셋
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!session) {
        setView('projects')
        setCurrentProjectId(null)
        pushHash('projects')
      }
    }).catch(() => {
      setSession(null)
      setView('projects')
      setCurrentProjectId(null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) {
        setView('projects')
        setCurrentProjectId(null)
        pushHash('projects')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  function navigate(view, projectId = null) {
    setView(view)
    setCurrentProjectId(projectId)
    pushHash(view, projectId)
  }

  // 로딩 중
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">불러오는 중...</span>
        </div>
      </div>
    )
  }

  if (!session) return <AuthPage />

  const user = session.user

  if (view === 'friends') {
    return (
      <FriendPanel
        user={user}
        onBack={() => navigate('projects')}
        onRefreshProjects={() => setProjectListKey(k => k + 1)}
      />
    )
  }

  if (view === 'detail' && currentProjectId) {
    return (
      <ProjectDetail
        projectId={currentProjectId}
        user={user}
        onBack={() => navigate('projects')}
        onDeleted={() => { setProjectListKey(k => k + 1); navigate('projects') }}
      />
    )
  }

  return (
    <ProjectList
      key={projectListKey}
      user={user}
      onSelectProject={id => navigate('detail', id)}
      onOpenFriends={() => navigate('friends')}
    />
  )
}
