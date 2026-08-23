import { Link } from 'react-router';
import { LegalList, LegalPage, LegalSection } from '@/components/layout/legal-page';
import { IMPRESSUM } from '@/pages/impressum';

export default function AgbPage() {
    return (
        <LegalPage
            title="Allgemeine Geschäftsbedingungen"
            updated="2026-08-16"
            lede="Diese Bedingungen gelten für die Nutzung von NutriLens, bereitgestellt von
            Phillip Kofler."
        >
            <LegalSection id="geltungsbereich" heading="1. Geltungsbereich">
                <p>
                    Diese Allgemeinen Geschäftsbedingungen (AGB) regeln die Nutzung der Anwendung
                    NutriLens durch registrierte Benutzer. Mit der Erstellung eines Kontos erklären
                    Sie sich mit diesen Bedingungen einverstanden.
                </p>
            </LegalSection>

            <LegalSection id="leistung" heading="2. Leistungsbeschreibung">
                <p>
                    NutriLens ermöglicht das Protokollieren von Mahlzeiten (per Foto-Erkennung,
                    Suche oder Barcode), das Erstellen und Verfolgen von Ernährungsplänen sowie das
                    Aufzeichnen von Gewichtsverlauf und Fortschritt. Die Anwendung befindet sich in
                    aktiver Entwicklung; Funktionsumfang und Verfügbarkeit können sich ändern.
                </p>
            </LegalSection>

            <LegalSection id="medizinisch" heading="3. Kein medizinischer Rat">
                <div className="rounded-lg border border-border bg-muted/60 p-4">
                    <p className="font-semibold text-foreground">
                        NutriLens ist kein Medizinprodukt und ersetzt keine ärztliche,
                        ernährungsmedizinische oder sonstige fachliche Beratung.
                    </p>
                    <p className="mt-2">
                        Alle in der Anwendung angezeigten Kalorien- und Makronährstoffwerte,
                        Ernährungspläne, Gewichtsziele und KI-gestützten Erkennungsergebnisse sind
                        allgemeine, automatisiert erzeugte Orientierungswerte. Sie werden ohne
                        Kenntnis Ihrer individuellen gesundheitlichen Situation berechnet und
                        stellen keine Diagnose, Therapieempfehlung oder klinische Einschätzung dar.
                        Treffen Sie keine Entscheidungen mit gesundheitlicher Tragweite (z. B. bei
                        bestehenden Erkrankungen, Essstörungen, Schwangerschaft) allein auf
                        Grundlage der Angaben in NutriLens — konsultieren Sie dafür eine Ärztin,
                        einen Arzt oder eine qualifizierte Ernährungsfachkraft.
                    </p>
                </div>
            </LegalSection>

            <LegalSection id="ki-ergebnisse" heading="4. KI-gestützte Erkennung">
                <p>
                    Die fotobasierte Lebensmittelerkennung liefert eine automatisiert erzeugte
                    Einschätzung, die in der Anwendung entsprechend gekennzeichnet ist. Diese
                    Einschätzung kann falsch oder ungenau sein — Lebensmittel, Portionsgrößen und
                    Zubereitungsarten sind aus einem Foto nicht immer eindeutig bestimmbar. Prüfen
                    Sie jedes Erkennungsergebnis vor dem Speichern und korrigieren Sie es bei
                    Bedarf. Wir übernehmen keine Gewähr für die Richtigkeit automatisiert erkannter
                    Nährwerte.
                </p>
            </LegalSection>

            <LegalSection id="pflichten" heading="5. Pflichten der Nutzer">
                <LegalList>
                    <li>Zugangsdaten sind vertraulich zu behandeln und nicht weiterzugeben.</li>
                    <li>
                        Es dürfen nur wahrheitsgemäße Angaben zur eigenen Person gemacht werden;
                        Konten sind nicht übertragbar.
                    </li>
                    <li>
                        Die Anwendung darf nicht für rechtswidrige Zwecke oder zur Beeinträchtigung
                        des Betriebs (z. B. automatisiertes Massen-Scraping, Überlastungsangriffe)
                        genutzt werden.
                    </li>
                    <li>
                        Hochgeladene Fotos und Eingaben dürfen keine Rechte Dritter verletzen und
                        keine rechtswidrigen Inhalte enthalten.
                    </li>
                </LegalList>
            </LegalSection>

            <LegalSection id="kuendigung" heading="6. Kontobeendigung">
                <p>
                    Sie können Ihr Konto jederzeit über die Profileinstellungen löschen oder unter{' '}
                    <a
                        href={`mailto:${IMPRESSUM.email}`}
                        className="font-medium text-primary hover:underline"
                    >
                        {IMPRESSUM.email}
                    </a>{' '}
                    die Löschung beantragen. Wir behalten uns vor, Konten bei einem Verstoß gegen
                    diese AGB nach vorheriger Ankündigung — bei schwerwiegenden Verstößen auch
                    fristlos — zu sperren oder zu löschen.
                </p>
            </LegalSection>

            <LegalSection id="haftung" heading="7. Haftungsbeschränkung">
                <p>
                    Die Nutzung von NutriLens erfolgt unentgeltlich und auf eigenes Risiko. Wir
                    haften unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie nach den
                    Vorschriften des Produkthaftungsgesetzes. Im Übrigen ist die Haftung für leichte
                    Fahrlässigkeit ausgeschlossen, soweit dies gesetzlich zulässig ist. Für die
                    Richtigkeit automatisiert berechneter Nährwerte und KI-Erkennungsergebnisse wird
                    keine Gewähr übernommen (siehe Abschnitte 3 und 4).
                </p>
            </LegalSection>

            <LegalSection id="aenderungen" heading="8. Änderungen dieser Bedingungen">
                <p>
                    Wir können diese AGB anpassen, um sie an geänderte Funktionen oder rechtliche
                    Anforderungen anzupassen. Über wesentliche Änderungen informieren wir Sie in der
                    Anwendung. Die weitere Nutzung nach einer solchen Änderung gilt als Zustimmung.
                </p>
            </LegalSection>

            <LegalSection id="schluss" heading="9. Schlussbestimmungen">
                <p>
                    Es gilt österreichisches Recht unter Ausschluss der Verweisungsnormen des
                    internationalen Privatrechts und des UN-Kaufrechts. Verbraucherinnen und
                    Verbraucher behalten den Schutz zwingender Bestimmungen ihres gewöhnlichen
                    Aufenthaltsstaats. Zur Datenverarbeitung siehe die{' '}
                    <Link to="/datenschutz" className="font-medium text-primary hover:underline">
                        Datenschutzerklärung
                    </Link>
                    , zu den Anbieterangaben das{' '}
                    <Link to="/impressum" className="font-medium text-primary hover:underline">
                        Impressum
                    </Link>
                    .
                </p>
            </LegalSection>
        </LegalPage>
    );
}
