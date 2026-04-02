// One-time migration: localStorage sprints/meetings → Supabase
import { supabase } from './supabase'

const MIGRATED_KEY = 'ls_to_supabase_migrated'

export async function migrateLocalStorageToSupabase() {
  // 이미 마이그레이션 완료된 경우 스킵
  if (localStorage.getItem(MIGRATED_KEY)) return

  const keys = Object.keys(localStorage)
  const sprintKeys = keys.filter(k => k.startsWith('sprints_'))
  const meetingKeys = keys.filter(k => k.startsWith('meetings_'))

  if (sprintKeys.length === 0 && meetingKeys.length === 0) {
    localStorage.setItem(MIGRATED_KEY, Date.now().toString())
    return
  }

  console.log('[migration] localStorage → Supabase 마이그레이션 시작')

  // 스프린트 마이그레이션
  for (const key of sprintKeys) {
    try {
      const projectId = key.replace('sprints_', '')
      const sprints = JSON.parse(localStorage.getItem(key) || '[]')
      if (!sprints.length) continue

      for (const s of sprints) {
        const { error } = await supabase.from('sprints').upsert({
          id: s.id,
          project_id: projectId,
          name: s.name,
          number: s.number || 1,
          description: s.description || '',
          start_date: s.startDate || null,
          end_date: s.endDate || null,
          status: s.status || 'active',
          task_ids: s.taskIds || [],
          completed_at: s.completedAt ? new Date(s.completedAt).toISOString() : null,
          created_at: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
        }, { onConflict: 'id' })
        if (error) console.warn('[migration] sprint insert error:', s.id, error.message)
      }
      console.log(`[migration] sprints for project ${projectId}: ${sprints.length}개 마이그레이션`)
    } catch (e) {
      console.warn('[migration] sprint parse error:', key, e)
    }
  }

  // 회의록 마이그레이션
  for (const key of meetingKeys) {
    try {
      const projectId = key.replace('meetings_', '')
      const meetings = JSON.parse(localStorage.getItem(key) || '[]')
      if (!meetings.length) continue

      for (const m of meetings) {
        const { error } = await supabase.from('meetings').upsert({
          id: m.id,
          project_id: projectId,
          sprint_id: m.sprintId,
          type: m.type || 'custom',
          title: m.title || '',
          content: m.content || '',
          created_at: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
          updated_at: m.updatedAt ? new Date(m.updatedAt).toISOString() : new Date().toISOString(),
        }, { onConflict: 'id' })
        if (error) console.warn('[migration] meeting insert error:', m.id, error.message)
      }
      console.log(`[migration] meetings for project ${projectId}: ${meetings.length}개 마이그레이션`)
    } catch (e) {
      console.warn('[migration] meeting parse error:', key, e)
    }
  }

  // 마이그레이션 완료 표시
  localStorage.setItem(MIGRATED_KEY, Date.now().toString())
  console.log('[migration] 마이그레이션 완료')
}
