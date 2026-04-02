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

export async function getMeetings(projectId) {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at')
  if (error) { console.error('getMeetings error:', error); return [] }
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
