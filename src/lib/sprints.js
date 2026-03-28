// Sprint localStorage persistence layer
// Keyed by projectId: `sprints_${projectId}`

import { generateId } from '../utils/helpers'

function getStorageKey(projectId) {
  return `sprints_${projectId}`
}

export function getSprints(projectId) {
  try {
    const raw = localStorage.getItem(getStorageKey(projectId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveSprints(projectId, sprints) {
  localStorage.setItem(getStorageKey(projectId), JSON.stringify(sprints))
}

export function getActiveSprint(projectId) {
  return getSprints(projectId).find(s => s.status === 'active') || null
}

export function getNextSprintNumber(projectId) {
  const sprints = getSprints(projectId)
  if (sprints.length === 0) return 1
  return Math.max(...sprints.map(s => s.number)) + 1
}

export function createSprint(projectId, { name, description, startDate, endDate }) {
  const sprints = getSprints(projectId)
  const number = getNextSprintNumber(projectId)
  const sprint = {
    id: generateId(),
    projectId,
    name: name || `스프린트 ${number}`,
    number,
    description: description || '',
    startDate,
    endDate,
    status: 'active',
    taskIds: [],
    createdAt: Date.now(),
  }
  sprints.push(sprint)
  saveSprints(projectId, sprints)
  return sprint
}

export function completeSprint(projectId, sprintId, carryOverTaskIds = []) {
  const sprints = getSprints(projectId)
  const idx = sprints.findIndex(s => s.id === sprintId)
  if (idx === -1) return null
  sprints[idx] = {
    ...sprints[idx],
    status: 'completed',
    completedAt: Date.now(),
  }
  saveSprints(projectId, sprints)
  return { completedSprint: sprints[idx], carryOverTaskIds }
}

export function addTaskToSprint(projectId, sprintId, taskId) {
  const sprints = getSprints(projectId)
  const idx = sprints.findIndex(s => s.id === sprintId)
  if (idx === -1) return
  if (!sprints[idx].taskIds.includes(taskId)) {
    sprints[idx].taskIds.push(taskId)
    saveSprints(projectId, sprints)
  }
}

export function removeTaskFromSprint(projectId, sprintId, taskId) {
  const sprints = getSprints(projectId)
  const idx = sprints.findIndex(s => s.id === sprintId)
  if (idx === -1) return
  sprints[idx].taskIds = sprints[idx].taskIds.filter(id => id !== taskId)
  saveSprints(projectId, sprints)
}

export function updateSprint(projectId, sprintId, { name, startDate, endDate, description }) {
  const sprints = getSprints(projectId)
  const idx = sprints.findIndex(s => s.id === sprintId)
  if (idx === -1) return
  if (name !== undefined) sprints[idx].name = name
  if (startDate !== undefined) sprints[idx].startDate = startDate
  if (endDate !== undefined) sprints[idx].endDate = endDate
  if (description !== undefined) sprints[idx].description = description
  saveSprints(projectId, sprints)
}

export function updateSprintDescription(projectId, sprintId, description) {
  const sprints = getSprints(projectId)
  const idx = sprints.findIndex(s => s.id === sprintId)
  if (idx === -1) return
  sprints[idx].description = description
  saveSprints(projectId, sprints)
}

export function updateSprintTaskIds(projectId, sprintId, taskIds) {
  const sprints = getSprints(projectId)
  const idx = sprints.findIndex(s => s.id === sprintId)
  if (idx === -1) return
  sprints[idx].taskIds = taskIds
  saveSprints(projectId, sprints)
}
