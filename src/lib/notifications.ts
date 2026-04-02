export type AppNotification = {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean | null
  created_at: string
}

export function formatNotificationTime(value?: string | null) {
  if (!value) return 'Just now'

  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return 'Just now'

  const diffMs = Date.now() - timestamp
  const diffMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)))

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return new Date(value).toLocaleDateString()
}

export function getNotificationBorderClass(type?: string | null) {
  switch (type) {
    case 'sale':
      return 'border-l-emerald-500'
    case 'price_drop':
      return 'border-l-rose-500'
    case 'badge':
      return 'border-l-amber-500'
    case 'message':
      return 'border-l-indigo-500'
    case 'rental_due':
      return 'border-l-blue-500'
    case 'late_fee':
      return 'border-l-rose-600'
    case 'boost':
      return 'border-l-fuchsia-500'
    case 'review':
      return 'border-l-cyan-500'
    default:
      return 'border-l-zinc-700'
  }
}

export async function dispatchNotificationAction(
  action: string,
  payload: Record<string, unknown> = {},
) {
  const response = await fetch('/api/notifications/dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Notification dispatch failed')
  }

  return response.json().catch(() => null)
}
