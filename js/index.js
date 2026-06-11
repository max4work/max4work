
  const _fmt = n => parseFloat(n||0).toLocaleString('de-DE', {style:'currency', currency:'EUR'});
  const _fmtDate = v => { if (!v) return '—'; const [y,m,d] = v.split('-'); return `${d}.${m}.${y}`; };
  const _today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
  const _dateStr = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const _daysDiff = (a, b) => Math.round((b - a) / 86400000);
  const _MN = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

  function loadWelcome() {
    try {
      const s = JSON.parse(localStorage.getItem('max4work_einstellungen') || '{}');
      const name = s.sName || '';
      const h = new Date().getHours();
      const gruss = h < 12 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
      const greet = document.getElementById('welcomeGreeting');
      const sub   = document.getElementById('welcomeSub');
      if (greet) greet.textContent = name ? `${gruss}, ${name}` : gruss;
      if (sub) {
        const wochentage = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
        const monate = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
        const now = new Date();
        sub.textContent = `${wochentage[now.getDay()]}, ${now.getDate()}. ${monate[now.getMonth()]} ${now.getFullYear()}`;
      }
    } catch(e) {}
    try {
      const logo = typeof loadLogo === 'function' ? loadLogo() : localStorage.getItem('max4work_logo');
      if (logo) { const img = document.getElementById('welcomeLogo'); if (img) { img.src = logo; img.style.display = 'block'; } }
    } catch(e) {}
  }

  function loadKPIs() {
    try {
      const rechnungen = JSON.parse(localStorage.getItem('max4work_rechnungen')) || [];
      const belege     = JSON.parse(localStorage.getItem('max4work_belege')) || [];
      const cfg        = JSON.parse(localStorage.getItem('max4work_rechnung_config') || '{}');
      const zahlungstage = parseInt(cfg.zahlungstage || 14);
      const heute      = _today();
      const monatPfx   = `${heute.getFullYear()}-${String(heute.getMonth()+1).padStart(2,'0')}`;

      const offen = rechnungen.filter(r => r.status === 'offen');
      const offenBetrag = offen.reduce((s, r) => s + Number(r.betrag || 0), 0);

      const ueberfaellig = offen.filter(r => {
        if (!r.datum) return false;
        const faellig = new Date(r.datum); faellig.setDate(faellig.getDate() + zahlungstage); faellig.setHours(0,0,0,0);
        return faellig < heute;
      });

      const umsatz = rechnungen
        .filter(r => r.status === 'bezahlt' && r.datum && r.datum.startsWith(monatPfx))
        .reduce((s, r) => s + Number(r.betrag || 0), 0);

      const ausgaben = belege
        .filter(b => b.datum && b.datum.startsWith(monatPfx))
        .reduce((s, b) => s + Number(b.betrag || 0), 0);

      const gewinn = umsatz - ausgaben;
      const mn = _MN[heute.getMonth()];

      const kpiOB = document.getElementById('kpiOffenBetrag');
      const kpiOS = document.getElementById('kpiOffenSub');
      if (kpiOB) { kpiOB.textContent = offenBetrag > 0 ? _fmt(offenBetrag) : '–'; kpiOB.className = 'kpi-value' + (offenBetrag > 0 ? ' amber' : ''); }
      if (kpiOS) kpiOS.textContent = offen.length === 1 ? '1 Rechnung offen' : `${offen.length} Rechnungen offen`;

      const kpiU = document.getElementById('kpiUmsatz');
      const kpiUS = document.getElementById('kpiUmsatzSub');
      if (kpiU) { kpiU.textContent = umsatz > 0 ? _fmt(umsatz) : '–'; }
      if (kpiUS) kpiUS.textContent = `${mn} ${heute.getFullYear()}`;

      const kpiA = document.getElementById('kpiAusgaben');
      const kpiAS = document.getElementById('kpiAusgabenSub');
      if (kpiA) kpiA.textContent = ausgaben > 0 ? _fmt(ausgaben) : '–';
      if (kpiAS) kpiAS.textContent = belege.filter(b => b.datum && b.datum.startsWith(monatPfx)).length + ' Belege';

      const kpiG = document.getElementById('kpiGewinn');
      const kpiGS = document.getElementById('kpiGewinnSub');
      if (kpiG) {
        kpiG.textContent = (umsatz > 0 || ausgaben > 0) ? _fmt(gewinn) : '–';
        kpiG.className = 'kpi-value' + (gewinn > 0 ? ' green' : gewinn < 0 ? ' red' : '');
      }
      if (kpiGS) kpiGS.textContent = `${mn} ${heute.getFullYear()}`;

      const kpiUE = document.getElementById('kpiUeberfaellig');
      const kpiUES = document.getElementById('kpiUeberfaelligSub');
      if (kpiUE) { kpiUE.textContent = ueberfaellig.length; kpiUE.className = 'kpi-value' + (ueberfaellig.length > 0 ? ' red' : ''); }
      if (kpiUES) kpiUES.textContent = ueberfaellig.length > 0 ? _fmt(ueberfaellig.reduce((s,r)=>s+Number(r.betrag||0),0)) + ' überfällig' : 'Keine überfälligen';

      document.querySelectorAll('#navPill').forEach(el => el.textContent = offen.length);

    } catch(e) {}
  }

  function loadUmsatzChart() {
    try {
      const zahlungen = JSON.parse(localStorage.getItem('max4work_zahlungen') || '[]');
      const belege    = JSON.parse(localStorage.getItem('max4work_belege') || '[]');
      const heute     = new Date();

      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(heute.getFullYear(), heute.getMonth() - i, 1);
        months.push({
          key:   `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
          label: _MN[d.getMonth()],
        });
      }

      const data = months.map(m => ({
        label: m.label,
        ein: zahlungen.filter(z => (z.datum||'').startsWith(m.key)).reduce((s,z) => s + +z.betrag, 0),
        aus: belege.filter(b => (b.datum||'').startsWith(m.key)).reduce((s,b) => s + +b.betrag, 0),
      }));

      const maxVal = Math.max(...data.map(d => Math.max(d.ein, d.aus)), 1);

      const wrap = document.getElementById('umsatzChartWrap');
      if (!wrap) return;

      const hasData = data.some(d => d.ein > 0 || d.aus > 0);

      wrap.innerHTML = `
        <div class="chart-outer" id="chartBars"></div>
        <div class="chart-legend">
          <span class="chart-leg"><span class="chart-leg-dot" style="background:var(--green)"></span> Einnahmen</span>
          <span class="chart-leg"><span class="chart-leg-dot" style="background:var(--red)"></span> Ausgaben</span>
        </div>
      `;

      const barsEl = document.getElementById('chartBars');
      barsEl.innerHTML = data.map(d => {
        const hEin = hasData ? Math.max(d.ein > 0 ? 4 : 0, Math.round((d.ein / maxVal) * 100)) : 0;
        const hAus = hasData ? Math.max(d.aus > 0 ? 4 : 0, Math.round((d.aus / maxVal) * 100)) : 0;
        return `
          <div class="chart-col" title="${d.label}: Einnahmen ${_fmt(d.ein)}, Ausgaben ${_fmt(d.aus)}">
            <div class="chart-bars-pair">
              <div class="chart-bar-ein" style="height:${hEin}%"></div>
              <div class="chart-bar-aus" style="height:${hAus}%"></div>
            </div>
            <div class="chart-month">${d.label}</div>
          </div>`;
      }).join('');

      if (!hasData) {
        wrap.innerHTML += '<div class="chart-empty">Noch keine Einnahmen oder Ausgaben erfasst.</div>';
      }
    } catch(e) {}
  }

  function loadOffeneRechnungen() {
    try {
      const rechnungen = JSON.parse(localStorage.getItem('max4work_rechnungen')) || [];
      const cfg        = JSON.parse(localStorage.getItem('max4work_rechnung_config') || '{}');
      const zahlungstage = parseInt(cfg.zahlungstage || 14);
      const heute      = _today();

      const offen = rechnungen
        .filter(r => r.status === 'offen')
        .map(r => {
          const faellig = r.datum ? (() => { const d = new Date(r.datum); d.setDate(d.getDate() + zahlungstage); d.setHours(0,0,0,0); return d; })() : null;
          const ueberfaelligTage = faellig ? _daysDiff(faellig, heute) : 0;
          return { ...r, faellig, ueberfaelligTage };
        })
        .sort((a, b) => {
          if (a.ueberfaelligTage > 0 && b.ueberfaelligTage <= 0) return -1;
          if (b.ueberfaelligTage > 0 && a.ueberfaelligTage <= 0) return 1;
          return (a.datum || '').localeCompare(b.datum || '');
        });

      const liste = document.getElementById('rechnungenListe');
      if (!liste) return;
      if (offen.length === 0) { liste.innerHTML = '<div class="panel-empty">Keine offenen Rechnungen.</div>'; return; }

      liste.innerHTML = offen.slice(0, 8).map(r => {
        const ueLabel = r.ueberfaelligTage > 0
          ? `<span class="inv-days">${r.ueberfaelligTage} Tage überfällig</span>`
          : (r.faellig ? `<span style="font-size:11px;color:var(--muted);">fällig ${_fmtDate(_dateStr(r.faellig))}</span>` : '');
        return `<div class="inv-row${r.ueberfaelligTage > 0 ? ' ueberfaellig' : ''}">
          <span class="inv-nr">${r.nr || r.id || ''}</span>
          <span class="inv-kunde">${r.kunde || '—'}</span>
          ${ueLabel}
          <span class="inv-betrag">${_fmt(r.betrag || 0)}</span>
        </div>`;
      }).join('');
    } catch(e) {}
  }

  function loadNaechsteTermine() {
    try {
      const termine = JSON.parse(localStorage.getItem('max4work_termine')) || [];
      const kunden  = JSON.parse(localStorage.getItem('max4work_kunden')) || [];
      const heute   = _today();
      const heuteStr = _dateStr(heute);
      const endDate = new Date(heute); endDate.setDate(endDate.getDate() + 6);
      const endStr  = _dateStr(endDate);

      const upcoming = termine
        .filter(t => t.datum && t.datum >= heuteStr && t.datum <= endStr)
        .sort((a, b) => {
          const dc = (a.datum||'').localeCompare(b.datum||'');
          if (dc !== 0) return dc;
          return (a.von||'00:00').localeCompare(b.von||'00:00');
        });

      const liste = document.getElementById('naechsteTermine');
      if (!liste) return;
      if (upcoming.length === 0) {
        liste.innerHTML = '<div class="panel-empty">Keine Termine in den nächsten 7 Tagen.</div>';
        return;
      }

      const wt = ['So','Mo','Di','Mi','Do','Fr','Sa'];

      liste.innerHTML = upcoming.slice(0, 8).map(t => {
        const kunde = kunden.find(k => k.name && t.kunde && k.name.trim() === t.kunde.trim());
        const zeitLabel = t.ganztag === 'ja' ? 'Ganztag' : (t.von ? `${t.von}${t.bis ? '–'+t.bis : ''}` : '');
        const hauptName = t.kunde || t.titel || '(kein Titel)';
        const subTitel  = t.kunde && t.titel ? t.titel : '';
        const tel = kunde?.tel ? `<a href="tel:${kunde.tel}" style="color:var(--muted);text-decoration:none;font-size:10.5px;">${kunde.tel}</a>` : '';
        const ort = kunde?.ort ? `<span style="color:var(--muted);font-size:10.5px;">${kunde.ort.replace(/^\d{5}\s*/,'')}</span>` : '';
        const extras = [tel, ort].filter(Boolean).join(' &nbsp;·&nbsp; ');
        const isToday = t.datum === heuteStr;
        const tDate = new Date(t.datum + 'T00:00:00');
        const dateBadgeText = isToday ? 'Heute' : `${wt[tDate.getDay()]} ${tDate.getDate()}.`;
        return `<div class="termin-row">
          <div class="termin-dot" style="background:${t.farbe||'#888'};margin-top:5px;"></div>
          <div class="termin-body">
            <div class="termin-title">${hauptName}</div>
            <div class="termin-meta">${subTitel}${subTitel && zeitLabel ? ' · ' : ''}${zeitLabel}</div>
            ${extras ? `<div style="margin-top:2px;">${extras}</div>` : ''}
          </div>
          <span class="termin-today${isToday ? '' : ' termin-future'}">${dateBadgeText}</span>
        </div>`;
      }).join('');
    } catch(e) {}
  }

  function loadDashboard() {
    loadWelcome();
    loadKPIs();
    loadUmsatzChart();
    loadOffeneRechnungen();
    loadNaechsteTermine();
  }

  loadDashboard();
