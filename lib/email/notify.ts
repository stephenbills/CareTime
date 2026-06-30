// Fire-and-forget email notification trigger.
// Call this from client components after a state-changing action.
// Errors are logged but never block the UI flow — email is a side effect, not a dependency.
export async function notify(type: string, to: string | string[], data: Record<string, any> = {}) {
  if (!to || (Array.isArray(to) && to.length === 0)) return
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, to, data }),
    })
  } catch (err) {
    console.error('Notification failed to send:', type, err)
  }
}
