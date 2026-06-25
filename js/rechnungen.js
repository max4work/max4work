  /* ═══ GiroCode (EPC QR / SEPA-Schnellüberweisung) ═══ */
  function buildGiroCode() {
    const iban = (g('sIBAN') || '').replace(/\s/g, '');
    const bic  = (g('sBIC')  || '').trim();
    const name = (g('sName') || '').substring(0, 70);
    if (!iban || !name) return null;
    const netto = calcBrutto();
    const ref = [
      `RE ${g('invNr') || ''}`,
      g('invKdNr') ? `KD ${g('invKdNr')}` : '',
      g('invDue')  ? `faellig ${fmtDate(g('invDue'))}` : ''
    ].filter(Boolean).join(' ').substring(0, 140);
    return ['BCD','002','1','SCT', bic, name, iban, `EUR${netto.toFixed(2)}`, '', '', ref].join('\n');
  }

  function generateQRCode() {
    const el = document.getElementById('invQrCode');
    if (!el || typeof QRCode === 'undefined') return;
    el.innerHTML = '';
    const data = buildGiroCode();
    if (!data) return;
    try {
      new QRCode(el, { text: data, width: 88, height: 88, colorDark: '#000', colorLight: '#fff', correctLevel: QRCode.CorrectLevel.M });
    } catch(e) {
      try {
        new QRCode(el, { text: data, width: 88, height: 88, colorDark: '#000', colorLight: '#fff', correctLevel: QRCode.CorrectLevel.L });
      } catch(e2) { el.innerHTML = ''; }
    }
  }

  function getQRDataURL() {
    return new Promise(resolve => {
      if (typeof QRCode === 'undefined') { resolve(null); return; }
      const data = buildGiroCode();
      if (!data) { resolve(null); return; }
      const tmp = document.createElement('div');
      tmp.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
      document.body.appendChild(tmp);
      try {
        new QRCode(tmp, { text: data, width: 120, height: 120, colorDark: '#000', colorLight: '#fff', correctLevel: QRCode.CorrectLevel.M });
      } catch(e) {
        try { new QRCode(tmp, { text: data, width: 120, height: 120, colorDark: '#000', colorLight: '#fff', correctLevel: QRCode.CorrectLevel.L }); }
        catch(e2) { resolve(null); document.body.removeChild(tmp); return; }
      }
      setTimeout(() => {
        const canvas = tmp.querySelector('canvas');
        resolve(canvas ? canvas.toDataURL('image/png') : null);
        document.body.removeChild(tmp);
      }, 80);
    });
  }

/* ═══ Vorlagen-Assistent ═══ */
  let assistMatch = null, assistTimer = null, assistDismissed = false;
  let currentListeTab = 'alle';

  function assistCheck() {
    clearTimeout(assistTimer);
    assistTimer = setTimeout(_assistRun, 400);
  }

  function _isFeatureOn(id) {
    try {
      const saved = JSON.parse(localStorage.getItem('max4work_features') || '{}');
      const defaults = { autoSuggestInvoice: true, livePreview: true, highlightOverdue: true };
      return saved[id] !== undefined ? saved[id] : defaults[id];
    } catch(e) { return true; }
  }

  function _assistRun() {
    if (assistDismissed) return;
    if (!_isFeatureOn('autoSuggestInvoice')) return;
    const name = (document.getElementById('cName').value || document.getElementById('cSalutation').value || '').trim().toLowerCase();
    if (name.length < 3) { assistHide(); return; }

    const list = getRechnungen ? getRechnungen() : (JSON.parse(localStorage.getItem('max4work_rechnungen') || '[]'));
    if (!list.length) return;

    // Beste Übereinstimmung suchen
    const match = list.slice().reverse().find(r => {
      const k = (r.kunde || '').toLowerCase();
      return k.includes(name) || name.includes(k.split(' ')[0]);
    });
    if (!match) { assistHide(); return; }

    // Letzten Draft mit dieser Rechnungsnr laden
    assistMatch = match;
    _assistShow(match);
  }

  function _assistShow(r) {
    const fmtD = v => { if (!v) return '—'; const [y,m,d] = v.split('-'); return `${d}.${m}.${y}`; };
    const fmtB = n => parseFloat(n||0).toLocaleString('de-DE',{minimumFractionDigits:2})+' €';

    document.getElementById('assistTitle').textContent = `Bekannter Kunde: ${r.kunde}`;
    document.getElementById('assistDate').textContent = `Letzte Rechnung: ${fmtD(r.datum)}`;

    // Positionen aus Draft laden falls vorhanden
    let posHTML = '';
    try {
      const allDrafts = JSON.parse(localStorage.getItem('max4work_rechnungen_history') || '[]');
      const draft = allDrafts.find(d => d.nr === r.nr);
      if (draft?.positions?.length) {
        draft.positions.forEach(p => {
          const qty = isNaN(parseFloat(p.qty)) ? p.qty : parseFloat(p.qty);
          const total = isNaN(parseFloat(p.qty)) ? p.price : parseFloat(p.qty) * p.price;
          posHTML += `<div class="assist-row"><span>${p.desc||'—'} × ${qty}</span><span>${fmtB(total)}</span></div>`;
        });
      }
    } catch(e) {}

    if (!posHTML) posHTML = `<div class="assist-row"><span>Rechnungs-Nr.</span><span>${r.nr}</span></div>`;
    posHTML += `<div class="assist-row total"><span>Gesamt</span><span>${fmtB(r.betrag)}</span></div>`;

    document.getElementById('assistItems').innerHTML = posHTML;
    document.getElementById('assistBanner').style.display = 'block';
  }

  function assistHide() {
    document.getElementById('assistBanner').style.display = 'none';
    assistMatch = null;
  }

  function assistAbweisen() {
    assistDismissed = true;
    assistHide();
  }

  function assistUebernehmen() {
    if (!assistMatch) return;
    assistHide();
    assistDismissed = true;

    // Letzten vollständigen Draft laden
    try {
      const history = JSON.parse(localStorage.getItem('max4work_rechnungen_history') || '[]');
      const draft = history.find(d => d.nr === assistMatch.nr);
      if (draft) {
        const fields = ['sName','sStreet','sPlz','sCity','sTel','sEmail','sStNr','sContact',
          'sIBAN','sBIC','sBank','sWeb','cName','cSalutation','cStreet','cPlz','cCity',
          'cCountry','cGreeting','invPayment','invKdNr'];
        fields.forEach(id => { const el = document.getElementById(id); if (el && draft[id]) el.value = draft[id]; });
        if (draft.positions?.length) { positions = draft.positions.map(p => ({...p})); renderPos(); }
        // Datum auf heute setzen
        setDates();
        // Neue Rechnungsnummer generieren
        const rList = getRechnungen();
        const lastNr = rList.map(r => parseInt((r.nr||'').replace(/\D/g,''))).filter(n => !isNaN(n));
        const nextNr = lastNr.length ? Math.max(...lastNr) + 1 : 1001;
        document.getElementById('invNr').value = `RE-${nextNr}`;
        rp();
        return;
      }
    } catch(e) {}

    // Fallback: nur Kundendaten aus Rechnungsliste
    document.getElementById('cSalutation').value = assistMatch.kunde;
    setDates();
    rp();
  }

  /* ═══ Rechnungsliste ═══ */
  function _kundentyp(kundeName) {
    try {
      const kunden = JSON.parse(localStorage.getItem('max4work_kunden') || '[]');
      const k = kunden.find(x => x.name && x.name.toLowerCase() === (kundeName||'').toLowerCase());
      if (k && k.typ) return k.typ;
    } catch(e) {}
    const n = (kundeName||'').toUpperCase();
    return /\b(GMBH|AG|KG|OHG|E\.K\.|UG|GBR|E\.V\.|PARTG)\b/.test(n) ? 'gewerbe' : 'privat';
  }

  function setListeTab(el) {
    document.querySelectorAll('.ltab').forEach(t => t.classList.remove('on'));
    el.classList.add('on');
    currentListeTab = el.dataset.tab;
    const titles = { alle: 'Alle Rechnungen', wiederkehrend: 'Wiederkehrende Kunden', mahnungen: 'Mahnungen', gutschriften: 'Gutschriften', gewerbe: 'Gewerbe Kunden', privat: 'Privat Kunden' };
    const btnLabels = { alle: '+ Neue Rechnung', wiederkehrend: '+ Neue Rechnung', mahnungen: '+ Neue Mahnung', gutschriften: '+ Neue Gutschrift', gewerbe: '+ Neue Rechnung', privat: '+ Neue Rechnung' };
    document.getElementById('listeTitel').textContent = titles[currentListeTab];
    document.getElementById('neueRechnungBtn').textContent = btnLabels[currentListeTab];
    renderListe();
  }

  const REC_KEY = 'max4work_rechnungen';

  function getRechnungen() {
    try { return JSON.parse(localStorage.getItem(REC_KEY)) || []; } catch(e) { return []; }
  }
  function saveRechnungen(list) {
    try { localStorage.setItem(REC_KEY, JSON.stringify(list)); } catch(e) {}
  }

  function _gobdLog(aktion, data) {
    try {
      const log = JSON.parse(localStorage.getItem('max4work_gobd_log') || '[]');
      log.push({ ts: new Date().toISOString(), aktion, ...data });
      localStorage.setItem('max4work_gobd_log', JSON.stringify(log));
    } catch(e) {}
  }

  function saveToList() {
    const list = getRechnungen();
    const netto = calcNetto();
    const today = new Date().toISOString().split('T')[0];
    const nr = g('invNr');
    const existing = list.findIndex(r => r.nr === nr);
    const kundeName = g('cName') || g('cSalutation') || '—';

    if (existing >= 0 && list[existing].locked) {
      alert(`GoBD-Schutz: Rechnung ${nr} ist bereits archiviert und kann nicht mehr geändert werden.\n\nFür Korrekturen bitte eine neue Rechnung mit neuer Nummer erstellen.`);
      _gobdLog('ueberschreib-versuch', { nr, kunde: kundeName });
      return false;
    }

    const entry = {
      id: existing >= 0 ? list[existing].id : Date.now(),
      nr, kunde: kundeName,
      betrag: netto, datum: g('invDate') || today, faellig: g('invDue') || '',
      status: existing >= 0 ? list[existing].status : 'offen',
      zahlungsart: existing >= 0 ? (list[existing].zahlungsart || '') : '',
      typ: document.getElementById('invTyp')?.value || 'rechnung',
      kundentyp: existing >= 0 && list[existing].kundentyp ? list[existing].kundentyp : _kundentyp(kundeName),
      locked: true,
      lockedAt: new Date().toISOString()
    };
    if (existing >= 0) list[existing] = entry; else list.push(entry);
    saveRechnungen(list);
    _gobdLog('erstellt', { nr, kunde: kundeName, betrag: netto, datum: g('invDate') || today });

    // Vollständigen Draft für Assistent-History speichern
    try {
      const fields = ['sName','sStreet','sPlz','sCity','sTel','sEmail','sStNr','sContact',
        'sIBAN','sBIC','sBank','sWeb','invNr','invDate','invDelivery','invDue','invKdNr',
        'cName','cSalutation','cStreet','cPlz','cCity','cCountry','cGreeting','invPayment'];
      const draft = {}; fields.forEach(id => { draft[id] = g(id); });
      draft.positions = positions;
      draft.nr = g('invNr');
      const history = JSON.parse(localStorage.getItem('max4work_rechnungen_history') || '[]');
      const idx = history.findIndex(h => h.nr === draft.nr);
      if (idx >= 0) history[idx] = draft; else history.push(draft);
      localStorage.setItem('max4work_rechnungen_history', JSON.stringify(history));
    } catch(e) {}
  }
  let _zmCurrentId = null;

  function toggleStatus(id) {
    const list = getRechnungen();
    const r = list.find(r => r.id === id);
    if (!r) return;
    if (r.status === 'bezahlt') {
      r.status = 'offen';
      r.zahlungsart = '';
      r.teilzahlungen = [];
      _gobdLog('status', { nr: r.nr, kunde: r.kunde, von: 'bezahlt', nach: 'offen' });
      saveRechnungen(list);
      _syncZahlungen(r, true);
      renderListe();
    } else {
      openZahlModal(id);
    }
  }

  function openZahlModal(id) {
    _zmCurrentId = id;
    const list = getRechnungen();
    const r = list.find(r => r.id === id);
    if (r) {
      const fmtB = n => parseFloat(n||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
      document.getElementById('zmSub').textContent = `${r.kunde} · ${r.nr} · ${fmtB(r.betrag)}`;

      // Teilzahlungen anzeigen
      const teil = r.teilzahlungen || [];
      const teilSumme = teil.reduce((s, t) => s + parseFloat(t.betrag || 0), 0);
      const rest = parseFloat(r.betrag || 0) - teilSumme;

      const listEl = document.getElementById('zmTeilList');
      const restEl = document.getElementById('zmRestInfo');
      if (teil.length > 0) {
        listEl.style.display = 'block';
        listEl.innerHTML = `<div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Bisherige Teilzahlungen</div>` +
          teil.map((t, i) => `<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0;border-bottom:1px solid var(--border);">
            <span>${t.datum ? t.datum.split('-').reverse().join('.') : '—'} · ${t.zahlungsart || ''}</span>
            <span style="font-weight:600;">${fmtB(t.betrag)}</span>
          </div>`).join('') +
          `<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:6px 0;font-weight:700;">
            <span>Restbetrag</span><span style="color:${rest <= 0 ? 'var(--green)' : 'var(--red)'};">${fmtB(rest)}</span>
          </div>`;
        restEl.style.display = 'none';
        document.getElementById('zmTeilBetrag').value = rest > 0 ? rest.toFixed(2) : '';
      } else {
        listEl.style.display = 'none';
        restEl.style.display = 'none';
      }

      // Datum vorbelegen
      const datEl = document.getElementById('zmTeilDatum');
      if (datEl) datEl.value = new Date().toISOString().split('T')[0];
    }

    // Reset Teilzahlung-Toggle
    const check = document.getElementById('zmTeilCheck');
    if (check) { check.checked = false; zmToggleTeil(); }

    document.getElementById('zmOverlay').classList.add('open');
  }

  function zmToggleTeil() {
    const isTeil = document.getElementById('zmTeilCheck').checked;
    document.getElementById('zmTeilFields').style.display = isTeil ? 'block' : 'none';
    document.getElementById('zmBtnBezahlt').style.display = isTeil ? 'none' : '';
    document.getElementById('zmBtnTeil').style.display = isTeil ? '' : 'none';
  }

  function closeZahlModal() {
    document.getElementById('zmOverlay').classList.remove('open');
    _zmCurrentId = null;
  }

  function zmOverlayClick(e) {
    if (e.target === document.getElementById('zmOverlay')) closeZahlModal();
  }

  function confirmTeilzahlung() {
    if (!_zmCurrentId) return;
    const betrag = parseFloat(document.getElementById('zmTeilBetrag').value);
    const datum = document.getElementById('zmTeilDatum').value;
    const zahlungsart = document.getElementById('zmZahlungsart').value;
    if (!betrag || betrag <= 0) { alert('Bitte einen gültigen Betrag eingeben.'); return; }

    const list = getRechnungen();
    const r = list.find(r => r.id === _zmCurrentId);
    if (!r) { closeZahlModal(); return; }

    if (!r.teilzahlungen) r.teilzahlungen = [];
    r.teilzahlungen.push({ betrag, datum: datum || new Date().toISOString().split('T')[0], zahlungsart });

    const teilSumme = r.teilzahlungen.reduce((s, t) => s + parseFloat(t.betrag || 0), 0);
    const gesamtBetrag = parseFloat(r.betrag || 0);
    const vonStatus = r.status || 'offen';
    if (teilSumme >= gesamtBetrag - 0.005) {
      r.status = 'bezahlt';
      r.zahlungsart = zahlungsart;
      _gobdLog('status', { nr: r.nr, kunde: r.kunde, von: vonStatus, nach: 'bezahlt', zahlungsart: 'Teilzahlungen komplett' });
      _syncZahlungen(r, false);
    } else {
      r.status = 'teilbezahlt';
      _gobdLog('teilzahlung', { nr: r.nr, kunde: r.kunde, betrag, teilsumme: teilSumme, gesamt: gesamtBetrag });
    }
    saveRechnungen(list);
    closeZahlModal();
    renderListe();
    showToast(`Teilzahlung ${parseFloat(betrag).toLocaleString('de-DE',{minimumFractionDigits:2})} € gebucht`);
  }

  function confirmBezahlt() {
    if (!_zmCurrentId) return;
    const zahlungsart = document.getElementById('zmZahlungsart').value;
    const list = getRechnungen();
    const r = list.find(r => r.id === _zmCurrentId);
    if (!r) { closeZahlModal(); return; }
    const vonStatus = r.status || 'offen';
    r.status = 'bezahlt';
    r.zahlungsart = zahlungsart;
    _gobdLog('status', { nr: r.nr, kunde: r.kunde, von: vonStatus, nach: 'bezahlt', zahlungsart });
    saveRechnungen(list);
    _syncZahlungen(r, false);
    closeZahlModal();
    renderListe();
  }

  // Zukünftig: Bei Bank-Anbindung → Zahlungseingang automatisch per Kundenname matchen und als bezahlt markieren
  function _syncZahlungen(r, wasBezahlt) {
    const Z_KEY = 'max4work_zahlungen';
    try {
      let zahlungen = JSON.parse(localStorage.getItem(Z_KEY) || '[]');
      if (!wasBezahlt) {
        if (!zahlungen.some(z => z.rechNr === r.nr && z._auto)) {
          zahlungen.unshift({ id: Date.now(), _auto: true, datum: r.datum || new Date().toISOString().split('T')[0], betrag: Number(r.betrag || 0), kunde: r.kunde, rechNr: r.nr, notiz: r.zahlungsart || '' });
        }
      } else {
        zahlungen = zahlungen.filter(z => !(z.rechNr === r.nr && z._auto));
      }
      localStorage.setItem(Z_KEY, JSON.stringify(zahlungen));
    } catch(e) {}
  }
  let _delPending = null, _delTimer = null;
  function deleteRechnung(id) {
    const all = getRechnungen();
    const r = all.find(r => r.id === id);
    if (!r) return;
    if (_delPending === id) {
      clearTimeout(_delTimer);
      _delPending = null;
      if (r.locked) _gobdLog('loesch-forciert', { nr: r.nr, kunde: r.kunde });
      try {
        const store = JSON.parse(localStorage.getItem('max4work_xrechnungen') || '{}');
        delete store[r.nr]; localStorage.setItem('max4work_xrechnungen', JSON.stringify(store));
      } catch(e) {}
      saveRechnungen(all.filter(x => x.id !== id));
      showToast('Rechnung gelöscht');
      renderListe();
    } else {
      _delPending = id;
      showToast('Nochmal tippen zum Löschen');
      _delTimer = setTimeout(() => { _delPending = null; }, 3000);
    }
  }
  function renderListe() {
    const all = getRechnungen();
    const heute = new Date().toISOString().split('T')[0];

    // Tab-Zähler berechnen
    const kundenCount = {};
    all.forEach(r => { kundenCount[r.kunde] = (kundenCount[r.kunde] || 0) + 1; });
    const cntAlle = all.length;
    const cntWied = all.filter(r => kundenCount[r.kunde] >= 2).length;
    const cntMahn = all.filter(r => r.typ === 'mahnung' || (r.status === 'offen' && r.faellig && r.faellig < heute)).length;
    const cntGut  = all.filter(r => r.typ === 'gutschrift').length;
    const cntGew  = all.filter(r => (r.kundentyp || _kundentyp(r.kunde)) === 'gewerbe').length;
    const cntPriv = all.filter(r => (r.kundentyp || _kundentyp(r.kunde)) === 'privat').length;
    document.getElementById('tab-count-alle').textContent = cntAlle;
    document.getElementById('tab-count-wiederkehrend').textContent = cntWied;
    document.getElementById('tab-count-mahnungen').textContent = cntMahn;
    document.getElementById('tab-count-gutschriften').textContent = cntGut;
    document.getElementById('tab-count-gewerbe').textContent = cntGew;
    document.getElementById('tab-count-privat').textContent = cntPriv;

    let list = all.slice().reverse();
    if (currentListeTab === 'wiederkehrend') {
      list = list.filter(r => kundenCount[r.kunde] >= 2);
    } else if (currentListeTab === 'mahnungen') {
      list = list.filter(r => r.typ === 'mahnung' || (r.status === 'offen' && r.faellig && r.faellig < heute));
    } else if (currentListeTab === 'gutschriften') {
      list = list.filter(r => r.typ === 'gutschrift');
    } else if (currentListeTab === 'gewerbe') {
      list = list.filter(r => (r.kundentyp || _kundentyp(r.kunde)) === 'gewerbe');
    } else if (currentListeTab === 'privat') {
      list = list.filter(r => (r.kundentyp || _kundentyp(r.kunde)) === 'privat');
    }

    const tbody = document.getElementById('listeBody');
    const empty = document.getElementById('listeEmpty');
    const count = document.getElementById('listeCount');
    count.textContent = list.length ? `– ${list.length} gesamt` : '';
    if (!list.length) {
      tbody.innerHTML = '';
      const emptyMsgs = { alle: 'Noch keine Rechnungen', wiederkehrend: 'Noch keine wiederkehrenden Kunden', mahnungen: 'Keine Mahnungen vorhanden', gutschriften: 'Keine Gutschriften vorhanden', gewerbe: 'Keine Rechnungen für Gewerbe-Kunden', privat: 'Keine Rechnungen für Privat-Kunden' };
      empty.querySelector('p').textContent = emptyMsgs[currentListeTab] || 'Keine Einträge';
      empty.style.display = 'block'; return;
    }
    empty.style.display = 'none';
    const fmtD = v => { if (!v) return '—'; const [y,m,d] = v.split('-'); return `${d}.${m}.${y}`; };
    const fmtB = n => parseFloat(n).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
    const xrStore = (() => { try { return JSON.parse(localStorage.getItem('max4work_xrechnungen') || '{}'); } catch(e) { return {}; } })();
    _updateParkenBtn();
    tbody.innerHTML = list.map(r => {
      const ueberfaellig = _isFeatureOn('highlightOverdue') && (r.status === 'offen' || r.status === 'teilbezahlt') && r.faellig && r.faellig < heute;
      const badgeClass = r.status === 'bezahlt' ? 'badge-bezahlt' : r.status === 'teilbezahlt' ? 'badge-teilbezahlt' : ueberfaellig ? 'badge-ueberfaellig' : 'badge-offen';
      const badgeText = r.status === 'bezahlt' ? 'Bezahlt' : r.status === 'teilbezahlt' ? 'Teilbezahlt' : ueberfaellig ? 'Überfällig' : 'Offen';
      const typChip = r.typ === 'gutschrift' ? '<span class="typ-chip typ-chip-gs">GS</span>'
                    : r.typ === 'mahnung'    ? '<span class="typ-chip typ-chip-ma">MA</span>' : '';
      const xrBtn = xrStore[r.nr]
        ? `<button class="xr-dl-btn" onclick="event.stopPropagation();_downloadStoredXRechnung('${r.nr}')" title="XRechnung herunterladen">XML ↓</button>`
        : '';
      const lockIcon = r.locked ? `<span title="GoBD-archiviert – unveränderlich" style="margin-left:5px;font-size:10px;opacity:.6;">🔒</span>` : '';
      const delCell = `<td><button class="del-btn" onclick="deleteRechnung(${r.id})" title="${r.locked ? 'Archiviert – mit Bestätigung löschen' : 'Löschen'}" style="${r.locked ? 'opacity:.45;' : ''}">×</button></td>`;
      return `<tr>
        <td style="font-weight:500">${r.nr}${typChip}${lockIcon}</td>
        <td>${r.kunde}</td>
        <td>${fmtD(r.datum)}</td>
        <td>${fmtD(r.faellig)}</td>
        <td style="font-weight:600">${fmtB(r.betrag)}</td>
        <td><button class="status-btn" onclick="toggleStatus(${r.id})"><span class="${badgeClass}">${badgeText}</span>${r.zahlungsart ? `<span class="badge-zahlungsart">· ${r.zahlungsart}</span>` : ''}</button>${ueberfaellig ? `<button class="mahn-btn" onclick="event.stopPropagation();openMahnModal(${r.id})">Mahnen</button>` : ''}</td>
        <td style="text-align:center">${xrBtn}</td>
        ${delCell}
      </tr>`;
    }).join('');
  }

  /* ═══ View-Toggle ═══ */
  function showListe() {
    document.getElementById('listeView').style.display = 'block';
    document.getElementById('formView').style.display = 'none';
    document.getElementById('topbarActionsListe').style.display = 'flex';
    document.getElementById('topbarActionsForm').style.display = 'none';
    const _tL0 = document.getElementById('topbarLeft'); if (_tL0) _tL0.style.display = 'none';
    document.getElementById('topbarTitle').textContent = 'Rechnungen';
    renderListe();
  }
  function _initNeuRechnung() {
    // Logo aus localStorage laden
    const savedLogo = typeof loadLogo === 'function' ? loadLogo() : null;
    if (savedLogo) { logoURL = savedLogo; showLogoPreview(); }
    else { logoURL = null; }

    // Neue Rechnungsnummer generieren
    const rList = getRechnungen();
    const lastNr = rList.map(r => parseInt((r.nr||'').replace(/\D/g,''))).filter(n => !isNaN(n));
    const nextNr = lastNr.length ? Math.max(...lastNr) + 1 : 1001;
    const invNrEl = document.getElementById('invNr');
    if (invNrEl) invNrEl.value = `RE-${nextNr}`;

    // Datumsfelder neu setzen
    setDates();

    // Kundendaten leeren
    ['cName','cSalutation','cStreet','cPlz','cCity','cGreeting','invKdNr'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const ctry = document.getElementById('cCountry');
    if (ctry) ctry.value = 'Deutschland';
    const searchEl = document.getElementById('kundeSearch');
    const clearBtn = document.getElementById('kundeClearBtn');
    if (searchEl) searchEl.value = '';
    if (clearBtn) clearBtn.style.display = 'none';

    // Positionen zurücksetzen
    positions = [{ desc: '', qty: '1', price: 0, ust: _defaultUst() }];
    renderPos();

    // Unternehmensdaten aus Einstellungen laden
    const settings = loadSettings();
    if (settings) {
      ['sName','sStreet','sPlz','sCity','sTel','sEmail','sStNr','sContact','sIBAN','sBIC','sBank','sWeb','invPayment']
        .forEach(id => { const el = document.getElementById(id); if (el && settings[id]) el.value = settings[id]; });
    }

    _unternehmenRestoreState();
  }

  function showForm() {
    document.getElementById('listeView').style.display = 'none';
    document.getElementById('formView').style.display = 'block';
    document.getElementById('topbarActionsListe').style.display = 'none';
    document.getElementById('topbarActionsForm').style.display = 'flex';
    const _tL1 = document.getElementById('topbarLeft'); if (_tL1) _tL1.style.display = '';
    const formTitles = { mahnungen: 'Neue Mahnung', gutschriften: 'Neue Gutschrift' };
    document.getElementById('topbarTitle').textContent = formTitles[currentListeTab] || 'Neue Rechnung';
    const tabToTyp = { mahnungen: 'mahnung', gutschriften: 'gutschrift' };
    const typEl = document.getElementById('invTyp');
    if (typEl) typEl.value = tabToTyp[currentListeTab] || 'rechnung';
    assistDismissed = false;
    assistHide();

    // Immer sauberes Formular starten – alten Draft verwerfen
    try { localStorage.removeItem('max4work_rechnung_draft'); } catch(e) {}
    _initNeuRechnung();
    // Vorschau immer mit aktuellem Blatt-Design rendern
    rp();
  }

  /* ═══ State ═══ */
  let logoURL = null;
  let positions = [{ desc: '', qty: '1', price: 0, ust: 0 }];

  /* ═══ Hilfsfunktionen ═══ */
  function g(id) { const el = document.getElementById(id); return el ? el.value : ''; }
  function fmt(n) { return parseFloat(n).toFixed(2).replace('.', ','); }
  function fmtDate(v) {
    if (!v) return '—';
    const [y,m,d] = v.split('-');
    return `${d}.${m}.${y}`;
  }

  /* ═══ Logo – FIX: wird in localStorage gespeichert ═══ */
  document.getElementById('logoInput').addEventListener('change', function(e) {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      logoURL = ev.target.result;
      saveLogo(logoURL);           // shared.js
      showLogoPreview();
      rp();
    };
    r.readAsDataURL(file);
  });

  function showLogoPreview() {
    document.getElementById('logoPlaceholder').style.display = 'none';
    document.getElementById('logoPreviewBox').style.display = 'block';
    document.getElementById('logoThumb').src = logoURL;
    const rb = document.getElementById('logoRemoveBtn');
    rb.style.display = 'flex';
    document.getElementById('logoSavedBadge').style.display = 'inline-flex';
  }

  function removeLogo() {
    logoURL = null;
    clearLogo();                   // shared.js
    document.getElementById('logoPlaceholder').style.display = 'block';
    document.getElementById('logoPreviewBox').style.display = 'none';
    document.getElementById('logoRemoveBtn').style.display = 'none';
    document.getElementById('logoSavedBadge').style.display = 'none';
    document.getElementById('logoInput').value = '';
    rp();
  }

  /* ═══ Positionen ═══ */
  function _defaultUst() {
    const cfg = _loadInvConfig();
    return cfg.felder?.ust19 ? 0 : 19;
  }

  function getUstGroups() {
    const groups = {};
    positions.forEach(p => {
      const qty = isNaN(parseFloat(p.qty)) ? 1 : parseFloat(p.qty);
      const netto = qty * p.price;
      const rate = p.ust !== undefined ? Number(p.ust) : 0;
      if (!groups[rate]) groups[rate] = { netto: 0, tax: 0 };
      groups[rate].netto += netto;
      groups[rate].tax   += netto * rate / 100;
    });
    return groups;
  }

  function calcBrutto() {
    const gr = getUstGroups();
    return Object.values(gr).reduce((s, v) => s + v.netto + v.tax, 0);
  }

  function renderPos() {
    const tb = document.getElementById('posBody');
    tb.innerHTML = '';
    const defUst = _defaultUst();
    positions.forEach((p, i) => {
      const ustVal = p.ust !== undefined ? Number(p.ust) : defUst;
      const total = isNaN(parseFloat(p.qty)) ? p.price : parseFloat(p.qty) * p.price;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input value="${p.desc}" placeholder="Beschreibung" data-idx="${i}" data-field="desc"></td>
        <td><input value="${p.qty}" placeholder="1 / pauschal" data-idx="${i}" data-field="qty"></td>
        <td><input type="number" value="${p.price}" min="0" step="0.01" data-idx="${i}" data-field="price"></td>
        <td><select data-idx="${i}" data-field="ust" style="padding:4px 2px;font-size:12px;width:100%;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);">
          <option value="19" ${ustVal===19?'selected':''}>19 %</option>
          <option value="7"  ${ustVal===7 ?'selected':''}>7 %</option>
          <option value="0"  ${ustVal===0 ?'selected':''}>§19</option>
        </select></td>
        <td><input value="${fmt(total)} €" readonly style="background:var(--soft);color:var(--muted)"></td>
        <td><button type="button" class="pos-del" data-del="${i}">×</button></td>`;
      tb.appendChild(tr);
    });
  }

  /* FIX: Event-Delegation statt inline-onclick in dynamischen Zeilen */
  document.getElementById('posBody').addEventListener('input', function(e) {
    const el = e.target;
    const idx = parseInt(el.dataset.idx);
    if (isNaN(idx)) return;
    const field = el.dataset.field;
    if (field === 'price') positions[idx].price = parseFloat(el.value) || 0;
    else if (field === 'qty') positions[idx].qty = el.value;
    else if (field === 'desc') positions[idx].desc = el.value;
    else if (field === 'ust') positions[idx].ust = parseInt(el.value);
    rp();
  });

  document.getElementById('posBody').addEventListener('click', function(e) {
    const btn = e.target.closest('[data-del]');
    if (!btn) return;
    const i = parseInt(btn.dataset.del);
    if (positions.length > 1) { positions.splice(i, 1); renderPos(); rp(); }
  });

  document.getElementById('addPosBtn').addEventListener('click', function() {
    positions.push({ desc: '', qty: '1', price: 0, ust: _defaultUst() }); renderPos(); rp();
  });

  /* ═══ Produkt-Picker ═══ */
  function _escH(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.toggleProdPicker = function(e) {
    e.stopPropagation();
    const dd = document.getElementById('prodPickDd');
    if (!dd) return;
    const opening = !dd.classList.contains('open');
    dd.classList.toggle('open', opening);
    if (opening) {
      const si = document.getElementById('prodPickSearch');
      if (si) { si.value = ''; renderProdPicker(''); setTimeout(() => si.focus(), 40); }
    }
  };

  window.renderProdPicker = function(search) {
    const list = document.getElementById('prodPickList');
    if (!list) return;
    const produkte = JSON.parse(localStorage.getItem('max4work_produkte') || '[]');
    if (!produkte.length) {
      list.innerHTML = '<div class="prod-pick-empty">Noch keine Produkte angelegt.<br><a href="produkte.html" style="color:var(--accent);font-weight:500;text-decoration:none;">→ Produkte verwalten</a></div>';
      return;
    }
    const q = (search || '').toLowerCase();
    const filtered = produkte.filter(p =>
      !q || p.name.toLowerCase().includes(q) || (p.artnr || '').toLowerCase().includes(q)
    );
    if (!filtered.length) {
      list.innerHTML = '<div class="prod-pick-empty">Kein Treffer.</div>';
      return;
    }
    list.innerHTML = filtered.map(p => {
      const price = parseFloat(p.vk_netto) || 0;
      const priceStr = price > 0
        ? price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
        : '—';
      const typeLabel = p.kategorie === 'dienstleistung' ? 'Dienst.' : 'Artikel';
      const einheit = p.einheit ? ' · ' + _escH(p.einheit) : '';
      return `<div class="prod-pick-item" onclick="insertProdukt(${p.id})">
        <div style="min-width:0">
          <div class="prod-pick-name">${_escH(p.name)}</div>
          <div class="prod-pick-sub">${typeLabel}${einheit} · Art.${_escH(p.artnr || '—')}</div>
        </div>
        <div class="prod-pick-price">${priceStr}</div>
      </div>`;
    }).join('');
  };

  window.insertProdukt = function(id) {
    const produkte = JSON.parse(localStorage.getItem('max4work_produkte') || '[]');
    const p = produkte.find(x => x.id === id);
    if (!p) return;
    positions.push({
      desc: p.name,
      qty: '1',
      price: parseFloat(p.vk_netto) || 0,
      ust: parseInt(p.ust) || 0,
    });
    renderPos(); rp();
    const dd = document.getElementById('prodPickDd');
    if (dd) dd.classList.remove('open');
  };

  document.addEventListener('click', function(e) {
    const wrap = document.getElementById('prodPickWrap');
    const dd = document.getElementById('prodPickDd');
    if (dd && wrap && !wrap.contains(e.target)) dd.classList.remove('open');
  });

  /* ═══ Totals ═══ */
  function calcNetto() {
    return positions.reduce((s, p) => {
      const qty = isNaN(parseFloat(p.qty)) ? 1 : parseFloat(p.qty);
      return s + qty * p.price;
    }, 0);
  }

  function renderTotals(netto) {
    const groups  = getUstGroups();
    const rates   = Object.keys(groups).map(Number).sort((a, b) => b - a);
    const allZero = rates.every(r => r === 0);
    const brutto  = calcBrutto();

    let html = `<div class="tot-row"><span class="lbl">Gesamtbetrag netto</span><span>${fmt(netto)} EUR</span></div>`;

    if (allZero) {
      html += `<div class="tot-row" style="font-size:11.5px;color:var(--muted)">Umsatzsteuer nicht erhoben gemäß §19 UStG.</div>`;
    } else {
      rates.forEach(r => {
        if (r > 0) {
          html += `<div class="tot-row"><span class="lbl">MwSt ${r}&thinsp;%</span><span>${fmt(groups[r].tax)} EUR</span></div>`;
        } else if (groups[r].netto > 0) {
          html += `<div class="tot-row" style="font-size:11px;color:var(--muted)"><span class="lbl">davon §19 befreit</span><span>${fmt(groups[r].netto)} EUR</span></div>`;
        }
      });
    }

    html += `<div class="tot-row bold"><span>Gesamtbetrag brutto</span><span>${fmt(brutto)} EUR</span></div>`;
    document.getElementById('totalsBlock').innerHTML = html;
  }

  /* ═══ Blatt-Design Konfiguration ═══ */

  function _hexToRgb(hex) {
    const h = (hex || '#000000').replace('#', '');
    const f = h.length === 3 ? h.split('').map(x => x+x).join('') : h;
    const n = parseInt(f, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function _rpLayoutTheme(id) {
    const base = {
      headerMode: 'standard', headerBg: null, headerTextColor: '#ffffff',
      sidebarBg: null, titleColor: '#111111', trennColor: '#dddddd',
      thColor: '#888888', thBorderColor: '#cccccc',
      trBorderColor: '#e4e4e4', totalBorderColor: '#bbbbbb',
    };
    return ({
      standard:    {...base},
      neutral:     {...base, thColor:'#666666', thBorderColor:'#d0d0d0', trBorderColor:'#e8e8e8', totalBorderColor:'#c0c0c0', titleColor:'#333333'},
      elegant:     {...base, titleColor:'#6b4c11', thColor:'#8b6914', thBorderColor:'#d4b896', trBorderColor:'#e8d8c0', totalBorderColor:'#c9a84c', trennColor:'#d4b896'},
      technisch:   {...base, headerMode:'sidebar', sidebarBg:'#2563eb', titleColor:'#2563eb', thColor:'#2563eb', thBorderColor:'#bfdbfe', trBorderColor:'#dbeafe', totalBorderColor:'#93c5fd', trennColor:'#bfdbfe'},
      geometrisch: {...base, titleColor:'#7c3aed', thColor:'#7c3aed', thBorderColor:'#ddd6fe', trBorderColor:'#ede9fe', totalBorderColor:'#c4b5fd', trennColor:'#ddd6fe'},
      dynamisch:   {...base, headerMode:'colored', headerBg:'linear-gradient(135deg,#dc2626 0%,#dc2626 65%,#ef4444 65%)', headerTextColor:'#ffffff', titleColor:'#dc2626', thColor:'#dc2626', thBorderColor:'#fecaca', trBorderColor:'#fee2e2', totalBorderColor:'#fca5a5', trennColor:'#fecaca'},
      klassik:     {...base, headerMode:'centered', trennColor:'#888888', thColor:'#555555', thBorderColor:'#888888', trBorderColor:'#cccccc', totalBorderColor:'#999999'},
      schwarz:     {...base, headerMode:'colored', headerBg:'#111111', headerTextColor:'#ffffff', thColor:'#333333', thBorderColor:'#cccccc'},
      blau:        {...base, headerMode:'colored', headerBg:'#1e3a8a', headerTextColor:'#ffffff', titleColor:'#1e3a8a', thColor:'#1e40af', thBorderColor:'#bfdbfe', trBorderColor:'#dbeafe', totalBorderColor:'#93c5fd', trennColor:'#bfdbfe'},
      schlicht:    {...base, titleColor:'#444444', trennColor:'#ebebeb', thColor:'#999999', thBorderColor:'#e8e8e8', trBorderColor:'#f0f0f0', totalBorderColor:'#cccccc'},
    })[id] || base;
  }

  function _loadInvConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem('max4work_rechnung_config') || 'null');
      if (saved && saved.felder && saved.texte) return saved;
    } catch(e) {}
    return {
      template: 'standard', logoPos: 'rechts', logoGroesse: 'mittel',
      felder: { logo:true, adresse:true, tel:true, email:true, web:false, steuernr:true, kundennr:false, faellig:true, bank:true, girocode:true, ust19:false, trennlinien:true },
      texte:  { einleitung:'', schluss:'', hinweise:'' }
    };
  }

  /* ═══ Vorschau rendern (Blatt-Design) ═══ */
  function rp() {
    const netto = calcNetto();
    renderTotals(netto);
    saveDraft();

    const paper = document.getElementById('invA4Paper');
    if (!paper) return;
    if (!_isFeatureOn('livePreview')) return;

    const cfg     = _loadInvConfig();
    const f       = cfg.felder;
    const texte   = cfg.texte;
    const logoPos = cfg.logoPos || 'rechts';
    const szMap   = { klein:34, mittel:50, gross:70 };
    const sz      = szMap[cfg.logoGroesse || 'mittel'];
    const logoW   = Math.round(sz * 1.85);

    const logoBox = f.logo && logoURL
      ? `<div style="flex-shrink:0;width:${logoW}px;height:${sz}px;overflow:hidden;display:flex;align-items:center;"><img src="${logoURL}" style="max-width:100%;max-height:100%;object-fit:contain;"></div>`
      : '';

    const infoItems = [];
    if (f.adresse) { infoItems.push(`<strong style="font-size:9px;">${_escHtml(g('sName'))}</strong>`, _escHtml(g('sStreet')), `${_escHtml(g('sPlz'))} ${_escHtml(g('sCity'))}`); }
    if (f.tel    && g('sTel'))   infoItems.push(`Tel: ${_escHtml(g('sTel'))}`);
    if (f.email  && g('sEmail')) infoItems.push(_escHtml(g('sEmail')));
    if (f.web    && g('sWeb'))   infoItems.push(_escHtml(g('sWeb')));
    if (f.steuernr && g('sStNr')) infoItems.push(`St.-Nr.: ${_escHtml(g('sStNr'))}`);
    const infoHtml = `<div style="flex:1;font-size:7.5px;line-height:1.75;color:#444;min-width:0;">${infoItems.join('<br>')}</div>`;

    const hDir = logoPos === 'mitte'  ? 'column;align-items:center'
               : logoPos === 'rechts' ? 'row-reverse'
               : 'row';

    const lyt        = _rpLayoutTheme(cfg.layout || 'standard');
    const accentCol  = cfg.invAccent || lyt.titleColor;
    const docLabel   = { rechnung:'Rechnung', mahnung:'Mahnung', auftragsbestaetigung:'Auftragsbestätigung', angebot:'Angebot', lieferschein:'Lieferschein', brief:'Brief', gutschrift:'Gutschrift' }[cfg.docType || 'rechnung'] || 'Rechnung';

    const absender = f.adresse
      ? `<div style="font-size:6px;color:#aaa;border-bottom:1px solid #eee;padding-bottom:3px;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_escHtml(g('sName'))} · ${_escHtml(g('sStreet'))} · ${_escHtml(g('sPlz'))} ${_escHtml(g('sCity'))}</div>`
      : '';

    const empfaenger = g('cSalutation')
      ? `<strong style="font-size:8.5px;color:#111;">${_escHtml(g('cSalutation'))}</strong>`
      : '<span style="font-size:7px;color:#ccc;font-style:italic;">Kein Kunde ausgewählt</span>';

    const metaRows = [
      `<tr><td style="color:#999;padding-right:8px;white-space:nowrap;">${docLabel}-Nr.</td><td style="font-weight:700;color:#222;">${_escHtml(g('invNr'))}</td></tr>`,
      `<tr><td style="color:#999;white-space:nowrap;">Datum</td><td>${fmtDate(g('invDate'))}</td></tr>`,
      `<tr><td style="color:#999;white-space:nowrap;">Lieferdatum</td><td>${fmtDate(g('invDelivery'))}</td></tr>`,
      f.faellig && g('invDue')  ? `<tr><td style="color:#999;white-space:nowrap;">Fällig bis</td><td>${fmtDate(g('invDue'))}</td></tr>` : '',
      f.kundennr && g('invKdNr')? `<tr><td style="color:#999;white-space:nowrap;">Kunden-Nr.</td><td>${_escHtml(g('invKdNr'))}</td></tr>` : '',
    ].join('');
    const trennCol   = f.trennlinien ? lyt.trBorderColor  : 'transparent';
    const thBorderC  = f.trennlinien ? lyt.thBorderColor  : 'transparent';
    const totBorderC = f.trennlinien ? lyt.totalBorderColor : 'transparent';

    const posRows = positions.map((p, i) => {
      const total = isNaN(parseFloat(p.qty)) ? p.price : parseFloat(p.qty) * p.price;
      return `<tr style="border-bottom:1px solid ${trennCol};">
        <td style="padding:4px 0;">${i+1}. ${_escHtml(p.desc || '—')}</td>
        <td style="text-align:right;padding:4px 0;color:#555;">${_escHtml(String(p.qty || '—'))}</td>
        <td style="text-align:right;padding:4px 0;color:#555;">${fmt(p.price)} €</td>
        <td style="text-align:right;padding:4px 0;font-weight:600;">${fmt(total)} €</td>
      </tr>`;
    }).join('');

    const einlText = texte.einleitung ? texte.einleitung.replace(/\n/g,'<br>') : '';
    const schlussText = texte.schluss  ? texte.schluss.replace(/\n/g,'<br>')   : '';

    const bankHtml = f.bank && g('sIBAN')
      ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid #eee;font-size:7px;color:#555;line-height:1.9;">${g('sBank') ? `<strong>${_escHtml(g('sBank'))}</strong><br>` : ''}IBAN: ${_escHtml(g('sIBAN'))}${g('sBIC') ? ` · BIC: ${_escHtml(g('sBIC'))}` : ''}</div>`
      : '';

    const giroHtml = f.girocode && g('sIBAN')
      ? `<div style="margin-top:8px;display:flex;align-items:flex-start;gap:8px;"><div id="invQrCode"></div><div style="font-size:7px;color:#555;line-height:1.75;padding-top:2px;">${_escHtml(g('sName'))}<br>IBAN: ${_escHtml(g('sIBAN'))}<br>Betrag: <strong>${fmt(netto)} €</strong><br><span style="color:#999;">RE ${_escHtml(g('invNr'))}</span></div></div>`
      : '';

    const ust19Html = f.ust19
      ? `<div style="font-size:7px;color:#666;font-style:italic;margin-bottom:6px;">Gemäß § 19 Abs. 1 UStG wird keine Umsatzsteuer berechnet.</div>`
      : '';

    const hinweiseHtml = texte.hinweise
      ? `<div style="margin-top:10px;padding:7px 10px;background:#f8f8f8;border-left:2.5px solid ${accentCol};font-size:6.5px;color:#777;line-height:1.65;">${texte.hinweise.replace(/\n/g,'<br>')}</div>`
      : '';

    const falzHtml = `
      <div class="inv-falz" style="top:297px;"><div class="inv-falz-tick"></div><div style="flex:1;"></div><div class="inv-falz-tick-r"></div></div>
      <div class="inv-falz" style="top:595px;"><div class="inv-falz-tick"></div><div style="flex:1;"></div><div class="inv-falz-tick-r"></div></div>`;

    // ── Header-Sektion je nach Layout-Modus ──
    const headerInfoColor = lyt.headerMode === 'colored' ? lyt.headerTextColor : '#444';
    const infoHtmlColored = `<div style="flex:1;font-size:7.5px;line-height:1.75;color:${headerInfoColor};min-width:0;">${infoItems.join('<br>')}</div>`;
    let headerSection = '';
    if (lyt.headerMode === 'colored') {
      headerSection = `<div style="background:${lyt.headerBg};padding:14px 22px 12px;margin:-1px -1px 0;">
        <div style="display:flex;flex-direction:${hDir};align-items:flex-start;gap:12px;">${logoBox}${infoHtmlColored}</div>
      </div>`;
    } else if (lyt.headerMode === 'centered') {
      headerSection = `<div style="text-align:center;padding:14px 22px 0;">
        ${logoBox ? `<div style="display:flex;justify-content:center;margin-bottom:5px;">${logoBox}</div>` : ''}
        ${infoHtml}
      </div>`;
    } else if (lyt.headerMode === 'sidebar') {
      headerSection = `<div style="display:flex;">
        <div style="width:4px;background:${lyt.sidebarBg};flex-shrink:0;border-radius:2px 0 0 0;"></div>
        <div style="flex:1;padding:14px 22px 0 18px;">
          <div style="display:flex;flex-direction:${hDir};align-items:flex-start;gap:12px;">${logoBox}${infoHtml}</div>
        </div>
      </div>`;
    } else {
      headerSection = `<div style="padding:14px 22px 0;position:relative;">
        <div style="display:flex;flex-direction:${hDir};align-items:flex-start;gap:12px;">${logoBox}${infoHtml}</div>
      </div>`;
    }

    const headerBottom = (lyt.headerMode !== 'colored' && f.trennlinien)
      ? `<div style="height:1px;background:${lyt.trennColor};margin:10px 22px 0;"></div>`
      : (lyt.headerMode === 'colored' ? '' : '<div style="height:8px;"></div>');

    const bodyPad = lyt.headerMode === 'colored' ? '12px 22px 18px' : '8px 22px 18px';

    paper.innerHTML = falzHtml + headerSection + headerBottom + `<div style="padding:${bodyPad};font-family:'Outfit',sans-serif;">
      <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:12px;align-items:flex-start;">
        <div style="font-size:7.5px;color:#444;max-width:55%;">${absender}${empfaenger}${g('cStreet') ? `<br>${_escHtml(g('cStreet'))}` : ''}${(g('cPlz')||g('cCity')) ? `<br>${_escHtml(g('cPlz'))} ${_escHtml(g('cCity'))}` : ''}${g('cCountry') ? `<br>${_escHtml(g('cCountry'))}` : ''}</div>
        <table style="font-size:7.5px;color:#444;border-collapse:collapse;">${metaRows}</table>
      </div>
      <div style="font-size:10px;font-weight:700;color:${accentCol};margin-bottom:6px;">${docLabel} Nr. ${_escHtml(g('invNr'))}</div>
      ${g('cGreeting') ? `<div style="font-size:7.5px;color:#555;margin-bottom:6px;">${_escHtml(g('cGreeting'))},</div>` : ''}
      ${einlText ? `<div style="font-size:7.5px;color:#555;margin-bottom:10px;line-height:1.65;">${einlText}</div>` : ''}
      <table style="width:100%;border-collapse:collapse;font-size:7.5px;margin:10px 0 8px;">
        <thead>
          <tr style="border-bottom:1.5px solid ${thBorderC};">
            <th style="text-align:left;padding:3px 0;color:${lyt.thColor};font-weight:600;font-size:6.5px;text-transform:uppercase;">Beschreibung</th>
            <th style="text-align:right;padding:3px 0;color:${lyt.thColor};font-weight:600;font-size:6.5px;text-transform:uppercase;width:36px;">Menge</th>
            <th style="text-align:right;padding:3px 0;color:${lyt.thColor};font-weight:600;font-size:6.5px;text-transform:uppercase;width:52px;">Einzelpr.</th>
            <th style="text-align:right;padding:3px 0;color:${lyt.thColor};font-weight:600;font-size:6.5px;text-transform:uppercase;width:52px;">Gesamt</th>
          </tr>
        </thead>
        <tbody>${posRows}</tbody>
        <tfoot>
          ${(() => {
            const gr = getUstGroups();
            const rs = Object.keys(gr).map(Number).sort((a,b)=>b-a);
            const brutto = calcBrutto();
            let rows = '';
            if (!rs.every(r=>r===0)) {
              rs.forEach(r => { if (r>0) rows += `<tr><td colspan="3" style="padding:2px 0;font-size:6px;color:#888;">MwSt ${r} %</td><td style="text-align:right;padding:2px 0;font-size:6px;color:#888;">${fmt(gr[r].tax)} €</td></tr>`; });
            }
            rows += `<tr style="border-top:1.5px solid ${totBorderC};"><td colspan="3" style="padding:5px 0;font-weight:700;font-size:9px;color:${accentCol};">Gesamtbetrag brutto</td><td style="text-align:right;padding:5px 0;font-weight:700;font-size:9px;color:${accentCol};">${fmt(brutto)} €</td></tr>`;
            return rows;
          })()}
        </tfoot>
      </table>
      ${ust19Html}
      ${schlussText ? `<div style="font-size:7.5px;color:#555;margin-top:6px;line-height:1.65;">${schlussText}</div>` : ''}
      ${bankHtml}
      ${giroHtml}
      ${hinweiseHtml}
    </div>`;

    if (f.girocode && g('sIBAN')) generateQRCode();
  }

  /* ═══ PDF Export ═══ */
  document.getElementById('pdfBtn').addEventListener('click', exportPDF);

  async function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const netto = calcNetto();

    const cfg     = _loadInvConfig();
    const f       = cfg.felder;
    const texte   = cfg.texte;
    const logoPos = cfg.logoPos || 'rechts';
    const szH     = { klein:12, mittel:16, gross:22 };
    const szW     = { klein:30, mittel:40, gross:55 };
    const lh      = szH[cfg.logoGroesse || 'mittel'];
    const lw      = szW[cfg.logoGroesse || 'mittel'];

    const lyt       = _rpLayoutTheme(cfg.layout || 'standard');
    const accentHex = cfg.invAccent || lyt.titleColor;
    const [aR, aG, aB]     = _hexToRgb(accentHex);
    const [thR, thG, thB]  = _hexToRgb(lyt.thColor);
    const [thbR,thbG,thbB] = _hexToRgb(lyt.thBorderColor);
    const [trbR,trbG,trbB] = _hexToRgb(lyt.trBorderColor);
    const [totR,totG,totB] = _hexToRgb(lyt.totalBorderColor);
    const docLabel  = { rechnung:'Rechnung', mahnung:'Mahnung', auftragsbestaetigung:'Auftragsbestätigung', angebot:'Angebot', lieferschein:'Lieferschein', brief:'Brief', gutschrift:'Gutschrift' }[cfg.docType || 'rechnung'] || 'Rechnung';
    const zahlungstage = cfg.zahlungstage || 14;

    // Linker Rand: bei Sidebar-Layout breiter
    const M  = lyt.headerMode === 'sidebar' ? 26 : 20;
    let y = 18;

    // ── Sidebar-Balken (technisch) ──
    if (lyt.headerMode === 'sidebar' && lyt.sidebarBg) {
      const [sR,sG,sB] = _hexToRgb(lyt.sidebarBg);
      doc.setFillColor(sR, sG, sB);
      doc.rect(0, 0, 5, 297, 'F');
    }

    // ── Farbiger Header (dynamisch / schwarz / blau) ──
    const hdrH = Math.max(lh + 16, 30);
    if (lyt.headerMode === 'colored' && lyt.headerBg) {
      const bgHex = (lyt.headerBg.match(/#[0-9a-fA-F]{6}/) || ['#333333'])[0];
      const [hR,hG,hB] = _hexToRgb(bgHex);
      doc.setFillColor(hR, hG, hB);
      doc.rect(0, 0, 210, hdrH, 'F');
    }

    // ── Logo ──
    const lx = ({ links: M, mitte: 105 - lw/2, rechts: 190 - lw })[logoPos] || (190 - lw);
    if (f.logo) {
      if (logoURL) {
        try { doc.addImage(logoURL, 'PNG', lx, y, lw, lh); } catch(e) {}
      } else {
        const firmName = g('sName') || '';
        if (firmName) {
          const nameCol = lyt.headerMode === 'colored' ? [255,255,255] : [50,50,50];
          doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(...nameCol);
          doc.text(firmName, 190, y+9, {align:'right'});
          doc.setTextColor(0,0,0);
        }
      }
    }
    y += Math.max(lh + 6, 22);

    // Bei farbigem Header: sicherstellen dass y hinter dem Header liegt
    if (lyt.headerMode === 'colored') y = Math.max(y, hdrH + 6);

    // Klassik: doppelte Zierlinie
    if (cfg.layout === 'klassik') {
      doc.setDrawColor(34,34,34); doc.setLineWidth(0.5); doc.line(M, y, 190, y);
      doc.setDrawColor(100,100,100); doc.setLineWidth(0.2); doc.line(M, y+2, 190, y+2);
      y += 6;
    }

    // ── Absender-Zeile ──
    if (f.adresse) {
      const addrCol = lyt.headerMode === 'colored' ? [200,200,200] : [139,96,64];
      const addrX   = lyt.headerMode === 'centered' ? 105 : M;
      const addrAlign = lyt.headerMode === 'centered' ? {align:'center'} : {};
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...addrCol);
      doc.text(`${g('sName')}  ○  ${g('sStreet')}  ○  ${g('sPlz')} ${g('sCity')}`, addrX, y, addrAlign);
      doc.setTextColor(0,0,0);
      y += 10;
    } else { y += 5; }

    // ── Kundenadresse ──
    doc.setFont('helvetica','normal'); doc.setFontSize(10.5);
    [g('cSalutation')||'—', g('cStreet')||'', `${g('cPlz')} ${g('cCity')}`, g('cCountry')].forEach(line => { doc.text(line, M, y); y+=5; });

    y += 16;

    // ── Dokumenttitel ──
    doc.setFont('helvetica','bold'); doc.setFontSize(11);
    doc.setTextColor(aR, aG, aB);
    doc.text(`${docLabel} Nr. ${g('invNr')}`, M, y);
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(0,0,0);
    doc.text(fmtDate(g('invDate')), 100, y);

    // Meta (rechts)
    doc.setFont('helvetica','italic'); doc.setFontSize(8.5); doc.setTextColor(80,80,80);
    let my = y - 4;
    const metaItems = [
      [`${docLabel}-Nr. `, g('invNr')],
      [`Datum `, fmtDate(g('invDate'))],
      [`Lieferdatum `, fmtDate(g('invDelivery'))],
    ];
    if (f.kundennr) metaItems.push([`Ihre Kundennummer `, g('invKdNr')]);
    metaItems.push([`Ihr Ansprechpartner`, ''], ['', g('sContact')]);
    metaItems.forEach(([lbl, val]) => {
      doc.setFont('helvetica','italic'); doc.text(lbl, 190, my, {align:'right'});
      if (val) { doc.setFont('helvetica','bolditalic'); doc.text(val, 190, my+3.5, {align:'right'}); my += 7; }
      else { my += 4; }
    });
    doc.setTextColor(0,0,0);

    y += 12;
    doc.setFont('helvetica','normal'); doc.setFontSize(10);
    doc.text(g('cGreeting') ? g('cGreeting')+',' : 'Sehr geehrte Damen und Herren,', M, y);
    y += 6;

    const einlText = texte.einleitung
      ? texte.einleitung.replace(/\n/g,' ')
      : 'Vielen Dank für Ihren Auftrag. Für die ausgeführten Arbeiten stelle ich Ihnen folgende Summe in Rechnung.';
    doc.splitTextToSize(einlText, 120).forEach(l => { doc.text(l, M, y); y += 5; });

    // ── Tabellen-Header ──
    y += 4;
    doc.setDrawColor(thbR,thbG,thbB); doc.setLineWidth(0.4); doc.line(M, y, 190, y); y += 1;
    doc.setFont('helvetica','bold'); doc.setFontSize(9);
    doc.setTextColor(thR, thG, thB);
    doc.text('Beschreibung', M, y+5); doc.text('Menge', 120, y+5);
    doc.text('Einzelpreis', 148, y+5); doc.text('Gesamtpreis', 190, y+5, {align:'right'});
    y += 7; doc.setDrawColor(thbR,thbG,thbB); doc.setLineWidth(0.3); doc.line(M, y, 190, y);

    // ── Positionen ──
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(0,0,0);
    positions.forEach((p, i) => {
      const total = isNaN(parseFloat(p.qty)) ? p.price : parseFloat(p.qty)*p.price;
      y += 7;
      doc.text(`${i+1}.  ${p.desc||'—'}`, M, y);
      doc.text(p.qty||'—', 122, y);
      doc.text(`${fmt(p.price)} EUR`, 150, y);
      doc.text(`${fmt(total)} EUR`, 190, y, {align:'right'});
      if (f.trennlinien) { doc.setDrawColor(trbR,trbG,trbB); doc.setLineWidth(0.2); doc.line(M, y+2, 190, y+2); }
    });

    // ── Summen ──
    const pdfGroups  = getUstGroups();
    const pdfRates   = Object.keys(pdfGroups).map(Number).sort((a,b) => b-a);
    const pdfAllZero = pdfRates.every(r => r === 0);
    const brutto     = calcBrutto();

    y += 10;
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(0,0,0);
    doc.text('Gesamtbetrag netto', M, y); doc.text(`${fmt(netto)} EUR`, 190, y, {align:'right'});
    doc.setDrawColor(trbR,trbG,trbB); doc.setLineWidth(0.3); doc.line(M, y+2, 190, y+2);

    y += 8; doc.setFontSize(9); doc.setTextColor(100,100,100);
    if (pdfAllZero) {
      doc.text('Umsatzsteuer nicht erhoben gemäß §19 UStG.', M, y);
      if (f.ust19) { y += 5; doc.setFont('helvetica','italic'); doc.text('Gemäß § 19 Abs. 1 UStG wird keine Umsatzsteuer berechnet.', M, y); doc.setFont('helvetica','normal'); }
    } else {
      pdfRates.forEach(r => {
        if (r > 0) {
          doc.setTextColor(80,80,80);
          doc.text(`MwSt ${r} %`, M, y); doc.text(`${fmt(pdfGroups[r].tax)} EUR`, 190, y, {align:'right'});
          y += 6;
        } else if (pdfGroups[r].netto > 0) {
          doc.setFont('helvetica','italic'); doc.setTextColor(140,140,140);
          doc.text(`davon §19 befreit: ${fmt(pdfGroups[r].netto)} EUR`, M, y);
          doc.setFont('helvetica','normal');
          y += 6;
        }
      });
      y -= 2;
    }
    doc.setTextColor(aR,aG,aB); doc.setDrawColor(totR,totG,totB); doc.setLineWidth(0.3); doc.line(M, y+2, 190, y+2);

    y += 8; doc.setFont('helvetica','bold'); doc.setFontSize(11);
    doc.setTextColor(aR, aG, aB);
    doc.text('Gesamtbetrag brutto', M, y); doc.text(`${fmt(brutto)} EUR`, 190, y, {align:'right'});
    doc.setDrawColor(totR,totG,totB); doc.setLineWidth(0.5); doc.line(M, y+2, 190, y+2);
    doc.setTextColor(0,0,0);

    // ── Zahlungstext ──
    y += 10; doc.setFont('helvetica','normal'); doc.setFontSize(9.5);
    const dueSuffix = f.faellig && g('invDue')
      ? ` Der Rechnungsbetrag ist bis zum ${fmtDate(g('invDue'))} fällig.`
      : ` Zahlbar innerhalb von ${zahlungstage} Tagen ohne Abzug.`;
    const payText = (g('invPayment')||'').replace(/\n/g,' ') + dueSuffix;
    doc.splitTextToSize(payText, 120).forEach(l => { doc.text(l, M, y); y += 5; });

    // ── GiroCode ──
    if (f.girocode) {
      const qrDataURL = await getQRDataURL();
      if (qrDataURL) {
        const qrY = y + 4;
        doc.addImage(qrDataURL, 'PNG', M, qrY, 28, 28);
        doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(30,30,30);
        doc.text('Schnellüberweisung', M + 31, qrY + 5);
        doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(80,80,80);
        doc.text(`${g('sName')} · IBAN ${g('sIBAN')}`, M + 31, qrY + 10);
        doc.text(`Betrag: ${fmt(brutto)} EUR`, M + 31, qrY + 15);
        const qrRef = [`RE ${g('invNr')}`, g('invKdNr') ? `KD ${g('invKdNr')}` : '', g('invDue') ? `fällig ${fmtDate(g('invDue'))}` : ''].filter(Boolean).join(' · ');
        doc.text(qrRef, M + 31, qrY + 20);
        y = qrY + 33;
      } else { y += 5; }
    } else { y += 5; }

    // ── Schluss + Grußformel ──
    doc.setTextColor(0,0,0);
    if (texte.schluss) {
      doc.setFont('helvetica','normal'); doc.setFontSize(10);
      doc.splitTextToSize(texte.schluss.replace(/\n/g,' '), 120).forEach(l => { doc.text(l, M, y); y += 5; });
      y += 3;
    }
    doc.text('Mit freundlichen Grüßen', M, y); y += 5; doc.text(g('sContact'), M, y);

    if (texte.hinweise) {
      y += 10; doc.setFontSize(8); doc.setTextColor(100,100,100);
      doc.splitTextToSize(texte.hinweise.replace(/\n/g,' '), 150).forEach(l => { doc.text(l, M, y); y += 4.5; });
      doc.setTextColor(0,0,0);
    }

    // ── Fußzeile ──
    let fy = y - 30;
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(50,50,50);
    const footerLines = [];
    if (f.adresse) footerLines.push(g('sName'), g('sStreet'), `${g('sPlz')} ${g('sCity')}`, 'Deutschland', '');
    if (f.tel   && g('sTel'))   footerLines.push(`Tel. ${g('sTel')}`);
    if (f.email && g('sEmail')) footerLines.push(`E-Mail ${g('sEmail')}`);
    if (f.web   && g('sWeb'))   footerLines.push(`Web ${g('sWeb')}`);
    footerLines.push('');
    if (f.steuernr && g('sStNr')) footerLines.push(`Steuer-Nr. ${g('sStNr')}`);
    footerLines.push('Geschäftsführung', g('sContact'), '');
    if (f.bank && g('sIBAN')) footerLines.push(`Bank ${g('sBank')}`, `IBAN ${g('sIBAN')}`, `BIC ${g('sBIC')}`);
    footerLines.forEach(line => { doc.text(line || ' ', 190, fy, {align:'right'}); fy += 4.5; });

    doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor(170,170,170);
    doc.text('Seite 1 von 1', 190, 285, {align:'right'});

    doc.save(`${docLabel}-${g('invNr')}.pdf`);
    if (_xrIsEnabled()) {
      const xmlContent = buildXRechnungXML();
      _downloadXML(xmlContent);
      _saveXRechnung(g('invNr'), xmlContent);
      showToast(`PDF + XRechnung-${g('invNr')}.xml heruntergeladen`);
    } else {
      showToast(`PDF heruntergeladen`);
    }
    if (saveToList() === false) return;
    _wiederNachExport();
    clearDraft();
    setTimeout(() => showListe(), 400);
  }

  /* ═══ XRechnung (UBL 2.1 / EN 16931) ═══ */
  function buildXRechnungXML() {
    const netto = calcNetto();
    const nettoStr = netto.toFixed(2);
    const ibanClean = g('sIBAN').replace(/\s/g, '');
    const countryMap = { 'Deutschland':'DE','Österreich':'AT','Schweiz':'CH','Austria':'AT','Switzerland':'CH' };
    const buyerCountry = countryMap[g('cCountry')] || 'DE';

    function xe(s) {
      return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    const lineItems = positions.map((p, i) => {
      const isNum = !isNaN(parseFloat(p.qty)) && String(p.qty).trim() !== '';
      const qty = isNum ? parseFloat(p.qty) : 1;
      const unitCode = isNum ? 'C62' : 'ZZ';
      const lineTotal = (qty * p.price).toFixed(2);
      const ustRate = p.ust !== undefined ? Number(p.ust) : 0;
      const taxCatId = ustRate > 0 ? 'S' : 'E';
      const taxExempt = ustRate === 0 ? '\n        <cbc:TaxExemptionReason>Umsatzsteuer nicht erhoben gemäß §19 UStG</cbc:TaxExemptionReason>' : '';
      return `  <cac:InvoiceLine>
    <cbc:ID>${i+1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${unitCode}">${qty}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">${lineTotal}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>${xe(p.desc)}</cbc:Description>
      <cbc:Name>${xe(p.desc)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${taxCatId}</cbc:ID>
        <cbc:Percent>${ustRate}</cbc:Percent>${taxExempt}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">${p.price.toFixed(2)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
    }).join('\n');

    const buyerName = xe(g('cName') || g('cSalutation'));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
             xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
             xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${xe(g('invNr'))}</cbc:ID>
  <cbc:IssueDate>${g('invDate')}</cbc:IssueDate>
  ${g('invDue') ? `<cbc:DueDate>${g('invDue')}</cbc:DueDate>` : ''}
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${xe(g('invKdNr') || g('invNr'))}</cbc:BuyerReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${xe(g('sName'))}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${xe(g('sStreet'))}</cbc:StreetName>
        <cbc:CityName>${xe(g('sCity'))}</cbc:CityName>
        <cbc:PostalZone>${xe(g('sPlz'))}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${xe(g('sStNr'))}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${xe(g('sName'))}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:Name>${xe(g('sContact'))}</cbc:Name>
        <cbc:Telephone>${xe(g('sTel'))}</cbc:Telephone>
        <cbc:ElectronicMail>${xe(g('sEmail'))}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${buyerName}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${xe(g('cStreet'))}</cbc:StreetName>
        <cbc:CityName>${xe(g('cCity'))}</cbc:CityName>
        <cbc:PostalZone>${xe(g('cPlz'))}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>${buyerCountry}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${buyerName}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    ${g('invDue') ? `<cbc:PaymentDueDate>${g('invDue')}</cbc:PaymentDueDate>` : ''}
    <cac:PayeeFinancialAccount>
      <cbc:ID>${ibanClean}</cbc:ID>
      <cbc:Name>${xe(g('sName'))}</cbc:Name>
      <cac:FinancialInstitutionBranch>
        <cbc:ID>${xe(g('sBIC'))}</cbc:ID>
      </cac:FinancialInstitutionBranch>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  ${(() => {
      const xrGroups = getUstGroups();
      const xrRates  = Object.keys(xrGroups).map(Number);
      const totalTax = xrRates.reduce((s, r) => s + xrGroups[r].tax, 0).toFixed(2);
      const bruttoStr = calcBrutto().toFixed(2);
      const subtotals = xrRates.map(r => {
        const catId  = r > 0 ? 'S' : 'E';
        const exempt = r === 0 ? '\n        <cbc:TaxExemptionReason>Umsatzsteuer nicht erhoben gemäß §19 UStG</cbc:TaxExemptionReason>' : '';
        return `    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${xrGroups[r].netto.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${xrGroups[r].tax.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${catId}</cbc:ID>
        <cbc:Percent>${r}</cbc:Percent>${exempt}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`;
      }).join('\n');
      return `<cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${totalTax}</cbc:TaxAmount>
${subtotals}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${nettoStr}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${nettoStr}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${bruttoStr}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${bruttoStr}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>`;
    })()}
${lineItems}
</ubl:Invoice>`;

    return xml;
  }

  function _downloadXML(xml) {
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `XRechnung-${g('invNr')}.xml`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportXRechnung() { _downloadXML(buildXRechnungXML()); }

  function _saveXRechnung(nr, xml) {
    try {
      const store = JSON.parse(localStorage.getItem('max4work_xrechnungen') || '{}');
      store[nr] = xml;
      localStorage.setItem('max4work_xrechnungen', JSON.stringify(store));
    } catch(e) {}
  }

  function _loadXRechnung(nr) {
    try {
      return JSON.parse(localStorage.getItem('max4work_xrechnungen') || '{}')[nr] || null;
    } catch(e) { return null; }
  }

  function _downloadStoredXRechnung(nr) {
    const xml = _loadXRechnung(nr);
    if (!xml) return;
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `XRechnung-${nr}.xml`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ═══ DATEV-Buchungsstapel Export ═══ */
  function exportDatev() {
    const list = getRechnungen();
    if (!list.length) { showToast('Keine Rechnungen vorhanden.'); return; }
    const now = new Date();
    const year = now.getFullYear();
    const ts = _dvTs(now);
    const dates = list.map(r => r.datum).filter(Boolean).sort();
    const von = (dates[0] || year + '-01-01').replace(/-/g, '');
    const bis = (dates[dates.length - 1] || year + '-12-31').replace(/-/g, '');

    const vorlauf = [
      '"EXTF"', 700, 21, '"Buchungsstapel"', 13,
      ts, '', '"RE"', '"max4work"', '', '',
      '', '', year + '0101', 4, '', von, '', bis, '',
      '"Rechnungen ' + year + '"', '', 1, '', 0, '"EUR"'
    ].join(';');

    const colHead = 'Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;Kurs;Basis-Umsatz;WKZ Basis-Umsatz;Konto;Gegenkonto (ohne BU-Schlüssel);BU-Schlüssel;Belegdatum;Belegfeld 1;Belegfeld 2;Skonto;Buchungstext';

    const rows = list.map(r => {
      const betrag = parseFloat(r.betrag || 0).toFixed(2).replace('.', ',');
      const dat = _dvDate(r.datum);
      const nr = (r.nr || '').substring(0, 36).replace(/[";]/g, ' ');
      const text = (r.kunde || '').substring(0, 30).replace(/[";]/g, ' ');
      // §19 UStG Kleinunternehmer: Erlöse 8200 (Haben), Gegenkonto Forderungen 1400
      return `${betrag};H;EUR;;;;8200;1400;;${dat};"${nr}";;;"${text}"`;
    }).join('\r\n');

    const csv = vorlauf + '\r\n' + colHead + '\r\n' + rows;
    _dvDownload(`DATEV_Rechnungen_${year}.csv`, csv);
    showToast(`DATEV-Export: ${list.length} Buchung${list.length !== 1 ? 'en' : ''} exportiert`);
  }

  function _dvDate(iso) {
    if (!iso) return '';
    const [, m, d] = iso.split('-');
    return d + m; // TTMM (DATEV-Format)
  }

  function _dvTs(d) {
    return d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0') +
      String(d.getHours()).padStart(2, '0') +
      String(d.getMinutes()).padStart(2, '0') +
      String(d.getSeconds()).padStart(2, '0') + '000';
  }

  function _dvDownload(name, content) {
    const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function sendPerEmail() {
    const email = _findKundeEmail();
    const nr = g('invNr');
    const netto = calcNetto();
    const greeting = (g('cGreeting') || 'Sehr geehrte Damen und Herren') + ',';
    const dueStr = g('invDue') ? `Zahlungsziel: ${fmtDate(g('invDue'))}` : '';
    const ibanStr = g('sIBAN') ? `IBAN: ${g('sIBAN')}` + (g('sBIC') ? `  ·  BIC: ${g('sBIC')}` : '') : '';
    const bankStr = g('sBank') ? `Bank: ${g('sBank')}` : '';
    const nettoFmt = netto.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const body = [
      greeting,
      '',
      `anbei erhalten Sie die Rechnung ${nr} vom ${fmtDate(g('invDate'))} über ${nettoFmt} EUR.`,
      '',
      dueStr,
      ibanStr,
      bankStr,
      '',
      'Mit freundlichen Grüßen',
      g('sContact') || g('sName'),
      g('sName') !== g('sContact') ? g('sName') : '',
      g('sTel') ? `Tel: ${g('sTel')}` : '',
    ].filter(Boolean).join('\n');

    const subject = `Rechnung ${nr} – ${g('sName')}`;

    // E-Mail-Modal öffnen
    const toEl = document.getElementById('emTo');
    const subEl = document.getElementById('emSubject');
    const bodyEl = document.getElementById('emBody');
    if (toEl) toEl.value = email;
    if (subEl) subEl.value = subject;
    if (bodyEl) bodyEl.value = body;
    document.getElementById('emailOverlay').style.display = 'flex';
  }

  function closeEmailModal() {
    document.getElementById('emailOverlay').style.display = 'none';
  }

  function copyEmailBody() {
    const body = document.getElementById('emBody').value;
    const sub = document.getElementById('emSubject').value;
    const text = `Betreff: ${sub}\n\n${body}`;
    navigator.clipboard.writeText(text).then(() => {
      showToast('E-Mail-Text in Zwischenablage kopiert');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('E-Mail-Text kopiert');
    });
  }

  function openMailtoLink() {
    const to = document.getElementById('emTo').value;
    const sub = encodeURIComponent(document.getElementById('emSubject').value);
    const body = encodeURIComponent(document.getElementById('emBody').value);
    window.open(`mailto:${to}?subject=${sub}&body=${body}`, '_blank');
    closeEmailModal();
  }

  function _findKundeEmail() {
    try {
      const kunden = JSON.parse(localStorage.getItem('max4work_kunden') || '[]');
      const salutation = (g('cSalutation') || g('cName') || '').toLowerCase();
      if (!salutation) return '';
      const lastName = salutation.split(' ').filter(Boolean).slice(-1)[0] || '';
      const k = kunden.find(x => x.name && x.name.toLowerCase().includes(lastName));
      return (k && k.email) ? k.email : '';
    } catch(e) { return ''; }
  }

  function showToast(msg) {
    let t = document.getElementById('max4work-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'max4work-toast';
      t.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#1A1C18;color:#fff;font-size:13px;font-weight:500;padding:10px 22px;border-radius:24px;z-index:9999;transition:opacity .25s;pointer-events:none;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.25);';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; }, 3500);
  }

  /* ═══ Kunde Autocomplete ═══ */
  function kundeSearchInput(val) {
    const clearBtn = document.getElementById('kundeClearBtn');
    if (clearBtn) clearBtn.style.display = val ? 'flex' : 'none';
    if (!val || val.length < 1) { _kundeCloseDropdown(); return; }

    const kunden = _getKunden();
    const q = val.toLowerCase();
    const matches = kunden
      .filter(k => (k.name||'').toLowerCase().includes(q) || (k.ort||'').toLowerCase().includes(q))
      .slice(0, 8);

    const dd = document.getElementById('kundeDropdown');
    if (!dd) return;
    if (!matches.length) {
      dd.innerHTML = '<div class="kunde-dd-empty">Kein Treffer – Daten unten manuell eingeben</div>';
      dd.style.display = 'block';
      return;
    }
    dd.innerHTML = matches.map(k => {
      const addr = [k.strasse, k.ort].filter(Boolean).join(' · ');
      return `<div class="kunde-dd-item" onclick="kundeSelect(${k.id})">
        <div class="kunde-dd-name">${_escHtml(k.name)}</div>
        ${addr ? `<div class="kunde-dd-sub">${_escHtml(addr)}</div>` : ''}
      </div>`;
    }).join('');
    dd.style.display = 'block';
  }

  function kundeSelect(id) {
    const k = _getKunden().find(x => x.id === id);
    if (!k) return;

    const searchEl = document.getElementById('kundeSearch');
    const clearBtn = document.getElementById('kundeClearBtn');
    if (searchEl) searchEl.value = k.name;
    if (clearBtn) clearBtn.style.display = 'flex';
    _kundeCloseDropdown();

    // Ort in PLZ + Stadt aufteilen
    const ortParts = (k.ort || '').trim().split(/\s+/);
    const plz = /^\d{4,5}$/.test(ortParts[0]) ? ortParts.shift() : '';
    const city = ortParts.join(' ');

    document.getElementById('cName').value = k.name || '';
    document.getElementById('cSalutation').value = k.name || '';
    document.getElementById('cStreet').value = k.strasse || '';
    document.getElementById('cPlz').value = plz;
    document.getElementById('cCity').value = city;
    document.getElementById('cCountry').value = 'Deutschland';
    document.getElementById('cGreeting').value = '';
    if (k.id) document.getElementById('invKdNr').value = String(k.id).slice(-5);

    rp();
    assistDismissed = true;
    _assistCheckByName(k.name);
  }

  function kundeClear() {
    const searchEl = document.getElementById('kundeSearch');
    const clearBtn = document.getElementById('kundeClearBtn');
    if (searchEl) searchEl.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    _kundeCloseDropdown();
    ['cName','cSalutation','cStreet','cPlz','cCity','cGreeting'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const country = document.getElementById('cCountry');
    if (country) country.value = 'Deutschland';
    assistDismissed = false;
    assistHide();
    rp();
  }

  function _kundeCloseDropdown() {
    const dd = document.getElementById('kundeDropdown');
    if (dd) dd.style.display = 'none';
  }

  function _getKunden() {
    try { return JSON.parse(localStorage.getItem('max4work_kunden') || '[]'); } catch(e) { return []; }
  }

  function _escHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function _assistCheckByName(name) {
    if (!name) return;
    const list = getRechnungen();
    const lastName = name.toLowerCase().split(' ').filter(Boolean).slice(-1)[0] || '';
    const match = list.slice().reverse().find(r => (r.kunde||'').toLowerCase().includes(lastName));
    if (match) { assistMatch = match; assistDismissed = false; _assistShow(match); }
  }

  function toggleUnternehmen() {
    const section = document.getElementById('unternehmenSection');
    const chevron = document.getElementById('unternehmenChevron');
    if (!section) return;
    const isOpen = section.style.display !== 'none';
    section.style.display = isOpen ? 'none' : 'block';
    if (chevron) chevron.classList.toggle('open', !isOpen);
    try { localStorage.setItem('max4work_unternehmen_open', !isOpen ? '1' : '0'); } catch(e) {}
  }

  function toggleXRechnung() {
    const section = document.getElementById('xrechnungSection');
    const chevron = document.getElementById('xrechnungChevron');
    if (!section) return;
    const isOpen = section.style.display !== 'none';
    section.style.display = isOpen ? 'none' : 'block';
    if (chevron) chevron.classList.toggle('open', !isOpen);
    try { localStorage.setItem('max4work_xrechnung_open', !isOpen ? '1' : '0'); } catch(e) {}
  }

  function _xrIsEnabled() {
    const cb = document.getElementById('xrEnabled');
    return cb ? cb.checked : false;
  }

  function xrToggleChanged() {
    const enabled = _xrIsEnabled();
    const btn = document.getElementById('xmlBtn');
    if (btn) btn.style.display = enabled ? '' : 'none';
    saveDraft();
  }

  // Dropdown schließen bei Klick außerhalb
  document.addEventListener('click', e => {
    if (!e.target.closest('#kundeSearchWrap')) _kundeCloseDropdown();
  });

  /* ═══ Draft speichern/laden ═══ */
  const SAVE_KEY = 'max4work_rechnung_draft';

  function saveDraft() {
    try {
      const draft = {};
      ['sName','sStreet','sPlz','sCity','sTel','sEmail','sStNr','sContact',
       'sIBAN','sBIC','sBank','sWeb','invNr','invDate','invDelivery','invDue','invKdNr','invTyp',
       'cName','cSalutation','cStreet','cPlz','cCity','cCountry','cGreeting','invPayment'
      ].forEach(id => { draft[id] = g(id); });
      draft.positions = positions;
      draft.xrEnabled = _xrIsEnabled();
      localStorage.setItem(SAVE_KEY, JSON.stringify(draft));
    } catch(e) {}
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem('max4work_einstellungen');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch(e) { return null; }
  }

  function setDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('invDate').value = today;
    const del = new Date(); del.setDate(del.getDate()-1);
    document.getElementById('invDelivery').value = del.toISOString().split('T')[0];
    const due = new Date(); due.setDate(due.getDate()+7);
    document.getElementById('invDue').value = due.toISOString().split('T')[0];
  }

  function loadDraft() {
    // FIX: Zuerst gespeichertes Logo laden
    const savedLogo = loadLogo();  // shared.js
    if (savedLogo) {
      logoURL = savedLogo;
      showLogoPreview();
    }

    // Kunde aus sessionStorage (von Kundenseite weitergeleitet)
    const selectedKunde = sessionStorage.getItem('max4work_selected_kunde');
    if (selectedKunde) {
      const k = JSON.parse(selectedKunde);
      sessionStorage.removeItem('max4work_selected_kunde');
      document.getElementById('cSalutation').value = k.salutation || '';
      document.getElementById('cStreet').value = k.street || '';
      document.getElementById('cPlz').value = k.plz || '';
      document.getElementById('cCity').value = k.city || '';
      document.getElementById('cCountry').value = k.country || 'Deutschland';
      document.getElementById('cGreeting').value = k.greeting || '';
      document.getElementById('invKdNr').value = k.kdnr || '';
      if (k.leistung) positions = [{ desc: k.leistung, qty: 'pauschal', price: parseFloat(k.preis)||0 }];
      _kundeSearchSyncFromFields();
      _unternehmenRestoreState();
      // Unternehmensdaten aus Einstellungen
      const settings = loadSettings();
      if (settings) {
        ['sName','sStreet','sPlz','sCity','sTel','sEmail','sStNr','sContact','sIBAN','sBIC','sBank','sWeb','invPayment']
          .forEach(id => { const el = document.getElementById(id); if (el && settings[id]) el.value = settings[id]; });
      }
      setDates(); renderPos(); rp(); return;
    }

    // Draft laden
    let hasDraft = false;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        // Nur Rechnungs- und Kundendaten aus Draft – Absenderdaten kommen immer aus Einstellungen
        ['invNr','invDate','invDelivery','invDue','invKdNr','invTyp',
         'cSalutation','cStreet','cPlz','cCity','cCountry','cGreeting','invPayment'
        ].forEach(id => { if (d[id] !== undefined) { const el = document.getElementById(id); if(el) el.value = d[id]; } });
        if (d.positions && d.positions.length) positions = d.positions;
        if (d.xrEnabled !== undefined) {
          const cb = document.getElementById('xrEnabled');
          if (cb) cb.checked = !!d.xrEnabled;
          const btn = document.getElementById('xmlBtn');
          if (btn) btn.style.display = d.xrEnabled ? '' : 'none';
        }
        _kundeSearchSyncFromFields();
        hasDraft = true;
      }
    } catch(e) {}

    // Absenderdaten immer aus Einstellungen
    const settings = loadSettings();
    if (settings) {
      ['sName','sStreet','sPlz','sCity','sTel','sEmail','sStNr','sContact','sIBAN','sBIC','sBank','sWeb','invPayment']
        .forEach(id => { const el = document.getElementById(id); if (el && settings[id]) el.value = settings[id]; });
    }
    _unternehmenRestoreState();
    if (!hasDraft) setDates();
    renderPos(); rp();
  }

  function _kundeSearchSyncFromFields() {
    const name = (document.getElementById('cName') || {}).value || (document.getElementById('cSalutation') || {}).value || '';
    const searchEl = document.getElementById('kundeSearch');
    const clearBtn = document.getElementById('kundeClearBtn');
    if (searchEl && name) {
      searchEl.value = name;
      if (clearBtn) clearBtn.style.display = 'flex';
    }
  }

  function _unternehmenRestoreState() {
    try {
      const isOpen = localStorage.getItem('max4work_unternehmen_open') === '1';
      const section = document.getElementById('unternehmenSection');
      const chevron = document.getElementById('unternehmenChevron');
      if (section) section.style.display = isOpen ? 'block' : 'none';
      if (chevron) chevron.classList.toggle('open', isOpen);
    } catch(e) {}
    try {
      const xrOpen = localStorage.getItem('max4work_xrechnung_open') === '1';
      const xrSection = document.getElementById('xrechnungSection');
      const xrChevron = document.getElementById('xrechnungChevron');
      if (xrSection) xrSection.style.display = xrOpen ? 'block' : 'none';
      if (xrChevron) xrChevron.classList.toggle('open', xrOpen);
    } catch(e) {}
  }

  function clearDraft() { try { localStorage.removeItem(SAVE_KEY); } catch(e) {} }

  /* ═══ Entwürfe parken ═══ */
  const PARKEN_KEY = 'max4work_rechnung_parken';

  function _getGeparkte() {
    try { return JSON.parse(localStorage.getItem(PARKEN_KEY)) || []; } catch(e) { return []; }
  }
  function _saveGeparkte(list) {
    try { localStorage.setItem(PARKEN_KEY, JSON.stringify(list)); } catch(e) {}
  }

  function _updateParkenBtn() {
    const btn = document.getElementById('entwuerfeBtn');
    const cnt = document.getElementById('entwuerfeCount');
    if (!btn) return;
    const list = _getGeparkte();
    if (list.length) {
      btn.style.display = '';
      if (cnt) cnt.textContent = `(${list.length})`;
    } else {
      btn.style.display = 'none';
    }
  }

  function parkRechnung() {
    const nr = g('invNr') || '—';
    const kunde = g('cName') || g('cSalutation') || '—';
    const betrag = calcNetto();
    const draft = {};
    ['sName','sStreet','sPlz','sCity','sTel','sEmail','sStNr','sContact',
     'sIBAN','sBIC','sBank','sWeb','invNr','invDate','invDelivery','invDue','invKdNr','invTyp',
     'cName','cSalutation','cStreet','cPlz','cCity','cCountry','cGreeting','invPayment'
    ].forEach(id => { draft[id] = g(id); });
    draft.positions = positions.map(p => ({...p}));
    draft.xrEnabled = _xrIsEnabled();

    const list = _getGeparkte();
    const existingIdx = list.findIndex(e => e.nr === nr);
    const entry = { id: existingIdx >= 0 ? list[existingIdx].id : Date.now(), nr, kunde, betrag, gespeichertAm: new Date().toISOString(), draft };
    if (existingIdx >= 0) list[existingIdx] = entry; else list.push(entry);
    _saveGeparkte(list);
    _updateParkenBtn();

    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:var(--green);color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:500;z-index:9999;pointer-events:none;';
    t.textContent = `💾 Entwurf "${nr}" geparkt`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  function openParkenModal() {
    renderParkenList();
    document.getElementById('parkOverlay').classList.add('open');
  }

  function closeParkenModal() {
    document.getElementById('parkOverlay').classList.remove('open');
  }

  function renderParkenList() {
    const list = _getGeparkte();
    const body = document.getElementById('parkList');
    if (!body) return;
    if (!list.length) {
      body.innerHTML = '<div class="park-empty">Keine geparkten Entwürfe vorhanden</div>';
      return;
    }
    body.innerHTML = list.map(e => {
      const datum = e.gespeichertAm ? new Date(e.gespeichertAm).toLocaleDateString('de-DE') : '—';
      const betrag = typeof e.betrag === 'number' ? `${fmt(e.betrag)} €` : '—';
      return `<div class="park-item">
        <div class="park-item-info">
          <span class="park-item-nr">${e.nr || '—'}</span>
          <span class="park-item-kunde">${e.kunde || '—'}</span>
          <span class="park-item-meta">${betrag} · ${datum}</span>
        </div>
        <div class="park-item-actions">
          <button class="btn btn-blue" onclick="ladeGeparkte(${e.id})">Laden</button>
          <button class="btn btn-ghost park-del-btn" onclick="loescheGeparkte(${e.id})" title="Entwurf löschen">✕</button>
        </div>
      </div>`;
    }).join('');
  }

  function ladeGeparkte(id) {
    const entry = _getGeparkte().find(e => e.id === id);
    if (!entry || !entry.draft) return;
    closeParkenModal();

    document.getElementById('listeView').style.display = 'none';
    document.getElementById('formView').style.display = 'block';
    document.getElementById('topbarActionsListe').style.display = 'none';
    document.getElementById('topbarActionsForm').style.display = 'flex';
    const _tL2 = document.getElementById('topbarLeft'); if (_tL2) _tL2.style.display = '';
    document.getElementById('topbarTitle').textContent = 'Neue Rechnung';

    const d = entry.draft;
    ['invNr','invDate','invDelivery','invDue','invKdNr','invTyp',
     'cSalutation','cStreet','cPlz','cCity','cCountry','cGreeting','invPayment'
    ].forEach(fid => { if (d[fid] !== undefined) { const el = document.getElementById(fid); if (el) el.value = d[fid]; } });
    if (d.positions && d.positions.length) positions = d.positions.map(p => ({...p}));
    if (d.xrEnabled !== undefined) {
      const cb = document.getElementById('xrEnabled');
      if (cb) cb.checked = !!d.xrEnabled;
      const xmlBtn = document.getElementById('xmlBtn');
      if (xmlBtn) xmlBtn.style.display = d.xrEnabled ? '' : 'none';
    }
    _kundeSearchSyncFromFields();

    const settings = loadSettings();
    if (settings) {
      ['sName','sStreet','sPlz','sCity','sTel','sEmail','sStNr','sContact','sIBAN','sBIC','sBank','sWeb','invPayment']
        .forEach(fid => { const el = document.getElementById(fid); if (el && settings[fid]) el.value = settings[fid]; });
    }
    _unternehmenRestoreState();
    renderPos(); rp();
  }

  function loescheGeparkte(id) {
    _saveGeparkte(_getGeparkte().filter(e => e.id !== id));
    renderParkenList();
    _updateParkenBtn();
  }

  /* ═══ Jahresabschluss ═══ */
  function openJahresabschluss() {
    const list = getRechnungen();
    const years = [...new Set(list.map(r => r.datum?.slice(0,4)).filter(Boolean))].sort().reverse();
    const curYear = new Date().getFullYear().toString();
    if (!years.includes(curYear)) years.unshift(curYear);
    const sel = document.getElementById('jaYear');
    sel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    sel.value = curYear;
    document.getElementById('jaOverlay').classList.add('open');
    renderJahresabschluss();
  }

  function closeJahresabschluss() {
    document.getElementById('jaOverlay').classList.remove('open');
  }

  function jaOverlayClick(e) {
    if (e.target === document.getElementById('jaOverlay')) closeJahresabschluss();
  }

  function _getKundenKm() {
    try {
      const k = JSON.parse(localStorage.getItem('max4work_kunden') || '[]');
      const map = {};
      k.forEach(x => { if (x.name) map[x.name.toLowerCase()] = parseFloat(x.km) || 0; });
      return map;
    } catch(e) { return {}; }
  }

  function _kmForKunde(kundenMap, kundeName) {
    if (!kundeName) return 0;
    const key = kundeName.toLowerCase();
    if (kundenMap[key] !== undefined) return kundenMap[key];
    // Partielle Übereinstimmung
    const found = Object.keys(kundenMap).find(k => k.includes(key) || key.includes(k));
    return found ? kundenMap[found] : 0;
  }

  function renderJahresabschluss() {
    const year = document.getElementById('jaYear').value;
    const list = getRechnungen().filter(r => r.status === 'bezahlt' && r.datum?.startsWith(year));
    const body = document.getElementById('jaBody');
    const fmtD = v => { if (!v) return '—'; const [y,m,d] = v.split('-'); return `${d}.${m}.${y}`; };
    const fmtB = n => parseFloat(n||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
    const fmtKm = n => n > 0 ? n.toLocaleString('de-DE',{maximumFractionDigits:1})+' km' : '–';

    if (!list.length) {
      body.innerHTML = `<div class="ja-empty"><p>Keine bezahlten Rechnungen in ${year}</p>Sobald Rechnungen als „Bezahlt" markiert sind, erscheinen sie hier.</div>`;
      return;
    }

    const kundenMap = _getKundenKm();
    const total = list.reduce((s,r) => s+parseFloat(r.betrag||0), 0);
    const anzahl = list.length;
    const kundenAnz = [...new Set(list.map(r => r.kunde))].length;
    const sorted = [...list].sort((a,b) => (a.datum||'').localeCompare(b.datum||''));

    // Gesamt-km berechnen (Hin + Rück = km × 2 pro Rechnung)
    let totalKm = 0;
    const rows = sorted.map(r => {
      const km = _kmForKunde(kundenMap, r.kunde);
      const kmRound = km * 2;
      totalKm += kmRound;
      return { r, km, kmRound };
    });

    const hasKm = totalKm > 0;

    // Zusammenfassung pro Kunde
    const perKunde = {};
    rows.forEach(({r, kmRound}) => {
      if (!perKunde[r.kunde]) perKunde[r.kunde] = { name: r.kunde, anzahl: 0, km: 0, betrag: 0 };
      perKunde[r.kunde].anzahl++;
      perKunde[r.kunde].km += kmRound;
      perKunde[r.kunde].betrag += parseFloat(r.betrag || 0);
    });
    const kundenListe = Object.values(perKunde).sort((a,b) => b.betrag - a.betrag);

    body.innerHTML = `
      <div class="ja-summary" style="grid-template-columns:repeat(${hasKm?4:3},1fr)">
        <div class="ja-kpi"><div class="ja-kpi-label">Rechnungen</div><div class="ja-kpi-value">${anzahl}</div></div>
        <div class="ja-kpi"><div class="ja-kpi-label">Kunden</div><div class="ja-kpi-value">${kundenAnz}</div></div>
        <div class="ja-kpi"><div class="ja-kpi-label">Gesamtumsatz</div><div class="ja-kpi-value green">${fmtB(total)}</div></div>
        ${hasKm ? `<div class="ja-kpi"><div class="ja-kpi-label">Gesamtkilometer</div><div class="ja-kpi-value">${fmtKm(totalKm)}</div></div>` : ''}
      </div>

      <!-- Zusammenfassung pro Kunde -->
      <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">Zusammenfassung pro Kunde</div>
      <table class="ja-table" style="margin-bottom:28px;">
        <thead><tr>
          <th>Kunde</th>
          <th style="text-align:center">Einsätze</th>
          ${hasKm ? '<th style="text-align:right">Kilometer gesamt</th>' : ''}
          <th style="text-align:right">Umsatz gesamt</th>
        </tr></thead>
        <tbody>
          ${kundenListe.map(k => `<tr>
            <td style="font-weight:500">${k.name}</td>
            <td style="text-align:center;color:var(--muted)">${k.anzahl}×</td>
            ${hasKm ? `<td style="text-align:right;color:var(--muted)">${k.km>0?fmtKm(k.km):'–'}</td>` : ''}
            <td style="text-align:right">${fmtB(k.betrag)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr class="ja-total-row">
            <td>Gesamt</td>
            <td style="text-align:center">${anzahl}×</td>
            ${hasKm ? `<td style="text-align:right">${fmtKm(totalKm)}</td>` : ''}
            <td style="text-align:right">${fmtB(total)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Einzelaufstellung -->
      <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">Einzelaufstellung</div>
      <table class="ja-table">
        <thead><tr>
          <th>Nr.</th><th>Kunde</th><th>Datum</th><th>Fällig</th>
          ${hasKm ? '<th style="text-align:right">Hin+Rück</th>' : ''}
          <th style="text-align:right">Betrag</th>
        </tr></thead>
        <tbody>
          ${rows.map(({r,km,kmRound}) => `<tr>
            <td style="color:var(--muted);font-size:12px;">${r.nr}</td>
            <td style="font-weight:500;">${r.kunde}</td>
            <td>${fmtD(r.datum)}</td>
            <td style="color:var(--muted);">${fmtD(r.faellig)}</td>
            ${hasKm ? `<td style="text-align:right;color:var(--muted);font-size:12px;">${km>0?fmtKm(kmRound):'–'}</td>` : ''}
            <td style="text-align:right">${fmtB(r.betrag)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      ${!hasKm ? `<div style="font-size:12px;color:var(--muted);margin-top:12px;text-align:center;">Tipp: Trage bei deinen Kunden die Entfernung ein, um die Kilometer automatisch zu berechnen.</div>` : ''}`;
  }

  function druckeJahresabschluss() {
    const year = document.getElementById('jaYear').value;
    const list = getRechnungen().filter(r => r.status === 'bezahlt' && r.datum?.startsWith(year));
    const fmtD = v => { if (!v) return '—'; const [y,m,d] = v.split('-'); return `${d}.${m}.${y}`; };
    const fmtB = n => parseFloat(n||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
    const fmtKm = n => n > 0 ? n.toLocaleString('de-DE',{maximumFractionDigits:1})+' km' : '–';
    const sorted = [...list].sort((a,b) => (a.datum||'').localeCompare(b.datum||''));
    const total = list.reduce((s,r) => s+parseFloat(r.betrag||0), 0);
    const kundenMap = _getKundenKm();
    let totalKm = 0;
    const rows = sorted.map((r,i) => {
      const km = _kmForKunde(kundenMap, r.kunde);
      const kmRound = km * 2;
      totalKm += kmRound;
      return { r, km, kmRound, i };
    });
    const hasKm = totalKm > 0;

    // Zusammenfassung pro Kunde (Druck)
    const perKunde = {};
    rows.forEach(({r, kmRound}) => {
      if (!perKunde[r.kunde]) perKunde[r.kunde] = { name: r.kunde, anzahl: 0, km: 0, betrag: 0 };
      perKunde[r.kunde].anzahl++;
      perKunde[r.kunde].km += kmRound;
      perKunde[r.kunde].betrag += parseFloat(r.betrag || 0);
    });
    const kundenListe = Object.values(perKunde).sort((a,b) => b.betrag - a.betrag);

    let firma = '', adresse = '', steuernr = '';
    try {
      const s = JSON.parse(localStorage.getItem('max4work_einstellungen')||'{}');
      firma = s.sName||''; adresse = [s.sStreet, s.sPlz+' '+s.sCity].filter(Boolean).join(', ');
      steuernr = s.sStNr||'';
    } catch(e) {}
    const heute = new Date().toLocaleDateString('de-DE');

    document.getElementById('jaPrintArea').innerHTML = `
      <div class="print-header">
        <div>
          <div class="print-title">Jahresabschluss ${year}</div>
          <div class="print-sub">Bezahlte Rechnungen · ${list.length} Einträge · ${kundenListe.length} Kunden${hasKm ? ` · ${fmtKm(totalKm)} gefahren` : ''}</div>
        </div>
        <div class="print-meta">
          ${firma ? `<strong>${firma}</strong><br>` : ''}
          ${adresse ? adresse+'<br>' : ''}
          ${steuernr ? 'Steuer-Nr.: '+steuernr+'<br>' : ''}
          Erstellt am ${heute}
        </div>
      </div>

      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#555;margin:0 0 6px;">Zusammenfassung pro Kunde</div>
      <table>
        <thead><tr>
          <th>Kunde</th>
          <th style="text-align:center">Einsätze</th>
          ${hasKm ? '<th style="text-align:right">Kilometer</th>' : ''}
          <th style="text-align:right">Umsatz</th>
        </tr></thead>
        <tbody>
          ${kundenListe.map((k,i) => `<tr style="background:${i%2===0?'#fafafa':'#fff'}">
            <td style="font-weight:600">${k.name}</td>
            <td style="text-align:center">${k.anzahl}×</td>
            ${hasKm ? `<td style="text-align:right;color:#666">${k.km>0?fmtKm(k.km):'–'}</td>` : ''}
            <td style="text-align:right;font-weight:600">${fmtB(k.betrag)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr class="print-total">
          <td><strong>Gesamt</strong></td>
          <td style="text-align:center"><strong>${list.length}×</strong></td>
          ${hasKm ? `<td style="text-align:right"><strong>${fmtKm(totalKm)}</strong></td>` : ''}
          <td style="text-align:right"><strong>${fmtB(total)}</strong></td>
        </tr></tfoot>
      </table>

      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#555;margin:18px 0 6px;">Einzelaufstellung</div>
      <table>
        <thead><tr>
          <th>Nr.</th><th>Kunde</th><th>Rechnungsdatum</th><th>Fälligkeitsdatum</th>
          ${hasKm ? '<th style="text-align:right">Hin+Rück</th>' : ''}
          <th style="text-align:right">Betrag</th>
        </tr></thead>
        <tbody>
          ${rows.map(({r,km,kmRound,i}) => `<tr style="background:${i%2===0?'#fafafa':'#fff'}">
            <td>${r.nr}</td><td>${r.kunde}</td><td>${fmtD(r.datum)}</td><td>${fmtD(r.faellig)}</td>
            ${hasKm ? `<td style="text-align:right;color:#888;">${km>0?fmtKm(kmRound):'–'}</td>` : ''}
            <td style="text-align:right;font-weight:600;">${fmtB(r.betrag)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="print-footer">max4work · Jahresabschluss ${year} · Erstellt am ${heute}</div>`;

    document.getElementById('jaPrintArea').style.display = 'block';
    window.print();
    document.getElementById('jaPrintArea').style.display = 'none';
  }

  function applyLivePreview() {
    const on = _isFeatureOn('livePreview');
    const panel = document.querySelector('.preview-panel');
    const content = document.querySelector('.content');
    if (!panel || !content) return;
    panel.style.display = on ? '' : 'none';
    content.style.gridTemplateColumns = on ? '400px 595px' : '400px';
  }

  function applyDatevVisibility() {
    const on = _isFeatureOn('datevSchnittstelle');
    const btn = document.getElementById('datevBtnRechnungen');
    if (btn) btn.style.display = on ? '' : 'none';
  }

  // Blatt-Design live synchronisieren wenn in einem anderen Tab gespeichert wird
  window.addEventListener('storage', e => {
    if (e.key === 'max4work_rechnung_config') rp();
    if (e.key === 'max4work_features') { applyLivePreview(); applyDatevVisibility(); }
  });

  /* ═══ Mahnwesen ═══ */

  const MAHN_KEY = 'max4work_mahn_config';
  const MAHN_DEFAULTS = {
    stufe1: { bezeichnung: 'Zahlungserinnerung', tage: 7,  gebuehr: 0,  text: 'Wir erlauben uns, Sie freundlich auf den noch offenen Rechnungsbetrag hinzuweisen. Möglicherweise haben Sie die Zahlung übersehen. Bitte überweisen Sie den ausstehenden Betrag innerhalb der angegebenen Frist auf das unten genannte Konto.' },
    stufe2: { bezeichnung: '1. Mahnung',         tage: 7,  gebuehr: 5,  text: 'Trotz unserer Zahlungserinnerung haben wir bis heute noch keinen Zahlungseingang für die unten genannte Rechnung verzeichnen können. Wir bitten Sie dringend, den offenen Betrag zuzüglich der Mahngebühr innerhalb der gesetzten Frist zu begleichen.' },
    stufe3: { bezeichnung: '2. Mahnung',         tage: 14, gebuehr: 10, text: 'Dies ist unsere letzte Mahnung. Da die bisherigen Zahlungsaufforderungen ohne Wirkung geblieben sind, fordern wir Sie ein letztes Mal auf, den fälligen Betrag zu überweisen. Bei Nichtzahlung sind wir gezwungen, rechtliche Schritte einzuleiten.' }
  };

  function _mahnGetConfig() {
    try { return JSON.parse(localStorage.getItem(MAHN_KEY) || 'null') || MAHN_DEFAULTS; } catch(e) { return MAHN_DEFAULTS; }
  }

  let _mahnCurrentId = null;

  function openMahnModal(id) {
    _mahnCurrentId = id;
    const r   = getRechnungen().find(x => x.id === id);
    if (!r) return;
    const cfg = _mahnGetConfig();
    const fmtD = v => { if (!v) return '—'; const [y,m,d] = v.split('-'); return `${d}.${m}.${y}`; };
    const fmtB = n => parseFloat(n||0).toLocaleString('de-DE', {style:'currency', currency:'EUR'});

    // Auto-Stufe ermitteln: zähle bisherige Mahnungen für diese Rechnung
    const all = getRechnungen();
    const prevMahnungen = all.filter(x => x.rechNr === r.nr && x.typ === 'mahnung').length;
    const autoStufe = Math.min(prevMahnungen + 1, 3);
    const stufeKey  = `stufe${autoStufe}`;
    const s         = cfg[stufeKey];

    const frist = new Date(); frist.setDate(frist.getDate() + s.tage);
    const fristStr = frist.toISOString().split('T')[0];

    document.getElementById('mahnModalBody').innerHTML = `
      <div class="mahn-inv-box">
        <div class="mahn-inv-nr">Rechnung ${r.nr}</div>
        <div class="mahn-inv-meta">${r.kunde} · ${fmtD(r.datum)} · Fällig: ${fmtD(r.faellig)}</div>
      </div>

      <div class="mahn-section">Mahnstufe</div>
      <div class="field-row" style="gap:10px;margin-bottom:14px;">
        <div class="field" style="flex:1;margin:0;"><label style="font-size:11px;">Stufe</label>
          <select id="mahnStufe" onchange="_mahnStufeChange()">
            <option value="stufe1"${autoStufe===1?' selected':''}>Stufe 1 – ${cfg.stufe1.bezeichnung}</option>
            <option value="stufe2"${autoStufe===2?' selected':''}>Stufe 2 – ${cfg.stufe2.bezeichnung}</option>
            <option value="stufe3"${autoStufe===3?' selected':''}>Stufe 3 – ${cfg.stufe3.bezeichnung}</option>
          </select>
        </div>
        <div class="field" style="flex:1;margin:0;"><label style="font-size:11px;">Zahlungsfrist</label>
          <input type="date" id="mahnFrist" value="${fristStr}">
        </div>
      </div>

      <div class="mahn-section">Beträge</div>
      <div style="background:var(--soft);border-radius:8px;padding:10px 14px;margin-bottom:14px;">
        <div class="mahn-total-row"><span>Originalrechnung ${r.nr}</span><span>${fmtB(r.betrag)}</span></div>
        <div class="mahn-total-row"><span>Mahngebühr</span><span><input id="mahnGebuehr" type="number" min="0" step="0.50" value="${s.gebuehr}" style="width:70px;text-align:right;border:1px solid var(--border);border-radius:5px;padding:2px 6px;background:var(--bg);color:var(--text);font-size:12px;"> €</span></div>
        <div class="mahn-total-row bold" id="mahnTotal"><span>Gesamtbetrag</span><span>${fmtB(r.betrag + s.gebuehr)}</span></div>
      </div>

      <div class="mahn-section">Mahntext</div>
      <div class="field" style="margin:0;">
        <textarea id="mahnText" rows="4" style="font-size:12px;width:100%;">${s.text}</textarea>
      </div>`;

    document.getElementById('mahnOverlay').classList.add('open');

    // Live-Update Gesamtbetrag
    document.getElementById('mahnGebuehr').addEventListener('input', () => {
      const total = parseFloat(r.betrag||0) + (parseFloat(document.getElementById('mahnGebuehr').value)||0);
      document.getElementById('mahnTotal').innerHTML = `<span>Gesamtbetrag</span><span>${fmtB(total)}</span>`;
    });
  }

  function _mahnStufeChange() {
    const stufeKey = document.getElementById('mahnStufe')?.value;
    const cfg = _mahnGetConfig();
    const s = cfg[stufeKey];
    if (!s) return;
    const ta = document.getElementById('mahnText');
    const gb = document.getElementById('mahnGebuehr');
    if (ta) ta.value = s.text;
    if (gb) gb.value = s.gebuehr;
    const frist = new Date(); frist.setDate(frist.getDate() + s.tage);
    const fi = document.getElementById('mahnFrist');
    if (fi) fi.value = frist.toISOString().split('T')[0];
    const r = getRechnungen().find(x => x.id === _mahnCurrentId);
    if (r) {
      const total = parseFloat(r.betrag||0) + parseFloat(s.gebuehr||0);
      const fmtB = n => n.toLocaleString('de-DE', {style:'currency', currency:'EUR'});
      const el = document.getElementById('mahnTotal');
      if (el) el.innerHTML = `<span>Gesamtbetrag</span><span>${fmtB(total)}</span>`;
    }
  }

  function closeMahnModal()      { document.getElementById('mahnOverlay').classList.remove('open'); _mahnCurrentId = null; }
  function mahnOverlayClick(e)   { if (e.target === document.getElementById('mahnOverlay')) closeMahnModal(); }

  async function _exportMahnungPDF() {
    const r = getRechnungen().find(x => x.id === _mahnCurrentId);
    if (!r) return;

    const { jsPDF } = window.jspdf;
    const doc  = new jsPDF({ unit: 'mm', format: 'a4' });
    const M    = 20; let y = 18;
    const cfg  = _mahnGetConfig();
    const stufeKey = document.getElementById('mahnStufe')?.value || 'stufe1';
    const s    = cfg[stufeKey];
    const bez  = document.getElementById('mahnStufe')?.selectedOptions[0]?.text?.split('–')[1]?.trim() || s.bezeichnung;
    const text = document.getElementById('mahnText')?.value || s.text;
    const gebuehr = parseFloat(document.getElementById('mahnGebuehr')?.value || s.gebuehr) || 0;
    const frist = document.getElementById('mahnFrist')?.value || '';
    const total = parseFloat(r.betrag||0) + gebuehr;

    const sets  = (() => { try { return JSON.parse(localStorage.getItem('max4work_einstellungen')||'{}'); } catch(e){return{};} })();
    const sName = sets.sName || '';
    const fmtD  = v => { if (!v) return '—'; const [yr,mo,dy] = v.split('-'); return `${dy}.${mo}.${yr}`; };
    const fmt2  = n => n.toFixed(2).replace('.', ',');

    // Logo
    const logo = typeof loadLogo === 'function' ? loadLogo() : localStorage.getItem('max4work_logo');
    if (logo) { try { doc.addImage(logo, 'PNG', 150, y, 40, 16); } catch(e) {} }
    if (sName) { doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(50,50,50); if (!logo) doc.text(sName, 190, y+9, {align:'right'}); }

    y += 24;
    // Absender-Zeile
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(139,96,64);
    doc.text(`${sName}  ○  ${sets.strasse||''}  ○  ${sets.plz||''} ${sets.ort||''}`, M, y);
    doc.setTextColor(0,0,0); y += 10;

    // Empfänger
    doc.setFont('helvetica','normal'); doc.setFontSize(10.5);
    [r.kunde, ''].forEach(l => { doc.text(l, M, y); y += 5; });
    y += 10;

    // Titel
    doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(180,30,30);
    doc.text(bez.toUpperCase(), M, y);
    doc.setTextColor(0,0,0); doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text(new Date().toLocaleDateString('de-DE'), 190, y, {align:'right'});
    y += 10;

    // Rechnungsreferenz
    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text(`Bezug: Rechnung ${r.nr} vom ${fmtD(r.datum)}`, M, y); y += 7;
    doc.setFont('helvetica','normal');
    doc.text('Anrede,', M, y); y += 6;
    doc.splitTextToSize(text, 165).forEach(l => { doc.text(l, M, y); y += 5; });
    y += 4;

    // Betragsübersicht
    doc.setDrawColor(200); doc.line(M, y, 190, y); y += 1;
    doc.setFont('helvetica','normal'); doc.setFontSize(10);
    doc.text(`Ursprünglicher Rechnungsbetrag (${r.nr})`, M, y+5);
    doc.text(`${fmt2(parseFloat(r.betrag||0))} EUR`, 190, y+5, {align:'right'});
    y += 7; doc.setDrawColor(220); doc.line(M, y, 190, y);
    if (gebuehr > 0) {
      y += 1;
      doc.text('Mahngebühr', M, y+5);
      doc.text(`${fmt2(gebuehr)} EUR`, 190, y+5, {align:'right'});
      y += 7; doc.line(M, y, 190, y);
    }
    y += 2; doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setDrawColor(0);
    doc.line(M, y, 190, y); y += 1;
    doc.text('Zu zahlender Gesamtbetrag', M, y+6);
    doc.text(`${fmt2(total)} EUR`, 190, y+6, {align:'right'});
    doc.line(M, y+8, 190, y+8); y += 14;

    if (frist) {
      doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(180,30,30);
      doc.text(`Zahlungsfrist: ${fmtD(frist)}`, M, y); doc.setTextColor(0,0,0); y += 8;
    }

    // Bankdaten
    doc.setFont('helvetica','normal'); doc.setFontSize(9.5);
    if (sets.iban) { doc.text(`IBAN: ${sets.iban}`, M, y); y += 5; }
    if (sets.bic)  { doc.text(`BIC: ${sets.bic}`, M, y); y += 5; }
    if (sets.bank) { doc.text(`Bank: ${sets.bank}`, M, y); y += 5; }
    y += 4;
    doc.text('Mit freundlichen Grüßen', M, y); y += 5;
    doc.text(sets.sName || '', M, y);

    const mahnNr = `MA-${r.nr}`;
    doc.save(`Mahnung-${r.nr}.pdf`);

    // Als Mahnung-Eintrag in Rechnungen speichern
    const list = getRechnungen();
    const mahnEntry = {
      id: Date.now(),
      nr: mahnNr,
      kunde: r.kunde,
      betrag: total,
      datum: new Date().toISOString().split('T')[0],
      faellig: frist,
      status: 'offen',
      typ: 'mahnung',
      rechNr: r.nr,
      stufe: parseInt(stufeKey.replace('stufe','')),
      locked: true,
      lockedAt: new Date().toISOString(),
      kundentyp: r.kundentyp || ''
    };
    list.push(mahnEntry);
    saveRechnungen(list);
    _gobdLog('mahnung-erstellt', { nr: mahnNr, rechNr: r.nr, kunde: r.kunde, stufe: mahnEntry.stufe });

    showToast(`Mahnung ${mahnNr} als PDF heruntergeladen`);
    closeMahnModal();
    renderListe();
  }

  /* ═══ Wiederkehrende Rechnungen ═══ */

  const WIEDER_KEY = 'max4work_wiederkehrend';
  let _wiederVorlageId = null;
  let _wiederEditId    = null;
  let _wiederPos       = [{ desc: '', qty: '1', price: 0 }];

  function _wiederGetAll()      { try { return JSON.parse(localStorage.getItem(WIEDER_KEY) || '[]'); } catch(e) { return []; } }
  function _wiederSaveAll(list) { try { localStorage.setItem(WIEDER_KEY, JSON.stringify(list)); } catch(e) {} }

  function _wiederNextDate(from, intervall) {
    const d = new Date(from + 'T00:00:00');
    if (intervall === 'monatlich')      d.setMonth(d.getMonth() + 1);
    else if (intervall === 'quartalsweise') d.setMonth(d.getMonth() + 3);
    else if (intervall === 'halbjährlich')  d.setMonth(d.getMonth() + 6);
    else if (intervall === 'jährlich')   d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  }

  function _wiederFmtIntervall(v) {
    return { monatlich:'Monatlich', quartalsweise:'Quartalsweise', halbjährlich:'Halbjährlich', jährlich:'Jährlich' }[v] || v;
  }

  function _wiederCheckFaellig() {
    const heute  = new Date().toISOString().split('T')[0];
    const liste  = _wiederGetAll().filter(t => t.aktiv && t.naechste <= heute);
    const banner = document.getElementById('wiederBanner');
    if (!banner || !liste.length) { if (banner) banner.style.display = 'none'; return; }

    const dismissed = JSON.parse(sessionStorage.getItem('wieder_dismissed') || '[]');
    const pending   = liste.filter(t => !dismissed.includes(t.id));
    if (!pending.length) { banner.style.display = 'none'; return; }

    const t    = pending[0];
    const rest = pending.length - 1;
    const fmtD = v => { if (!v) return ''; const [y,m,d] = v.split('-'); return `${d}.${m}.${y}`; };
    banner.style.display = 'block';
    banner.innerHTML = `
      <div class="wieder-banner-icon">⟳</div>
      <div class="wieder-banner-body">
        <div class="wieder-banner-title">${t.kunde} — ${_wiederFmtIntervall(t.intervall)}</div>
        <div class="wieder-banner-meta">Fällig: ${fmtD(t.naechste)} · ${t.positions?.map(p=>p.desc).filter(Boolean).join(', ').substring(0,60) || 'Rechnung erstellen'}</div>
        ${rest > 0 ? `<div class="wieder-banner-more">+ ${rest} weitere fällig</div>` : ''}
      </div>
      <button type="button" class="btn btn-blue" style="flex-shrink:0;" onclick="_wiederErstelleVorlage(${t.id})">Jetzt erstellen</button>
      <button type="button" class="btn btn-ghost" style="flex-shrink:0;" onclick="_wiederDismiss(${t.id})">Später</button>`;
  }

  function _wiederDismiss(id) {
    const dismissed = JSON.parse(sessionStorage.getItem('wieder_dismissed') || '[]');
    dismissed.push(id);
    sessionStorage.setItem('wieder_dismissed', JSON.stringify(dismissed));
    _wiederCheckFaellig();
  }

  function _wiederErstelleVorlage(id) {
    const t = _wiederGetAll().find(x => x.id === id);
    if (!t) return;
    _wiederVorlageId = id;
    closeWiederModal();

    // Form öffnen und mit Vorlagendaten füllen
    showForm();
    setTimeout(() => {
      const set = (elId, val) => { const el = document.getElementById(elId); if (el && val !== undefined) el.value = val; };
      set('cSalutation', t.cSalutation || t.kunde);
      set('cStreet',     t.cStreet);
      set('cPlz',        t.cPlz);
      set('cCity',       t.cCity);
      set('cCountry',    t.cCountry || 'Deutschland');
      set('cGreeting',   t.cGreeting);
      set('invKdNr',     t.invKdNr);
      set('invPayment',  t.invPayment);
      set('invDate',     new Date().toISOString().split('T')[0]);
      // Fälligkeitsdatum berechnen
      const cfg = JSON.parse(localStorage.getItem('max4work_rechnung_config') || '{}');
      const tage = parseInt(cfg.zahlungstage || 14);
      const due  = new Date(); due.setDate(due.getDate() + tage);
      set('invDue', due.toISOString().split('T')[0]);
      if (t.positions?.length) {
        positions = t.positions.map(p => ({ ...p }));
        renderPos();
      }
      _kundeSearchSyncFromFields?.();
      rp();
    }, 50);
  }

  // Nach PDF-Export: Vorlage-Datum vorrücken
  function _wiederNachExport() {
    if (!_wiederVorlageId) return;
    const liste = _wiederGetAll();
    const idx   = liste.findIndex(t => t.id === _wiederVorlageId);
    if (idx >= 0) {
      liste[idx].naechste = _wiederNextDate(liste[idx].naechste, liste[idx].intervall);
      liste[idx].zuletzt  = new Date().toISOString().split('T')[0];
      _wiederSaveAll(liste);
    }
    _wiederVorlageId = null;
    _wiederCheckFaellig();
  }

  /* Modal */
  function openWiederModal() {
    document.getElementById('wiederOverlay').classList.add('open');
    _wiederShowListe();
  }
  function closeWiederModal() {
    document.getElementById('wiederOverlay').classList.remove('open');
    _wiederEditId = null;
  }
  function wiederOverlayClick(e) {
    if (e.target === document.getElementById('wiederOverlay')) closeWiederModal();
  }

  function _wiederShowListe() {
    const liste  = _wiederGetAll();
    const heute  = new Date().toISOString().split('T')[0];
    const fmtD   = v => { if (!v) return '—'; const [y,m,d] = v.split('-'); return `${d}.${m}.${y}`; };
    document.getElementById('wiederModalTitle').textContent = 'Wiederkehrende Rechnungen';
    const body = document.getElementById('wiederModalBody');
    const foot = document.getElementById('wiederModalFoot');

    if (!liste.length) {
      body.innerHTML = `<div style="text-align:center;padding:32px;color:var(--muted);font-size:13px;">
        <div style="font-size:28px;margin-bottom:10px;">⟳</div>
        <div style="font-weight:500;color:var(--text);margin-bottom:6px;">Noch keine Vorlagen</div>
        Erstelle eine Vorlage für Rechnungen die du regelmäßig stellst.
      </div>`;
    } else {
      body.innerHTML = liste.map(t => {
        const faellig = t.aktiv && t.naechste <= heute;
        const badge   = faellig ? 'faellig' : (t.aktiv ? 'aktiv' : 'inaktiv');
        const bText   = faellig ? 'Fällig' : (t.aktiv ? 'Aktiv' : 'Pausiert');
        const betrag  = (t.positions||[]).reduce((s,p) => {
          const q = isNaN(parseFloat(p.qty)) ? 1 : parseFloat(p.qty);
          return s + q * (parseFloat(p.price)||0);
        }, 0);
        return `<div class="wieder-card">
          <div class="wieder-card-info">
            <div class="wieder-card-name">${t.kunde}</div>
            <div class="wieder-card-meta">${_wiederFmtIntervall(t.intervall)} · Nächste: ${fmtD(t.naechste)} · ${betrag.toLocaleString('de-DE',{style:'currency',currency:'EUR'})}</div>
          </div>
          <span class="wieder-card-badge ${badge}">${bText}</span>
          <div class="wieder-card-actions">
            ${faellig ? `<button class="btn btn-blue" style="padding:5px 10px;font-size:12px;" onclick="closeWiederModal();_wiederErstelleVorlage(${t.id})">Erstellen</button>` : ''}
            <button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;" onclick="_wiederEditForm(${t.id})">${t.aktiv?'Bearbeiten':'Bearbeiten'}</button>
            <button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;color:var(--muted);" onclick="_wiederLoeschen(${t.id})">×</button>
          </div>
        </div>`;
      }).join('');
    }
    foot.innerHTML = `<span style="font-size:12px;color:var(--muted);">${liste.length} Vorlage${liste.length!==1?'n':''}</span>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost" onclick="closeWiederModal()">Schließen</button>
        <button class="btn btn-blue" onclick="_wiederEditForm(null)">+ Neue Vorlage</button>
      </div>`;
  }

  function _wiederEditForm(id) {
    _wiederEditId = id;
    const t       = id ? _wiederGetAll().find(x => x.id === id) : null;
    _wiederPos    = t?.positions?.length ? t.positions.map(p=>({...p})) : [{ desc:'', qty:'1', price:0 }];
    document.getElementById('wiederModalTitle').textContent = id ? 'Vorlage bearbeiten' : 'Neue Vorlage';

    const heute = new Date(); heute.setMonth(heute.getMonth() + 1);
    const defaultNext = heute.toISOString().split('T')[0];

    document.getElementById('wiederModalBody').innerHTML = `
      <div class="wieder-form-section">Kunde</div>
      <div class="field" style="margin-bottom:10px;"><input id="wfKunde" placeholder="Kundenname" value="${t?.kunde||''}" style="width:100%;"></div>
      <div class="field-row" style="gap:10px;margin-bottom:10px;">
        <div class="field" style="flex:2;margin:0;"><label style="font-size:11px;">Straße</label><input id="wfStrasse" value="${t?.cStreet||''}" placeholder="Musterstr. 1"></div>
        <div class="field" style="flex:1;margin:0;"><label style="font-size:11px;">PLZ</label><input id="wfPlz" value="${t?.cPlz||''}" placeholder="12345"></div>
        <div class="field" style="flex:2;margin:0;"><label style="font-size:11px;">Ort</label><input id="wfOrt" value="${t?.cCity||''}" placeholder="Musterstadt"></div>
      </div>

      <div class="wieder-form-section">Intervall & Datum</div>
      <div class="field-row" style="gap:10px;margin-bottom:10px;">
        <div class="field" style="flex:1;margin:0;"><label style="font-size:11px;">Intervall</label>
          <select id="wfIntervall">
            <option value="monatlich"${t?.intervall==='monatlich'?' selected':''}>Monatlich</option>
            <option value="quartalsweise"${t?.intervall==='quartalsweise'?' selected':''}>Quartalsweise</option>
            <option value="halbjährlich"${t?.intervall==='halbjährlich'?' selected':''}>Halbjährlich</option>
            <option value="jährlich"${t?.intervall==='jährlich'?' selected':''}>Jährlich</option>
          </select>
        </div>
        <div class="field" style="flex:1;margin:0;"><label style="font-size:11px;">Nächste Fälligkeit</label><input type="date" id="wfNaechste" value="${t?.naechste||defaultNext}"></div>
      </div>

      <div class="wieder-form-section">Positionen</div>
      <div style="display:grid;grid-template-columns:1fr 80px 90px 26px;gap:6px;margin-bottom:6px;">
        <span style="font-size:10px;color:var(--muted);padding-left:2px;">Beschreibung</span>
        <span style="font-size:10px;color:var(--muted);">Menge</span>
        <span style="font-size:10px;color:var(--muted);">Preis €</span>
        <span></span>
      </div>
      <div id="wfPosBody"></div>
      <button type="button" class="btn btn-ghost" style="font-size:12px;padding:5px 12px;margin-top:4px;" onclick="_wfAddPos()">+ Position</button>`;

    _wfRenderPos();
    document.getElementById('wiederModalFoot').innerHTML = `
      <button class="btn btn-ghost" onclick="_wiederShowListe()">← Zurück</button>
      <div style="display:flex;gap:8px;">
        ${t ? `<button class="btn btn-ghost" style="color:var(--muted);" onclick="_wiederToggleAktiv(${t.id})">${t.aktiv?'Pausieren':'Aktivieren'}</button>` : ''}
        <button class="btn btn-blue" onclick="_wiederSpeichern()">Speichern</button>
      </div>`;
  }

  function _wfRenderPos() {
    const body = document.getElementById('wfPosBody');
    if (!body) return;
    body.innerHTML = _wiederPos.map((p, i) => `
      <div class="wieder-pos-row">
        <input value="${p.desc||''}" placeholder="Leistung / Beschreibung" oninput="_wfUpdate(${i},'desc',this.value)">
        <input value="${p.qty||'1'}" placeholder="1" oninput="_wfUpdate(${i},'qty',this.value)">
        <input type="number" value="${p.price||0}" min="0" step="0.01" oninput="_wfUpdate(${i},'price',parseFloat(this.value)||0)">
        <button type="button" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;line-height:1;" onclick="_wfDelPos(${i})">×</button>
      </div>`).join('');
  }

  function _wfUpdate(i, field, val) { _wiederPos[i][field] = val; }
  function _wfAddPos()    { _wiederPos.push({ desc:'', qty:'1', price:0 }); _wfRenderPos(); }
  function _wfDelPos(i)   { if (_wiederPos.length > 1) { _wiederPos.splice(i,1); _wfRenderPos(); } }

  function _wiederSpeichern() {
    const kunde = (document.getElementById('wfKunde')?.value || '').trim();
    if (!kunde) { alert('Bitte einen Kundennamen eingeben.'); return; }
    const naechste = document.getElementById('wfNaechste')?.value;
    if (!naechste) { alert('Bitte ein Fälligkeitsdatum eingeben.'); return; }

    const liste = _wiederGetAll();
    const entry = {
      id:         _wiederEditId || Date.now(),
      aktiv:      _wiederEditId ? (liste.find(t=>t.id===_wiederEditId)?.aktiv ?? true) : true,
      kunde,
      intervall:  document.getElementById('wfIntervall')?.value || 'monatlich',
      naechste,
      positions:  _wiederPos.filter(p => p.desc || p.price),
      cStreet:    document.getElementById('wfStrasse')?.value || '',
      cPlz:       document.getElementById('wfPlz')?.value    || '',
      cCity:      document.getElementById('wfOrt')?.value     || '',
      cCountry:   'Deutschland',
      cSalutation: kunde,
      zuletzt:    _wiederEditId ? (liste.find(t=>t.id===_wiederEditId)?.zuletzt || null) : null
    };

    if (_wiederEditId) {
      const idx = liste.findIndex(t => t.id === _wiederEditId);
      if (idx >= 0) liste[idx] = entry; else liste.push(entry);
    } else {
      liste.push(entry);
    }
    _wiederSaveAll(liste);
    _wiederEditId = null;
    _wiederShowListe();
    _wiederCheckFaellig();
  }

  function _wiederToggleAktiv(id) {
    const liste = _wiederGetAll();
    const t = liste.find(x => x.id === id);
    if (t) { t.aktiv = !t.aktiv; _wiederSaveAll(liste); }
    _wiederShowListe();
    _wiederCheckFaellig();
  }

  function _wiederLoeschen(id) {
    if (!confirm('Vorlage löschen?')) return;
    _wiederSaveAll(_wiederGetAll().filter(t => t.id !== id));
    _wiederShowListe();
    _wiederCheckFaellig();
  }

  function _applyAngebotParams() {
    const p = new URLSearchParams(location.search);
    if (!p.has('ang_kunde')) return;
    showForm();
    setTimeout(() => {
      const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
      set('cSalutation', p.get('ang_kunde'));
      set('cName', p.get('ang_kunde'));
      const ang_positions = p.get('ang_positions');
      if (ang_positions) {
        try {
          const pArr = JSON.parse(ang_positions);
          if (pArr.length) {
            positions = pArr.map(pos => ({
              desc: pos.desc || '',
              qty: pos.qty || '1',
              price: parseFloat(pos.price) || 0,
              ust: pos.vat || pos.ust || _defaultUst()
            }));
            renderPos();
          }
        } catch(e) {}
      }
      rp();
      showToast(`Angebot ${p.get('ang_nr') || ''} als Rechnung übernommen`);
      history.replaceState({}, '', location.pathname);
    }, 150);
  }

  setTimeout(() => {
    renderListe();
    loadDraft();
    applyLivePreview();
    applyDatevVisibility();
    _wiederCheckFaellig();
    _updateParkenBtn();
    const xmlBtn = document.getElementById('xmlBtn');
    if (xmlBtn) xmlBtn.style.display = _xrIsEnabled() ? '' : 'none';
    _applyAngebotParams();
  }, 0);
