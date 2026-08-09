/** Local-timezone YYYY-MM-DD, so "today" matches what the user's clock says, not UTC. */
export function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${String(year)}-${month}-${day}`
}

export function isToday(isoDateString: string): boolean {
  return localDateKey(new Date(isoDateString)) === localDateKey(new Date())
}

/**
 * Consecutive days (including today, if present) with at least one entry in
 * `dateKeys` — walks backward from today until a gap is found. `apps/api`
 * has no streak concept of its own; this is derived client-side from
 * whatever log dates are actually there.
 */
export function computeStreak(dateKeys: Iterable<string>): number {
  const days = new Set(dateKeys)
  let streak = 0
  const cursor = new Date()
  while (days.has(localDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}
