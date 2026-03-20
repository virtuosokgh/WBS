import { supabase } from './supabase'

// ─── PROFILE ───────────────────────────────────────────────
export async function getProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data
}

// ─── PROJECTS ──────────────────────────────────────────────
export async function getProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
  if (error || !data?.length) return { data: [], error }

  // 소유자 프로필 별도 조회 (auth.users 직접 조인 불가)
  const ownerIds = [...new Set(data.map(p => p.owner_id))]
  const { data: profiles } = await supabase
    .from('profiles').select('id, name, email').in('id', ownerIds)
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
  return { data: data.map(p => ({ ...p, owner: profileMap[p.owner_id] || null })), error: null }
}

export async function createProject({ name, description, startDate, endDate, ownerId }) {
  // RETURNING 대신 클라이언트에서 UUID 생성하여 순환 RLS 회피
  const id = crypto.randomUUID()
  const created_at = new Date().toISOString()
  const { error } = await supabase
    .from('projects')
    .insert({ id, name, description, start_date: startDate || null, end_date: endDate || null, owner_id: ownerId })
  if (error) return { data: null, error }
  return { data: { id, name, description, start_date: startDate || null, end_date: endDate || null, owner_id: ownerId, created_at }, error: null }
}

export async function updateProject(id, { name, description, startDate, endDate }) {
  const { error } = await supabase
    .from('projects')
    .update({ name, description, start_date: startDate || null, end_date: endDate || null })
    .eq('id', id)
  if (error) return { data: null, error }
  return { data: { id, name, description, start_date: startDate || null, end_date: endDate || null }, error: null }
}

export async function deleteProject(id) {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  return { error }
}

// ─── PROJECT INVITATIONS ────────────────────────────────────
export async function getPendingInvitations(userId) {
  const { data, error } = await supabase
    .from('project_members')
    .select('id, project_id, invited_by, status, created_at')
    .eq('user_id', userId)
    .eq('status', 'pending')
  if (error || !data?.length) return { data: [], error }

  const projectIds = data.map(d => d.project_id)
  const inviterIds = data.filter(d => d.invited_by).map(d => d.invited_by)

  const [{ data: projects }, { data: inviters }] = await Promise.all([
    supabase.from('projects').select('id, name, description, start_date, end_date').in('id', projectIds),
    supabase.from('profiles').select('id, name, email').in('id', inviterIds),
  ])
  const projectMap = Object.fromEntries((projects || []).map(p => [p.id, p]))
  const inviterMap = Object.fromEntries((inviters || []).map(p => [p.id, p]))
  return {
    data: data.map(d => ({ ...d, project: projectMap[d.project_id] || null, inviter: inviterMap[d.invited_by] || null })),
    error: null,
  }
}

export async function acceptInvitation(projectId, userId) {
  const { error } = await supabase
    .from('project_members')
    .update({ status: 'accepted' })
    .eq('project_id', projectId)
    .eq('user_id', userId)
  return { error }
}

export async function declineInvitation(projectId, userId) {
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId)
  return { error }
}

export async function getProjectMembers(projectId) {
  const { data, error } = await supabase
    .from('project_members')
    .select('id, user_id, role, status, invited_by, created_at')
    .eq('project_id', projectId)
    .eq('status', 'accepted')
  if (error || !data?.length) return { data: [], error }

  const userIds = data.map(d => d.user_id)
  const { data: profiles } = await supabase.from('profiles').select('id, name, email').in('id', userIds)
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
  return { data: data.map(d => ({ ...d, user: profileMap[d.user_id] || null })), error: null }
}

export async function inviteUserToProject(projectId, userId, invitedBy, role = '멤버') {
  const { error } = await supabase
    .from('project_members')
    .insert({ project_id: projectId, user_id: userId, invited_by: invitedBy, status: 'pending', role })
  return { error }
}

export async function updateMemberRole(projectId, userId, role) {
  const { error } = await supabase
    .from('project_members')
    .update({ role })
    .eq('project_id', projectId)
    .eq('user_id', userId)
  return { error }
}

export async function getUserProjectRole(projectId, userId) {
  const { data } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .maybeSingle()
  return data?.role || '멤버'
}

export async function getParticipatingProjects(userId) {
  // 내가 초대받아 수락한 프로젝트 (owner가 아닌 것)
  const { data: memberships, error } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId)
    .eq('status', 'accepted')
  if (error || !memberships?.length) return { data: [], error }

  const projectIds = memberships.map(m => m.project_id)
  const { data, error: pErr } = await supabase
    .from('projects')
    .select('*')
    .in('id', projectIds)
    .order('created_at', { ascending: false })
  return { data: data || [], error: pErr }
}

export async function removeProjectMember(projectId, userId) {
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId)
  return { error }
}

// ─── PROJECT PARTICIPANTS (WBS 담당자용 정규화) ────────────
export async function getProjectParticipants(projectId) {
  const [projectResult, membersResult] = await Promise.all([
    supabase.from('projects').select('id, owner_id').eq('id', projectId).single(),
    supabase.from('project_members').select('user_id, role').eq('project_id', projectId).eq('status', 'accepted'),
  ])

  const ownerId = projectResult.data?.owner_id
  const memberRows = membersResult.data || []
  const userIds = [...new Set([ownerId, ...memberRows.map(m => m.user_id)].filter(Boolean))]
  if (userIds.length === 0) return { data: [], error: null }

  const { data: profiles } = await supabase.from('profiles').select('id, name, email').in('id', userIds)
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

  const participants = []
  // 소유자 먼저
  if (ownerId && profileMap[ownerId]) {
    const ownerRole = memberRows.find(m => m.user_id === ownerId)?.role
    participants.push({ id: ownerId, name: profileMap[ownerId].name || '알 수 없음', role: ownerRole || 'PM', email: profileMap[ownerId].email || '' })
  }
  // 나머지 멤버
  memberRows.forEach(m => {
    if (m.user_id === ownerId) return
    const profile = profileMap[m.user_id]
    if (profile) participants.push({ id: m.user_id, name: profile.name || '알 수 없음', role: m.role || null, email: profile.email || '' })
  })
  return { data: participants, error: null }
}

// ─── TEAM MEMBERS (WBS 담당자) ─────────────────────────────
export async function getTeamMembers(projectId) {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at')
  return { data: data || [], error }
}

export async function addTeamMember(projectId, { name, role, email }) {
  const id = crypto.randomUUID()
  const { error } = await supabase
    .from('team_members')
    .insert({ id, project_id: projectId, name, role, email: email || '' })
  if (error) return { data: null, error }
  return { data: { id, project_id: projectId, name, role, email: email || '' }, error: null }
}

export async function updateTeamMember(id, { name, role, email }) {
  const { error } = await supabase
    .from('team_members')
    .update({ name, role, email: email || '' })
    .eq('id', id)
  if (error) return { data: null, error }
  return { data: { id, name, role, email: email || '' }, error: null }
}

export async function deleteTeamMember(id) {
  const { error } = await supabase.from('team_members').delete().eq('id', id)
  return { error }
}

// ─── TASKS ─────────────────────────────────────────────────
export async function getTasks(projectId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at')
  return { data: data || [], error }
}

export async function createTask(projectId, task) {
  const id = crypto.randomUUID()
  const row = {
    id,
    project_id: projectId,
    parent_id: task.parentId || null,
    name: task.name,
    description: task.description || '',
    assignee_id: task.assigneeId || null,
    status: task.status || 'todo',
    priority: task.priority || 'medium',
    start_date: task.startDate || null,
    end_date: task.endDate || null,
    note: task.note || '',
    jira_url: task.jiraUrl || '',
    deliverable_url: task.deliverableUrl || '',
    deliverable_image: task.deliverableImage || '',
    screen_ref: task.screenRef || '',
    screen_name: task.screenName || '',
  }
  const { error } = await supabase.from('tasks').insert(row)
  if (error) return { data: null, error }
  return { data: row, error: null }
}

export async function updateTask(id, task) {
  const updates = {
    name: task.name,
    description: task.description || '',
    assignee_id: task.assigneeId || null,
    status: task.status,
    priority: task.priority,
    start_date: task.startDate || null,
    end_date: task.endDate || null,
    note: task.note || '',
  }
  const { error } = await supabase.from('tasks').update(updates).eq('id', id)
  if (error) return { data: null, error }
  return { data: { id, ...updates }, error: null }
}

export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  return { error }
}

export async function updateTaskLinks(id, updates) {
  const row = {}
  if ('jira_url' in updates) row.jira_url = updates.jira_url
  if ('deliverable_url' in updates) row.deliverable_url = updates.deliverable_url
  if ('deliverable_image' in updates) row.deliverable_image = updates.deliverable_image
  if ('screen_ref' in updates) row.screen_ref = updates.screen_ref
  if ('screen_name' in updates) row.screen_name = updates.screen_name
  const { error } = await supabase.from('tasks').update(row).eq('id', id)
  return { error }
}

export async function updateTaskStatus(id, status) {
  const { error } = await supabase.from('tasks').update({ status }).eq('id', id)
  return { error }
}

// ─── STORYBOARD ────────────────────────────────────────────
export async function getStoryboard(projectId) {
  const { data, error } = await supabase
    .from('storyboards')
    .select('screens, flowchart')
    .eq('project_id', projectId)
    .maybeSingle()
  return { data, error }
}

export async function upsertStoryboard(projectId, screens, flowchart) {
  const payload = { project_id: projectId, updated_at: new Date().toISOString() }
  if (screens !== undefined) payload.screens = screens
  if (flowchart !== undefined) payload.flowchart = flowchart

  // Try update first, then insert if not exists
  const { data: existing } = await supabase
    .from('storyboards').select('project_id').eq('project_id', projectId).maybeSingle()

  if (existing) {
    const { error } = await supabase.from('storyboards').update(payload).eq('project_id', projectId)
    return { error }
  } else {
    const { error } = await supabase.from('storyboards').insert({ ...payload, screens: screens ?? [], flowchart: flowchart ?? {} })
    return { error }
  }
}

// ─── FRIENDS ───────────────────────────────────────────────
export async function getFriends(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq('status', 'accepted')

  if (error || !data) return { data: [], error }

  // 상대방 ID 수집 후 프로필 조회
  const otherIds = data.map(f => f.requester_id === userId ? f.addressee_id : f.requester_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, email')
    .in('id', otherIds)

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
  const friends = data.map(f => {
    const otherId = f.requester_id === userId ? f.addressee_id : f.requester_id
    return { friendshipId: f.id, ...(profileMap[otherId] || { id: otherId, name: '알 수 없음', email: '' }) }
  })
  return { data: friends, error: null }
}

export async function getPendingReceived(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('id, status, requester_id, created_at')
    .eq('addressee_id', userId)
    .eq('status', 'pending')

  if (error || !data) return { data: [], error }

  // 요청자 프로필 별도 조회
  const requesterIds = data.map(d => d.requester_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, email')
    .in('id', requesterIds)

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
  const merged = data.map(d => ({ ...d, requester: profileMap[d.requester_id] || null }))
  return { data: merged, error: null }
}

export async function getPendingSent(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('id, status, addressee_id, created_at')
    .eq('requester_id', userId)
    .eq('status', 'pending')

  if (error || !data) return { data: [], error }

  const addresseeIds = data.map(d => d.addressee_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, email')
    .in('id', addresseeIds)

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
  const merged = data.map(d => ({ ...d, addressee: profileMap[d.addressee_id] || null }))
  return { data: merged, error: null }
}

export async function sendFriendRequest(myId, email) {
  // 1. 이메일로 상대방 프로필 조회
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('id, name, email')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()

  if (pErr) return { error: { message: `조회 오류: ${pErr.message}` } }
  if (!profile) return { error: { message: '해당 이메일로 가입된 사용자를 찾을 수 없습니다.' } }
  if (profile.id === myId) return { error: { message: '자기 자신에게는 친구 요청을 보낼 수 없습니다.' } }

  // 2. 이미 친구이거나 요청 중인지 확인
  const { data: existing } = await supabase
    .from('friendships')
    .select('id, status')
    .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`)
    .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
    .maybeSingle()

  if (existing?.status === 'accepted') return { error: { message: '이미 친구입니다.' } }
  if (existing?.status === 'pending') return { error: { message: '이미 친구 요청 중입니다.' } }

  // 3. 친구 요청 INSERT (select 없이 - RLS select 정책 우회)
  const { error: insertError } = await supabase
    .from('friendships')
    .insert({ requester_id: myId, addressee_id: profile.id })

  if (insertError) return { error: { message: `요청 실패: ${insertError.message}` } }

  return { error: null, profile }
}

export async function acceptFriendRequest(friendshipId) {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId)
  return { error }
}

export async function declineFriendRequest(friendshipId) {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
  return { error }
}

export async function removeFriend(friendshipId) {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
  return { error }
}
