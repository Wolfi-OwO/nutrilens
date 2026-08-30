import { Camera, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';
import { LegalPage, LegalSection } from '@/components/layout/legal-page';

// BILINGUAL, unlike the Impressum/Datenschutz/AGB/Datenquellen quartet.
//
// Those four are German-language legal instruments for an Austrian audience
// (ECG/DSGVO/MedienG), and PRIVACY.md:3 records that the in-app German page is
// the one that governs — so they pass contentLang="de" to LegalPage and stay
// German in both locales. This page is product copy: nothing on it binds
// anyone, an English-speaking visitor is exactly who it is for, and leaving it
// English-only while the rest of the app speaks German would make the one page
// that explains the product the one page a German user cannot read. It borrows
// LegalPage only for its logged-out shell, not for its legal semantics.
const HIGHLIGHTS = [
    { icon: Camera, id: 'photo' },
    { icon: Target, id: 'plan' },
    { icon: Sparkles, id: 'database' },
    { icon: ShieldCheck, id: 'privacy' },
] as const;

// --primary on --background is 4.36:1, under the 4.5:1 AA floor for text this
// size; --primary-strong is 6.30:1 there (measured values in index.css). Same
// substitution the legal pages carry.
const LINK_CLASS = 'font-medium text-primary-strong hover:underline';

export default function AboutPage() {
    const intl = useIntl();

    return (
        <LegalPage
            title={intl.formatMessage({ id: 'about.title' })}
            updated="2026-08-16"
            lede={intl.formatMessage({ id: 'about.lede' })}
        >
            <div className="grid gap-6 sm:grid-cols-2">
                {HIGHLIGHTS.map(({ icon: Icon, id }) => (
                    <div key={id} className="rounded-lg border border-border bg-card p-5">
                        <Icon size={20} strokeWidth={2} className="text-accent" />
                        <h2 className="mt-3 font-display text-base font-semibold tracking-tight text-foreground">
                            <FormattedMessage id={`about.${id}.title`} />
                        </h2>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                            <FormattedMessage id={`about.${id}.body`} />
                        </p>
                    </div>
                ))}
            </div>

            <LegalSection
                id="operator"
                heading={intl.formatMessage({ id: 'about.operator.heading' })}
            >
                <p>
                    <FormattedMessage
                        id="about.operator.body"
                        values={{
                            impressum: (chunks) => (
                                <a href="/impressum" className={LINK_CLASS}>
                                    {chunks}
                                </a>
                            ),
                            privacy: (chunks) => (
                                <a href="/datenschutz" className={LINK_CLASS}>
                                    {chunks}
                                </a>
                            ),
                        }}
                    />
                </p>
            </LegalSection>

            <LegalSection id="limits" heading={intl.formatMessage({ id: 'about.limits.heading' })}>
                <p>
                    <FormattedMessage
                        id="about.limits.body"
                        values={{
                            terms: (chunks) => (
                                <a href="/agb" className={LINK_CLASS}>
                                    {chunks}
                                </a>
                            ),
                        }}
                    />
                </p>
            </LegalSection>
        </LegalPage>
    );
}
