export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export const ROLES = ['BE', 'FE', 'iOS', 'Android', 'Design', 'PM', 'QA']

export const ROLE_COLORS = {
  BE: 'bg-blue-100 text-blue-700',
  FE: 'bg-green-100 text-green-700',
  iOS: 'bg-purple-100 text-purple-700',
  Android: 'bg-orange-100 text-orange-700',
  Design: 'bg-pink-100 text-pink-700',
  PM: 'bg-yellow-100 text-yellow-700',
  QA: 'bg-red-100 text-red-700',
}

export const STATUS_OPTIONS = [
  { value: 'todo', label: '대기', color: 'bg-gray-100 text-gray-600' },
  { value: 'in_progress', label: '진행중', color: 'bg-blue-100 text-blue-700' },
  { value: 'review', label: '검토중', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'done', label: '완료', color: 'bg-green-100 text-green-700' },
  { value: 'blocked', label: '블로킹', color: 'bg-red-100 text-red-700' },
]

export const PRIORITY_OPTIONS = [
  { value: 'low', label: '낮음', color: 'text-gray-500' },
  { value: 'medium', label: '보통', color: 'text-yellow-600' },
  { value: 'high', label: '높음', color: 'text-orange-600' },
  { value: 'critical', label: '긴급', color: 'text-red-600' },
]

export function getStatusInfo(value) {
  return STATUS_OPTIONS.find(s => s.value === value) || STATUS_OPTIONS[0]
}

export function getPriorityInfo(value) {
  return PRIORITY_OPTIONS.find(p => p.value === value) || PRIORITY_OPTIONS[1]
}

export function calcProgress(tasks) {
  if (!tasks || tasks.length === 0) return 0
  const done = tasks.filter(t => t.status === 'done').length
  return Math.round((done / tasks.length) * 100)
}

export function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export function getDday(endDate) {
  if (!endDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)
  const diff = Math.round((end - today) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'D-Day'
  if (diff > 0) return `D-${diff}`
  return `D+${Math.abs(diff)}`
}
