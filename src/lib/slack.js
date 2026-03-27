// Slack Incoming Webhook integration
// Webhook URL is stored per-project in localStorage

const STORAGE_PREFIX = 'slack_webhook_'

export function getSlackWebhookUrl(projectId) {
  // Try per-project key first, fall back to legacy global key
  return localStorage.getItem(`${STORAGE_PREFIX}${projectId}`)
    || localStorage.getItem('slack_webhook_url')
    || ''
}

export function setSlackWebhookUrl(projectId, url) {
  const key = `${STORAGE_PREFIX}${projectId}`
  if (url) {
    localStorage.setItem(key, url.trim())
  } else {
    localStorage.removeItem(key)
  }
}

export async function sendSlackNotification(projectId, message) {
  const webhookUrl = getSlackWebhookUrl(projectId)
  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    })
  } catch (err) {
    console.warn('Slack notification failed:', err)
  }
}

export function notifyStatusChange(projectId, { taskName, oldStatus, newStatus, changedBy }) {
  const msg = `📋 *상태 변경* | \`${taskName}\`\n${oldStatus} → *${newStatus}*${changedBy ? `\n변경자: ${changedBy}` : ''}`
  sendSlackNotification(projectId, msg)
}

export function notifyAssigneeChange(projectId, { taskName, oldAssignee, newAssignee, changedBy }) {
  const msg = `👤 *담당자 변경* | \`${taskName}\`\n${oldAssignee || '미배정'} → *${newAssignee || '미배정'}*${changedBy ? `\n변경자: ${changedBy}` : ''}`
  sendSlackNotification(projectId, msg)
}

export function notifyTaskCreated(projectId, { taskName, assignee, changedBy }) {
  const msg = `✅ *새 작업* | \`${taskName}\`${assignee ? `\n담당자: ${assignee}` : ''}${changedBy ? `\n생성자: ${changedBy}` : ''}`
  sendSlackNotification(projectId, msg)
}

export function notifyComment(projectId, { taskName, comment, author }) {
  const plain = comment.replace(/<[^>]*>/g, '').slice(0, 100)
  const msg = `💬 *댓글* | \`${taskName}\`\n${author}: ${plain}${comment.replace(/<[^>]*>/g, '').length > 100 ? '...' : ''}`
  sendSlackNotification(projectId, msg)
}
