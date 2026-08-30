import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { IntlProvider } from 'react-intl';
import deMessages from './messages/de';
import enMessages from './messages/en';

// Mirrors portfolio-webpage's application/client/src/i18n/LocaleContext.jsx:
// one provider owning both the React context and react-intl's IntlProvider, a
// localStorage-backed choice, and `document.documentElement.lang` kept in step
// with it. Differences from that file, and why:
//
//   - Storage key is namespaced (`nutrilens.locale`), matching this app's other
//     keys — nutrilens.token, nutrilens.water, nutrilens.shop, nutrilens.theme.
//   - The default comes from navigator.language rather than being hardcoded to
//     'en': the operator and the first users are Austrian, so a de-AT browser
//     must land on German without touching a switch.
//   - Both catalogues are real files (see messages/en.ts) instead of English
//     living inline as defaultMessage.

const SUPPORTED_LOCALES = ['en', 'de'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

const DEFAULT_LOCALE: Locale = 'en';
const STORAGE_KEY = 'nutrilens.locale';

const MESSAGES: Record<Locale, Record<string, string>> = {
    en: enMessages,
    de: deMessages,
};

function isSupported(value: string | null): value is Locale {
    return value !== null && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * The stored choice if there is one, otherwise the browser's own preference.
 *
 * Matched on the PRIMARY SUBTAG, not the full tag: an Austrian browser reports
 * `de-AT`, which is not in SUPPORTED_LOCALES and would have fallen through to
 * English on an exact match. `navigator.languages` is walked in order so a
 * browser configured as [de-AT, en-US] gets German, not whichever of the two
 * this file happens to test first.
 */
function resolveLocale(): Locale {
    if (typeof window === 'undefined') return DEFAULT_LOCALE;
    let stored: string | null = null;
    try {
        stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
        // Private-browsing quota or a blocked storage partition: fall through to
        // the browser preference rather than failing to render.
    }
    if (isSupported(stored)) return stored;

    const preferences = navigator.languages.length > 0 ? navigator.languages : [navigator.language];
    for (const tag of preferences) {
        const primary = tag.toLowerCase().split('-')[0];
        if (isSupported(primary)) return primary;
    }
    return DEFAULT_LOCALE;
}

interface LocaleContextValue {
    locale: Locale;
    setLocale: (next: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function LocaleProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>(resolveLocale);

    // useEffect, not useLayoutEffect: index.html ships lang="en" and main.tsx
    // corrects it before render (see the applyDocumentLocale call there), so by
    // the time this runs the attribute is already right on first paint. This
    // only has to catch LATER changes — the switcher.
    useEffect(() => {
        applyDocumentLocale(locale);
        try {
            window.localStorage.setItem(STORAGE_KEY, locale);
        } catch {
            // A forgotten preference is not worth failing a render over.
        }
    }, [locale]);

    const value = useMemo<LocaleContextValue>(
        () => ({ locale, setLocale: setLocaleState }),
        [locale],
    );

    return (
        <LocaleContext.Provider value={value}>
            <IntlProvider locale={locale} defaultLocale={DEFAULT_LOCALE} messages={MESSAGES[locale]}>
                {children}
            </IntlProvider>
        </LocaleContext.Provider>
    );
}

/**
 * Puts the active locale on `<html lang>`.
 *
 * This is not cosmetic: `index.html` is a static file that can only carry one
 * value, and a screen reader voicing German copy with English phonemes is
 * worse than an untranslated UI. Called once in main.tsx before render, then
 * again by the provider on every change — one function, so the two paths
 * cannot drift.
 */
function applyDocumentLocale(locale: Locale): void {
    document.documentElement.lang = locale;
}

function useLocale(): LocaleContextValue {
    const context = useContext(LocaleContext);
    if (!context) throw new Error('useLocale must be used within a LocaleProvider');
    return context;
}

// One export statement rather than an `export` on each declaration: the rule
// below fires per exported non-component, and this file is deliberately the
// provider plus the three helpers that drive it — same shape, and same
// suppression, as portfolio-webpage's own LocaleContext.jsx.
// eslint-disable-next-line react-refresh/only-export-components -- provider + hook + their constants belong together
export { LocaleProvider, useLocale, resolveLocale, applyDocumentLocale, SUPPORTED_LOCALES };
export type { Locale };
