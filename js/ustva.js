  /* ════════════════════════════════════════
     USt-Voranmeldung – Berechnung & Rendering
  ════════════════════════════════════════ */

  const MONATE_KURZ = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const MONATE_LANG = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

  let currentYear   = new Date().getFullYear();
  let periodMode    = 'quartal'; // 'quartal' | 'monat'
  let currentPeriod = _currentDefaultPeriod();

  function _currentDefaultPeriod() {
    const m = new Date().getMonth() + 1;
    return periodMode === 'monat' ? m : Math.ceil(m / 3);
  }

  // ── Datenzugriff ──────────────────────────────────────────────────
  function loadAll() {
    const rechnungen = _parse('max4work_rechnungen');
    const history    = _parse('max4work_rechnungen_history');
    const belege     = _parse('max4work_belege');
    const einstell   = _parse('max4work_einstellungen') || {};
    const invCfg     = _parse('max4work_rechnung_config') || {};
    const isKU       = !!(invCfg.felder?.ust19 || einstell.ust19);
    return { rechnungen, history, belege, isKU, einstell };
  }

  function _parse(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || (key.includes('history') || key.includes('belege') || key.includes('rechnungen') ? [] : {}); }
    catch(e) { return []; }
  }

  // ── Perioden-Logik ────────────────────────────────────────────────
  function monthsInPeriod(period) {
    if (periodMode === 'monat') return [period];
    const map = { 1:[1,2,3], 2:[4,5,6], 3:[7,8,9], 4:[10,11,12] };
    return map[period] || [];
  }

  function periodLabel(period) {
    if (periodMode === 'monat') return MONATE_LANG[period - 1];
    return `Q${period}`;
  }

  function periodSubLabel(period) {
    if (periodMode === 'monat') return '';
    const names = { 1:'Jan – Mär', 2:'Apr – Jun', 3:'Jul – Sep', 4:'Okt – Dez' };
    return names[period] || '';
  }

  function faelligkeitDatum(period, year) {
    if (periodMode === 'monat') {
      const m = period === 12 ? 1 : period + 1;
      const y = period === 12 ? year + 1 : year;
      const label = `10. ${MONATE_KURZ[m - 1]} ${y}`;
      return label;
    }
    const map = { 1:`10. Apr ${year}`, 2:`10. Jul ${year}`, 3:`10. Okt ${year}`, 4:`10. Jan ${year + 1}` };
    return map[period] || '—';
  }

  function isInPeriod(month, period) {
    return monthsInPeriod(period).includes(month);
  }

  // ── Kernberechnung ────────────────────────────────────────────────
  function calcPeriod(data, year, period) {
    const { rechnungen, history, belege, isKU } = data;
    const yStr = String(year);
    const months = monthsInPeriod(period);

    // Rechnungen im Zeitraum (nur normaler Typ, keine Mahnungen)
    const rech = rechnungen.filter(r => {
      if (!r.datum?.startsWith(yStr)) return false;
      const m = parseInt(r.datum.split('-')[1]);
      if (!months.includes(m)) return false;
      if (r.typ === 'mahnung') return false; // Mahngebühren separat behandeln
      return true;
    });

    // Ausgangsumsätze nach Steuersatz
    const groups = {}; // { '19': { netto, ust, anzahl }, '7': ..., '0': ... }
    let ohneHistory = 0;

    for (const r of rech) {
      const hist = history.find(h => h.nr === r.nr);
      if (hist?.positions?.length) {
        for (const p of hist.positions) {
          const qty   = isNaN(parseFloat(p.qty)) ? 1 : parseFloat(p.qty);
          const netto = qty * parseFloat(p.price || 0);
          const rate  = String(p.ust !== undefined ? parseInt(p.ust) : (isKU ? 0 : 19));
          if (!groups[rate]) groups[rate] = { netto: 0, ust: 0, anzahl: 0 };
          groups[rate].netto  += netto;
          groups[rate].ust    += netto * parseInt(rate) / 100;
          groups[rate].anzahl += 1;
        }
      } else {
        // Fallback: betrag = netto aus der Liste
        const netto = parseFloat(r.betrag || 0);
        const rate  = String(isKU ? 0 : 19);
        if (!groups[rate]) groups[rate] = { netto: 0, ust: 0, anzahl: 0 };
        groups[rate].netto  += netto;
        groups[rate].ust    += netto * parseInt(rate) / 100;
        groups[rate].anzahl += 1;
        ohneHistory++;
      }
    }

    // Vorsteuer aus Belegen
    const belegeImZr = belege.filter(b => {
      if (!b.datum?.startsWith(yStr)) return false;
      const m = parseInt(b.datum.split('-')[1]);
      return months.includes(m);
    });

    const vorstBekannt = belegeImZr
      .filter(b => b.mwst !== undefined && b.mwst !== null && b.mwst !== '')
      .reduce((s, b) => s + parseFloat(b.mwst || 0), 0);

    const vorstUnbekanntBrutto = belegeImZr
      .filter(b => b.mwst === undefined || b.mwst === null || b.mwst === '')
      .reduce((s, b) => s + parseFloat(b.betrag || 0), 0);

    const belegeAnzahl   = belegeImZr.length;
    const belegeMitMwSt  = belegeImZr.filter(b => b.mwst !== undefined && b.mwst !== null && b.mwst !== '').length;

    // Summen
    const gesamtNetto  = Object.values(groups).reduce((s, g) => s + g.netto, 0);
    const gesamtUSt    = Object.values(groups).reduce((s, g) => s + g.ust, 0);
    const zahllast     = gesamtUSt - vorstBekannt;

    return {
      rech, groups, isKU, ohneHistory,
      gesamtNetto, gesamtUSt,
      vorstBekannt, vorstUnbekanntBrutto,
      belegeAnzahl, belegeMitMwSt,
      zahllast
    };
  }

  // ── Formatierung ──────────────────────────────────────────────────
  function fmtE(n, showSign) {
    const v = parseFloat(n || 0);
    const s = v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    if (showSign && v > 0) return '+ ' + s;
    return s;
  }
  function fmtN(n) { return parseFloat(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  // ── Render: Jahr- und Perioden-Tabs ──────────────────────────────
  function renderTabs(data) {
    const years = getYears(data);
    const yearHtml = years.map(y =>
      `<div class="ytab${y === currentYear ? ' on' : ''}" onclick="setYear(${y})">${y}</div>`
    ).join('');
    document.getElementById('yearTabs').innerHTML = yearHtml;

    const count = periodMode === 'quartal' ? 4 : 12;
    const tabHtml = Array.from({ length: count }, (_, i) => {
      const p = i + 1;
      return `<div class="ptab${p === currentPeriod ? ' on' : ''}" onclick="setPeriod(${p})">${periodMode === 'quartal' ? 'Q' + p : MONATE_KURZ[i]}</div>`;
    }).join('');
    document.getElementById('periodTabs').innerHTML = tabHtml;

    // Mode-Toggle
    document.getElementById('modeQ').classList.toggle('on', periodMode === 'quartal');
    document.getElementById('modeM').classList.toggle('on', periodMode === 'monat');
  }

  function getYears(data) {
    const s = new Set();
    [...data.rechnungen, ...data.belege].forEach(r => {
      if (r.datum) s.add(parseInt(r.datum.split('-')[0]));
    });
    s.add(new Date().getFullYear());
    return [...s].sort((a, b) => b - a);
  }

  // ── Haupt-Render ─────────────────────────────────────────────────
  function render() {
    const data = loadAll();
    renderTabs(data);
    const res  = calcPeriod(data, currentYear, currentPeriod);
    const frist = faelligkeitDatum(currentPeriod, currentYear);

    renderStatus(res, data.einstell, frist);
    renderAusgang(res);
    renderVorsteuer(res);
    renderZahllast(res, frist);
    renderElster(res);
  }

  // ── Status-Banner ─────────────────────────────────────────────────
  function renderStatus(res, einstell, frist) {
    const el = document.getElementById('statusPanel');
    if (!el) return;
    const periode = `${periodLabel(currentPeriod)}${periodSubLabel(currentPeriod) ? ' (' + periodSubLabel(currentPeriod) + ')' : ''} ${currentYear}`;

    if (res.isKU) {
      el.innerHTML = `
        <div class="status-card ku-mode">
          <div class="status-icon">§19</div>
          <div class="status-body">
            <div class="status-title">Kleinunternehmer §19 UStG – keine USt-Voranmeldung erforderlich</div>
            <div class="status-sub">Da Sie §19 UStG in Ihren Einstellungen aktiviert haben, stellen Sie keine Umsatzsteuer in Rechnung und müssen keine UStVA abgeben. Umsatzgrenzen: bis 25.000 € im Vorjahr und 100.000 € im laufenden Jahr (ab 2025).</div>
          </div>
          <a href="einstellungen.html" class="status-link">Einstellungen →</a>
        </div>`;
      ['ausgangsPanel','vorsteuerpanel','zahllastPanel','elsterPanel'].forEach(id => {
        const e = document.getElementById(id);
        if (e) e.style.display = 'none';
      });
      return;
    }

    ['ausgangsPanel','vorsteuerpanel','zahllastPanel','elsterPanel'].forEach(id => {
      const e = document.getElementById(id);
      if (e) e.style.display = '';
    });

    const isZahllast = res.zahllast >= 0;
    const hinweis = res.ohneHistory > 0
      ? `<div class="status-hint">ℹ ${res.ohneHistory} Rechnung${res.ohneHistory > 1 ? 'en' : ''} ohne Positionsdetails – Nettobetrag als 19 %-Umsatz angenommen. Für präzise Werte bitte Rechnungen im Editor öffnen und speichern.</div>`
      : '';

    el.innerHTML = `
      <div class="status-card regelbesteuerung">
        <div class="status-kpis">
          <div class="sk"><div class="sk-label">Periode</div><div class="sk-val">${periode}</div></div>
          <div class="sk"><div class="sk-label">Fälligkeit</div><div class="sk-val">${frist}</div></div>
          <div class="sk"><div class="sk-label">Rechnungen</div><div class="sk-val">${res.rech.length}</div></div>
          <div class="sk"><div class="sk-label">USt-Zahllast</div><div class="sk-val ${isZahllast ? 'red' : 'green'}">${fmtE(Math.abs(res.zahllast))} ${isZahllast ? '(zu zahlen)' : '(Erstattung)'}</div></div>
        </div>
        ${hinweis}
      </div>`;
  }

  // ── Ausgangsumsätze ───────────────────────────────────────────────
  function renderAusgang(res) {
    const el = document.getElementById('ausgangsContent');
    if (!el) return;

    if (!res.rech.length) {
      el.innerHTML = '<div class="empty">Keine Rechnungen in diesem Zeitraum.</div>';
      return;
    }

    const rateOrder = ['19', '7', '0'];
    const rateLabel = { '19': '19 % Regelsteuersatz', '7': '7 % ermäßigt', '0': '0 % / §19 UStG' };
    const kzNetto  = { '19': '81', '7': '86', '0': '48' };
    const kzSteuer = { '19': '83', '7': '85', '0': '—' };

    const rows = rateOrder
      .filter(r => res.groups[r] && res.groups[r].netto > 0)
      .map(r => {
        const g = res.groups[r];
        return `
          <div class="tax-row">
            <div class="tax-rate">${rateLabel[r]}</div>
            <div class="tax-kz-wrap">
              <div class="tax-kz-cell">
                <div class="kz-badge">Kz ${kzNetto[r]}</div>
                <div class="tax-kz-label">Nettobetrag</div>
                <div class="tax-kz-val">${fmtN(g.netto)} €</div>
              </div>
              <div class="tax-arrow">→</div>
              <div class="tax-kz-cell">
                <div class="kz-badge kz-steuer">Kz ${kzSteuer[r]}</div>
                <div class="tax-kz-label">Steuer darauf</div>
                <div class="tax-kz-val ${parseInt(r) > 0 ? 'red' : 'muted'}">${parseInt(r) > 0 ? fmtN(g.ust) + ' €' : '—'}</div>
              </div>
            </div>
          </div>`;
      }).join('');

    const noRates = !rateOrder.some(r => res.groups[r] && res.groups[r].netto > 0);
    if (noRates) { el.innerHTML = '<div class="empty">Keine Ausgangsumsätze berechenbar.</div>'; return; }

    el.innerHTML = `
      <div class="tax-rows">${rows}</div>
      <div class="tax-summe">
        <div class="ts-item">
          <div class="ts-label">Gesamtumsatz (netto)</div>
          <div class="ts-val">${fmtN(res.gesamtNetto)} €</div>
        </div>
        <div class="ts-sep"></div>
        <div class="ts-item">
          <div class="ts-label">Umsatzsteuer gesamt</div>
          <div class="ts-val red">${fmtN(res.gesamtUSt)} €</div>
        </div>
      </div>`;
  }

  // ── Vorsteuer ─────────────────────────────────────────────────────
  function renderVorsteuer(res) {
    const el = document.getElementById('vorstContent');
    if (!el) return;

    const pct = res.belegeAnzahl > 0 ? Math.round(res.belegeMitMwSt / res.belegeAnzahl * 100) : 0;

    el.innerHTML = `
      <div class="vorst-row">
        <div class="vorst-kz-cell">
          <div class="kz-badge kz-steuer" style="font-size:13px">Kz 66</div>
          <div class="vorst-label">Abziehbare Vorsteuerbeträge</div>
          <div class="vorst-val green">${fmtN(res.vorstBekannt)} €</div>
          <div class="vorst-sub">${res.belegeMitMwSt} von ${res.belegeAnzahl} Beleg${res.belegeAnzahl !== 1 ? 'en' : ''} mit MwSt-Angabe (${pct} %)</div>
        </div>
      </div>
      ${res.vorstUnbekanntBrutto > 0 ? `
      <div class="vorst-hint">
        <div class="vorst-hint-title">MwSt-Betrag bei ${res.belegeAnzahl - res.belegeMitMwSt} Beleg${res.belegeAnzahl - res.belegeMitMwSt !== 1 ? 'en' : ''} nicht erfasst</div>
        <div class="vorst-hint-sub">Gesamtwert dieser Belege: ${fmtN(res.vorstUnbekanntBrutto)} € (brutto). Prüfen Sie diese manuell auf abzugsfähige Vorsteuer und tragen Sie den Betrag ggf. unter Kz 66 in ELSTER ein.</div>
        <div class="vorst-hint-link"><a href="belege.html" style="color:var(--accent);text-decoration:none;font-weight:600;">Belege prüfen →</a></div>
      </div>` : `
      <div class="vorst-ok">
        <div class="vorst-ok-icon">✓</div>
        <div>Alle ${res.belegeAnzahl} Belege haben MwSt-Angaben.</div>
      </div>`}`;
  }

  // ── Zahllast / Erstattung ─────────────────────────────────────────
  function renderZahllast(res, frist) {
    const el = document.getElementById('zahllastContent');
    if (!el) return;

    const isZahlung = res.zahllast >= 0;

    el.innerHTML = `
      <div class="zl-rows">
        <div class="zl-row">
          <span class="zl-lbl">Umsatzsteuer (Ausgangsumsätze)</span>
          <div class="zl-kz"><div class="kz-badge">Kz 83 + 85</div></div>
          <span class="zl-val red">+ ${fmtN(res.gesamtUSt)} €</span>
        </div>
        <div class="zl-row">
          <span class="zl-lbl">Abziehbare Vorsteuer</span>
          <div class="zl-kz"><div class="kz-badge kz-steuer">Kz 66</div></div>
          <span class="zl-val green">− ${fmtN(res.vorstBekannt)} €</span>
        </div>
        <div class="zl-divider"></div>
        <div class="zl-row zl-result">
          <span class="zl-lbl-big">${isZahlung ? 'Verbleibende Zahllast' : 'Erstattungsbetrag'}</span>
          <div class="zl-kz"></div>
          <span class="zl-result-val ${isZahlung ? 'red' : 'green'}">${isZahlung ? '= ' : '= '}${fmtN(Math.abs(res.zahllast))} €</span>
        </div>
      </div>
      <div class="zl-footer">
        <div class="zl-footer-item ${isZahlung ? 'zl-zahlung' : 'zl-erstattung'}">
          <div class="zl-footer-icon">${isZahlung ? '⚡' : '↩'}</div>
          <div>
            <div class="zl-footer-title">${isZahlung ? 'Zahlung fällig: ' + frist : 'Erstattung beantragen bis: ' + frist}</div>
            <div class="zl-footer-sub">${isZahlung ? 'Überweisung an das Finanzamt oder Einzugsermächtigung (SEPA-Lastschrift) empfohlen.' : 'Erstattung wird nach Einreichung der UStVA in ELSTER automatisch angewiesen.'}</div>
          </div>
        </div>
      </div>`;
  }

  // ── ELSTER-Checkliste ─────────────────────────────────────────────
  function renderElster(res) {
    const el = document.getElementById('elsterContent');
    if (!el) return;

    const rows19  = res.groups['19'];
    const rows7   = res.groups['7'];
    const rows0   = res.groups['0'];
    const isZahlg = res.zahllast >= 0;

    const elsterFelder = [
      rows19?.netto > 0 && { kz:'81', name:'Steuerl. Umsätze 19 %', val: fmtN(rows19.netto), einheit:'€ (netto)' },
      rows19?.ust  > 0 && { kz:'83', name:'Steuer darauf 19 %',    val: fmtN(rows19.ust),   einheit:'€', cls:'red' },
      rows7?.netto > 0  && { kz:'86', name:'Steuerl. Umsätze 7 %',  val: fmtN(rows7.netto),  einheit:'€ (netto)' },
      rows7?.ust   > 0  && { kz:'85', name:'Steuer darauf 7 %',     val: fmtN(rows7.ust),    einheit:'€', cls:'red' },
      rows0?.netto > 0  && { kz:'48', name:'Steuerfreie Umsätze',   val: fmtN(rows0.netto),  einheit:'€' },
      res.vorstBekannt > 0 && { kz:'66', name:'Abziehbare Vorsteuer', val: fmtN(res.vorstBekannt), einheit:'€', cls:'green' },
    ].filter(Boolean);

    const feldRows = elsterFelder.map(f => `
      <div class="ef-row">
        <div class="ef-kz">${f.kz}</div>
        <div class="ef-name">${f.name}</div>
        <div class="ef-val ${f.cls || ''}">${f.val}</div>
        <div class="ef-unit">${f.einheit}</div>
        <button class="ef-copy" onclick="copyVal('${f.val.replace("'","\\'")}', this)" title="Kopieren">⎘</button>
      </div>`).join('');

    el.innerHTML = `
      <div class="ef-intro">Tragen Sie diese Werte in ELSTER (elster.de) → Formulare → USt-Voranmeldung ein:</div>
      <div class="ef-list">
        <div class="ef-head">
          <div class="ef-kz">Kz</div>
          <div class="ef-name">Feld</div>
          <div class="ef-val">Wert</div>
          <div class="ef-unit"></div>
          <div style="width:32px"></div>
        </div>
        ${feldRows || '<div class="empty" style="padding:16px">Keine Werte berechenbar.</div>'}
      </div>
      <div class="ef-result ${isZahlg ? 'ef-zahlung' : 'ef-erstattung'}">
        <div class="ef-result-label">${isZahlg ? 'Abschlussbetrag (Zahllast)' : 'Abschlussbetrag (Erstattung)'}</div>
        <div class="ef-result-val">${fmtN(Math.abs(res.zahllast))} €</div>
      </div>`;
  }

  // ── Kopieren ──────────────────────────────────────────────────────
  function copyVal(val, btn) {
    const clean = val.replace(/\./g, '').replace(',', '.');
    navigator.clipboard.writeText(clean).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✓';
      btn.style.color = 'var(--green)';
      setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 1500);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = clean;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  }

  // ── Controls ──────────────────────────────────────────────────────
  function setYear(y)   { currentYear = y;   render(); }
  function setPeriod(p) { currentPeriod = p;  render(); }

  function setPeriodMode(mode) {
    if (periodMode === mode) return;
    periodMode = mode;
    currentPeriod = _currentDefaultPeriod();
    render();
  }

  // ── Drucken ───────────────────────────────────────────────────────
  function printUStVA() { window.print(); }

  render();
