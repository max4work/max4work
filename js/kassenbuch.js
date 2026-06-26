'use strict';

const KB_KEY   = 'max4work_kassenbuch';
const KB_START = 'max4work_kassenbuch_anfangsbestand';

let _filter = 'alle';
let _editId = null;

function _load()  { try { return JSON.parse(localStorage.getItem(KB_KEY)   || '[]'); } catch { return []; } }
function _save(a) { localStorage.setItem(KB_KEY, JSON.stringify(a)); }
function _anfang(){ return parseFloat(localStorage.getItem(KB_START) || '0'); }

function fmtE(n) {
  return parseFloat(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function fmtD(v) {
  if (!v) return '—';
  const [y, m, d] = v.split('-');
  return `${d}.${m}.${y}`;
}
function todayIso() { return new Date().toISOString().split('T')[0]; }

// Laufender Saldo aller Einträge berechnen
function _saldoMap(entries) {
  const sorted = [...entries].sort((a, b) => (a.datum||'').localeCompare(b.datum||'') || a.id - b.id);
  const map = {};
  let s = _anfang();
  sorted.forEach(e => {
    s += e.art === 'einnahme' ? +e.betrag : -e.betrag;
    map[e.id] = s;
  });
  return map;
}

function load() {
  renderStats();
  renderList();
}

function renderStats() {
  const entries = _load();
  const today = todayIso();

  const saldo = _saldoMap(entries);
  const ids = Object.keys(saldo);
  const stand = ids.length ? saldo[ids[ids.length - 1]] : _anfang();

  // Für einen korrekten Kassenstand nehmen wir den letzten Saldo-Wert
  const sorted = [...entries].sort((a, b) => (a.datum||'').localeCompare(b.datum||'') || a.id - b.id);
  const standAktuell = sorted.length ? saldo[sorted[sorted.length - 1].id] : _anfang();

  const todayEin = entries.filter(e => e.datum === today && e.art === 'einnahme').reduce((s, e) => s + +e.betrag, 0);
  const todayAus = entries.filter(e => e.datum === today && e.art === 'ausgabe').reduce((s, e) => s + +e.betrag, 0);

  const el = document.getElementById('kpiStand');
  if (el) {
    el.textContent = fmtE(standAktuell);
    el.className = 'stat-value ' + (standAktuell >= 0 ? 'clr-green' : 'clr-red');
  }
  const elE = document.getElementById('kpiEin'); if (elE) elE.textContent = fmtE(todayEin);
  const elA = document.getElementById('kpiAus'); if (elA) elA.textContent = fmtE(todayAus);
  const elC = document.getElementById('kpiCount'); if (elC) elC.textContent = entries.length;
}

function renderList() {
  const all    = _load();
  const today  = todayIso();
  const week   = new Date(); week.setDate(week.getDate() - 6);
  const weekStr = week.toISOString().split('T')[0];
  const month  = today.slice(0, 7);

  let filtered = all;
  if (_filter === 'einnahmen') filtered = all.filter(e => e.art === 'einnahme');
  else if (_filter === 'ausgaben') filtered = all.filter(e => e.art === 'ausgabe');
  else if (_filter === 'heute')   filtered = all.filter(e => e.datum === today);
  else if (_filter === 'woche')   filtered = all.filter(e => (e.datum||'') >= weekStr);
  else if (_filter === 'monat')   filtered = all.filter(e => (e.datum||'').startsWith(month));

  filtered = [...filtered].sort((a, b) => (b.datum||'').localeCompare(a.datum||'') || b.id - a.id);

  const saldo = _saldoMap(all);
  const tbody = document.getElementById('kbBody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="td-empty">Keine Buchungen vorhanden.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(e => {
    const isEin = e.art === 'einnahme';
    const s = saldo[e.id];
    return `<tr>
      <td class="td-muted">${fmtD(e.datum)}</td>
      <td><span class="art-badge ${isEin ? 'art-ein' : 'art-aus'}">${isEin ? 'Einnahme' : 'Ausgabe'}</span></td>
      <td>${e.kategorie || '—'}</td>
      <td class="td-notiz">${e.notiz || '—'}</td>
      <td class="td-num ${isEin ? 'clr-green' : 'clr-red'}">${isEin ? '+' : '−'}&nbsp;${fmtE(e.betrag)}</td>
      <td class="td-num ${s >= 0 ? '' : 'clr-red'}" style="font-weight:700">${fmtE(s)}</td>
      <td class="td-act">
        <button class="btn-icon" onclick="openModal(${e.id})" title="Bearbeiten">✎</button>
        <button class="btn-icon btn-icon-del" onclick="del(${e.id})" title="Löschen">&times;</button>
      </td>
    </tr>`;
  }).join('');
}

function setFilter(f) {
  _filter = f;
  document.querySelectorAll('.ftab').forEach(t => t.classList.toggle('on', t.dataset.f === f));
  renderList();
}

function openModal(id) {
  _editId = id || null;
  const e = id ? _load().find(x => x.id === id) : null;

  document.getElementById('mTitle').textContent = e ? 'Buchung bearbeiten' : 'Neue Buchung';
  document.getElementById('mDatum').value   = e ? e.datum   : todayIso();
  document.getElementById('mArt').value     = e ? e.art     : 'einnahme';
  document.getElementById('mBetrag').value  = e ? String(e.betrag).replace('.', ',') : '';
  document.getElementById('mNotiz').value   = e ? (e.notiz || '') : '';
  _updateKatOptions(e ? e.kategorie : '');
  document.getElementById('overlay').classList.add('open');
  setTimeout(() => document.getElementById('mBetrag').focus(), 60);
}

function closeModal() {
  document.getElementById('overlay').classList.remove('open');
  _editId = null;
}

function _updateKatOptions(selected) {
  const art  = document.getElementById('mArt').value;
  const kats = art === 'einnahme'
    ? ['Bareinnahme', 'Trinkgeld', 'Privateinlage', 'Sonstiges']
    : ['Material', 'Werkzeug', 'Büro', 'Porto', 'Bewirtung', 'Privatentnahme', 'Sonstiges'];
  const sel  = document.getElementById('mKat');
  sel.innerHTML = kats.map(k => `<option value="${k}"${k === selected ? ' selected' : ''}>${k}</option>`).join('');
}

function save() {
  const datum    = document.getElementById('mDatum').value;
  const art      = document.getElementById('mArt').value;
  const betrag   = parseFloat(document.getElementById('mBetrag').value.replace(',', '.'));
  const notiz    = document.getElementById('mNotiz').value.trim();
  const kategorie = document.getElementById('mKat').value;

  if (!datum)               return alert('Bitte Datum eingeben.');
  if (isNaN(betrag) || betrag <= 0) return alert('Bitte gültigen Betrag eingeben.');

  const entries = _load();
  if (_editId) {
    const idx = entries.findIndex(e => e.id === _editId);
    if (idx >= 0) entries[idx] = { ...entries[idx], datum, art, betrag, notiz, kategorie };
  } else {
    entries.push({ id: Date.now(), datum, art, betrag, notiz, kategorie });
  }
  _save(entries);
  closeModal();
  renderStats();
  renderList();
}

function del(id) {
  if (!confirm('Buchung löschen?')) return;
  _save(_load().filter(e => e.id !== id));
  renderStats();
  renderList();
}

function editAnfangsbestand() {
  const cur = _anfang();
  const raw = prompt('Anfangsbestand (Bargeld in der Kasse zu Beginn):', cur.toFixed(2).replace('.', ','));
  if (raw === null) return;
  const n = parseFloat(raw.replace(',', '.'));
  if (isNaN(n)) return alert('Ungültiger Betrag.');
  localStorage.setItem(KB_START, n.toString());
  renderStats();
  renderList();
}

function openAbschluss() {
  const entries = _load();
  const today   = todayIso();
  const todayE  = entries.filter(e => e.datum === today).sort((a, b) => a.id - b.id);
  const saldo   = _saldoMap(entries);

  // Kassenstand vor heute
  const sortedAll = [...entries].sort((a, b) => (a.datum||'').localeCompare(b.datum||'') || a.id - b.id);
  let standVor = _anfang();
  sortedAll.filter(e => e.datum < today).forEach(e => {
    standVor += e.art === 'einnahme' ? +e.betrag : -e.betrag;
  });

  const todayEin = todayE.filter(e => e.art === 'einnahme').reduce((s, e) => s + +e.betrag, 0);
  const todayAus = todayE.filter(e => e.art === 'ausgabe').reduce((s, e) => s + +e.betrag, 0);
  const standNach = standVor + todayEin - todayAus;

  document.getElementById('abschlussContent').innerHTML = `
    <div class="abs-row"><span>Kassenbestand Beginn (${fmtD(today)})</span><span>${fmtE(standVor)}</span></div>
    <div class="abs-row"><span style="color:#1A7A3C">+ Einnahmen heute</span><span class="clr-green" style="font-weight:700">+ ${fmtE(todayEin)}</span></div>
    <div class="abs-row"><span style="color:#991B1B">− Ausgaben heute</span><span class="clr-red" style="font-weight:700">− ${fmtE(todayAus)}</span></div>
    <div class="abs-row abs-total"><span>Kassenbestand Ende (${fmtD(today)})</span><span class="${standNach >= 0 ? 'clr-green' : 'clr-red'}" style="font-size:17px;font-weight:700">${fmtE(standNach)}</span></div>
    <div class="abs-buchungen-titel">Buchungen heute (${todayE.length})</div>
    ${todayE.length === 0
      ? '<div class="abs-leer">Keine Buchungen heute.</div>'
      : todayE.map(e => `
        <div class="abs-buchung">
          <span class="abs-bkat">${e.kategorie || '—'}</span>
          <span class="abs-bnotiz">${e.notiz || ''}</span>
          <span class="${e.art === 'einnahme' ? 'clr-green' : 'clr-red'}" style="font-weight:600;flex-shrink:0">
            ${e.art === 'einnahme' ? '+' : '−'} ${fmtE(e.betrag)}
          </span>
        </div>`).join('')}
  `;
  document.getElementById('abschlussOverlay').classList.add('open');
}

function closeAbschluss() {
  document.getElementById('abschlussOverlay').classList.remove('open');
}

function exportCSV() {
  const all    = _load();
  const today  = todayIso();
  const week   = new Date(); week.setDate(week.getDate() - 6);
  const weekStr = week.toISOString().split('T')[0];
  const month  = today.slice(0, 7);

  let filtered = all;
  if (_filter === 'einnahmen') filtered = all.filter(e => e.art === 'einnahme');
  else if (_filter === 'ausgaben') filtered = all.filter(e => e.art === 'ausgabe');
  else if (_filter === 'heute')   filtered = all.filter(e => e.datum === today);
  else if (_filter === 'woche')   filtered = all.filter(e => (e.datum||'') >= weekStr);
  else if (_filter === 'monat')   filtered = all.filter(e => (e.datum||'').startsWith(month));

  filtered = [...filtered].sort((a, b) => (a.datum||'').localeCompare(b.datum||'') || a.id - b.id);
  if (!filtered.length) { alert('Keine Buchungen zum Exportieren.'); return; }

  const saldo = _saldoMap(all);
  const hdr   = ['Datum', 'Art', 'Kategorie', 'Notiz', 'Betrag (EUR)', 'Saldo (EUR)'];
  const rows  = filtered.map(e => [
    fmtD(e.datum),
    e.art === 'einnahme' ? 'Einnahme' : 'Ausgabe',
    e.kategorie || '',
    e.notiz || '',
    (e.art === 'einnahme' ? '' : '-') + parseFloat(e.betrag || 0).toFixed(2).replace('.', ','),
    parseFloat(saldo[e.id] || 0).toFixed(2).replace('.', ','),
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));

  const csv  = [hdr.join(';'), ...rows].join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `Kassenbuch_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
