// Meeting notes localStorage persistence layer
// Keyed by projectId: `meetings_${projectId}`

import { generateId } from '../utils/helpers'

function getStorageKey(projectId) {
  return `meetings_${projectId}`
}

export function getMeetings(projectId) {
  try {
    const raw = localStorage.getItem(getStorageKey(projectId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveMeetings(projectId, meetings) {
  localStorage.setItem(getStorageKey(projectId), JSON.stringify(meetings))
}

export function getMeetingsBySprintId(projectId, sprintId) {
  return getMeetings(projectId).filter(m => m.sprintId === sprintId)
}

// 스프린트에 기본 회의(계획/회고) 생성
export function ensureDefaultMeetings(projectId, sprintId, sprintName) {
  const all = getMeetings(projectId)
  const sprintMeetings = all.filter(m => m.sprintId === sprintId)

  const hasPlanning = sprintMeetings.some(m => m.type === 'planning')
  const hasRetro = sprintMeetings.some(m => m.type === 'retrospective')

  let changed = false
  if (!hasPlanning) {
    all.push({
      id: generateId(),
      sprintId,
      type: 'planning',
      title: `${sprintName} 계획 회의`,
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    changed = true
  }
  if (!hasRetro) {
    all.push({
      id: generateId(),
      sprintId,
      type: 'retrospective',
      title: `${sprintName} 회고 회의`,
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    changed = true
  }
  if (changed) saveMeetings(projectId, all)
  return getMeetingsBySprintId(projectId, sprintId)
}

export function createMeeting(projectId, { sprintId, title }) {
  const all = getMeetings(projectId)
  const meeting = {
    id: generateId(),
    sprintId,
    type: 'custom',
    title: title || '새 회의',
    content: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  all.push(meeting)
  saveMeetings(projectId, all)
  return meeting
}

export function updateMeeting(projectId, meetingId, { title, content }) {
  const all = getMeetings(projectId)
  const idx = all.findIndex(m => m.id === meetingId)
  if (idx === -1) return null
  if (title !== undefined) all[idx].title = title
  if (content !== undefined) all[idx].content = content
  all[idx].updatedAt = Date.now()
  saveMeetings(projectId, all)
  return all[idx]
}

export function deleteMeeting(projectId, meetingId) {
  const all = getMeetings(projectId)
  const filtered = all.filter(m => m.id !== meetingId)
  saveMeetings(projectId, filtered)
}
