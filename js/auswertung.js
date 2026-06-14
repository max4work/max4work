  // ── Panel-Sichtbarkeit ──────────────────────────────────────────────
  // Jedes Panel hat eine ID im HTML und einen Toggle-Key in localStorage.
  // Neue Panels: Eintrag hier ergänzen + Toggle in einstellungen.html.
  // allowHalf: Darf das Panel in halber Breite (50 %) dargestellt werden?
  const PANEL_CONFIG = [
    { key: 'panel_kpiGrid',          elId: 'kpiGridWrap',         label: 'Kennzahlen (KPI-Übersicht)',     allowHalf: false },
    { key: 'panel_bank',             elId: 'bankPanel',           label: 'Meine Bank',                    allowHalf: true  },
    { key: 'panel_top5',             elId: 'top5Panel',           label: 'Top 5 Kunden',                  allowHalf: true  },
    { key: 'panel_kleinunternehmer', elId: 'kuPanel',             label: 'Kleinunternehmergrenze §19 UStG', allowHalf: true },
    { key: 'panel_ausstehend',       elId: 'arPanel',             label: 'Ausstehende Rechnungen',        allowHalf: false },
    { key: 'panel_chartMonat',       elId: 'chartMonatPanel',     label: 'Umsatz pro Monat',              allowHalf: false },
    { key: 'panel_chartVergleich',   elId: 'chartVergleichPanel', label: 'Einnahmen vs. Ausgaben',        allowHalf: true  },
    { key: 'panel_quartal',          elId: 'quartalPanel',        label: 'Quartalsübersicht',             allowHalf: false },
    { key: 'panel_steuern',          elId: 'steuerPanel',         label: 'Steuerübersicht',               allowHalf: false },
  ];
  const PANEL_DEFAULTS = Object.fromEntries(PANEL_CONFIG.map(p => [p.key, true]));

  function _isFeatureOn(id) {
    try {
      const saved = JSON.parse(localStorage.getItem('max4work_features') || '{}');
      // Rückwärtskompatibilität: alter Key für KU
      if (id === 'panel_kleinunternehmer' && saved[id] === undefined && saved['showKleinunternehmerGrenze'] !== undefined)
        return saved['showKleinunternehmerGrenze'];
      const defaults = { ...PANEL_DEFAULTS, autoSuggestInvoice: true, livePreview: true, highlightOverdue: true };
      return saved[id] !== undefined ? saved[id] : (defaults[id] !== undefined ? defaults[id] : true);
    } catch(e) { return true; }
  }

  function getPanelLayout() {
    try {
      const saved = JSON.parse(localStorage.getItem('max4work_panel_layout') || 'null');
      if (saved && Array.isArray(saved) && saved.length) {
        // Fehlende Panels (neue Panels) ans Ende anhängen
        const keys = new Set(saved.map(p => p.key));
        PANEL_CONFIG.forEach(cfg => { if (!keys.has(cfg.key)) saved.push({ key: cfg.key, size: 'full' }); });
        return saved;
      }
    } catch(e) {}
    return PANEL_CONFIG.map(cfg => ({ key: cfg.key, size: 'full' }));
  }

  function applyPanelLayout() {
    const layout = getPanelLayout();
    const content = document.querySelector('.content');

    // Reihenfolge anwenden + Sichtbarkeit setzen
    const visible = [];
    layout.forEach(({ key, size }) => {
      const cfg = PANEL_CONFIG.find(p => p.key === key);
      if (!cfg) return;
      const el = document.getElementById(cfg.elId);
      if (!el) return;
      const on = _isFeatureOn(key);
      el.style.display = on ? '' : 'none';
      content.appendChild(el);
      if (on) visible.push({ el, cfg, size });
    });

    // Half-Panels paarweise setzen; einzelne ohne Paar → volle Breite
    let i = 0;
    while (i < visible.length) {
      const cur = visible[i];
      const isHalf = cur.size === 'half' && cur.cfg.allowHalf;
      if (isHalf) {
        const nxt = visible[i + 1];
        const nxtIsHalf = nxt && nxt.size === 'half' && nxt.cfg.allowHalf;
        if (nxtIsHalf) {
          cur.el.style.gridColumn = 'span 1';
          nxt.el.style.gridColumn = 'span 1';
          i += 2;
        } else {
          cur.el.style.gridColumn = '1 / -1';
          i++;
        }
      } else {
        cur.el.style.gridColumn = '1 / -1';
        i++;
      }
    }
  }

  const MONATE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const MONATE_LONG = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  let currentYear = new Date().getFullYear();
  let chartMonat = null, chartVergleich = null;

  function loadData() {
    const rechnungen = (() => { try { return JSON.parse(localStorage.getItem('max4work_rechnungen')) || []; } catch { return []; } })();
    const zahlungen  = (() => { try { return JSON.parse(localStorage.getItem('max4work_zahlungen')) || []; } catch { return []; } })();
    const belege     = (() => { try { return JSON.parse(localStorage.getItem('max4work_belege')) || []; } catch { return []; } })();
    return { rechnungen, zahlungen, belege };
  }

  function getYears(data) {
    const years = new Set();
    [...data.rechnungen, ...data.zahlungen, ...data.belege].forEach(r => {
      if (r.datum) years.add(parseInt(r.datum.split('-')[0]));
    });
    const now = new Date().getFullYear();
    years.add(now);
    return [...years].sort((a,b) => b - a);
  }

  function renderYearTabs(years) {
    const tabs = document.getElementById('yearTabs');
    tabs.innerHTML = years.map(y => `<div class="ytab${y===currentYear?' on':''}" onclick="setYear(${y})">${y}</div>`).join('');
  }

  function setYear(y) { currentYear = y; render(); }

  function fmt(n) { return parseFloat(n||0).toFixed(2).replace('.',','); }

  function render() {
    const data = loadData();
    const years = getYears(data);
    renderYearTabs(years);

    const year = currentYear;
    const monatUmsatz = Array(12).fill(0);
    const monatAnzahl = Array(12).fill(0);
    const monatAusgaben = Array(12).fill(0);

    // Zahlungseingänge nach Monat
    data.zahlungen.filter(z => z.datum && z.datum.startsWith(year+'')).forEach(z => {
      const m = parseInt(z.datum.split('-')[1]) - 1;
      monatUmsatz[m] += Number(z.betrag || 0);
      monatAnzahl[m]++;
    });

    // Ausgaben nach Monat
    data.belege.filter(b => b.datum && b.datum.startsWith(year+'')).forEach(b => {
      const m = parseInt(b.datum.split('-')[1]) - 1;
      monatAusgaben[m] += Number(b.betrag || 0);
    });

    const jahresUmsatz = monatUmsatz.reduce((a,b) => a+b, 0);
    const jahresAusgaben = monatAusgaben.reduce((a,b) => a+b, 0);
    const gewinn = jahresUmsatz - jahresAusgaben;
    const offeneRechnungen = data.rechnungen.filter(r => r.status === 'offen');
    const offenSumme = offeneRechnungen.reduce((s,r) => s + Number(r.betrag||0), 0);

    // Meine Bank
    if (_isFeatureOn('panel_bank')) renderBank(data.zahlungen, data.belege, year);

    // Top 5 Kunden
    if (_isFeatureOn('panel_top5')) renderTop5Kunden(data.rechnungen, year);

    // Ausstehende Rechnungen
    renderAR(data.rechnungen, data.zahlungen);

    // Panel-Sichtbarkeit anwenden
    applyPanelLayout();

    // Quartalsübersicht
    if (_isFeatureOn('panel_quartal')) renderQuartal(data.zahlungen, data.belege, year);

    // Kleinunternehmergrenze (nur rendern wenn sichtbar)
    if (_isFeatureOn('panel_kleinunternehmer')) {
      document.getElementById('kuTitle').textContent = `Kleinunternehmergrenze §19 UStG – ${year}`;
      renderKU(jahresUmsatz, year);
    }

    // KPIs
    document.getElementById('kpiGrid').innerHTML = `
      <div class="kpi"><div class="kpi-label">Jahresumsatz ${year}</div><div class="kpi-value green">${fmt(jahresUmsatz)} €</div><div class="kpi-sub">Zahlungseingänge</div></div>
      <div class="kpi"><div class="kpi-label">Jahresausgaben</div><div class="kpi-value red">${fmt(jahresAusgaben)} €</div><div class="kpi-sub">Belege &amp; Kosten</div></div>
      <div class="kpi"><div class="kpi-label">Gewinn/Verlust</div><div class="kpi-value${gewinn >= 0 ? ' green' : ' red'}">${fmt(gewinn)} €</div><div class="kpi-sub">Umsatz − Ausgaben</div></div>
      <div class="kpi"><div class="kpi-label">Offene Forderungen</div><div class="kpi-value">${fmt(offenSumme)} €</div><div class="kpi-sub">${offeneRechnungen.length} Rechnungen offen</div></div>`;

    // Bar-Chart Monat
    const maxUmsatz = Math.max(...monatUmsatz, 1);

    // Monatsdetails Liste
    const monatEl = document.getElementById('monatListe');
    const hasData = monatUmsatz.some(v => v > 0);
    if (!hasData) {
      monatEl.innerHTML = '<div class="empty"><div class="empty-icon">◈</div>Noch keine Zahlungsdaten für dieses Jahr.</div>';
    } else {
      monatEl.innerHTML = MONATE.map((m, i) => {
        if (monatUmsatz[i] === 0 && monatAnzahl[i] === 0) return '';
        const pct = Math.round(monatUmsatz[i] / maxUmsatz * 100);
        return `<div class="monat-row">
          <div class="monat-name">${m}</div>
          <div class="monat-bar-wrap"><div class="monat-bar" style="width:${pct}%"></div></div>
          <div class="monat-val">${fmt(monatUmsatz[i])} €</div>
          <div class="monat-cnt">${monatAnzahl[i]} Zahlung${monatAnzahl[i]!==1?'en':''}</div>
        </div>`;
      }).join('');
      if (!monatEl.innerHTML.trim()) monatEl.innerHTML = '<div class="empty"><div class="empty-icon">◈</div>Keine Daten.</div>';
    }

    // Chart.js – Monatsumsatz
    if (chartMonat) chartMonat.destroy();
    const ctx1 = document.getElementById('chartMonat').getContext('2d');
    chartMonat = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: MONATE,
        datasets: [{
          label: 'Einnahmen €', data: monatUmsatz,
          backgroundColor: 'rgba(0,102,255,0.18)', borderColor: '#0066FF',
          borderWidth: 2, borderRadius: 5
        }, {
          label: 'Ausgaben €', data: monatAusgaben,
          backgroundColor: 'rgba(255,59,48,0.12)', borderColor: '#FF3B30',
          borderWidth: 2, borderRadius: 5
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { family:'Outfit', size:12 } } } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#F0F0F5' }, ticks: { font: { family:'Outfit', size:11 } } },
          x: { grid: { display: false }, ticks: { font: { family:'Outfit', size:11 } } }
        }
      }
    });

    // Chart.js – Einnahmen vs Ausgaben Donut
    if (chartVergleich) chartVergleich.destroy();
    const ctx2 = document.getElementById('chartVergleich').getContext('2d');
    const noDataV = jahresUmsatz === 0 && jahresAusgaben === 0;
    chartVergleich = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: noDataV ? ['Keine Daten'] : ['Einnahmen', 'Ausgaben'],
        datasets: [{
          data: noDataV ? [1] : [jahresUmsatz, jahresAusgaben],
          backgroundColor: noDataV ? ['#EBEBEB'] : ['rgba(52,199,89,0.7)','rgba(255,59,48,0.7)'],
          borderColor: noDataV ? ['#EBEBEB'] : ['#34C759','#FF3B30'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { family:'Outfit', size:12 } } },
          tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.parsed)} €` } }
        },
        cutout: '62%'
      }
    });
  }

  const AV_COLORS = ['#0066FF','#34C759','#FF9500','#AF52DE','#FF3B30','#5AC8FA','#FF6B6B','#43A047'];
  function avColor(name) { let h=0; for(const c of (name||'')) h=(h*31+c.charCodeAt(0))%AV_COLORS.length; return AV_COLORS[h]; }
  function avInit(name) { return (name||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase(); }

  const RANK_STYLE = [
    { color:'#F59E0B', label:'🥇' },
    { color:'#9CA3AF', label:'🥈' },
    { color:'#B45309', label:'🥉' },
    { color:'var(--muted)', label:'4' },
    { color:'var(--muted)', label:'5' },
  ];

  function renderTop5Kunden(rechnungen, year) {
    const el = document.getElementById('top5Content');
    const yearStr = String(year);
    document.getElementById('top5Title').textContent = `Top 5 Kunden – ${year}`;

    // Umsatz pro Kunde aus bezahlten Rechnungen des Jahres
    const map = {};
    rechnungen
      .filter(r => r.status === 'bezahlt' && r.datum?.startsWith(yearStr))
      .forEach(r => {
        const k = r.kunde || '—';
        if (!map[k]) map[k] = { name: k, betrag: 0, anzahl: 0, letztes: '' };
        map[k].betrag  += Number(r.betrag || 0);
        map[k].anzahl  += 1;
        if (!map[k].letztes || r.datum > map[k].letztes) map[k].letztes = r.datum;
      });

    const sorted = Object.values(map).sort((a,b) => b.betrag - a.betrag).slice(0, 5);
    const fmtE = n => parseFloat(n||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €';
    const fmtD = v => { if (!v) return ''; const [y,m,d] = v.split('-'); return `${d}.${m}.${y}`; };

    if (!sorted.length) {
      el.innerHTML = `<div class="top5-empty">Noch keine bezahlten Rechnungen in ${year}.</div>`;
      return;
    }

    const max = sorted[0].betrag || 1;

    const rows = sorted.map((k, i) => {
      const pct = Math.round(k.betrag / max * 100);
      const rs  = RANK_STYLE[i];
      const barColor = i === 0 ? '#F59E0B' : i === 1 ? '#9CA3AF' : i === 2 ? '#B45309' : 'var(--accent)';
      const gesamtPct = Math.round(k.betrag / Object.values(map).reduce((s,x)=>s+x.betrag,0) * 100);
      return `<div class="top5-row">
        <div class="top5-rank" style="color:${rs.color}">${rs.label}</div>
        <div class="top5-av"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
        <div class="top5-info">
          <div class="top5-name">${k.name}</div>
          <div class="top5-sub">${k.anzahl} Rechnung${k.anzahl!==1?'en':''}${k.letztes ? ' · zuletzt ' + fmtD(k.letztes) : ''}</div>
        </div>
        <div class="top5-bar-wrap">
          <div class="top5-bar" style="width:${pct}%;background:${barColor}"></div>
        </div>
        <div class="top5-pct">${gesamtPct} %</div>
        <div class="top5-amount">${fmtE(k.betrag)}</div>
      </div>`;
    }).join('');

    // Gesamtsumme
    const summe = sorted.reduce((s,k) => s+k.betrag, 0);
    el.innerHTML = `
      <div class="top5-head-row">
        <div class="top5-head-cell" style="min-width:26px"></div>
        <div class="top5-head-cell" style="min-width:36px"></div>
        <div class="top5-head-cell" style="flex:0 0 160px">Kunde</div>
        <div class="top5-head-cell" style="flex:1">Umsatzanteil</div>
        <div class="top5-head-cell" style="min-width:34px;text-align:right">%</div>
        <div class="top5-head-cell" style="min-width:110px;text-align:right">Umsatz</div>
      </div>
      <div class="top5-list">${rows}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 20px;background:#FAFAF8;border-top:1px solid var(--border);font-size:12.5px;">
        <span style="color:var(--muted);font-weight:500;">Gesamt Top ${sorted.length}</span>
        <span style="font-weight:700;font-size:14px;">${fmtE(summe)}</span>
      </div>`;
  }

  function getBanks() {
    try {
      const s = JSON.parse(localStorage.getItem('max4work_einstellungen') || '{}');
      const banks = [];
      if (s.sBank || s.sIBAN) banks.push({ name: s.sBank || 'Mein Konto', iban: s.sIBAN || '', bic: s.sBIC || '' });
      // Weitere Banken aus max4work_banken (zukünftige Erweiterung)
      const extra = JSON.parse(localStorage.getItem('max4work_banken') || '[]');
      extra.forEach(b => banks.push(b));
      return banks;
    } catch(e) { return []; }
  }

  function maskIBAN(iban) {
    const c = (iban || '').replace(/\s/g, '');
    if (c.length < 6) return iban;
    return c.slice(0,4) + ' •••• •••• •••• ' + c.slice(-4);
  }

  const BANK_COLORS = ['#0066FF','#34C759','#FF9500','#AF52DE','#FF3B30','#5856D6','#32ADE6'];
  function bankColor(name) {
    let h = 0;
    for (const ch of (name || '')) h = (h * 31 + ch.charCodeAt(0)) % BANK_COLORS.length;
    return BANK_COLORS[h];
  }

  let selectedBankIdx = 0;

  function renderBank(zahlungen, belege, year) {
    const banks = getBanks();
    const el = document.getElementById('bankCard');
    if (!banks.length) {
      el.innerHTML = `<div class="bank-empty">
        Keine Bank konfiguriert.<br>
        <a href="einstellungen.html" onclick="localStorage.setItem('max4work_settings_tab','firma')"
           style="color:var(--accent);font-weight:600;text-decoration:none;">Jetzt unter Firma hinterlegen →</a>
      </div>`;
      return;
    }

    const idx = Math.min(selectedBankIdx, banks.length - 1);
    const yearStr = String(year);
    const fmtE = n => parseFloat(n||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €';

    const ein = zahlungen.filter(z => z.datum?.startsWith(yearStr)).reduce((s,z) => s + Number(z.betrag||0), 0);
    const aus = belege.filter(b => b.datum?.startsWith(yearStr)).reduce((s,b) => s + Number(b.betrag||0), 0);
    const saldo = ein - aus;
    const total = ein + aus || 1;
    const pctEin = Math.round(ein / total * 100);
    const pctAus = 100 - pctEin;

    const accountsHTML = banks.map((b, i) => `
      <div class="bank-card${i === idx ? ' on' : ''}" onclick="selectedBankIdx=${i};renderBank(
        JSON.parse(localStorage.getItem('max4work_zahlungen')||'[]'),
        JSON.parse(localStorage.getItem('max4work_belege')||'[]'),
        ${year})">
        <div class="bank-avatar"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg></div>
        <div>
          <div class="bank-card-name">${b.name}</div>
          <div class="bank-card-iban">${maskIBAN(b.iban)}</div>
        </div>
      </div>`).join('');

    el.innerHTML = `
      <div class="bank-accounts-row">${accountsHTML}</div>
      <div class="bank-summary">
        <div class="bank-kpi">
          <div class="bank-kpi-label">Einnahmen ${year}</div>
          <div class="bank-kpi-val" style="color:var(--green)">${fmtE(ein)}</div>
        </div>
        <div class="bank-kpi">
          <div class="bank-kpi-label">Ausgaben ${year}</div>
          <div class="bank-kpi-val" style="color:var(--red)">${fmtE(aus)}</div>
        </div>
        <div class="bank-kpi">
          <div class="bank-kpi-label">Saldo ${year}</div>
          <div class="bank-kpi-val" style="color:${saldo >= 0 ? 'var(--green)' : 'var(--red)'}">
            ${saldo >= 0 ? '+' : ''}${fmtE(saldo)}
          </div>
        </div>
      </div>
      <div class="bank-bar-section">
        <div class="bank-bar-row">
          <div class="bank-bar-lbl" style="color:var(--green)">Einnahmen</div>
          <div class="bank-bar-track">
            <div class="bank-bar-fill" style="width:${pctEin}%;background:var(--green)"></div>
          </div>
          <div class="bank-bar-pct">${pctEin} %</div>
          <div class="bank-bar-amt" style="color:var(--green)">${fmtE(ein)}</div>
        </div>
        <div class="bank-bar-row">
          <div class="bank-bar-lbl" style="color:var(--red)">Ausgaben</div>
          <div class="bank-bar-track">
            <div class="bank-bar-fill" style="width:${pctAus}%;background:var(--red)"></div>
          </div>
          <div class="bank-bar-pct">${pctAus} %</div>
          <div class="bank-bar-amt" style="color:var(--red)">${fmtE(aus)}</div>
        </div>
      </div>`;
  }

  function renderAR(rechnungen, zahlungen) {
    const heute = new Date().toISOString().split('T')[0];
    const fmtE = n => parseFloat(n||0).toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €';
    const fmtD = v => { if (!v) return '—'; const [y,m,d] = v.split('-'); return `${d}.${m}.${y}`; };

    // Bereits eingegangene Teilzahlungen pro Rechnungsnummer
    const gezahlt = {};
    zahlungen.forEach(z => {
      if (z.rechNr) gezahlt[z.rechNr] = (gezahlt[z.rechNr] || 0) + Number(z.betrag || 0);
    });

    const offene = rechnungen.filter(r => r.status === 'offen');
    const ueberfaellig = offene.filter(r => r.faellig && r.faellig < heute);
    const teilbezahlt  = offene.filter(r => (gezahlt[r.nr] || 0) > 0 && (gezahlt[r.nr] || 0) < Number(r.betrag || 0));

    const restOf = r => Math.max(Number(r.betrag || 0) - (gezahlt[r.nr] || 0), 0);
    const sumGesamt       = offene.reduce((s,r) => s + restOf(r), 0);
    const sumUeberfaellig = ueberfaellig.reduce((s,r) => s + restOf(r), 0);
    const sumTeilRest     = teilbezahlt.reduce((s,r) => s + restOf(r), 0);
    const sumTeilPaid     = teilbezahlt.reduce((s,r) => s + (gezahlt[r.nr] || 0), 0);

    const el = document.getElementById('arContent');

    const summaryHTML = `
      <div class="ar-summary">
        <div class="ar-kpi">
          <div class="ar-kpi-label">Ausstehend gesamt</div>
          <div class="ar-kpi-val" style="color:var(--red)">${fmtE(sumGesamt)}</div>
          <div class="ar-kpi-sub">${offene.length} offene Rechnung${offene.length !== 1 ? 'en' : ''}</div>
        </div>
        <div class="ar-kpi">
          <div class="ar-kpi-label">Fällig nach Zahlungsfrist</div>
          <div class="ar-kpi-val" style="color:#C2410C">${fmtE(sumUeberfaellig)}</div>
          <div class="ar-kpi-sub">${ueberfaellig.length} Rechnung${ueberfaellig.length !== 1 ? 'en' : ''} überfällig</div>
        </div>
        <div class="ar-kpi">
          <div class="ar-kpi-label">Teilbezahlt – noch offen</div>
          <div class="ar-kpi-val" style="color:#3730A3">${fmtE(sumTeilRest)}</div>
          <div class="ar-kpi-sub">${teilbezahlt.length} Rechnung${teilbezahlt.length !== 1 ? 'en' : ''} · ${fmtE(sumTeilPaid)} bereits eingegangen</div>
        </div>
      </div>
      <div class="ar-divider"></div>`;

    if (!offene.length) {
      el.innerHTML = summaryHTML + `
        <div class="ar-table-wrap">
          <div class="ar-empty">
            <div class="ar-empty-icon">✓</div>
            Keine ausstehenden Rechnungen – alles beglichen!
          </div>
        </div>`;
      return;
    }

    // Sortierung: Überfällig → Teilbezahlt → Offen; innerhalb je nach Fälligkeitsdatum
    const sorted = [...offene].sort((a, b) => {
      const aF = a.faellig && a.faellig < heute ? 0 : (gezahlt[a.nr] || 0) > 0 ? 1 : 2;
      const bF = b.faellig && b.faellig < heute ? 0 : (gezahlt[b.nr] || 0) > 0 ? 1 : 2;
      if (aF !== bF) return aF - bF;
      return (a.faellig || '').localeCompare(b.faellig || '');
    });

    const rows = sorted.map(r => {
      const paid      = gezahlt[r.nr] || 0;
      const rest      = restOf(r);
      const isFaellig = r.faellig && r.faellig < heute;
      const isTeil    = paid > 0;
      const pctPaid   = Number(r.betrag || 0) > 0 ? Math.round(paid / Number(r.betrag) * 100) : 0;

      let badge;
      if (isFaellig) {
        const tage = Math.round((new Date(heute) - new Date(r.faellig)) / 86400000);
        badge = `<span class="badge-ar-faellig">${tage} Tag${tage !== 1 ? 'e' : ''} überfällig</span>`;
      } else if (isTeil) {
        badge = `<span class="badge-ar-teil">Teilbezahlt</span>`;
      } else {
        badge = `<span class="badge-ar-offen">Offen</span>`;
      }

      const teilProgress = isTeil ? `<div class="ar-progress-wrap"><div class="ar-progress-fill" style="width:${pctPaid}%"></div></div>` : '';

      return `<tr>
        <td style="font-weight:500;font-size:12px;color:var(--muted)">${r.nr}</td>
        <td style="font-weight:500">${r.kunde}</td>
        <td style="color:var(--muted)">${fmtD(r.datum)}</td>
        <td style="color:${isFaellig ? 'var(--red)' : 'var(--muted)'};font-weight:${isFaellig ? 600 : 400}">${fmtD(r.faellig)}</td>
        <td style="text-align:right">
          ${paid > 0 ? `<span style="color:#3730A3;font-weight:600">${fmtE(paid)}</span>${teilProgress}` : '<span style="color:var(--muted)">—</span>'}
        </td>
        <td style="text-align:right;font-weight:700;color:${isFaellig ? 'var(--red)' : 'var(--text)'}">${fmtE(rest)}</td>
        <td>${badge}</td>
      </tr>`;
    }).join('');

    el.innerHTML = summaryHTML + `
      <div class="ar-table-wrap">
        <table class="ar-table">
          <thead><tr>
            <th>Nr.</th><th>Kunde</th><th>Datum</th><th>Fällig am</th>
            <th style="text-align:right">Bezahlt</th>
            <th style="text-align:right">Noch offen</th>
            <th>Status</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function renderKU(umsatz, year) {
    // §19 UStG: €22.000 bis 2024, €25.000 ab 2025
    const grenze = year >= 2025 ? 25000 : 22000;
    const pctRaw = umsatz / grenze * 100;
    const pct = Math.min(pctRaw, 100);
    const pctRound = Math.round(pct);
    const rest = Math.max(grenze - umsatz, 0);
    const fmtE = n => parseFloat(n||0).toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €';

    let color, badgeClass, badgeIcon, badgeText;
    if (pct >= 90) {
      color = '#FF3B30'; badgeClass = 'ku-badge-crit'; badgeIcon = '⚠';
      badgeText = pct >= 100
        ? `Grenze überschritten! Umsatzsteuerpflicht ab Überschreitung prüfen.`
        : `Kritisch: ${pctRound} % erreicht – Umsatzsteuerpflicht droht!`;
    } else if (pct >= 70) {
      color = '#FF9500'; badgeClass = 'ku-badge-warn'; badgeIcon = '!';
      badgeText = `Hinweis: ${pctRound} % der Kleinunternehmergrenze erreicht. Noch ${fmtE(rest)} verfügbar.`;
    } else {
      color = '#34C759'; badgeClass = 'ku-badge-ok'; badgeIcon = '✓';
      badgeText = `Im grünen Bereich – noch ${fmtE(rest)} bis zur Umsatzsteuerpflicht.`;
    }

    const r = 52;
    const circ = +(2 * Math.PI * r).toFixed(2);
    const offset = +(circ * (1 - pct / 100)).toFixed(2);

    document.getElementById('kuCard').innerHTML = `
      <div class="ku-ring-wrap">
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r="${r}" fill="none" stroke="#EDEEE9" stroke-width="11"/>
          <circle cx="65" cy="65" r="${r}" fill="none" stroke="${color}" stroke-width="11"
            stroke-linecap="round"
            stroke-dasharray="${circ}"
            stroke-dashoffset="${offset}"
            transform="rotate(-90 65 65)"/>
        </svg>
        <div class="ku-ring-center">
          <div class="ku-pct-num" style="color:${color}">${pctRound}<span style="font-size:13px;font-weight:500"> %</span></div>
          <div class="ku-pct-lbl">erreicht</div>
        </div>
      </div>
      <div class="ku-info">
        <div class="ku-stats">
          <div class="ku-stat">
            <div class="ku-stat-lbl">Aktueller Umsatz</div>
            <div class="ku-stat-val" style="color:${color}">${fmtE(umsatz)}</div>
          </div>
          <div class="ku-stat">
            <div class="ku-stat-lbl">Grenze §19 UStG</div>
            <div class="ku-stat-val">${fmtE(grenze)}</div>
          </div>
          <div class="ku-stat">
            <div class="ku-stat-lbl">Noch verfügbar</div>
            <div class="ku-stat-val">${rest > 0 ? fmtE(rest) : '—'}</div>
          </div>
        </div>
        <div class="ku-track-wrap">
          <div class="ku-cap-label">Grenze: ${fmtE(grenze)}</div>
          <div class="ku-track">
            <div class="ku-fill" style="width:${pctRound}%;background:${color}"></div>
          </div>
          <div class="ku-cap" title="Umsatzsteuergrenze"></div>
        </div>
        <div class="ku-badge ${badgeClass}">${badgeIcon}&nbsp; ${badgeText}</div>
      </div>`;
  }

  function renderQuartal(zahlungen, belege, year) {
    const el = document.getElementById('quartalContent');
    if (!el) return;
    const yStr = String(year);
    const fmtE = n => parseFloat(n||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €';

    const QUARTALE = [
      { label: 'Q1', name: 'Jan – Mär', monate: ['01','02','03'] },
      { label: 'Q2', name: 'Apr – Jun', monate: ['04','05','06'] },
      { label: 'Q3', name: 'Jul – Sep', monate: ['07','08','09'] },
      { label: 'Q4', name: 'Okt – Dez', monate: ['10','11','12'] },
    ];

    const quartalDaten = QUARTALE.map(q => {
      const ein = zahlungen.filter(z => {
        if (!z.datum || !z.datum.startsWith(yStr)) return false;
        const m = z.datum.split('-')[1];
        return q.monate.includes(m);
      }).reduce((s,z) => s + Number(z.betrag||0), 0);

      const aus = belege.filter(b => {
        if (!b.datum || !b.datum.startsWith(yStr)) return false;
        const m = b.datum.split('-')[1];
        return q.monate.includes(m);
      }).reduce((s,b) => s + Number(b.betrag||0), 0);

      return { ...q, ein, aus, diff: ein - aus };
    });

    const maxEin = Math.max(...quartalDaten.map(q => q.ein), 1);
    const gesamtEin = quartalDaten.reduce((s,q) => s+q.ein, 0);
    const gesamtAus = quartalDaten.reduce((s,q) => s+q.aus, 0);
    const gesamtDiff = gesamtEin - gesamtAus;

    const kuGrenze = year >= 2025 ? 25000 : 22000;
    const istKU = gesamtEin <= kuGrenze;
    const hinweis = istKU
      ? `<div class="q-hinweis q-hinweis-ok">Kleinunternehmer §19 UStG – keine Umsatzsteuer-Voranmeldung erforderlich (Umsatz ${fmtE(gesamtEin)} &lt; ${fmtE(kuGrenze)})</div>`
      : `<div class="q-hinweis q-hinweis-warn">Umsatzgrenze §19 UStG überschritten – UStVA-Fälligkeiten: Q1 10. Apr · Q2 10. Jul · Q3 10. Okt · Q4 10. Jan</div>`;

    const cards = quartalDaten.map(q => {
      const pct = Math.round(q.ein / maxEin * 100);
      const diffClass = q.diff >= 0 ? 'q-plus' : 'q-minus';
      return `<div class="q-card">
        <div class="q-head">
          <span class="q-label">${q.label}</span>
          <span class="q-name">${q.name}</span>
        </div>
        <div class="q-bar-track"><div class="q-bar-fill" style="width:${pct}%"></div></div>
        <div class="q-row"><span class="q-row-lbl">Einnahmen</span><span class="q-row-val q-green">${fmtE(q.ein)}</span></div>
        <div class="q-row"><span class="q-row-lbl">Ausgaben</span><span class="q-row-val q-red">${fmtE(q.aus)}</span></div>
        <div class="q-divider"></div>
        <div class="q-row"><span class="q-row-lbl" style="font-weight:600">Ergebnis</span><span class="q-row-val ${diffClass}" style="font-weight:700">${q.diff >= 0 ? '+' : ''}${fmtE(q.diff)}</span></div>
      </div>`;
    }).join('');

    el.innerHTML = `
      <style>
        .q-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border); }
        .q-card { background:var(--surface);padding:16px 18px; }
        .q-head { display:flex;align-items:baseline;gap:8px;margin-bottom:10px; }
        .q-label { font-size:16px;font-weight:700;letter-spacing:-.3px; }
        .q-name { font-size:11px;color:var(--muted); }
        .q-bar-track { height:4px;background:var(--soft);border-radius:2px;margin-bottom:10px;overflow:hidden; }
        .q-bar-fill { height:100%;background:var(--accent);border-radius:2px;transition:width .3s; }
        .q-row { display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:12.5px; }
        .q-row-lbl { color:var(--muted); }
        .q-row-val { font-weight:600;font-variant-numeric:tabular-nums; }
        .q-green { color:var(--green); }
        .q-red { color:var(--red); }
        .q-plus { color:var(--green); }
        .q-minus { color:var(--red); }
        .q-divider { height:1px;background:var(--border);margin:8px 0; }
        .q-summe { display:flex;justify-content:space-between;align-items:center;padding:14px 20px;background:var(--soft);border-top:1px solid var(--border);font-size:13px; }
        .q-summe-item { display:flex;flex-direction:column;align-items:center;gap:2px; }
        .q-summe-label { font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px; }
        .q-summe-val { font-size:15px;font-weight:700;font-variant-numeric:tabular-nums; }
        .q-hinweis { padding:10px 18px;font-size:12px;line-height:1.5; }
        .q-hinweis-ok { background:#D1FAE5;color:#065F46; }
        .q-hinweis-warn { background:#FEF3C7;color:#92600A; }
        @media(max-width:768px){ .q-grid{grid-template-columns:1fr 1fr;} }
      </style>
      <div class="q-grid">${cards}</div>
      <div class="q-summe">
        <div class="q-summe-item"><span class="q-summe-label">Jahreseinnahmen</span><span class="q-summe-val q-green">${fmtE(gesamtEin)}</span></div>
        <div class="q-summe-item"><span class="q-summe-label">Jahresausgaben</span><span class="q-summe-val q-red">${fmtE(gesamtAus)}</span></div>
        <div class="q-summe-item"><span class="q-summe-label">Jahresergebnis</span><span class="q-summe-val ${gesamtDiff >= 0 ? 'q-plus' : 'q-minus'}">${gesamtDiff >= 0 ? '+' : ''}${fmtE(gesamtDiff)}</span></div>
      </div>
      ${hinweis}`;
  }

  function renderSteuern(zahlungen, belege, rechnungen, year) {
    const el = document.getElementById('steuerContent');
    if (!el) return;
    const yStr = String(year);
    const fmtE = n => parseFloat(n||0).toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €';

    const sumEin   = zahlungen.filter(z => z.datum?.startsWith(yStr)).reduce((s,z) => s + Number(z.betrag||0), 0);
    const sumAus   = belege.filter(b => b.datum?.startsWith(yStr)).reduce((s,b) => s + Number(b.betrag||0), 0);
    const gewinn   = sumEin - sumAus;
    const kuGrenze = year >= 2025 ? 25000 : 22000;
    const isKU     = sumEin <= kuGrenze;

    // GewSt §11 GewStG
    const freibetrag   = 24500;
    const gewerbeertrag = Math.max(gewinn - freibetrag, 0);
    const messbetrag    = gewerbeertrag * 0.035;
    const gewst         = Math.round(messbetrag * 4.60); // Hebesatz BS 460 %

    // ESt §32a EStG
    const gf  = year >= 2025 ? 12096 : 11604;
    const zvE = Math.max(gewinn, 0);
    let est = 0;
    if (zvE > gf) {
      if (zvE <= 17005)      { const y=(zvE-gf)/10000; est=(979.18*y+1400)*y; }
      else if (zvE <= 66760) { const z=(zvE-17005)/10000; est=(192.59*z+2397)*z+1025; }
      else if (zvE <= 277825){ est=0.42*zvE-10602; }
      else                   { est=0.45*zvE-18936; }
    }
    est = Math.max(0, Math.round(est));
    const soli = est > 18130 ? Math.round(est * 0.055) : 0;
    const gewaAnr = Math.min(Math.round(messbetrag * 3.8), est);
    const steuerlast = Math.max(est - gewaAnr, 0) + soli + gewst;

    const kuBadge = isKU
      ? `<span class="st-badge st-badge-ok">✓ §19 UStG Kleinunternehmer – Grenze ${fmtE(kuGrenze)}, keine USt-Pflicht</span>`
      : `<span class="st-badge st-badge-warn">⚠ §19 UStG Grenze überschritten – Umsatzsteuerpflicht beachten!</span>`;

    el.innerHTML = `
      <style>
        .st-kpi-row { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:var(--border); flex-shrink:0; }
        .st-kpi { background:var(--surface); padding:12px 14px; }
        .st-kpi-lbl { font-size:9.5px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px; }
        .st-kpi-val { font-size:18px; font-weight:700; letter-spacing:-.5px; }
        .st-kpi-sub { font-size:10px; color:var(--muted); margin-top:2px; }
        .st-kpi-val.green { color:var(--green); }
        .st-kpi-val.red   { color:var(--red); }
        .st-kpi-val.blue  { color:#1D4ED8; }
        .st-rows { display:flex; flex-direction:column; }
        .st-row { display:flex; justify-content:space-between; align-items:center; padding:7px 14px; border-bottom:1px solid var(--border); font-size:12px; gap:12px; }
        .st-row:last-child { border-bottom:none; }
        .st-row-lbl { color:var(--muted); flex:1; }
        .st-row-lbl b { color:var(--text); }
        .st-row-val { font-weight:600; white-space:nowrap; font-variant-numeric:tabular-nums; }
        .st-row-val.red   { color:var(--red); }
        .st-row-val.green { color:var(--green); }
        .st-row-val.muted { font-weight:400; color:var(--muted); font-size:11px; }
        .st-badge { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; font-size:11px; font-weight:500; line-height:1.4; }
        .st-badge-ok   { background:#D1F2E0; color:#1A7A3C; }
        .st-badge-warn { background:#FEF3C7; color:#92600A; }
        .st-badge-info { background:#DBEAFE; color:#1D4ED8; }
        .st-termin-row { display:flex; gap:16px; padding:7px 14px; border-bottom:1px solid var(--border); font-size:11.5px; flex-wrap:wrap; }
        .st-termin-row:last-child { border-bottom:none; }
        .st-termin-type { font-weight:600; min-width:130px; color:var(--muted); }
        .st-termin-dates { display:flex; gap:10px; flex-wrap:wrap; }
        .st-termin-date { background:var(--soft); border-radius:5px; padding:2px 7px; font-size:11px; color:var(--text); white-space:nowrap; }
        @media(max-width:768px) { .st-kpi-row { grid-template-columns:1fr 1fr; } }
      </style>

      <!-- KPI-Zeile -->
      <div class="st-kpi-row">
        <div class="st-kpi">
          <div class="st-kpi-lbl">Gewinn vor Steuern</div>
          <div class="st-kpi-val ${gewinn>=0?'green':'red'}">${fmtE(Math.abs(gewinn))}</div>
          <div class="st-kpi-sub">§4 Abs. 3 EStG</div>
        </div>
        <div class="st-kpi">
          <div class="st-kpi-lbl">Gewerbesteuer (Schätzung)</div>
          <div class="st-kpi-val ${gewst>0?'red':'green'}">${gewst>0?fmtE(gewst):'0,00 €'}</div>
          <div class="st-kpi-sub">§11 GewStG · Hebesatz BS 460 %</div>
        </div>
        <div class="st-kpi">
          <div class="st-kpi-lbl">Einkommensteuer (Schätzung)</div>
          <div class="st-kpi-val ${est>0?'red':'green'}">${fmtE(Math.max(est-gewaAnr,0)+soli)}</div>
          <div class="st-kpi-sub">§32a EStG inkl. Soli · nach §35-Anrechnung</div>
        </div>
        <div class="st-kpi">
          <div class="st-kpi-lbl">Gesamtsteuerlast (Schätzung)</div>
          <div class="st-kpi-val ${steuerlast>0?'red':'green'}">${fmtE(steuerlast)}</div>
          <div class="st-kpi-sub">GewSt + ESt + Soli kombiniert</div>
        </div>
      </div>

      <!-- Berechnungs-Detail -->
      <div class="st-rows">
        <div class="st-row">
          <span class="st-row-lbl"><b>Betriebseinnahmen</b> §4 Abs. 3 EStG</span>
          <span class="st-row-val green">+ ${fmtE(sumEin)}</span>
        </div>
        <div class="st-row">
          <span class="st-row-lbl"><b>Betriebsausgaben</b> §4 Abs. 4 EStG</span>
          <span class="st-row-val red">− ${fmtE(sumAus)}</span>
        </div>
        <div class="st-row">
          <span class="st-row-lbl"><b>Gewinn / Verlust</b> (Gewerbeertrag §7 GewStG)</span>
          <span class="st-row-val ${gewinn>=0?'green':'red'}">${gewinn>=0?'+':''} ${fmtE(gewinn)}</span>
        </div>
        <div class="st-row">
          <span class="st-row-lbl">Freibetrag §11 Abs. 1 S.3 Nr.1 GewStG</span>
          <span class="st-row-val muted">− ${fmtE(freibetrag)}</span>
        </div>
        <div class="st-row">
          <span class="st-row-lbl">Steuerpflichtiger Gewerbeertrag × 3,5 % × 460 %</span>
          <span class="st-row-val ${gewst>0?'red':'muted'}">${gewst>0?fmtE(gewst):'0,00 € (Freibetrag)'}</span>
        </div>
        <div class="st-row">
          <span class="st-row-lbl">Grundfreibetrag §32a EStG (${year})</span>
          <span class="st-row-val muted">− ${fmtE(gf)}</span>
        </div>
        <div class="st-row">
          <span class="st-row-lbl">Einkommensteuer §32a EStG</span>
          <span class="st-row-val ${est>0?'red':'muted'}">${fmtE(est)}</span>
        </div>
        ${gewaAnr>0 ? `<div class="st-row"><span class="st-row-lbl">GewSt-Anrechnung §35 EStG (3,8 × Messbetrag)</span><span class="st-row-val green">− ${fmtE(gewaAnr)}</span></div>` : ''}
        <div class="st-row">
          <span class="st-row-lbl">Solidaritätszuschlag §3 SolZG (5,5 %${soli===0?' – unter Freigrenze':''})</span>
          <span class="st-row-val ${soli>0?'red':'muted'}">${fmtE(soli)}</span>
        </div>
        <div class="st-row" style="background:var(--soft)">
          <span class="st-row-lbl" style="font-weight:700;color:var(--text)">Gesamtsteuerlast (Schätzung ohne persönl. Abzüge)</span>
          <span class="st-row-val red" style="font-size:14px">${fmtE(steuerlast)}</span>
        </div>
      </div>

      <!-- Status & Hinweise -->
      <div style="border-top:1px solid var(--border)">
        <div class="st-badge ${isKU?'st-badge-ok':'st-badge-warn'}" style="width:100%">${isKU ? '✓ §19 UStG Kleinunternehmer – Grenze ' + fmtE(kuGrenze) + ', keine Umsatzsteuer-Voranmeldung erforderlich' : '⚠ §19 UStG Grenze überschritten – Umsatzsteuerpflicht beachten!'}</div>
        <div class="st-badge st-badge-info" style="width:100%">ℹ Kirchensteuer (9 % der ESt) und persönliche Abzüge (§10, §33 EStG) nicht eingerechnet. Vorauszahlungen §37 EStG: 10. Mrz · 10. Jun · 10. Sep · 10. Dez</div>
      </div>

      <!-- Steuertermine -->
      <div style="border-top:1px solid var(--border); flex-shrink:0">
        <div style="padding:6px 14px 2px; font-size:9.5px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.5px;">Steuertermine ${year}</div>
        <div class="st-termin-row">
          <span class="st-termin-type">USt-VoA §18 UStG</span>
          <div class="st-termin-dates">
            <span class="st-termin-date">Q1 10. Apr</span>
            <span class="st-termin-date">Q2 10. Jul</span>
            <span class="st-termin-date">Q3 10. Okt</span>
            <span class="st-termin-date">Q4 10. Jan ${year+1}</span>
          </div>
        </div>
        <div class="st-termin-row">
          <span class="st-termin-type">GewSt §19 GewStG</span>
          <div class="st-termin-dates">
            <span class="st-termin-date">15. Feb</span>
            <span class="st-termin-date">15. Mai</span>
            <span class="st-termin-date">15. Aug</span>
            <span class="st-termin-date">15. Nov</span>
          </div>
        </div>
        <div class="st-termin-row">
          <span class="st-termin-type">ESt §37 EStG</span>
          <div class="st-termin-dates">
            <span class="st-termin-date">10. Mrz</span>
            <span class="st-termin-date">10. Jun</span>
            <span class="st-termin-date">10. Sep</span>
            <span class="st-termin-date">10. Dez</span>
          </div>
        </div>
        <div class="st-termin-row">
          <span class="st-termin-type">Erklärungen §147 AO</span>
          <div class="st-termin-dates">
            <span class="st-termin-date">EÜR + G: 31. Jul ${year+1}</span>
            <span class="st-termin-date">Aufbewahrung: bis ${year+10}</span>
          </div>
        </div>
      </div>`;
  }

  function exportCSV() {
    const data = loadData();
    const rows = [['Typ','Datum','Betrag','Beschreibung']];
    data.zahlungen.forEach(z => rows.push(['Einnahme', z.datum, z.betrag, `${z.kunde} ${z.rechNr||''}`.trim()]));
    data.belege.forEach(b => rows.push(['Ausgabe', b.datum, b.betrag, b.notiz||b.kat]));
    const csv = rows.map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
    a.download = `max4work_Auswertung_${currentYear}.csv`;
    a.click();
  }

  render();
