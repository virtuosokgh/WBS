import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Mail, Lock, Eye, EyeOff, Loader2, CheckCircle, User } from 'lucide-react'
import Footer from './Footer'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [done, setDone] = useState('')

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setFieldErrors(e => ({ ...e, [field]: '' }))
    setServerError('')
  }

  function setFieldError(field, msg) {
    setFieldErrors(e => ({ ...e, [field]: msg }))
  }

  async function handleLogin(e) {
    e.preventDefault()
    const errs = {}
    if (!form.email.trim()) errs.email = '이메일을 입력해주세요.'
    if (!form.password) errs.password = '비밀번호를 입력해주세요.'
    if (Object.keys(errs).length) { setFieldErrors(errs); return }

    setLoading(true)
    setServerError('')
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
    if (error) {
      if (error.message.includes('Invalid login credentials')) setServerError('이메일 또는 비밀번호가 올바르지 않습니다.')
      else if (error.message.includes('Email not confirmed')) setServerError('이메일 인증이 완료되지 않았습니다. 받은 편지함을 확인해주세요.')
      else setServerError(error.message)
    }
    setLoading(false)
  }

  async function handleSignup(e) {
    e.preventDefault()
    const errs = {}
    if (!form.name.trim()) errs.name = '이름을 입력해주세요.'
    if (!form.email.trim()) errs.email = '이메일을 입력해주세요.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = '올바른 이메일 형식이 아닙니다.'
    if (!form.password) errs.password = '비밀번호를 입력해주세요.'
    else if (form.password.length < 6) errs.password = '비밀번호는 6자 이상이어야 합니다.'
    if (!form.confirmPassword) errs.confirmPassword = '비밀번호 확인을 입력해주세요.'
    else if (form.password !== form.confirmPassword) errs.confirmPassword = '비밀번호가 일치하지 않습니다.'
    if (Object.keys(errs).length) { setFieldErrors(errs); return }

    setLoading(true)
    setServerError('')

    const { data: existing } = await supabase
      .from('profiles').select('id').eq('email', form.email.toLowerCase().trim()).maybeSingle()
    if (existing) { setFieldError('email', '이미 가입된 이메일입니다.'); setLoading(false); return }

    const { error } = await supabase.auth.signUp({
      email: form.email.toLowerCase().trim(),
      password: form.password,
      options: { data: { name: form.name.trim() } },
    })
    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already been registered'))
        setFieldError('email', '이미 가입된 이메일입니다.')
      else if (error.message.includes('invalid'))
        setFieldError('email', '올바른 이메일 형식이 아닙니다.')
      else if (error.message.includes('weak'))
        setFieldError('password', '비밀번호가 너무 단순합니다. 더 복잡한 비밀번호를 사용해주세요.')
      else setServerError(error.message)
    } else {
      setDone('signup')
    }
    setLoading(false)
  }

  async function handleForgot(e) {
    e.preventDefault()
    if (!form.email.trim()) { setFieldError('email', '이메일을 입력해주세요.'); return }
    setLoading(true)
    setServerError('')
    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) setServerError(error.message)
    else setDone('forgot')
    setLoading(false)
  }

  // 회원가입 완료
  if (done === 'signup') {
    return (
      <AuthLayout>
        <div className="text-center py-4">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-green-600" size={28} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">이메일을 확인해주세요</h2>
          <p className="text-sm text-gray-500 mb-1">
            <span className="font-medium text-gray-700">{form.email}</span> 으로
          </p>
          <p className="text-sm text-gray-500 mb-6">인증 메일을 발송했습니다.<br />메일의 링크를 클릭하면 가입이 완료됩니다.</p>
          <button onClick={() => { setDone(''); setMode('login') }} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            로그인으로 돌아가기
          </button>
        </div>
      </AuthLayout>
    )
  }

  // 비밀번호 재설정 완료
  if (done === 'forgot') {
    return (
      <AuthLayout>
        <div className="text-center py-4">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="text-blue-600" size={28} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">메일을 확인해주세요</h2>
          <p className="text-sm text-gray-500 mb-6">
            비밀번호 재설정 링크를 <br />
            <span className="font-medium text-gray-700">{form.email}</span> 으로 발송했습니다.
          </p>
          <button onClick={() => { setDone(''); setMode('login') }} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            로그인으로 돌아가기
          </button>
        </div>
      </AuthLayout>
    )
  }

  const fe = fieldErrors

  return (
    <AuthLayout>
      {/* 탭 */}
      {mode !== 'forgot' && (
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => { setMode('login'); setFieldErrors({}); setServerError('') }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            로그인
          </button>
          <button
            onClick={() => { setMode('signup'); setFieldErrors({}); setServerError('') }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            회원가입
          </button>
        </div>
      )}

      {mode === 'forgot' && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">비밀번호 재설정</h2>
          <p className="text-sm text-gray-500">가입한 이메일로 재설정 링크를 보내드립니다</p>
        </div>
      )}

      <form onSubmit={mode === 'login' ? handleLogin : mode === 'signup' ? handleSignup : handleForgot} className="space-y-4" noValidate>

        {/* 이름 (회원가입만) */}
        {mode === 'signup' && (
          <Field label="이름" required error={fe.name}>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder="실명 또는 닉네임"
                className={inputCls(fe.name, 'pl-9')}
                autoComplete="name"
                autoFocus
              />
            </div>
          </Field>
        )}

        {/* 이메일 */}
        <Field label="이메일" required error={fe.email}>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              value={form.email}
              onChange={e => update('email', e.target.value)}
              placeholder="이메일 주소"
              className={inputCls(fe.email, 'pl-9')}
              autoComplete="email"
              autoFocus={mode !== 'signup'}
            />
          </div>
        </Field>

        {/* 비밀번호 */}
        {mode !== 'forgot' && (
          <Field label="비밀번호" required error={fe.password}>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={e => update('password', e.target.value)}
                placeholder={mode === 'signup' ? '6자 이상' : '비밀번호'}
                className={inputCls(fe.password, 'pl-9 pr-10')}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
        )}

        {/* 비밀번호 확인 */}
        {mode === 'signup' && (
          <Field label="비밀번호 확인" required error={fe.confirmPassword}>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPw ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={e => update('confirmPassword', e.target.value)}
                placeholder="비밀번호 재입력"
                className={inputCls(fe.confirmPassword, 'pl-9')}
                autoComplete="new-password"
              />
            </div>
          </Field>
        )}

        {/* 서버 에러 */}
        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-lg">
            {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 mt-1"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {mode === 'login' ? '로그인' : mode === 'signup' ? '회원가입' : '재설정 메일 보내기'}
        </button>
      </form>

      <div className="mt-5 text-center space-y-2">
        {mode === 'login' && (
          <button onClick={() => { setMode('forgot'); setFieldErrors({}); setServerError('') }}
            className="block w-full text-xs text-gray-500 hover:text-gray-700">
            비밀번호를 잊으셨나요?
          </button>
        )}
        {mode === 'forgot' && (
          <button onClick={() => { setMode('login'); setFieldErrors({}); setServerError('') }}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            ← 로그인으로 돌아가기
          </button>
        )}
      </div>
    </AuthLayout>
  )
}

// 인풋 클래스 헬퍼
function inputCls(error, extra = '') {
  return `w-full ${extra} pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${
    error
      ? 'border-red-400 focus:ring-red-400 bg-red-50'
      : 'border-gray-300 focus:ring-indigo-500'
  }`
}

// 필드 래퍼 (라벨 + 에러 메시지)
function Field({ label, required, error, children }) {
  return (
    <div>
      <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500 flex items-center gap-1">⚠ {error}</p>}
    </div>
  )
}

function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm flex-1 flex flex-col justify-center">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg overflow-hidden" style={{background: 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)'}}>
            <svg width="36" height="36" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="5.5" y="4.5" width="4.5" height="19" rx="2.25" fill="white"/>
              <path d="M10 4.5 C18.5 4.5 19.5 7.5 19.5 11.5 C19.5 15.5 18.5 18.5 10 18.5"
                    stroke="white" strokeWidth="4.5" fill="none"
                    strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="24" cy="6" r="2.5" fill="white" opacity="0.85"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">PlanIt</h1>
          <p className="text-sm text-gray-500 mt-1">프로젝트를 계획하고 실행하세요</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 p-6 border border-gray-100">
          {children}
        </div>
      </div>
      <Footer />
    </div>
  )
}
