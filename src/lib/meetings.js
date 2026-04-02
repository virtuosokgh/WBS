// Meeting notes Supabase persistence layer
import { supabase } from './supabase'

function mapRow(row) {
  if (!row) return null
  return {
    id: row.id,
    sprintId: row.sprint_id,
    type: row.type,
    title: row.title,
    content: row.content || '',
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  }
}

// localStorage → Supabase 자동 마이그레이션 (Supabase 비어있을 때)
async function autoMigrateFromLocalStorage(projectId) {
  const lsKey = `meetings_${projectId}`
  try {
    const raw = localStorage.getItem(lsKey)
    if (!raw) return []
    const meetings = JSON.parse(raw)
    if (!meetings.length) return []

    const rows = meetings.map(m => ({
      id: m.id,
      project_id: projectId,
      sprint_id: m.sprintId,
      type: m.type || 'custom',
      title: m.title || '',
      content: m.content || '',
      created_at: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
      updated_at: m.updatedAt ? new Date(m.updatedAt).toISOString() : new Date().toISOString(),
    }))

    const { data, error } = await supabase.from('meetings').upsert(rows, { onConflict: 'id' }).select()
    if (error) {
      console.error('[meeting migration] error:', error.message)
      return []
    }
    localStorage.removeItem(lsKey)
    console.log(`[meeting migration] ${rows.length}개 회의록 마이그레이션 완료`)
    return (data || []).map(mapRow)
  } catch (e) {
    console.error('[meeting migration] parse error:', e)
    return []
  }
}

export async function getMeetings(projectId) {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at')
  if (error) { console.error('getMeetings error:', error); return [] }

  if (!data || data.length === 0) {
    const migrated = await autoMigrateFromLocalStorage(projectId)
    if (migrated.length > 0) return migrated
  }

  return (data || []).map(mapRow)
}

export async function getMeetingsBySprintId(projectId, sprintId) {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('project_id', projectId)
    .eq('sprint_id', sprintId)
    .order('created_at')
  if (error) { console.error('getMeetingsBySprintId error:', error); return [] }
  return (data || []).map(mapRow)
}

// 스프린트에 기본 회의(계획/회고) 생성
export async function ensureDefaultMeetings(projectId, sprintId, sprintName) {
  // 먼저 전체 meetings 마이그레이션 시도 (한 번만 실행됨)
  await getMeetings(projectId)

  const meetings = await getMeetingsBySprintId(projectId, sprintId)

  const hasPlanning = meetings.some(m => m.type === 'planning')
  const hasRetro = meetings.some(m => m.type === 'retrospective')

  const toInsert = []
  if (!hasPlanning) {
    toInsert.push({
      id: crypto.randomUUID(),
      project_id: projectId,
      sprint_id: sprintId,
      type: 'planning',
      title: `${sprintName} 계획 회의`,
      content: '',
    })
  }
  if (!hasRetro) {
    toInsert.push({
      id: crypto.randomUUID(),
      project_id: projectId,
      sprint_id: sprintId,
      type: 'retrospective',
      title: `${sprintName} 회고 회의`,
      content: '',
    })
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('meetings').insert(toInsert)
    if (error) console.error('ensureDefaultMeetings insert error:', error)
  }

  return await getMeetingsBySprintId(projectId, sprintId)
}

export async function createMeeting(projectId, { sprintId, title }) {
  const id = crypto.randomUUID()
  const { data, error } = await supabase
    .from('meetings')
    .insert({
      id,
      project_id: projectId,
      sprint_id: sprintId,
      type: 'custom',
      title: title || '새 회의',
      content: '',
    })
    .select()
    .single()
  if (error) { console.error('createMeeting error:', error); return null }
  return mapRow(data)
}

export async function updateMeeting(projectId, meetingId, { title, content }) {
  const updates = { updated_at: new Date().toISOString() }
  if (title !== undefined) updates.title = title
  if (content !== undefined) updates.content = content
  const { data, error } = await supabase
    .from('meetings')
    .update(updates)
    .eq('id', meetingId)
    .select()
    .single()
  if (error) { console.error('updateMeeting error:', error); return null }
  return mapRow(data)
}

export async function deleteMeeting(projectId, meetingId) {
  await supabase.from('meetings').delete().eq('id', meetingId)
}
