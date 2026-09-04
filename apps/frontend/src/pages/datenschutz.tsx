import { Link } from 'react-router';
import { LegalList, LegalPage, LegalSection, Placeholder } from '@/components/layout/legal-page';
import { IMPRESSUM } from '@/pages/impressum';

export default function DatenschutzPage() {
    return (
        <LegalPage
            title="Datenschutzerklärung"
            updated="2026-08-16"
            contentLang="de"
            lede="Diese Erklärung beschreibt, welche personenbezogenen Daten NutriLens verarbeitet, wozu, auf welcher Rechtsgrundlage und welche Rechte Sie als betroffene Person haben (Art. 12–14 DSGVO)."
        >
            <LegalSection id="verantwortlicher" heading="1. Verantwortlicher">
                <p>
                    Verantwortlicher im Sinne der DSGVO ist {IMPRESSUM.name}, {IMPRESSUM.city},
                    erreichbar unter{' '}
                    <a
                        href={`mailto:${IMPRESSUM.email}`}
                        className="font-medium text-primary-strong hover:underline"
                    >
                        {IMPRESSUM.email}
                    </a>{' '}
                    (siehe auch das{' '}
                    <Link to="/impressum" className="font-medium text-primary-strong hover:underline">
                        Impressum
                    </Link>
                    ).
                </p>
            </LegalSection>

            <LegalSection id="daten" heading="2. Welche Daten wir verarbeiten">
                <p>Bei der Nutzung von NutriLens verarbeiten wir folgende Datenkategorien:</p>
                <LegalList>
                    <li>Kontodaten: E-Mail-Adresse, Anzeigename, Passwort-Hash (argon2id).</li>
                    <li>
                        Bei Anmeldung über GitHub, Google oder Microsoft: die vom jeweiligen
                        Anbieter übermittelte Konto-Identität sowie ein Profilbild. Bei GitHub und
                        Google wird dafür eine Bild-URL des Anbieters angezeigt; bei Microsoft wird
                        das Profilbild serverseitig über Microsoft Graph abgerufen und von unserem
                        eigenen Server aus ausgeliefert, sodass Ihr Browser dabei keine direkte
                        Verbindung zu Microsoft aufbaut.
                    </li>
                    <li>Ernährungspläne (Ziel, Kalorien- und Makronährstoffvorgaben).</li>
                    <li>
                        Mahlzeiten-Protokolle: erfasste Lebensmittel, Mengen, Makronährstoffe und
                        Zeitpunkt der Erfassung — inklusive der von Ihnen dabei aufgenommenen Fotos,
                        soweit Sie die Foto-Erkennung verwenden.
                    </li>
                    <li>
                        Körpergewicht-Einträge mit Zeitstempel sowie ein optionales Gewichtsziel
                        (siehe Abschnitt 4 zur gesonderten Einwilligung).
                    </li>
                    <li>
                        Bei Administrator-Konten: ein Audit-Log über administrative Aktionen (z. B.
                        Rollen- oder Statusänderungen an Benutzerkonten).
                    </li>
                </LegalList>
            </LegalSection>

            <LegalSection id="zwecke" heading="3. Zwecke und Rechtsgrundlagen">
                <p>Wir verarbeiten diese Daten für folgende Zwecke:</p>
                <LegalList>
                    <li>
                        <strong>Bereitstellung des Kontos und der Kernfunktionen</strong>{' '}
                        (Registrierung, Login, OAuth, Speichern von Plänen und Protokollen) —
                        Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
                    </li>
                    <li>
                        <strong>Foto-basierte Lebensmittelerkennung</strong> — Ihr Mahlzeitenfoto
                        wird zur Erkennung an einen internen, nicht öffentlich erreichbaren
                        KI-Server übermittelt. Vor der Übermittlung werden EXIF- und GPS-Metadaten
                        aus dem Bild entfernt; der KI-Server speichert die Fotos nicht dauerhaft.
                        Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
                    </li>
                    <li>
                        <strong>Lebensmittelsuche</strong> — Suchanfragen werden ausschließlich
                        gegen unsere eigene, lokal befüllte Postgres-Datenbank (Grundlage:
                        gemeinfreie USDA-Daten) verarbeitet. Es findet keine Übermittlung Ihrer
                        Sucheingaben an einen externen Lebensmittel-Lookup-Dienst statt.
                        Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
                    </li>
                    <li>
                        <strong>Gewichts- und Ernährungsziel-Tracking</strong> — siehe Abschnitt 4:
                        gesonderte, ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO.
                    </li>
                    <li>
                        <strong>Sicherheit und Missbrauchsprävention</strong> (Admin-Audit-Log) —
                        Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der
                        Nachvollziehbarkeit administrativer Eingriffe).
                    </li>
                </LegalList>
            </LegalSection>

            <LegalSection
                id="gesundheitsdaten"
                heading="4. Gewichts- und Ernährungsdaten (Art. 9 DSGVO)"
            >
                <p>
                    Körpergewicht über die Zeit, in Verbindung mit Kalorien- und
                    Makronährstoffaufnahme und einem hinterlegten Gewichtsziel, ist kontobezogen,
                    verlaufsbezogen und zielgerichtet auswertbar. Wir behandeln diese Kombination
                    daher als <strong>Gesundheitsdaten im Sinne von Art. 9 Abs. 1 DSGVO</strong>.
                </p>
                <p>
                    Die Verarbeitung dieser Daten stützt sich auf Ihre{' '}
                    <strong>ausdrückliche Einwilligung</strong> (Art. 9 Abs. 2 lit. a DSGVO). Diese
                    Einwilligung ist ein separater, aktiver Schritt — sie ist <strong>nicht</strong>{' '}
                    Teil der allgemeinen Zustimmung zu dieser Datenschutzerklärung oder den AGB und
                    wird gesondert eingeholt, bevor Sie erstmals einen Gewichtseintrag oder ein
                    Gewichtsziel anlegen. Sie können diese Einwilligung jederzeit mit Wirkung für
                    die Zukunft widerrufen — der Widerruf ist über Ihre Profileinstellungen ebenso
                    einfach möglich wie die ursprüngliche Erteilung. Nach einem Widerruf verarbeiten
                    wir keine neuen Gewichtseinträge mehr; bereits bestehende Einträge können Sie
                    dort löschen.
                </p>
            </LegalSection>

            <LegalSection id="empfaenger" heading="5. Empfänger und Auftragsverarbeitung">
                <p>
                    NutriLens wird auf Microsoft Azure (Region West Europe) gehostet; Microsoft
                    verarbeitet die Daten dabei als Auftragsverarbeiter für uns. Der interne
                    KI-Server für die Foto-Erkennung ist Teil unserer eigenen Infrastruktur und
                    nicht öffentlich erreichbar; er erhält Fotos ausschließlich zur Erkennung und
                    speichert sie nicht dauerhaft. Das Hosting erfolgt ausschließlich in der EU;
                    eine Übermittlung in ein Drittland zu Hosting-Zwecken findet nicht statt.
                </p>
                <p>
                    Melden Sie sich über GitHub, Google oder Microsoft an, erhält der jeweils
                    gewählte Anbieter die für den OAuth-Vorgang nötigen Daten; bei GitHub und Google
                    wird Ihr Profilbild zudem direkt von deren Servern geladen. Diese Anbieter haben
                    ihren Sitz in den USA, sodass es in diesem Fall zu einer Übermittlung in ein
                    Drittland kommt. Bei der Anmeldung mit E-Mail und Passwort entfällt diese
                    Übermittlung. An weitere Dritte werden keine Daten übermittelt.
                </p>
            </LegalSection>

            <LegalSection id="speicherdauer" heading="6. Speicherdauer">
                <p>
                    Konto-, Plan- und Protokolldaten werden für die Dauer des Bestehens Ihres Kontos
                    gespeichert.
                </p>
                <p className="rounded-md border border-dashed border-destructive bg-destructive/10 p-3 text-base text-destructive-strong">
                    <Placeholder>TODO_RETENTION</Placeholder> — Zum Zeitpunkt dieser Fassung
                    existiert im Backend noch keine automatisierte Löschroutine. Sobald
                    Konto-Löschung und Datenexport verfügbar sind, ist dieser Abschnitt so zu
                    aktualisieren, dass er die tatsächliche Frist zwischen Löschantrag und
                    endgültiger Löschung sowie eine etwaige Aufbewahrung in Backups nennt (siehe
                    Bericht der Umsetzung für die genauen Angaben).
                </p>
                <p>
                    Das Admin-Audit-Log wird so lange aufbewahrt, wie es für die Nachvollziehbarkeit
                    administrativer Handlungen erforderlich ist.
                </p>
            </LegalSection>

            <LegalSection id="rechte" heading="7. Ihre Rechte">
                <p>Ihnen stehen als betroffener Person insbesondere folgende Rechte zu:</p>
                <LegalList>
                    <li>Auskunft über die zu Ihnen gespeicherten Daten (Art. 15 DSGVO)</li>
                    <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
                    <li>Löschung Ihrer Daten (Art. 17 DSGVO)</li>
                    <li>
                        Datenübertragbarkeit — Herausgabe Ihrer Daten in einem strukturierten,
                        gängigen Format (Art. 20 DSGVO)
                    </li>
                    <li>
                        Widerspruch gegen Verarbeitungen auf Grundlage berechtigten Interesses (Art.
                        21 DSGVO)
                    </li>
                    <li>
                        Widerruf einer erteilten Einwilligung mit Wirkung für die Zukunft (Art. 7
                        Abs. 3 DSGVO)
                    </li>
                </LegalList>
                <p>
                    Löschung (Art. 17 DSGVO) und Datenübertragbarkeit (Art. 20 DSGVO) können Sie
                    direkt selbst ausführen: Ihre Profileinstellungen enthalten dafür einen
                    Daten-Export-Download und eine Konto-Löschung, die Ihre Daten löscht bzw.
                    unwiderruflich entfernt — administrative Protokolleinträge, die Ihr Konto
                    betreffen, werden dabei anonymisiert statt gelöscht, damit das Audit-Log
                    weiterhin nachvollziehbar bleibt. Für alle anderen Rechte genügt eine
                    formlose Nachricht an{' '}
                    <a
                        href={`mailto:${IMPRESSUM.email}`}
                        className="font-medium text-primary-strong hover:underline"
                    >
                        {IMPRESSUM.email}
                    </a>
                    . Darüber hinaus haben Sie das Recht, sich bei der österreichischen
                    Datenschutzbehörde zu beschweren:
                </p>
                <p>
                    Österreichische Datenschutzbehörde
                    <br />
                    Barichgasse 40–42, 1030 Wien
                    <br />
                    <a
                        href="https://www.dsb.gv.at"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary-strong hover:underline"
                    >
                        www.dsb.gv.at
                    </a>
                </p>
            </LegalSection>

            <LegalSection id="ki" heading="8. Automatisierte Verarbeitung und KI">
                <p>
                    Die Foto-Erkennung von Mahlzeiten liefert eine automatisiert erzeugte
                    Einschätzung von Lebensmittel und Nährwerten. Diese Einschätzung wird in der
                    Anwendung als KI-generiertes Ergebnis gekennzeichnet und ist vor dem Speichern
                    zu überprüfen — sie stellt keine automatisierte Entscheidung im Sinne von Art.
                    22 DSGVO mit rechtlicher oder ähnlich erheblicher Wirkung dar, da Sie das
                    Ergebnis vor jeder Speicherung sehen und korrigieren können.
                </p>
            </LegalSection>
        </LegalPage>
    );
}
