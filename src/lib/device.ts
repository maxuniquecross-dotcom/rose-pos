const KEY = 'rose-pos:device'

export function deviceId() {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored && stored.length >= 8) return stored
    const next = crypto.randomUUID()
    localStorage.setItem(KEY, next)
    return next
  } catch {
    return `session-${crypto.randomUUID()}`
  }
}
