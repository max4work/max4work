# max4work – Claude Code Projektdokumentation

## Was ist max4work?

Vollständige Einzelunternehmer-Büro-App als reine HTML/CSS/JS-App (kein Server, kein Backend).
Alle Daten im `localStorage` des Browsers. Läuft lokal via `file://` und wird über iCloud Drive synchronisiert.

**Betreiber:** Jürgen Stupar, Einzelunternehmer, Braunschweig

## Projektpfad

```
/Users/Juergen/Library/Mobile Documents/com~apple~CloudDocs/Desktop/max4work/
```

## GitHub & Hosting

- **Repository:** https://github.com/max4work/max4work (Account: max4work)
- **Hosting:** Cloudflare Workers (Static Assets) — **https://max4work.com** ✓ LIVE
  - Worker: `max4work` auf `max4work.stupar-j.workers.dev`
  - Custom Domain: max4work.com → Cloudflare Worker (Produktion)
  - `wrangler.jsonc`: `main: "worker.js"`, `assets.binding: "ASSETS"`, `html_handling: "none"`, `not_found_handling: "404-page"`
  - `worker.js`: leitet `/` auf `/index.html` weiter, alle anderen Requests → `env.ASSETS.fetch()`
  - DNS: Cloudflare verwaltet (Nameserver: arvind + elma.ns.cloudflare.com)
  - GitHub Pages DNS-Records gelöscht (2026-06-19): 4× A-Record @, CNAME www
- **GitHub Pages:** https://max4work.github.io/max4work/ (Repo bleibt, aber DNS nicht mehr darauf)
- **Git Push:** `git -C "/Users/Juergen/Library/Mobile Documents/com~apple~CloudDocs/Desktop/max4work" push`
- **Xcode CLT:** Pfad gesetzt via `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`

## Dateistruktur

```
max4work/
├── CLAUDE.md                        # Diese Datei
├── CNAME                            # GitHub Pages Custom Domain (Inhalt: max4work.com)
├── shared.js                        # Zentrale Logik (Design, Navigation, Utilities)
├── css/
│   └── shared.css                   # Globales CSS + Mobile-Breakpoints
├── js/                              # Seitenspezifische JS-Module
│   ├── einstellungen.js             # ~1033+ Zeilen
│   ├── rechnungen.js                # ~2643 Zeilen (Teilzahlungen, E-Mail-Modal, GoBD-Log)
│   ├── angebote.js                  # Angebote-Modul (NEU Session 45)
│   ├── auswertung.js
│   ├── belege.js
│   ├── datentransfer.js             # wird in einstellungen.html geladen
│   ├── kunden.js
│   ├── fahrtenbuch.js
│   ├── werkzeuge.js
│   ├── index.js
│   ├── termine.js
│   └── zahlungen.js                 # Modul, in rechnungen.html geladen
├── index.html                       # Dashboard
├── angebote.html                    # Angebotsverwaltung (NEU Session 45)
├── rechnungen.html                  # 3 Views: Rechnungen / Zahlungen (integriert)
├── kunden.html
├── fahrtenbuch.html
├── belege.html
├── termine.html
├── produkte.html
├── auswertung.html
├── einstellungen.html               # 10 Tabs (inkl. Datentransfer + Account)
├── pw-reset.html                    # Passwort-Reset via Sicherheitsfrage (Auth-Exempt)
├── werkzeuge.html
├── 404.html
├── manifest.json                    # PWA-Manifest
├── logo.png
├── Max4Work App Logo.png
└── Backups/                         # Zwischenspeicherungen (kein Upload nötig)
    └── backup_YYYY-MM-DD_HH-MM/
```

## Architektur-Regeln

- **Kein Server, kein Build-System** – alles läuft direkt im Browser via `file://`
- **shared.js wird von jeder HTML-Seite geladen** – Änderungen daran wirken global
- **Seitenspezifische Logik** liegt in `/js/*.js`, nicht inline in HTML
- **CSS** ausschließlich in `/css/shared.css` (globale Variablen) oder seitenspezifischer `<style>`-Block in der HTML-Datei
- **Globale Konstanten** (`RECH_KEY`, `LOGO_KEY`, `DRAFT_KEY`, `EINSTELL_KEY`, `SCHEME_KEY`, `APP_DESIGN_KEY`) sind in shared.js deklariert → in keiner anderen Datei nochmal mit `const` deklarieren

## CSS-Variablen (shared.css) – IMMER diese verwenden

`--bg`, `--surface`, `--border`, `--text`, `--muted`, `--soft`, `--accent` (#C8D93A), `--accent-pale`, `--dark`, `--green`, `--red`, `--sidebar` (220px), `--r` (14px)

**Nicht verwenden:** `--text-muted`, `--radius`, `--danger` (existieren nicht)

## Design-Patterns (konsistent über alle Seiten)

- Buttons: `.btn .btn-blue` (Primary), `.btn .btn-ghost` (Sekundär mit Border)
- Filterleiste: `.filter-tabs` > `.ftab` / `.ftab.on`
- Statistiken: `.stats-row` > `.stat-card` > `.stat-label` + `.stat-value`
- Tabellen: `.panel` > `<table>` mit `thead th` (uppercase, muted) + `tbody tr:hover` soft
- Modals: `.overlay.open` > `.modal` > `.modal-head` + `.modal-body` + `.modal-footer`
- Layout: `<main class="main">` + `.topbar` (`.page-name` + `.topbar-right`) + `.content`

**Ausnahmen:** `produkte.html` lädt kein `css/shared.css` → Mobile-CSS vollständig inline. `produkte.html` verwendet `.main-wrap` (statt `.main`), `.topbar-title` (statt `.page-name`), `.topbar-left` + `.topbar-actions` (statt `.topbar-right`).

## shared.js – Zentrale Funktionen

### Design-System (IIFE verhindert FOUC beim Seitenstart)
- `APP_DESIGNS` – 3 Designs: `standard`, `ios`, `android`
- `applyAppDesign(name)` – setzt CSS-Variablen auf `document.documentElement`
- `applyColorScheme(mode)` – `'light'|'dark'|'split'|'system'`
- Split-Mode: Sidebar dunkel, Hauptbereich hell (CSS Custom Properties in Sidebar)

### Navigation
- `initSidebarSubNav()` – aufklappbare Sub-Menüs für Kunden, Einstellungen, Werkzeuge
- `initMobileNav()` – Hamburger-Button + Slide-in Sidebar für Smartphones
- `refreshSubNav()` – aktive Hervorhebung nach Tab-/View-Wechsel

### Utilities
- `updatePill()` – Zähler offene Rechnungen in Sidebar
- `doQuickBackup()` – JSON-Download aller localStorage-Daten
- `_checkBackup()` – Backup-Erinnerungs-Banner (`#_backupBanner`)

## localStorage-Keys

| Key | Inhalt |
|-----|--------|
| `max4work_app_design` | `'standard'\|'ios'\|'android'` |
| `max4work_color_scheme` | `'light'\|'dark'\|'split'\|'system'` |
| `max4work_einstellungen` | Firmendaten (sName, strasse, plz, ort, tel, email, web, steuernr, iban, bic, bank, zahltext) |
| `max4work_features` | Feature-Toggles inkl. `livePreview` |
| `max4work_kunden` | `{ id, name, strasse, ort, tel, email, turnus, status, notiz, km }` |
| `max4work_produkte` | `{ id, name, artnr, kategorie, einheit, ust, ek_netto, vk_netto, ... }` |
| `max4work_rechnungen` | Rechnungsarray |
| `max4work_rechnungen_history` | Verlauf |
| `max4work_rechnung_draft` | Aktueller Entwurf |
| `max4work_rechnung_config` | Blatt-Design-Einstellungen (template, layout, docType, font, size, accent, felder, texte, zahlungstage) |
| `max4work_belege` | Belegearray |
| `max4work_termine` | Terminearray |
| `max4work_zahlungen` | Zahlungsarray |
| `max4work_fahrzeuge` | `{ id, kz, typ, farbe, baujahr, tuev, hu, oel, notiz, fin, marke, handelsbezeichnung, hubraum, leistung, kraftstoff, fahrzeugklasse, sitzplaetze, vmax, leergewicht, gesamtmasse, co2, umwelt, o1, o2, foto }` |
| `max4work_rechnungen` | Felder inkl. `locked: boolean, lockedAt: ISO-Timestamp` (GoBD-Sperre nach erstem PDF-Export) |
| `max4work_ocr_key` | OCR.space API-Key (optional, Default: Demo-Key `helloworld`) |
| `max4work_gobd_log` | GoBD-Audit-Log `{ ts, aktion, nr, kunde, betrag?, von?, nach?, zahlungsart? }[]` |
| `max4work_angebote` | Angebote `{ id, nr, datum, gueltig, status: 'offen'\|'gesendet'\|'angenommen'\|'abgelehnt'\|'verrechnet', kunde, email, betreff, notiz, betrag, positions: [{desc, qty, unit, price, vat}] }[]` |
| `max4work_mahn_config` | Mahnungseinstellungen `{ stufe1/2/3: { bezeichnung, tage, gebuehr, text } }` |
| `max4work_wiederkehrend` | Wiederkehrende Rechnungs-Vorlagen `{ id, aktiv, kunde, intervall, naechste, positions, cStreet, cPlz, cCity, zuletzt }[]` |
| `max4work_blattvorlagen` | Gespeicherte Blatt-Design-Vorlagen `{ id, name, cfg }` |
| `max4work_email_settings` | E-Mail-Konto + Vorlagen + Signatur |
| `max4work_email_signaturen` | Gespeicherte Signaturen |
| `max4work_fahrt_pending` | Pendende Fahrt von Termine → Fahrtenbuch |
| `max4work_logo` | Firmenlogo als Base64 |
| `max4work_last_backup` | Timestamp letztes Backup |
| `max4work_backup_interval` | Backup-Erinnerungsintervall (Tage) |
| `max4work_layout_config` | Auswertung Layout `{ order: string[], spans: {key:number}, heights: {key:number} }` |
| `max4work_geocache` | Geocoding-Cache (Adressen → Koordinaten) |
| `max4work_kunden_view` | `'liste'\|'karte'` |
| `max4work_portale` | Behörden-Zugangsdaten |
| `max4work_xrechnungen` | XRechnung-Daten |
| `max4work_auth` | `{ hash, user, secQ, secAHash }` – Login-Credentials; Fallback-Hash `_H0`/`_ACC_H0` = `sha256("juergen:max4work")` = `716933019166307e67137c1af99259be1f2117a1d7434a1105f28d083a55afb4`; wird beim ersten Login automatisch gesetzt |
| `max4work_login_fail` | `{ count, until }` – Brute-Force-Zähler |
| `max4work_auto_logout` | `0\|15\|30\|60` – Auto-Abmeldung nach Inaktivität (Minuten, 0 = Aus) |

## Seiten & Features

### index.html – Dashboard
- KPI-Kacheln (`.kpi`) + Firmenlogo im Welcome-Bereich
- `loadWelcome()` in js/index.js: lädt Logo + Firmenname aus localStorage
- Panel „Aufträge für Heute": zeigt nur heutige Termine mit Kundenname, Telefon, Ort (`loadAuftraegeHeute()`)
- Panel „Offene Rechnungen": Schnellübersicht fällige Beträge

### rechnungen.html – 3 Views
- **View-Tabs-Bar** (`.view-tabs-bar`) mit Rechnungen / Zahlungen direkt unter dem Topbar
- `listeView` (Rechnungsliste), `formView` (Rechnungsformular), `zahlungenView` (Zahlungen)
- `max4work_rechnungen_view` in localStorage: `'rechnungen'` | `'zahlungen'`
- `showZahlungenView()` / `showRechnungenView()` in Inline-Script am Ende
- Init-Script patcht `showListe()` + `showForm()` aus rechnungen.js per Monkey-Patch
- `js/zahlungen.js` wird nach `js/rechnungen.js` geladen
- Zahlungen-Modal: `id="overlay"` (kein Konflikt – alle anderen Rechnungen-Modals haben andere IDs)
- A4-Live-Vorschau (deaktivierbar via Feature-Toggle)
- XRechnung UBL 2.1 / EN 16931 Auto-Export
- DATEV EXTF-Buchungsstapel-Export (`exportDatev()`)
- GiroCode QR (EPC-Standard)
- Filter-Tabs: `.ltab` (nicht `.ftab`)
- **Mobile Topbar (Session 23):** `#topbarLeft` (`.topbar-left`) enthält `← Zur Liste`-Button (ganz links); wird in `showListe()` / `showForm()` / Parken-Wiederherstellung in rechnungen.js synchronisiert (3 Stellen: ~L410, ~L459, ~L1722) sowie im Inline-Script

### kunden.html
- Liste + Kartenansicht (Leaflet.js, OpenStreetMap)
- PLZ-Feld getrennt + Auto-Ort via zippopotam.us API
- Ort-Format im localStorage: `"PLZ Stadt"` (z. B. "38100 Braunschweig")
- Mini-Karte im Modal bei Adresseingabe

### belege.html
- Belege mit Kennzeichen-Autocomplete aus Fuhrpark
- DATEV EXTF-Export (`exportDatevBelege()`)
- Steuerberater-Export

### fahrtenbuch.html
- Fahrtenerfassung + Fuhrpark-Modal
- `max4work_fahrt_pending` auslesen beim Start (kommt von Termine → „Fahrt erfassen")
- Felder: `#fStartOrt`, `#fZielOrt`, `#fStartKm`, `#fEndKm`
- `#startKmImg`, `#endKmImg` existieren NICHT im HTML → immer null-sicher ansprechen

### termine.html
- Kalender + Liste, Farbwähler, Autocomplete (Titel/Kunde)
- ICS Export + Import (Duplikat-Erkennung via `icsUID`)
- „Fahrt erfassen" Button in Termin-Detail → schreibt `max4work_fahrt_pending`

### einstellungen.html – 9 Tabs

| Tab | data-section | Inhalt |
|-----|-------------|--------|
| Design | `design` | Hell/Dunkel/Split/System, App-Design (Standard/iOS/Android) |
| Firma | `firma` | Unternehmensdaten, Bank, Zahlungstext, Mahnungseinstellungen |
| Funktionen | `funktionen` | Feature-Toggles inkl. Live-Vorschau |
| Daten & Sync | `daten` | Backup, iOS WebCal-Abo, Steuerberater-ZIP, GoBD-Export |
| Portale | `portale` | ELSTER, BZSt, Finanzamt, DRV, BG, sv.net |
| Handbuch | `handbuch` | 12 aufklappbare Kapitel |
| Blatt-Design | `rechnung` | A4-Vorschau, 10 Layouts, Schrift, Farbe, Felder, Texte, Vorlagen |
| E-Mail | `email` | Absender, Textvorlagen (4 Typen), Signatur + Meine Signaturen |
| Datentransfer | `datentransfer` | CSV-Import (7 App-Presets), CSV-Export, ZIP-Backup |
| Account | `account` | Zugangsdaten (User+PW), Sicherheitsfrage, Auto-Abmeldung, Brute-Force-Info |

**Wichtig:** `showSection(id)` setzt `display: grid` für `rechnung`, `display: flex` für alle anderen.
`js/datentransfer.js` wird in einstellungen.html VOR einstellungen.js eingebunden.
`.content` max-width: **1221px** (wegen Blatt-Design-Zweispalter).
`#section-rechnung`: `grid-template-columns: 1fr 595px`.

### werkzeuge.html – 5 Tools
- Angebot, m²-Rechner, Kamera, MwSt-Rechner, Stundensatz-Rechner

## Blatt-Design (einstellungen.js)

- `INV_CONFIG_KEY = 'max4work_rechnung_config'`
- 10 Layouts: Standard, Neutral, Elegant, Technisch, Geometrisch, Dynamisch, Klassik, Schwarz, Blau, Schlicht
- 4 Inhalt-Vorlagen: Standard, Kleinunternehmer, Professionell, Minimalistisch
- Schrift-Dropdown: 6 Google Fonts + 37 Windows-Systemschriften (Custom Dropdown `.fdd-wrap`)
- Akzentfarben: `_INV_PALETTE[]` + Auto + Custom `input[type=color]`
- `renderInvPreview()`: baut vollständige A4-Vorschau als innerHTML in `#invA4Paper`

## Mobile (Smartphones)

- `@media (max-width: 768px)` in shared.css: `body { zoom: 0.837 }`, Sidebar off-canvas
- `initMobileNav()` in shared.js: Hamburger-Button + Overlay per JS injiziert
- Modals auf Mobile: Bottom-Sheet-Style (`border-radius: 20px 20px 0 0`)
- Kalender-Zellen: `#daysGrid .day-cell`, Termin-Marker: `.day-cell.has-events`

### Mobile Topbar-Pattern (Session 23)
Topbar verwendet `display: flex` + absolut zentrierten Titel:
```css
.topbar { display: flex; align-items: center; position: relative; }
.page-name { position: absolute; left: 0; right: 0; text-align: center; pointer-events: none; z-index: 0; }
.topbar-left { flex-shrink: 0; position: relative; z-index: 1; }   /* Zurück-Button / Sekundär-Aktion links */
.topbar-right { margin-left: auto; position: relative; z-index: 1; } /* Primär-Aktion rechts */
```
- Titel ist echte Mitte, unabhängig von Button-Breite links/rechts
- `.topbar-left` und `.topbar-right` liegen über dem absoluten Titel (`z-index: 1`)
- iOS Safe Area: `env(safe-area-inset-top, 0px)` auf `.topbar`
- iOS Zoom-Prevention: `font-size: 16px !important` auf alle Inputs/Selects/Textareas
- Touch-Targets: `min-height: 44px` auf interaktiven Elementen
- Filter-Tabs: `flex-wrap: nowrap; overflow-x: auto` (horizontal scrollbar statt umbrechen)

### Lokaler Dev-Server (iPhone-Zugriff)
```bash
cd /Users/Juergen/Library/Mobile\ Documents/com~apple~CloudDocs/Desktop/max4work
python3 -m http.server 8080
# Erreichbar unter: http://192.168.178.196:8080 (WLAN)
```

## Bekannte Fallstricke

- `#_backupBanner` kann Buttons überlagern → bei Tests mit `force:true` klicken
- `shared.js` deklariert globale Konstanten → in anderen Dateien NICHT nochmal mit `const`
- `#startKmImg`, `#endKmImg`, `#startKmOcrStatus`, `#endKmOcrStatus` existieren nicht im HTML → immer `?.` verwenden
- `jahresabschluss-vorschau.html`: `user-scalable=no` gesetzt ✅
- `max4work_fahrt_pending`: wird von `terminToFahrt()` geschrieben, `load()` in fahrtenbuch.js liest beim Start aus ✅

## Coding-Hinweise

- Kein TypeScript, kein Framework, kein Build-Step
- ES6+ (Arrow Functions, Template Literals, Destructuring) ist ok
- Keine externen npm-Pakete – Leaflet.js, jsPDF, QRCode.js werden per CDN eingebunden
- Dark Mode testen: IIFE in shared.js darf keinen FOUC verursachen
- Massenedits in shared.js: Python-Skript oder sed bevorzugen

## Sidebar-Reihenfolge

Dashboard → Rechnungen (Rechnungen | Zahlungen) → Kunden (Liste | Karte) → Belege → Termine →
Produkte → Auswertung → Einstellungen (Design | Firma | Funktionen | Daten & Sync | Portale | Handbuch | Blatt-Design | E-Mail | Datentransfer | Account) → Werkzeuge (Angebot | m² | Kamera | MwSt | Stundensatz) → **Fahrtenbuch** (ganz unten)

## Letzter Stand (2026-06-21)

- Sessions 1–50 abgeschlossen
- **21.06.2026 Session 50 – Housekeeping:**
  - **.gitignore:** `.wrangler/` ergänzt (Cloudflare-Tool-Cache soll nicht ins Repo)
  - **Git:** Commit `79152db`

- **21.06.2026 Session 49 – Auswertung Layout-Editor:**
  - **auswertung.html:** Alle 10 Panels in `.tile-wrap[data-key="panel_..."]` gewrapped; CSS für Edit-Mode (`.layout-bar`, `.le-*`); 3 Topbar-Buttons `#btnLayoutEdit / #btnLayoutSave / #btnLayoutCancel`
  - **js/auswertung.js:** `panel_monat` zu PANEL_CONFIG + PANEL_SPANS; `getPanelLayout()` → `getLayoutConfig()` / `saveLayoutConfig()` (Key: `max4work_layout_config`); `applyPanelLayout()` neu (Wrapper-basiert); Edit-Mode: `enterEditMode()`, `exitEditMode()`, `_injectEditBars()`, `leMoveLeft/Right()`, `leSetSpan()`, `leSetHeight()`
  - **UX:** ⊞-Button → Edit-Modus → Kacheln live verschieben (◀▶), Breite 1–4 Spalten, Höhe 100–600px → ✓ Speichern in localStorage → bleibt dauerhaft
  - **Backup:** kein separates Backup (direkt gepusht) · **Git:** Commit `61440f0`

- **21.06.2026 Session 48 – Auswertung Redesign (4-Spalten-Layout):**
  - **auswertung.html:** `.content` von `1fr 1fr` auf `repeat(4, 1fr)` umgestellt; `#chartMonatPanel` vereinfacht (chart-only); neues `#monatPanel` für Monatsdetails als separates Panel
  - **auswertung.html – KPI-Fix:** `font-size: clamp(16px, 1.6vw, 24px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis` (Jahresausgaben-Kachel war abgeschnitten)
  - **js/auswertung.js:** Neues `PANEL_SPANS`-Objekt mit fixen `gridColumn`-Werten pro Panel-Key; `applyPanelLayout()` komplett neu (span-basiert, kein half/full-Pairing); `panel_chartMonat` vor `panel_ausstehend` verschoben; alle `allowHalf: false`
  - **Backup:** `Backups/backup_2026-06-21_session48/` · **Git:** Commit `c1761c2`

- **21.06.2026 Session 47 – Layout-Editor Fix:**
  - **einstellungen.html:** `.layout-vis-off` Durchstrich entfernt; `.layout-vis-badge` mit `cursor: pointer; border: none`
  - **js/einstellungen.js:** Badge `<span>` → `<button onclick="togglePanelVisibility(idx)">` ; `renderLayoutEditor()` berücksichtigt `_pendingToggles`; neue Funktion `togglePanelVisibility(idx)`
  - **Backup:** `Backups/backup_2026-06-21_session47/`

- **21.06.2026 Session 46 – Simulation + Bug-Fixes:**
  - Node.js-Simulation 43 Tests → **43 ✅ 0 ❌**
  - **js/rechnungen.js:** GoBD-Log `confirmTeilzahlung()` + `confirmBezahlt()` — `von:` las `r.status` NACH Zuweisung → immer `bezahlt→bezahlt`. Fix: `const vonStatus = r.status` VOR Zuweisung.
  - **js/rechnungen.js:** `openZahlModal()` — Dead code `gesamtBrutto` (nutzte `r.ust` = immer undefined) entfernt.
  - **js/rechnungen.js:** `sendPerEmail()` — `fmt(netto)` ohne Tausendertrennzeichen. Fix: `netto.toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2})`.
  - **angebote.html:** `<select id="fStatus">` fehlte `<option value="verrechnet">` → Status-Reset beim Speichern. Fix: disabled Option ergänzt.
  - **js/kunden.js:** `openKundenkonto()` — leerer `kName` matchte alle Rechnungen via `.includes('')`. Fix: Guard `!kName ? [] : filter(...)`.
  - **js/angebote.js:** `saveAngebot()` — `Date.now()` als ID → Kollision bei schnellen Aufrufen. Fix: `_uniqueId()` = `Date.now()*1000 + (++_idSeq%1000)`.
  - **Backup:** `Backups/backup_2026-06-21_session46/`

- **21.06.2026 Session 45 – Angebote, Kundenkonto, Teilzahlungen, E-Mail-Modal:**
  - **angebote.html + js/angebote.js (NEU):** Angebotsverwaltung mit Status-Filter, Positions-Editor, Gültigkeitsdatum, „→ Als Rechnung"-Button (setzt Status `verrechnet`, übergibt Daten via URL-Params). localStorage-Key: `max4work_angebote`. `_uniqueId()` zur ID-Erzeugung.
  - **js/kunden.js:** Kundenkonto-Slide-in-Panel (440px rechts): Umsatz, offene Beträge, Rechnungen, Angebote, Kontaktdaten. `openKundenkonto(id)` + `closeKundenkonto()`.
  - **js/rechnungen.js:** Teilzahlungen: Zahlungsmodal mit Checkbox „Teilzahlung", Betrag/Datum-Felder, Restbetrag-Anzeige. Status `teilbezahlt` (Teilsumme < Gesamt) → automatisch `bezahlt` (Teilsumme >= Gesamt). `r.teilzahlungen = [{betrag, datum, zahlungsart}]`.
  - **js/rechnungen.js:** E-Mail-Modal statt direktem `mailto:`. Betreff + Textfeld (bearbeitbar), Kopieren-Button (Clipboard API), „E-Mail-Programm öffnen"-Button.
  - **js/rechnungen.js:** `_applyAngebotParams()` — verarbeitet `?ang_*` URL-Params aus angebote.html, öffnet Formular vorausgefüllt, löscht Params via `history.replaceState`.
  - **shared.js:** `max4work_angebote` in `_doSearch()` eingebunden (Icon 📋).
  - **service-worker.js:** `max4work-v10` → `max4work-v11`, `angebote.html` + `js/angebote.js` in SHELL-Array.

- **21.06.2026 Session 44 – DATEV-Schnittstelle als zuschaltbarer Toggle:**
  - **einstellungen.html + js/einstellungen.js:** Toggle „DATEV-Schnittstelle" in Funktionen → App-Funktionen; `datevSchnittstelle: false` in `TOGGLE_DEFAULTS`; `toggleDatevButtons(on)` zeigt/versteckt die Buttons auf anderen Seiten
  - **rechnungen.html + js/rechnungen.js:** `id="datevBtnRechnungen"` + `style="display:none"` default; `applyDatevVisibility()` liest Feature + steuert Sichtbarkeit beim Start + bei `storage`-Event
  - **belege.html + js/belege.js:** `id="datevBtnBelege"` + `style="display:none"` default; `_applyDatevVisibilityBelege()` gleiche Logik
  - **tests/test_max4work.py:** 8 neue Tests `TestDatevSchnittstelle` — 45/45 grün
  - **tests/simulation.html:** `datevSchnittstelle: true` in FEATURES; neu in Git (create mode)
  - **service-worker.js:** `max4work-v9` → `max4work-v10`
  - **GitHub Push:** Commit `de93141`
  - **Backup:** `Backups/backup_2026-06-21_session44/`

  **Playwright-Erkenntnis:** Toggle-Input CSS-versteckt → `label.toggle:has(#id)` für Tests. `#unsavedBar` überlagert Seite nach `markUnsaved()` → `button[onclick='saveAllChanges()']` klicken, nicht `button[onclick='speichern()']`.

- **21.06.2026 Session 43 – Login-Bugfix + Notfall-Admin-Credentials:**
  - **login.html – Bugfix `doUnlock()`:** `localStorage.removeItem('max4work_auth')` entfernt — `doUnlock()` löscht jetzt nur noch `max4work_login_fail` (den Brute-Force-Zähler), nicht mehr die gespeicherten Zugangsdaten. Vorher führte `doUnlock()` dazu, dass geänderte Credentials verloren gingen und der Login auf den Fallback-Hash zurückfiel.
  - **login.html + js/einstellungen.js – Neuer Admin-Fallback-Hash:** `_H0` + `_ACC_H0` auf neuen Hash aktualisiert (entspricht den Wunsch-Credentials des Betreibers). Gilt als Notfall-Zugang wenn localStorage leer ist.
  - **Logik:** localStorage hat Vorrang → normaler Betrieb nutzt gespeicherten Hash. Nur wenn localStorage leer (neues Gerät, Daten gelöscht) → Fallback auf `_H0`/`_ACC_H0` im Code.
  - **service-worker.js:** `max4work-v8` → `max4work-v9`
  - **Backup:** `Backups/backup_2026-06-21_session43/`

## Letzter Stand (2026-06-20)

- Sessions 1–42 abgeschlossen
- **20.06.2026 Session 42 – Bankabgleich (MT940-Import):**
  - **einstellungen.html + js/einstellungen.js:** Neuer Toggle „Bankabgleich" in Funktionen → App-Funktionen
  - Panel „Bankabgleich" (sichtbar wenn Toggle an): MT940-Datei importieren, 3-Kriterien-Abgleich (Betrag + RE-Nr. + Kundenname)
  - Score ≥ 4 → automatisch bezahlt · Score 2–3 → Vorschlag mit Bestätigen-Button
  - Server-URL-Feld bereits eingebaut (deaktiviert) – bei eigenem Server einfach aktivieren
  - **service-worker.js:** `max4work-v7` → `max4work-v8`
  - **Backup:** `Backups/backup_2026-06-20_session42/`

- **20.06.2026 Session 41 – Cloudflare Workers + Login-Fixes (Details siehe project_max4work_struktur.md):**
- **19.06.2026 Session 40 – Kalender-Verbesserungen + Fahrtenbuch Kennzeichen:**
  - **termine.html – Kalenderbereich 10% größer:** `.cal-layout` 320px → 352px; KW-Spalte 28→31px; Padding 12→13px; Heute/Auswahl-Kreis 30→33px; Monatstitel 17→19px; Tageszahlen 14→15px
  - **termine.html – Desktop 15% breiter:** `.cal-layout` 352px → 405px (nur Desktop, Mobile unberührt)
  - **termine.html – Mobile: Monatsname-Farbe:** `.month-title-btn` bekommt `color:var(--text)` → kein Safari-Blau mehr
  - **termine.html – Pfeile neben Monatsname:** `.month-nav` von `justify-content:space-between` auf `center; gap:10px` → Pfeile direkt am Monatsnamen
  - **js/fahrtenbuch.js – Kennzeichen pro Fahrt:** `fahrzeug`-Feld wird beim Speichern aus `#fFahrzeug` übernommen; erscheint in Liste (fett neben km), PDF-Header (alle Fahrzeuge), PDF-Tabelle (neue Spalte KFZ), CSV (neue Spalte Fahrzeug)
  - **termine.html + js/termine.js – iOS-Jahresüberblick:** Klick auf Monatsnamen öffnet Modal mit 12 Mini-Kalendern (4×3 Grid); jeder zeigt echte Tageszahlen; heute = Akzentfarbe; aktiver Monat = Akzentrahmen; Jahrespfeile; Klick → Navigation; Backdrop-Klick oder × schließt
  - **Animation:** Sanftes Ausrollen statt Aufploppen (`scaleY 0.06→1`, 350ms `cubic-bezier(0.22,1,0.36,1)`); Schließen rollt zurück (220ms); Backdrop faded ein/aus
  - **Backup:** `Backups/backup_2026-06-19_session40/` (termine.html, termine.js, fahrtenbuch.js)

## Letzter Stand (2026-06-17)

- Sessions 1–39 abgeschlossen
- **17.06.2026 Session 39 – Account-Einstellungen + Sicherheit:**
  - **login.html – Auth-System modernisiert:**
    - `max4work_auth` (localStorage) als primäre Credential-Quelle; Fallback auf hardcodierten SHA-256 (`_H0`)
    - Hash-Format: `sha256(username + ':' + password)`
    - Brute-Force-Schutz: 5 Fehlversuche → 5 Min Sperre (`max4work_login_fail = { count, until }`)
    - Fehlermeldung zeigt verbleibende Versuche an
    - „Passwort vergessen?"-Link nur sichtbar wenn Sicherheitsfrage in `max4work_auth.secQ` eingerichtet
  - **pw-reset.html (neu) – Passwort-Reset via Sicherheitsfrage:**
    - Auth-Exempt-Seite (in shared.js + login.html Whitelist)
    - 2-Schritt-Flow: Sicherheitsfrage beantworten → neues Passwort setzen
    - Antwort-Vergleich via `sha256(answer.toLowerCase())` === `max4work_auth.secAHash`
    - Bei fehlendem `secQ/secAHash`: Hinweis anstatt Formular
    - Nach Reset: `max4work_login_fail` gelöscht, Weiterleitung zu login.html
  - **shared.js – Auto-Abmeldung:**
    - IIFE `_initAutoLogout()` nach `m4wLogout` eingefügt
    - Liest `max4work_auto_logout` (0/15/30/60 Min) aus localStorage
    - Event-Listener: mousemove / keydown / touchstart / click / scroll → Timer reset
    - Timer-Callback: ruft intern doLogout (kein `m4wLogout`-Referenz-Problem)
    - Auth-Exempt-Liste um `pw-reset.html` erweitert
  - **einstellungen.html + js/einstellungen.js – Account-Tab (10. Tab):**
    - Tab-Button: SVG Person-Icon + „Account"
    - `SECTION_TITLES.account = 'Einstellungen – Account'`
    - `_loadAccountTab()` in `load()` eingehängt
    - **Panel 1 – Zugangsdaten ändern:** Aktueller Username + PW (Verifikation) + optionaler neuer Username + optionales neues PW (mit Stärke-Anzeige) + Bestätigung
    - **Panel 2 – Sicherheitsfrage:** Frage + Antwort (SHA-256, lowercase-normiert) + Status-Anzeige
    - **Panel 3 – Sicherheit:** Auto-Abmeldung (Chips: Aus/15/30/60 Min), Brute-Force-Info-Text, „Jetzt abmelden"-Button
    - Neue JS-Funktionen: `_loadAccountTab()`, `accCheckStrength()`, `accSaveCreds()`, `accSaveSecQ()`, `accSetAutoLogout()`
    - CSS: `.pw-strength-bar`, `.pw-strength-fill`, `.pw-strength-text`, `.acc-info-box`, `.acc-danger-btn`
  - **Backup:** `Backups/backup_2026-06-17b/` (login.html, pw-reset.html, einstellungen.html, einstellungen.js, shared.js)
- **17.06.2026 Session 38 – Kalender-Overlap-Fix + iOS Monats-Picker:**
  - **termine.html – Bugfix Kalender-Overlap Mobile:**
    - `max-height: 420px` auf `.cal-left` entfernt (war zu klein seit Session 37 `.mob-view-toggle` ~56px extra hinzukam)
    - `overflow: hidden` auf `.cal-left` gesetzt → letzte KW-Zeile überlappt nicht mehr
    - `.mini-list` + `.cal-stats` auf Mobile ausgeblendet (`display: none !important`) – redundant, da `.cal-right` Events vollständig zeigt
  - **termine.html + js/termine.js – iOS Monats-Picker:**
    - Monatstitel ist jetzt klickbarer Button (`.month-title-btn`) mit Chevron-Pfeil (`#mpChevron`)
    - Chevron dreht sich beim Öffnen/Schließen (`.mp-chevron.open { transform: rotate(180deg) }`)
    - Picker (`#monthPicker`) klappt mit Slide-down-Animation auf (`@keyframes mpIn`)
    - Jahr-Navigation: `< 2026 >` mit `pickerPrevYear()` / `pickerNextYear()`, State `_pickerYear`
    - 12 Monats-Buttons (Jan–Dez) in 4×3-Grid (`.month-picker-grid`, `.mp-month`)
    - Aktueller Monat: Akzentfarbe (`.mp-month.cur`); ausgewählter Monat: Pill-Hintergrund (`.mp-month.on`)
    - `pickMonth(m)` → setzt `viewMonth`/`viewYear`, schließt Picker, `renderCalendar()`
    - Schließt bei Klick außerhalb (document click-Listener, Ausnahme: `.month-nav` + `#monthPicker`)
    - Neue JS-Funktionen: `toggleMonthPicker()`, `closeMonthPicker()`, `_renderMonthPicker()`, `pickerPrevYear()`, `pickerNextYear()`, `pickMonth(m)`
  - **Backup:** `Backups/backup_2026-06-17/` (termine.html, termine.js)
- **15.06.2026 Session 37 – Mobile-Format Durchtest + Fixes:**
  - **Playwright-Screenshottest** (375×812 iPhone-Viewport): 7 Seiten geprüft – kein horizontaler Overflow, Tab-Bar korrekt
  - **fahrtenbuch.html:** `#topMeta`-Text (`0 Fahrten · 0 km gesamt`) auf Mobile ausgeblendet (`display:none`) – kollidierte mit absolut zentriertem `.page-name`-Titel
  - **termine.html:** `.cal-view-toggle` in Topbar auf Mobile ausgeblendet; neues `.mob-view-toggle` direkt über dem Kalender eingefügt (in `.cal-left`, vor `.month-nav`) – `setCalView()` aktualisiert beide Sets via `querySelectorAll('.cal-vbtn')`; `.mob-view-toggle { display:none }` im Haupt-Style, `display:flex !important` im Mobile-Block; Nav-Pfeile 28→40px, `.cal-vbtn` min-height 40px
  - **kunden.html:** `.view-btn` + `.ftab` min-height 44px auf Mobile
  - **einstellungen.html:** `.stab` min-height 44px auf Mobile
  - **css/shared.css:** `.topbar-right .btn` min-height 36→44px
  - **Backup:** `Backups/backup_2026-06-15a/` (fahrtenbuch.html, termine.html, kunden.html, einstellungen.html, shared.css)
- **14.06.2026 Session 36 – Playwright Testsuite (37 Tests, 10 Bereiche):**
  - **tests/test_max4work.py:** 37 automatisierte Playwright-Tests (Python) für alle 10 Bereiche: Kunden, Produkte, Rechnungen, Fahrtenbuch, Belege, Termine, Dashboard, Auswertung, Einstellungen, Werkzeuge
  - **tests/run.sh:** Startskript – `bash run.sh` führt alle Tests aus (~76 Sek., 100% grün)
  - **Technische Besonderheiten:** Login-Bypass via `login.html` (auth-exempt), Backup-Banner via `max4work_last_backup` unterdrückt, Rechnungen-Speichern via `page.evaluate("saveToList()")`, Termine-Overlay via `openAtTime()`, Toggle-Klick via `label.toggle:has(#id)`
  - **Starten:** `cd tests && bash run.sh` oder einzelne Bereiche: `bash run.sh -k kunden`
  - **Backup:** `Backups/backup_2026-06-14h/` (test_max4work.py, run.sh)
- **14.06.2026 Session 35 – Abmelden-Button entfernt + Toggle-Defaults aus:**
  - **einstellungen.html:** Abmelden-Button (Div mit `border-top` + rotem `<button onclick="m4wLogout()">`) komplett entfernt – Sidebar-Button reicht
  - **js/einstellungen.js – `TOGGLE_DEFAULTS`:** Alle 10 Werte auf `false` gesetzt (war `true`) – Toggles sind jetzt standardmäßig aus bis der Nutzer sie aktiviert und speichert
  - **js/einstellungen.js – `isVisible()`:** Fallbacks für unbekannte Keys und Fehlerfall von `true` auf `false`
  - **Backup:** `Backups/backup_2026-06-14g/` (einstellungen.html, einstellungen.js)
- **14.06.2026 Session 34 – Toggles grau + Erscheinungsbild-Standard Hell:**
  - **einstellungen.html – Toggle-Farbe:**
    - `.toggle input:checked + .toggle-track` → `background: #8E8E93` (war `var(--accent)`)
    - Alle Toggles zeigen aktivierten Zustand in Standard-Grau bis Design-Neugestaltung
  - **shared.js + js/einstellungen.js – Erscheinungsbild-Fallback:**
    - Alle `|| 'system'`-Fallbacks für `max4work_color_scheme` auf `|| 'light'` geändert
    - Betrifft: `_sysMQCb()`, `applyAppDesign()`, IIFE in shared.js, `buildSchemeGrid()` in einstellungen.js
    - Neue Nutzer (kein localStorage-Eintrag) sehen jetzt automatisch Hell statt System
  - **Backup:** `Backups/backup_2026-06-14f/` (einstellungen.html, shared.js, einstellungen.js)
- **14.06.2026 Session 33 – Steuerübersicht + Freiberufler-Toggle:**
  - **eur.html – Neue Abschnitte D–G:**
    - **D. Umsatzsteuer §13, §18 UStG:** KU-Erkennung (§19), USt-Ausgangsteuer aus rechnungen_history-Positionen berechnet, UStVA-Fälligkeiten, Jahreserklärung §18 Abs. 3 UStG
    - **E. Gewerbesteuer §11 GewStG:** Freibetrag 24.500 € (§11 Abs. 1 S.3 Nr.1), Messzahl 3,5 % (§11 Abs. 2), Hebesatz Braunschweig 460 % (§16), Vorauszahlungen §19 GewStG, GewSt-Anrechnung §35 EStG erwähnt
    - **F. Einkommensteuer §32a EStG:** Grundfreibetrag 2024/2025, alle 4 Progressionszonen mit §-Angaben, Soli §3 SolZG (Freigrenze 18.130 €), GewSt-Anrechnung §35 EStG (3,8 × Messbetrag)
    - **G. Steuertermine:** UStVA/GewSt/ESt-Vorauszahlungen tabellarisch, Aufbewahrungspflicht §147 AO bis +10 Jahre
    - `renderUSt()`, `renderGewSt()`, `renderESt()`, `renderSteuerTermine()` werden am Ende von `renderDoc()` aufgerufen
  - **auswertung.html + auswertung.js – Neues Panel „Steuerübersicht":**
    - `panel_steuern` in PANEL_CONFIG (`elId: steuerPanel`, `allowHalf: false`)
    - 4-KPI-Zeile: Gewinn vor Steuern, GewSt-Schätzung, ESt+Soli-Schätzung, Gesamtsteuerlast
    - Berechnungsdetail (Freibetrag, Messzahl, Grundfreibetrag, GewSt-Anrechnung)
    - USt-Status-Badge (KU grün / nicht-KU gelb)
    - Steuertermine-Grid (USt, GewSt, ESt) direkt im Panel
  - **einstellungen.html:** Toggle „Steuerübersicht" in Panel-Sichtbarkeit ergänzt
  - **Backup:** `Backups/backup_2026-06-14e/` (eur.html, auswertung.html, auswertung.js, einstellungen.html)
- **14.06.2026 Session 32 – Abmelden-Button:**
  - **einstellungen.html:** Abmelden-Button am Ende des `.content`-Bereichs (unterhalb aller Tabs, immer sichtbar) — roter Icon-Button im iOS-Stil, `onclick="m4wLogout()"`
  - **shared.js – `_injectLogoutBtn()`:** Button wird jetzt an `aside.sidebar` angehängt (statt an `.sidebar-user`); zeigt Icon + Text „Abmelden"; grau (`var(--muted)`), Hover: `var(--soft)` + `var(--text)`; `width:calc(100% - 24px)`, `margin:0 12px`; kein Rot mehr
  - **Backup:** `Backups/backup_2026-06-14d/` (shared.js, einstellungen.html)
- **14.06.2026 Session 31 – SuperShift-inspirierte Kalender-Features:**
  - **termine.html + js/termine.js – 5 neue Features:**
  - **Wochenansicht** (`setCalView('woche')`):
    - Toggle-Buttons „Monat / Woche" in der Topbar (`.cal-view-toggle` > `.cal-vbtn`)
    - 7-Spalten-Grid (Mo–So), Zeitslots 00:00–23:00 à 52px Höhe
    - `#weekView.week-wrap` als Geschwister-Element von `#calLayout` (beide `flex:1`)
    - `viewWeekStart` (Montag der angezeigten Woche), `prevWeek()` / `nextWeek()`
    - Heute-Markierung (roter Kreis im Header), Jetzt-Linie (roter Balken)
    - Ganztägige Events in eigenem `#weekAlldayStrip`
    - Klick auf Tageskopf → `setCalView('monat')` mit dem gewählten Tag
    - `calView` in localStorage gespeichert → bleibt beim Reload erhalten
  - **Wochenstatistik** (`renderStats()`):
    - Zeile `#calStats` unter der Mini-Liste (`.cal-stats`)
    - Zeigt KW-Nummer, Terminanzahl und Gesamtstunden der aktuellen KW
    - Wird bei `renderCalendar()` und `renderWeekView()` aktualisiert
  - **Schnell-Termin** (`openAtTime(ds, h)`):
    - `.time-content` in Tagesansicht hat `onclick="openAtTime()"` → öffnet Modal mit vorausgefüllter Uhrzeit
    - Events in `.time-content` stoppen Propagation (`event.stopPropagation()`)
    - Gleiches Verhalten in `.week-day-cell` der Wochenansicht
    - `openModal(id=null, prefillHour=null)` — zweiter Parameter setzt `f-von` + `f-bis`
  - **Termin duplizieren** (`duplicateTermin(id)`):
    - „Duplizieren"-Button (`#btn-dup`) in der Detail-Ansicht
    - Kopiert alle Felder, vergibt neue `id`, entfernt `gruppeId`
    - Navigiert zur Kopie und zeigt Toast
  - **Wiederholende Termine** (`generateDates()` + `gruppeId`):
    - Formular-Sektion `#wieder-section` (nur beim Anlegen sichtbar, nicht beim Bearbeiten)
    - `#f-wieder`: Keine / Täglich (max. 90) / Wöchentlich (max. 52) / Monatlich (max. 24) / Jährlich (max. 5)
    - `#f-wieder-bis`: optionales Enddatum (blendet sich per `toggleWieder()` ein)
    - Alle Instanzen erhalten `gruppeId: 'g' + Date.now()`
    - **Löschen von Gruppen:** erster Tipp → Button wandelt sich zu „Nur diesen | Alle N löschen"
    - `_delOne(id)` / `_delGroup(gruppeId)` — kein `confirm()`, iOS-kompatibel
  - **Löschen allgemein:** Zwei-Tipp-Muster (`_delTerminPending`, `_delTerminTimer`, 3 s) statt `confirm()`
  - **Backup:** `Backups/backup_2026-06-14c/` (termine.html, termine.js)
- **14.06.2026 Session 30 – Kunden-Suche Mobile + Rechnungen löschen:**
  - **kunden.html – Suchfeld auf Mobile:**
    - `.toolbar { flex-wrap: wrap; gap: 8px }` im `@media (max-width: 768px)`-Block
    - `.search-wrap { width: 100%; max-width: 100%; flex: none; order: -1 }` → volle Breite als eigene Zeile
    - Filter-Tabs (Alle/Aktiv/Inaktiv) + Ansichts-Umschalter bleiben darunter nebeneinander
  - **rechnungen.js – Archivierte Rechnungen löschen:**
    - `deleteRechnung()`: GoBD-Sperre wirft keinen harten Block mehr, sondern zeigt Bestätigungsdialog
    - `delCell` in `renderListe()`: Löschen-Button erscheint jetzt bei allen Einträgen (archiviert = Opacity 0.45)
    - Protokollierung via `_gobdLog('loesch-forciert', ...)` erhalten
  - **Backup:** `Backups/backup_2026-06-14b/` (rechnungen.js, kunden.html)
- **14.06.2026 Session 29 – Tab Bar Icons + Externe Kalender + Frosted Glass:**
  - **Externe Kalender abonnieren (einstellungen.html / einstellungen.js):**
    - Neues Panel „Externe Kalender abonnieren" in Tab „Daten & Sync"
    - `addExtKalender()`, `delExtKalender(id)`, `syncExtKal(id)`, `syncAlleExtKal()`, `renderExtKalListe()`, `_extParseICS()`, `_extMapEvent()`
    - Externe Events: `{ extern: true, externSrc: id, farbe: kal.farbe }` in `max4work_termine`
    - CORS: `webcal://` → `https://` Konvertierung; Fehlertext bei fehlschlagendem Fetch
    - `max4work_ext_kalender` localStorage-Key
  - **Tab Bar – Frosted Glass (shared.css):**
    - `background: rgba(255,255,255,0.80)`, `backdrop-filter: blur(28px) saturate(200%)`
    - Inaktiv: `color: rgba(0,0,0,0.35)`, Aktiv: `color: var(--dark)` + `background: var(--accent-pale)` auf Icon-Span
  - **Tab Bar – Dashboard-Icon (shared.js + index.html + kassenbuch.html):**
    - `_MOB_IC.house` → 2×2 Grid-Icon (4 Rechtecke `rx="1"`, `stroke-width="1.85"`)
    - Entspricht dem Sidebar-Icon für Dashboard, das in 8 von 10 Dateien bereits verwendet wird
    - `index.html` + `kassenbuch.html`: `◻` Platzhalter → Grid-SVG (konsistent mit allen anderen Seiten)
  - **Backup:** `Backups/backup_2026-06-14/` (shared.js, shared.css, index.html, kassenbuch.html, einstellungen.html)
- **13.06.2026 Session 28 – Kalender Wochentrenner + Auto-Push:**
  - **Claude Code Auto-Push Hook:** `~/.claude/settings.json` – PostToolUse Hook auf `Write|Edit`; prüft ob Datei im max4work-Verzeichnis liegt; führt automatisch `git add → commit → push` aus nach jeder Dateiänderung
  - **termine.html – Kalender Wochentrenner:**
    - `.cal-week-sep` Div: `grid-column: 1 / -1`, `height: 1.5px`, `background: rgba(0,0,0,0.20)`, `margin: 3px 0`
    - `.days-grid` umgestellt auf `row-gap: 0; column-gap: 2px` (war `gap: 2px`) → Sep sitzt direkt zwischen den Wochenzeilen ohne Grid-Abstand
    - Sep-Div als eigene Grid-Zeile (nicht als `border-bottom` auf Zellen, da `border-radius: 50%` auf `.day-cell` Linien als Bogen darstellen würde)
  - **Backup:** `Backups/backup_2026-06-13/` (termine.html, termine.js)
- **12.06.2026 Session 27 – iOS Kalender-Sync + Instagram Tab Bar:**
  - Siehe unten

- Sessions 1–26 abgeschlossen
- **12.06.2026 Session 26 – Floating Pill Tab Bar:**
  - `css/shared.css`: Tab Bar komplett neu — schwebendes Pill-Design (dunkel, Blur, kein Border-Top)
  - Positionierung ohne `transform` (`left:0; right:0; margin:0 auto; width:fit-content`) → iOS `position:fixed` stabil
  - `will-change: transform` + `-webkit-transform: translateZ(0)` → GPU-Layer, scrollt nicht mit
  - Icons 27×27px, Tab-Item 58×48px, Labels ausgeblendet
  - Position: `bottom: calc(76px + ...)`, `.main` padding-bottom: `calc(88px + ...)`
  - Backup: `Backups/backup_2026-06-12/shared.css`
- **12.06.2026 Session 25 – GitHub Hosting:**
  - Git-Repository initialisiert und auf github.com/max4work/max4work gepusht (39 Dateien)
  - GitHub Pages aktiviert: https://max4work.github.io/max4work/ (getestet ✓)
  - Custom Domain max4work.com: CNAME-Datei erstellt, DNS bei IONOS eingerichtet
  - Xcode CLT auf MacBook repariert (`sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`)
  - .gitignore erstellt (backups/, .DS_Store, *.icloud ausgeschlossen)
- **11.06.2026 Session 24 – Login-System:**
  - `login.html` (neu): Standalone-Login mit SHA-256-Hash-Prüfung, „Angemeldet bleiben"-Checkbox, kein shared.js (kein Redirect-Loop)
  - `shared.js`: Auth-Guard-IIFE ganz oben (synchron), `m4wLogout()`, `_injectLogoutBtn()` → Logout-Icon in Sidebar; Ausnahmen: login.html, reset.html
  - `rechnungen.html`: Parken-Icon `💾` → SVG (Parken-Button, Entwürfe-Button, Modal-Titel)
  - Backup: `Backups/backup_2026-06-11b/`
- **11.06.2026 Session 23 – Mobile-Optimierung:**
  - shared.css: Topbar Grid → Flex; `.page-name` absolut zentriert (`position: absolute; left:0; right:0`); `.topbar-left` neue CSS-Klasse; iOS-Zoom-Prevention (`font-size: 16px !important`); Touch-Targets `min-height: 44px`; Filter-Tabs `flex-wrap: nowrap + overflow-x: auto`
  - index.html (Dashboard): Mobile Topbar weißer Rahmen wiederhergestellt, Button compact (`white-space: nowrap`); KPI, Chart, Welcome optimiert
  - rechnungen.html + rechnungen.js: `← Zur Liste` in `#topbarLeft` (.topbar-left) ganz links verschoben; aus `#topbarActionsForm` entfernt; 4 Sync-Stellen (showListe, showForm, Parken, Inline-Script)
  - produkte.html: Importieren-Button in `.topbar-left` (links); `+ Neues Produkt` in `.topbar-actions` (rechts); Mobile-CSS von Grid auf Flex umgestellt; Buttons nicht mehr versteckt
  - Lokaler Dev-Server: `python3 -m http.server 8080`, IP `192.168.178.196:8080`
  - Backup: `Backups/backup_2026-06-11/`
- **09.06.2026 Session 22:** Bugfix `datentransfer.js` – `const FIELDS`/`const APP_MAPS` → `DT_FIELDS`/`DT_APP_MAPS` (Scope-Kollision)
- **09.06.2026:** Datentransfer als 9. Tab in Einstellungen; Zahlungen in Rechnungen integriert (zahlungen.html gelöscht, View-Tabs-Bar)
- **08.06.2026 Abend:** `highlightOverdue` Toggle fix; Quartalsübersicht-Panel; Globale Suche (Ctrl+K); Browser-Benachrichtigungen
- **07.06.2026:** GoBD-Schutz, Mahnwesen 3 Stufen, Dashboard „Aufträge für Heute"
- **06.06.2026:** kunden.js – PLZ/Ort getrennt + zippopotam.us
- Playwright-Tests: 5/5 ✅ (08.06. Abend), 30/30 ✅ (Session 13), 60/60 ✅ (Session 12)
- Deployment auf max4work.com: noch ausstehend (erst wenn App fertig)
