"""
max4work – Playwright Testsuite
Ausführen: cd tests && bash run.sh
"""

import pytest
import json
import re
import threading
import http.server
import functools
from playwright.sync_api import sync_playwright, Page, expect

APP_DIR  = "/Users/Juergen/Library/Mobile Documents/com~apple~CloudDocs/Desktop/max4work"
PORT     = 8765
BASE_URL = f"http://localhost:{PORT}"

# ─────────────────────────────────────────────
# HTTP-Server (läuft für alle Tests)
# ─────────────────────────────────────────────
class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

@pytest.fixture(scope="session", autouse=True)
def http_server():
    handler = functools.partial(_QuietHandler, directory=APP_DIR)
    srv = http.server.HTTPServer(("localhost", PORT), handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    yield
    srv.shutdown()

# ─────────────────────────────────────────────
# Browser-Fixtures
# ─────────────────────────────────────────────
@pytest.fixture(scope="session")
def browser_instance():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=False, slow_mo=300)
        yield b
        b.close()

@pytest.fixture()
def page(browser_instance):
    ctx = browser_instance.new_context()
    pg  = ctx.new_page()
    pg.on("dialog", lambda d: d.accept())
    yield pg
    ctx.close()

# ─────────────────────────────────────────────
# Basis-localStorage für alle Tests
# ─────────────────────────────────────────────
_NOW_MS = str(int(__import__("time").time() * 1000))

_BASE = {
    "m4w_sess": "1",
    # Backup-Banner unterdrücken (Banner blockiert sonst Klick-Events)
    "max4work_last_backup": _NOW_MS,
    "max4work_features": json.dumps({
        "autoSuggestInvoice": True, "livePreview": True, "highlightOverdue": True,
        "panel_kpiGrid": True, "panel_bank": True, "panel_top5": True,
        "panel_kleinunternehmer": True, "panel_ausstehend": True,
        "panel_chartMonat": True, "panel_chartVergleich": True, "panel_quartal": True,
    }),
    "max4work_einstellungen": json.dumps({
        "sName": "Testfirma GmbH", "sContact": "Max Muster",
        "sStrasse": "Musterstraße 1", "sOrt": "38100 Braunschweig",
        "sStNr": "15/123/12345", "sEmail": "test@testfirma.de",
    }),
}

# ─────────────────────────────────────────────
# Test-Daten
# ─────────────────────────────────────────────
def _KUNDEN():
    return [
        {"id": 1001, "name": "Müller Bau GmbH", "strasse": "Baustr. 1",
         "ort": "38100 Braunschweig", "tel": "0531 100", "email": "info@mueller.de",
         "turnus": "monatlich", "status": "aktiv", "notiz": "", "km": ""},
        {"id": 1002, "name": "Schmidt IT Services", "strasse": "Techpark 5",
         "ort": "30159 Hannover", "tel": "0511 200", "email": "info@schmidt.de",
         "turnus": "", "status": "inaktiv", "notiz": "Kunde seit 2020", "km": "25"},
    ]

def _PRODUKTE():
    return [
        {"id": 2001, "name": "Beratungsstunde", "artnr": "1001",
         "kategorie": "dienstleistung", "ek_netto": 0, "vk_netto": 80,
         "vk_brutto": 80, "ust": 0, "einheit": "Std"},
        {"id": 2002, "name": "Laptop Dell XPS", "artnr": "1002",
         "kategorie": "artikel", "ek_netto": 600, "vk_netto": 800,
         "vk_brutto": 952, "ust": 19, "einheit": "Stk"},
    ]

def _RECHNUNGEN():
    return [
        {"id": 3001, "nr": "RE-2026-001", "kunde": "Müller Bau GmbH",
         "betrag": 800, "datum": "2026-01-15", "faellig": "2026-02-14",
         "status": "offen", "zahlungsart": "", "typ": "rechnung",
         "kundentyp": "firma", "locked": True, "lockedAt": "2026-01-15T10:00:00.000Z"},
        {"id": 3002, "nr": "RE-2026-002", "kunde": "Schmidt IT Services",
         "betrag": 240, "datum": "2026-02-01", "faellig": "2026-03-02",
         "status": "bezahlt", "zahlungsart": "Überweisung", "typ": "rechnung",
         "kundentyp": "firma", "locked": True, "lockedAt": "2026-02-01T09:00:00.000Z"},
    ]

def _FAHRTENBUCH():
    return [
        {"id": 4001, "datum": "2026-06-01", "startKm": 12000, "endKm": 12045,
         "distanz": 45, "startOrt": "Braunschweig", "zielOrt": "Hannover",
         "abfahrt": "08:00", "ankunft": "09:15", "zweck": "geschaeftlich",
         "kunde": "Müller Bau GmbH", "notiz": "", "startFoto": None, "endFoto": None},
    ]

def _FAHRZEUGE():
    return [{"id": 5001, "name": "VW Golf", "kennzeichen": "BS-XY 123", "typ": "PKW"}]

def _BELEGE():
    return [
        {"id": 6001, "datum": "2026-06-01", "betrag": 45.50,
         "kat": "Büro", "notiz": "Druckerpapier", "steuer": True,
         "dateiname": "", "data": ""},
    ]

def _TERMINE():
    return [
        {"id": 7001, "datum": "2026-06-20", "von": "10:00", "bis": "11:00",
         "titel": "Kundengespräch Müller", "notiz": "", "farbe": "#C8D93A",
         "wiederholung": "keine"},
    ]

# ─────────────────────────────────────────────
# Hilfsfunktion: Seite laden + localStorage setzen
# ─────────────────────────────────────────────
def go(page: Page, path: str, extra: dict = {}):
    # login.html ist auth-exempt → localStorage dort setzen, dann zum Ziel navigieren
    page.goto(f"{BASE_URL}/login.html")
    page.wait_for_load_state("domcontentloaded")
    for k, v in {**_BASE, **extra}.items():
        page.evaluate(f"localStorage.setItem({json.dumps(k)}, {json.dumps(v)})")
    page.goto(f"{BASE_URL}/{path}")
    page.wait_for_load_state("domcontentloaded")


# ═══════════════════════════════════════════════════
# 01 – KUNDEN
# ═══════════════════════════════════════════════════
class TestKunden:

    def test_seite_ladet(self, page):
        go(page, "kunden.html")
        expect(page.locator("#tableBody")).to_be_visible(timeout=5000)

    def test_kunden_aus_localstorage_sichtbar(self, page):
        go(page, "kunden.html", {"max4work_kunden": json.dumps(_KUNDEN())})
        expect(page.locator("text=Müller Bau GmbH")).to_be_visible(timeout=4000)
        expect(page.locator("text=Schmidt IT Services")).to_be_visible(timeout=4000)

    def test_neuen_kunden_anlegen(self, page):
        go(page, "kunden.html")
        page.click("button:has-text('Neuer Kunde')")
        page.wait_for_selector("#overlay.open", timeout=3000)
        page.fill("#f-name",  "Test AG")
        page.fill("#f-plz",   "38100")
        page.fill("#f-ort",   "Braunschweig")
        page.fill("#f-tel",   "0531 999888")
        page.fill("#f-email", "info@testag.de")
        page.click("button[onclick='saveKunde()']")
        expect(page.locator("text=Test AG")).to_be_visible(timeout=4000)

    def test_suche_filtert(self, page):
        go(page, "kunden.html", {"max4work_kunden": json.dumps(_KUNDEN())})
        page.fill("#searchInput", "Müller")
        expect(page.locator("text=Müller Bau GmbH")).to_be_visible()
        expect(page.locator("text=Schmidt IT Services")).not_to_be_visible()

    def test_kunde_loeschen(self, page):
        kunden = [{"id": 1099, "name": "Lösch Mich AG", "strasse": "",
                   "ort": "Hamburg", "tel": "", "email": "", "turnus": "",
                   "status": "aktiv", "notiz": "", "km": ""}]
        go(page, "kunden.html", {"max4work_kunden": json.dumps(kunden)})
        expect(page.locator("text=Lösch Mich AG")).to_be_visible()
        page.click("button.icon-btn[onclick*='deleteKunde']")
        expect(page.locator("text=Lösch Mich AG")).not_to_be_visible(timeout=3000)


# ═══════════════════════════════════════════════════
# 02 – PRODUKTE
# ═══════════════════════════════════════════════════
class TestProdukte:

    def test_seite_ladet(self, page):
        go(page, "produkte.html")
        expect(page.locator("#emptyState")).to_be_visible(timeout=5000)

    def test_produkte_aus_localstorage_sichtbar(self, page):
        go(page, "produkte.html", {"max4work_produkte": json.dumps(_PRODUKTE())})
        expect(page.locator("text=Beratungsstunde")).to_be_visible(timeout=4000)
        expect(page.locator("text=Laptop Dell XPS")).to_be_visible(timeout=4000)

    def test_neues_produkt_anlegen(self, page):
        go(page, "produkte.html")
        page.click("button[onclick='openCreate()']")
        page.wait_for_selector("#createOverlay", timeout=3000)
        page.fill("#c_name",     "Reinigungsservice")
        page.fill("#c_vk_netto", "120")
        page.select_option("#c_kategorie", "dienstleistung")
        page.click("button[onclick='saveProduct()']")
        expect(page.locator("text=Reinigungsservice")).to_be_visible(timeout=4000)

    def test_suche_filtert(self, page):
        go(page, "produkte.html", {"max4work_produkte": json.dumps(_PRODUKTE())})
        page.fill("#searchInput", "Laptop")
        expect(page.locator("text=Laptop Dell XPS")).to_be_visible()
        expect(page.locator("text=Beratungsstunde")).not_to_be_visible()

    def test_produkt_loeschen(self, page):
        produkte = [{"id": 2099, "name": "Lösch Mich Produkt", "artnr": "9999",
                     "kategorie": "artikel", "ek_netto": 0, "vk_netto": 10,
                     "vk_brutto": 11.90, "ust": 19, "einheit": "Stk"}]
        go(page, "produkte.html", {"max4work_produkte": json.dumps(produkte)})
        expect(page.locator("text=Lösch Mich Produkt")).to_be_visible()
        page.click("button.btn-icon-delete[onclick*='confirmDelete']")
        page.wait_for_selector("#deleteOverlay", timeout=3000)
        page.click("button[onclick='executeDelete()']")
        expect(page.locator("text=Lösch Mich Produkt")).not_to_be_visible(timeout=4000)


# ═══════════════════════════════════════════════════
# 03 – RECHNUNGEN
# ═══════════════════════════════════════════════════
class TestRechnungen:

    def test_seite_ladet(self, page):
        go(page, "rechnungen.html")
        expect(page.locator("#neueRechnungBtn")).to_be_visible(timeout=5000)

    def test_rechnungen_aus_localstorage_sichtbar(self, page):
        go(page, "rechnungen.html", {"max4work_rechnungen": json.dumps(_RECHNUNGEN())})
        expect(page.locator("text=RE-2026-001")).to_be_visible(timeout=4000)
        expect(page.locator("text=RE-2026-002")).to_be_visible(timeout=4000)

    def test_neue_rechnung_formular_oeffnet(self, page):
        go(page, "rechnungen.html")
        page.click("#neueRechnungBtn")
        expect(page.locator("#invNr")).to_be_visible(timeout=4000)

    def test_rechnung_erstellen(self, page):
        go(page, "rechnungen.html",
           {"max4work_kunden": json.dumps(_KUNDEN())})
        page.click("#neueRechnungBtn")
        page.wait_for_selector("#invNr", timeout=4000)
        page.fill("#invNr", "RE-2026-TEST")
        page.fill("#cName", "Test AG")
        page.evaluate("saveToList()")
        page.evaluate("showListe()")
        page.wait_for_timeout(500)
        expect(page.locator("td:has-text('RE-2026-TEST')").first).to_be_visible(timeout=5000)

    def test_status_filter(self, page):
        go(page, "rechnungen.html", {"max4work_rechnungen": json.dumps(_RECHNUNGEN())})
        expect(page.locator("text=RE-2026-001")).to_be_visible(timeout=4000)
        expect(page.locator("text=RE-2026-002")).to_be_visible(timeout=4000)


# ═══════════════════════════════════════════════════
# 04 – FAHRTENBUCH
# ═══════════════════════════════════════════════════
class TestFahrtenbuch:

    def test_seite_ladet(self, page):
        go(page, "fahrtenbuch.html")
        expect(page.locator("#fDatum")).to_be_visible(timeout=5000)

    def test_fahrten_aus_localstorage_sichtbar(self, page):
        go(page, "fahrtenbuch.html",
           {"max4work_fahrtenbuch": json.dumps(_FAHRTENBUCH()),
            "max4work_fahrzeuge":   json.dumps(_FAHRZEUGE())})
        expect(page.locator("#fahrtListe")).to_be_visible(timeout=4000)
        expect(page.locator("#fahrtListe").locator("text=Hannover")).to_be_visible(timeout=4000)

    def test_fahrt_eintragen(self, page):
        go(page, "fahrtenbuch.html",
           {"max4work_fahrzeuge": json.dumps(_FAHRZEUGE())})
        page.fill("#fDatum",    "2026-06-14")
        page.fill("#fStartKm",  "20000")
        page.fill("#fEndKm",    "20050")
        page.fill("#fStartOrt", "Braunschweig Hbf")
        page.fill("#fZielOrt",  "Wolfsburg")
        page.click("button[onclick='addFahrt()']")
        expect(page.locator("#fahrtListe").locator("text=Wolfsburg")).to_be_visible(timeout=4000)


# ═══════════════════════════════════════════════════
# 05 – BELEGE
# ═══════════════════════════════════════════════════
class TestBelege:

    def test_seite_ladet(self, page):
        go(page, "belege.html")
        expect(page.locator("body")).to_be_visible(timeout=5000)

    def test_belege_aus_localstorage_sichtbar(self, page):
        go(page, "belege.html", {"max4work_belege": json.dumps(_BELEGE())})
        expect(page.locator("#belegListe")).to_be_visible(timeout=4000)
        expect(page.locator("#belegListe").locator("text=Druckerpapier")).to_be_visible(timeout=4000)

    def test_filter_chips_belege(self, page):
        go(page, "belege.html", {"max4work_belege": json.dumps(_BELEGE())})
        page.click(".fchip[data-f='Büro']")
        page.wait_for_timeout(300)
        expect(page.locator("#belegListe").locator("text=Druckerpapier")).to_be_visible(timeout=3000)
        page.click(".fchip[data-f='steuer']")
        page.wait_for_timeout(300)
        expect(page.locator("#belegListe").locator("text=Druckerpapier")).not_to_be_visible(timeout=3000)


# ═══════════════════════════════════════════════════
# 06 – TERMINE
# ═══════════════════════════════════════════════════
class TestTermine:

    def test_seite_ladet(self, page):
        go(page, "termine.html")
        expect(page.locator("#monthTitle")).to_be_visible(timeout=5000)

    def test_termin_in_localstorage_sichtbar(self, page):
        go(page, "termine.html", {"max4work_termine": json.dumps(_TERMINE())})
        page.evaluate("selectDay('2026-06-20')")
        page.wait_for_timeout(300)
        expect(page.locator(".event-block-title").locator("text=Kundengespräch Müller")).to_be_visible(timeout=4000)

    def test_neuen_termin_anlegen(self, page):
        go(page, "termine.html")
        page.fill("#f-titel", "Testtermin Playwright")
        page.fill("#f-datum", "2026-06-25")
        page.click("button[onclick='saveTermin()']")
        page.evaluate("selectDay('2026-06-25')")
        page.wait_for_timeout(300)
        expect(page.locator(".event-block-title").locator("text=Testtermin Playwright")).to_be_visible(timeout=4000)


# ═══════════════════════════════════════════════════
# 07 – DASHBOARD
# ═══════════════════════════════════════════════════
class TestDashboard:

    def test_seite_ladet(self, page):
        go(page, "index.html")
        expect(page.locator("body")).to_be_visible(timeout=5000)

    def test_kpi_panels_sichtbar(self, page):
        go(page, "index.html", {"max4work_rechnungen": json.dumps(_RECHNUNGEN())})
        expect(page.locator(".kpi-grid, .panel, [class*='kpi']").first).to_be_visible(timeout=5000)

    def test_globale_suche_oeffnet(self, page):
        go(page, "index.html")
        page.keyboard.press("Control+k")
        expect(page.locator("._searchBox")).to_be_visible(timeout=3000)

    def test_globale_suche_findet_rechnung(self, page):
        go(page, "index.html", {"max4work_rechnungen": json.dumps(_RECHNUNGEN())})
        page.keyboard.press("Control+k")
        page.wait_for_selector("._searchBox", timeout=3000)
        page.keyboard.type("Müller")
        page.wait_for_timeout(500)
        expect(page.locator("._searchBox")).to_be_visible()


# ═══════════════════════════════════════════════════
# 08 – AUSWERTUNG
# ═══════════════════════════════════════════════════
class TestAuswertung:

    def test_seite_ladet(self, page):
        go(page, "auswertung.html")
        expect(page.locator("body")).to_be_visible(timeout=5000)

    def test_charts_sichtbar_mit_daten(self, page):
        go(page, "auswertung.html", {
            "max4work_rechnungen": json.dumps(_RECHNUNGEN()),
        })
        page.wait_for_timeout(1000)
        expect(page.locator("canvas, .chart, [id*='chart']").first).to_be_visible(timeout=5000)

    def test_jahresfilter(self, page):
        go(page, "auswertung.html", {
            "max4work_rechnungen": json.dumps(_RECHNUNGEN()),
        })
        year_sel = page.locator("select[id*='year'], select[onchange*='year'], #yearSelect")
        if year_sel.count():
            year_sel.first.select_option("2026")
        page.wait_for_timeout(500)
        expect(page.locator("body")).to_be_visible()


# ═══════════════════════════════════════════════════
# 09 – EINSTELLUNGEN
# ═══════════════════════════════════════════════════
class TestEinstellungen:

    def test_seite_ladet(self, page):
        go(page, "einstellungen.html")
        expect(page.locator(".stab").first).to_be_visible(timeout=5000)

    def test_tabs_schaltbar(self, page):
        go(page, "einstellungen.html")
        tabs = page.locator(".stab")
        count = tabs.count()
        assert count >= 2, f"Erwartet mindestens 2 Tabs, gefunden: {count}"
        tabs.nth(1).click()
        page.wait_for_timeout(300)
        expect(page.locator("body")).to_be_visible()

    def test_firmendaten_speichern(self, page):
        go(page, "einstellungen.html")
        page.click("button.stab[data-section='firma']")
        page.wait_for_timeout(300)
        page.fill("#sName", "Neue Testfirma")
        page.click("button[onclick='speichern()']")
        page.wait_for_timeout(500)
        saved = page.evaluate("JSON.parse(localStorage.getItem('max4work_einstellungen') || '{}').sName")
        assert saved == "Neue Testfirma", f"Gespeicherter Name: {saved}"

    def test_toggle_schalten(self, page):
        go(page, "einstellungen.html")
        page.click("button.stab[data-section='funktionen']")
        page.wait_for_timeout(300)
        toggle = page.locator("#autoSuggestInvoice")
        state_before = toggle.is_checked()
        toggle.click()
        page.wait_for_timeout(300)
        state_after = toggle.is_checked()
        assert state_before != state_after, "Toggle hat sich nicht verändert"


# ═══════════════════════════════════════════════════
# 10 – WERKZEUGE
# ═══════════════════════════════════════════════════
class TestWerkzeuge:

    def test_seite_ladet(self, page):
        go(page, "werkzeuge.html")
        expect(page.locator("body")).to_be_visible(timeout=5000)

    def test_werkzeuge_sichtbar(self, page):
        go(page, "werkzeuge.html")
        expect(page.locator(".tool-section").first).to_be_visible(timeout=5000)
