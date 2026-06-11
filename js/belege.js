const SAVE_KEY = 'max4work_belege';
let belege = [], fileData = null, fileName = null, currentFilter = 'alle', currentKat = 'Material', editId = null, camStream = null;

function fillKennzeichenList() {
  try {
    const fz = JSON.parse(localStorage.getItem('max4work_fahrzeuge') || '[]');
    document.getElementById('kennzeichenList').innerHTML =
      fz.map(f => `<option value="${f.kz}">${f.kz}${f.typ ? ' – ' + f.typ : ''}</option>`).join('');
  } catch(e) {}
}

const KAT_SVG = {
  Material: `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`,
  Werkzeug: `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.77 3.77z"/></svg>`,
  Fahrzeug: `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 17H3a2 2 0 0 1-2-2V9l3-5h10l3 5h2a2 2 0 0 1 2 2v1"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`,
  Büro:     `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
  Sonstiges:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
};

/* ═══ Kategorie & Sub-Typ ═══ */
let currentSubTyp = 'tanken';

function selectKat(el) {
  document.querySelectorAll('.kat-chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  currentKat = el.dataset.kat;
  document.getElementById('bKatCustom').style.display = currentKat === '__custom__' ? 'block' : 'none';
  document.getElementById('fahrzeugSection').style.display = currentKat === 'Fahrzeug' ? 'block' : 'none';
  if (currentKat === 'Fahrzeug') selectSubTyp(document.querySelector('.subtyp-btn.on') || document.querySelector('[data-typ="tanken"]'));
}

function selectSubTyp(el) {
  document.querySelectorAll('.subtyp-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  currentSubTyp = el.dataset.typ;
  document.getElementById('tankSection').style.display = currentSubTyp === 'tanken' ? 'block' : 'none';
  document.getElementById('parkSection').style.display = currentSubTyp === 'parken' ? 'block' : 'none';
  if (currentSubTyp === 'tanken') {
    document.getElementById('bNotiz').placeholder = 'z.B. Vollgetankt, Autobahn-Fahrt...';
  } else if (currentSubTyp === 'parken') {
    document.getElementById('bNotiz').placeholder = 'z.B. Kundentermin, Stadtmitte...';
  }
}

function calcTankBetrag() {
  const liter = parseFloat(document.getElementById('tankLiter').value) || 0;
  const preis = parseFloat(document.getElementById('tankPreis').value) || 0;
  const badge = document.getElementById('tankCalcBadge');
  if (liter > 0 && preis > 0) {
    const total = (liter * preis).toFixed(2);
    document.getElementById('bBetrag').value = total;
    document.getElementById('bBetrag').classList.add('detected');
    badge.textContent = `⛽ ${liter.toFixed(2).replace('.',',')} L × ${preis.toFixed(3).replace('.',',')} €/L = ${parseFloat(total).toFixed(2).replace('.',',')} €`;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
    document.getElementById('bBetrag').classList.remove('detected');
  }
}

function calcParkDauer() {
  const von = document.getElementById('parkVon').value;
  const bis = document.getElementById('parkBis').value;
  if (!von || !bis) return;
  const [vh,vm] = von.split(':').map(Number);
  const [bh,bm] = bis.split(':').map(Number);
  let diff = (bh*60+bm) - (vh*60+vm);
  if (diff < 0) diff += 24*60;
  const h = Math.floor(diff/60), m = diff%60;
  document.getElementById('parkDauer').value = h > 0 ? `${h} Std. ${m} Min.` : `${m} Min.`;
}
function getKat() {
  if (currentKat === '__custom__') return document.getElementById('bKatCustom').value.trim() || 'Sonstiges';
  return currentKat;
}

/* ═══ Live-Kamera ═══ */
function openCamPanel() {
  // Auf Smartphone: input[capture] synchron auslösen (getUserMedia scheitert auf file://)
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile || !navigator.mediaDevices?.getUserMedia) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
    inp.onchange = e => handleScan(e, 'camera');
    inp.click();
    return;
  }
  // Desktop: Live-Kamera-Panel öffnen
  const panel = document.getElementById('camPanel');
  const video = document.getElementById('camVideo');
  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
    .then(stream => {
      camStream = stream;
      video.srcObject = stream;
      panel.style.display = 'block';
    })
    .catch(() => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
      inp.onchange = e => handleScan(e, 'camera');
      inp.click();
    });
}

function closeCamPanel() {
  if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  document.getElementById('camPanel').style.display = 'none';
  document.getElementById('camVideo').srcObject = null;
}

function captureBelegPhoto() {
  const video = document.getElementById('camVideo');
  const canvas = document.createElement('canvas');
  const MAX = 1400;
  let w = video.videoWidth, h = video.videoHeight;
  if (w > MAX || h > MAX) { if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;} }
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(video, 0, 0, w, h);
  fileData = canvas.toDataURL('image/jpeg', 0.85);
  fileName = `beleg_${Date.now()}.jpg`;
  showImgPreview(fileData);
  closeCamPanel();
  runOCR(fileData);
}

/* ═══ Scan & OCR ═══ */
async function handleScan(e, source) {
  const file = e.target.files[0]; if (!file) return;
  const isImg = file.type.startsWith('image/');
  const reader = new FileReader();
  reader.onload = async ev => {
    if (isImg) {
      // Komprimieren
      const img = new Image();
      img.onload = async () => {
        const MAX = 1400;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) { if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;} }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        fileData = canvas.toDataURL('image/jpeg', 0.85);
        fileName = file.name.replace(/\.[^.]+$/, '.jpg');
        showImgPreview(fileData);
        // OCR starten
        await runOCR(fileData);
      };
      img.src = ev.target.result;
    } else {
      fileData = ev.target.result; fileName = file.name;
    }
  };
  reader.readAsDataURL(file);
}

async function runOCR(imgData) {
  const statusEl = document.getElementById('ocrStatus');
  const msgEl    = document.getElementById('ocrMsg');
  const barEl    = document.getElementById('ocrBarFill');
  statusEl.style.display = 'block';
  document.getElementById('ocrDetected').style.display = 'none';
  document.getElementById('ocrBadge').style.display = 'none';

  try {
    msgEl.textContent = 'Sende an OCR.space…';
    barEl.style.width = '20%';

    const apiKey = localStorage.getItem('max4work_ocr_key') || 'helloworld';
    const params = new URLSearchParams({
      base64Image: imgData,
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
    barEl.style.width = '75%';
    if (!resp.ok) throw new Error(`Server-Fehler ${resp.status}`);
    const result = await resp.json();
    if (result.IsErroredOnProcessing) throw new Error(result.ErrorMessage?.[0] || 'OCR fehlgeschlagen');
    const text = result.ParsedResults?.[0]?.ParsedText || '';
    if (!text.trim()) throw new Error('Kein Text erkannt – schärferes Foto verwenden');
    barEl.style.width = '100%';
    extractFromOCR(text);
  } catch(err) {
    msgEl.textContent = '✗ ' + (err.message || 'OCR fehlgeschlagen');
    setTimeout(() => { statusEl.style.display = 'none'; }, 4000);
  }
}

// Bekannte Lieferanten: [Schlüsselwörter, Anzeigename, Kategorie]
const _OCR_VENDORS = [
  { keys:['aral'],              name:'ARAL',            kat:'Fahrzeug' },
  { keys:['shell'],             name:'Shell',           kat:'Fahrzeug' },
  { keys:['esso'],              name:'Esso',             kat:'Fahrzeug' },
  { keys:['bp '],               name:'BP',              kat:'Fahrzeug' },
  { keys:['jet ','jet-'],       name:'JET',             kat:'Fahrzeug' },
  { keys:['avia'],              name:'Avia',            kat:'Fahrzeug' },
  { keys:['star tankstelle','star-tankstelle'], name:'Star', kat:'Fahrzeug' },
  { keys:['eni '],              name:'Eni',             kat:'Fahrzeug' },
  { keys:['hem '],              name:'HEM',             kat:'Fahrzeug' },
  { keys:['total energies','total tankstelle'], name:'TotalEnergies', kat:'Fahrzeug' },
  { keys:['obi ','obi-'],       name:'OBI',             kat:'Material' },
  { keys:['hornbach'],          name:'Hornbach',        kat:'Material' },
  { keys:['bauhaus'],           name:'Bauhaus',         kat:'Material' },
  { keys:['hagebau'],           name:'Hagebaumarkt',    kat:'Material' },
  { keys:['toom bau'],          name:'toom',            kat:'Material' },
  { keys:['globus bau'],        name:'Globus Baumarkt', kat:'Material' },
  { keys:['würth','wurth'],     name:'Würth',           kat:'Werkzeug' },
  { keys:['bosch shop'],        name:'Bosch',           kat:'Werkzeug' },
  { keys:['hilti'],             name:'Hilti',           kat:'Werkzeug' },
  { keys:['stabilo'],           name:'Stabilo',         kat:'Büro' },
  { keys:['staples'],           name:'Staples',         kat:'Büro' },
  { keys:['viking'],            name:'Viking',          kat:'Büro' },
  { keys:['amazon.de','amazon '], name:'Amazon',        kat:'Büro' },
  { keys:['ikea'],              name:'IKEA',            kat:'Büro' },
  { keys:['aldi'],              name:'Aldi',            kat:'Büro' },
  { keys:['lidl'],              name:'Lidl',            kat:'Büro' },
  { keys:['rewe'],              name:'REWE',            kat:'Büro' },
  { keys:['edeka'],             name:'EDEKA',           kat:'Büro' },
  { keys:['dhl'],               name:'DHL',             kat:'Büro' },
  { keys:['deutsche post'],     name:'Deutsche Post',   kat:'Büro' },
];

function _ocrParseAmount(text) {
  const normalize = s => parseFloat(s.replace(/\./g,'').replace(',','.'));
  // Priorität 1: explizite Summen-Begriffe
  const totalPat = /(?:gesamt(?:betrag)?|endbetrag|summe|total|zu\s*zahlen|rechnungs?betrag|brutto\s*gesamt|netto\s*gesamt|bar)\s*:?\s*(\d{1,4}[.,]\d{2})/gi;
  let m, amounts = [];
  while ((m = totalPat.exec(text)) !== null) {
    const v = normalize(m[1]); if (v > 0.01 && v < 99999) amounts.push(v);
  }
  if (amounts.length) return Math.max(...amounts);
  // Priorität 2: Betrag vor/nach €
  const euroPat = /(\d{1,4}[.,]\d{2})\s*€|€\s*(\d{1,4}[.,]\d{2})/g;
  while ((m = euroPat.exec(text)) !== null) {
    const v = normalize(m[1]||m[2]); if (v > 0.01 && v < 99999) amounts.push(v);
  }
  if (amounts.length) return Math.max(...amounts);
  // Priorität 3: Jeder Betrag mit 2 Nachkommastellen
  const anyPat = /\b(\d{1,4}[.,]\d{2})\b/g;
  while ((m = anyPat.exec(text)) !== null) {
    const v = normalize(m[1]); if (v > 0.01 && v < 99999) amounts.push(v);
  }
  return amounts.length ? Math.max(...amounts) : null;
}

function _ocrParseDate(text) {
  // DD.MM.YYYY oder DD.MM.YY (bevorzugt — häufigst auf deutschen Belegen)
  const p1 = /\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/g;
  let m;
  while ((m = p1.exec(text)) !== null) {
    let [,d,mo,y] = m;
    if (y.length === 2) y = '20'+y;
    const month = parseInt(mo), day = parseInt(d);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && parseInt(y) >= 2000) {
      return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
  }
  // YYYY-MM-DD
  const p2 = /\b(20\d{2})-(\d{2})-(\d{2})\b/;
  const m2 = p2.exec(text);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  return null;
}

function _ocrParseVendor(text) {
  const lower = text.toLowerCase();
  // Bekannte Lieferanten prüfen
  for (const v of _OCR_VENDORS) {
    if (v.keys.some(k => lower.includes(k))) return v;
  }
  // Aus bisherigen Belegen lernen
  try {
    const hist = JSON.parse(localStorage.getItem('max4work_belege') || '[]');
    const notizen = [...new Set(hist.map(b => (b.notiz||'').trim()).filter(n => n.length > 2))];
    for (const n of notizen) {
      if (lower.includes(n.toLowerCase()) || n.toLowerCase().split(' ').some(w => w.length > 3 && lower.includes(w))) {
        const katCount = {};
        hist.filter(b => (b.notiz||'').toLowerCase().includes(n.toLowerCase().split(' ')[0]))
            .forEach(b => { if (b.kat) katCount[b.kat] = (katCount[b.kat]||0)+1; });
        const kat = Object.entries(katCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
        return { name: n, kat };
      }
    }
  } catch(e) {}
  // Aus den ersten Zeilen des Textes einen Namen ableiten
  const lines = text.split('\n').map(l=>l.trim()).filter(l => l.length > 2 && /[a-zäöüA-ZÄÖÜ]{3,}/.test(l) && !/^\d+$/.test(l));
  return lines.length ? { name: lines[0].substring(0, 40), kat: null } : null;
}

function extractFromOCR(text) {
  document.getElementById('ocrStatus').style.display = 'none';
  const lower = text.toLowerCase();
  const detected = {};

  // Betrag
  const betrag = _ocrParseAmount(text);
  if (betrag !== null) detected.betrag = betrag.toFixed(2);

  // Datum
  detected.datum = _ocrParseDate(text);

  // Anbieter + Kategorie
  const vendor = _ocrParseVendor(text);
  if (vendor) { detected.vendor = vendor.name; if (vendor.kat) detected.kat = vendor.kat; }

  // Kategorie aus Keywords falls noch nicht gesetzt
  if (!detected.kat) {
    const katMap = [
      { keys:['tank','kraftstoff','benzin','diesel','liter','€/l','e10','super','kraftstoff'], kat:'Fahrzeug' },
      { keys:['parkhaus','parkschein','parkticket','parken','parkplatz','parkgebühr'],         kat:'Fahrzeug' },
      { keys:['werkzeug','hammer','säge','bohrer','schraube','dübel','schrauber'],             kat:'Werkzeug' },
      { keys:['büro','papier','drucker','toner','stift','ordner','briefumschlag','briefmarke'],kat:'Büro' },
      { keys:['material','baustoffe','baumarkt','schrauben','dübel','holz','farbe','lack'],    kat:'Material' },
    ];
    for (const e of katMap) {
      if (e.keys.some(k => lower.includes(k))) { detected.kat = e.kat; break; }
    }
  }

  // MwSt (Info-Extraktion)
  const mwstM = /(\d{1,4}[.,]\d{2})\s*(?:mwst|mehrwertsteuer|ust|umsatzsteuer)/i.exec(text);
  if (mwstM) detected.mwst = parseFloat(mwstM[1].replace(',','.')).toFixed(2);

  // Tankspezifisch: Liter + Preis/L
  const lm = /(\d+[,.]\d{2,3})\s*(?:liter|ltr\b)/gi.exec(text);
  const pm = /(\d+[,.]\d{3})\s*€\/l/gi.exec(text);
  if (lm) { const el = document.getElementById('tankLiter'); if(el) el.value = parseFloat(lm[1].replace(',','.')).toFixed(2); }
  if (pm) { const el = document.getElementById('tankPreis'); if(el) el.value = parseFloat(pm[1].replace(',','.')).toFixed(3); }

  // Tankstellen-Name
  if (vendor?.name) {
    const ts = document.getElementById('tankStelle');
    if (ts && !ts.value) ts.value = vendor.name;
  }

  // Parkort
  const pkM = /(?:parkhaus|parkplatz|parking)\s+([A-ZÄÖÜ][a-zäöüA-ZÄÖÜa-z\s]{2,30})/i.exec(text);
  if (pkM) { const el = document.getElementById('parkOrt'); if(el && !el.value) el.value = pkM[0].trim(); }

  // Felder befüllen + Ergebnis anzeigen
  const parts = [];
  if (detected.betrag) {
    const el = document.getElementById('bBetrag');
    if (el) { el.value = detected.betrag; el.classList.add('detected'); }
    parts.push(`Betrag: <strong>${detected.betrag.replace('.',',')} €</strong>`);
  }
  if (detected.datum) {
    const el = document.getElementById('bDatum');
    if (el) { el.value = detected.datum; el.classList.add('detected'); }
    parts.push(`Datum: <strong>${fmtDate(detected.datum)}</strong>`);
  }
  if (detected.vendor) {
    const el = document.getElementById('bNotiz');
    if (el && !el.value) el.value = detected.vendor;
    parts.push(`Anbieter: <strong>${detected.vendor}</strong>`);
  }
  if (detected.kat) {
    const chip = document.querySelector(`.kat-chip[data-kat="${detected.kat}"]`);
    if (chip) selectKat(chip);
    parts.push(`Kategorie: <strong>${detected.kat}</strong>`);
  }
  if (detected.mwst) {
    parts.push(`MwSt: <strong>${detected.mwst.replace('.',',')} €</strong>`);
  }

  if (parts.length) {
    const det = document.getElementById('ocrDetected');
    det.innerHTML = '<strong>✓ Erkannt:</strong> ' + parts.join(' &nbsp;·&nbsp; ');
    det.style.display = 'block';
    document.getElementById('ocrBadge').style.display = 'inline';
  } else {
    const det = document.getElementById('ocrDetected');
    det.innerHTML = '<span style="color:var(--muted)">Keine Felder erkannt – bitte manuell ausfüllen.</span>';
    det.style.display = 'block';
  }
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

function showImgPreview(src) {
  document.getElementById('imgPreview').src = src;
  document.getElementById('imgWrap').style.display = 'block';
}

function removeImg() {
  fileData = null; fileName = null;
  document.getElementById('imgWrap').style.display = 'none';
  document.getElementById('bFile').value = '';
  document.getElementById('ocrDetected').style.display = 'none';
  document.getElementById('ocrBadge').style.display = 'none';
  ['bBetrag','bDatum'].forEach(id => document.getElementById(id).classList.remove('detected'));
}

/* ═══ Beleg speichern / aktualisieren ═══ */
function addBeleg() {
  const datum = document.getElementById('bDatum').value;
  const betrag = parseFloat(document.getElementById('bBetrag').value);
  if (!datum) { alert('Bitte Datum angeben.'); return; }
  if (isNaN(betrag) || betrag <= 0) { alert('Bitte gültigen Betrag angeben.'); return; }
  const kat = getKat();
  const notiz = document.getElementById('bNotiz').value.trim();
  const steuer = document.getElementById('bSteuer').checked;
  let extras = {};
  if (kat === 'Fahrzeug') {
    extras.subtyp = currentSubTyp;
    if (currentSubTyp === 'tanken') {
      extras.tankStelle = document.getElementById('tankStelle').value.trim();
      extras.kraftstoff = document.getElementById('tankKraftstoff').value;
      extras.liter = parseFloat(document.getElementById('tankLiter').value) || 0;
      extras.preisProLiter = parseFloat(document.getElementById('tankPreis').value) || 0;
      extras.kmStand = parseInt(document.getElementById('tankKm').value) || 0;
      extras.kennzeichen = document.getElementById('tankKennzeichen').value.trim().toUpperCase();
    } else if (currentSubTyp === 'parken') {
      extras.parkOrt = document.getElementById('parkOrt').value.trim();
      extras.parkVon = document.getElementById('parkVon').value;
      extras.parkBis = document.getElementById('parkBis').value;
      extras.parkDauer = document.getElementById('parkDauer').value;
      extras.kennzeichen = document.getElementById('parkKennzeichen').value.trim().toUpperCase();
    }
  }
  if (editId !== null) {
    const idx = belege.findIndex(b => b.id === editId);
    if (idx !== -1) {
      const orig = belege[idx];
      belege[idx] = { id: orig.id, datum, betrag, kat, notiz, steuer, file: fileData !== null ? fileData : orig.file, fileName: fileData !== null ? fileName : orig.fileName, ...extras };
    }
    save(); render(); resetForm();
  } else {
    const b = { id: Date.now(), datum, betrag, kat, notiz, steuer, file: fileData, fileName, ...extras };
    belege.unshift(b);
    save();
    autoTermin(b);
    render(); resetForm();
  }
}

function editBeleg(id) {
  const b = belege.find(x => x.id === id);
  if (!b) return;
  editId = id;
  document.getElementById('bDatum').value = b.datum || '';
  document.getElementById('bBetrag').value = b.betrag || '';
  document.getElementById('bNotiz').value = b.notiz || '';
  document.getElementById('bSteuer').checked = !!b.steuer;
  // Kategorie setzen
  let katChip = document.querySelector(`.kat-chip[data-kat="${b.kat}"]`);
  if (!katChip) {
    katChip = document.querySelector('.kat-chip[data-kat="__custom__"]');
    document.getElementById('bKatCustom').value = b.kat;
  }
  if (katChip) selectKat(katChip);
  // Fahrzeug-Extras
  if (b.kat === 'Fahrzeug' && b.subtyp) {
    const stBtn = document.querySelector(`.subtyp-btn[data-typ="${b.subtyp}"]`);
    if (stBtn) selectSubTyp(stBtn);
    if (b.subtyp === 'tanken') {
      document.getElementById('tankStelle').value = b.tankStelle || '';
      if (b.kraftstoff) document.getElementById('tankKraftstoff').value = b.kraftstoff;
      document.getElementById('tankLiter').value = b.liter || '';
      document.getElementById('tankPreis').value = b.preisProLiter || '';
      document.getElementById('tankKm').value = b.kmStand || '';
      document.getElementById('tankKennzeichen').value = b.kennzeichen || '';
    } else if (b.subtyp === 'parken') {
      document.getElementById('parkOrt').value = b.parkOrt || '';
      document.getElementById('parkVon').value = b.parkVon || '';
      document.getElementById('parkBis').value = b.parkBis || '';
      document.getElementById('parkDauer').value = b.parkDauer || '';
      document.getElementById('parkKennzeichen').value = b.kennzeichen || '';
    }
  }
  // Bild laden
  if (b.file) {
    fileData = b.file; fileName = b.fileName;
    showImgPreview(b.file);
  } else {
    fileData = null; fileName = null;
    document.getElementById('imgWrap').style.display = 'none';
  }
  // UI auf Bearbeiten-Modus umschalten
  document.querySelector('.panel-head span:first-child').textContent = 'Beleg bearbeiten';
  const saveBtn = document.querySelector('.btn-blue.btn-full');
  saveBtn.textContent = '✓ Änderungen speichern';
  // Abbrechen-Button einfügen (falls noch nicht vorhanden)
  if (!document.getElementById('editCancelBtn')) {
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'editCancelBtn';
    cancelBtn.className = 'btn btn-ghost btn-full';
    cancelBtn.style.marginTop = '4px';
    cancelBtn.textContent = 'Abbrechen';
    cancelBtn.onclick = resetForm;
    saveBtn.insertAdjacentElement('afterend', cancelBtn);
  }
  document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function autoTermin(b) {
  try {
    const termine = JSON.parse(localStorage.getItem('max4work_termine') || '[]');
    const katColor = { Material:'#F97316', Werkzeug:'#8B5CF6', Fahrzeug:'#3B82F6', Büro:'#C8D93A', Sonstiges:'#7B8278' };
    termine.push({
      id: Date.now(),
      titel: `Beleg: ${b.kat} – ${fmt(b.betrag)} €`,
      datum: b.datum, von: '', bis: '', ganztag: 'ja',
      kunde: b.notiz || b.kat,
      notiz: `Beleg automatisch erfasst${b.steuer ? ' · steuerrelevant' : ''}`,
      farbe: katColor[b.kat] || '#7B8278'
    });
    localStorage.setItem('max4work_termine', JSON.stringify(termine));
  } catch(e) {}
}

function resetForm() {
  editId = null;
  document.getElementById('bDatum').value = new Date().toISOString().split('T')[0];
  document.getElementById('bBetrag').value = '';
  document.getElementById('bNotiz').value = '';
  document.getElementById('bKatCustom').value = '';
  document.getElementById('bSteuer').checked = true;
  ['tankStelle','tankLiter','tankPreis','tankKm','tankKennzeichen','parkOrt','parkVon','parkBis','parkDauer','parkKennzeichen'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('tankCalcBadge').style.display = 'none';
  document.getElementById('fahrzeugSection').style.display = 'none';
  removeImg();
  selectKat(document.querySelector('.kat-chip[data-kat="Material"]'));
  document.getElementById('ocrStatus').style.display = 'none';
  // Edit-Modus zurücksetzen
  document.querySelector('.panel-head span:first-child').textContent = 'Beleg erfassen';
  const saveBtn = document.querySelector('.btn-blue.btn-full');
  saveBtn.textContent = '+ Beleg speichern';
  const cancelBtn = document.getElementById('editCancelBtn');
  if (cancelBtn) cancelBtn.remove();
}

function setFilter(el, f) {
  document.querySelectorAll('.fchip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  currentFilter = f;
  render();
}

/* ═══ Render ═══ */
function render() {
  let filtered = belege;
  if (currentFilter === 'steuer') filtered = belege.filter(b => b.steuer);
  else if (currentFilter !== 'alle') filtered = belege.filter(b => b.kat === currentFilter);

  const delIcon = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
  const editIcon = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const starIcon = `<svg width="10" height="10" fill="#F59E0B" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  const noThumbIcon = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

  const liste = document.getElementById('belegListe');
  if (!filtered.length) {
    liste.innerHTML = `<div class="empty"><svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24" style="opacity:.3;margin-bottom:8px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><br>Keine Belege gefunden.</div>`;
  } else {
    liste.innerHTML = filtered.map(b => {
      const katSvg = KAT_SVG[b.kat] || KAT_SVG.Sonstiges;
      const thumb = b.file && b.file.startsWith('data:image')
        ? `<img class="beleg-thumb" src="${b.file}" onclick="openLightbox('${b.file}')" alt="Beleg">`
        : `<div class="beleg-no-thumb" style="color:var(--muted)">${noThumbIcon}</div>`;
      return `<div class="beleg-row">
        ${thumb}
        <div class="beleg-info">
          <div class="beleg-titel">${esc(b.notiz || b.kat)}</div>
          <div class="beleg-meta">
            ${fmtDate(b.datum)}
            <span class="badge-kat" style="display:inline-flex;align-items:center;gap:3px;">${katSvg} ${esc(b.kat)}</span>
            ${b.steuer ? `<span class="badge-steuer" style="display:inline-flex;align-items:center;gap:3px;">${starIcon} Steuer</span>` : ''}
          </div>
          ${b.subtyp === 'tanken' && b.liter ? `<div class="beleg-detail">⛽ ${b.kraftstoff||''} · ${String(b.liter).replace('.',',')} L · ${b.tankStelle||''} ${b.kmStand ? '· '+b.kmStand.toLocaleString('de-DE')+' km' : ''} ${b.kennzeichen ? '· '+b.kennzeichen : ''}</div>` : ''}
          ${b.subtyp === 'parken' && b.parkOrt ? `<div class="beleg-detail">🅿 ${esc(b.parkOrt)} ${b.parkDauer ? '· '+b.parkDauer : ''} ${b.kennzeichen ? '· '+b.kennzeichen : ''}</div>` : ''}
        </div>
        <div class="beleg-betrag">−${fmt(b.betrag)} €</div>
        <button class="beleg-del" onclick="editBeleg(${b.id})" title="Bearbeiten" style="display:flex;align-items:center;color:var(--muted);">${editIcon}</button>
        <button class="beleg-del" onclick="delBeleg(${b.id})" title="Löschen" style="display:flex;align-items:center;">${delIcon}</button>
      </div>`;
    }).join('');
  }

  const gesamt = belege.reduce((s,b) => s+b.betrag, 0);
  const steuer = belege.filter(b=>b.steuer).reduce((s,b) => s+b.betrag, 0);
  document.getElementById('summeGesamt').textContent = fmt(gesamt) + ' €';
  document.getElementById('summeSteuer').textContent = fmt(steuer) + ' €';
  document.getElementById('topMeta').textContent = `${belege.length} Belege · ${fmt(gesamt)} €`;
}

function delBeleg(id) {
  if (!confirm('Beleg wirklich löschen?')) return;
  belege = belege.filter(b => b.id !== id);
  save(); render();
}

/* ═══ Export ═══ */
function exportNumbers() {
  if (!belege.length) { alert('Keine Belege vorhanden.'); return; }
  if (!window.XLSX) { alert('SheetJS wird geladen – bitte kurz warten und erneut klicken.'); return; }

  const wb = XLSX.utils.book_new();

  // ── Haupttabelle ──
  const headers = ['Datum', 'Betrag (€)', 'Kategorie', 'Beschreibung', 'Steuerrelevant', 'Foto vorhanden'];
  const rows = belege.map(b => [
    fmtDate(b.datum),
    parseFloat(b.betrag),
    b.kat,
    b.notiz || '',
    b.steuer ? 'Ja' : 'Nein',
    b.file ? 'Ja' : 'Nein',
  ]);
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Spaltenbreiten
  ws['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 36 }, { wch: 16 }, { wch: 16 }
  ];

  // Zahlenformat für Betrag (Spalte B)
  for (let i = 1; i <= belege.length; i++) {
    const cell = ws[`B${i+1}`];
    if (cell) { cell.t = 'n'; cell.z = '#,##0.00 "€"'; }
  }

  // Header-Zeile fett
  headers.forEach((_, i) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c: i });
    if (ws[addr]) ws[addr].s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '2B3829' } } };
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Belege');

  // ── Zusammenfassung nach Kategorie ──
  const byKat = {};
  belege.forEach(b => { if (!byKat[b.kat]) byKat[b.kat] = { anzahl: 0, summe: 0, steuer: 0 }; byKat[b.kat].anzahl++; byKat[b.kat].summe += b.betrag; if (b.steuer) byKat[b.kat].steuer += b.betrag; });
  const sumHeaders = ['Kategorie', 'Anzahl', 'Gesamt (€)', 'Davon steuerrelevant (€)'];
  const sumRows = Object.entries(byKat).sort((a,b)=>b[1].summe-a[1].summe).map(([kat,v]) => [kat, v.anzahl, parseFloat(v.summe.toFixed(2)), parseFloat(v.steuer.toFixed(2))]);
  const totalSumme = belege.reduce((s,b)=>s+b.betrag,0);
  const totalSteuer = belege.filter(b=>b.steuer).reduce((s,b)=>s+b.betrag,0);
  sumRows.push(['Gesamt', belege.length, parseFloat(totalSumme.toFixed(2)), parseFloat(totalSteuer.toFixed(2))]);

  const wsSum = XLSX.utils.aoa_to_sheet([sumHeaders, ...sumRows]);
  wsSum['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, wsSum, 'Zusammenfassung');

  // ── Nur Steuerrelevante ──
  const steuBelege = belege.filter(b => b.steuer);
  if (steuBelege.length) {
    const stRows = steuBelege.map(b => [fmtDate(b.datum), parseFloat(b.betrag), b.kat, b.notiz||'']);
    const wsS = XLSX.utils.aoa_to_sheet([['Datum','Betrag (€)','Kategorie','Beschreibung'], ...stRows]);
    wsS['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 36 }];
    for (let i = 1; i <= steuBelege.length; i++) { const c = wsS[`B${i+1}`]; if (c) { c.t='n'; c.z='#,##0.00 "€"'; } }
    XLSX.utils.book_append_sheet(wb, wsS, 'Steuerrelevant');
  }

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `max4work_Belege_${date}.xlsx`);
}

function exportExcel() {
  if (!belege.length) { alert('Keine Belege vorhanden.'); return; }
  const rows = [
    ['Datum','Betrag (€)','Kategorie','Beschreibung','Steuerrelevant'],
    ...belege.map(b => [fmtDate(b.datum), fmt(b.betrag).replace(',','.'), b.kat, b.notiz||'', b.steuer?'Ja':'Nein'])
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
  const date = new Date().toISOString().slice(0,10);
  downloadFile(`max4work_belege_${date}.csv`, 'text/csv;charset=utf-8;', '﻿'+csv);
}

async function exportPDFAll() {
  if (!belege.length) { alert('Keine Belege vorhanden.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 20; let y = 20;
  let firma = '';
  try { const s = JSON.parse(localStorage.getItem('max4work_einstellungen')||'{}'); firma = s.sName||''; } catch(e) {}

  doc.setFont('helvetica','bold'); doc.setFontSize(16);
  doc.text('Belegliste', M, y); y += 6;
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(120);
  if (firma) { doc.text(firma, M, y); y += 5; }
  doc.text(`Erstellt am ${new Date().toLocaleDateString('de-DE')} · ${belege.length} Belege`, M, y); y += 10;
  doc.setTextColor(0);

  // Tabelle
  const cols = [28, 55, 28, 62, 22];
  const headers = ['Datum','Beschreibung','Kategorie','Betrag','Steuer'];
  doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
  doc.setFillColor(43,56,41); doc.setTextColor(255);
  doc.rect(M, y, 170, 7, 'F');
  let x = M + 2;
  headers.forEach((h,i) => { doc.text(h, x, y+5); x += cols[i]; });
  y += 7; doc.setFont('helvetica','normal'); doc.setTextColor(0);

  belege.forEach((b,i) => {
    if (y > 270) { doc.addPage(); y = 20; }
    if (i % 2 === 0) { doc.setFillColor(245,246,242); doc.rect(M, y, 170, 7, 'F'); }
    doc.setFontSize(8);
    let cx = M + 2;
    doc.text(fmtDate(b.datum), cx, y+5); cx += cols[0];
    doc.text(String(b.notiz||b.kat).slice(0,30), cx, y+5); cx += cols[1];
    doc.text(b.kat.slice(0,12), cx, y+5); cx += cols[2];
    doc.text(`${fmt(b.betrag)} €`, cx, y+5); cx += cols[3];
    doc.text(b.steuer?'⭐':'', cx, y+5);
    y += 7;
  });

  // Summe
  y += 4;
  const gesamt = belege.reduce((s,b)=>s+b.betrag,0);
  const steuer = belege.filter(b=>b.steuer).reduce((s,b)=>s+b.betrag,0);
  doc.setFont('helvetica','bold'); doc.setFontSize(9);
  doc.text(`Gesamt: ${fmt(gesamt)} €`, M, y);
  doc.text(`Steuerrelevant: ${fmt(steuer)} €`, M+80, y);

  doc.save(`Belege_${new Date().toISOString().slice(0,10)}.pdf`);
}

async function exportSteuerberater() {
  const steuBelege = belege.filter(b => b.steuer);
  if (!steuBelege.length) { alert('Keine steuerrelevanten Belege vorhanden.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 20; let y = 22;
  let firma = '', name = '', steuernr = '';
  try {
    const s = JSON.parse(localStorage.getItem('max4work_einstellungen')||'{}');
    firma = s.sName||''; name = s.sContact||''; steuernr = s.sStNr||'';
  } catch(e) {}

  // Header
  doc.setFont('helvetica','bold'); doc.setFontSize(18);
  doc.text('Ausgabenübersicht', M, y); y += 7;
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(100);
  doc.text(`Steuerrelevante Belege · ${new Date().getFullYear()}`, M, y); y += 5;
  if (firma) { doc.setFont('helvetica','bold'); doc.setTextColor(0); doc.text(firma, M, y); y += 4.5; }
  if (steuernr) { doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(100); doc.text(`Steuer-Nr.: ${steuernr}`, M, y); y += 4.5; }
  doc.setTextColor(0); y += 4;

  // Summierung nach Kategorie
  const byKat = {};
  steuBelege.forEach(b => { if (!byKat[b.kat]) byKat[b.kat] = 0; byKat[b.kat] += b.betrag; });
  doc.setFont('helvetica','bold'); doc.setFontSize(10);
  doc.text('Zusammenfassung nach Kategorie', M, y); y += 5;
  doc.setFont('helvetica','normal'); doc.setFontSize(9);
  Object.entries(byKat).sort((a,b)=>b[1]-a[1]).forEach(([kat,sum]) => {
    doc.text(kat, M+2, y);
    doc.text(`${fmt(sum)} €`, 190, y, {align:'right'});
    y += 5;
  });
  const total = steuBelege.reduce((s,b)=>s+b.betrag,0);
  doc.setDrawColor(43,56,41); doc.line(M, y, 190, y); y += 4;
  doc.setFont('helvetica','bold');
  doc.text('Gesamt steuerrelevante Ausgaben', M+2, y);
  doc.text(`${fmt(total)} €`, 190, y, {align:'right'}); y += 10;

  // Einzelliste
  doc.setFont('helvetica','bold'); doc.setFontSize(10);
  doc.text('Einzelnachweis', M, y); y += 5;
  doc.setFillColor(43,56,41); doc.setTextColor(255);
  doc.rect(M, y, 170, 7, 'F');
  doc.setFontSize(8.5);
  doc.text('Datum', M+2, y+5);
  doc.text('Beschreibung', M+30, y+5);
  doc.text('Kategorie', M+105, y+5);
  doc.text('Betrag', 190, y+5, {align:'right'});
  y += 7; doc.setTextColor(0); doc.setFont('helvetica','normal');

  steuBelege.forEach((b,i) => {
    if (y > 270) { doc.addPage(); y = 20; }
    if (i%2===0) { doc.setFillColor(248,249,246); doc.rect(M,y,170,7,'F'); }
    doc.setFontSize(8);
    doc.text(fmtDate(b.datum), M+2, y+5);
    doc.text(String(b.notiz||b.kat).slice(0,38), M+30, y+5);
    doc.text(b.kat, M+105, y+5);
    doc.text(`${fmt(b.betrag)} €`, 190, y+5, {align:'right'});
    y += 7;
  });

  y += 6;
  doc.setFont('helvetica','italic'); doc.setFontSize(7.5); doc.setTextColor(130);
  doc.text(`Erstellt mit max4work am ${new Date().toLocaleDateString('de-DE')} · Alle Angaben ohne Gewähr`, M, y);

  doc.save(`Steuerberater_Ausgaben_${new Date().getFullYear()}.pdf`);
}

/* ═══ DATEV-Buchungsstapel Export ═══ */
function exportDatevBelege() {
  const steuBelege = belege.filter(b => b.steuer);
  if (!steuBelege.length) { alert('Keine steuerrelevanten Belege vorhanden.'); return; }
  const now = new Date();
  const year = now.getFullYear();
  const ts = _dvBelegTs(now);
  const dates = steuBelege.map(b => b.datum).filter(Boolean).sort();
  const von = (dates[0] || year + '-01-01').replace(/-/g, '');
  const bis = (dates[dates.length - 1] || year + '-12-31').replace(/-/g, '');

  const vorlauf = [
    '"EXTF"', 700, 21, '"Buchungsstapel"', 13,
    ts, '', '"RE"', '"max4work"', '', '',
    '', '', year + '0101', 4, '', von, '', bis, '',
    '"Ausgaben ' + year + '"', '', 1, '', 0, '"EUR"'
  ].join(';');

  const colHead = 'Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;Kurs;Basis-Umsatz;WKZ Basis-Umsatz;Konto;Gegenkonto (ohne BU-Schlüssel);BU-Schlüssel;Belegdatum;Belegfeld 1;Belegfeld 2;Skonto;Buchungstext';

  // SKR03: Aufwandskonten nach Kategorie
  const KTO = { 'Material': '3980', 'Werkzeug': '4900', 'Fahrzeug': '4530', 'Büro': '4930', 'Sonstiges': '4980' };

  let lfdNr = 1;
  const rows = steuBelege.map(b => {
    const betrag = parseFloat(b.betrag || 0).toFixed(2).replace('.', ',');
    const dat = _dvBelegDate(b.datum);
    let kto = KTO[b.kat] || '4980';
    if (b.kat === 'Fahrzeug' && b.subtyp === 'parken') kto = '4540';
    const belegNr = String(lfdNr++).padStart(4, '0');
    const text = (b.notiz || b.kat).substring(0, 30).replace(/[";]/g, ' ');
    // Aufwand im Soll (S), Gegenkonto Bank/Verbindlichkeiten 1200
    return `${betrag};S;EUR;;;;${kto};1200;;${dat};"${belegNr}";;;"${text}"`;
  }).join('\r\n');

  const csv = vorlauf + '\r\n' + colHead + '\r\n' + rows;
  downloadFile(`DATEV_Ausgaben_${year}.csv`, 'text/csv;charset=utf-8;', '﻿' + csv);
}

function _dvBelegDate(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return d + m; // TTMM
}

function _dvBelegTs(d) {
  return d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') +
    String(d.getHours()).padStart(2, '0') +
    String(d.getMinutes()).padStart(2, '0') +
    String(d.getSeconds()).padStart(2, '0') + '000';
}

/* ═══ Hilfsfunktionen ═══ */
function openLightbox(src) {
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightbox').style.display = 'flex';
}
function fmt(n) { return parseFloat(n).toFixed(2).replace('.', ','); }
function fmtDate(v) { if (!v) return '—'; const [y,m,d] = v.split('-'); return `${d}.${m}.${y}`; }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(belege)); } catch(e) { alert('Speicher voll – ältere Belege löschen.'); } }
function downloadFile(name, mime, content) {
  const blob = new Blob([content], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=name; a.click();
  URL.revokeObjectURL(url);
}

/* ═══ Init ═══ */
function load() {
  try { const r = localStorage.getItem(SAVE_KEY); if (r) belege = JSON.parse(r); } catch(e) {}
  document.getElementById('bDatum').value = new Date().toISOString().split('T')[0];
  fillKennzeichenList();
  render();
}
load();
