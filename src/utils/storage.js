const STORAGE_KEYS = {
  PROJECTS: 'wbs_projects',
  MEMBERS: 'wbs_members',
  TASKS: 'wbs_tasks',
}

export function loadProjects() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PROJECTS)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveProjects(projects) {
  localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects))
}

export function loadMembers(projectId) {
  try {
    const data = localStorage.getItem(`${STORAGE_KEYS.MEMBERS}_${projectId}`)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveMembers(projectId, members) {
  localStorage.setItem(`${STORAGE_KEYS.MEMBERS}_${projectId}`, JSON.stringify(members))
}

export function loadTasks(projectId) {
  try {
    const data = localStorage.getItem(`${STORAGE_KEYS.TASKS}_${projectId}`)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveTasks(projectId, tasks) {
  localStorage.setItem(`${STORAGE_KEYS.TASKS}_${projectId}`, JSON.stringify(tasks))
}

export function deleteProjectData(projectId) {
  localStorage.removeItem(`${STORAGE_KEYS.MEMBERS}_${projectId}`)
  localStorage.removeItem(`${STORAGE_KEYS.TASKS}_${projectId}`)
}
