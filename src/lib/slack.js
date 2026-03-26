// Slack Incoming Webhook integration
// Webhook URL is stored per-project in localStorage

const STORAGE_KEY = 'slack_webhook_url'

export function getSlackWebhookUrl() {
  return localStorage.getItem(STORAGE_KEY) || ''
}

export function setSlackWebhookUrl(url) {
  if (url) {
    localStorage.setItem(STORAGE_KEY, url.trim())
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export async function sendSlackNotification(message) {
  const webhookUrl = getSlackWebhookUrl()
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

export function notifyStatusChange({ taskName, oldStatus, newStatus, changedBy }) {
  const msg = `📋 *상태 변경* | \`${taskName}\`\n${oldStatus} → *${newStatus}*${changedBy ? `\n변경자: ${changedBy}` : ''}`
  sendSlackNotification(msg)
}

export function notifyAssigneeChange({ taskName, oldAssignee, newAssignee, changedBy }) {
  const msg = `👤 *담당자 변경* | \`${taskName}\`\n${oldAssignee || '미배정'} → *${newAssignee || '미배정'}*${changedBy ? `\n변경자: ${changedBy}` : ''}`
  sendSlackNotification(msg)
}

export function notifyTaskCreated({ taskName, assignee, changedBy }) {
  const msg = `✅ *새 작업* | \`${taskName}\`${assignee ? `\n담당자: ${assignee}` : ''}${changedBy ? `\n생성자: ${changedBy}` : ''}`
  sendSlackNotification(msg)
}

export function notifyComment({ taskName, comment, author }) {
  const plain = comment.replace(/<[^>]*>/g, '').slice(0, 100)
  const msg = `💬 *댓글* | \`${taskName}\`\n${author}: ${plain}${comment.replace(/<[^>]*>/g, '').length > 100 ? '...' : ''}`
  sendSlackNotification(msg)
}
