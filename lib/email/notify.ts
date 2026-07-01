// Fire-and-forget email notification trigger.
// Errors are logged to the browser console — check Vercel function logs for server-side errors.
export async function notify(type: string, to: string | string[], data: Record<string, any> = {}) {
  if (!to || (Array.isArray(to) && to.length === 0)) {
    console.warn('[notify] Skipped — no recipient for type:', type)
    return
  }

  const recipient = Array.isArray(to) ? to[0] : to
  if (!recipient || !recipient.includes('@')) {
    console.warn('[notify] Skipped — invalid recipient:', recipient, 'for type:', type)
    return
  }

  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, to, data }),
    })
    const result = await res.json()
    if (!res.ok) {
      console.error('[notify] Failed to send:', type, 'to:', to, '— error:', result.error)
    } else {
      console.log('[notify] Sent:', type, 'to:', to)
    }
  } catch (err) {
    console.error('[notify] Network error sending:', type, err)
  }
}
