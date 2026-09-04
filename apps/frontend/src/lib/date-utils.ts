/** Local-timezone YYYY-MM-DD, so "today" matches what the user's clock says, not UTC. */
export function localDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${String(year)}-${month}-${day}`;
}

export function isToday(isoDateString: string): boolean {
    return localDateKey(new Date(isoDateString)) === localDateKey(new Date());
}

/**
 * Consecutive days (including today, if present) with at least one entry in
 * `dateKeys` — walks backward from today until a gap is found. `apps/api`
 * has no streak concept of its own; this is derived client-side from
 * whatever log dates are actually there.
 */
export function computeStreak(dateKeys: Iterable<string>): number {
    const days = new Set(dateKeys);
    let streak = 0;
    const cursor = new Date();
    while (days.has(localDateKey(cursor))) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
}

/**
 * The last `n` date keys, oldest first — today through `n - 1` days back.
 * Both the dashboard week sparkline and the progress trends page build a
 * zero-filled window from this so gap days render as 0, not as missing bars.
 */
export function lastNDays(n: number): string[] {
    const days: string[] = [];
    const cursor = new Date();
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(cursor);
        d.setDate(cursor.getDate() - i);
        days.push(localDateKey(d));
    }
    return days;
}

/**
 * "2026-08-15" → "Aug 15" in English, "15. Aug." in German.
 *
 * `locale` is passed in rather than left `undefined` (the browser default),
 * because the app's language is a stored choice that need not match the
 * browser's: a de-AT browser switched to English rendered German chart ticks
 * next to English axis labels. Callers pass `useIntl().locale`.
 */
export function formatShortDate(dateKey: string, locale: string): string {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
    });
}
