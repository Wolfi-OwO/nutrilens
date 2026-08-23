import { Camera, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { LegalPage, LegalSection } from '@/components/layout/legal-page';

// English, unlike the Impressum/Datenschutz/AGB triad: those are German-
// language legal instruments for an Austrian audience (ECG/DSGVO/MedienG all
// require it), but this page is product copy, not a legal filing, so it
// follows the rest of the app's UI language instead.
const HIGHLIGHTS = [
    {
        icon: Camera,
        title: 'A photo instead of a form',
        body: "Snap a photo of your meal — AI-powered recognition estimates the food and its nutrition, you review and save.",
    },
    {
        icon: Target,
        title: 'A plan instead of guesswork',
        body: 'Diet plans with clear calorie and macro targets, tailored to your goal — lose, maintain, or gain weight.',
    },
    {
        icon: Sparkles,
        title: 'Our own food database',
        body: 'Search runs against a database we host ourselves, built on public USDA data — no search query ever leaves our infrastructure to a third-party lookup service.',
    },
    {
        icon: ShieldCheck,
        title: 'Privacy-minded photo handling',
        body: "Meal photos are stripped of location and camera metadata (EXIF/GPS) before upload, and the recognition service doesn't keep them.",
    },
] as const;

export default function AboutPage() {
    return (
        <LegalPage
            title="About NutriLens"
            updated="2026-08-16"
            lede="NutriLens is a lean nutrition and weight-tracking app — built to log meals as fast as possible, without cutting corners on accuracy or privacy."
        >
            <div className="grid gap-6 sm:grid-cols-2">
                {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
                    <div key={title} className="rounded-lg border border-border bg-card p-5">
                        <Icon size={20} strokeWidth={2} className="text-accent" />
                        <h2 className="mt-3 font-display text-base font-semibold tracking-tight text-foreground">
                            {title}
                        </h2>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                            {body}
                        </p>
                    </div>
                ))}
            </div>

            <LegalSection id="operator" heading="Who runs NutriLens">
                <p>
                    NutriLens is built and operated by Phillip Kofler as an independent project.
                    Operator details are in the{' '}
                    <a href="/impressum" className="font-medium text-primary hover:underline">
                        Impressum
                    </a>
                    , and details on data processing are in the{' '}
                    <a href="/datenschutz" className="font-medium text-primary hover:underline">
                        Datenschutzerklärung
                    </a>{' '}
                    (privacy policy).
                </p>
            </LegalSection>

            <LegalSection id="limits" heading="What NutriLens is not">
                <p>
                    NutriLens is not a medical device and does not provide nutritional or medical
                    advice — calorie and macro values, as well as AI recognition results, are
                    automatically generated estimates, not a clinical assessment. See the{' '}
                    <a href="/agb" className="font-medium text-primary hover:underline">
                        Terms
                    </a>{' '}
                    for details.
                </p>
            </LegalSection>
        </LegalPage>
    );
}
