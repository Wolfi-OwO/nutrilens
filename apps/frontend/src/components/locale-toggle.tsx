import { Languages } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useLocale } from '@/i18n/locale-context';

// Two locales, so this is a toggle rather than a menu — a <select> for a binary
// choice is a control the user has to open before they can see what it does.
//
// The visible code is the language it switches TO, not the one that is active:
// the active language is already legible from every other word on screen, so
// repeating it would make the button say one thing and do another. The
// accessible name spells the action out ("Switch to Deutsch") so it never rests
// on a two-letter abbreviation.
//
// Sized to ThemeToggle's h-11 so the header controls line up, and kept to
// icon + two characters so the mobile header still fits at 390px with the admin
// shield present (measured — see the layout note in the #219 report).
export function LocaleToggle({ className }: { className?: string }) {
    const { locale, setLocale } = useLocale();
    const intl = useIntl();

    const next = locale === 'de' ? 'en' : 'de';
    const label = intl.formatMessage(
        { id: 'locale.switchTo' },
        { language: intl.formatMessage({ id: `locale.${next}` }) },
    );

    return (
        <button
            type="button"
            onClick={() => setLocale(next)}
            aria-label={label}
            title={label}
            className={`flex h-11 items-center gap-1.5 rounded-md px-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none ${className ?? ''}`}
        >
            <Languages size={18} strokeWidth={2} aria-hidden="true" />
            {/* aria-hidden: the accessible name above already says the whole
                thing, and letting a screen reader also read "DE" would announce
                the control twice, once as an abbreviation. */}
            <span aria-hidden="true" className="text-xs font-semibold tracking-wide uppercase">
                {next}
            </span>
        </button>
    );
}
