const SAVE_KEY = 'max4work_fahrtenbuch';
const FZ_KEY = 'max4work_fahrzeuge';
let fahrten = [], fahrzeuge = [], currentZweck = 'dienstlich';
let startFoto = null, endFoto = null;

/* ═══ OCR Tachometer ═══ */
async function scanKm(e, type, src) {
  const file = e.target.files[0]; if (!file) return;
  const statusEl = document.getElementById(type+'OcrStatus');
  const msgEl = document.getElementById(type+'OcrMsg');
  const barEl = document.getElementById(type+'OcrBar');
  const imgEl = document.getElementById(type+'KmImg');
  const labelEl = document.getElementById(type+'KmOcrStatus');

  const reader = new FileReader();
  reader.onload = async ev => {
    // Bild komprimieren
    const img = new Image();
    img.onload = async () => {
      const MAX = 1200;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) { if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;} }
      const c = document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      const data = c.toDataURL('image/jpeg', 0.85);
      if (type === 'start') startFoto = data; else endFoto = data;
      imgEl.src = data; imgEl.style.display = 'block';

      // OCR
      statusEl.style.display = 'block';
      labelEl.textContent = 'Analysiere...';
      try {
        if (!window.Tesseract) {
          msgEl.textContent = 'Lade OCR...';
          barEl.style.width = '20%';
          await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js');
        }
        msgEl.textContent = 'Lese Kilometerstand...';
        const result = await Tesseract.recognize(data, 'deu', {
          logger: m => { if (m.status==='recognizing text') barEl.style.width = Math.round(20+m.progress*75)+'%'; }
        });
        barEl.style.width = '100%';
        const km = extractKm(result.data.text);
        if (km) {
          document.getElementById(type==='start'?'fStartKm':'fEndKm').value = km;
          document.getElementById(type==='start'?'fStartKm':'fEndKm').classList.add('detected');
          labelEl.textContent = `✓ ${km.toLocaleString('de-DE')} km`;
          labelEl.style.color = 'var(--green)';
          document.getElementById('ocrBadge').style.display = 'inline';
          calcDistanz();
        } else {
          labelEl.textContent = 'Nicht erkannt — manuell eingeben';
          labelEl.style.color = 'var(--muted)';
        }
      } catch(err) {
        labelEl.textContent = 'OCR nicht verfügbar';
      }
      statusEl.style.display = 'none';
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function extractKm(text) {
  // Suche nach 4-7-stelligen Zahlen (Tachometerstand)
  // Verschiedene Formate: 87430, 87.430, 87 430, 087430
  const patterns = [
    /\b(\d{1,3}[.\s]\d{3})\b/g,  // 87.430 oder 87 430
    /\b(\d{5,7})\b/g,              // 87430 oder 087430
  ];
  let candidates = [];
  for (const pat of patterns) {
    let m; pat.lastIndex = 0;
    while ((m = pat.exec(text)) !== null) {
      const val = parseInt(m[1].replace(/[.\s]/g, ''));
      if (val >= 100 && val <= 9999999) candidates.push(val);
    }
  }
  if (!candidates.length) return null;
  // Größten plausiblen Wert nehmen (Tachometer zeigt immer Gesamtkilometer)
  candidates.sort((a,b) => b-a);
  return candidates[0];
}

function loadScript(src) {
  return new Promise((res,rej) => { const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s); });
}

/* ═══ Berechnungen ═══ */
function calcDistanz() {
  const start = parseInt(document.getElementById('fStartKm').value) || 0;
  const end = parseInt(document.getElementById('fEndKm').value) || 0;
  const badge = document.getElementById('distanzBadge');
  if (start > 0 && end > start) {
    const dist = end - start;
    badge.textContent = `→ Strecke: ${dist.toLocaleString('de-DE')} km`;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

function updateRouteVis() {
  const start = document.getElementById('fStartOrt').value.trim();
  const end = document.getElementById('fZielOrt').value.trim();
  const vis = document.getElementById('routeVis');
  if (start || end) {
    document.getElementById('routeStart').textContent = start || '—';
    document.getElementById('routeEnd').textContent = end || '—';
    vis.style.display = 'flex';
  } else {
    vis.style.display = 'none';
  }
}

function selectZweck(el) {
  document.querySelectorAll('.zweck-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  currentZweck = el.dataset.z;
}

/* ═══ Fahrt speichern ═══ */
function addFahrt() {
  const datum = document.getElementById('fDatum').value;
  const startKm = parseInt(document.getElementById('fStartKm').value) || 0;
  const endKm = parseInt(document.getElementById('fEndKm').value) || 0;
  if (!datum) { alert('Bitte Datum angeben.'); return; }
  if (startKm <= 0 || endKm <= 0) { alert('Bitte Start- und End-km angeben.'); return; }
  if (endKm <= startKm) { alert('End-km muss größer als Start-km sein.'); return; }
  const f = {
    id: Date.now(), datum, startKm, endKm,
    distanz: endKm - startKm,
    startOrt: document.getElementById('fStartOrt').value.trim(),
    zielOrt: document.getElementById('fZielOrt').value.trim(),
    abfahrt: document.getElementById('fAbfahrt').value,
    ankunft: document.getElementById('fAnkunft').value,
    zweck: currentZweck,
    fahrzeug: document.getElementById('fFahrzeug').value,
    kunde: document.getElementById('fKunde').value.trim(),
    notiz: document.getElementById('fNotiz').value.trim(),
    startFoto, endFoto,
  };
  fahrten.unshift(f);
  save(); resetForm(); render();
}

function resetForm() {
  ['fStartKm','fEndKm','fStartOrt','fZielOrt','fAbfahrt','fAnkunft','fKunde','fNotiz'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const _hide = id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };
  const _clear = id => { const el = document.getElementById(id); if (el) el.textContent = ''; };
  _hide('distanzBadge'); _hide('routeVis');
  _hide('startKmImg'); _hide('endKmImg'); _hide('ocrBadge');
  _clear('startKmOcrStatus'); _clear('endKmOcrStatus');
  ['fStartKm','fEndKm'].forEach(id => document.getElementById(id)?.classList.remove('detected'));
  startFoto = null; endFoto = null;
}

function delFahrt(id) {
  if (!confirm('Fahrt löschen?')) return;
  fahrten = fahrten.filter(f => f.id !== id);
  save(); render();
}

/* ═══ Render ═══ */
function render() {
  const monat = document.getElementById('filterMonat').value;
  const zweck = document.getElementById('filterZweck').value;
  let filtered = fahrten;
  if (monat) filtered = filtered.filter(f => f.datum.slice(0,7) === monat);
  if (zweck) filtered = filtered.filter(f => f.zweck === zweck);

  const fmtD = v => { if(!v) return '—'; const[y,m,d]=v.split('-'); return `${d}.${m}.${y}`; };
  const delIcon = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;
  const carIcon = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M5 17H3a2 2 0 0 1-2-2V9l3-5h10l3 5h2a2 2 0 0 1 2 2v1"/><path d="M17 17H9"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`;

  const liste = document.getElementById('fahrtListe');
  if (!filtered.length) {
    liste.innerHTML = `<div class="empty"><svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24" style="margin:0 auto 8px;display:block;opacity:.3"><path d="M5 17H3a2 2 0 0 1-2-2V9l3-5h10l3 5h2a2 2 0 0 1 2 2v1"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>Noch keine Fahrten erfasst.</div>`;
  } else {
    liste.innerHTML = filtered.map(f => {
      const route = f.startOrt && f.zielOrt ? `${f.startOrt} → ${f.zielOrt}` : f.startOrt || f.zielOrt || 'Fahrt';
      const zeiten = f.abfahrt && f.ankunft ? `${f.abfahrt} – ${f.ankunft}` : f.abfahrt || '';
      return `<div class="fahrt-row">
        <div class="fahrt-icon ${f.zweck}">${carIcon}</div>
        <div class="fahrt-info">
          <div class="fahrt-route">${route}</div>
          <div class="fahrt-meta">
            ${fmtD(f.datum)}
            ${zeiten ? `· ${zeiten}` : ''}
            ${f.kunde ? `· ${f.kunde}` : ''}
            <span class="${f.zweck==='dienstlich'?'badge-dienst':'badge-privat'}">${f.zweck==='dienstlich'?'Dienstlich':'Privat'}</span>
          </div>
          ${f.notiz ? `<div style="font-size:11.5px;color:var(--muted);margin-top:2px;">${f.notiz}</div>` : ''}
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">${f.startKm.toLocaleString('de-DE')} → ${f.endKm.toLocaleString('de-DE')} km${f.fahrzeug ? ` · <span style="font-weight:600;letter-spacing:0.4px;">${f.fahrzeug}</span>` : ''}</div>
        </div>
        <div class="fahrt-km">${f.distanz} km</div>
        <button class="fahrt-del" onclick="delFahrt(${f.id})" title="Löschen">${delIcon}</button>
      </div>`;
    }).join('');
  }

  // KPIs
  const total = filtered.reduce((s,f) => s+f.distanz, 0);
  const dienst = filtered.filter(f=>f.zweck==='dienstlich').reduce((s,f) => s+f.distanz, 0);
  const avg = filtered.length ? Math.round(total/filtered.length) : 0;
  document.getElementById('kpiFahrten').textContent = filtered.length;
  document.getElementById('kpiGesamt').textContent = total.toLocaleString('de-DE')+' km';
  document.getElementById('kpiDienst').textContent = dienst.toLocaleString('de-DE')+' km';
  document.getElementById('kpiAvg').textContent = avg ? avg+' km' : '–';
  document.getElementById('listCount').textContent = filtered.length + ' Fahrten';
  document.getElementById('topMeta').textContent = fahrten.length + ' Fahrten · ' + fahrten.reduce((s,f)=>s+f.distanz,0).toLocaleString('de-DE') + ' km gesamt';
}

function fillMonatFilter() {
  const months = [...new Set(fahrten.map(f => f.datum.slice(0,7)))].sort().reverse();
  const sel = document.getElementById('filterMonat');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Alle Monate</option>' +
    months.map(m => { const [y,mo] = m.split('-'); const mn=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'][parseInt(mo)-1]; return `<option value="${m}">${mn} ${y}</option>`; }).join('');
  sel.value = cur;
}

function fillKundenList() {
  try {
    const kunden = JSON.parse(localStorage.getItem('max4work_kunden')||'[]');
    document.getElementById('kundenList').innerHTML = kunden.map(k=>`<option value="${k.name}">`).join('');
  } catch(e) {}
  // Auch aus bisherigen Fahrten
  const known = [...new Set(fahrten.filter(f=>f.kunde).map(f=>f.kunde))];
  document.getElementById('kundenList').innerHTML += known.map(k=>`<option value="${k}">`).join('');
}

/* ═══ Export ═══ */
function exportCSV() {
  if (!fahrten.length) { alert('Keine Fahrten vorhanden.'); return; }
  const rows = [['Datum','Fahrzeug','Start-km','End-km','Distanz (km)','Startort','Zielort','Abfahrt','Ankunft','Zweck','Kunde','Notiz']];
  fahrten.forEach(f => rows.push([
    f.datum, f.fahrzeug||'', f.startKm, f.endKm, f.distanz,
    f.startOrt||'', f.zielOrt||'', f.abfahrt||'', f.ankunft||'',
    f.zweck, f.kunde||'', f.notiz||''
  ]));
  const csv = rows.map(r => r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`Fahrtenbuch_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function exportPDF() {
  if (!fahrten.length) { alert('Keine Fahrten vorhanden.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const M=18; let y=20;
  let firma='', name='', steuernr='';
  try { const s=JSON.parse(localStorage.getItem('max4work_einstellungen')||'{}'); firma=s.sName||''; name=s.sContact||''; steuernr=s.sStNr||''; } catch(e) {}

  doc.setFont('helvetica','bold'); doc.setFontSize(16);
  doc.text('Fahrtenbuch', M, y); y+=7;
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(100);
  if (firma) { doc.text(firma, M, y); y+=4.5; }
  if (steuernr) { doc.text('Steuer-Nr.: '+steuernr, M, y); y+=4.5; }
  const kfzListe = [...new Set(fahrten.map(f=>f.fahrzeug).filter(Boolean))];
  if (kfzListe.length) { doc.text('Fahrzeug: '+kfzListe.join(', '), M, y); y+=4.5; }
  doc.text('Erstellt am '+new Date().toLocaleDateString('de-DE'), M, y); y+=8;
  doc.setTextColor(0);

  const dienst = fahrten.filter(f=>f.zweck==='dienstlich');
  const totalKm = fahrten.reduce((s,f)=>s+f.distanz,0);
  const dienstKm = dienst.reduce((s,f)=>s+f.distanz,0);
  doc.setFont('helvetica','bold'); doc.setFontSize(9.5);
  doc.text(`Gesamt: ${totalKm.toLocaleString('de-DE')} km  |  Dienstlich: ${dienstKm.toLocaleString('de-DE')} km  |  Fahrten: ${fahrten.length}`, M, y); y+=8;

  doc.setFillColor(43,56,41); doc.setTextColor(255);
  doc.rect(M, y, 174, 7, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(8);
  const cols = [18,22,22,22,16,28,18,20];
  const heads = ['Datum','km Anf.','km End.','Strecke km','Abfahrt','Route','Zweck','KFZ'];
  let cx = M+2;
  heads.forEach((h,i) => { doc.text(h, cx, y+5); cx+=cols[i]; });
  y+=7; doc.setTextColor(0); doc.setFont('helvetica','normal'); doc.setFontSize(7.5);

  fahrten.forEach((f,i) => {
    if (y > 272) { doc.addPage(); y=20; }
    if (i%2===0) { doc.setFillColor(247,248,244); doc.rect(M,y,174,7,'F'); }
    const route = [f.startOrt,f.zielOrt].filter(Boolean).join(' → ') || '–';
    const fmtD = v => { if(!v)return'—'; const[y2,m,d]=v.split('-');return`${d}.${m}.${y2}`; };
    cx = M+2;
    const vals = [fmtD(f.datum), f.startKm.toLocaleString('de-DE'), f.endKm.toLocaleString('de-DE'), f.distanz.toLocaleString('de-DE'), f.abfahrt||'–', route.slice(0,18), f.zweck, f.fahrzeug||'–'];
    vals.forEach((v,j) => { doc.text(String(v), cx, y+5); cx+=cols[j]; });
    y+=7;
  });

  doc.setFont('helvetica','italic'); doc.setFontSize(7.5); doc.setTextColor(140);
  doc.text(`max4work · Fahrtenbuch · Erstellt ${new Date().toLocaleDateString('de-DE')}`, M, 289);
  doc.save(`Fahrtenbuch_${new Date().toISOString().slice(0,10)}.pdf`);
}

function openLightbox(src) { document.getElementById('lightboxImg').src=src; document.getElementById('lightbox').style.display='flex'; }
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(fahrten)); } catch(e) {} }
function saveFahrzeuge() { try { localStorage.setItem(FZ_KEY, JSON.stringify(fahrzeuge)); } catch(e) {} }

/* ═══ Fahrzeugfoto ═══ */
function fpFotoSelected(event) {
  const file = event.target.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1000;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) { if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;} }
      const c = document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      window._fpFotoBase64 = c.toDataURL('image/jpeg', 0.80);
      document.getElementById('fpFotoImg').src = window._fpFotoBase64;
      document.getElementById('fpFotoPreview').style.display = 'block';
      document.getElementById('fpFotoDrop').style.display = 'none';
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function fpFotoRemove() {
  window._fpFotoBase64 = null;
  const img = document.getElementById('fpFotoImg');
  const prev = document.getElementById('fpFotoPreview');
  const drop = document.getElementById('fpFotoDrop');
  if (img) img.src = '';
  if (prev) prev.style.display = 'none';
  if (drop) drop.style.display = 'block';
}

/* ═══ Fahrzeugschein ZBI ═══ */
function fpZBISelected(event) {
  const file = event.target.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1800;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) { if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;} }
      const c = document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      window._fpZBIBase64 = c.toDataURL('image/jpeg', 0.88);
      document.getElementById('fpZBIImg').src = window._fpZBIBase64;
      document.getElementById('fpZBIPreview').style.display = 'flex';
      document.getElementById('fpZBIDrop').style.display = 'none';
      const btn = document.getElementById('fpZBIScanBtn');
      btn.disabled = false; btn.style.opacity = '1';
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function fpZBIRemove() {
  window._fpZBIBase64 = null;
  document.getElementById('fpZBIImg').src = '';
  document.getElementById('fpZBIPreview').style.display = 'none';
  document.getElementById('fpZBIDrop').style.display = 'flex';
  const btn = document.getElementById('fpZBIScanBtn');
  btn.disabled = true; btn.style.opacity = '';
}

async function scanFahrzeugschein() {
  const base64 = window._fpZBIBase64;
  if (!base64) { alert('Bitte zuerst ein Foto des Fahrzeugscheins hochladen.'); return; }

  const btn = document.getElementById('fpZBIScanBtn');
  const status = document.getElementById('fpZBIStatus');
  const msg = document.getElementById('fpZBIMsg');
  const bar = document.getElementById('fpZBIBar');

  btn.disabled = true;
  status.style.display = 'block'; status.style.background = '';
  msg.textContent = 'Sende an OCR.space…';
  bar.style.width = '25%';

  try {
    const apiKey = localStorage.getItem('max4work_ocr_key') || 'helloworld';
    const params = new URLSearchParams({
      base64Image: base64,
      language: 'ger',
      isOverlayRequired: 'false',
      detectOrientation: 'true',
      scale: 'true',
      OCREngine: '2'
    });

    const resp = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { apikey: apiKey },
      body: params
    });

    bar.style.width = '70%';
    if (!resp.ok) throw new Error(`Server-Fehler ${resp.status}`);

    const result = await resp.json();
    if (result.IsErroredOnProcessing) throw new Error(result.ErrorMessage?.[0] || 'OCR fehlgeschlagen');

    const text = result.ParsedResults?.[0]?.ParsedText || '';
    if (!text.trim()) throw new Error('Kein Text erkannt – bitte schärferes Foto verwenden');

    bar.style.width = '90%';
    const data = _parseZBIText(text);
    const count = _fillZBIForm(data);
    bar.style.width = '100%';
    msg.textContent = `✓ ${count} Felder erkannt und übernommen`;
    setTimeout(() => { status.style.display = 'none'; bar.style.width = '0%'; }, 3000);
  } catch(err) {
    bar.style.width = '0%';
    const errMsg = err.message || 'Unbekannter Fehler';
    msg.textContent = '✗ ' + (errMsg.length > 90 ? errMsg.slice(0, 90) + '…' : errMsg);
    status.style.background = 'var(--red)';
    setTimeout(() => { status.style.display = 'none'; status.style.background = ''; }, 5000);
  } finally {
    btn.disabled = false;
  }
}

function _parseZBIText(text) {
  const data = {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const full = ' ' + text.replace(/\n/g, ' ') + ' ';

  // FIN (E): 17 Zeichen, kein I/O/Q
  const finM = full.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
  if (finM) data.fin = finM[1];

  // Kennzeichen (A): deutsches KFZ-Format
  const kzM = full.match(/\b([A-ZÖÜÄ]{1,3})[\s\-]{0,2}([A-Z]{1,2})[\s\-]?(\d{1,4}[HE]?)\b/);
  if (kzM) data.kz = `${kzM[1]}-${kzM[2]} ${kzM[3]}`;

  // Erstzulassung (B): DD.MM.YYYY → YYYY-MM-DD
  const dateM = full.match(/\b(\d{2})\.(\d{2})\.(\d{4})\b/);
  if (dateM) data.erstzulassung = `${dateM[3]}-${dateM[2]}-${dateM[1]}`;

  // Felder mit Präfix suchen
  const fieldRules = [
    [/\bD[.,·]?1[\s:)]+([A-ZÄÖÜ][A-ZÄÖÜa-zäöü\s\-]+?)(?:\s{2}|\d|$)/,   v => ({ marke: v.split(/\s{2,}/)[0].trim() })],
    [/\bD[.,·]?2[\s:)]+([^\n]+)/,                                            v => ({ typ: v.trim() })],
    [/\bD[.,·]?3[\s:)]+([^\n]+)/,                                            v => ({ handelsbezeichnung: v.trim() })],
    [/\bF[.,·]?1[\s:)]+(\d{3,5})/,                                           v => ({ gesamtmasse: v })],
    [/\bG[\s:)]+(\d{3,5})/,                                                   v => ({ leergewicht: v })],
    [/\bJ[\s:)]+([A-Z][0-9]?[a-zA-Z]?)/,                                     v => ({ fahrzeugklasse: v })],
    [/\bP[.,·]?1[\s:)]+(\d{3,5})/,                                           v => ({ hubraum: v })],
    [/\bP[.,·]?2[\s:)]+(\d{2,4})/,                                           v => ({ leistung: v })],
    [/\bR[\s:)]+([A-ZÄÖÜ][a-zäöüA-ZÄÖÜ]+)/,                                v => ({ farbe: v })],
    [/\bS[.,·]?1[\s:)]+(\d{1,2})/,                                           v => ({ sitzplaetze: v })],
    [/\bT[\s:)]+(\d{2,3})/,                                                   v => ({ vmax: v })],
    [/\bV[.,·]?7[\s:)]+(\d{2,4})/,                                           v => ({ co2: v })],
    [/\bO[.,·]?1[\s:)]+(\d{3,5})/,                                           v => ({ o1: v })],
    [/\bO[.,·]?2[\s:)]+(\d{3,5})/,                                           v => ({ o2: v })],
  ];
  for (const [rx, fn] of fieldRules) {
    const m = full.match(rx);
    if (m) Object.assign(data, fn(m[1]));
  }

  // Kraftstoff (P.3): Schlüsselwörter
  const kraftMap = [
    ['diesel', 'Diesel'], ['benzin', 'Benzin'], ['petrol', 'Benzin'],
    ['elektro', 'Elektro'], ['electric', 'Elektro'],
    ['plug-in', 'Plug-in Hybrid'], ['hybrid', 'Hybrid Benzin'],
    ['erdgas', 'Erdgas'], [' cng', 'Erdgas'], [' lpg', 'Autogas'],
    ['autogas', 'Autogas'], ['wasserstoff', 'Wasserstoff']
  ];
  const lct = text.toLowerCase();
  for (const [kw, val] of kraftMap) {
    if (lct.includes(kw)) { data.kraftstoff = val; break; }
  }

  // Schadstoffklasse V.9: „Euro Xd" / „Euro 6d-TEMP" etc.
  const euM = text.match(/Euro\s*(\d[a-zA-Z\-]*)/i);
  if (euM) data.umwelt = `Euro ${euM[1]}`;

  return data;
}

function _fillZBIForm(data) {
  const map = {
    kz: 'fpKz', erstzulassung: 'fpBaujahr', marke: 'fpMarke',
    typ: 'fpTyp', handelsbezeichnung: 'fpHandelsbezeichnung', fin: 'fpFin',
    gesamtmasse: 'fpGesamtmasse', leergewicht: 'fpLeergewicht',
    fahrzeugklasse: 'fpFahrzeugklasse', hubraum: 'fpHubraum',
    leistung: 'fpLeistung', sitzplaetze: 'fpSitzplaetze',
    vmax: 'fpVmax', co2: 'fpCo2', farbe: 'fpFarbe',
    o1: 'fpO1', o2: 'fpO2'
  };
  let count = 0;
  for (const [key, id] of Object.entries(map)) {
    const val = data[key];
    if (val !== undefined && val !== null && val !== '') {
      const el = document.getElementById(id);
      if (el) { el.value = val; el.classList.add('detected'); count++; }
    }
  }
  if (data.kraftstoff) {
    const sel = document.getElementById('fpKraftstoff');
    const lc = data.kraftstoff.toLowerCase();
    const opt = Array.from(sel.options).find(o =>
      o.value.toLowerCase().includes(lc) || lc.includes(o.value.toLowerCase().split(' ')[0])
    );
    if (opt) { sel.value = opt.value; sel.classList.add('detected'); count++; }
  }
  if (data.umwelt) {
    const sel = document.getElementById('fpUmwelt');
    const lc = data.umwelt.toLowerCase();
    const opt = Array.from(sel.options).find(o => o.value.toLowerCase() === lc);
    if (opt) { sel.value = opt.value; sel.classList.add('detected'); count++; }
  }
  return count;
}

/* ═══ Fuhrpark ═══ */
function openFuhrpark() {
  document.getElementById('fpOverlay').style.display = 'flex';
  renderFahrzeuge();
}

function closeFuhrpark() {
  document.getElementById('fpOverlay').style.display = 'none';
}

function addFahrzeug() {
  const kz = document.getElementById('fpKz').value.trim().toUpperCase();
  if (!kz) { alert('Bitte Kennzeichen eingeben.'); return; }
  const isEdit = !!window._fpEditId;
  const fz = {
    id: isEdit ? window._fpEditId : Date.now(),
    kz,
    typ: document.getElementById('fpTyp').value.trim(),
    farbe: document.getElementById('fpFarbe').value.trim(),
    baujahr: document.getElementById('fpBaujahr').value,
    tuev: document.getElementById('fpTuev').value,
    hu: document.getElementById('fpHu').value,
    oel: document.getElementById('fpOel').value,
    notiz: document.getElementById('fpNotiz').value.trim(),
    foto: window._fpFotoBase64 || null,
    fin: document.getElementById('fpFin').value.trim(),
    marke: document.getElementById('fpMarke').value.trim(),
    handelsbezeichnung: document.getElementById('fpHandelsbezeichnung').value.trim(),
    hubraum: document.getElementById('fpHubraum').value,
    leistung: document.getElementById('fpLeistung').value,
    kraftstoff: document.getElementById('fpKraftstoff').value,
    fahrzeugklasse: document.getElementById('fpFahrzeugklasse').value.trim(),
    sitzplaetze: document.getElementById('fpSitzplaetze').value,
    vmax: document.getElementById('fpVmax').value,
    leergewicht: document.getElementById('fpLeergewicht').value,
    gesamtmasse: document.getElementById('fpGesamtmasse').value,
    co2: document.getElementById('fpCo2').value,
    umwelt: document.getElementById('fpUmwelt').value,
    o1: document.getElementById('fpO1')?.value || '',
    o2: document.getElementById('fpO2')?.value || '',
  };
  if (isEdit) {
    fahrzeuge = fahrzeuge.map(f => f.id === window._fpEditId ? fz : f);
  } else {
    fahrzeuge.push(fz);
  }
  saveFahrzeuge();
  renderFahrzeuge();
  fillFahrzeugSelect();
  updateFuhrparkBadge();
  _fpClearForm();
}

function editFahrzeug(id) {
  const fz = fahrzeuge.find(f => f.id === id);
  if (!fz) return;
  window._fpEditId = id;
  const set = (elId, val) => { const el = document.getElementById(elId); if (el && val != null) el.value = val; };
  set('fpKz', fz.kz); set('fpTyp', fz.typ||''); set('fpFarbe', fz.farbe||'');
  set('fpBaujahr', fz.baujahr||''); set('fpTuev', fz.tuev||''); set('fpHu', fz.hu||'');
  set('fpOel', fz.oel||''); set('fpNotiz', fz.notiz||'');
  set('fpFin', fz.fin||''); set('fpMarke', fz.marke||'');
  set('fpHandelsbezeichnung', fz.handelsbezeichnung||'');
  set('fpHubraum', fz.hubraum||''); set('fpLeistung', fz.leistung||'');
  set('fpKraftstoff', fz.kraftstoff||''); set('fpFahrzeugklasse', fz.fahrzeugklasse||'');
  set('fpSitzplaetze', fz.sitzplaetze||''); set('fpVmax', fz.vmax||'');
  set('fpLeergewicht', fz.leergewicht||''); set('fpGesamtmasse', fz.gesamtmasse||'');
  set('fpCo2', fz.co2||''); set('fpUmwelt', fz.umwelt||'');
  set('fpO1', fz.o1||''); set('fpO2', fz.o2||'');
  if (fz.foto) {
    window._fpFotoBase64 = fz.foto;
    document.getElementById('fpFotoImg').src = fz.foto;
    document.getElementById('fpFotoPreview').style.display = 'block';
    document.getElementById('fpFotoDrop').style.display = 'none';
  }
  const title = document.getElementById('fpFormTitle');
  if (title) title.textContent = '✏ Fahrzeug bearbeiten';
  document.getElementById('fpCancelEdit').style.display = 'block';
  document.querySelector('.fp-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function _fpClearForm() {
  const ids = ['fpKz','fpTyp','fpFarbe','fpBaujahr','fpTuev','fpHu','fpOel','fpNotiz',
    'fpFin','fpMarke','fpHandelsbezeichnung','fpHubraum','fpLeistung',
    'fpFahrzeugklasse','fpSitzplaetze','fpVmax','fpLeergewicht','fpGesamtmasse','fpCo2',
    'fpO1','fpO2'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('detected'); }
  });
  ['fpKraftstoff','fpUmwelt'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.selectedIndex = 0; el.classList.remove('detected'); }
  });
  // Alle detektierten zbi-inp-Felder zurücksetzen
  document.querySelectorAll('.zbi-inp.detected').forEach(el => el.classList.remove('detected'));
  fpFotoRemove();
  fpZBIRemove();
  window._fpEditId = null;
  document.getElementById('fpCancelEdit').style.display = 'none';
  const title = document.getElementById('fpFormTitle');
  if (title) title.textContent = '+ Neues Fahrzeug hinzufügen';
  const kz = document.getElementById('fpKz');
  if (kz) kz.removeAttribute('readonly');
}

function delFahrzeug(id) {
  if (!confirm('Fahrzeug löschen?')) return;
  fahrzeuge = fahrzeuge.filter(f => f.id !== id);
  saveFahrzeuge();
  renderFahrzeuge();
  fillFahrzeugSelect();
  updateFuhrparkBadge();
}

function renderFahrzeuge() {
  const liste = document.getElementById('fpFahrzeugListe');
  if (!fahrzeuge.length) {
    liste.innerHTML = '<div style="color:var(--muted);font-size:12.5px;padding:8px 0 14px;">Noch keine Fahrzeuge hinterlegt.</div>';
    return;
  }
  const delIcon = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;
  const editIcon = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const fmtDate = v => { if (!v) return ''; const p = v.split('-'); return p.length===3 ? `${p[2]}.${p[1]}.${p[0]}` : v; };
  const dateBadge = (label, date) => {
    if (!date) return '';
    const d = new Date(date), now = new Date();
    const diff = Math.floor((d - now) / 864e5);
    const cls = diff < 0 ? 'fz-over' : diff < 60 ? 'fz-warn' : 'fz-ok';
    return `<span class="fz-badge ${cls}">${label} ${fmtDate(date)}</span>`;
  };
  liste.innerHTML = fahrzeuge.map(fz => {
    const name = [fz.marke||'', fz.handelsbezeichnung||fz.typ||''].filter(Boolean).join(' ').trim();
    const sub = [fz.farbe, fz.kraftstoff, fz.leistung ? fz.leistung+' kW' : ''].filter(Boolean).join(' · ');
    const fin = fz.fin ? `<span style="font-size:10.5px;font-family:monospace;color:var(--muted);">FIN …${fz.fin.slice(-6)}</span>` : '';
    return `<div class="fz-card">
      <div class="fz-icon"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M5 17H3a2 2 0 0 1-2-2V9l3-5h10l3 5h2a2 2 0 0 1 2 2v1"/><path d="M17 17H9"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg></div>
      <div class="fz-info">
        <div class="fz-kz">${fz.kz}</div>
        <div class="fz-typ">${name || (fz.typ||'')} ${fz.baujahr ? '· '+fz.baujahr.slice(0,4) : ''}</div>
        ${sub ? `<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">${sub}</div>` : ''}
        <div class="fz-dates">
          ${dateBadge('TÜV', fz.tuev)}${dateBadge('HU', fz.hu)}${fin}
        </div>
      </div>
      <div class="fz-actions">
        <button class="fz-edit" onclick="editFahrzeug(${fz.id})" title="Bearbeiten">${editIcon}</button>
        <button class="fz-del" onclick="delFahrzeug(${fz.id})" title="Löschen">${delIcon}</button>
      </div>
    </div>`;
  }).join('');
}

function fillFahrzeugSelect() {
  const sel = document.getElementById('fFahrzeug');
  if (!sel) return;
  sel.innerHTML = '<option value="">– Fahrzeug wählen –</option>' +
    fahrzeuge.map(fz => `<option value="${fz.kz}">${fz.kz}${fz.typ ? ' – ' + fz.typ : ''}</option>`).join('');
}

function updateFuhrparkBadge() {
  const badge = document.getElementById('fuhrparkWarnBadge');
  if (!badge) return;
  badge.textContent = fahrzeuge.length || '';
  badge.style.display = fahrzeuge.length ? 'inline' : 'none';
}

function load() {
  try { const r=localStorage.getItem(SAVE_KEY); if(r) fahrten=JSON.parse(r); } catch(e) {}
  try { const r=localStorage.getItem(FZ_KEY); if(r) fahrzeuge=JSON.parse(r); } catch(e) {}
  document.getElementById('fDatum').value = new Date().toISOString().split('T')[0];
  if (fahrten.length) {
    const last = fahrten[0];
    document.getElementById('fStartKm').value = last.endKm;
    document.getElementById('fStartOrt').value = last.zielOrt || '';
    updateRouteVis();
  }
  try {
    const p = JSON.parse(localStorage.getItem('max4work_fahrt_pending') || 'null');
    if (p) {
      localStorage.removeItem('max4work_fahrt_pending');
      if (p.datum) document.getElementById('fDatum').value = p.datum;
      if (p.startOrt !== undefined) document.getElementById('fStartOrt').value = p.startOrt;
      if (p.zielOrt) document.getElementById('fZielOrt').value = p.zielOrt;
      if (p.abfahrt) document.getElementById('fAbfahrt').value = p.abfahrt;
      if (p.ankunft) document.getElementById('fAnkunft').value = p.ankunft;
      if (p.kunde) document.getElementById('fKunde').value = p.kunde;
      if (p.notiz) document.getElementById('fNotiz').value = p.notiz;
      if (p.zweck) {
        document.querySelectorAll('.zweck-btn').forEach(b => b.classList.remove('on'));
        const btn = document.querySelector(`.zweck-btn[data-z="${p.zweck}"]`);
        if (btn) { btn.classList.add('on'); currentZweck = p.zweck; }
      }
      updateRouteVis();
      const banner = document.getElementById('fahrtPendingBanner');
      if (banner) {
        document.getElementById('fahrtPendingTitel').textContent = p._titel || 'Termin';
        banner.style.display = 'flex';
      }
    }
  } catch(e) {}
  fillFahrzeugSelect();
  updateFuhrparkBadge();
  fillMonatFilter(); fillKundenList(); render();
}
load();
