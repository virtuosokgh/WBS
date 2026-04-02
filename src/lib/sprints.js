// Sprint Supabase persistence layer
import { supabase } from './supabase'

function mapRow(row) {
  if (!row) return null
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    number: row.number,
    description: row.description || '',
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    taskIds: row.task_ids || [],
    completedAt: row.completed_at,
    createdAt: row.created_at,
  }
}

export async function getSprints(projectId) {
  const { data, error } = await supabase
    .from('sprints')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at')
  if (error) { console.error('getSprints error:', error); return [] }
  return (data || []).map(mapRow)
}

export async function getActiveSprint(projectId) {
  const sprints = await getSprints(projectId)
  return sprints.find(s => s.status === 'active') || null
}

export async function createSprint(projectId, { name, description, startDate, endDate }) {
  // 번호 계산
  const existing = await getSprints(projectId)
  const number = existing.length === 0 ? 1 : Math.max(...existing.map(s => s.number)) + 1

  const id = crypto.randomUUID()
  const { data, error } = await supabase
    .from('sprints')
    .insert({
      id,
      project_id: projectId,
      name: name || `스프린트 ${number}`,
      number,
      description: description || '',
      start_date: startDate || null,
      end_date: endDate || null,
      status: 'active',
      task_ids: [],
    })
    .select()
    .single()
  if (error) { console.error('createSprint error:', error); return null }
  return mapRow(data)
}

export async function completeSprint(projectId, sprintId) {
  const { data, error } = await supabase
    .from('sprints')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', sprintId)
    .select()
    .single()
  if (error) { console.error('completeSprint error:', error); return null }
  return mapRow(data)
}

export async function addTaskToSprint(projectId, sprintId, taskId) {
  const { data: sprint } = await supabase
    .from('sprints')
    .select('task_ids')
    .eq('id', sprintId)
    .single()
  if (!sprint) return
  const taskIds = sprint.task_ids || []
  if (taskIds.includes(taskId)) return
  await supabase
    .from('sprints')
    .update({ task_ids: [...taskIds, taskId] })
    .eq('id', sprintId)
}

export async function removeTaskFromSprint(projectId, sprintId, taskId) {
  const { data: sprint } = await supabase
    .from('sprints')
    .select('task_ids')
    .eq('id', sprintId)
    .single()
  if (!sprint) return
  await supabase
    .from('sprints')
    .update({ task_ids: (sprint.task_ids || []).filter(id => id !== taskId) })
    .eq('id', sprintId)
}

export async function updateSprint(projectId, sprintId, { name, startDate, endDate, description }) {
  const updates = {}
  if (name !== undefined) updates.name = name
  if (startDate !== undefined) updates.start_date = startDate || null
  if (endDate !== undefined) updates.end_date = endDate || null
  if (description !== undefined) updates.description = description
  await supabase.from('sprints').update(updates).eq('id', sprintId)
}

export async function updateSprintDescription(projectId, sprintId, description) {
  await supabase.from('sprints').update({ description }).eq('id', sprintId)
}

export async function updateSprintTaskIds(projectId, sprintId, taskIds) {
  await supabase.from('sprints').update({ task_ids: taskIds }).eq('id', sprintId)
}
