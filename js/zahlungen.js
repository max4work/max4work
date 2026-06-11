(function () {
  'use strict';

  const Z_KEY = 'max4work_zahlungen';
  let _filter = 'alle';
  let _editId = null;

  function load() { return JSON.parse(localStorage.getItem(Z_KEY) || '[]'); }
  function save(arr) { localStorage.setItem(Z_KEY, JSON.stringify(arr)); }

  function fmt(n) {
    return Number(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
  function fmtDate(s) {
    if (!s) return '–';
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y}`;
  }
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function filterData(all) {
    const now = new Date();
    const q = (document.getElementById('searchInput')?.value || '').toLowerCase();
    return all.filter(z => {
      if (_filter === 'monat') {
        const [y, m] = (z.datum || '').split('-');
        if (parseInt(y) !== now.getFullYear() || parseInt(m) - 1 !== now.getMonth()) return false;
      }
      if (_filter === 'quartal') {
        const [y, m] = (z.datum || '').split('-');
        const qCur = Math.floor(now.getMonth() / 3);
        const qZ   = Math.floor((parseInt(m) - 1) / 3);
        if (parseInt(y) !== now.getFullYear() || qZ !== qCur) return false;
      }
      if (q) {
        const haystack = [z.kunde, z.rechNr, z.notiz, z.datum].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  function renderStats(visible) {
    const total = visible.reduce((s, z) => s + Number(z.betrag || 0), 0);
    const count = visible.length;
    const auto  = visible.filter(z => z._auto).length;
    const row   = document.getElementById('statsRow');
    if (!row) return;
    row.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Gesamt</div>
        <div class="stat-value green">${fmt(total)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Einträge</div>
        <div class="stat-value">${count}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Von Rechnungen</div>
        <div class="stat-value">${auto}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Manuell</div>
        <div class="stat-value">${count - auto}</div>
      </div>`;
  }

  function render() {
    const all     = load();
    const visible = filterData(all).sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));
    renderStats(visible);

    const panel = document.getElementById('listPanel');
    const empty = document.getElementById('emptyMsg');
    if (!panel) return;

    if (!visible.length) {
      panel.innerHTML = '<div class="panel-empty">Keine Zahlungen für diesen Zeitraum.</div>';
      return;
    }

    const rows = visible.map(z => `
      <tr>
        <td>${fmtDate(z.datum)}</td>
        <td>${esc(z.rechNr || '–')}</td>
        <td>${esc(z.kunde || '–')}</td>
        <td style="font-weight:600;font-variant-numeric:tabular-nums">${fmt(z.betrag)}</td>
        <td>${esc(z.notiz || '–')}</td>
        <td><span class="badge ${z._auto ? 'badge-auto' : 'badge-manu'}">${z._auto ? 'RE' : 'Manuell'}</span></td>
        <td>
          ${!z._auto ? `<button class="del-btn" onclick="deleteZahlung(${z.id})" title="Löschen">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>` : ''}
        </td>
      </tr>`).join('');

    panel.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Datum</th>
            <th>RE-Nr.</th>
            <th>Kunde</th>
            <th>Betrag</th>
            <th>Zahlungsart</th>
            <th>Typ</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function setFilter(el) {
    _filter = el.dataset.filter;
    document.querySelectorAll('.ftab').forEach(t => t.classList.remove('on'));
    el.classList.add('on');
    render();
  }
  window.setFilter = setFilter;

  function openModal(id) {
    _editId = id || null;
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('fDatum').value   = today;
    document.getElementById('fBetrag').value  = '';
    document.getElementById('fKunde').value   = '';
    document.getElementById('fRechNr').value  = '';
    document.getElementById('fNotiz').value   = '';
    document.getElementById('modalTitle').textContent = 'Zahlung erfassen';
    document.getElementById('overlay').classList.add('open');
    document.getElementById('fBetrag').focus();
  }
  window.openModal = openModal;

  function closeModal() {
    document.getElementById('overlay').classList.remove('open');
    _editId = null;
  }
  window.closeModal = closeModal;

  function overlayClick(e) {
    if (e.target === document.getElementById('overlay')) closeModal();
  }
  window.overlayClick = overlayClick;

  function saveZahlung() {
    const datum  = document.getElementById('fDatum').value;
    const betrag = parseFloat(document.getElementById('fBetrag').value);
    if (!datum || isNaN(betrag) || betrag <= 0) {
      document.getElementById('fBetrag').focus();
      return;
    }
    const all = load();
    const entry = {
      id:     _editId || Date.now(),
      _auto:  false,
      datum,
      betrag,
      kunde:  document.getElementById('fKunde').value.trim(),
      rechNr: document.getElementById('fRechNr').value.trim(),
      notiz:  document.getElementById('fNotiz').value,
    };
    const idx = _editId ? all.findIndex(z => z.id === _editId) : -1;
    if (idx >= 0) all[idx] = entry; else all.unshift(entry);
    save(all);
    closeModal();
    render();
  }
  window.saveZahlung = saveZahlung;

  function deleteZahlung(id) {
    if (!confirm('Zahlung löschen?')) return;
    const all = load().filter(z => z.id !== id);
    save(all);
    render();
  }
  window.deleteZahlung = deleteZahlung;

  function exportCSV() {
    const all     = load();
    const visible = filterData(all).sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));
    if (!visible.length) { alert('Keine Daten zum Exportieren.'); return; }
    const hdr  = ['Datum', 'RE-Nr.', 'Kunde', 'Betrag (EUR)', 'Zahlungsart', 'Typ'];
    const rows = visible.map(z => [
      z.datum || '', z.rechNr || '', z.kunde || '',
      Number(z.betrag || 0).toFixed(2).replace('.', ','),
      z.notiz || '', z._auto ? 'Rechnung' : 'Manuell',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
    const csv  = [hdr.join(';'), ...rows].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `max4work_Zahlungen_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  window.exportCSV = exportCSV;

  render();
})();
