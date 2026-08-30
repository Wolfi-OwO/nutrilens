import type en from './en';

/**
 * Every key of the English catalogue. `de` below is typed against it, so a key
 * added to one locale and forgotten in the other is a compile error, not
 * something a reviewer has to notice.
 */
export type MessageKey = keyof typeof en;

// German catalogue. Formal register ("Sie"), matching the German copy this app
// already shipped — the consent banner and the legal pages both address the
// user as "Sie", and a UI that switches between "du" and "Sie" reads worse than
// either register used consistently.
const de: Record<MessageKey, string> = {
    // --- shared ---
    'common.retry': 'Erneut versuchen',
    'common.cancel': 'Abbrechen',
    'common.saving': 'Wird gespeichert…',
    'common.saveChanges': 'Änderungen speichern',
    'common.previous': 'Zurück',
    'common.next': 'Weiter',
    'common.tryAgain': 'Erneut versuchen',
    'common.or': 'oder',
    'common.skipToContent': 'Zum Inhalt springen',
    'common.genericError': 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.',
    'common.pageOf': 'Seite {page, number} von {total, number}',

    // --- language switcher ---
    'locale.de': 'Deutsch',
    'locale.en': 'English',
    'locale.switchTo': 'Auf {language} umstellen',

    // --- theme toggle ---
    'theme.followingSystem': 'Folgt dem System — auf helles Design umstellen',
    'theme.switchToLight': 'Auf helles Design umstellen',
    'theme.switchToDark': 'Auf dunkles Design umstellen',

    // --- app shell ---
    'nav.primary': 'Hauptnavigation',
    'nav.beta': 'Beta',
    'nav.dashboard': 'Übersicht',
    'nav.mealPlan': 'Ernährungsplan',
    'nav.plan': 'Plan',
    'nav.progress': 'Fortschritt',
    'nav.profile': 'Profil',
    'nav.log': 'Erfassen',
    'nav.logFood': 'Mahlzeit erfassen',
    'nav.quickGuide': 'Kurzanleitung',
    'nav.admin': 'Admin',
    'nav.logOut': 'Abmelden',
    'nav.backToApp': 'Zurück zur App',
    'nav.adminSection': 'Admin',
    'nav.adminOverview': 'Übersicht',
    'nav.adminUsers': 'Benutzer',
    'nav.adminAuditLog': 'Protokoll',

    // --- footer ---
    'footer.legalNav': 'Rechtliches',
    'footer.about': 'Über uns',
    'footer.rights': 'Alle Rechte vorbehalten.',
    'footer.revision': 'Revision {revision}',
    'footer.built': 'gebaut {date}',

    // --- consent banner ---
    'consent.dialogLabel': 'Cookie-Einstellungen',
    'consent.body':
        'Wir verwenden aktuell keine Analytics-Cookies. Sollte sich das ändern, entscheidet Ihre Wahl hier, ob sie geladen werden.',
    'consent.learnMore': 'Mehr erfahren',
    'consent.decline': 'Ablehnen',
    'consent.accept': 'Akzeptieren',

    // --- legal page chrome ---
    'legal.updated': 'Stand: {date}',
    'legal.germanGoverns':
        'Diese Seite ist ausschließlich in deutscher Fassung rechtsverbindlich. Es wird bewusst keine Übersetzung angeboten, weil eine übersetzte Klausel von der maßgeblichen abweichen könnte.',

    // --- about ---
    'about.title': 'Über NutriLens',
    'about.lede':
        'NutriLens ist eine schlanke App für Ernährung und Gewichtsverlauf — gebaut, um Mahlzeiten so schnell wie möglich zu erfassen, ohne bei Genauigkeit oder Datenschutz Abstriche zu machen.',
    'about.photo.title': 'Ein Foto statt eines Formulars',
    'about.photo.body':
        'Fotografieren Sie Ihre Mahlzeit — die KI-Erkennung schätzt das Lebensmittel und seine Nährwerte, Sie prüfen und speichern.',
    'about.plan.title': 'Ein Plan statt Raterei',
    'about.plan.body':
        'Ernährungspläne mit klaren Kalorien- und Makrozielen, passend zu Ihrem Ziel — abnehmen, halten oder zunehmen.',
    'about.database.title': 'Unsere eigene Lebensmitteldatenbank',
    'about.database.body':
        'Die Suche läuft gegen eine Datenbank, die wir selbst betreiben und die auf öffentlichen USDA-Daten aufbaut — keine Suchanfrage verlässt unsere Infrastruktur in Richtung eines fremden Nachschlagedienstes.',
    'about.privacy.title': 'Datensparsamer Umgang mit Fotos',
    'about.privacy.body':
        'Aus Mahlzeitenfotos werden Standort- und Kameradaten (EXIF/GPS) vor dem Hochladen entfernt, und der Erkennungsdienst speichert sie nicht.',
    'about.operator.heading': 'Wer NutriLens betreibt',
    'about.operator.body':
        'NutriLens wird von Phillip Kofler als unabhängiges Projekt entwickelt und betrieben. Die Angaben zum Betreiber stehen im <impressum>Impressum</impressum>, Einzelheiten zur Datenverarbeitung in der <privacy>Datenschutzerklärung</privacy>. Beide Seiten sind auf Deutsch.',
    'about.limits.heading': 'Was NutriLens nicht ist',
    'about.limits.body':
        'NutriLens ist kein Medizinprodukt und gibt keine ernährungsmedizinische oder ärztliche Beratung — Kalorien- und Makrowerte ebenso wie Ergebnisse der KI-Erkennung sind automatisch erzeugte Schätzwerte, keine klinische Beurteilung. Details stehen in den <terms>AGB</terms>.',

    // --- auth ---
    'auth.panel.eyebrow': 'Kalorien & Makros im Blick',
    'auth.email': 'E-Mail',
    'auth.password': 'Passwort',
    'auth.name': 'Name',
    'auth.emailPlaceholder': 'du@beispiel.at',
    'auth.namePlaceholder': 'Alex Rivera',
    'auth.validation.emailRequired': 'E-Mail-Adresse ist erforderlich.',
    'auth.validation.emailInvalid': 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
    'auth.validation.passwordRequired': 'Passwort ist erforderlich.',
    'auth.validation.nameRequired': 'Name ist erforderlich.',
    'auth.validation.passwordTooShort':
        'Das Passwort muss mindestens {count, plural, one {# Zeichen} other {# Zeichen}} lang sein.',

    'login.headline': 'Wissen, was Sie essen.',
    'login.tagline':
        'Fotografieren Sie Ihre Mahlzeit und erhalten Sie die Nährwerte in Sekunden zurück.',
    'login.title': 'Willkommen zurück',
    'login.subtitle': 'Melden Sie sich an, um Ihre Mahlzeiten weiter zu erfassen.',
    'login.providerNotice':
        'Die Anmeldung über einen Anbieter erstellt Ihr NutriLens-Konto oder meldet Sie darin an — es gelten unsere <terms>AGB</terms> und unsere <privacy>Datenschutzerklärung</privacy>.',
    'login.submit': 'Anmelden',
    'login.submitting': 'Anmeldung läuft…',
    'login.newHere': 'Neu bei nutrilens?',
    'login.createAccount': 'Konto erstellen',

    'register.headline': 'In Sekunden loslegen.',
    'register.tagline':
        'Erfassen Sie Mahlzeiten aus einem einzigen Foto und bauen Sie einen Plan, der zu Ihren Zielen passt.',
    'register.title': 'Konto erstellen',
    'register.subtitle': 'Erfassen Sie Mahlzeiten in Sekunden — mit einem Foto.',
    'register.providerNotice':
        'Die Anmeldung über einen Anbieter erstellt Ihr NutriLens-Konto — es gelten unsere <terms>AGB</terms> und unsere <privacy>Datenschutzerklärung</privacy>.',
    'register.passwordRequirement':
        'Mindestens {count, plural, one {# Zeichen} other {# Zeichen}}',
    'register.requirementMet': ' — erfüllt',
    'register.requirementNotMet': ' — noch nicht erfüllt',
    'register.gdprNotice':
        'Mit der Erstellung eines Kontos stimmen Sie unseren <terms>AGB</terms> zu und bestätigen, unsere <privacy>Datenschutzerklärung</privacy> gelesen zu haben. Für die Gewichtserfassung gibt es beim ersten Eintrag eine eigene Einwilligung.',
    'register.submit': 'Konto erstellen',
    'register.submitting': 'Konto wird erstellt…',
    'register.haveAccount': 'Sie haben bereits ein Konto?',
    'register.logIn': 'Anmelden',

    'oauth.continueWith': 'Weiter mit {provider}',
    'oauth.redirecting': 'Weiterleitung…',
    'oauth.callback.signingIn': 'Sie werden angemeldet…',
    'oauth.callback.failedTitle': 'Die Anmeldung hat nicht geklappt',
    'oauth.callback.failedBody':
        'Vom Anbieter kam keine gültige Sitzung zurück. Es wurde nichts angemeldet — versuchen Sie es über die Anmeldeseite erneut.',
    'oauth.callback.backToLogin': 'Zurück zur Anmeldung',

    // --- macros ---
    'macro.protein': 'Eiweiß',
    'macro.carbs': 'Kohlenhydrate',
    'macro.fat': 'Fett',
    'macro.calories': 'Kalorien',
    'macro.proteinGrams': 'Eiweiß (g)',
    'macro.carbGrams': 'Kohlenhydrate (g)',
    'macro.fatGrams': 'Fett (g)',
    'macro.barValue': '{consumed, number} {unit} von {target, number} {unit}',
    'macro.gramsPerDay': '{grams, number} g/Tag',
    'unit.kcal': '{value, number} kcal',
    'unit.grams': '{value, number} g',
    'unit.kg': '{value, number} kg',

    // --- dashboard ---
    'dashboard.greeting.morning': 'Guten Morgen, {name}',
    'dashboard.greeting.afternoon': 'Guten Tag, {name}',
    'dashboard.greeting.evening': 'Guten Abend, {name}',
    'dashboard.subtitle': 'So steht der heutige Tag.',
    'dashboard.streak': '{count, plural, one {# Tag in Folge} other {# Tage in Folge}}',
    'dashboard.loadError':
        'Der heutige Fortschritt konnte nicht geladen werden. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
    'dashboard.setUpPlanTitle': 'Ernährungsplan anlegen',
    'dashboard.setUpPlanBody':
        'Legen Sie ein tägliches Kalorien- und Makroziel fest, um den Fortschritt daran zu messen.',
    'dashboard.createPlan': 'Plan anlegen',
    'dashboard.todaysIntake': 'Heutige Zufuhr',
    'dashboard.mealCount': '{count, plural, one {# Mahlzeit} other {# Mahlzeiten}}',
    'dashboard.consumedOfTarget': '{consumed, number} / {target, number} kcal',
    'dashboard.todaysMeals': 'Heutige Mahlzeiten',
    'dashboard.nothingLoggedYet': 'Heute noch nichts erfasst.',
    'dashboard.todaySummary':
        '{count, plural, one {# Mahlzeit} other {# Mahlzeiten}}, insgesamt {calories, number} kcal',
    'dashboard.addMeal': 'Mahlzeit hinzufügen',
    'dashboard.emptyTitle': 'Heute noch nichts erfasst.',
    'dashboard.emptyBody':
        'Erfassen Sie Ihre erste Mahlzeit — per Foto, Barcode oder schneller Eingabe — und Kalorien und Makros füllen sich von selbst.',
    'dashboard.emptyAction': 'Erste Mahlzeit erfassen',
    'dashboard.meal.breakfast': 'Frühstück',
    'dashboard.meal.lunch': 'Mittagessen',
    'dashboard.meal.dinner': 'Abendessen',
    'dashboard.meal.snacks': 'Snacks',
    'dashboard.mealSection': 'Mahlzeiten: {meal}',
    'dashboard.mealMacros': 'E {protein, number} g · KH {carbs, number} g · F {fat, number} g',
    'dashboard.deleteMeal': 'Mahlzeit löschen',
    'dashboard.deleteMealConfirm': 'Löschen?',
    'dashboard.thisWeek': 'Diese Woche',
    'dashboard.thisWeekDescription': 'Tägliche Kalorien im Vergleich zum Ziel',
    'dashboard.noTrendYet':
        'Noch keine Mahlzeiten erfasst — der Verlauf erscheint hier, sobald Sie welche erfassen.',
    'dashboard.weekTotal': 'Summe {days, number} Tage',
    'dashboard.daysLogged': 'Erfasste Tage',
    'dashboard.daysLoggedValue': '{logged, number} / {total, number}',

    'calorieRing.left': 'kcal übrig',
    'calorieRing.over': 'kcal darüber',

    'water.title': 'Flüssigkeit',
    'water.summary':
        '{glasses, number} / {target, number} Gläser · {percent, number, percent} des Ziels',
    'water.add': 'Mehr',
    'water.remove': 'Weniger',
    'water.addLabel': 'Ein Glas hinzufügen',
    'water.removeLabel': 'Ein Glas entfernen',

    'source.ai_photo': 'KI-Foto',
    'source.manual_search': 'Manuell',
    'source.barcode': 'Barcode',

    // --- log meal ---
    'logMeal.title': 'Mahlzeit erfassen',
    'logMeal.subtitle.idle':
        'Fotografieren Sie die Mahlzeit — der KI-Erkennungsserver identifiziert sie — oder durchsuchen Sie den Lebensmittelkatalog selbst.',
    'logMeal.subtitle.analyzing': 'Ihr Foto liegt beim KI-Erkennungsserver.',
    'logMeal.subtitle.reviewing':
        'Prüfen Sie die Werte und bestätigen Sie dann. Bis dahin wird nichts gespeichert.',
    'logMeal.dropzone.idle': 'Foto aufnehmen oder hochladen',
    'logMeal.dropzone.dragging': 'Hier ablegen',
    'logMeal.dropzone.hint': 'Foto hierher ziehen oder tippen, um eines auszuwählen',
    'logMeal.useCamera': 'Kamera verwenden',
    'logMeal.enterManually': 'Manuell eingeben',
    'logMeal.analyzing': 'Foto wird analysiert…',
    'logMeal.analyzingHint':
        'Es wird mit dem Lebensmittel-Erkennungsmodell abgeglichen — das dauert ein paar Sekunden.',
    'logMeal.photoAlt': 'Ausgewähltes Foto der Mahlzeit',
    'logMeal.photoAnalyzed':
        'Foto analysiert — korrigieren Sie unten alles, was nicht ganz passt.',
    'logMeal.aiIdentified': 'KI-Erkennung',
    'logMeal.confidence': '{percent, number, percent} Sicherheit',
    'logMeal.confident': '{percent, number, percent} sicher',
    'logMeal.lowConfidence':
        'Hier ist die Erkennung unsicher — bitte vor dem Bestätigen prüfen.',
    'logMeal.useItAnyway': 'Trotzdem übernehmen',
    'logMeal.filledIn': 'Unten eingetragen — bitte kurz prüfen.',
    'logMeal.notQuiteRight': 'Nicht ganz richtig?',
    'logMeal.nutrient.cal': 'Kal',
    'logMeal.fallback.unreachableTitle': 'KI-Dienst nicht erreichbar',
    'logMeal.fallback.unreachableBody':
        'Geben Sie unten ein, was Sie gegessen haben — es ist nichts verloren gegangen.',
    'logMeal.fallback.notRecognizedTitle': 'Foto konnte nicht erkannt werden',
    'logMeal.fallback.notRecognizedBody':
        'Es ließ sich keinem bekannten Lebensmittel zuordnen — geben Sie unten ein, was Sie gegessen haben.',
    'logMeal.item': 'Position {number, number}',
    'logMeal.removeItem': 'Position {number, number} entfernen',
    'logMeal.food': 'Lebensmittel',
    'logMeal.foodPlaceholder': 'Gegrillter Hühnersalat',
    'logMeal.portion': 'Portion (g)',
    'logMeal.macrosHint':
        'Makros — optional, und automatisch gefüllt, sobald Sie ein Lebensmittel aus dem Katalog wählen.',
    'logMeal.addAnotherItem': 'Weitere Position',
    'logMeal.thisMeal': 'Diese Mahlzeit',
    'logMeal.afterLogging': 'Nach dem Erfassen, heute',
    'logMeal.projected': '{projected, number} / {target, number} kcal',
    'logMeal.overBy': ' · {over, number} darüber',
    'logMeal.retakePhoto': 'Neues Foto',
    'logMeal.startOver': 'Von vorn',
    'logMeal.confirm': 'Bestätigen & erfassen',
    'logMeal.confirming': 'Wird erfasst…',
    'logMeal.setUpPlan': 'Plan anlegen',
    'logMeal.error.invalidImage': 'Bitte wählen Sie eine gültige Bilddatei.',
    'logMeal.error.unsafePreview': 'Diese Datei kann nicht sicher angezeigt werden.',
    'logMeal.error.needsPlan':
        'Sie brauchen einen aktiven Ernährungsplan, bevor Sie eine Mahlzeit erfassen können.',
    'logMeal.error.saveFailed':
        'Beim Speichern dieser Mahlzeit ist etwas schiefgelaufen. Bitte versuchen Sie es erneut.',
    'logMeal.validation.foodName': 'Geben Sie an, was Sie gegessen haben',
    'logMeal.validation.portion': 'Geben Sie eine Portion über 0 g an',
    'logMeal.validation.calories': 'Geben Sie 0 oder mehr kcal an',
    'logMeal.validation.proteinNegative': 'Eiweiß darf nicht negativ sein',
    'logMeal.validation.carbsNegative': 'Kohlenhydrate dürfen nicht negativ sein',
    'logMeal.validation.fatNegative': 'Fett darf nicht negativ sein',

    // --- food search combobox ---
    'foodSearch.resultsLabel': 'Suchergebnisse für Lebensmittel',
    'foodSearch.keepTyping': 'Weiter tippen — ab {count, number} Zeichen wird gesucht',
    'foodSearch.searching': 'Suche läuft…',
    'foodSearch.failed': 'Die Lebensmittelsuche ist fehlgeschlagen.',
    'foodSearch.failedBody':
        'Der Lebensmittelkatalog konnte nicht durchsucht werden — der eingegebene Name bleibt erhalten, Sie können die Werte selbst eintragen.',
    'foodSearch.resultCount':
        '{count, plural, one {# Treffer} other {# Treffer}} für „{query}“',
    'foodSearch.noResults': 'Keine Treffer für „{query}“',
    'foodSearch.notInCatalogue':
        'Nicht im Katalog — „{query}“ bleibt wie eingegeben stehen; tragen Sie die Werte selbst ein.',
    'foodSearch.per100g': '{macros} pro 100 g',
    'foodSearch.noMacroData': 'Keine Nährwerte hinterlegt',
    'foodSearch.macroKcal': '{value, number} kcal',
    'foodSearch.macroProtein': '{value, number} g Eiweiß',
    'foodSearch.macroCarbs': '{value, number} g Kohlenhydrate',
    'foodSearch.macroFat': '{value, number} g Fett',

    // --- shop picker ---
    'shop.heading': 'Wo eingekauft',
    'shop.optional': '— optional',
    'shop.remembered': 'gemerkt',
    'shop.notRecorded': 'Nicht erfasst',
    'shop.close': 'Schließen',
    'shop.change': 'Ändern',
    'shop.add': 'Geschäft hinzufügen',
    'shop.clear': 'Geschäft aus diesem Eintrag entfernen',
    'shop.findChain': 'Kette suchen',
    'shop.filterPlaceholder': 'Billa, Hofer, Spar…',
    'shop.nearMe': 'In der Nähe',
    'shop.withinRadius': 'Geschäfte im Umkreis von {km, number} km',
    'shop.browseChains': 'Ketten durchsehen',
    'shop.browseChainsInstead': 'Stattdessen Ketten durchsehen',
    'shop.loadingChains': 'Ketten werden geladen…',
    'shop.chainsFailed':
        'Die Geschäftsliste konnte nicht geladen werden. Die Mahlzeit lässt sich trotzdem erfassen.',
    'shop.noChainMatch': 'Keine Kette passt zu „{query}“.',
    'shop.clearFilter': 'Filter zurücksetzen',
    'shop.recentlyUsed': 'Zuletzt verwendet',
    'shop.allChains': 'Alle Ketten',
    'shop.allChainsInAustria': 'Alle Ketten in Österreich ({count, number})',
    'shop.branchCount': '{count, plural, one {# Filiale} other {# Filialen}}',
    'shop.deviceOnly':
        'Nur auf diesem Gerät gespeichert — das Geschäft ist noch nicht Teil des gespeicherten Eintrags.',
    'shop.allChainsBack': 'Alle Ketten',
    'shop.justChainIsFine': 'Nur {chain} genügt',
    'shop.chainRecorded':
        '<name>{chain}</name> ist erfasst. Wählen Sie bei Bedarf eine Filiale — optional.',
    'shop.loadingBranches': 'Filialen werden geladen…',
    'shop.branchesFailed':
        'Die Filialen konnten nicht geladen werden — {chain} allein ist bereits erfasst.',
    'shop.noBranchAddresses':
        'Für {chain} sind keine Filialadressen hinterlegt — die Kette allein ist erfasst.',
    'shop.showingSome':
        'Es werden {shown, number} von {total, number} {chain}-Filialen angezeigt. <location>Verwenden Sie Ihren Standort</location>, um die nächstgelegene zu finden.',
    'shop.locating': 'Standort wird ermittelt…',
    'shop.geoUnsupported':
        'Dieser Browser kann keinen Standort teilen. Wählen Sie stattdessen eine Kette aus der Liste.',
    'shop.geoDenied':
        'Die Standortfreigabe wurde abgelehnt. Wählen Sie stattdessen eine Kette aus der Liste.',
    'shop.geoFailed':
        'Der Standort konnte nicht ermittelt werden. Wählen Sie stattdessen eine Kette aus der Liste.',
    'shop.locationOnce':
        'Ihre Position wird einmalig und nur für diese Suche verwendet, um Geschäfte im Umkreis von {km, number} km zu finden.',
    'shop.searchingNearby': 'Geschäfte in Ihrer Nähe werden gesucht…',
    'shop.nearbySearchFailed': 'Die Umkreissuche ist fehlgeschlagen.',
    'shop.noneNearby': 'Im Umkreis von {km, number} km sind keine Geschäfte hinterlegt.',
    'shop.unnamedShop': 'Geschäft',
    'shop.live.searchingNearby': 'Geschäfte in der Nähe werden gesucht…',
    'shop.live.nearbyFailed': 'Die Umkreissuche ist fehlgeschlagen.',
    'shop.live.storesFound':
        '{count, plural, one {# Geschäft} other {# Geschäfte}} im Umkreis von {km, number} km gefunden',
    'shop.live.branchesListed':
        '{count, plural, one {# Filiale} other {# Filialen}} für {chain} gelistet',
    'shop.live.chainsFailed': 'Die Kettenliste konnte nicht geladen werden.',
    'shop.live.chainsMatch':
        '{count, plural, one {# Kette passt} other {# Ketten passen}} zu „{query}“',
    'shop.distanceMetres': '{value, number} m',
    'shop.distanceKilometres': '{value, number} km',

    // --- plan ---
    'plan.title': 'Ihr Plan',
    'plan.subtitle': 'Kalorien- und Makroziele.',
    'plan.loadErrorTitle': 'Ihr Plan konnte nicht geladen werden',
    'plan.loadErrorBody':
        'Beim Abrufen Ihrer Ziele ist etwas schiefgelaufen. Das ist meist vorübergehend — versuchen Sie es erneut.',
    'plan.emptyTitle': 'Plan anlegen',
    'plan.emptyBody':
        'Wählen Sie ein Ziel und tägliche Vorgaben, damit NutriLens Ihren Fortschritt daran messen kann.',
    'plan.goal': 'Ziel',
    'plan.goal.lose_weight': 'Abnehmen',
    'plan.goal.maintain': 'Halten',
    'plan.goal.gain_weight': 'Zunehmen',
    'plan.summary': 'Ziel: <name>{goal}</name> · aktiv seit {date}',
    'plan.changeGoal': 'Ziel ändern',
    'plan.dailyCalories': 'Kalorien pro Tag',
    'plan.caloriesFromMacros': 'Kalorien je Makronährstoff',
    'plan.macroShare': '{percent, number, percent}',
    'plan.warning.calories':
        'Tageskalorien liegen üblicherweise zwischen {min, number} und {max, number} kcal — bitte prüfen.',
    'plan.warning.macro': 'Das Ziel für {macro} wirkt ungewöhnlich hoch — bitte prüfen.',
    'plan.saved': 'Gespeichert.',
    'plan.saveError':
        'Beim Speichern Ihres Plans ist etwas schiefgelaufen. Bitte versuchen Sie es erneut.',
    'plan.createError':
        'Beim Anlegen Ihres Plans ist etwas schiefgelaufen. Bitte versuchen Sie es erneut.',
    'plan.startNewPlan': 'Neuen Plan beginnen',
    'plan.setUpTitle': 'Ernährungsplan anlegen',
    'plan.setUpBody':
        'Legen Sie ein tägliches Kalorien- und Makroziel fest, um den Fortschritt daran zu messen.',
    'plan.create': 'Plan anlegen',
    'plan.startNew': 'Neuen Plan starten',
    'plan.validation.required': 'Pflichtfeld',

    // --- progress ---
    'progress.title': 'Fortschritt',
    'progress.subtitle': 'Verlauf von Gewicht und Kalorien.',
    'progress.range': 'Zeitraum',
    'progress.range.week': 'Woche',
    'progress.range.month': 'Monat',
    'progress.range.all': 'Gesamt',
    'progress.window.week': 'den letzten 7 Tagen',
    'progress.window.month': 'den letzten 30 Tagen',
    'progress.loadErrorTitle': 'Ihr Fortschritt konnte nicht geladen werden',
    'progress.loadErrorBody':
        'Beim Laden Ihrer Daten ist etwas schiefgelaufen. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
    'progress.calories': 'Kalorien',
    'progress.noMealsTitle': 'Noch keine Mahlzeiten erfasst',
    'progress.noMealsBody':
        'Erfassen Sie eine Mahlzeit, dann erscheint hier Ihr Kalorienverlauf.',
    'progress.logAMeal': 'Mahlzeit erfassen',
    'progress.avgPerDay': 'kcal/Tag im Schnitt',
    'progress.targetPerDay': 'Ziel {target, number} kcal/Tag',
    'progress.chartTarget': 'Ziel',
    'progress.weight': 'Gewicht',
    'progress.noWeighInsTitle': 'Noch keine Wiegedaten',
    'progress.noWeighInsBody':
        'Tragen Sie unten Ihr erstes Gewicht ein, um einen Verlauf zu starten.',
    'progress.noWeighInsInWindow':
        'Keine Wiegedaten in {window}. Der letzte Eintrag war <value>{weight}</value> am {date}.',
    'progress.singleWeighIn':
        '<value>{weight}</value> am {date} erfasst — ein weiterer Eintrag startet die Verlaufslinie.',
    'progress.since': 'Seit {date}',
    'progress.noChange': 'Keine Änderung',
    'progress.deltaUp': '+{value, number} kg',
    'progress.deltaDown': '{value, number} kg',
    'progress.macros': 'Makros',
    'progress.logTodaysWeight': 'Heutiges Gewicht erfassen',
    'progress.weightPlaceholder': 'kg',
    'progress.logWeight': 'Gewicht erfassen',
    'progress.weightInvalid': 'Geben Sie ein Gewicht über 0 an.',
    'progress.weightError':
        'Beim Erfassen Ihres Gewichts ist etwas schiefgelaufen. Bitte versuchen Sie es erneut.',

    // --- profile ---
    'profile.title': 'Profil',
    'profile.subtitle':
        'Verwalten Sie Foto und Angaben und sehen Sie Ihre Aktivität auf einen Blick.',
    'profile.avatar.uploaded': 'Hochgeladen',
    'profile.avatar.fromGitHub': 'Von GitHub',
    'profile.avatar.fromGoogle': 'Von Google',
    'profile.avatar.fromMicrosoft': 'Von Microsoft',
    'profile.avatar.change': 'Foto ändern',
    'profile.avatar.uploading': 'Wird hochgeladen…',
    'profile.avatar.remove': 'Foto entfernen',
    'profile.avatar.removing': 'Wird entfernt…',
    'profile.avatar.uploadLabel': 'Foto hochladen',
    'profile.avatar.tooLarge': 'Das Bild darf höchstens 2 MB groß sein.',
    'profile.avatar.uploadFailed':
        'Das Hochladen ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
    'profile.info': 'Profilangaben',
    'profile.displayName': 'Anzeigename',
    'profile.displayNameRequired': 'Anzeigename ist erforderlich.',
    'profile.unsavedChanges': 'Nicht gespeicherte Änderungen',
    'profile.saved': 'Gespeichert',
    'profile.email': 'E-Mail',
    'profile.role': 'Rolle',
    'profile.status': 'Status',
    'profile.memberSince': 'Mitglied seit',
    'profile.preferences': 'Einstellungen',
    'profile.appearance': 'Darstellung',
    'profile.theme.light': 'Hell',
    'profile.theme.dark': 'Dunkel',
    'profile.theme.system': 'System',
    'profile.replayGuideTitle': 'Kurzanleitung erneut ansehen',
    'profile.replayGuideBody': 'Die Einführung noch einmal durchgehen.',
    'profile.replayGuide': 'Anleitung erneut',
    'profile.dailyTargets': 'Tagesziele',
    'profile.dailyTargetsValue': '{calories, number} kcal pro Tag',
    'profile.connectedAccounts': 'Verknüpfte Konten',
    'profile.connectedAccountsBody':
        'Verknüpfte Anmeldeanbieter werden hier noch nicht aufgelistet. Sie können sich weiterhin mit GitHub, Google oder Microsoft anmelden, falls Sie eines davon verknüpft haben.',
    'profile.yourData': 'Ihre Daten',
    'profile.yourDataDescription':
        'Exportieren Sie, was wir über Sie gespeichert haben, oder löschen Sie Ihr Konto endgültig.',
    'profile.download': 'Daten herunterladen',
    'profile.downloadBody':
        'Eine JSON-Datei mit Profil, Plänen, Mahlzeiten und Gewichtseinträgen (Art. 20 DSGVO).',
    'profile.downloadAction': 'Herunterladen',
    'profile.preparing': 'Wird vorbereitet…',
    'profile.exportFailed': 'Der Export ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
    'profile.deleteAccount': 'Konto löschen',
    'profile.deleteAccountBody':
        'Löscht Ihr Konto und die zugehörigen Daten endgültig (Art. 17 DSGVO). Das lässt sich nicht rückgängig machen.',
    'profile.deleteMyAccount': 'Mein Konto löschen',
    'profile.deletePasswordLabel': 'Passwort',
    'profile.deletePasswordHint':
        '(leer lassen, wenn Sie sich nur mit GitHub, Google oder Microsoft anmelden)',
    'profile.deleteConfirmLabel': 'Zur Bestätigung LÖSCHEN eingeben',
    'profile.deleteConfirmHint':
        'Geben Sie das Wort LÖSCHEN ein, um die Schaltfläche unten freizuschalten.',
    'profile.deleteConfirmWord': 'LÖSCHEN',
    'profile.deleteSubmit': 'Konto endgültig löschen',
    'profile.deleting': 'Wird gelöscht…',
    'profile.statsError': 'Ihre Statistik konnte nicht geladen werden.',
    'profile.mealsLogged': 'Erfasste Mahlzeiten',
    'profile.currentStreak': 'Aktuelle Serie',
    'profile.streakValue': '{count, plural, one {# Tag} other {# Tage}}',
    'profile.avgCalories': 'Ø Kalorien ({days, number} T)',
    'profile.noValue': '—',
    'profile.avgMacroSplit': 'Durchschnittliche Makroverteilung',
    'profile.lastNDays': '{count, plural, one {Letzter # Tag} other {Letzte # Tage}}',
    'profile.noMacroSplitYet':
        'Noch keine Mahlzeiten erfasst — die Makroverteilung erscheint hier, sobald Sie welche erfassen.',

    // --- roles and statuses ---
    'role.user': 'Benutzer',
    'role.coach': 'Coach',
    'role.admin': 'Admin',
    'status.active': 'aktiv',
    'status.suspended': 'gesperrt',
    'status.deleted': 'gelöscht',

    // --- onboarding ---
    'onboarding.step': 'Kurzanleitung · {step, number} von {total, number}',
    'onboarding.close': 'Anleitung schließen',
    'onboarding.skip': 'Überspringen',
    'onboarding.back': 'Zurück',
    'onboarding.next': 'Weiter',
    'onboarding.getStarted': 'Los geht’s',
    'onboarding.welcome.title': 'Willkommen bei NutriLens',
    'onboarding.welcome.body':
        'Kalorien und Makros, neu gedacht. Erfassen Sie Mahlzeiten in Sekunden und sehen Sie genau, was Ihren Tag trägt.',
    'onboarding.targets.title': 'Tagesziele & Plan',
    'onboarding.targets.body':
        'Setzen Sie ein tägliches Kalorien- und Makroziel passend zu Ihrem Vorhaben — abnehmen, halten oder aufbauen — und sehen Sie Ihren Plan auf einen Blick.',
    'onboarding.scanner.title': 'KI-Lebensmittelerkennung',
    'onboarding.scanner.body':
        'Fotografieren Sie Ihren Teller und lassen Sie Kalorien und Makros schätzen — oder suchen und ergänzen Sie das Lebensmittel manuell.',
    'onboarding.progress.title': 'Fortschritt & Auswertung',
    'onboarding.progress.body':
        'Verfolgen Sie Gewicht und Makrotreue über die Zeit und bleiben Sie mit Ihrer Wochenserie dran.',
    'onboarding.ready.title': 'Sie sind startklar',
    'onboarding.ready.body':
        'Das war es. Legen Sie einen Plan an oder erfassen Sie Ihre erste Mahlzeit über die Übersicht.',

    // --- admin ---
    'admin.overview.title': 'Übersicht',
    'admin.overview.subtitle': 'Plattformweite Aktivität auf einen Blick.',
    'admin.overview.statsError': 'Die Plattformstatistik konnte nicht geladen werden.',
    'admin.overview.totalUsers': 'Benutzer gesamt',
    'admin.overview.suspendedDetail': '{count, number} gesperrt',
    'admin.overview.admins': 'Admins',
    'admin.overview.activePlans': 'Aktive Ernährungspläne',
    'admin.overview.mealLogs7d': 'Mahlzeiten (7 T)',
    'admin.overview.mealLogs30dDetail': '{count, number} in den letzten 30 T',
    'admin.overview.signups': 'Registrierungen, letzte 30 Tage',
    'admin.overview.noSignups': 'In diesem Zeitraum gab es noch keine Registrierungen.',
    'admin.overview.signupsSeries': 'Registrierungen',

    'admin.users.title': 'Benutzer',
    'admin.users.subtitle': 'Konten suchen, filtern und verwalten.',
    'admin.users.searchPlaceholder': 'Nach E-Mail oder Name suchen…',
    'admin.users.search': 'Suchen',
    'admin.users.allRoles': 'Alle Rollen',
    'admin.users.allStatuses': 'Alle Status',
    'admin.users.filterByRole': 'Nach Rolle filtern',
    'admin.users.filterByStatus': 'Nach Status filtern',
    'admin.users.changeRoleFor': 'Rolle ändern für {email}',
    'admin.users.colUser': 'Benutzer',
    'admin.users.colRole': 'Rolle',
    'admin.users.colStatus': 'Status',
    'admin.users.colJoined': 'Beigetreten',
    'admin.users.colActions': 'Aktionen',
    'admin.users.loadError': 'Die Benutzer konnten nicht geladen werden.',
    'admin.users.emptyTitle': 'Keine Benutzer passen zu diesen Filtern',
    'admin.users.emptySearchBody':
        'Zu „{query}“ passt mit den aktuellen Rollen-/Status-Filtern niemand. Versuchen Sie eine andere Suche oder setzen Sie die Filter zurück.',
    'admin.users.emptyFilterBody':
        'Zu den gesetzten Rollen-/Status-Filtern passt niemand. Setzen Sie sie zurück, um alle zu sehen.',
    'admin.users.clearFilters': 'Filter zurücksetzen',
    'admin.users.reactivate': 'Reaktivieren',
    'admin.users.suspend': 'Sperren',
    'admin.users.suspendConfirmGroup': 'Sperrung bestätigen für {email}',
    'admin.users.suspendQuestion': 'Sperren?',
    'admin.users.confirm': 'Bestätigen',
    'admin.users.cannotSuspendSelf': 'Sie können Ihr eigenes Konto nicht sperren.',
    'admin.users.total': '{count, plural, one {# Benutzer} other {# Benutzer}} — {page}',

    'admin.audit.title': 'Protokoll',
    'admin.audit.subtitle':
        'Jede Rollen- und Statusänderung durch Admins, neueste zuerst.',
    'admin.audit.colWhen': 'Wann',
    'admin.audit.colAction': 'Aktion',
    'admin.audit.colChange': 'Änderung',
    'admin.audit.colTarget': 'Betroffenes Konto',
    'admin.audit.colActor': 'Ausgeführt von',
    'admin.audit.loadError': 'Das Protokoll konnte nicht geladen werden.',
    'admin.audit.emptyTitle': 'Noch keine Admin-Aktionen',
    'admin.audit.emptyBody':
        'Rollen- und Statusänderungen durch Admins erscheinen hier, neueste zuerst.',
    'admin.audit.action.role_change': 'Rolle geändert',
    'admin.audit.action.status_change': 'Status geändert',
    'admin.audit.target': 'Betroffen',
    'admin.audit.actor': 'Ausgeführt von',
    'admin.audit.total': '{count, plural, one {# Eintrag} other {# Einträge}} — {page}',
};

export default de;
