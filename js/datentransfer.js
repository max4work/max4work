/* ═══ Konfiguration ═══ */
let currentTab = 'rechnungen';
let currentApp = 'auto';
let csvHeaders = [], csvRows = [];

/* Zielfelder pro Tab */
const DT_FIELDS = {
  kunden: [
    { key: 'name',    label: 'Name / Firma *' },
    { key: 'strasse', label: 'Straße' },
    { key: 'ort',     label: 'PLZ & Ort' },
    { key: 'tel',     label: 'Telefon' },
    { key: 'email',   label: 'E-Mail' },
    { key: 'turnus',  label: 'Turnus' },
    { key: 'notiz',   label: 'Notiz' },
  ],
  rechnungen: [
    { key: 'nr',      label: 'Rechnungs-Nr. *' },
    { key: 'kunde',   label: 'Kunde *' },
    { key: 'betrag',  label: 'Betrag (€) *' },
    { key: 'datum',   label: 'Datum' },
    { key: 'faellig', label: 'Fälligkeitsdatum' },
    { key: 'status',  label: 'Status' },
  ],
  belege: [
    { key: 'datum',   label: 'Datum *' },
    { key: 'betrag',  label: 'Betrag (€) *' },
    { key: 'kat',     label: 'Kategorie' },
    { key: 'notiz',   label: 'Beschreibung' },
  ],
};

/* App-spezifische Spaltennamen-Mappings */
const DT_APP_MAPS = {
  auto: {},
  sevdesk: {
    kunden: { name:'Firmenname|Name|Vorname Nachname', strasse:'Straße|street', ort:'PLZ Ort|zip city|Postleitzahl', tel:'Telefon|phone', email:'E-Mail|email' },
    rechnungen: { nr:'Rechnungsnummer|invoiceNumber', kunde:'Kundenname|contactName', betrag:'Betrag|totalNet|totalGross', datum:'Rechnungsdatum|invoiceDate', status:'Status' },
    belege: { datum:'Datum|date', betrag:'Betrag|amount', kat:'Kategorie|category', notiz:'Beschreibung|description' },
  },
  lexoffice: {
    kunden: { name:'Name|Firmenname|Vorname', strasse:'Straße', ort:'PLZ|Ort', tel:'Telefon', email:'E-Mail' },
    rechnungen: { nr:'Belegnummer|Rechnungsnummer', kunde:'Kunde|Name', betrag:'Betrag|Nettobetrag|Gesamtbetrag', datum:'Datum|Belegdatum', status:'Status' },
    belege: { datum:'Datum', betrag:'Betrag', kat:'Kategorie', notiz:'Beschreibung|Verwendungszweck' },
  },
  meinbuero: {
    kunden: { name:'Firma|Name|Anrede Vorname Nachname', strasse:'Straße Nr.', ort:'PLZ Ort', tel:'Tel.', email:'E-Mail' },
    rechnungen: { nr:'Re-Nr.|Rechnungsnummer', kunde:'Kunde', betrag:'Betrag|Netto', datum:'Datum', status:'Status|Zahlungsstatus' },
    belege: { datum:'Datum', betrag:'Betrag', kat:'Buchungstext|Kategorie', notiz:'Beschreibung' },
  },
  fastbill: {
    kunden: { name:'ORGANIZATION|FIRST_NAME LAST_NAME', strasse:'ADDRESS', ort:'ZIPCODE CITY', tel:'PHONE', email:'EMAIL' },
    rechnungen: { nr:'INVOICE_NUMBER', kunde:'CUSTOMER_NAME', betrag:'TOTAL', datum:'INVOICE_DATE', status:'IS_CANCELED' },
    belege: { datum:'DATE', betrag:'AMOUNT', kat:'CATEGORY', notiz:'DESCRIPTION' },
  },
  billomat: {
    kunden: { name:'Name|Organisation', strasse:'Straße', ort:'PLZ Ort', tel:'Telefon', email:'E-Mail' },
    rechnungen: { nr:'Nummer', kunde:'Auftraggeber', betrag:'Brutto', datum:'Datum', status:'Status' },
    belege: { datum:'Datum', betrag:'Betrag', kat:'Kategorie', notiz:'Bezeichnung' },
  },
  custom: {},
};

/* ═══ Tab & App ═══ */
function switchTab(tab) {
  currentTab = tab;
  ['kunden','rechnungen','belege'].forEach(t => {
    document.getElementById('tab'+t.charAt(0).toUpperCase()+t.slice(1)).className = t===tab ? 'btn btn-dark' : 'btn btn-ghost';
  });
  if (csvHeaders.length) buildMapping();
}

function selectApp(el) {
  document.querySelectorAll('.app-chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  currentApp = el.dataset.app;
  updateFormatHint();
  if (csvHeaders.length) buildMapping();
}

function updateFormatHint() {
  const hints = {
    sevdesk: 'SevDesk: Kunden unter <strong>Kontakte → Export</strong>, Rechnungen unter <strong>Rechnungen → CSV exportieren</strong>.',
    lexoffice: 'Lexoffice: <strong>Kontakte / Belege → Exportieren → CSV</strong>. Trennzeichen: Semikolon.',
    meinbuero: 'Mein Büro: <strong>Datei → Exportieren → CSV/Excel</strong> (dann als CSV speichern).',
    fastbill: 'FastBill: <strong>Kunden / Rechnungen → Export → CSV</strong>.',
    billomat: 'Billomat: <strong>Einstellungen → Export → CSV</strong>.',
    custom: 'Eigene CSV: Erste Zeile muss die Spaltenüberschriften enthalten. Trennzeichen: ; oder ,',
    auto: '<strong>Tipp:</strong> Exportiere aus deiner bisherigen App als <strong>CSV</strong>. Die Spaltenreihenfolge spielt keine Rolle — max4work erkennt die Felder automatisch.',
  };
  document.getElementById('formatHint').innerHTML = hints[currentApp] || hints.auto;
}

/* ═══ CSV laden ═══ */
function loadCSV(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const text = ev.target.result;
    const parsed = parseCSV(text);
    csvHeaders = parsed.headers;
    csvRows = parsed.rows;
    document.getElementById('importCount').textContent = csvRows.length + ' Zeilen gefunden';
    document.getElementById('mappingSection').style.display = 'block';
    buildMapping();
  };
  reader.readAsText(file, 'UTF-8');
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const sep = lines[0].includes(';') ? ';' : ',';
  const clean = s => s.trim().replace(/^["']|["']$/g, '');
  const headers = lines[0].split(sep).map(clean);
  const rows = lines.slice(1).map(line => {
    const vals = line.split(sep).map(clean);
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i] !== undefined ? vals[i] : '');
    return obj;
  }).filter(r => Object.values(r).some(v => v));
  return { headers, rows };
}

/* ═══ Spalten-Mapping ═══ */
function buildMapping() {
  const fields = DT_FIELDS[currentTab];
  const appMap = (DT_APP_MAPS[currentApp]||{})[currentTab] || {};
  const grid = document.getElementById('mappingGrid');
  grid.innerHTML = '';
  let matched = 0;

  fields.forEach(f => {
    const best = autoDetect(f.key, csvHeaders, appMap[f.key]);
    if (best) matched++;
    const row = document.createElement('div');
    row.className = 'mapping-row';
    const sel = document.createElement('select');
    sel.className = 'mapping-select';
    sel.id = 'map_' + f.key;
    sel.innerHTML = `<option value="">– nicht importieren –</option>` +
      csvHeaders.map(h => `<option value="${esc(h)}"${h===best?' selected':''}>${esc(h)}</option>`).join('');
    sel.addEventListener('change', updatePreview);
    const icon = best
      ? `<span class="mapping-match">✓</span>`
      : `<span class="mapping-miss">–</span>`;
    row.innerHTML = `<span class="mapping-target">${f.label}</span>${icon}`;
    row.appendChild(sel);
    grid.appendChild(row);
  });

  document.getElementById('matchBadge').textContent = `${matched} von ${fields.length} Spalten automatisch erkannt`;
  updatePreview();
}

function autoDetect(key, headers, appHints) {
  const synonyms = {
    name:    ['name','firma','firmenname','company','organization','organisation','vorname','kunde'],
    strasse: ['strasse','straße','street','adresse','address'],
    ort:     ['ort','city','stadt','plz','zip','postleitzahl','plz ort'],
    tel:     ['telefon','tel','phone','mobil','mobile'],
    email:   ['email','e-mail','mail'],
    turnus:  ['turnus','rhythmus','intervall','period'],
    notiz:   ['notiz','beschreibung','description','bemerkung','kommentar','anmerkung'],
    nr:      ['nummer','rechnungsnummer','re-nr','invoicenumber','belegnummer','nr','no'],
    kunde:   ['kunde','kundenname','auftraggeber','contactname','empfänger'],
    betrag:  ['betrag','total','summe','gesamtbetrag','brutto','netto','amount','totalnet','totalgross'],
    datum:   ['datum','date','rechnungsdatum','belegdatum','invoicedate'],
    faellig: ['fällig','faellig','fälligkeit','duedate','zahlungsziel'],
    status:  ['status','zahlungsstatus','bezahlt'],
    kat:     ['kategorie','category','buchungstext','art','typ'],
  };
  // Aus App-Hints
  if (appHints) {
    for (const hint of appHints.split('|')) {
      const found = headers.find(h => h.toLowerCase() === hint.toLowerCase());
      if (found) return found;
    }
  }
  // Auto via Synonyme
  const syns = synonyms[key] || [key];
  for (const syn of syns) {
    const found = headers.find(h => h.toLowerCase().includes(syn.toLowerCase()) || syn.toLowerCase().includes(h.toLowerCase()));
    if (found) return found;
  }
  return null;
}

/* ═══ Vorschau ═══ */
function updatePreview() {
  const fields = DT_FIELDS[currentTab];
  const mapping = {};
  fields.forEach(f => { mapping[f.key] = document.getElementById('map_'+f.key)?.value || ''; });
  const preview = csvRows.slice(0, 5);
  const table = document.getElementById('previewTable');
  const cols = fields.filter(f => mapping[f.key]);
  table.innerHTML = `<thead><tr>${cols.map(f=>`<th>${f.label}</th>`).join('')}</tr></thead>
    <tbody>${preview.map(r=>`<tr>${cols.map(f=>`<td>${esc(r[mapping[f.key]]||'')}</td>`).join('')}</tr>`).join('')}</tbody>`;
}

/* ═══ Import ═══ */
function doImport() {
  const fields = DT_FIELDS[currentTab];
  const mapping = {};
  fields.forEach(f => { mapping[f.key] = document.getElementById('map_'+f.key)?.value || ''; });
  const required = fields.filter(f => f.label.includes('*')).map(f => f.key);
  if (required.some(k => !mapping[k])) {
    showResult(false, 'Bitte alle Pflichtfelder (*) zuordnen.'); return;
  }

  let imported = 0, skipped = 0;

  if (currentTab === 'kunden') {
    const existing = loadData('max4work_kunden');
    csvRows.forEach(row => {
      const name = row[mapping.name]?.trim();
      if (!name) { skipped++; return; }
      if (existing.find(k => k.name.toLowerCase() === name.toLowerCase())) { skipped++; return; }
      existing.push({ id: Date.now()+imported, name, strasse: row[mapping.strasse]||'', ort: row[mapping.ort]||'', tel: row[mapping.tel]||'', email: row[mapping.email]||'', turnus: row[mapping.turnus]||'', notiz: row[mapping.notiz]||'', status: 'aktiv', km: 0 });
      imported++;
    });
    saveData('max4work_kunden', existing);

  } else if (currentTab === 'rechnungen') {
    const existing = loadData('max4work_rechnungen');
    csvRows.forEach(row => {
      const nr = row[mapping.nr]?.trim();
      const kunde = row[mapping.kunde]?.trim();
      if (!nr || !kunde) { skipped++; return; }
      if (existing.find(r => r.nr === nr)) { skipped++; return; }
      const betrag = parseDE(row[mapping.betrag]);
      const status = normalizeStatus(row[mapping.status]);
      existing.push({ id: Date.now()+imported, nr, kunde, betrag, datum: parseDate(row[mapping.datum]), faellig: parseDate(row[mapping.faellig]), status });
      imported++;
    });
    saveData('max4work_rechnungen', existing);

  } else if (currentTab === 'belege') {
    const existing = loadData('max4work_belege');
    csvRows.forEach(row => {
      const datum = parseDate(row[mapping.datum]);
      const betrag = parseDE(row[mapping.betrag]);
      if (!datum || !betrag) { skipped++; return; }
      existing.unshift({ id: Date.now()+imported, datum, betrag, kat: row[mapping.kat]||'Sonstiges', notiz: row[mapping.notiz]||'', file: null, fileName: null });
      imported++;
    });
    saveData('max4work_belege', existing);
  }

  const msg = `✓ ${imported} Einträge importiert${skipped ? `, ${skipped} übersprungen (Duplikate / fehlende Pflichtfelder)` : ''}.`;
  showResult(true, msg);
  updateExportCounts();
}

function normalizeStatus(s) {
  if (!s) return 'offen';
  const l = s.toLowerCase();
  if (l.includes('bezahlt') || l.includes('paid') || l === '1' || l === 'true') return 'bezahlt';
  return 'offen';
}

function showResult(ok, msg) {
  const el = document.getElementById('importResult');
  el.className = 'import-result ' + (ok?'ok':'err');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 5000);
}

function resetImport() {
  document.getElementById('mappingSection').style.display = 'none';
  document.getElementById('csvInput').value = '';
  csvHeaders = []; csvRows = [];
}

/* ═══ Export ═══ */
function exportCSV(type) {
  const data = loadData('max4work_' + type);
  if (!data.length) { alert('Keine Daten zum Exportieren.'); return; }
  const keys = Object.keys(data[0]).filter(k => k !== 'file');
  const csv = [keys.join(';'), ...data.map(r => keys.map(k => `"${String(r[k]||'').replace(/"/g,'""')}"`).join(';'))].join('\n');
  download(`max4work_${type}_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv;charset=utf-8;', '﻿'+csv);
}

function exportAll() {
  const keys = ['max4work_kunden','max4work_rechnungen','max4work_belege','max4work_termine','max4work_produkte','max4work_einstellungen'];
  const backup = {};
  keys.forEach(k => { try { backup[k] = JSON.parse(localStorage.getItem(k)||'null'); } catch(e) {} });
  backup._exportedAt = new Date().toISOString();
  download(`max4work_backup_${new Date().toISOString().slice(0,10)}.json`, 'application/json', JSON.stringify(backup, null, 2));
}

function download(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ═══ Hilfsfunktionen ═══ */
function loadData(key) { try { return JSON.parse(localStorage.getItem(key)||'[]'); } catch(e) { return []; } }
function saveData(key, d) { try { localStorage.setItem(key, JSON.stringify(d)); } catch(e) { alert('Speicher voll.'); } }
function parseDE(s) { return parseFloat(String(s||0).replace(/\./g,'').replace(',','.')) || 0; }
function parseDate(s) {
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (de) return `${de[3]}-${de[2].padStart(2,'0')}-${de[1].padStart(2,'0')}`;
  return '';
}
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function updateExportCounts() {
  document.getElementById('exportKundenCount').textContent = loadData('max4work_kunden').length + ' Einträge';
  document.getElementById('exportRechCount').textContent = loadData('max4work_rechnungen').length + ' Einträge';
  document.getElementById('exportBelegeCount').textContent = loadData('max4work_belege').length + ' Einträge';
}

/* ═══ Init ═══ */
updateExportCounts();
switchTab('rechnungen');
