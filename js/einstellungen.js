  const SAVE_KEY = 'max4work_einstellungen';
  const TOGGLE_KEY = 'max4work_features';
  const LAYOUT_KEY = 'max4work_panel_layout';

  /* ── Ungespeicherte Änderungen ── */
  let _pendingToggles = null;
  let _pendingTheme = null;
  let _pendingAppDesign = null;
  let _pendingLayout = null;
  let _pendingScheme = null;
  let _prevScheme = null;
  function markUnsaved() {
    document.getElementById('unsavedBar').style.display = 'flex';
  }

  function saveAllChanges() {
    if (_pendingToggles) {
      try {
        const saved = JSON.parse(localStorage.getItem(TOGGLE_KEY) || '{}');
        Object.assign(saved, _pendingToggles);
        localStorage.setItem(TOGGLE_KEY, JSON.stringify(saved));
      } catch(e) {}
    }
    if (_pendingTheme) saveTheme(_pendingTheme);
    if (_pendingAppDesign && typeof applyAppDesign === 'function') applyAppDesign(_pendingAppDesign);
    if (_pendingLayout) savePanelLayout(_pendingLayout);
    if (_pendingScheme && typeof applyColorScheme === 'function') applyColorScheme(_pendingScheme);
    _pendingToggles = null; _pendingTheme = null; _pendingAppDesign = null; _pendingLayout = null; _pendingScheme = null; _prevScheme = null;
    document.getElementById('unsavedBar').style.display = 'none';
    const title = document.getElementById('topbarTitle');
    const orig = title.textContent;
    title.textContent = '✓ Gespeichert!';
    setTimeout(() => title.textContent = orig, 2000);
  }

  function discardChanges() {
    if (_pendingTheme) {
      const saved = JSON.parse(localStorage.getItem('max4work_theme') || 'null') || { accent: '#ffffff', pale: '#f8f8f8', dark: '#1a1a1a' };
      activeThemeAccent = saved.accent;
      applyTheme(saved);
      buildThemeGrid();
    }
    if (_pendingAppDesign) loadAppDesignSelection();
    const hadPendingScheme = !!_pendingScheme;
    if (hadPendingScheme && _prevScheme && typeof applyColorScheme === 'function') applyColorScheme(_prevScheme);
    _pendingToggles = null; _pendingTheme = null; _pendingAppDesign = null; _pendingLayout = null; _pendingScheme = null; _prevScheme = null;
    if (hadPendingScheme) buildSchemeGrid();
    document.getElementById('unsavedBar').style.display = 'none';
    loadToggles();
    buildMapProviderGrid();
    renderLayoutEditor();
  }

  // Spiegelt PANEL_CONFIG aus auswertung.html – hier für den Editor
  const PANEL_DEFS = [
    { key: 'panel_kpiGrid',          label: 'Kennzahlen (KPI-Übersicht)',      allowHalf: false },
    { key: 'panel_bank',             label: 'Meine Bank',                       allowHalf: true  },
    { key: 'panel_top5',             label: 'Top 5 Kunden',                     allowHalf: true  },
    { key: 'panel_kleinunternehmer', label: 'Kleinunternehmergrenze §19 UStG',  allowHalf: true  },
    { key: 'panel_ausstehend',       label: 'Ausstehende Rechnungen',           allowHalf: false },
    { key: 'panel_chartMonat',       label: 'Umsatz pro Monat',                 allowHalf: false },
    { key: 'panel_chartVergleich',   label: 'Einnahmen vs. Ausgaben',           allowHalf: true  },
    { key: 'panel_quartal',          label: 'Quartalsübersicht',                allowHalf: false },
    // Neue Panels hier ergänzen (key, label, allowHalf)
  ];

  function loadPanelLayout() {
    try {
      const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null');
      if (saved && Array.isArray(saved) && saved.length) {
        const keys = new Set(saved.map(p => p.key));
        PANEL_DEFS.forEach(d => { if (!keys.has(d.key)) saved.push({ key: d.key, size: 'full' }); });
        return saved;
      }
    } catch(e) {}
    return PANEL_DEFS.map(d => ({ key: d.key, size: 'full' }));
  }

  function savePanelLayout(layout) {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch(e) {}
  }

  function isVisible(key) {
    try {
      const f = JSON.parse(localStorage.getItem(TOGGLE_KEY) || '{}');
      const def = TOGGLE_DEFAULTS[key];
      return f[key] !== undefined ? f[key] : (def !== undefined ? def : false);
    } catch(e) { return false; }
  }

  let dragSrcIdx = null;

  function renderLayoutEditor(layoutData) {
    const layout = layoutData || loadPanelLayout();
    const list = document.getElementById('layoutList');
    list.innerHTML = layout.map((item, i) => {
      const def = PANEL_DEFS.find(d => d.key === item.key);
      if (!def) return '';
      const vis = (_pendingToggles && _pendingToggles[item.key] !== undefined) ? _pendingToggles[item.key] : isVisible(item.key);
      const isHalf = item.size === 'half';
      return `<div class="layout-item" id="li-${i}"
          draggable="true"
          ondragstart="layoutDragStart(event,${i})"
          ondragover="layoutDragOver(event,${i})"
          ondragleave="layoutDragLeave(event)"
          ondrop="layoutDrop(event,${i})"
          ondragend="layoutDragEnd()">
        <span class="drag-handle" title="Ziehen zum Verschieben">⠿⠿</span>
        <span class="layout-item-name">${def.label}</span>
        <button class="layout-vis-badge ${vis ? 'layout-vis-on' : 'layout-vis-off'}" onclick="togglePanelVisibility(${i})" title="Klicken zum Ein-/Ausblenden">${vis ? 'Sichtbar' : 'Ausgeblendet'}</button>
        <div class="size-toggle">
          <button class="size-btn${!isHalf ? ' on' : ''}" onclick="setSize(${i},'full')">Voll</button>
          <button class="size-btn${isHalf ? ' on' : ''}" onclick="setSize(${i},'half')"
            ${!def.allowHalf ? 'disabled title="Dieses Fenster unterstützt keine halbe Breite"' : ''}>Halb</button>
        </div>
      </div>`;
    }).join('');
  }

  function setSize(idx, size) {
    const layout = (_pendingLayout || loadPanelLayout()).map(x => ({ ...x }));
    if (!layout[idx]) return;
    layout[idx].size = size;
    _pendingLayout = layout;
    renderLayoutEditor(layout);
    markUnsaved();
  }

  function togglePanelVisibility(idx) {
    const layout = _pendingLayout || loadPanelLayout();
    if (!layout[idx]) return;
    const key = layout[idx].key;
    const curVis = (_pendingToggles && _pendingToggles[key] !== undefined)
      ? _pendingToggles[key]
      : isVisible(key);
    if (!_pendingToggles) _pendingToggles = {};
    _pendingToggles[key] = !curVis;
    renderLayoutEditor(_pendingLayout || loadPanelLayout());
    markUnsaved();
  }

  function layoutDragStart(e, idx) {
    dragSrcIdx = idx;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { const el = document.getElementById('li-' + idx); if (el) el.classList.add('dragging'); }, 0);
  }

  function layoutDragOver(e, idx) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.layout-item').forEach(el => el.classList.remove('drag-over'));
    const el = document.getElementById('li-' + idx);
    if (el && idx !== dragSrcIdx) el.classList.add('drag-over');
  }

  function layoutDragLeave(e) {
    if (e.target.closest) e.target.closest('.layout-item')?.classList.remove('drag-over');
  }

  function layoutDrop(e, toIdx) {
    e.preventDefault();
    if (dragSrcIdx === null || dragSrcIdx === toIdx) { layoutDragEnd(); return; }
    const layout = (_pendingLayout || loadPanelLayout()).map(x => ({ ...x }));
    const moved = layout.splice(dragSrcIdx, 1)[0];
    layout.splice(toIdx, 0, moved);
    dragSrcIdx = null;
    _pendingLayout = layout;
    renderLayoutEditor(layout);
    markUnsaved();
  }

  function layoutDragEnd() {
    dragSrcIdx = null;
    document.querySelectorAll('.layout-item').forEach(el => {
      el.classList.remove('dragging', 'drag-over');
    });
  }

  const SECTION_TITLES = {
    design:       'Einstellungen – Design',
    firma:        'Einstellungen – Firma',
    funktionen:   'Einstellungen – Funktionen',
    daten:        'Einstellungen – Daten & Sync',
    portale:      'Einstellungen – Behörden & Portale',
    handbuch:     'Einstellungen – Handbuch',
    rechnung:     'Einstellungen – Rechnungsblatt-Design',
    email:        'Einstellungen – E-Mail',
    datentransfer:'Einstellungen – Datentransfer',
    account:      'Einstellungen – Account',
  };

  function showSection(id) {
    document.querySelectorAll('.settings-section').forEach(s => s.style.display = 'none');
    document.getElementById('section-' + id).style.display = id === 'rechnung' ? 'grid' : 'flex';
    document.querySelectorAll('.stab').forEach(t => t.classList.remove('on'));
    document.querySelector(`.stab[data-section="${id}"]`).classList.add('on');
    document.getElementById('topbarTitle').textContent = SECTION_TITLES[id] || 'Einstellungen';
    try { localStorage.setItem('max4work_settings_tab', id); } catch(e) {}
    if (id === 'account' && typeof _loadAccountTab === 'function') _loadAccountTab();
    if (typeof refreshSubNav === 'function') refreshSubNav();
  }

  /* ── Feature-Toggles ── */
  const TOGGLE_DEFAULTS = {
    autoSuggestInvoice: false, livePreview: false, highlightOverdue: false,
    bankAbgleich: false, datevSchnittstelle: false,
    // Auswertungs-Panels – neue Panels hier ergänzen (Key + true/false)
    panel_kpiGrid: false, panel_bank: false, panel_top5: false,
    panel_kleinunternehmer: false, panel_ausstehend: false,
    panel_chartMonat: false, panel_chartVergleich: false, panel_quartal: false,
  };

  function loadToggles() {
    try {
      const saved = JSON.parse(localStorage.getItem(TOGGLE_KEY) || '{}');
      Object.keys(TOGGLE_DEFAULTS).forEach(id => {
        const val = saved[id] !== undefined ? saved[id] : TOGGLE_DEFAULTS[id];
        const el = document.getElementById(id);
        if (el) el.checked = val;
      });
      toggleBankPanel(getFeature('bankAbgleich'));
    } catch(e) {}
  }

  /* ── Backup ── */
  function loadBackupStatus() {
    const ts = parseInt(localStorage.getItem('max4work_last_backup') || '0');
    const interval = localStorage.getItem('max4work_backup_interval') || '7';
    document.getElementById('backupInterval').value = interval;
    if (!ts) {
      document.getElementById('lastBackupDate').value = 'Noch kein Backup';
      document.getElementById('backupStatusBadge').textContent = 'Kein Backup';
      document.getElementById('backupStatusBadge').style.cssText = 'font-size:11px;padding:2px 8px;border-radius:20px;font-weight:600;background:#FEE2E2;color:#991B1B;';
    } else {
      const d = new Date(ts);
      const days = Math.floor((Date.now() - ts) / 86400000);
      document.getElementById('lastBackupDate').value = d.toLocaleDateString('de-DE') + (days === 0 ? ' (heute)' : ` (vor ${days} Tag${days!==1?'en':''})`);
      const ok = days <= parseInt(interval||7);
      document.getElementById('backupStatusBadge').textContent = ok ? '✓ Aktuell' : `${days} Tage alt`;
      document.getElementById('backupStatusBadge').style.cssText = `font-size:11px;padding:2px 8px;border-radius:20px;font-weight:600;background:${ok?'#D1FAE5':'#FEF3C7'};color:${ok?'#065F46':'#92600A'};`;
    }
  }

  function saveBackupInterval(val) {
    localStorage.setItem('max4work_backup_interval', val);
  }

  function restoreBackup(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data._app && !data.max4work_einstellungen && !data.max4work_rechnungen) {
          alert('Ungültige Backup-Datei.'); return;
        }
        if (!confirm(`Backup vom ${new Date(data._exportedAt||0).toLocaleDateString('de-DE')} wiederherstellen?\n\nAchtung: Alle aktuellen Daten werden überschrieben.`)) return;
        const keys = [
          'max4work_kunden','max4work_rechnungen','max4work_rechnungen_history',
          'max4work_belege','max4work_termine','max4work_produkte','max4work_einstellungen',
          'max4work_zahlungen','max4work_theme','max4work_features',
          'max4work_fahrtenbuch','max4work_fahrzeuge',
          'max4work_rechnung_config','max4work_blattvorlagen',
          'max4work_mahn_config','max4work_wiederkehrend',
          'max4work_gobd_log','max4work_xrechnungen',
          'max4work_email_settings','max4work_email_signaturen',
          'max4work_portale','max4work_logo','max4work_ocr_key','max4work_ang_counter',
          'max4work_kassenbuch','max4work_kassenbuch_anfangsbestand',
        ];
        let restored = 0;
        keys.forEach(k => { if (data[k] !== undefined && data[k] !== null) { localStorage.setItem(k, JSON.stringify(data[k])); restored++; } });
        localStorage.setItem('max4work_last_backup', String(Date.now()));
        alert(`✓ ${restored} Datensätze erfolgreich wiederhergestellt.\nSeite wird neu geladen.`);
        location.reload();
      } catch(err) { alert('Fehler beim Lesen der Backup-Datei.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  /* ── GitHub Token ── */
  function saveGhToken() {
    const val = document.getElementById('ghTokenInput').value.trim();
    const status = document.getElementById('ghTokenStatus');
    if (val) {
      localStorage.setItem('max4work_gh_token', val);
      status.style.color = '#34C759';
      status.textContent = '✓ Token gespeichert';
      setTimeout(() => status.textContent = '', 3000);
    } else {
      localStorage.removeItem('max4work_gh_token');
      status.style.color = 'var(--muted)';
      status.textContent = 'Token entfernt';
      setTimeout(() => status.textContent = '', 2000);
    }
  }

  function toggleGhTokenVis() {
    const inp = document.getElementById('ghTokenInput');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  }

  async function publishCalendarFromSettings() {
    const token = localStorage.getItem('max4work_gh_token') || '';
    const status = document.getElementById('ghTokenStatus');
    if (!token) { status.style.color='var(--red)'; status.textContent = 'Kein Token gespeichert.'; return; }
    const termine = JSON.parse(localStorage.getItem('max4work_termine') || '[]');
    if (!termine.length) { status.style.color='var(--muted)'; status.textContent = 'Keine Termine vorhanden.'; return; }
    status.style.color = 'var(--muted)'; status.textContent = 'Wird veröffentlicht…';
    const btn = document.getElementById('pubCalSettBtn');
    if (btn) btn.disabled = true;
    function icsDate(datum, zeit) {
      if (!datum) return null;
      const [y,m,d] = datum.split('-');
      if (!zeit) return `${y}${m}${d}`;
      const [h,min] = zeit.split(':');
      return `${y}${m}${d}T${h}${min}00`;
    }
    function icsEscape(s) {
      return String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
    }
    const colorCat = {'#C8D93A':'Lime','#34C759':'Grün','#3B82F6':'Blau','#8B5CF6':'Lila','#F97316':'Orange','#EF4444':'Rot','#EC4899':'Pink'};
    let lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//max4work//Terminplaner//DE','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:max4work Termine','X-WR-TIMEZONE:Europe/Berlin'];
    termine.forEach(t => {
      lines.push('BEGIN:VEVENT', `UID:max4work-${t.id}@max4work.com`);
      lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}Z`);
      if (t.ganztag === 'ja') {
        lines.push(`DTSTART;VALUE=DATE:${icsDate(t.datum)}`);
        const end = new Date(t.datum + 'T00:00:00'); end.setDate(end.getDate()+1);
        const [ey,em,ed] = end.toISOString().split('T')[0].split('-');
        lines.push(`DTEND;VALUE=DATE:${ey}${em}${ed}`);
      } else {
        lines.push(`DTSTART;TZID=Europe/Berlin:${icsDate(t.datum, t.von||'00:00')}`);
        lines.push(`DTEND;TZID=Europe/Berlin:${icsDate(t.datum, t.bis||t.von||'01:00')}`);
      }
      lines.push(`SUMMARY:${icsEscape(t.titel)}`);
      if (t.kunde) lines.push(`LOCATION:${icsEscape(t.kunde)}`);
      if (t.notiz) lines.push(`DESCRIPTION:${icsEscape(t.notiz)}`);
      if (t.farbe && colorCat[t.farbe]) lines.push(`CATEGORIES:${colorCat[t.farbe]}`);
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    const ics = lines.join('\r\n');
    const encoded = btoa(unescape(encodeURIComponent(ics)));
    const api = 'https://api.github.com/repos/max4work/max4work/contents/calendar.ics';
    const hdr = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };
    let sha = null;
    try { const c = await fetch(api, {headers:hdr}); if (c.ok) sha = (await c.json()).sha; } catch(e) {}
    const body = { message: `Update calendar.ics (${termine.length} Termine)`, content: encoded };
    if (sha) body.sha = sha;
    try {
      const res = await fetch(api, {method:'PUT', headers:hdr, body:JSON.stringify(body)});
      if (res.ok) {
        status.style.color = '#34C759';
        status.textContent = `✓ ${termine.length} Termin${termine.length!==1?'e':''} veröffentlicht – iPhone aktualisiert automatisch`;
      } else {
        const err = await res.json().catch(()=>({}));
        status.style.color = 'var(--red)';
        status.textContent = 'Fehler: ' + (err.message || 'Token prüfen');
      }
    } catch(e) { status.style.color='var(--red)'; status.textContent='Netzwerkfehler'; }
    if (btn) btn.disabled = false;
  }

  /* Token beim Laden eintragen */
  function _loadGhToken() {
    const t = localStorage.getItem('max4work_gh_token') || '';
    const inp = document.getElementById('ghTokenInput');
    if (inp && t) inp.value = t;
  }

  /* ── WebCal ── */
  function updateWebcalUrl() {
    const custom = document.getElementById('customDomain').value.trim();
    const domain = custom || 'max4work.com';
    const url = `webcal://${domain}/calendar.ics`;
    document.getElementById('webcalUrl').value = url;
    document.getElementById('webcalOpenBtn').href = url;
  }

  function copyWebcal() {
    const url = document.getElementById('webcalUrl').value;
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.getElementById('copyBtnText');
      btn.textContent = '✓ Kopiert!';
      setTimeout(() => btn.textContent = 'Kopieren', 2000);
    }).catch(() => {
      document.getElementById('webcalUrl').select();
      document.execCommand('copy');
    });
  }

  function updateToggle(id, val) {
    if (!_pendingToggles) _pendingToggles = {};
    _pendingToggles[id] = val;
    markUnsaved();
  }

  function getFeature(id) {
    try {
      const saved = JSON.parse(localStorage.getItem(TOGGLE_KEY) || '{}');
      return saved[id] !== undefined ? saved[id] : TOGGLE_DEFAULTS[id];
    } catch(e) { return TOGGLE_DEFAULTS[id]; }
  }

  /* ── Theme ── */
  let activeThemeAccent = null;

  function buildThemeGrid() {
    const current = activeThemeAccent || (JSON.parse(localStorage.getItem('max4work_theme')||'null')?.accent) || '#ffffff';
    document.getElementById('themeGrid').innerHTML = PRESET_THEMES.map(t => `
      <div class="theme-swatch${t.accent===current?' on':''}" style="background:${t.accent};" title="${t.name}"
           onclick="selectPresetTheme('${t.accent}')">
        <span>${t.name}</span>
      </div>`).join('');
    document.getElementById('customColorInput').value = current;
    document.getElementById('customColorPreview').style.background = current;
    document.getElementById('customColorHex').textContent = current;
  }

  function selectPresetTheme(accent) {
    const t = PRESET_THEMES.find(x => x.accent === accent);
    activeThemeAccent = accent;
    applyTheme(t);
    buildThemeGrid();
    _pendingTheme = t;
    markUnsaved();
  }

  function previewCustomColor(hex) {
    activeThemeAccent = hex;
    document.getElementById('customColorPreview').style.background = hex;
    document.getElementById('customColorHex').textContent = hex;
    document.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('on'));
    applyTheme({ accent: hex });
  }

  function trackCustomColor(hex) {
    _pendingTheme = { accent: hex };
    markUnsaved();
  }
  const DEFAULTS = {
    sName: '', sContact: '', sStreet: '', sPlz: '', sCity: '',
    sTel: '', sEmail: '', sWeb: '', sStNr: '',
    sBank: '', sIBAN: '', sBIC: '', invPayment: ''
  };
  const FIELDS = Object.keys(DEFAULTS);

  /* ── Logo ── */
  function _logoWidgets() {
    return [
      { none:'logoNone',   img:'logoPreviewImg',   btn:'logoRemoveBtn',   file:'logoFileInput'   },
      { none:'logoNone_f', img:'logoPreviewImg_f', btn:'logoRemoveBtn_f', file:'logoFileInput_f' }
    ];
  }
  function handleLogoUpload(e) {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      compressLogoDataURL(ev.target.result, function(compressed) {
        if (saveLogo(compressed)) {
          showLogoPreview(compressed);
          if (typeof updateSidebarUser === 'function') updateSidebarUser();
        } else document.getElementById('logoFileInput').value = '';
      });
    };
    r.readAsDataURL(file);
  }
  function handleLogoUploadFirma(e) {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      compressLogoDataURL(ev.target.result, function(compressed) {
        if (saveLogo(compressed)) {
          showLogoPreview(compressed);
          if (typeof updateSidebarUser === 'function') updateSidebarUser();
        } else document.getElementById('logoFileInput_f').value = '';
      });
    };
    r.readAsDataURL(file);
  }
  function showLogoPreview(url) {
    _logoWidgets().forEach(w => {
      const none = document.getElementById(w.none); if (none) none.style.display = 'none';
      const img  = document.getElementById(w.img);  if (img)  { img.src = url; img.style.display = 'block'; }
      const btn  = document.getElementById(w.btn);  if (btn)  btn.style.display = 'inline';
    });
    ['logoPreviewBox','logoPreviewBox_f'].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.display = 'block';
    });
    if (typeof renderInvPreview === 'function') renderInvPreview();
  }
  function removeLogo() {
    clearLogo();
    _logoWidgets().forEach(w => {
      const none = document.getElementById(w.none); if (none) none.style.display = 'block';
      const img  = document.getElementById(w.img);  if (img)  { img.src = ''; img.style.display = 'none'; }
      const btn  = document.getElementById(w.btn);  if (btn)  btn.style.display = 'none';
      const fi   = document.getElementById(w.file); if (fi)   fi.value = '';
    });
    ['logoPreviewBox','logoPreviewBox_f'].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    if (typeof renderInvPreview === 'function') renderInvPreview();
    if (typeof updateSidebarUser === 'function') updateSidebarUser();
  }

  function load() {
    const lastTab = localStorage.getItem('max4work_settings_tab') || 'design';
    showSection(lastTab);
    buildThemeGrid();
    loadToggles();
    loadBackupStatus();
    renderLayoutEditor();
    renderPortals();
    buildSchemeGrid();
    buildMapProviderGrid();
    initInvSection();
    initEmailSettings();
    _loadGhToken();
    _loadAccountTab();
    const existingLogo = loadLogo();
    if (existingLogo) showLogoPreview(existingLogo);

    try {
      const raw = localStorage.getItem(SAVE_KEY);
      const data = raw ? JSON.parse(raw) : DEFAULTS;
      FIELDS.forEach(id => { const el = document.getElementById(id); if (el) el.value = data[id] ?? DEFAULTS[id]; });
      const fb = document.getElementById('isFreiberufler');
      if (fb) fb.checked = !!data.isFreiberufler;
    } catch(e) {
      FIELDS.forEach(id => { const el = document.getElementById(id); if (el) el.value = DEFAULTS[id]; });
    }
  }

  function updateFreiberufler(checked) {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      data.isFreiberufler = checked;
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch(e) {}
  }

  function speichern() {
    const data = {};
    FIELDS.forEach(id => { const el = document.getElementById(id); if (el) data[id] = el.value; });
    try {
      // Theme speichern
      if (activeThemeAccent) {
        const preset = PRESET_THEMES.find(t => t.accent === activeThemeAccent);
        saveTheme(preset || { accent: activeThemeAccent });
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      if (typeof updateSidebarUser === 'function') updateSidebarUser();
      // FIX: Auch rechnung-draft aktualisieren
      const draftRaw = localStorage.getItem('max4work_rechnung_draft');
      if (draftRaw) {
        const draft = JSON.parse(draftRaw);
        FIELDS.forEach(id => { if (data[id] !== undefined) draft[id] = data[id]; });
        localStorage.setItem('max4work_rechnung_draft', JSON.stringify(draft));
      }
      const hint = document.getElementById('saveHint');
      hint.textContent = '✓ Gespeichert!'; hint.className = 'save-hint ok';
      setTimeout(() => { hint.textContent = 'Änderungen werden lokal gespeichert.'; hint.className = 'save-hint'; }, 2500);
    } catch(e) { alert('Fehler beim Speichern.'); }
  }

  function reset() {
    if (!confirm('Alle Einstellungen auf Standardwerte zurücksetzen?')) return;
    FIELDS.forEach(id => { const el = document.getElementById(id); if (el) el.value = DEFAULTS[id]; });
    try { localStorage.removeItem(SAVE_KEY); } catch(e) {}
    const hint = document.getElementById('saveHint');
    hint.textContent = 'Zurückgesetzt.'; hint.className = 'save-hint ok';
    setTimeout(() => { hint.textContent = 'Änderungen werden lokal gespeichert.'; hint.className = 'save-hint'; }, 2500);
  }

  /* ── Handbuch ── */
  function toggleHb(headerEl) {
    const sec = headerEl.closest('.hb-sec');
    const isOpen = sec.classList.contains('open');
    document.querySelectorAll('.hb-sec.open').forEach(s => s.classList.remove('open'));
    if (!isOpen) sec.classList.add('open');
  }

  /* ── Kartenanbieter ── */
  const MAP_PROVIDERS_LIST = [
    { id:'auto',   name:'Automatisch',   desc:'Apple auf Mac/iOS,\nGoogle sonst',  icon:'⚡' },
    { id:'apple',  name:'Apple Karten',  desc:'maps.apple.com',                    icon:'🗺️' },
    { id:'google', name:'Google Maps',   desc:'maps.google.com',                   icon:'📍' },
    { id:'osm',    name:'OpenStreetMap', desc:'openstreetmap.org',                 icon:'🌐' },
    { id:'bing',   name:'Bing Maps',     desc:'bing.com/maps',                     icon:'🔷' },
    { id:'waze',   name:'Waze',          desc:'waze.com',                          icon:'🚗' },
  ];

  function getMapProvider() {
    try { return (JSON.parse(localStorage.getItem(TOGGLE_KEY)||'{}')).kartenAnbieter || 'auto'; } catch(e) { return 'auto'; }
  }

  function buildMapProviderGrid(current) {
    const cur = current !== undefined ? current : getMapProvider();
    const grid = document.getElementById('kartenAnbieterGrid');
    if (!grid) return;
    grid.innerHTML = MAP_PROVIDERS_LIST.map(p =>
      `<div class="map-provider-card${p.id===cur?' on':''}" onclick="selectMapProvider('${p.id}')">
        <div class="map-provider-icon">${p.icon}</div>
        <div class="map-provider-name">${p.name}</div>
        <div class="map-provider-desc">${p.desc.replace(/\n/,'<br>')}</div>
      </div>`
    ).join('');
  }

  function selectMapProvider(id) {
    buildMapProviderGrid(id);
    if (!_pendingToggles) _pendingToggles = {};
    _pendingToggles['kartenAnbieter'] = id;
    markUnsaved();
  }

  /* ── Portale & Behörden ── */
  const PORTAL_KEY = 'max4work_portale';

  const PORTAL_DEFS = [
    {
      id: 'elster',
      name: 'Mein ELSTER',
      desc: 'Hauptportal für EÜR, USt-Voranmeldung und Einkommensteuer',
      url: 'https://www.elster.de/eportal/',
      icon: '🏛️',
      fields: [
        { id: 'email', label: 'E-Mail / Benutzername', placeholder: 'ihre@email.de' },
        { id: 'steuernummer', label: 'Steuernummer', placeholder: '13/143/12345' },
        { id: 'zertifikat', label: 'Zertifikat-Datei (Pfad oder Hinweis)', placeholder: '/Pfad/zum/zertifikat.pfx' },
        { id: 'notiz', label: 'Notizen (PIN-Hinweis, Ablaufdatum Zertifikat …)', placeholder: 'Zertifikat läuft ab: …', type: 'textarea' },
      ]
    },
    {
      id: 'bzst',
      name: 'BZSt Online-Portal',
      desc: 'Bundeszentralamt für Steuern – USt-IdNr., Kirchensteuer-Abfragen',
      url: 'https://www.elster.de/bportal/',
      icon: '📋',
      fields: [
        { id: 'email', label: 'E-Mail / Benutzername', placeholder: 'ihre@email.de' },
        { id: 'ustid', label: 'USt-IdNr.', placeholder: 'DE123456789' },
        { id: 'notiz', label: 'Notizen', placeholder: '…', type: 'textarea' },
      ]
    },
    {
      id: 'finanzamt',
      name: 'Finanzamt',
      desc: 'Zuständiges Finanzamt – Kontakt und Anschrift',
      url: 'https://www.bzst.de/DE/Service/Behoerdenwegweiser/behoerdenwegweiser.html',
      icon: '🏢',
      fields: [
        { id: 'name', label: 'Finanzamt', placeholder: 'z.B. Finanzamt Braunschweig-Wilhelmstraße' },
        { id: 'telefon', label: 'Telefon', placeholder: '0531 1234-0' },
        { id: 'sachbearbeiter', label: 'Sachbearbeiter / Ansprechpartner', placeholder: '…' },
        { id: 'notiz', label: 'Anschrift & Notizen', placeholder: 'Adresse, Öffnungszeiten, Aktenzeichen …', type: 'textarea' },
      ]
    },
    {
      id: 'drv',
      name: 'Deutsche Rentenversicherung',
      desc: 'Online-Services für Versicherungskonto und Rentenauskunft',
      url: 'https://www.deutsche-rentenversicherung.de/DRV/DE/Online-Dienste/online-dienste_node.html',
      icon: '🏦',
      fields: [
        { id: 'versicherungsnummer', label: 'Versicherungsnummer', placeholder: '12 345678 A 123' },
        { id: 'email', label: 'E-Mail / Benutzername', placeholder: 'ihre@email.de' },
        { id: 'notiz', label: 'Notizen', placeholder: '…', type: 'textarea' },
      ]
    },
    {
      id: 'bg',
      name: 'Berufsgenossenschaft / DGUV',
      desc: 'Gesetzliche Unfallversicherung – für Selbstständige Pflichtmitgliedschaft prüfen',
      url: 'https://www.dguv.de/de/bg-uk-lv/index.jsp',
      icon: '🛡️',
      fields: [
        { id: 'bgname', label: 'Name der Berufsgenossenschaft', placeholder: 'z.B. VBG, BGW, BG ETEM …' },
        { id: 'mitgliedsnummer', label: 'Mitgliedsnummer', placeholder: '…' },
        { id: 'email', label: 'E-Mail / Benutzername', placeholder: 'ihre@email.de' },
        { id: 'portalurl', label: 'Portal-URL Ihrer BG', placeholder: 'https://…' },
        { id: 'notiz', label: 'Notizen', placeholder: '…', type: 'textarea' },
      ]
    },
    {
      id: 'svnet',
      name: 'sv.net / ITSG',
      desc: 'Sozialversicherungsmeldungen (relevant wenn Mitarbeiter beschäftigt werden)',
      url: 'https://www.itsg.de/produkte/sv-net/',
      icon: '👥',
      fields: [
        { id: 'betriebsnummer', label: 'Betriebsnummer', placeholder: '12345678' },
        { id: 'email', label: 'E-Mail / Benutzername', placeholder: 'ihre@email.de' },
        { id: 'notiz', label: 'Notizen', placeholder: '…', type: 'textarea' },
      ]
    },
    {
      id: 'unternehmensregister',
      name: 'Unternehmensregister',
      desc: 'Handelsregister, Jahresabschlüsse und Bekanntmachungen einsehen',
      url: 'https://www.unternehmensregister.de/',
      icon: '📑',
      fields: [
        { id: 'email', label: 'E-Mail / Benutzername', placeholder: 'ihre@email.de' },
        { id: 'notiz', label: 'Notizen', placeholder: '…', type: 'textarea' },
      ]
    },
  ];

  function loadPortalData() {
    try { return JSON.parse(localStorage.getItem(PORTAL_KEY) || '{}'); } catch(e) { return {}; }
  }

  function savePortalData() {
    const data = {};
    PORTAL_DEFS.forEach(portal => {
      data[portal.id] = {};
      portal.fields.forEach(f => {
        const el = document.getElementById('portal_' + portal.id + '_' + f.id);
        if (el) data[portal.id][f.id] = el.value;
      });
    });
    try {
      localStorage.setItem(PORTAL_KEY, JSON.stringify(data));
      const hint = document.getElementById('portalSaveHint');
      hint.textContent = '✓ Gespeichert!'; hint.className = 'save-hint ok';
      setTimeout(() => { hint.textContent = 'Zugangsdaten werden lokal gespeichert.'; hint.className = 'save-hint'; }, 2500);
    } catch(e) { alert('Fehler beim Speichern.'); }
  }

  function renderPortals() {
    const data = loadPortalData();
    const section = document.getElementById('section-portale');

    const notice = `<div class="panel"><div class="panel-body"><div class="portal-notice">
      <strong style="color:var(--text)">🔒 Lokale Speicherung:</strong> Alle Einträge werden ausschließlich lokal in Ihrem Browser gespeichert (localStorage) und nie übertragen. Verwenden Sie diesen Bereich für Benutzernamen, Nummern und Hinweise – Passwörter speichern Sie besser in einem dedizierten Passwort-Manager.
    </div></div></div>`;

    const cards = PORTAL_DEFS.map(portal => {
      const pdata = data[portal.id] || {};
      const fieldsHtml = portal.fields.map(f => {
        const val = (pdata[f.id] || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
        if (f.type === 'textarea') {
          return `<div class="field"><label>${f.label}</label><textarea id="portal_${portal.id}_${f.id}" placeholder="${f.placeholder}">${val}</textarea></div>`;
        }
        return `<div class="field"><label>${f.label}</label><input id="portal_${portal.id}_${f.id}" type="text" placeholder="${f.placeholder}" value="${val}"></div>`;
      }).join('');

      return `<div class="panel">
        <div class="panel-body">
          <div class="portal-header">
            <div class="portal-info">
              <span class="portal-icon">${portal.icon}</span>
              <div>
                <div class="portal-title">${portal.name}</div>
                <div class="portal-desc">${portal.desc}</div>
              </div>
            </div>
            <a href="${portal.url}" target="_blank" rel="noopener" class="btn btn-ghost portal-link" style="font-size:12px;">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Portal öffnen
            </a>
          </div>
          ${fieldsHtml}
        </div>
      </div>`;
    }).join('');

    const saveBar = `<div class="save-bar">
      <span class="save-hint" id="portalSaveHint">Zugangsdaten werden lokal gespeichert.</span>
      <button type="button" class="btn btn-blue" onclick="savePortalData()">Speichern</button>
    </div>`;

    section.innerHTML = notice + cards + saveBar;
  }

  /* ── Erscheinungsbild (Hell / Dunkel / System) ── */
  function buildSchemeGrid() {
    const cur = _pendingScheme || localStorage.getItem('max4work_color_scheme') || 'light';
    ['light','dark','system','split'].forEach(id => {
      const el = document.getElementById('sc-' + id);
      if (el) el.classList.toggle('on', id === cur);
    });
  }
  function selectScheme(id) {
    if (_pendingScheme === null) _prevScheme = localStorage.getItem(SCHEME_KEY) || 'system';
    _pendingScheme = id;
    if (typeof applyColorScheme === 'function') applyColorScheme(id);
    buildSchemeGrid();
    markUnsaved();
  }

  /* ── App-Design-Auswahl ── */
  function selectAppDesign(name) {
    document.querySelectorAll('.app-design-card').forEach(c => c.classList.remove('on'));
    const card = document.getElementById('adcard-' + name);
    if (card) card.classList.add('on');
    _pendingAppDesign = name;
    markUnsaved();
  }

  function loadAppDesignSelection() {
    const saved = localStorage.getItem(APP_DESIGN_KEY) || 'standard';
    document.querySelectorAll('.app-design-card').forEach(c => c.classList.remove('on'));
    const card = document.getElementById('adcard-' + saved);
    if (card) card.classList.add('on');
  }

  /* ── Layout & Dokumenttyp ── */
  let _activeLayout  = 'standard';
  let _activeDocType = 'rechnung';

  const DOC_TYPE_LABELS = {
    rechnung:             { label:'Rechnung',           nr:'Rechnungs-Nr.' },
    mahnung:              { label:'Mahnung',             nr:'Mahnungs-Nr.'  },
    auftragsbestaetigung: { label:'Auftragsbestätigung', nr:'AB-Nr.'         },
    angebot:              { label:'Angebot',             nr:'Angebots-Nr.'  },
    lieferschein:         { label:'Lieferschein',        nr:'Lieferschein-Nr.' },
    brief:                { label:'Brief',               nr:'Betreff-Nr.'   },
    gutschrift:           { label:'Gutschrift',          nr:'Gutschrift-Nr.' },
  };

  const INV_LAYOUTS = [
    { id:'standard',    label:'Standard'    },
    { id:'neutral',     label:'Neutral'     },
    { id:'elegant',     label:'Elegant'     },
    { id:'technisch',   label:'Technisch'   },
    { id:'geometrisch', label:'Geometrisch' },
    { id:'dynamisch',   label:'Dynamisch'   },
    { id:'klassik',     label:'Klassik'     },
    { id:'schwarz',     label:'Schwarz'     },
    { id:'blau',        label:'Blau'        },
    { id:'schlicht',    label:'Schlicht'    },
  ];

  function _layoutThumbHtml(id) {
    const t = {
      standard:    `<div style="background:#fff;height:100%;display:flex;flex-direction:column;"><div style="height:14px;background:#f5f5f5;border-bottom:2px solid #222;display:flex;align-items:center;padding:0 5px;gap:3px;"><div style="width:10px;height:6px;background:#ddd;border-radius:1px;"></div><div style="flex:1;"></div><div style="height:1.5px;background:#ddd;width:28%;border-radius:1px;"></div></div><div style="flex:1;padding:3px 5px;display:flex;flex-direction:column;gap:2px;justify-content:center;"><div style="height:1.5px;background:#bbb;width:40%;border-radius:1px;"></div><div style="height:3px;background:#e8e8e8;width:65%;border-radius:1px;margin:2px 0;"></div><div style="height:1px;background:#e8e8e8;width:80%;border-radius:1px;"></div><div style="height:1px;background:#e8e8e8;width:55%;border-radius:1px;"></div></div><div style="height:6px;background:#f8f8f8;border-top:1px solid #eee;"></div></div>`,
      neutral:     `<div style="background:#fff;height:100%;display:flex;flex-direction:column;"><div style="height:12px;background:#efefef;border-bottom:1px solid #ccc;"></div><div style="flex:1;padding:3px 5px;display:flex;flex-direction:column;gap:2px;justify-content:center;"><div style="height:1px;background:#ccc;width:45%;"></div><div style="height:3px;background:#e5e5e5;width:70%;border-radius:1px;margin:2px 0;"></div><div style="height:1px;background:#e5e5e5;width:80%;"></div><div style="height:1px;background:#e5e5e5;width:55%;"></div></div><div style="height:5px;background:#f5f5f5;border-top:1px solid #eee;"></div></div>`,
      elegant:     `<div style="background:#faf9f7;height:100%;display:flex;flex-direction:column;"><div style="padding:4px 5px 2px;display:flex;align-items:center;gap:4px;"><div style="width:10px;height:6px;background:#e8d5a3;border-radius:1px;"></div></div><div style="height:1.5px;background:linear-gradient(90deg,#c9a84c,#e8d5a3,#c9a84c);margin:0 5px 3px;"></div><div style="flex:1;padding:0 5px;display:flex;flex-direction:column;gap:2px;justify-content:center;"><div style="height:1px;background:#d4b896;width:40%;"></div><div style="height:3px;background:#f0e8d8;width:65%;border-radius:1px;margin:2px 0;"></div><div style="height:1px;background:#f0e8d8;width:75%;"></div></div></div>`,
      technisch:   `<div style="background:#fff;height:100%;display:flex;"><div style="width:5px;background:#2563eb;flex-shrink:0;"></div><div style="flex:1;display:flex;flex-direction:column;padding:3px 4px;"><div style="height:12px;background:#eff6ff;border-bottom:1px solid #bfdbfe;display:flex;align-items:center;padding:0 3px;"><span style="color:#2563eb;font-size:5px;font-family:monospace;font-weight:700;">TECH</span></div><div style="flex:1;display:flex;flex-direction:column;gap:2px;padding-top:3px;"><div style="height:1.5px;background:#bfdbfe;width:40%;border-radius:1px;"></div><div style="height:3px;background:#eff6ff;width:70%;border-radius:1px;margin:2px 0;"></div><div style="height:1px;background:#eff6ff;width:55%;border-radius:1px;"></div></div></div></div>`,
      geometrisch: `<div style="background:#fff;height:100%;position:relative;overflow:hidden;display:flex;flex-direction:column;"><div style="position:absolute;top:0;right:0;width:0;height:0;border-style:solid;border-width:0 40px 40px 0;border-color:transparent #7c3aed transparent transparent;"></div><div style="height:14px;display:flex;align-items:center;padding:0 5px;"><div style="width:10px;height:6px;background:#f3e8ff;border-radius:1px;"></div></div><div style="height:1.5px;background:#7c3aed;margin:0 5px 3px;border-radius:1px;"></div><div style="flex:1;padding:0 5px;display:flex;flex-direction:column;gap:2px;justify-content:center;"><div style="height:1px;background:#ddd6fe;width:40%;"></div><div style="height:3px;background:#f5f3ff;width:65%;border-radius:1px;margin:2px 0;"></div></div></div>`,
      dynamisch:   `<div style="background:#fff;height:100%;display:flex;flex-direction:column;"><div style="height:17px;background:linear-gradient(135deg,#dc2626 0%,#dc2626 60%,#ef4444 60%);display:flex;align-items:center;padding:0 5px;"><div style="width:10px;height:5px;background:rgba(255,255,255,.35);border-radius:1px;"></div></div><div style="flex:1;padding:3px 5px;display:flex;flex-direction:column;gap:2px;justify-content:center;"><div style="height:1.5px;background:#fecaca;width:35%;border-radius:1px;"></div><div style="height:3px;background:#fff5f5;width:60%;border-radius:1px;margin:2px 0;"></div><div style="height:1px;background:#fee2e2;width:75%;border-radius:1px;"></div></div></div>`,
      klassik:     `<div style="background:#fdfbf7;height:100%;display:flex;flex-direction:column;"><div style="padding:5px 5px 0;text-align:center;"><div style="height:3px;background:#1a1a1a;border-radius:1px;width:50%;margin:0 auto;"></div><div style="height:5px;background:#444;border-radius:1px;width:22%;margin:2px auto;"></div></div><div style="border-top:2px solid #222;border-bottom:1px solid #666;height:4px;margin:3px 5px;"></div><div style="flex:1;padding:0 5px;display:flex;flex-direction:column;gap:2px;justify-content:center;"><div style="height:1px;background:#ccc;width:40%;margin:0 auto;"></div><div style="height:3px;background:#f0ece4;width:65%;border-radius:1px;margin:2px auto;"></div></div></div>`,
      schwarz:     `<div style="background:#fff;height:100%;display:flex;flex-direction:column;"><div style="height:18px;background:#111;display:flex;align-items:center;padding:0 5px;gap:3px;"><div style="width:9px;height:5px;background:rgba(255,255,255,.2);border-radius:1px;"></div><div style="flex:1;"></div><div style="height:1px;background:rgba(255,255,255,.3);width:28%;"></div></div><div style="flex:1;padding:3px 5px;display:flex;flex-direction:column;gap:2px;justify-content:center;"><div style="height:1.5px;background:#ddd;width:40%;border-radius:1px;"></div><div style="height:3px;background:#f0f0f0;width:65%;border-radius:1px;margin:2px 0;"></div><div style="height:1px;background:#f0f0f0;width:75%;border-radius:1px;"></div></div></div>`,
      blau:        `<div style="background:#fff;height:100%;display:flex;flex-direction:column;"><div style="height:18px;background:#1e3a8a;display:flex;align-items:center;padding:0 5px;gap:3px;"><div style="width:9px;height:5px;background:rgba(255,255,255,.25);border-radius:1px;"></div><div style="flex:1;"></div><div style="height:1px;background:rgba(255,255,255,.3);width:28%;"></div></div><div style="flex:1;padding:3px 5px;display:flex;flex-direction:column;gap:2px;justify-content:center;"><div style="height:1.5px;background:#bfdbfe;width:40%;border-radius:1px;"></div><div style="height:3px;background:#eff6ff;width:65%;border-radius:1px;margin:2px 0;"></div><div style="height:1px;background:#eff6ff;width:75%;border-radius:1px;"></div></div></div>`,
      schlicht:    `<div style="background:#fff;height:100%;display:flex;flex-direction:column;padding:5px;gap:2px;"><div style="height:1px;background:#e0e0e0;margin-bottom:3px;"></div><div style="height:2px;background:#ccc;width:55%;border-radius:1px;"></div><div style="height:1px;background:#ebebeb;width:80%;border-radius:1px;margin:2px 0;"></div><div style="flex:1;display:flex;flex-direction:column;gap:2px;padding-top:2px;"><div style="height:1px;background:#ebebeb;width:75%;"></div><div style="height:1px;background:#ebebeb;width:60%;"></div><div style="height:1px;background:#ebebeb;width:45%;"></div></div><div style="height:1px;background:#e0e0e0;margin-top:3px;"></div></div>`,
    };
    return t[id] || t.standard;
  }

  function _getLayoutTheme(id) {
    const base = {
      paperBg:'#ffffff', headerMode:'standard', headerBg:null,
      headerTextColor:'#444', headerPad:'16px 22px 14px',
      sidebarBg:null, geoDecor:'', headerBottomContent:'',
      bodyTopPad:'14px', trennColor:'#ddd',
      titleColor:'#111', titleWeight:'700', titleFontVariant:'normal', titleLetterSpacing:'normal',
      thBg:'#f5f5f5', thColor:'#888', thBorderColor:'#ccc',
      trBorderColor:'#e4e4e4', totalBorderColor:'#bbb',
    };
    const t = {
      standard:    { ...base },
      neutral:     { ...base, thBg:'#f0f0f0', thColor:'#666', thBorderColor:'#d0d0d0', trBorderColor:'#e8e8e8', totalBorderColor:'#c0c0c0', titleColor:'#333', titleWeight:'600' },
      elegant:     { ...base, paperBg:'#faf9f7', headerBottomContent:'<div style="height:1.5px;background:linear-gradient(90deg,#c9a84c,#e8d5a3,#c9a84c);margin:10px 22px 12px;"></div>', bodyTopPad:'0', titleColor:'#6b4c11', titleWeight:'600', titleLetterSpacing:'0.3px', thBg:'#f5f0e8', thColor:'#8b6914', thBorderColor:'#d4b896', trBorderColor:'#e8d8c0', totalBorderColor:'#c9a84c', trennColor:'#d4b896' },
      technisch:   { ...base, headerMode:'sidebar', sidebarBg:'#2563eb', titleColor:'#2563eb', thBg:'#eff6ff', thColor:'#2563eb', thBorderColor:'#bfdbfe', trBorderColor:'#dbeafe', totalBorderColor:'#93c5fd', trennColor:'#bfdbfe' },
      geometrisch: { ...base, geoDecor:'<div style="position:absolute;top:0;right:0;width:0;height:0;border-style:solid;border-width:0 55px 55px 0;border-color:transparent #7c3aed transparent transparent;pointer-events:none;z-index:1;"></div>', headerBottomContent:'<div style="height:2px;background:#7c3aed;margin:10px 22px 12px;border-radius:1px;"></div>', bodyTopPad:'0', titleColor:'#7c3aed', thBg:'#f5f3ff', thColor:'#7c3aed', thBorderColor:'#ddd6fe', trBorderColor:'#ede9fe', totalBorderColor:'#c4b5fd', trennColor:'#ddd6fe' },
      dynamisch:   { ...base, headerMode:'colored', headerBg:'linear-gradient(135deg,#dc2626 0%,#dc2626 65%,#ef4444 65%)', headerTextColor:'#ffffff', bodyTopPad:'10px', titleColor:'#dc2626', titleWeight:'800', thBg:'#fff5f5', thColor:'#dc2626', thBorderColor:'#fecaca', trBorderColor:'#fee2e2', totalBorderColor:'#fca5a5', trennColor:'#fecaca' },
      klassik:     { ...base, paperBg:'#fdfbf7', headerMode:'centered', headerBottomContent:'<div style="border-top:2px solid #222;border-bottom:1px solid #666;height:4px;margin:6px 22px 14px;"></div>', bodyTopPad:'0', titleColor:'#111', titleFontVariant:'small-caps', titleLetterSpacing:'1px', thBg:'transparent', thColor:'#555', thBorderColor:'#888', trBorderColor:'#ccc', totalBorderColor:'#999', trennColor:'#888' },
      schwarz:     { ...base, headerMode:'colored', headerBg:'#111111', headerTextColor:'#ffffff', bodyTopPad:'10px', thBg:'#f5f5f5', thColor:'#333', thBorderColor:'#ccc' },
      blau:        { ...base, headerMode:'colored', headerBg:'#1e3a8a', headerTextColor:'#ffffff', bodyTopPad:'10px', titleColor:'#1e3a8a', thBg:'#eff6ff', thColor:'#1e40af', thBorderColor:'#bfdbfe', trBorderColor:'#dbeafe', totalBorderColor:'#93c5fd', trennColor:'#bfdbfe' },
      schlicht:    { ...base, titleColor:'#444', titleWeight:'500', thBg:'transparent', thColor:'#999', thBorderColor:'#e8e8e8', trBorderColor:'#f0f0f0', totalBorderColor:'#ccc', trennColor:'#ebebeb' },
    };
    return t[id] || t.standard;
  }

  function renderLayoutGrid() {
    const grid = document.getElementById('invLayoutGrid');
    if (!grid) return;
    grid.innerHTML = INV_LAYOUTS.map(l => `
      <div class="inv-layout-card${l.id === _activeLayout ? ' on' : ''}" onclick="selectLayout('${l.id}')">
        <div class="inv-layout-thumb">${_layoutThumbHtml(l.id)}</div>
        <div class="inv-layout-name">${l.label}</div>
      </div>`).join('');
  }

  function selectLayout(id) {
    _activeLayout = id;
    renderLayoutGrid();
    renderInvPreview();
    _autoSaveInvConfig();
  }

  function selectDocType(val) {
    _activeDocType = val;
    renderInvPreview();
    _autoSaveInvConfig();
  }

  /* ── Logo-Position ── */
  let _logoPos     = 'rechts';
  let _logoGroesse = 'mittel';
  let _logoSizePx  = 50;
  const LOGO_SIZE_MAP = { klein: 34, mittel: 50, gross: 70 };

  function _renderLogoPosHBtns() {
    const el = document.getElementById('logoPosHBtns');
    if (!el) return;
    const positions = [
      { val:'links',  label:'Links',  x:4  },
      { val:'mitte',  label:'Mitte',  x:18 },
      { val:'rechts', label:'Rechts', x:31 },
    ];
    el.innerHTML = positions.map(p => {
      const fill = p.val === _logoPos ? 'var(--accent)' : 'var(--border)';
      return `<div class="logo-pos-btn${p.val === _logoPos ? ' on' : ''}" onclick="selectLogoPos('${p.val}')">
        <svg width="52" height="34" viewBox="0 0 52 34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="52" height="34" rx="3" fill="var(--soft)"/>
          <rect x="${p.x}" y="4" width="14" height="9" rx="2" fill="${fill}"/>
          <rect x="4" y="17" width="30" height="2.5" rx="1" fill="var(--border)"/>
          <rect x="4" y="22" width="22" height="2.5" rx="1" fill="var(--border)"/>
          <rect x="4" y="27" width="36" height="2.5" rx="1" fill="var(--border)"/>
        </svg>
        <span class="logo-pos-btn-label">${p.label}</span>
      </div>`;
    }).join('');
  }

  function _renderLogoSzBtns() {
    ['klein','mittel','gross'].forEach(sz => {
      const id  = 'logoSz' + sz.charAt(0).toUpperCase() + sz.slice(1);
      const btn = document.getElementById(id);
      if (btn) btn.classList.toggle('on', sz === _logoGroesse);
    });
    const slider = document.getElementById('logoSizeSlider');
    const label  = document.getElementById('logoSizeLabel');
    if (slider) slider.value = _logoSizePx;
    if (label)  label.textContent = _logoSizePx + ' px';
  }

  function setLogoSizePx(px) {
    _logoSizePx = px;
    const label = document.getElementById('logoSizeLabel');
    if (label) label.textContent = px + ' px';
    const preset = Object.entries(LOGO_SIZE_MAP).find(([, v]) => v === px)?.[0] || null;
    _logoGroesse = preset || _logoGroesse;
    ['klein','mittel','gross'].forEach(sz => {
      const btn = document.getElementById('logoSz' + sz.charAt(0).toUpperCase() + sz.slice(1));
      if (btn) btn.classList.toggle('on', sz === _logoGroesse && preset !== null);
    });
    renderInvPreview();
    _autoSaveInvConfig();
  }

  function _autoSaveInvConfig() {
    try {
      localStorage.setItem('max4work_rechnung_config', JSON.stringify({
        template:    _activeTemplate,
        layout:      _activeLayout,
        docType:     _activeDocType,
        logoPos:     _logoPos,
        logoGroesse: _logoGroesse,
        logoSizePx:  _logoSizePx,
        felder: { ...(_invFelder || INV_TEMPLATES[0].felder) },
        texte: {
          einleitung: document.getElementById('invEinleitung')?.value || '',
          schluss:    document.getElementById('invSchluss')?.value    || '',
          hinweise:   document.getElementById('invHinweise')?.value   || '',
        },
        invFont:        _invFont        || null,
        invFontSize:    _invFontSize    || null,
        invAccent:      _invAccent      || null,
        zahlungstage:   _zahlungstage   || 14,
        einleitungFont: _einleitungFont || null,
        schlussFont:    _schlussFont    || null,
        hinweiseFont:   _hinweiseFont   || null,
      }));
    } catch(e) {}
  }

  function selectLogoPos(pos) {
    _logoPos = pos;
    _renderLogoPosHBtns();
    renderInvPreview();
    _autoSaveInvConfig();
  }

  function selectLogoGroesse(size) {
    _logoGroesse = size;
    _logoSizePx  = LOGO_SIZE_MAP[size] || _logoSizePx;
    _renderLogoSzBtns();
    renderInvPreview();
    _autoSaveInvConfig();
  }

  function renderInvPreview() {
    const paper = document.getElementById('invA4Paper');
    if (!paper) return;

    const logoUrl = typeof loadLogo === 'function' ? loadLogo() : null;
    const felder  = _invFelder || INV_TEMPLATES[0].felder;
    const sz      = _logoSizePx || LOGO_SIZE_MAP[_logoGroesse] || 50;
    const logoW   = Math.round(sz * 1.85);

    let s = {};
    try { s = JSON.parse(localStorage.getItem('max4work_einstellungen') || '{}'); } catch(e) {}
    const sName   = s.sName   || 'Ihr Unternehmen';
    const sStreet = s.sStreet || 'Musterstraße 1';
    const sPlz    = s.sPlz   || '12345';
    const sCity   = s.sCity  || 'Musterstadt';
    const sTel    = s.sTel   || '';
    const sEmail  = s.sEmail || '';
    const sWeb    = s.sWeb   || '';
    const sStNr   = s.sStNr  || '';
    const sIBAN   = s.sIBAN  || '';
    const sBIC    = s.sBIC   || '';
    const sBank   = s.sBank  || '';

    const today   = new Date();
    const dateStr = today.toLocaleDateString('de-DE');
    const faellig = new Date(today.getTime() + 14*86400000).toLocaleDateString('de-DE');

    const esc    = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const txtFmt = t => esc(t).replace(/\n/g,'<br>');
    const einl = txtFmt(document.getElementById('invEinleitung')?.value || '');
    const schl = txtFmt(document.getElementById('invSchluss')?.value    || '');
    const hinw = txtFmt(document.getElementById('invHinweise')?.value   || '');

    const lyt     = { ..._getLayoutTheme(_activeLayout) };
    if (_invAccent) lyt.titleColor = _invAccent;
    const docInfo = DOC_TYPE_LABELS[_activeDocType] || DOC_TYPE_LABELS.rechnung;

    const hDir = _logoPos === 'mitte'  ? 'column;align-items:center'
               : _logoPos === 'rechts' ? 'row-reverse'
               : 'row';

    // Logo-Block
    const logoBox = felder.logo
      ? (logoUrl
          ? `<div style="flex-shrink:0;width:${logoW}px;height:${sz}px;overflow:hidden;display:flex;align-items:center;"><img src="${logoUrl}" style="max-width:100%;max-height:100%;object-fit:contain;"></div>`
          : `<div style="flex-shrink:0;width:${logoW}px;height:${sz}px;background:var(--accent-pale);border:1.5px dashed var(--accent);border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:0.875em;color:var(--accent);font-weight:700;">LOGO</div>`)
      : '';

    // Firmen-Info (Textfarbe je nach Header-Typ)
    const infoColor = lyt.headerMode === 'colored' ? lyt.headerTextColor : '#444';
    const infoItems = [];
    if (felder.adresse) infoItems.push(`<strong style="font-size:1.125em;color:${infoColor};">${esc(sName)}</strong>`, esc(sStreet), `${esc(sPlz)} ${esc(sCity)}`);
    if (felder.tel    && sTel)    infoItems.push(`Tel: ${esc(sTel)}`);
    if (felder.email  && sEmail)  infoItems.push(esc(sEmail));
    if (felder.web    && sWeb)    infoItems.push(esc(sWeb));
    if (felder.steuernr && sStNr) infoItems.push(`St.-Nr.: ${esc(sStNr)}`);
    const infoHtml = `<div style="flex:1;font-size:0.9375em;line-height:1.75;color:${infoColor};min-width:0;">${infoItems.join('<br>')}</div>`;

    // ── Header-Bereich (layout-spezifisch) ──
    let headerSection = '';
    if (lyt.headerMode === 'colored') {
      headerSection = `<div style="background:${lyt.headerBg};padding:${lyt.headerPad};">
        <div style="display:flex;flex-direction:${hDir};align-items:flex-start;gap:12px;">${logoBox}${infoHtml}</div>
      </div>`;
    } else if (lyt.headerMode === 'centered') {
      headerSection = `<div style="padding:16px 22px 0;text-align:center;">
        ${logoBox ? `<div style="display:flex;justify-content:center;margin-bottom:6px;">${logoBox}</div>` : ''}
        <div style="font-size:1.375em;font-weight:700;color:#1a1a1a;letter-spacing:0.5px;">${esc(sName)}</div>
        ${felder.adresse ? `<div style="font-size:0.875em;color:#555;margin-top:2px;">${esc(sStreet)} · ${esc(sPlz)} ${esc(sCity)}</div>` : ''}
        ${felder.tel && sTel ? `<div style="font-size:0.875em;color:#555;">Tel: ${esc(sTel)}</div>` : ''}
      </div>`;
    } else if (lyt.headerMode === 'sidebar') {
      headerSection = `<div style="display:flex;min-height:${sz + 28}px;">
        <div style="width:5px;background:${lyt.sidebarBg};flex-shrink:0;"></div>
        <div style="flex:1;padding:20px 22px 0;">
          <div style="display:flex;flex-direction:${hDir};align-items:flex-start;gap:12px;">${logoBox}${infoHtml}</div>
        </div>
      </div>`;
    } else {
      headerSection = `<div style="padding:20px 22px 0;position:relative;">
        ${lyt.geoDecor}
        <div style="display:flex;flex-direction:${hDir};align-items:flex-start;gap:12px;">${logoBox}${infoHtml}</div>
      </div>`;
    }

    // ── Header-Abschluss (Linie / Dekor) ──
    let headerBottom = lyt.headerBottomContent || '';
    if (!headerBottom && lyt.headerMode === 'standard' && felder.trennlinien) {
      headerBottom = `<div style="height:1px;background:${lyt.trennColor};margin:12px 22px 0;"></div>`;
    } else if (!headerBottom && lyt.headerMode !== 'colored') {
      headerBottom = '<div style="height:12px;"></div>';
    }

    // ── Absender-Zeile ──
    const absender = felder.adresse
      ? `<div style="font-size:0.75em;color:#aaa;border-bottom:1px solid #eee;padding-bottom:3px;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(sName)} · ${esc(sStreet)} · ${esc(sPlz)} ${esc(sCity)}</div>`
      : '';

    // ── Metadaten-Tabelle ──
    const metaRows = [
      `<tr><td style="color:#999;padding-right:8px;white-space:nowrap;">${esc(docInfo.nr)}</td><td style="font-weight:700;color:#222;">2026-001</td></tr>`,
      `<tr><td style="color:#999;white-space:nowrap;">Datum</td><td>${dateStr}</td></tr>`,
      felder.faellig  ? `<tr><td style="color:#999;white-space:nowrap;">Fällig bis</td><td>${faellig}</td></tr>` : '',
      felder.kundennr ? `<tr><td style="color:#999;white-space:nowrap;">Kunden-Nr.</td><td>K-0042</td></tr>` : '',
    ].join('');

    // ── Positions-Tabelle ──
    const thBorderVis = felder.trennlinien ? lyt.thBorderColor : 'transparent';
    const trBorderVis = felder.trennlinien ? lyt.trBorderColor : 'transparent';
    const tableHtml = `
      <table style="width:100%;border-collapse:collapse;font-size:0.9375em;margin:10px 0 8px;">
        <thead>
          <tr style="border-bottom:1.5px solid ${thBorderVis};">
            <th style="text-align:left;padding:3px 0;background:${lyt.thBg};color:${lyt.thColor};font-weight:600;font-size:0.8125em;text-transform:uppercase;">Beschreibung</th>
            <th style="text-align:right;padding:3px 0;background:${lyt.thBg};color:${lyt.thColor};font-weight:600;font-size:0.8125em;text-transform:uppercase;width:36px;">Menge</th>
            <th style="text-align:right;padding:3px 0;background:${lyt.thBg};color:${lyt.thColor};font-weight:600;font-size:0.8125em;text-transform:uppercase;width:52px;">Einzelpr.</th>
            <th style="text-align:right;padding:3px 0;background:${lyt.thBg};color:${lyt.thColor};font-weight:600;font-size:0.8125em;text-transform:uppercase;width:52px;">Gesamt</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid ${trBorderVis};"><td style="padding:4px 0;">Dienstleistung (Beispiel)</td><td style="text-align:right;padding:4px 0;color:#555;">3 Std.</td><td style="text-align:right;padding:4px 0;color:#555;">55,00 €</td><td style="text-align:right;padding:4px 0;font-weight:600;">165,00 €</td></tr>
          <tr style="border-bottom:1px solid ${trBorderVis};"><td style="padding:4px 0;">Materialkosten pauschal</td><td style="text-align:right;padding:4px 0;color:#555;">1</td><td style="text-align:right;padding:4px 0;color:#555;">45,00 €</td><td style="text-align:right;padding:4px 0;font-weight:600;">45,00 €</td></tr>
        </tbody>
        <tfoot>
          <tr style="border-top:1.5px solid ${felder.trennlinien ? lyt.totalBorderColor : 'transparent'};">
            <td colspan="3" style="padding:5px 0;font-weight:700;font-size:1.125em;color:${lyt.titleColor};">Gesamtbetrag</td>
            <td style="text-align:right;padding:5px 0;font-weight:700;font-size:1.125em;color:${lyt.titleColor};">210,00 €</td>
          </tr>
        </tfoot>
      </table>`;

    const ust19Html = felder.ust19
      ? `<div style="font-size:0.875em;color:#666;font-style:italic;margin-bottom:6px;">Gemäß § 19 Abs. 1 UStG wird keine Umsatzsteuer berechnet.</div>`
      : '';

    const bankHtml = felder.bank && sIBAN
      ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid #eee;font-size:0.875em;color:#555;line-height:1.9;">${sBank ? `<strong>${esc(sBank)}</strong><br>` : ''}IBAN: ${esc(sIBAN)}${sBIC ? ` · BIC: ${esc(sBIC)}` : ''}</div>`
      : '';

    const giroHtml = felder.girocode
      ? `<div style="text-align:right;margin-top:8px;"><div style="display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;background:#f5f5f5;border:1px solid #ddd;border-radius:3px;font-size:0.625em;color:#aaa;text-align:center;line-height:1.4;">GIRo<br>Code</div></div>`
      : '';

    const falzHtml = `
      <div class="inv-falz" style="top:297px;">
        <div class="inv-falz-tick"></div>
        <div style="flex:1;"></div>
        <div class="inv-falz-tick-r"></div>
      </div>
      <div class="inv-falz" style="top:595px;">
        <div class="inv-falz-tick"></div>
        <div style="flex:1;"></div>
        <div class="inv-falz-tick-r"></div>
      </div>`;

    const bodyPad = `${lyt.bodyTopPad} 22px 18px`;

    const _szPx = { klein: '6.5px', normal: '8px', gross: '9.5px' }[_invFontSize || 'normal'];
    paper.style.fontFamily = `'${_invFont || 'Outfit'}', 'Outfit', sans-serif`;
    paper.style.fontSize = _szPx;
    paper.style.background = lyt.paperBg;
    paper.innerHTML = falzHtml + headerSection + headerBottom +
      `<div style="padding:${bodyPad};">
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:14px;align-items:flex-start;">
          <div style="font-size:0.9375em;color:#444;max-width:55%;">${absender}<strong style="font-size:1.0625em;color:#111;">Max Mustermann</strong><br>Kundenstraße 5<br>54321 Kundenstadt</div>
          <table style="font-size:0.9375em;color:#444;border-collapse:collapse;">${metaRows}</table>
        </div>
        <div style="font-size:1.25em;font-weight:${lyt.titleWeight};color:${lyt.titleColor};margin-bottom:6px;font-variant:${lyt.titleFontVariant};letter-spacing:${lyt.titleLetterSpacing};">${esc(docInfo.label)} Nr. 2026-001</div>
        ${einl ? `<div style="font-size:0.9375em;color:#555;margin-bottom:10px;line-height:1.65;${_einleitungFont?`font-family:'${_einleitungFont}',sans-serif;`:''}">${einl}</div>` : ''}
        ${tableHtml}
        ${ust19Html}
        ${schl ? `<div style="font-size:0.9375em;color:#555;margin-top:6px;line-height:1.65;${_schlussFont?`font-family:'${_schlussFont}',sans-serif;`:''}">${schl}</div>` : ''}
        <div style="font-size:0.875em;color:#555;margin-top:10px;padding-top:8px;border-top:1px solid #eee;line-height:1.75;">Zahlungsbedingungen: Zahlung innerhalb von ${_zahlungstage} Tagen ab Rechnungseingang ohne Abzüge. Bitte überweisen Sie den Rechnungsbetrag unter Angabe der Rechnungsnummer auf das unten angegebene Konto. Der Rechnungsbetrag ist bis zum ${new Date(today.getTime() + _zahlungstage * 86400000).toLocaleDateString('de-DE')} fällig.<br><br>Mit freundlichen Grüßen<br>${esc(sName)}</div>
        ${bankHtml}
        ${giroHtml}
        ${hinw ? `<div style="margin-top:10px;padding:7px 10px;background:#f8f8f8;border-left:2.5px solid #ddd;font-size:0.8125em;color:#777;line-height:1.65;${_hinweiseFont?`font-family:'${_hinweiseFont}',sans-serif;`:''}">${hinw}</div>` : ''}
      </div>`;

    try {
      localStorage.setItem('max4work_rechnung_config', JSON.stringify({
        template:    _activeTemplate,
        layout:      _activeLayout,
        docType:     _activeDocType,
        logoPos:     _logoPos,
        logoGroesse: _logoGroesse,
        logoSizePx:  _logoSizePx,
        felder: { ...(_invFelder || INV_TEMPLATES[0].felder) },
        texte: {
          einleitung: document.getElementById('invEinleitung')?.value || '',
          schluss:    document.getElementById('invSchluss')?.value    || '',
          hinweise:   document.getElementById('invHinweise')?.value   || '',
        },
        invFont:        _invFont        || null,
        invFontSize:    _invFontSize    || null,
        invAccent:      _invAccent      || null,
        zahlungstage:   _zahlungstage   || 14,
        einleitungFont: _einleitungFont || null,
        schlussFont:    _schlussFont    || null,
        hinweiseFont:   _hinweiseFont   || null,
      }));
    } catch(e) { console.warn('Blatt-Design Auto-Save fehlgeschlagen:', e); }
  }

  function _initLogoPos(cfg) {
    _logoPos     = cfg.logoPos     || 'rechts';
    _logoGroesse = cfg.logoGroesse || 'mittel';
    _logoSizePx  = cfg.logoSizePx  || LOGO_SIZE_MAP[_logoGroesse] || 50;
    _renderLogoPosHBtns();
    _renderLogoSzBtns();
    renderInvPreview();
  }

  /* ── Rechnungs-Konfiguration ── */
  const INV_CONFIG_KEY = 'max4work_rechnung_config';
  const BLATTVLG_KEY   = 'max4work_blattvorlagen';

  const INV_TEMPLATES = [
    {
      id: 'standard', icon: '📄', title: 'Standard',
      desc: 'Alle wichtigen Felder, professionelles Layout für den Alltag.',
      tags: ['Logo', 'Adresse', 'Bank', 'GiroCode'],
      felder: { logo:true, adresse:true, tel:true, email:true, web:false, steuernr:true, kundennr:false, faellig:true, bank:true, girocode:true, ust19:false, trennlinien:true },
      texte: { einleitung:'', schluss:'Vielen Dank für Ihren Auftrag.', hinweise:'' }
    },
    {
      id: 'kleinunternehmer', icon: '🏠', title: 'Kleinunternehmer',
      desc: 'Mit Pflichthinweis §19 UStG, automatisch ohne Mehrwertsteuer.',
      tags: ['§19 UStG', 'Kein MwSt', 'Pflichttext'],
      felder: { logo:true, adresse:true, tel:true, email:true, web:false, steuernr:true, kundennr:false, faellig:true, bank:true, girocode:true, ust19:true, trennlinien:true },
      texte: { einleitung:'', schluss:'Vielen Dank für Ihren Auftrag.', hinweise:'Gemäß § 19 Abs. 1 UStG wird keine Umsatzsteuer berechnet.' }
    },
    {
      id: 'professionell', icon: '💼', title: 'Professionell',
      desc: 'Vollständig mit Kundennummer, Website und förmlicher Anrede.',
      tags: ['Vollständig', 'Kundennr.', 'Website', 'Förmlich'],
      felder: { logo:true, adresse:true, tel:true, email:true, web:true, steuernr:true, kundennr:true, faellig:true, bank:true, girocode:true, ust19:false, trennlinien:true },
      texte: {
        einleitung: 'Sehr geehrte Damen und Herren,\n\nfür die erbrachten Leistungen erlauben wir uns, folgende Rechnung zu stellen:',
        schluss: 'Wir danken für Ihren Auftrag und freuen uns auf weitere Zusammenarbeit.',
        hinweise: 'Bei verspäteter Zahlung behalten wir uns vor, Verzugszinsen gemäß § 288 BGB geltend zu machen.'
      }
    },
    {
      id: 'minimalistisch', icon: '✦', title: 'Minimalistisch',
      desc: 'Nur das Wesentliche – schlank, klar, ohne Schnörkel.',
      tags: ['Kompakt', 'Schlank', 'Ohne Logo'],
      felder: { logo:false, adresse:true, tel:false, email:true, web:false, steuernr:true, kundennr:false, faellig:true, bank:true, girocode:false, ust19:false, trennlinien:true },
      texte: { einleitung:'', schluss:'Bitte überweisen Sie den Betrag bis zum angegebenen Fälligkeitsdatum.', hinweise:'' }
    }
  ];

  const INV_FELDER_DEFS = [
    { key:'logo',        label:'Logo' },
    { key:'adresse',     label:'Adresse' },
    { key:'tel',         label:'Telefon' },
    { key:'email',       label:'E-Mail' },
    { key:'web',         label:'Website' },
    { key:'steuernr',    label:'Steuer-Nr.' },
    { key:'kundennr',    label:'Kundennummer' },
    { key:'faellig',     label:'Fälligkeitsdatum' },
    { key:'bank',        label:'Bankverbindung' },
    { key:'girocode',    label:'GiroCode QR' },
    { key:'ust19',       label:'§19 UStG Hinweis' },
    { key:'trennlinien', label:'Trennlinien' },
  ];

  const INV_BEISPIELE = {
    einleitung: [
      'Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unsere Rechnung für die erbrachten Leistungen.',
      'Hiermit stelle ich Ihnen für folgende Leistungen Rechnung:',
      'Für erbrachte Dienstleistungen berechne ich folgende Positionen.',
      'Sehr geehrte/r [Name], nachfolgend erhalten Sie meine Rechnung.',
    ],
    schluss: [
      'Vielen Dank für Ihren Auftrag!',
      'Wir freuen uns auf weitere Zusammenarbeit.',
      'Für Rückfragen stehe ich Ihnen gerne unter meinen Kontaktdaten zur Verfügung.',
      'Zahlung innerhalb von 14 Tagen netto ohne Abzüge erbeten.',
    ],
    hinweise: [
      'Gemäß § 19 Abs. 1 UStG wird keine Umsatzsteuer berechnet.',
      'Es gelten unsere allgemeinen Geschäftsbedingungen.',
      'Bei verspäteter Zahlung behalten wir uns Verzugszinsen vor (§ 288 BGB).',
      'Alle Preise verstehen sich als Nettopreise zzgl. der gesetzlichen MwSt.',
    ]
  };

  let _activeTemplate = 'standard';
  let _invFelder = null;
  let _invFont = null;
  let _invFontSize = null;
  let _invAccent = null;
  let _zahlungstage = 14;
  let _einleitungFont = null;
  let _schlussFont    = null;
  let _hinweiseFont   = null;

  const _INV_FONTS = [
    // ── Google Fonts (werden dynamisch geladen) ──
    { name: 'Outfit',                   weights: '300;400;500;600' },
    { name: 'Inter',                    weights: '300;400;500;600;700' },
    { name: 'Roboto',                   weights: '300;400;500;700' },
    { name: 'Poppins',                  weights: '300;400;500;600' },
    { name: 'Playfair Display',         weights: '400;600;700' },
    { name: 'Lato',                     weights: '300;400;700' },
    // ── Windows-Systemschriften ──
    { name: 'Arial',                    system: true },
    { name: 'Arial Black',              system: true },
    { name: 'Arial Narrow',             system: true },
    { name: 'Bahnschrift',              system: true },
    { name: 'Calibri',                  system: true },
    { name: 'Calibri Light',            system: true },
    { name: 'Cambria',                  system: true },
    { name: 'Candara',                  system: true },
    { name: 'Comic Sans MS',            system: true },
    { name: 'Consolas',                 system: true },
    { name: 'Constantia',               system: true },
    { name: 'Corbel',                   system: true },
    { name: 'Courier New',              system: true },
    { name: 'Franklin Gothic Medium',   system: true },
    { name: 'Gabriola',                 system: true },
    { name: 'Garamond',                 system: true },
    { name: 'Georgia',                  system: true },
    { name: 'Impact',                   system: true },
    { name: 'Ink Free',                 system: true },
    { name: 'Lucida Console',           system: true },
    { name: 'Lucida Sans Unicode',      system: true },
    { name: 'Microsoft Sans Serif',     system: true },
    { name: 'Palatino Linotype',        system: true },
    { name: 'Segoe Print',              system: true },
    { name: 'Segoe Script',             system: true },
    { name: 'Segoe UI',                 system: true },
    { name: 'Segoe UI Variable',        system: true },
    { name: 'Sitka Banner',             system: true },
    { name: 'Sitka Display',            system: true },
    { name: 'Sitka Heading',            system: true },
    { name: 'Sitka Small',              system: true },
    { name: 'Sitka Subheading',         system: true },
    { name: 'Sitka Text',               system: true },
    { name: 'Sylfaen',                  system: true },
    { name: 'Tahoma',                   system: true },
    { name: 'Times New Roman',          system: true },
    { name: 'Trebuchet MS',             system: true },
    { name: 'Verdana',                  system: true },
  ];

  const _INV_SIZES = [
    { val: 'klein',  label: 'Klein'  },
    { val: 'normal', label: 'Normal' },
    { val: 'gross',  label: 'Groß'   },
  ];

  const _INV_PALETTE = ['#1e3a8a','#166534','#7c3aed','#991b1b','#b45309','#374151','#0e7490'];

  const _invFontLoaded = new Set(['Outfit']);

  function _loadInvFontDyn(name) {
    const f = _INV_FONTS.find(f => f.name === name);
    if (f && f.system) return;
    if (_invFontLoaded.has(name)) return;
    _invFontLoaded.add(name);
    const lk = document.createElement('link');
    lk.rel = 'stylesheet';
    lk.href = `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap`;
    document.head.appendChild(lk);
  }

  function _closeFontDd() {
    document.getElementById('invFontWrap')?.classList.remove('open');
  }
  function toggleFontDd() {
    const wrap = document.getElementById('invFontWrap');
    if (!wrap) return;
    const opening = !wrap.classList.contains('open');
    wrap.classList.toggle('open');
    if (opening) {
      const active = wrap.querySelector('.fdd-option.on');
      if (active) active.scrollIntoView({ block: 'nearest' });
    }
  }
  window.toggleFontDd = toggleFontDd;

  function renderInvFontGrid() {
    const list = document.getElementById('invFontList');
    if (!list) return;
    const cur = _invFont || 'Outfit';
    _INV_FONTS.forEach(f => _loadInvFontDyn(f.name));

    // Trennlinie zwischen Google Fonts und Windows-Schriften
    const googleCount = _INV_FONTS.filter(f => !f.system).length;
    list.innerHTML = _INV_FONTS.map((f, i) => {
      const sep = (i === googleCount) ? '<div class="fdd-sep"></div>' : '';
      const safe = f.name.replace(/'/g, "\\'");
      return `${sep}<div class="fdd-option${f.name === cur ? ' on' : ''}"
        style="font-family:'${f.name}',sans-serif;"
        onclick="selectInvFont('${safe}')">${f.name}</div>`;
    }).join('');

    // Trigger-Label aktualisieren
    const lbl = document.getElementById('invFontLabel');
    if (lbl) { lbl.textContent = cur; lbl.style.fontFamily = `'${cur}',sans-serif`; }
  }

  function selectInvFont(name) {
    _invFont = name;
    _loadInvFontDyn(name);
    _closeFontDd();
    const lbl = document.getElementById('invFontLabel');
    if (lbl) { lbl.textContent = name; lbl.style.fontFamily = `'${name}',sans-serif`; }
    // aktive Option markieren ohne komplettes Re-Render
    document.querySelectorAll('#invFontList .fdd-option').forEach(el => {
      el.classList.toggle('on', el.textContent.trim() === name);
    });
    renderInvPreview();
    _autoSaveInvConfig();
  }

  function renderInvSizeGrid() {
    const el = document.getElementById('invSizeGrid');
    if (!el) return;
    const cur = _invFontSize || 'normal';
    el.innerHTML = _INV_SIZES.map(s =>
      `<div class="inv-chip${s.val === cur ? ' on' : ''}" onclick="selectInvSize('${s.val}')">${s.label}</div>`
    ).join('');
  }

  function selectInvSize(val) {
    _invFontSize = val;
    renderInvSizeGrid();
    renderInvPreview();
    _autoSaveInvConfig();
  }

  function renderInvZahlungstageGrid() {
    const el = document.getElementById('invZahlungstageGrid');
    if (!el) return;
    el.innerHTML = [7, 14, 21, 30].map(t =>
      `<div class="inv-chip${t === _zahlungstage ? ' on' : ''}" onclick="selectInvZahlungstage(${t})">${t} Tage</div>`
    ).join('');
  }

  function selectInvZahlungstage(val) {
    _zahlungstage = val;
    renderInvZahlungstageGrid();
    renderInvPreview();
    _autoSaveInvConfig();
  }

  function renderTextFontSelects() {
    const fields = [
      { id: 'invEinleitungFont', cur: _einleitungFont },
      { id: 'invSchlussFont',    cur: _schlussFont    },
      { id: 'invHinweiseFont',   cur: _hinweiseFont   },
    ];
    const opts = `<option value="">— wie Hauptschrift —</option>` +
      _INV_FONTS.map(f => `<option value="${f.name}">${f.name}</option>`).join('');
    fields.forEach(({ id, cur }) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = opts;
      el.value = cur || '';
      el.style.fontFamily = cur ? `'${cur}', sans-serif` : '';
    });
  }

  function setTextFont(field, name) {
    const fontVal = name || null;
    if (field === 'einleitung') _einleitungFont = fontVal;
    else if (field === 'schluss')  _schlussFont    = fontVal;
    else if (field === 'hinweise') _hinweiseFont   = fontVal;
    if (fontVal) _loadInvFontDyn(fontVal);
    const cap = field.charAt(0).toUpperCase() + field.slice(1);
    const sel = document.getElementById('inv' + cap + 'Font');
    if (sel) sel.style.fontFamily = fontVal ? `'${fontVal}', sans-serif` : '';
    const ta = document.getElementById('inv' + cap);
    if (ta) ta.style.fontFamily = fontVal ? `'${fontVal}', sans-serif` : '';
    renderInvPreview();
    _autoSaveInvConfig();
  }

  function renderInvColorSwatches() {
    const el = document.getElementById('invColorSwatches');
    if (!el) return;
    const cur = _invAccent;
    const autoOn = !cur;
    const customOn = cur && !_INV_PALETTE.includes(cur);
    const swatches = `<div class="inv-color-swatch inv-color-auto${autoOn ? ' on' : ''}" onclick="selectInvColor(null)" title="Layout-Standard">Auto</div>` +
      _INV_PALETTE.map(c =>
        `<div class="inv-color-swatch${cur === c ? ' on' : ''}" style="background:${c}" onclick="selectInvColor('${c}')" title="${c}"></div>`
      ).join('') +
      `<div class="inv-color-swatch" style="background:${customOn ? cur : 'var(--soft)'};border:1.5px dashed ${customOn ? (cur||'var(--accent)') : 'var(--border)'};position:relative;overflow:hidden;" title="Eigene Farbe">
        <input type="color" style="position:absolute;inset:-8px;opacity:0;cursor:pointer;width:200%;height:200%;" value="${cur||'#C8D93A'}" oninput="selectInvColor(this.value)">
        <span style="font-size:9px;font-weight:700;color:var(--muted);pointer-events:none">+</span>
       </div>`;
    el.innerHTML = swatches;
  }

  function selectInvColor(hex) {
    _invAccent = hex;
    renderInvColorSwatches();
    renderInvPreview();
    _autoSaveInvConfig();
  }

  function _loadInvConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(INV_CONFIG_KEY) || 'null');
      if (saved && saved.felder && saved.texte) {
        if (!saved.layout)  saved.layout  = 'standard';
        if (!saved.docType) saved.docType = 'rechnung';
        return saved;
      }
    } catch(e) {}
    const def = INV_TEMPLATES[0];
    return { template:'standard', layout:'standard', docType:'rechnung', felder:{ ...def.felder }, texte:{ ...def.texte }, invFont:null, invFontSize:null, invAccent:null, zahlungstage:14 };
  }

  function initInvSection() {
    const cfg = _loadInvConfig();
    _activeTemplate = cfg.template  || 'standard';
    _activeLayout   = cfg.layout    || 'standard';
    _activeDocType  = cfg.docType   || 'rechnung';
    _invFelder  = { ...cfg.felder };
    _invFont        = cfg.invFont        || null;
    _invFontSize    = cfg.invFontSize    || null;
    _invAccent      = cfg.invAccent      || null;
    _zahlungstage   = cfg.zahlungstage   || 14;
    _einleitungFont = cfg.einleitungFont || null;
    _schlussFont    = cfg.schlussFont    || null;
    _hinweiseFont   = cfg.hinweiseFont   || null;
    renderLayoutGrid();
    renderInvTplGrid();
    renderInvFieldsGrid();
    const dtSel = document.getElementById('invDocType');
    if (dtSel) dtSel.value = _activeDocType;
    const einl = document.getElementById('invEinleitung');
    const schl = document.getElementById('invSchluss');
    const hinw = document.getElementById('invHinweise');
    if (einl) { einl.value = cfg.texte.einleitung || ''; if (_einleitungFont) einl.style.fontFamily = `'${_einleitungFont}', sans-serif`; }
    if (schl) { schl.value = cfg.texte.schluss    || ''; if (_schlussFont)    schl.style.fontFamily = `'${_schlussFont}', sans-serif`; }
    if (hinw) { hinw.value = cfg.texte.hinweise   || ''; if (_hinweiseFont)   hinw.style.fontFamily = `'${_hinweiseFont}', sans-serif`; }
    _renderInvExampleChips();
    renderInvFontGrid();
    renderInvSizeGrid();
    renderInvColorSwatches();
    renderInvZahlungstageGrid();
    renderTextFontSelects();
    _initLogoPos(cfg);
    renderBlattvorlagen();
  }

  function renderInvTplGrid() {
    const grid = document.getElementById('invTplGrid');
    if (!grid) return;
    grid.innerHTML = INV_TEMPLATES.map(t => `
      <div class="inv-tpl-card${t.id === _activeTemplate ? ' on' : ''}" onclick="selectInvTemplate('${t.id}')">
        <span class="inv-tpl-icon">${t.icon}</span>
        <div>
          <div class="inv-tpl-title">${t.title}</div>
          <div class="inv-tpl-desc">${t.desc}</div>
          <div class="inv-tpl-tags">${t.tags.map(tag => `<span class="inv-tpl-tag">${tag}</span>`).join('')}</div>
        </div>
      </div>`).join('');
  }

  function renderInvFieldsGrid() {
    const grid = document.getElementById('invFieldsGrid');
    if (!grid || !_invFelder) return;
    grid.innerHTML = INV_FELDER_DEFS.map(f => `
      <div class="inv-field-chip${_invFelder[f.key] ? ' on' : ''}" onclick="toggleInvFeld('${f.key}')">
        <span class="inv-field-check">${_invFelder[f.key] ? '✓' : '+'}</span>
        ${f.label}
      </div>`).join('');
  }

  function _renderInvExampleChips() {
    const fields = ['einleitung', 'schluss', 'hinweise'];
    fields.forEach(key => {
      const cap = key.charAt(0).toUpperCase() + key.slice(1);
      const el = document.getElementById('inv' + cap + 'Chips');
      if (!el) return;
      el.innerHTML = INV_BEISPIELE[key].map((text, i) => {
        const preview = text.replace(/\n/g,' ');
        const short = preview.length > 60 ? preview.substring(0, 60) + '…' : preview;
        return `<div class="inv-example-chip" title="${preview.replace(/"/g,'&quot;')}" onclick="applyInvBeispiel('inv${cap}',${i})">↩ ${short}</div>`;
      }).join('');
    });
  }

  function applyInvBeispiel(fieldId, idx) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    const keyMap = { invEinleitung:'einleitung', invSchluss:'schluss', invHinweise:'hinweise' };
    const key = keyMap[fieldId];
    if (key && INV_BEISPIELE[key][idx] !== undefined) el.value = INV_BEISPIELE[key][idx];
    renderInvPreview();
    _autoSaveInvConfig();
  }

  function selectInvTemplate(id) {
    const tpl = INV_TEMPLATES.find(t => t.id === id);
    if (!tpl) return;
    _activeTemplate = id;
    _invFelder = { ...tpl.felder };
    const einl = document.getElementById('invEinleitung');
    const schl = document.getElementById('invSchluss');
    const hinw = document.getElementById('invHinweise');
    if (einl) einl.value = tpl.texte.einleitung || '';
    if (schl) schl.value = tpl.texte.schluss    || '';
    if (hinw) hinw.value = tpl.texte.hinweise   || '';
    renderInvTplGrid();
    renderInvFieldsGrid();
    renderInvPreview();
    _autoSaveInvConfig();
  }

  function toggleInvFeld(key) {
    if (!_invFelder) _invFelder = {};
    _invFelder[key] = !_invFelder[key];
    renderInvFieldsGrid();
    renderInvPreview();
    _autoSaveInvConfig();
  }

  function saveInvConfig() {
    const cfg = {
      template:    _activeTemplate,
      layout:      _activeLayout,
      docType:     _activeDocType,
      logoPos:     _logoPos,
      logoGroesse: _logoGroesse,
      logoSizePx:  _logoSizePx,
      felder: { ...(_invFelder || INV_TEMPLATES[0].felder) },
      texte: {
        einleitung: document.getElementById('invEinleitung')?.value || '',
        schluss:    document.getElementById('invSchluss')?.value    || '',
        hinweise:   document.getElementById('invHinweise')?.value   || '',
      },
      invFont:        _invFont        || null,
      invFontSize:    _invFontSize    || null,
      invAccent:      _invAccent      || null,
      zahlungstage:   _zahlungstage   || 14,
      einleitungFont: _einleitungFont || null,
      schlussFont:    _schlussFont    || null,
      hinweiseFont:   _hinweiseFont   || null,
    };
    try {
      localStorage.setItem(INV_CONFIG_KEY, JSON.stringify(cfg));
      const hint = document.getElementById('invSaveHint');
      if (hint) {
        hint.textContent = '✓ Gespeichert!'; hint.className = 'save-hint ok';
        setTimeout(() => { hint.textContent = 'Konfiguration wird lokal gespeichert.'; hint.className = 'save-hint'; }, 2500);
      }
    } catch(e) { alert('Fehler beim Speichern.'); }
  }

  function resetInvConfig() {
    if (!confirm('Rechnungs-Konfiguration auf Standard zurücksetzen?')) return;
    try { localStorage.removeItem(INV_CONFIG_KEY); } catch(e) {}
    _activeTemplate = 'standard';
    _activeLayout   = 'standard';
    _activeDocType  = 'rechnung';
    _invFelder = null;
    initInvSection();
    const hint = document.getElementById('invSaveHint');
    if (hint) {
      hint.textContent = 'Zurückgesetzt.'; hint.className = 'save-hint ok';
      setTimeout(() => { hint.textContent = 'Konfiguration wird lokal gespeichert.'; hint.className = 'save-hint'; }, 2500);
    }
  }

  /* ── Blattvorlagen: eigene Vorlagen speichern & laden ── */

  function _getBlattvlg() {
    try { return JSON.parse(localStorage.getItem(BLATTVLG_KEY) || '[]'); } catch(e) { return []; }
  }

  function _setBlattvlg(arr) {
    try { localStorage.setItem(BLATTVLG_KEY, JSON.stringify(arr)); } catch(e) {}
  }

  function _currentInvCfg() {
    return {
      template:       _activeTemplate,
      layout:         _activeLayout,
      docType:        _activeDocType,
      logoPos:        _logoPos,
      logoGroesse:    _logoGroesse,
      logoSizePx:     _logoSizePx,
      felder:         { ...(_invFelder || INV_TEMPLATES[0].felder) },
      texte: {
        einleitung: document.getElementById('invEinleitung')?.value || '',
        schluss:    document.getElementById('invSchluss')?.value    || '',
        hinweise:   document.getElementById('invHinweise')?.value   || '',
      },
      invFont:        _invFont        || null,
      invFontSize:    _invFontSize    || null,
      invAccent:      _invAccent      || null,
      zahlungstage:   _zahlungstage   || 14,
      einleitungFont: _einleitungFont || null,
      schlussFont:    _schlussFont    || null,
      hinweiseFont:   _hinweiseFont   || null,
    };
  }

  function _applyBlattvlgCfg(cfg) {
    _activeTemplate = cfg.template  || 'standard';
    _activeLayout   = cfg.layout    || 'standard';
    _activeDocType  = cfg.docType   || 'rechnung';
    _invFelder      = cfg.felder ? { ...cfg.felder } : null;
    _invFont        = cfg.invFont        || null;
    _invFontSize    = cfg.invFontSize    || null;
    _invAccent      = cfg.invAccent      || null;
    _zahlungstage   = cfg.zahlungstage   || 14;
    _einleitungFont = cfg.einleitungFont || null;
    _schlussFont    = cfg.schlussFont    || null;
    _hinweiseFont   = cfg.hinweiseFont   || null;
    renderLayoutGrid();
    renderInvTplGrid();
    renderInvFieldsGrid();
    const dtSel = document.getElementById('invDocType');
    if (dtSel) dtSel.value = _activeDocType;
    const t    = cfg.texte || {};
    const einl = document.getElementById('invEinleitung');
    const schl = document.getElementById('invSchluss');
    const hinw = document.getElementById('invHinweise');
    if (einl) { einl.value = t.einleitung || ''; if (_einleitungFont) einl.style.fontFamily = `'${_einleitungFont}', sans-serif`; }
    if (schl) { schl.value = t.schluss    || ''; if (_schlussFont)    schl.style.fontFamily = `'${_schlussFont}', sans-serif`; }
    if (hinw) { hinw.value = t.hinweise   || ''; if (_hinweiseFont)   hinw.style.fontFamily = `'${_hinweiseFont}', sans-serif`; }
    _renderInvExampleChips();
    renderInvFontGrid();
    renderInvSizeGrid();
    renderInvColorSwatches();
    renderInvZahlungstageGrid();
    renderTextFontSelects();
    _initLogoPos(cfg);
  }

  function saveAsBlattvorlage() {
    const name = prompt('Name für diese Vorlage:', 'Meine Vorlage');
    if (!name || !name.trim()) return;
    const arr = _getBlattvlg();
    arr.push({ id: Date.now(), name: name.trim(), cfg: _currentInvCfg() });
    _setBlattvlg(arr);
    renderBlattvorlagen();
    const hint = document.getElementById('invSaveHint');
    if (hint) {
      hint.textContent = `✓ Vorlage „${name.trim()}" gespeichert!`;
      hint.className = 'save-hint ok';
      setTimeout(() => { hint.textContent = 'Konfiguration wird lokal gespeichert.'; hint.className = 'save-hint'; }, 2500);
    }
  }

  function loadBlattvorlage(id) {
    const vlg = _getBlattvlg().find(v => v.id === id);
    if (!vlg) return;
    _applyBlattvlgCfg(vlg.cfg);
    renderBlattvorlagen();
    const hint = document.getElementById('invSaveHint');
    if (hint) {
      hint.textContent = `✓ Vorlage „${vlg.name}" geladen!`;
      hint.className = 'save-hint ok';
      setTimeout(() => { hint.textContent = 'Konfiguration wird lokal gespeichert.'; hint.className = 'save-hint'; }, 2500);
    }
  }

  function deleteBlattvorlage(id) {
    const arr = _getBlattvlg();
    const vlg = arr.find(v => v.id === id);
    if (!vlg || !confirm(`Vorlage „${vlg.name}" löschen?`)) return;
    _setBlattvlg(arr.filter(v => v.id !== id));
    renderBlattvorlagen();
  }

  function renderBlattvorlagen() {
    const el = document.getElementById('blattvorlagenList');
    if (!el) return;
    const arr = _getBlattvlg();
    if (!arr.length) {
      el.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px 0;">Noch keine Vorlagen gespeichert.</div>';
      return;
    }
    el.innerHTML = arr.map(v => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer;background:var(--surface);transition:border-color .12s;" onclick="loadBlattvorlage(${v.id})" title="Klicken zum Laden">
        <span style="font-size:13px;font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${v.name}</span>
        <button type="button" onclick="event.stopPropagation();deleteBlattvorlage(${v.id})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;padding:0 2px;line-height:1;flex-shrink:0;" title="Vorlage löschen">×</button>
      </div>`).join('');
  }

  /* ══════════════════════════════════════════════════════════════════
     E-MAIL-EINSTELLUNGEN
  ══════════════════════════════════════════════════════════════════ */
  const EMAIL_KEY = 'max4work_email_settings';
  const EMAIL_SIG_KEY = 'max4work_email_signaturen';
  function _getEmailSigs() { return JSON.parse(localStorage.getItem(EMAIL_SIG_KEY) || '[]'); }
  function _setEmailSigs(arr) { localStorage.setItem(EMAIL_SIG_KEY, JSON.stringify(arr)); }

  const EMAIL_EXAMPLES = {
    rechnung: [
      'Sehr geehrte Damen und Herren,<br>anbei erhalten Sie Rechnung Nr. [Nr] in Höhe von [Betrag].<br>Ich bitte um Überweisung bis zum [Fälligkeit].<br><br>Mit freundlichen Grüßen',
      'Guten Tag,<br>beiliegend finden Sie meine Rechnung Nr. [Nr] vom [Datum].<br>Ich danke Ihnen für die angenehme Zusammenarbeit.<br><br>Mit freundlichen Grüßen',
      'Sehr geehrte/r [Anrede],<br>für die erbrachten Leistungen überreiche ich Ihnen anbei die Rechnung Nr. [Nr].<br>Bei Fragen stehe ich Ihnen jederzeit gerne zur Verfügung.<br><br>Freundliche Grüße',
      'Anbei erhalten Sie meine Rechnung. Vielen Dank für Ihren Auftrag – ich freue mich auf weitere Zusammenarbeit.<br><br>Mit freundlichen Grüßen',
    ],
    mahnung: [
      'Sehr geehrte Damen und Herren,<br>leider ist die Zahlung für Rechnung Nr. [Nr] vom [Datum] über [Betrag] noch ausstehend.<br>Ich bitte Sie, den Betrag bis zum [Frist] zu überweisen.<br><br>Mit freundlichen Grüßen',
      'Guten Tag,<br>unsere Rechnung Nr. [Nr] ist noch nicht beglichen. Bitte überweisen Sie [Betrag] bis [Frist].<br>Bei bereits erfolgter Zahlung bitte ich Sie, dieses Schreiben als gegenstandslos zu betrachten.<br><br>Freundliche Grüße',
      'Sehr geehrte/r [Anrede],<br>ich erlaube mir, Sie freundlich an den offenen Betrag von [Betrag] (Rechnung Nr. [Nr]) zu erinnern.<br>Eine kurzfristige Überweisung wäre sehr willkommen.<br><br>Mit freundlichen Grüßen',
    ],
    angebot: [
      'Sehr geehrte Damen und Herren,<br>vielen Dank für Ihr Interesse. Anbei erhalten Sie mein Angebot Nr. [Nr].<br>Das Angebot ist gültig bis zum [Fälligkeit]. Für Rückfragen stehe ich Ihnen gerne zur Verfügung.<br><br>Mit freundlichen Grüßen',
      'Guten Tag,<br>beiliegend übersende ich Ihnen ein Angebot für die angeforderten Leistungen.<br>Gerne bespreche ich Details in einem persönlichen Gespräch.<br><br>Freundliche Grüße',
      'Sehr geehrte/r [Anrede],<br>ich freue mich, Ihnen beiliegendes Angebot unterbreiten zu dürfen.<br>Über Ihre Auftragserteilung würde ich mich sehr freuen.<br><br>Mit freundlichen Grüßen',
    ],
    allgemein: [
      'Sehr geehrte Damen und Herren,<br><br>Mit freundlichen Grüßen',
      'Guten Tag,<br><br>Für Rückfragen stehe ich Ihnen jederzeit gerne zur Verfügung.<br><br>Freundliche Grüße',
      'Vielen Dank für Ihre Nachricht. Ich melde mich zeitnah bei Ihnen.<br><br>Mit freundlichen Grüßen',
      'Bitte finden Sie anbei die gewünschten Unterlagen. Bei Fragen bin ich für Sie da.<br><br>Freundliche Grüße',
    ],
  };

  const VTAB_PLACEHOLDERS = {
    rechnung: 'E-Mail-Text für Rechnungen eingeben …',
    mahnung:  'E-Mail-Text für Mahnungen eingeben …',
    angebot:  'E-Mail-Text für Angebote eingeben …',
    allgemein:'Allgemeiner E-Mail-Text …',
  };

  let _emailCurrentVorlage = 'rechnung';

  function buildEmailToolbar(toolbarId, editorId) {
    const toolbar = document.getElementById(toolbarId);
    if (!toolbar) return;
    const FONTS = ['Arial','Calibri','Times New Roman','Verdana','Georgia','Courier New','Tahoma','Trebuchet MS'];
    const SIZES = [8,9,10,11,12,14,16,18,20,24,28,36];
    const ed = `document.getElementById('${editorId}')`;

    const fOpts = FONTS.map(f => `<option value="${f}">${f}</option>`).join('');
    const sOpts = SIZES.map(s => `<option value="${s}"${s===12?' selected':''}>${s}</option>`).join('');

    toolbar.innerHTML = `
      <select class="etb-select" style="min-width:115px"
        onchange="${ed}.focus();document.execCommand('fontName',false,this.value)">${fOpts}</select>
      <select class="etb-select" style="min-width:50px;margin-left:2px"
        onchange="${ed}.focus();_etbFontSize(this.value,'${editorId}')">${sOpts}</select>
      <div class="etb-sep"></div>
      <button class="etb-btn" title="Fett (Strg+B)"
        onmousedown="event.preventDefault();document.getElementById('${editorId}').focus();document.execCommand('bold')"><b style="font-weight:800">F</b></button>
      <button class="etb-btn" title="Kursiv (Strg+I)"
        onmousedown="event.preventDefault();document.getElementById('${editorId}').focus();document.execCommand('italic')"><i>K</i></button>
      <button class="etb-btn" title="Unterstreichen (Strg+U)"
        onmousedown="event.preventDefault();document.getElementById('${editorId}').focus();document.execCommand('underline')"><u>U</u></button>
      <button class="etb-btn" title="Durchstreichen"
        onmousedown="event.preventDefault();document.getElementById('${editorId}').focus();document.execCommand('strikeThrough')"><s style="text-decoration-thickness:2px">S</s></button>
      <div class="etb-sep"></div>
      <div class="etb-color-wrap" title="Textfarbe">
        <div class="etb-color-btn">
          <span class="etb-color-lbl">A</span>
          <div class="etb-color-bar" id="${toolbarId}CBar"></div>
        </div>
        <input type="color" class="etb-color-input" value="#000000"
          onchange="${ed}.focus();document.execCommand('foreColor',false,this.value);document.getElementById('${toolbarId}CBar').style.background=this.value">
      </div>
      <div class="etb-sep"></div>
      <button class="etb-btn" title="Linksbündig"
        onmousedown="event.preventDefault();document.getElementById('${editorId}').focus();document.execCommand('justifyLeft')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg></button>
      <button class="etb-btn" title="Zentriert"
        onmousedown="event.preventDefault();document.getElementById('${editorId}').focus();document.execCommand('justifyCenter')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg></button>
      <button class="etb-btn" title="Rechtsbündig"
        onmousedown="event.preventDefault();document.getElementById('${editorId}').focus();document.execCommand('justifyRight')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg></button>
      <div class="etb-sep"></div>
      <button class="etb-btn" title="Aufzählung"
        onmousedown="event.preventDefault();document.getElementById('${editorId}').focus();document.execCommand('insertUnorderedList')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><circle cx="4.5" cy="6" r="1.8" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.8" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.8" fill="currentColor" stroke="none"/></svg></button>
      <button class="etb-btn" title="Nummerierte Liste"
        onmousedown="event.preventDefault();document.getElementById('${editorId}').focus();document.execCommand('insertOrderedList')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="11" y1="6" x2="21" y2="6"/><line x1="11" y1="12" x2="21" y2="12"/><line x1="11" y1="18" x2="21" y2="18"/><text x="2" y="8" style="font-size:7px;font-weight:700;fill:currentColor;stroke:none">1</text><text x="2" y="14" style="font-size:7px;font-weight:700;fill:currentColor;stroke:none">2</text><text x="2" y="20" style="font-size:7px;font-weight:700;fill:currentColor;stroke:none">3</text></svg></button>
      <div class="etb-sep"></div>
      <button class="etb-btn" title="Inhalt löschen" style="color:var(--muted)"
        onmousedown="event.preventDefault();if(confirm('Inhalt löschen?'))document.getElementById('${editorId}').innerHTML=''">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>`;
  }

  function _etbFontSize(px, editorId) {
    const ed = document.getElementById(editorId);
    if (!ed) return;
    ed.focus();
    document.execCommand('fontSize', false, '7');
    ed.querySelectorAll('font[size="7"]').forEach(el => {
      el.removeAttribute('size');
      el.style.fontSize = px + 'px';
    });
  }

  function initEmailSettings() {
    buildEmailToolbar('emailVorlageToolbar', 'emailVorlageEditor');
    buildEmailToolbar('emailSignaturToolbar', 'emailSignaturEditor');
    _loadEmailSettings();
    _renderEmailChips('rechnung');
    renderEmailSigList();
  }

  function _loadEmailSettings() {
    const data = JSON.parse(localStorage.getItem(EMAIL_KEY) || '{}');
    const n = document.getElementById('emailAbsenderName');
    const a = document.getElementById('emailAbsenderAdresse');
    const b = document.getElementById('emailBetreff');
    if (n) n.value = data.absenderName || '';
    if (a) a.value = data.absenderAdresse || '';
    if (b) b.value = data.betreff || 'Rechnung [Nr] – [Firma]';
    const vor = (data.vorlagen || {})[_emailCurrentVorlage] || '';
    const ed = document.getElementById('emailVorlageEditor');
    if (ed) ed.innerHTML = vor;
    const sig = document.getElementById('emailSignaturEditor');
    if (sig) sig.innerHTML = data.signatur || '';
  }

  function _hint(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className = 'save-hint ok';
    setTimeout(() => { el.textContent = ''; el.className = 'save-hint'; }, 2800);
  }

  function saveEmailKonto() {
    const data = JSON.parse(localStorage.getItem(EMAIL_KEY) || '{}');
    data.absenderName     = (document.getElementById('emailAbsenderName')?.value || '').trim();
    data.absenderAdresse  = (document.getElementById('emailAbsenderAdresse')?.value || '').trim();
    data.betreff          = (document.getElementById('emailBetreff')?.value || '').trim();
    localStorage.setItem(EMAIL_KEY, JSON.stringify(data));
    _hint('emailKontoHint', '✓ Gespeichert');
  }

  function saveEmailVorlage() {
    const data = JSON.parse(localStorage.getItem(EMAIL_KEY) || '{}');
    if (!data.vorlagen) data.vorlagen = {};
    data.vorlagen[_emailCurrentVorlage] = document.getElementById('emailVorlageEditor')?.innerHTML || '';
    localStorage.setItem(EMAIL_KEY, JSON.stringify(data));
    _hint('emailVorlageHint', '✓ Vorlage gespeichert');
  }

  function saveEmailSignatur() {
    const data = JSON.parse(localStorage.getItem(EMAIL_KEY) || '{}');
    const html = document.getElementById('emailSignaturEditor')?.innerHTML || '';
    data.signatur = html;
    localStorage.setItem(EMAIL_KEY, JSON.stringify(data));
    const name = prompt('Signatur-Name:');
    if (name && name.trim()) {
      const sigs = _getEmailSigs();
      sigs.push({ id: Date.now(), name: name.trim(), html });
      _setEmailSigs(sigs);
      renderEmailSigList();
    }
    _hint('emailSignaturHint', '✓ Signatur gespeichert');
  }

  function renderEmailSigList() {
    const list = document.getElementById('emailSignaturList');
    const empty = document.getElementById('emailSignaturListEmpty');
    if (!list) return;
    const sigs = _getEmailSigs();
    if (!sigs.length) {
      list.innerHTML = '';
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';
    list.innerHTML = sigs.map(s => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--soft);border:1px solid var(--border);border-radius:8px;cursor:pointer;" onclick="loadEmailSig(${s.id})">
        <span style="font-size:13px;color:var(--text);">${s.name}</span>
        <button onclick="event.stopPropagation();deleteEmailSig(${s.id})" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:18px;line-height:1;padding:0 2px;">×</button>
      </div>
    `).join('');
  }

  function loadEmailSig(id) {
    const sig = _getEmailSigs().find(s => s.id === id);
    if (!sig) return;
    const ed = document.getElementById('emailSignaturEditor');
    if (ed) ed.innerHTML = sig.html;
    _hint('emailSignaturHint', '✓ Geladen');
  }

  function deleteEmailSig(id) {
    if (!confirm('Signatur löschen?')) return;
    _setEmailSigs(_getEmailSigs().filter(s => s.id !== id));
    renderEmailSigList();
  }

  function switchEmailVorlage(key, btn) {
    const data = JSON.parse(localStorage.getItem(EMAIL_KEY) || '{}');
    if (!data.vorlagen) data.vorlagen = {};
    data.vorlagen[_emailCurrentVorlage] = document.getElementById('emailVorlageEditor')?.innerHTML || '';
    localStorage.setItem(EMAIL_KEY, JSON.stringify(data));

    _emailCurrentVorlage = key;
    document.querySelectorAll('.vtab').forEach(t => t.classList.remove('on'));
    btn.classList.add('on');

    const ed = document.getElementById('emailVorlageEditor');
    if (ed) {
      ed.innerHTML = (data.vorlagen[key] || '');
      ed.dataset.placeholder = VTAB_PLACEHOLDERS[key] || '';
    }
    _renderEmailChips(key);
  }

  function _renderEmailChips(key) {
    const container = document.getElementById('emailExampleChips');
    if (!container) return;
    const examples = EMAIL_EXAMPLES[key] || [];
    container.innerHTML = examples.map((t, i) => {
      const plain = t.replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const label = plain.length > 62 ? plain.slice(0, 62) + ' …' : plain;
      return `<span class="email-chip" onclick="_insertEmailExample(${i},'${key}')">${label}</span>`;
    }).join('');
  }

  function _insertEmailExample(idx, key) {
    const html = (EMAIL_EXAMPLES[key] || [])[idx];
    if (!html) return;
    const ed = document.getElementById('emailVorlageEditor');
    if (!ed) return;
    ed.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const frag = range.createContextualFragment(html);
      range.insertNode(frag);
      sel.collapseToEnd();
    } else {
      ed.innerHTML += html;
    }
  }

  load();
  loadAppDesignSelection();

  // Schrift-Dropdown bei Klick außerhalb schließen
  document.addEventListener('click', e => {
    if (!e.target.closest('#invFontWrap')) _closeFontDd();
  });

/* ═══ KI-Integration (Claude API) ═══ */
const OCR_KEY_STORE = 'max4work_ocr_key';

function _initOcrKey() {
  const key = localStorage.getItem(OCR_KEY_STORE);
  const inp = document.getElementById('ocrApiKeyInput');
  const clearBtn = document.getElementById('ocrKeyClearBtn');
  const status = document.getElementById('ocrKeyStatus');
  if (!inp) return;
  if (key) {
    inp.placeholder = key.slice(0, 4) + '…' + key.slice(-4);
    if (clearBtn) clearBtn.style.display = 'inline-flex';
    if (status) { status.textContent = '✓ Eigener Key hinterlegt'; status.style.color = 'var(--green)'; }
  } else {
    inp.placeholder = 'K12345678';
    if (clearBtn) clearBtn.style.display = 'none';
    if (status) { status.textContent = 'Demo-Key aktiv'; status.style.color = 'var(--muted)'; }
  }
}

function saveOcrKey() {
  const inp = document.getElementById('ocrApiKeyInput');
  const key = (inp?.value || '').trim();
  if (!key) { alert('Bitte einen OCR.space API-Key eingeben.'); return; }
  localStorage.setItem(OCR_KEY_STORE, key);
  if (inp) inp.value = '';
  _initOcrKey();
}

function clearOcrKey() {
  if (!confirm('OCR.space API-Key entfernen? Danach wird der Demo-Key verwendet.')) return;
  localStorage.removeItem(OCR_KEY_STORE);
  _initOcrKey();
}

_initOcrKey();

/* ═══ Steuerberater-Jahrespaket ═══ */

function _stbInitJahr() {
  const sel = document.getElementById('stbJahr');
  if (!sel) return;
  const rechnungen = JSON.parse(localStorage.getItem('max4work_rechnungen') || '[]');
  const belege     = JSON.parse(localStorage.getItem('max4work_belege')     || '[]');
  const fahrten    = JSON.parse(localStorage.getItem('max4work_fahrtenbuch')|| '[]');
  const allDaten   = [...rechnungen.map(r=>r.datum), ...belege.map(b=>b.datum), ...fahrten.map(f=>f.datum)];
  const jahre = [...new Set(allDaten.map(d=>(d||'').substring(0,4)).filter(Boolean))].sort().reverse();
  const thisYear = new Date().getFullYear().toString();
  if (!jahre.includes(thisYear)) jahre.unshift(thisYear);
  sel.innerHTML = jahre.map(j=>`<option value="${j}"${j===thisYear?' selected':''}>${j}</option>`).join('');
}

function _stbDvTs(d) {
  return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+
    String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')+String(d.getSeconds()).padStart(2,'0')+'000';
}
function _stbDvDate(iso) { if(!iso)return''; const[,m,d]=iso.split('-'); return d+m; }

function _stbDatevRechnungen(list, jahr) {
  if (!list.length) return null;
  const now=new Date(); const ts=_stbDvTs(now);
  const dates=list.map(r=>r.datum).filter(Boolean).sort();
  const von=(dates[0]||jahr+'-01-01').replace(/-/g,'');
  const bis=(dates[dates.length-1]||jahr+'-12-31').replace(/-/g,'');
  const vorlauf=['"EXTF"',700,21,'"Buchungsstapel"',13,ts,'','"RE"','"max4work"','','','',
    '',jahr+'0101',4,'',von,'',bis,'','"Rechnungen '+jahr+'"','',1,'',0,'"EUR"'].join(';');
  const cols='Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;Kurs;Basis-Umsatz;WKZ Basis-Umsatz;Konto;Gegenkonto (ohne BU-Schlüssel);BU-Schlüssel;Belegdatum;Belegfeld 1;Belegfeld 2;Skonto;Buchungstext';
  const rows=list.map(r=>{
    const b=parseFloat(r.betrag||0).toFixed(2).replace('.',',');
    const dat=_stbDvDate(r.datum); const nr=(r.nr||'').substring(0,36).replace(/[";]/g,' ');
    const txt=(r.kunde||'').substring(0,30).replace(/[";]/g,' ');
    return `${b};H;EUR;;;;8200;1400;;${dat};"${nr}";;;"${txt}"`;
  }).join('\r\n');
  return vorlauf+'\r\n'+cols+'\r\n'+rows;
}

function _stbDatevBelege(list, jahr) {
  const steuBelege=list.filter(b=>b.steuer);
  if (!steuBelege.length) return null;
  const now=new Date(); const ts=_stbDvTs(now);
  const dates=steuBelege.map(b=>b.datum).filter(Boolean).sort();
  const von=(dates[0]||jahr+'-01-01').replace(/-/g,'');
  const bis=(dates[dates.length-1]||jahr+'-12-31').replace(/-/g,'');
  const vorlauf=['"EXTF"',700,21,'"Buchungsstapel"',13,ts,'','"RE"','"max4work"','','','',
    '',jahr+'0101',4,'',von,'',bis,'','"Ausgaben '+jahr+'"','',1,'',0,'"EUR"'].join(';');
  const cols='Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;Kurs;Basis-Umsatz;WKZ Basis-Umsatz;Konto;Gegenkonto (ohne BU-Schlüssel);BU-Schlüssel;Belegdatum;Belegfeld 1;Belegfeld 2;Skonto;Buchungstext';
  const KTO={'Material':'3980','Werkzeug':'4900','Fahrzeug':'4530','Büro':'4930','Sonstiges':'4980'};
  let lfd=1;
  const rows=steuBelege.map(b=>{
    const bet=parseFloat(b.betrag||0).toFixed(2).replace('.',',');
    const dat=_stbDvDate(b.datum);
    let kto=KTO[b.kat]||'4980'; if(b.kat==='Fahrzeug'&&b.subtyp==='parken') kto='4540';
    const nr=String(lfd++).padStart(4,'0');
    const txt=(b.notiz||b.kat||'').substring(0,30).replace(/[";]/g,' ');
    return `${bet};S;EUR;;;;${kto};1200;;${dat};"${nr}";;;"${txt}"`;
  }).join('\r\n');
  return vorlauf+'\r\n'+cols+'\r\n'+rows;
}

async function exportSteuerberater() {
  const jahr   = document.getElementById('stbJahr')?.value || new Date().getFullYear().toString();
  const status = document.getElementById('stbStatus');
  const _show  = (msg, color) => { status.style.display='block'; status.textContent=msg; status.style.color=color||'var(--muted)'; };

  if (typeof JSZip === 'undefined') {
    _show('Lädt JSZip…');
    await new Promise((resolve, reject) => {
      const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload=resolve; s.onerror=()=>reject(new Error('JSZip nicht geladen – Internetverbindung prüfen.'));
      document.head.appendChild(s);
    }).catch(err=>{ _show('✗ '+err.message,'var(--red)'); throw err; });
  }

  try {
    _show('Erstelle Jahrespaket…');

    const rechnungen = JSON.parse(localStorage.getItem('max4work_rechnungen') || '[]');
    const belege     = JSON.parse(localStorage.getItem('max4work_belege')     || '[]');
    const fahrten    = JSON.parse(localStorage.getItem('max4work_fahrtenbuch')|| '[]');
    const sets       = JSON.parse(localStorage.getItem('max4work_einstellungen')|| '{}');

    const rF = rechnungen.filter(r=>(r.datum||'').startsWith(jahr));
    const bF = belege.filter(b=>(b.datum||'').startsWith(jahr));
    const fF = fahrten.filter(f=>(f.datum||'').startsWith(jahr));

    // Kennzahlen
    const einnahmen = rF.filter(r=>r.status==='bezahlt').reduce((s,r)=>s+parseFloat(r.betrag||0),0);
    const ausgaben  = bF.reduce((s,b)=>s+parseFloat(b.betrag||0),0);
    const dienstKm  = fF.filter(f=>f.zweck==='dienstlich').reduce((s,f)=>s+(f.distanz||0),0);
    const fahrKosten= dienstKm * 0.30;
    const gewinn    = einnahmen - ausgaben - fahrKosten;

    const fmtE = n => n.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
    const now  = new Date().toLocaleString('de-DE');

    // Ausgaben nach Kategorie
    const ausKat = {};
    bF.forEach(b=>{ const k=b.kat||'Sonstiges'; ausKat[k]=(ausKat[k]||0)+parseFloat(b.betrag||0); });

    // EÜR-Zusammenfassung
    let txt = `max4work – Steuerberater-Jahrespaket ${jahr}\n`;
    txt += `Erstellt: ${now}\n`;
    txt += `Unternehmen: ${sets.sName||'—'} | StNr: ${sets.sStNr||'—'}\n`;
    txt += `${'='.repeat(60)}\n\n`;

    txt += `EINNAHMEN (bezahlte Rechnungen)\n${'─'.repeat(60)}\n`;
    txt += `  ${rF.filter(r=>r.status==='bezahlt').length} Rechnungen bezahlt`.padEnd(45)+fmtE(einnahmen).padStart(15)+'\n';
    txt += `  ${rF.filter(r=>r.status==='offen').length} Rechnungen noch offen\n\n`;

    txt += `AUSGABEN (Belege)\n${'─'.repeat(60)}\n`;
    Object.entries(ausKat).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>{
      txt += `  ${k}`.padEnd(45)+fmtE(v).padStart(15)+'\n';
    });
    txt += `${'─'.repeat(60)}\n`;
    txt += `  Gesamt Ausgaben`.padEnd(45)+fmtE(ausgaben).padStart(15)+'\n\n';

    txt += `FAHRKOSTEN (0,30 €/km)\n${'─'.repeat(60)}\n`;
    txt += `  Dienstliche Fahrten: ${dienstKm.toLocaleString('de-DE')} km × 0,30 €`.padEnd(45)+fmtE(fahrKosten).padStart(15)+'\n';
    txt += `  Private Fahrten: ${fF.filter(f=>f.zweck==='privat').reduce((s,f)=>s+(f.distanz||0),0).toLocaleString('de-DE')} km (nicht abzugsfähig)\n\n`;

    txt += `VORLÄUFIGE EÜR\n${'─'.repeat(60)}\n`;
    txt += `  Einnahmen`.padEnd(45)+fmtE(einnahmen).padStart(15)+'\n';
    txt += `  Ausgaben (Belege)`.padEnd(45)+('-'+fmtE(ausgaben)).padStart(15)+'\n';
    txt += `  Fahrkosten`.padEnd(45)+('-'+fmtE(fahrKosten)).padStart(15)+'\n';
    txt += `${'─'.repeat(60)}\n`;
    txt += `  Vorläufiger Gewinn / Verlust`.padEnd(45)+(gewinn>=0?fmtE(gewinn):'-'+fmtE(-gewinn)).padStart(15)+'\n\n';
    txt += `Hinweis: Diese Zusammenfassung dient als Orientierung. Die endgültige EÜR erstellt Ihr Steuerberater.\n`;
    txt += `${'='.repeat(60)}\nEnde des Dokuments\n`;

    const zip = new JSZip();
    const dvR = _stbDatevRechnungen(rF, jahr);
    const dvB = _stbDatevBelege(bF, jahr);
    if (dvR) zip.file(`DATEV_Rechnungen_${jahr}.csv`, '﻿'+dvR);
    if (dvB) zip.file(`DATEV_Ausgaben_${jahr}.csv`,   '﻿'+dvB);
    zip.file(`Rechnungen_${jahr}.json`,   JSON.stringify(rF, null, 2));
    zip.file(`Belege_${jahr}.json`,       JSON.stringify(bF, null, 2));
    zip.file(`Fahrtenbuch_${jahr}.json`,  JSON.stringify(fF, null, 2));
    zip.file(`EÜR_Zusammenfassung_${jahr}.txt`, txt);

    const blob = await zip.generateAsync({ type:'blob', compression:'DEFLATE', compressionOptions:{level:6} });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href=url; a.download=`max4work_Steuerberater_${jahr}_${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);

    _show(`✓ Jahrespaket ${jahr}: ${rF.length} Rechnungen, ${bF.length} Belege, ${fF.length} Fahrten`, 'var(--green)');
    setTimeout(()=>{ status.style.display='none'; status.style.color=''; }, 5000);

  } catch(err) {
    _show('✗ Fehler: '+(err.message||'Unbekannt'), 'var(--red)');
  }
}

_stbInitJahr();

/* ═══ GoBD-Export ═══ */

function _gobdInitJahr() {
  const sel = document.getElementById('gobdJahr');
  if (!sel) return;
  const rechnungen = JSON.parse(localStorage.getItem('max4work_rechnungen') || '[]');
  const jahre = [...new Set(rechnungen.map(r => (r.datum||'').substring(0,4)).filter(Boolean))].sort().reverse();
  const thisYear = new Date().getFullYear().toString();
  if (!jahre.includes(thisYear)) jahre.unshift(thisYear);
  sel.innerHTML = '<option value="alle">Alle Jahre</option>' +
    jahre.map(j => `<option value="${j}"${j === thisYear ? ' selected' : ''}>${j}</option>`).join('');
}

async function exportGoBD() {
  const jahr   = document.getElementById('gobdJahr')?.value || 'alle';
  const status = document.getElementById('gobdStatus');

  const _show = (msg, color) => {
    status.style.display = 'block';
    status.textContent   = msg;
    status.style.color   = color || 'var(--muted)';
  };

  if (typeof JSZip === 'undefined') {
    _show('Lädt JSZip…');
    await new Promise((resolve, reject) => {
      const s   = document.createElement('script');
      s.src     = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload  = resolve;
      s.onerror = () => reject(new Error('JSZip konnte nicht geladen werden – bitte Internetverbindung prüfen.'));
      document.head.appendChild(s);
    }).catch(err => { _show('✗ ' + err.message, 'var(--red)'); throw err; });
  }

  try {
    _show('Erstelle ZIP…');

    const rechnungen = JSON.parse(localStorage.getItem('max4work_rechnungen') || '[]');
    const belege     = JSON.parse(localStorage.getItem('max4work_belege')     || '[]');
    const gobdLog    = JSON.parse(localStorage.getItem('max4work_gobd_log')   || '[]');

    const byJahr = (arr, feld) => jahr === 'alle' ? arr : arr.filter(e => (e[feld]||'').startsWith(jahr));
    const rF = byJahr(rechnungen, 'datum');
    const bF = byJahr(belege, 'datum');
    const lF = jahr === 'alle' ? gobdLog : gobdLog.filter(e => (e.ts||'').startsWith(jahr));

    const fmtD = v => { if (!v) return '—'; const [y,m,d] = v.split('-'); return `${d}.${m}.${y}`; };
    const fmtB = n => parseFloat(n||0).toFixed(2).replace('.', ',') + ' €';
    const now  = new Date().toLocaleString('de-DE');

    let proto = `max4work – GoBD-Prüfprotokoll\n`;
    proto += `Exportiert: ${now}\n`;
    proto += `Geschäftsjahr: ${jahr === 'alle' ? 'Alle Jahre' : jahr}\n`;
    proto += `${'='.repeat(70)}\n\n`;

    proto += `RECHNUNGEN (${rF.length})\n${'─'.repeat(70)}\n`;
    proto += `${'Nr.'.padEnd(16)} ${'Datum'.padEnd(10)} ${'Kunde'.padEnd(28)} ${'Betrag'.padStart(12)}  ${'Status'.padEnd(10)} Archiviert\n`;
    rF.forEach(r => {
      proto += `${(r.nr||'').padEnd(16)} ${fmtD(r.datum).padEnd(10)} ${(r.kunde||'').substring(0,27).padEnd(28)} ${fmtB(r.betrag).padStart(12)}  ${(r.status||'').padEnd(10)} ${r.locked ? 'Ja' : 'Nein'}\n`;
    });

    proto += `\nBELEGE (${bF.length})\n${'─'.repeat(70)}\n`;
    proto += `${'Datum'.padEnd(10)} ${'Betrag'.padStart(12)}  ${'Kategorie'.padEnd(20)} Beschreibung\n`;
    bF.forEach(b => {
      proto += `${fmtD(b.datum).padEnd(10)} ${fmtB(b.betrag).padStart(12)}  ${(b.kategorie||'').substring(0,19).padEnd(20)} ${(b.beschreibung||b.text||'').substring(0,45)}\n`;
    });

    proto += `\nAUDIT-LOG (${lF.length} Einträge)\n${'─'.repeat(70)}\n`;
    lF.forEach(e => {
      const d = new Date(e.ts||'').toLocaleString('de-DE');
      proto += `${d.padEnd(20)}  ${(e.aktion||'').padEnd(22)} ${(e.nr||'').padEnd(14)} ${e.kunde||''}\n`;
    });

    proto += `\n${'='.repeat(70)}\nEnde des Protokolls\n`;

    const zip = new JSZip();
    zip.file('Rechnungen.json',    JSON.stringify(rF, null, 2));
    zip.file('Belege.json',        JSON.stringify(bF, null, 2));
    zip.file('GoBD_Auditlog.json', JSON.stringify(lF, null, 2));
    zip.file('Pruefprotokoll.txt', proto);

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `max4work_GoBD_${jahr}_${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    _show(`✓ ZIP erstellt: ${rF.length} Rechnungen, ${bF.length} Belege, ${lF.length} Audit-Einträge`, 'var(--green)');
    setTimeout(() => { status.style.display = 'none'; status.style.color = ''; }, 5000);

  } catch(err) {
    _show('✗ Fehler: ' + (err.message || 'Unbekannt'), 'var(--red)');
  }
}

_gobdInitJahr();

/* ═══ Mahnungseinstellungen ═══ */

const MAHN_KEY = 'max4work_mahn_config';
const MAHN_DEFAULTS = {
  stufe1: { bezeichnung: 'Zahlungserinnerung', tage: 7,  gebuehr: 0,  text: 'Wir erlauben uns, Sie freundlich auf den noch offenen Rechnungsbetrag hinzuweisen. Möglicherweise haben Sie die Zahlung übersehen. Bitte überweisen Sie den ausstehenden Betrag innerhalb der angegebenen Frist auf das unten genannte Konto.' },
  stufe2: { bezeichnung: '1. Mahnung',         tage: 7,  gebuehr: 5,  text: 'Trotz unserer Zahlungserinnerung haben wir bis heute noch keinen Zahlungseingang für die unten genannte Rechnung verzeichnen können. Wir bitten Sie dringend, den offenen Betrag zuzüglich der Mahngebühr innerhalb der gesetzten Frist zu begleichen.' },
  stufe3: { bezeichnung: '2. Mahnung',         tage: 14, gebuehr: 10, text: 'Dies ist unsere letzte Mahnung. Da die bisherigen Zahlungsaufforderungen ohne Wirkung geblieben sind, fordern wir Sie ein letztes Mal auf, den fälligen Betrag zu überweisen. Bei Nichtzahlung sind wir gezwungen, rechtliche Schritte einzuleiten.' }
};

function _mahnGetConfig() {
  try { return JSON.parse(localStorage.getItem(MAHN_KEY) || 'null') || MAHN_DEFAULTS; } catch(e) { return MAHN_DEFAULTS; }
}

function _initMahnSettings() {
  const container = document.getElementById('mahnStufen');
  if (!container) return;
  const cfg = _mahnGetConfig();
  container.innerHTML = ['stufe1','stufe2','stufe3'].map((k, i) => {
    const s = cfg[k];
    return `<div style="border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:12px;">
      <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px;">Stufe ${i+1}</div>
      <div class="field-row" style="gap:10px;margin-bottom:10px;">
        <div class="field" style="flex:2;margin:0;"><label style="font-size:11px;">Bezeichnung</label>
          <input id="mahn_${k}_bez" value="${s.bezeichnung}" placeholder="z.B. 1. Mahnung"></div>
        <div class="field" style="flex:1;margin:0;"><label style="font-size:11px;">Frist (Tage)</label>
          <input type="number" id="mahn_${k}_tage" value="${s.tage}" min="1" max="90"></div>
        <div class="field" style="flex:1;margin:0;"><label style="font-size:11px;">Mahngebühr (€)</label>
          <input type="number" id="mahn_${k}_geb" value="${s.gebuehr}" min="0" step="0.50"></div>
      </div>
      <div class="field" style="margin:0;"><label style="font-size:11px;">Mahntext</label>
        <textarea id="mahn_${k}_text" rows="3" style="font-size:12px;">${s.text}</textarea></div>
    </div>`;
  }).join('');
}

function saveMahnSettings() {
  const g = id => document.getElementById(id)?.value || '';
  const cfg = {};
  ['stufe1','stufe2','stufe3'].forEach(k => {
    cfg[k] = {
      bezeichnung: g(`mahn_${k}_bez`),
      tage:    parseInt(g(`mahn_${k}_tage`)) || 7,
      gebuehr: parseFloat(g(`mahn_${k}_geb`)) || 0,
      text:    g(`mahn_${k}_text`)
    };
  });
  localStorage.setItem(MAHN_KEY, JSON.stringify(cfg));
  const btn = event.target;
  btn.textContent = '✓ Gespeichert';
  setTimeout(() => { btn.textContent = 'Mahnungseinstellungen speichern'; }, 2000);
}

_initMahnSettings();

/* ══════════════ Externe Kalender ══════════════ */
const EXT_KAL_KEY = 'max4work_ext_kalender';

function _loadExtKal() { try { return JSON.parse(localStorage.getItem(EXT_KAL_KEY)) || []; } catch { return []; } }
function _saveExtKal(l) { localStorage.setItem(EXT_KAL_KEY, JSON.stringify(l)); }

function addExtKalender() {
  const name  = document.getElementById('extKalName').value.trim();
  const url   = document.getElementById('extKalUrl').value.trim();
  const farbe = document.getElementById('extKalFarbe').value;
  if (!name || !url) { alert('Name und URL sind erforderlich.'); return; }
  const list = _loadExtKal();
  const kal  = { id: Date.now().toString(), name, url, farbe };
  list.push(kal);
  _saveExtKal(list);
  document.getElementById('extKalName').value = '';
  document.getElementById('extKalUrl').value  = '';
  renderExtKalListe();
  syncExtKal(kal.id);
}

function delExtKalender(id) {
  if (!confirm('Abonnement entfernen und alle importierten Termine löschen?')) return;
  try {
    const t = JSON.parse(localStorage.getItem('max4work_termine') || '[]');
    localStorage.setItem('max4work_termine', JSON.stringify(t.filter(x => x.externSrc !== id)));
  } catch {}
  _saveExtKal(_loadExtKal().filter(k => k.id !== id));
  renderExtKalListe();
}

async function syncExtKal(id) {
  const list = _loadExtKal();
  const kal  = list.find(k => k.id === id);
  if (!kal) return;
  const btn = document.getElementById('extKalSyncBtn_' + id);
  const st  = document.getElementById('extKalStatus_' + id);
  if (btn) btn.disabled = true;
  if (st)  st.textContent = '⏳ Lädt…';
  try {
    const url = kal.url.replace(/^webcal:\/\//i, 'https://');
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text   = await res.text();
    const events = _extParseICS(text);
    const stored = JSON.parse(localStorage.getItem('max4work_termine') || '[]');
    const base   = stored.filter(t => t.externSrc !== id);
    const now    = Date.now();
    const imported = events.map((e, i) => ({
      id: now + i,
      titel:   e.titel || '(kein Titel)',
      datum:   e.datum,
      von:     e.von   || '',
      bis:     e.bis   || '',
      ganztag: e.ganztag || 'nein',
      kunde:   '',
      notiz:   e.notiz  || '',
      farbe:   kal.farbe,
      extern:  true,
      externSrc: id
    })).filter(e => e.datum);
    localStorage.setItem('max4work_termine', JSON.stringify([...base, ...imported]));
    kal.lastSync = new Date().toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
    kal.count    = imported.length;
    _saveExtKal(list);
    if (st) st.textContent = '✓ ' + imported.length + ' Termine · ' + kal.lastSync;
  } catch(e) {
    if (st) st.textContent = '❌ ' + e.message + ' – URL muss öffentlich zugänglich sein.';
  }
  if (btn) btn.disabled = false;
}

function syncAlleExtKal() {
  _loadExtKal().forEach(k => syncExtKal(k.id));
}

function renderExtKalListe() {
  const list = _loadExtKal();
  const el   = document.getElementById('extKalListe');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<p style="font-size:13px;color:var(--muted);margin:0;">Noch keine externen Kalender abonniert.</p>';
    return;
  }
  el.innerHTML = list.map(k => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
      <div style="width:12px;height:12px;border-radius:50%;background:${k.farbe};flex-shrink:0;"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13.5px;font-weight:500;">${k.name}</div>
        <div id="extKalStatus_${k.id}" style="font-size:11.5px;color:var(--muted);">${k.count != null ? k.count + ' Termine · ' + (k.lastSync||'') : 'Noch nicht synchronisiert'}</div>
      </div>
      <button id="extKalSyncBtn_${k.id}" onclick="syncExtKal('${k.id}')" style="background:none;border:1px solid var(--border);border-radius:8px;padding:5px 10px;font-size:13px;cursor:pointer;flex-shrink:0;" title="Aktualisieren">↻</button>
      <button onclick="delExtKalender('${k.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:20px;flex-shrink:0;line-height:1;" title="Entfernen">×</button>
    </div>
  `).join('');
}

function _extParseICS(text) {
  const lines = text.replace(/\r\n[ \t]/g,'').replace(/\r/g,'').replace(/\n[ \t]/g,'').split('\n');
  const events = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT')   { if (cur) events.push(_extMapEvent(cur)); cur = null; continue; }
    if (!cur) continue;
    const col = line.indexOf(':');
    if (col < 0) continue;
    const key = line.slice(0, col).replace(/;.*/,'').toUpperCase();
    const val = line.slice(col + 1);
    if (key === 'DTSTART' || key.startsWith('DTSTART;')) cur.start = val;
    else if (key === 'DTEND' || key.startsWith('DTEND;')) cur.end = val;
    else if (key === 'SUMMARY')     cur.summary = val.replace(/\\n/g,' ').replace(/\\,/g,',').replace(/\\\\/g,'\\');
    else if (key === 'DESCRIPTION') cur.desc    = val.replace(/\\n/g,' ').replace(/\\,/g,',').replace(/\\\\/g,'\\');
  }
  return events;
}

function _extMapEvent(e) {
  const parseDT = v => {
    if (!v) return {};
    const s = v.replace(/[TZ\-:]/g,'');
    if (s.length >= 8) {
      const datum = s.slice(0,4) + '-' + s.slice(4,6) + '-' + s.slice(6,8);
      if (s.length >= 14) return { datum, time: s.slice(8,10) + ':' + s.slice(10,12) };
      return { datum, ganztag: 'ja' };
    }
    return {};
  };
  const st = parseDT(e.start), en = parseDT(e.end);
  return { titel: e.summary || '', datum: st.datum || '', von: st.time || '', bis: en.time || '', ganztag: st.ganztag || 'nein', notiz: e.desc || '' };
}

renderExtKalListe();

/* ══ Account-Tab ══════════════════════════════════════════════════════ */

const _ACC_KEY = 'max4work_auth';
const _ACC_H0  = '6b2e00fc58183db56761c50d9bef2e13c0abcd4b3a9cd3b3f9b84be62d0ad2b2';

async function _accSha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function _getAccAuth() {
  try { return JSON.parse(localStorage.getItem(_ACC_KEY) || 'null'); } catch(e) { return null; }
}

function _loadAccountTab() {
  const auth  = _getAccAuth();
  const userEl = document.getElementById('accCurUser');
  if (userEl && auth && auth.user) userEl.value = auth.user;
  const secQEl = document.getElementById('accSecQ');
  if (secQEl && auth && auth.secQ) secQEl.value = auth.secQ;
  const statusEl = document.getElementById('accSecQStatus');
  if (statusEl) {
    statusEl.textContent = (auth && auth.secQ)
      ? '✓ Sicherheitsfrage eingerichtet'
      : 'Noch keine Sicherheitsfrage eingerichtet.';
    statusEl.style.color = (auth && auth.secQ) ? 'var(--green)' : 'var(--muted)';
  }
  const mins = parseInt(localStorage.getItem('max4work_auto_logout') || '0');
  document.querySelectorAll('.inv-chip[data-logout]').forEach(btn => {
    btn.classList.toggle('on', parseInt(btn.dataset.logout) === mins);
  });
}

function accCheckStrength() {
  const pw   = document.getElementById('accNewPw').value;
  const fill = document.getElementById('accPwFill');
  const text = document.getElementById('accPwText');
  const wrap = document.getElementById('accNewPw2Wrap');
  if (wrap) wrap.style.display = pw ? 'block' : 'none';
  if (!pw) { fill.style.width = '0%'; text.textContent = ''; return; }
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const lv = [
    { pct:'20%', color:'#EF4444', label:'Sehr schwach'  },
    { pct:'40%', color:'#F97316', label:'Schwach'       },
    { pct:'60%', color:'#EAB308', label:'Mittel'        },
    { pct:'80%', color:'#84CC16', label:'Gut'           },
    { pct:'100%',color:'#22C55E', label:'Sehr stark'    },
  ][Math.min(score, 4)];
  fill.style.width      = lv.pct;
  fill.style.background = lv.color;
  text.textContent      = lv.label;
  text.style.color      = lv.color;
}

async function accSaveCreds() {
  const hint    = document.getElementById('accCredsHint');
  const curUser = document.getElementById('accCurUser').value.trim();
  const curPw   = document.getElementById('accCurPw').value;
  const newUser = document.getElementById('accNewUser').value.trim();
  const newPw   = document.getElementById('accNewPw').value;
  const newPw2  = document.getElementById('accNewPw2').value;

  function _err(msg) { hint.textContent = msg; hint.style.color = 'var(--red)'; }
  function _ok(msg)  { hint.textContent = msg; hint.style.color = 'var(--green)'; setTimeout(() => hint.textContent = '', 4000); }

  if (!curUser || !curPw) { _err('Bitte aktuellen Benutzernamen und Passwort eingeben.'); return; }
  if (newPw && newPw !== newPw2) { _err('Neue Passwörter stimmen nicht überein.'); return; }
  if (newPw && newPw.length < 6) { _err('Neues Passwort: mindestens 6 Zeichen erforderlich.'); return; }

  const auth     = _getAccAuth();
  const expected = auth ? auth.hash : _ACC_H0;
  const curHash  = await _accSha256(curUser + ':' + curPw);
  if (curHash !== expected) { _err('Aktueller Benutzername oder Passwort falsch.'); return; }

  const finalUser = newUser || curUser;
  const finalPw   = newPw   || curPw;
  const newHash   = await _accSha256(finalUser + ':' + finalPw);
  const updated   = { ...(auth || {}), hash: newHash, user: finalUser };
  localStorage.setItem(_ACC_KEY, JSON.stringify(updated));

  document.getElementById('accCurUser').value          = finalUser;
  document.getElementById('accCurPw').value            = '';
  document.getElementById('accNewUser').value          = '';
  document.getElementById('accNewPw').value            = '';
  document.getElementById('accNewPw2').value           = '';
  document.getElementById('accPwFill').style.width     = '0%';
  document.getElementById('accPwText').textContent     = '';
  document.getElementById('accNewPw2Wrap').style.display = 'none';

  _ok('✓ Zugangsdaten gespeichert');
}

async function accSaveSecQ() {
  const q    = document.getElementById('accSecQ').value.trim();
  const a    = document.getElementById('accSecA').value.trim();
  const hint = document.getElementById('accSecHint');
  function _err(msg) { hint.textContent = msg; hint.style.color = 'var(--red)'; }
  function _ok(msg)  { hint.textContent = msg; hint.style.color = 'var(--green)'; setTimeout(() => hint.textContent = '', 3000); }

  if (!q || !a) { _err('Bitte Frage und Antwort eingeben.'); return; }
  const aHash = await _accSha256(a.toLowerCase());
  const auth  = _getAccAuth() || {};
  if (!auth.hash) auth.hash = _ACC_H0;
  auth.secQ     = q;
  auth.secAHash = aHash;
  localStorage.setItem(_ACC_KEY, JSON.stringify(auth));
  document.getElementById('accSecA').value = '';
  const statusEl = document.getElementById('accSecQStatus');
  if (statusEl) { statusEl.textContent = '✓ Sicherheitsfrage eingerichtet'; statusEl.style.color = 'var(--green)'; }
  _ok('✓ Sicherheitsfrage gespeichert');
}

function accSetAutoLogout(mins) {
  localStorage.setItem('max4work_auto_logout', String(mins));
  document.querySelectorAll('.inv-chip[data-logout]').forEach(btn => {
    btn.classList.toggle('on', parseInt(btn.dataset.logout) === mins);
  });
}

/* ═══════════════════════════════════════════════════════════════════
   BANKABGLEICH – MT940-Import + automatischer Rechnungsabgleich
   Modus jetzt: MT940-Dateiimport (manuell).
   Modus später: Server-URL aktivieren → vollautomatischer Abruf.
═══════════════════════════════════════════════════════════════════ */

function toggleBankPanel(on) {
  const panel = document.getElementById('bankAbgleichPanel');
  if (panel) panel.style.display = on ? '' : 'none';
}

function toggleDatevButtons(on) {
  ['datevBtnRechnungen', 'datevBtnBelege'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = on ? '' : 'none';
  });
}

// MT940-Parser – liest nur Kreditbuchungen (Geldeingänge)
function _parseMT940(text) {
  const txs = [];
  const parts = text.split(/(?=^:61:)/m);

  for (const part of parts) {
    if (!part.startsWith(':61:')) continue;

    const lines = part.split(/\r?\n/);
    const line61 = lines[0].replace(':61:', '');

    // YYMMDD[MMDD][C|D|RC|RD]Betrag
    const m = line61.match(/^(\d{6})(\d{4})?(C|D|RC|RD)([\d]+,\d{2})/);
    if (!m) continue;

    const isCredit = m[3] === 'C' || m[3] === 'RC';
    if (!isCredit) continue;

    const amount = parseFloat(m[4].replace(',', '.'));
    const ds = m[1];
    const date = `20${ds.slice(0,2)}-${ds.slice(2,4)}-${ds.slice(4,6)}`;

    const block = lines.slice(1).join('\n');
    const m86 = block.match(/:86:([\s\S]*?)(?=\r?\n:|$)/);
    let name = '', reference = '';

    if (m86) {
      const info = m86[1].replace(/\r?\n/g, '');
      let vz = '';
      for (let j = 20; j <= 29; j++) {
        const vM = info.match(new RegExp(`\\?${j}([^?]*)`));
        if (vM) vz += vM[1];
      }
      reference = vz.trim();
      const n32 = info.match(/\?32([^?]*)/);
      const n33 = info.match(/\?33([^?]*)/);
      name = [(n32 ? n32[1] : ''), (n33 ? n33[1] : '')].join(' ').trim();
    }

    txs.push({ date, amount, name, reference });
  }
  return txs;
}

// Abgleich: Transaktionen vs. offene Rechnungen
// Score: +1 Betrag stimmt · +3 RE-Nummer im Verwendungszweck · +1/+2 Kundenname
// Score ≥ 4 → automatisch · Score 2–3 → Vorschlag · Score 1 → kein Treffer
function _matchTransactions(txs) {
  const rechnungen = JSON.parse(localStorage.getItem('max4work_rechnungen') || '[]');
  const offene = rechnungen.filter(r => r.status === 'offen' || r.status === 'überfällig');
  const auto = [], suggest = [], unmatched = [];

  txs.forEach(tx => {
    const amtStr = tx.amount.toFixed(2);
    const ref    = (tx.reference || '').toLowerCase();
    const txName = (tx.name || '').toLowerCase();

    const byAmt = offene.filter(r => parseFloat(r.betrag || 0).toFixed(2) === amtStr);
    if (!byAmt.length) { unmatched.push(tx); return; }

    let best = null, bestScore = 0;
    byAmt.forEach(r => {
      let score = 1;
      const nr    = (r.nr || '').toLowerCase();
      const kunde = (r.kunde || '').toLowerCase();

      if (nr && ref.includes(nr)) score += 3;
      if (kunde) {
        const words = kunde.split(/\s+/).filter(w => w.length > 2);
        if (words.some(w => txName.includes(w))) score += 1;
        if (txName.includes(kunde)) score += 1;
      }
      if (score > bestScore) { bestScore = score; best = r; }
    });

    if (!best) { unmatched.push(tx); return; }
    if (bestScore >= 4)      auto.push({ re: best, tx });
    else if (bestScore >= 2) suggest.push({ re: best, tx });
    else                     unmatched.push(tx);
  });

  return { auto, suggest, unmatched };
}

// Rechnung als bezahlt markieren + Zahlung protokollieren
function _markRechnungBezahlt(reId) {
  const rechnungen = JSON.parse(localStorage.getItem('max4work_rechnungen') || '[]');
  const idx = rechnungen.findIndex(r => r.id === reId);
  if (idx === -1) return false;
  const r = rechnungen[idx];
  r.status     = 'bezahlt';
  r.bezahltAm  = new Date().toISOString().split('T')[0];
  r.zahlungsart = 'Überweisung (Bankabgleich)';
  localStorage.setItem('max4work_rechnungen', JSON.stringify(rechnungen));
  try {
    const z = JSON.parse(localStorage.getItem('max4work_zahlungen') || '[]');
    z.unshift({ id: Date.now(), _auto: true, datum: r.bezahltAm, betrag: Number(r.betrag || 0), kunde: r.kunde, rechNr: r.nr, notiz: 'Bankabgleich (MT940)' });
    localStorage.setItem('max4work_zahlungen', JSON.stringify(z));
  } catch(e) {}
  return true;
}

function _fmtB2(n) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function confirmBankMatch(reId, btnEl) {
  _markRechnungBezahlt(reId);
  const row = btnEl.closest('.bank-match-row');
  if (row) {
    row.style.background = '#f0fdf4';
    row.style.borderColor = '#bbf7d0';
    btnEl.outerHTML = '<span style="color:#166534;font-weight:600;font-size:12px;">✓ Als bezahlt markiert</span>';
  }
}

function handleMT940Import(e) {
  const file = e.target.files[0];
  if (!file) return;
  const status = document.getElementById('bankImportStatus');
  status.textContent = 'Wird verarbeitet…';
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const txs = _parseMT940(ev.target.result);
      if (!txs.length) {
        status.textContent = 'Keine Eingänge in der Datei gefunden.';
        return;
      }
      const result = _matchTransactions(txs);
      result.auto.forEach(m => _markRechnungBezahlt(m.re.id));
      _showBankResult({ ...result, total: txs.length });
      status.textContent = `${txs.length} Transaktion${txs.length !== 1 ? 'en' : ''} verarbeitet`;
    } catch(err) {
      status.textContent = 'Fehler beim Lesen der Datei.';
    }
    e.target.value = '';
  };
  reader.readAsText(file, 'ISO-8859-1');
}

function _showBankResult({ auto, suggest, unmatched, total }) {
  const el = document.getElementById('bankAbgleichResult');
  if (!el) return;
  let html = '';

  if (auto.length) {
    html += `<div style="margin-bottom:12px;">
      <div style="font-size:12px;font-weight:700;color:#166534;margin-bottom:6px;">✓ Automatisch als bezahlt markiert (${auto.length})</div>`;
    auto.forEach(m => {
      html += `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 10px;margin-bottom:4px;font-size:12.5px;">
        <strong>${m.re.nr}</strong> · ${m.re.kunde} · ${_fmtB2(m.tx.amount)}
        <span style="color:#166534;font-weight:600;margin-left:8px;">✓ bezahlt</span>
      </div>`;
    });
    html += '</div>';
  }

  if (suggest.length) {
    html += `<div style="margin-bottom:12px;">
      <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:6px;">Vorschläge – bitte prüfen (${suggest.length})</div>`;
    suggest.forEach(m => {
      html += `<div class="bank-match-row" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 10px;margin-bottom:4px;font-size:12.5px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div>
          <strong>${m.re.nr}</strong> · ${m.re.kunde} · ${_fmtB2(m.tx.amount)}<br>
          <span style="font-size:11px;color:#92400e;">Eingang von: ${m.tx.name || '—'} · ${m.tx.date}</span>
        </div>
        <button onclick="confirmBankMatch('${m.re.id}', this)" style="flex-shrink:0;padding:5px 12px;border:1px solid #d97706;border-radius:7px;background:#fff;color:#92400e;font-size:12px;cursor:pointer;font-weight:600;">Bestätigen</button>
      </div>`;
    });
    html += '</div>';
  }

  if (!auto.length && !suggest.length) {
    html += `<div style="font-size:12.5px;color:var(--muted);padding:10px 0;">Keine passenden offenen Rechnungen gefunden (${total} Transaktion${total !== 1 ? 'en' : ''} geprüft).</div>`;
  } else if (unmatched.length) {
    html += `<div style="font-size:11.5px;color:var(--muted);padding-top:8px;border-top:1px solid var(--border);">${unmatched.length} Eingang${unmatched.length !== 1 ? 'gänge' : ''} ohne Treffer (kein Betrag stimmt mit offenen Rechnungen überein).</div>`;
  }

  el.style.display = '';
  el.innerHTML = html;
}
