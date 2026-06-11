  /* ── Tool-Navigation ── */
  const TOOL_TITLES = { angebot:'Werkzeuge – Angebot', m2:'Werkzeuge – m² & Photo', mwst:'Werkzeuge – MwSt Rechner' };
  function showTool(id) {
    document.querySelectorAll('.tool-section').forEach(s => s.style.display = 'none');
    document.getElementById('tool-' + id).style.display = 'flex';
    document.querySelectorAll('.ttab').forEach(t => t.classList.toggle('on', t.dataset.tool === id));
    document.getElementById('toolTitle').textContent = TOOL_TITLES[id] || 'Werkzeuge';
    try { localStorage.setItem('max4work_werkzeuge_tool', id); } catch(e) {}
    if (typeof refreshSubNav === 'function') refreshSubNav();
    if (id === 'm2') renderRaeume();
  }

  /* ════════════════════════════════════════
     ANGEBOT
  ════════════════════════════════════════ */
  let angPos = [{ beschr:'', menge:1, einheit:'Std.', preis:0 }];
  const EINHEITEN = ['Std.','Pauschal','m²','m²/Monat','m','Stk.','kg','l','Tag','Woche','Monat'];

  function fmt(n) { return Number(n).toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2}); }
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function parseM(v) { return parseFloat(String(v).replace(',', '.')) || 0; }

  function renderAngPos() {
    document.getElementById('angPosTbody').innerHTML = angPos.map((p, i) => `
      <tr>
        <td class="col-nr">${i+1}</td>
        <td><input type="text" value="${esc(p.beschr)}" placeholder="Beschreibung …" oninput="angPos[${i}].beschr=this.value;calcAngTotal()"></td>
        <td class="col-menge"><input type="number" min="0" step="0.01" value="${p.menge}" oninput="angPos[${i}].menge=parseFloat(this.value)||0;calcAngTotal()"></td>
        <td class="col-einheit"><select oninput="angPos[${i}].einheit=this.value">${EINHEITEN.map(e=>`<option${e===p.einheit?' selected':''}>${e}</option>`).join('')}</select></td>
        <td class="col-preis"><input type="number" min="0" step="0.01" value="${p.preis}" oninput="angPos[${i}].preis=parseFloat(this.value)||0;calcAngTotal()" style="text-align:right"></td>
        <td class="col-gesamt r">${fmt(p.menge * p.preis)}</td>
        <td class="col-del"><button class="pos-del-btn" onclick="removeAPos(${i})" title="Entfernen">×</button></td>
      </tr>`).join('');
    calcAngTotal();
  }

  function addAPos() { angPos.push({ beschr:'', menge:1, einheit:'Std.', preis:0 }); renderAngPos(); }
  function removeAPos(i) { if (angPos.length <= 1) return; angPos.splice(i, 1); renderAngPos(); }

  function calcAngTotal() {
    const netto = angPos.reduce((s, p) => s + p.menge * p.preis, 0);
    document.getElementById('angTotals').innerHTML = `
      <div class="ang-tr"><span class="ang-tl">Netto gesamt</span><span class="ang-tv">${fmt(netto)} €</span></div>
      <div class="ang-tr"><span class="ang-tl" style="font-size:11px;color:var(--muted)">Kleinunternehmer gem. §19 UStG – kein MwSt-Ausweis</span><span class="ang-tv" style="font-size:12px;color:var(--muted)">–</span></div>
      <div class="ang-tr grand"><span class="ang-tl">Gesamtbetrag</span><span class="ang-tv">${fmt(netto)} €</span></div>`;
  }

  function fillAngAdresse(name) {
    try {
      const kunden = JSON.parse(localStorage.getItem('max4work_kunden') || '[]');
      const k = kunden.find(x => x.name === name);
      if (k) document.getElementById('a-adresse').value = [k.strasse, k.ort].filter(Boolean).join('\n');
    } catch(e) {}
  }

  function loadAngKunden() {
    try {
      const kunden = JSON.parse(localStorage.getItem('max4work_kunden') || '[]');
      document.getElementById('angKundenList').innerHTML = kunden.map(k => `<option value="${esc(k.name)}">`).join('');
    } catch(e) {}
  }

  function printAngebot() {
    // Positionen-Gesamt in col-gesamt aktualisieren
    document.querySelectorAll('#angPosTbody tr').forEach((tr, i) => {
      const p = angPos[i];
      if (p) tr.querySelector('.col-gesamt').textContent = fmt(p.menge * p.preis) + ' €';
    });
    window.print();
  }

  function resetAngebot() {
    if (!confirm('Angebot zurücksetzen?')) return;
    angPos = [{ beschr:'', menge:1, einheit:'Std.', preis:0 }];
    ['a-nr','a-empf','a-betreff','a-adresse'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('a-datum').value = '';
    document.getElementById('a-gueltig').value = '';
    document.getElementById('a-hinweis').value = 'Dieses Angebot ist freibleibend und gilt bis zum angegebenen Datum. Zahlung innerhalb von 14 Tagen nach Auftragserteilung.';
    renderAngPos();
  }

  function initAngebot() {
    document.getElementById('a-datum').value = '';
    document.getElementById('a-gueltig').value = '';
    // Angebotsnummer auto
    const nr = (parseInt(localStorage.getItem('max4work_ang_counter') || '0') + 1);
    document.getElementById('a-nr').value = 'A-' + new Date().getFullYear() + '-' + String(nr).padStart(3,'0');
    renderAngPos();
    loadAngKunden();
  }

  /* ════════════════════════════════════════
     m² RECHNER
  ════════════════════════════════════════ */
  let raeume = [];
  let m2Mode = 'boden';

  const M2_HINTS = {
    boden:   'Länge × Breite – Bodenfläche',
    wand:    'Höhe erforderlich – Wandfläche inkl. Abzug Türen/Fenster',
    decke:   'Länge × Breite – Deckenfläche (= Bodenfläche)',
    fenster: 'Höhe × Breite pro Fenster – wird summiert',
    alle:    'Höhe optional – wird für Wandfläche benötigt'
  };

  function setM2Mode(val) {
    m2Mode = val;
    const hint = document.getElementById('m2SaveHint');
    if (hint) hint.textContent = M2_HINTS[val];
    renderRaeume();
  }

  function addRaum() {
    raeume.push({ name:'Raum ' + (raeume.length + 1), l:'', b:'', h:'', abzug:0, fensterH:'', fensterB:'' });
    renderRaeume();
  }

  function removeRaum(i) { raeume.splice(i, 1); renderRaeume(); }

  function calcRaum(r) {
    const l = parseM(r.l), b = parseM(r.b), h = parseM(r.h), ab = parseM(r.abzug);
    const boden   = l * b;
    const wand    = h > 0 ? Math.max(0, 2*(l+b)*h - ab) : 0;
    const decke   = boden;
    const fenster = parseM(r.fensterH) * parseM(r.fensterB);
    return { boden, wand, decke, fenster };
  }

  function renderRaeume() {
    const body = document.getElementById('raeumeBody');
    if (!raeume.length) {
      body.innerHTML = '<div style="font-size:13px;color:var(--muted);text-align:center;padding:16px 0">Noch keine Räume. Füge einen Raum hinzu.</div>';
      updateM2Total();
      return;
    }
    const mitHoehe   = m2Mode === 'wand' || m2Mode === 'alle';
    const nurFenster = m2Mode === 'fenster';
    const cols = mitHoehe ? '1fr 1fr 1fr 1.2fr' : '1fr 1fr';
    body.innerHTML = raeume.map((r, i) => {
      const c = calcRaum(r);
      const bVal = m2Mode === 'boden'   || m2Mode === 'alle';
      const wVal = m2Mode === 'wand'    || m2Mode === 'alle';
      const dVal = m2Mode === 'decke'   || m2Mode === 'alle';
      const fVal = m2Mode === 'fenster';
      return `<div class="raum-card" id="raum-${i}" style="margin-bottom:10px">
        <div class="raum-title-row">
          <input class="raum-name-in" value="${esc(r.name)}" oninput="raeume[${i}].name=this.value">
        </div>
        <div class="raum-dims" style="grid-template-columns:${cols}">
          ${!nurFenster?`
          <div class="rdim"><label>Länge (m)</label><input type="text" inputmode="decimal" value="${r.l}" placeholder="0,00" oninput="raeume[${i}].l=this.value;updateRaumBadge(${i})"></div>
          <div class="rdim"><label>Breite (m)</label><input type="text" inputmode="decimal" value="${r.b}" placeholder="0,00" oninput="raeume[${i}].b=this.value;updateRaumBadge(${i})"></div>`:''}
          ${mitHoehe?`
          <div class="rdim"><label>Höhe (m)${m2Mode==='wand'?' *':' opt.'}</label><input type="text" inputmode="decimal" value="${r.h}" placeholder="–" oninput="raeume[${i}].h=this.value;updateRaumBadge(${i})"></div>
          <div class="rdim"><label>Abzug Wand (m²)</label><input type="text" inputmode="decimal" value="${r.abzug}" placeholder="0,00" oninput="raeume[${i}].abzug=this.value;updateRaumBadge(${i})"></div>`:''}
          ${nurFenster?`
          <div class="rdim"><label>Höhe Fenster (m)</label><input type="text" inputmode="decimal" value="${r.fensterH}" placeholder="0,00" oninput="raeume[${i}].fensterH=this.value;updateRaumBadge(${i})"></div>
          <div class="rdim"><label>Breite Fenster (m)</label><input type="text" inputmode="decimal" value="${r.fensterB}" placeholder="0,00" oninput="raeume[${i}].fensterB=this.value;updateRaumBadge(${i})"></div>`:''}
        </div>
        <div class="raum-badges" id="raum-badges-${i}">
          ${bVal?`<span class="rbadge${c.boden>0?' val':''}">Boden: ${fmt(c.boden)} m²</span>`:''}
          ${wVal?`<span class="rbadge${c.wand>0?' val':''}">Wände: ${fmt(c.wand)} m²</span>`:''}
          ${dVal?`<span class="rbadge${c.decke>0?' val':''}">Decke: ${fmt(c.decke)} m²</span>`:''}
          ${fVal?`<span class="rbadge${c.fenster>0?' val':''}">Fenster: ${fmt(c.fenster)} m²</span>`:''}
        </div>
        <button class="raum-del" onclick="removeRaum(${i})" title="Raum entfernen">×</button>
      </div>`;
    }).join('');
    updateM2Total();
  }

  function updateRaumBadge(i) {
    const el = document.getElementById('raum-badges-' + i);
    if (!el) return;
    const c = calcRaum(raeume[i]);
    const bVal = m2Mode === 'boden'   || m2Mode === 'alle';
    const wVal = m2Mode === 'wand'    || m2Mode === 'alle';
    const dVal = m2Mode === 'decke'   || m2Mode === 'alle';
    const fVal = m2Mode === 'fenster';
    el.innerHTML =
      (bVal ? `<span class="rbadge${c.boden>0?' val':''}">Boden: ${fmt(c.boden)} m²</span>` : '') +
      (wVal ? `<span class="rbadge${c.wand>0?' val':''}">Wände: ${fmt(c.wand)} m²</span>` : '') +
      (dVal ? `<span class="rbadge${c.decke>0?' val':''}">Decke: ${fmt(c.decke)} m²</span>` : '') +
      (fVal ? `<span class="rbadge${c.fenster>0?' val':''}">Fenster: ${fmt(c.fenster)} m²</span>` : '');
    updateM2Total();
  }

  function updateM2Total() {
    let totalBoden = 0, totalWand = 0, totalDecke = 0, totalFenster = 0;
    raeume.forEach(r => { const c = calcRaum(r); totalBoden += c.boden; totalWand += c.wand; totalDecke += c.decke; totalFenster += c.fenster; });
    const el = document.getElementById('m2Total');
    const totals = { boden: totalBoden, wand: totalWand, decke: totalDecke, fenster: totalFenster };
    const labels = { boden: 'Bodenfläche gesamt', wand: 'Wandfläche gesamt', decke: 'Deckenfläche gesamt', fenster: 'Fensterfläche gesamt' };
    if (m2Mode === 'alle') {
      el.style.gridTemplateColumns = 'repeat(3, 1fr)';
      el.innerHTML = ['boden','wand','decke'].map(k =>
        `<div class="m2ti"><label>${labels[k]}</label><div class="v">${fmt(totals[k])} <em>m²</em></div></div>`
      ).join('');
    } else {
      el.style.gridTemplateColumns = '1fr';
      el.innerHTML = `<div class="m2ti" style="text-align:center"><label>${labels[m2Mode]}</label><div class="v" style="font-size:38px;letter-spacing:-1.5px">${fmt(totals[m2Mode])} <em>m²</em></div></div>`;
    }
  }

  function copyM2Result() {
    let totalBoden = 0, totalWand = 0, totalDecke = 0, totalFenster = 0;
    raeume.forEach(r => { const c = calcRaum(r); totalBoden += c.boden; totalWand += c.wand; totalDecke += c.decke; totalFenster += c.fenster; });
    const totals  = { boden: totalBoden, wand: totalWand, decke: totalDecke, fenster: totalFenster };
    const labels  = { boden: 'Bodenfläche', wand: 'Wandfläche', decke: 'Deckenfläche', fenster: 'Fensterfläche' };
    const raumKey = { boden: 'boden', wand: 'wand', decke: 'decke', fenster: 'fenster' };
    let text;
    if (m2Mode === 'alle') {
      text = `Flächenberechnung max4work\n\nRäume:\n` +
        raeume.map(r => { const c = calcRaum(r); return `${r.name}: Boden ${fmt(c.boden)} m²${(parseFloat(r.h)||0)>0?', Wand '+fmt(c.wand)+' m²':''}`;}).join('\n') +
        `\n\nGesamt Boden: ${fmt(totalBoden)} m²\nGesamt Wand:  ${fmt(totalWand)} m²\nGesamt Decke: ${fmt(totalDecke)} m²`;
    } else {
      const key = raumKey[m2Mode];
      text = `Flächenberechnung max4work (${labels[m2Mode]})\n\nRäume:\n` +
        raeume.map(r => `${r.name}: ${fmt(calcRaum(r)[key])} m²`).join('\n') +
        `\n\nGesamt ${labels[m2Mode]}: ${fmt(totals[m2Mode])} m²`;
    }
    navigator.clipboard.writeText(text).catch(() => {});
  }

  function showM2Ergebnis() {
    const panel  = document.getElementById('m2ErgebnisPanel');
    const body   = document.getElementById('m2ErgebnisBody');
    const LABELS = { boden:'Bodenfläche', wand:'Wandfläche', decke:'Deckenfläche', fenster:'Fensterfläche', alle:'Alle Flächen' };
    const datum  = new Date().toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });

    let tBoden=0, tWand=0, tDecke=0, tFenster=0;
    raeume.forEach(r => { const c=calcRaum(r); tBoden+=c.boden; tWand+=c.wand; tDecke+=c.decke; tFenster+=c.fenster; });
    const totals = { boden:tBoden, wand:tWand, decke:tDecke, fenster:tFenster };

    const raumRows = raeume.length ? raeume.map(r => {
      const c = calcRaum(r);
      const vals = [];
      if (m2Mode==='boden'  ||m2Mode==='alle') vals.push(`Boden: ${fmt(c.boden)} m²`);
      if (m2Mode==='wand'   ||m2Mode==='alle') vals.push(`Wand: ${fmt(c.wand)} m²`);
      if (m2Mode==='decke'  ||m2Mode==='alle') vals.push(`Decke: ${fmt(c.decke)} m²`);
      if (m2Mode==='fenster')                  vals.push(`Fenster: ${fmt(c.fenster)} m²`);
      const masse = [r.l, r.b].filter(Boolean).join(' × ');
      return `<tr>
        <td style="padding:8px 0;font-weight:500;border-top:1px solid var(--border)">${esc(r.name)}</td>
        <td style="padding:8px 0;text-align:right;color:var(--muted);font-size:12px;border-top:1px solid var(--border)">${masse ? masse+' m' : '–'}</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid var(--border)">${vals.join(' · ')}</td>
      </tr>`;
    }).join('') : `<tr><td colspan="3" style="padding:12px 0;color:var(--muted);text-align:center">Keine Räume erfasst</td></tr>`;

    const totalStr = m2Mode==='alle'
      ? `Boden ${fmt(tBoden)} · Wand ${fmt(tWand)} · Decke ${fmt(tDecke)} m²`
      : `${fmt(totals[m2Mode])} m²`;

    const photoHTML = photos.length ? `
      <div style="margin-top:20px">
        <div style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Fotos (${photos.length})</div>
        <div class="photo-grid">${photos.map((p,i)=>`<div class="photo-item"><img src="${p.url}" alt="Foto ${i+1}" title="${p.ts}"></div>`).join('')}</div>
      </div>` : '';

    body.innerHTML = `
      <div style="font-size:12px;color:var(--muted);margin-bottom:14px">${datum} · ${LABELS[m2Mode]}</div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;padding-bottom:8px">Raum</th>
          <th style="text-align:right;font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;padding-bottom:8px">Maße</th>
          <th style="text-align:right;font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;padding-bottom:8px">Fläche</th>
        </tr></thead>
        <tbody>${raumRows}</tbody>
        <tfoot><tr>
          <td colspan="2" style="padding:10px 0;font-weight:700;border-top:2px solid var(--border)">Gesamt</td>
          <td style="text-align:right;font-weight:700;font-size:16px;border-top:2px solid var(--border)">${totalStr}</td>
        </tr></tfoot>
      </table>
      ${photoHTML}`;

    panel.style.display = 'block';
    panel.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  function printM2Ergebnis() {
    const LABELS = { boden:'Bodenfläche', wand:'Wandfläche', decke:'Deckenfläche', fenster:'Fensterfläche', alle:'Alle Flächen' };
    const datum  = new Date().toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
    let firma = '';
    try { firma = (JSON.parse(localStorage.getItem('max4work_einstellungen')||'{}')).firma || ''; } catch(e) {}

    let tBoden=0, tWand=0, tDecke=0, tFenster=0;
    raeume.forEach(r => { const c=calcRaum(r); tBoden+=c.boden; tWand+=c.wand; tDecke+=c.decke; tFenster+=c.fenster; });
    const totals = { boden:tBoden, wand:tWand, decke:tDecke, fenster:tFenster };

    const raumRows = raeume.map(r => {
      const c = calcRaum(r);
      const vals = [];
      if (m2Mode==='boden'  ||m2Mode==='alle') vals.push(`Boden: ${fmt(c.boden)} m²`);
      if (m2Mode==='wand'   ||m2Mode==='alle') vals.push(`Wand: ${fmt(c.wand)} m²`);
      if (m2Mode==='decke'  ||m2Mode==='alle') vals.push(`Decke: ${fmt(c.decke)} m²`);
      if (m2Mode==='fenster')                  vals.push(`Fenster: ${fmt(c.fenster)} m²`);
      const masse = [r.l, r.b].filter(Boolean).join(' × ');
      return `<tr><td>${esc(r.name)}</td><td style="color:#888;font-size:12px">${masse ? masse+' m' : '–'}</td><td>${vals.join(' · ')}</td></tr>`;
    }).join('');

    const totalStr = m2Mode==='alle'
      ? `Boden ${fmt(tBoden)} · Wand ${fmt(tWand)} · Decke ${fmt(tDecke)} m²`
      : `${fmt(totals[m2Mode])} m²`;

    const photoHTML = photos.map((p,i) =>
      `<img src="${p.url}" alt="Foto ${i+1}" style="width:calc(33.33% - 6px);border-radius:8px;object-fit:cover;aspect-ratio:4/3;display:inline-block">`
    ).join('');

    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
    <title>Flächenberechnung ${datum}</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a; padding: 32px; max-width: 720px; margin: 0 auto; font-size: 14px; }
      h1 { font-size: 22px; margin: 0 0 4px; font-weight: 700; }
      .sub { font-size: 13px; color: #888; margin-bottom: 28px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
      th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #888; padding-bottom: 8px; font-weight: 600; }
      th:last-child { text-align: right; }
      td { padding: 9px 0; border-top: 1px solid #eee; vertical-align: top; }
      td:last-child { text-align: right; font-weight: 600; }
      .total-row td { border-top: 2px solid #333; font-weight: 700; font-size: 17px; padding-top: 12px; }
      .photo-label { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #888; font-weight: 600; margin-bottom: 10px; }
      .photos { display: flex; flex-wrap: wrap; gap: 8px; }
    </style></head><body>
    <h1>Flächenberechnung</h1>
    <div class="sub">${datum}${firma?' · '+firma:''} · ${LABELS[m2Mode]}</div>
    <table>
      <thead><tr><th>Raum</th><th>Maße</th><th style="text-align:right">Fläche</th></tr></thead>
      <tbody>${raumRows}</tbody>
      <tfoot><tr class="total-row"><td colspan="2">Gesamt</td><td>${totalStr}</td></tr></tfoot>
    </table>
    ${photos.length ? `<div class="photo-label">Fotos (${photos.length})</div><div class="photos">${photoHTML}</div>` : ''}
    </body></html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Popup blockiert – bitte Popups für diese Seite erlauben.'); return; }
    win.document.write(html);
    win.document.close();
    win.addEventListener('load', () => { win.focus(); win.print(); });
  }

  /* ════════════════════════════════════════
     KAMERA
  ════════════════════════════════════════ */
  let camStream = null;
  let photos = [];

  async function startCam() {
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } });
      const vid = document.getElementById('camVideo');
      vid.srcObject = camStream;
      vid.style.display = 'block';
      document.getElementById('camHint').style.display = 'none';
      document.getElementById('camShutter').disabled = false;
      document.getElementById('camStartBtn').style.display = 'none';
      document.getElementById('camStopBtn').style.display = 'inline-flex';
    } catch(e) {
      alert('Kamera konnte nicht gestartet werden. Bitte Berechtigung erteilen.\n\n' + e.message);
    }
  }

  function stopCam() {
    if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
    const vid = document.getElementById('camVideo');
    vid.style.display = 'none'; vid.srcObject = null;
    document.getElementById('camHint').style.display = 'block';
    document.getElementById('camShutter').disabled = true;
    document.getElementById('camStartBtn').style.display = 'inline-flex';
    document.getElementById('camStopBtn').style.display = 'none';
  }

  function capturePhoto() {
    const vid = document.getElementById('camVideo');
    const canvas = document.getElementById('camCanvas');
    canvas.width = vid.videoWidth;
    canvas.height = vid.videoHeight;
    canvas.getContext('2d').drawImage(vid, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    photos.unshift({ url: dataUrl, ts: new Date().toLocaleString('de-DE') });
    if (photos.length > 30) photos.pop();
    renderPhotos();
  }

  function renderPhotos() {
    const grid = document.getElementById('photoGrid');
    document.getElementById('photoCount').textContent = photos.length ? `(${photos.length})` : '';
    if (!photos.length) { grid.innerHTML = '<div class="cam-empty">Noch keine Fotos aufgenommen.</div>'; return; }
    grid.innerHTML = photos.map((p, i) => `
      <div class="photo-item">
        <img src="${p.url}" alt="Foto ${i+1}" title="${p.ts}">
        <div class="photo-item-bar">
          <button class="phi-btn" onclick="downloadPhoto(${i})" title="Herunterladen">⬇</button>
          <button class="phi-btn" onclick="deletePhoto(${i})" title="Löschen">✕</button>
        </div>
      </div>`).join('');
  }

  function downloadPhoto(i) {
    const a = document.createElement('a');
    a.href = photos[i].url;
    a.download = 'foto_' + new Date().toISOString().slice(0,19).replace(/[:T]/g,'-') + '.jpg';
    a.click();
  }

  function deletePhoto(i) { photos.splice(i, 1); renderPhotos(); }

  /* ════════════════════════════════════════
     MwSt RECHNER
  ════════════════════════════════════════ */
  let mwstType = 'netto', mwstRate = 19;

  function setMwstType(t) {
    mwstType = t;
    document.getElementById('typeNetto').classList.toggle('on', t==='netto');
    document.getElementById('typeBrutto').classList.toggle('on', t==='brutto');
    calcMwst();
  }

  function setMwstRate(r) {
    mwstRate = r;
    [19,7,0].forEach(x => document.getElementById('rate'+x).classList.toggle('on', x===r));
    document.getElementById('mwstRateLbl').textContent = `MwSt (${r} %)`;
    calcMwst();
  }

  function calcMwst() {
    const raw = parseFloat(document.getElementById('mwstAmt').value) || 0;
    let netto, betrag, brutto;
    if (mwstType === 'netto') {
      netto = raw; betrag = netto * mwstRate / 100; brutto = netto + betrag;
    } else {
      brutto = raw; netto = brutto / (1 + mwstRate / 100); betrag = brutto - netto;
    }
    document.getElementById('mwstNetto').textContent  = fmt(netto) + ' €';
    document.getElementById('mwstBetrag').textContent = fmt(betrag) + ' €';
    document.getElementById('mwstBrutto').textContent = fmt(brutto) + ' €';
    window._mwstVals = { netto, betrag, brutto };
  }

  function copyMwst(key) {
    const v = (window._mwstVals || {})[key];
    if (v !== undefined) navigator.clipboard.writeText(fmt(v)).catch(() => {});
  }

  /* ── Mini-Kalender ── */
  let _calTarget = null, _calY = 0, _calM = 0;

  function _calInit() {
    if (document.getElementById('_miniCal')) return;
    const el = document.createElement('div');
    el.id = '_miniCal'; el.className = 'mini-cal'; el.style.display = 'none';
    document.body.appendChild(el);
    document.addEventListener('mousedown', e => {
      if (_calTarget && !el.contains(e.target) && e.target !== _calTarget) _calClose();
    });
  }

  function _calOpen(inputEl) {
    _calInit();
    _calTarget = inputEl;
    const now = new Date(); _calY = now.getFullYear(); _calM = now.getMonth();
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(inputEl.value)) {
      const [, m, y] = inputEl.value.split('.'); _calY = +y; _calM = +m - 1;
    }
    _calRender();
    const r = inputEl.getBoundingClientRect(), el = document.getElementById('_miniCal');
    el.style.top  = (r.bottom + 4) + 'px';
    el.style.left = Math.max(4, Math.min(r.left, window.innerWidth - 222)) + 'px';
    el.style.display = 'block';
  }

  function _calClose() {
    const el = document.getElementById('_miniCal');
    if (el) el.style.display = 'none';
    _calTarget = null;
  }

  function _calNav(dir) {
    _calM += dir;
    if (_calM < 0) { _calM = 11; _calY--; } if (_calM > 11) { _calM = 0; _calY++; }
    _calRender();
  }

  function _calSelect(day) {
    if (!_calTarget) return;
    _calTarget.value = String(day).padStart(2,'0') + '.' + String(_calM+1).padStart(2,'0') + '.' + _calY;
    _calClose();
  }

  function _calRender() {
    const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    const el = document.getElementById('_miniCal');
    const today = new Date();
    const offset = (d => d === 0 ? 6 : d - 1)(new Date(_calY, _calM, 1).getDay());
    const dim = new Date(_calY, _calM + 1, 0).getDate();
    let g = '<div class="mini-cal-dow">Mo</div><div class="mini-cal-dow">Di</div><div class="mini-cal-dow">Mi</div><div class="mini-cal-dow">Do</div><div class="mini-cal-dow">Fr</div><div class="mini-cal-dow">Sa</div><div class="mini-cal-dow">So</div>';
    for (let i = 0; i < offset; i++) g += '<div></div>';
    for (let d = 1; d <= dim; d++) {
      const t = d === today.getDate() && _calM === today.getMonth() && _calY === today.getFullYear();
      g += `<div class="mini-cal-day${t?' cal-today':''}" onmousedown="event.preventDefault();_calSelect(${d})">${d}</div>`;
    }
    el.innerHTML = `<div class="mini-cal-head"><button class="mini-cal-nav" onmousedown="event.preventDefault();_calNav(-1)">&#8249;</button><span>${MONTHS[_calM]} ${_calY}</span><button class="mini-cal-nav" onmousedown="event.preventDefault();_calNav(1)">&#8250;</button></div><div class="mini-cal-grid">${g}</div>`;
  }

  /* ── Init ── */
  const _lastTool = localStorage.getItem('max4work_werkzeuge_tool') || 'angebot';
  showTool(_lastTool === 'kamera' ? 'm2' : (['angebot','m2','mwst'].includes(_lastTool) ? _lastTool : 'angebot'));
  initAngebot();
  calcMwst();
  ['a-datum','a-gueltig'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('focus', () => _calOpen(el));
  });
