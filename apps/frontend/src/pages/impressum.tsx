import { LegalPage, LegalSection } from '@/components/layout/legal-page';

// Single source of truth for every fact this page needs. Values below match
// the operator's own portfolio site (privacy-policy-page.jsx), which already
// carries the same § 5 ECG / § 25 MedienG block for the same person — city-
// level address only, no UID/Firmenbuchnummer, no phone number, because none
// of those exist for this project. Do not invent them.
//
// TODO_STREET_ADDRESS: § 5 Abs 1 Z 1 ECG technically wants a full geographic
// address (street, house number, postal code, city, country) capable of
// receiving service of process — a city name alone is a known gap, carried
// over unchanged from the portfolio site's own Impressum. Fill in the street
// and house number here in one edit once the operator decides whether to
// publish it; do not guess it in the meantime.
export const IMPRESSUM = {
    name: 'Phillip Kofler',
    role: 'Software Engineer | Fullstack Developer',
    email: 'KoflerPhillip@outlook.com',
    city: 'Villach, Kärnten, Österreich',
} as const;

export default function ImpressumPage() {
    return (
        <LegalPage
            title="Impressum"
            updated="2026-08-16"
            contentLang="de"
            lede="Offenlegung gemäß § 5 E-Commerce-Gesetz (ECG) und § 25 Mediengesetz (MedienG)."
        >
            <LegalSection id="diensteanbieter" heading="Diensteanbieter">
                <p>
                    {IMPRESSUM.name}
                    <br />
                    {IMPRESSUM.role}
                    <br />
                    {IMPRESSUM.city}
                </p>
                <p>
                    Geschäftstätigkeit: Softwareentwicklung, Webentwicklung und digitale
                    Lösungen — moderne Web-Anwendungen, REST-APIs, Dashboards und
                    Cloud-basierte Systeme.
                </p>
                <p>Für den Inhalt verantwortlich: {IMPRESSUM.name}.</p>
            </LegalSection>

            <LegalSection id="kontakt" heading="Kontakt">
                <p>
                    E-Mail:{' '}
                    <a
                        href={`mailto:${IMPRESSUM.email}`}
                        className="font-medium text-primary-strong hover:underline"
                    >
                        {IMPRESSUM.email}
                    </a>
                </p>
            </LegalSection>

            <LegalSection id="zweck" heading="Zweck des Angebots">
                <p>
                    NutriLens ist eine Anwendung zur Ernährungs- und Kalorienverfolgung: Nutzer
                    protokollieren Mahlzeiten (per Foto-Erkennung, Suche oder Barcode), verwalten
                    einen Ernährungsplan und verfolgen Gewichtsverlauf und Fortschritt.
                </p>
            </LegalSection>

            <LegalSection id="streitbeilegung" heading="Streitbeilegung">
                <p>
                    Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS)
                    bereit, abrufbar unter{' '}
                    <a
                        href="https://ec.europa.eu/consumers/odr/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary-strong hover:underline"
                    >
                        ec.europa.eu/consumers/odr
                    </a>
                    . Wir sind weder verpflichtet noch bereit, an einem Streitbeilegungsverfahren
                    vor einer Verbraucherschlichtungsstelle teilzunehmen; unberührt davon bleibt das
                    Recht, sich an die Alternative-Streitbeilegungs-Stellen der Wirtschaft (WKO)
                    oder an die Rundfunk und Telekom Regulierungs-GmbH (RTR) als Schlichtungsstelle
                    für Fragen der Online-Vermittlung zu wenden.
                </p>
            </LegalSection>

            <LegalSection id="haftung" heading="Haftung für Inhalte">
                <p>
                    Die Inhalte dieser Anwendung wurden mit Sorgfalt erstellt. Für die Richtigkeit,
                    Vollständigkeit und Aktualität der Inhalte kann jedoch keine Gewähr übernommen
                    werden. Insbesondere ersetzen die in NutriLens angezeigten Nährwert- und
                    KI-Erkennungsergebnisse keine medizinische oder ernährungswissenschaftliche
                    Beratung — siehe dazu die{' '}
                    <a href="/agb" className="font-medium text-primary-strong hover:underline">
                        Allgemeinen Geschäftsbedingungen
                    </a>
                    .
                </p>
            </LegalSection>
        </LegalPage>
    );
}
