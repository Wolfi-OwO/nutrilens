const STORAGE_KEY = 'consent.analytics';

export type AnalyticsConsent = true | false | null;

/** `null` means "not yet decided" — distinct from an explicit reject. */
export function getAnalyticsConsent(): AnalyticsConsent {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return null;
}

export function setAnalyticsConsent(consent: boolean): void {
    window.localStorage.setItem(STORAGE_KEY, String(consent));
}

/**
 * Gate for any future analytics/tracking script. No such script exists yet
 * (see PRIVACY.md) — this exists so the first one added has a decision to
 * check instead of loading unconditionally.
 */
export function hasAnalyticsConsent(): boolean {
    return getAnalyticsConsent() === true;
}
