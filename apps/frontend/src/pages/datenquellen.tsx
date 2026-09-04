import { LegalList, LegalPage, LegalSection } from '@/components/layout/legal-page';
import { IMPRESSUM } from '@/pages/impressum';

// German, like impressum/datenschutz/agb (about.tsx is the English one).
//
// This page exists because PRIVACY.md §5 promised it and because a policy page
// alone does not discharge the ODbL obligation: §4.3 wants the notice where the
// Produced Work is used, and the OSMF attribution guideline names a separate
// credits page as explicitly insufficient. So this page is the full licence
// statement, and components/data-attribution.tsx carries the credit itself into
// every view that renders OpenStreetMap rows.
//
// EVERY ENTRY BELOW WAS CHECKED AGAINST WHAT IS ACTUALLY INGESTED, not against
// what the schema anticipates. Open Food Facts is the one that differs: the
// barcode column from migration 0011 exists, nothing writes it, and no importer
// fetches OFF — so it is named as not-yet-in-use rather than credited, because
// a false provenance claim is worse than a missing one. Re-check this page when
// that enrichment job first runs.
export default function DatenquellenPage() {
    return (
        <LegalPage
            title="Datenquellen"
            updated="2026-08-30"
            contentLang="de"
            lede="NutriLens zeigt Nährwerte, Lebensmittelnamen und Supermarkt-Standorte aus mehreren Datenbeständen. Diese Seite nennt jede Quelle, unter welcher Lizenz sie steht und welche Pflichten sich daraus ergeben."
        >
            <LegalSection id="usda" heading="USDA FoodData Central">
                <p>
                    Sämtliche Nährwerte (Kalorien, Eiweiß, Kohlenhydrate, Fett — jeweils pro 100 g)
                    stammen aus den Datensätzen SR Legacy, Survey Foods (FNDDS) und Foundation Foods
                    des U.S. Department of Agriculture.
                </p>
                <p>
                    Diese Daten sind gemeinfrei (public domain). Es bestehen keine
                    Nutzungseinschränkungen und keine Namensnennungspflicht; die Nennung hier dient
                    der Nachvollziehbarkeit.
                </p>
            </LegalSection>

            <LegalSection id="openstreetmap" heading="OpenStreetMap">
                <p>
                    Die Standortdaten der Supermärkte (Name, Adresse, Koordinaten, Öffnungszeiten)
                    stammen aus einem Auszug von OpenStreetMap:
                </p>
                <p>
                    <a
                        href="https://www.openstreetmap.org/copyright"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-primary"
                    >
                        &copy; OpenStreetMap-Mitwirkende
                    </a>
                    , lizenziert unter der Open Database License (ODbL) v1.0.
                </p>
                <p>
                    Dieser Hinweis wird zusätzlich unmittelbar dort angezeigt, wo diese Standorte
                    dargestellt werden — die Lizenz verlangt die Nennung bei den Daten selbst, nicht
                    nur auf einer Seite wie dieser.
                </p>
                <p>
                    Aus den OpenStreetMap-Daten wurden bewusst keine personenbezogenen Angaben
                    übernommen: Telefonnummern sowie{' '}
                    <code className="font-mono text-[13px]">operator</code>- und{' '}
                    <code className="font-mono text-[13px]">owner</code>-Angaben werden beim Import
                    verworfen, da es sich bei inhabergeführten Geschäften häufig um private Daten
                    handelt.
                </p>
            </LegalSection>

            <LegalSection id="odbl-weitergabe" heading="Herausgabe der abgeleiteten Datenbank">
                <p>
                    Die ODbL v1.0 verpflichtet uns, den aus OpenStreetMap abgeleiteten Datenbestand
                    auf Anfrage unter derselben Lizenz herauszugeben (§ 4.6). Einen öffentlichen
                    Download-Link gibt es derzeit nicht — eine formlose Nachricht an{' '}
                    {/* text-primary-strong, not text-primary, for the inline links on
                        this page: LegalPage puts its reading column straight on
                        --background. The values this comment used to cite were the
                        pre-Werkbank mint ones (#00875a/#fafafa at 4.36:1, #006b46 at
                        6.30:1) and no longer describe anything on screen. On the
                        Werkbank palette both tokens clear AA on --background — light
                        --primary and --primary-strong are each 7.35:1, dark --primary
                        5.37:1 and --primary-strong 6.99:1 — so this is now a
                        consistency choice rather than a contrast rescue: every inline
                        link on the legal pages uses the -strong token, and the dark
                        theme is where the 5.37 -> 6.99 gap still earns it. */}
                    <a
                        href={`mailto:${IMPRESSUM.email}`}
                        className="font-medium text-primary-strong hover:underline"
                    >
                        {IMPRESSUM.email}
                    </a>{' '}
                    genügt, und Sie erhalten den Auszug in maschinenlesbarer Form.
                </p>
                <p>
                    Dieser Auszug enthält ausschließlich die OpenStreetMap-Zeilen. Die zugekauften
                    Standortdaten (siehe unten) sind davon getrennt gespeichert, sind nicht Teil der
                    abgeleiteten Datenbank und dürfen nach ihrer eigenen Lizenz nicht
                    weiterveröffentlicht werden.
                </p>
            </LegalSection>

            <LegalSection id="zugekaufte-standortdaten" heading="Zugekaufte Standortdaten (Spar)">
                <p>
                    Ein Teil der angezeigten Spar-Filialen stammt aus einem einmalig zugekauften,
                    proprietären Datensatz des Anbieters Geolocet. Diese Daten stehen unter keiner
                    freien Lizenz, werden nicht weitergegeben und sind in der Datenbank durch ein
                    eigenes Herkunftsmerkmal von den OpenStreetMap-Daten getrennt.
                </p>
                <p>
                    Weil beide Bestände getrennt bleiben, kann derselbe Markt in seltenen Fällen
                    doppelt erscheinen. Das ist beabsichtigt: ein Zusammenführen würde die
                    zugekauften Daten lizenzrechtlich in die ODbL hineinziehen.
                </p>
            </LegalSection>

            <LegalSection id="eigene-daten" heading="Eigene Daten">
                <p>
                    Die deutschsprachige Lebensmittel-Namensliste (die Zuordnung von Begriffen wie
                    „Semmel“ oder „Erdäpfel“ zu den englischsprachigen USDA-Einträgen) ist eigene
                    Arbeit und unterliegt keiner Drittlizenz.
                </p>
            </LegalSection>

            <LegalSection id="bilderkennung" heading="Foto-Erkennung">
                <p>
                    Die Foto-Erkennung verwendet ein vortrainiertes Bildklassifikationsmodell (Swin
                    Transformer, auf den 101 Kategorien des Food-101-Datensatzes feinabgestimmt),
                    das über den Hugging Face Hub bezogen wird. Das Modell liefert ausschließlich
                    eine Kategoriebezeichnung; die dazu angezeigten Nährwerte stammen wie überall
                    sonst aus den USDA-Daten oben.
                </p>
            </LegalSection>

            <LegalSection id="open-food-facts" heading="Open Food Facts — derzeit nicht im Einsatz">
                <p>
                    Für die Barcode-Suche ist eine spätere Anreicherung mit Daten von{' '}
                    <a
                        href="https://openfoodfacts.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary-strong hover:underline"
                    >
                        Open Food Facts
                    </a>{' '}
                    vorgesehen. <strong>Diese Anreicherung hat noch nicht stattgefunden:</strong> im
                    Lebensmittelkatalog befindet sich derzeit keine einzige Zeile aus Open Food
                    Facts, und es werden auch keine Suchanfragen dorthin gesendet.
                </p>
                <p>
                    Sobald solche Daten übernommen werden, gilt dafür: Produktnamen und Barcodes von
                    Open Food Facts, https://openfoodfacts.org, lizenziert unter der Open Database
                    License (ODbL) v1.0, Inhalte unter der Database Contents License (DbCL) v1.0.
                    Dieser Hinweis wird dann an dieser Stelle als tatsächliche Quelle geführt.
                    Produktbilder von Open Food Facts werden nicht verwendet.
                </p>
            </LegalSection>

            <LegalSection id="uebersicht" heading="Übersicht">
                <LegalList>
                    <li>
                        <strong>Nährwerte</strong> — USDA FoodData Central, gemeinfrei.
                    </li>
                    <li>
                        <strong>Supermarkt-Standorte</strong> — OpenStreetMap (ODbL v1.0) sowie ein
                        zugekaufter, proprietärer Spar-Datensatz.
                    </li>
                    <li>
                        <strong>Deutschsprachige Lebensmittelnamen</strong> — eigene Arbeit.
                    </li>
                    <li>
                        <strong>Foto-Erkennung</strong> — vortrainiertes Modell, Nährwerte aus den
                        USDA-Daten.
                    </li>
                    <li>
                        <strong>Open Food Facts</strong> — vorgesehen, aber noch nicht im Einsatz.
                    </li>
                </LegalList>
            </LegalSection>
        </LegalPage>
    );
}
