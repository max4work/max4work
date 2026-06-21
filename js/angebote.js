'use strict';

const ANG_KEY = 'max4work_angebote';
let _filter = 'alle';
let _editId = null;
let _positions = [];

function _load() { try { return JSON.parse(localStorage.getItem(ANG_KEY) || '[]'); } catch { return []; } }
function _save(a) { localStorage.setItem(ANG_KEY, JSON.stringify(a)); }

function fmtE(n) {
  return parseFloat(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function fmtD(v) {
  if (!v) return '—';
  const [y, m, d] = v.split('-');
  return `${d}.${m}.${y}`;
}
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

let _idSeq = 0;
function _uniqueId() { return Date.now() * 1000 + (++_idSeq % 1000); }
function todayIso() { return new Date().toISOString().split('T')[0]; }
function futureIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function _nextNr() {
  const list = _load();
  const year = new Date().getFullYear();
  const used = list.map(a => {
    const m = (a.nr || '').match(/(\d+)$/);
    return m ? parseInt(m[1]) : 0;
  });
  const next = used.length ? Math.max(...used) + 1 : 1;
  return `ANG-${year}-${String(next).padStart(3, '0')}`;
}

function _calcTotal() {
  return _positions.reduce((s, p) => {
    const qty = parseFloat(p.qty) || 0;
    const price = parseFloat(p.price) || 0;
    const vat = parseFloat(p.vat) || 0;
    return s + qty * price * (1 + vat / 100);
  }, 0);
}

function _statusClass(s) {
  return { offen: 's-offen', gesendet: 's-gesendet', angenommen: 's-angenommen', abgelehnt: 's-abgelehnt', verrechnet: 's-verrechnet' }[s] || 's-offen';
}
function _statusLabel(s) {
  return { offen: 'Offen', gesendet: 'Gesendet', angenommen: 'Angenommen', abgelehnt: 'Abgelehnt', verrechnet: 'Verrechnet' }[s] || s;
}

function setFilter(el) {
  document.querySelectorAll('.ftab').forEach(t => t.classList.remove('on'));
  el.classList.add('on');
  _filter = el.dataset.f;
  render();
}

function render() {
  const all = _load();
  const q = (document.getElementById('searchInput').value || '').toLowerCase();

  let list = all.filter(a => {
    if (_filter !== 'alle' && a.status !== _filter) return false;
    if (q && !`${a.nr} ${a.kunde} ${a.betreff}`.toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));

  // Stats
  document.getElementById('statGesamt').textContent = all.length;
  document.getElementById('statOffen').textContent = all.filter(a => a.status === 'offen' || a.status === 'gesendet').length;
  document.getElementById('statAngenommen').textContent = all.filter(a => a.status === 'angenommen').length;
  document.getElementById('statVolumen').textContent = fmtE(all.reduce((s, a) => s + (parseFloat(a.betrag) || 0), 0));

  const body = document.getElementById('listBody');
  if (!list.length) {
    body.innerHTML = `<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">Keine Angebote gefunden</div></div>`;
    return;
  }

  const today = todayIso();
  body.innerHTML = list.map(a => {
    const abgelaufen = a.gueltig && a.gueltig < today && a.status === 'offen';
    return `<div class="ang-row" onclick="openModal(${JSON.stringify(a.id)})">
      <div class="ang-nr">${esc(a.nr)}</div>
      <div>
        <div class="ang-kunde">${esc(a.kunde)}</div>
        ${a.betreff ? `<div class="ang-sub">${esc(a.betreff)}</div>` : ''}
      </div>
      <div class="ang-cell">${fmtD(a.datum)}</div>
      <div class="ang-cell ${abgelaufen ? 'muted' : ''}">${fmtD(a.gueltig)}${abgelaufen ? ' ⚠' : ''}</div>
      <div class="ang-cell r">${fmtE(a.betrag)}</div>
      <div class="ang-actions" onclick="event.stopPropagation()">
        <span class="status-badge ${_statusClass(a.status)}">${_statusLabel(a.status)}</span>
        <button class="icon-btn" title="Löschen" onclick="deleteAngebot(${JSON.stringify(a.id)})">✕</button>
      </div>
    </div>`;
  }).join('');
}

function openModal(id) {
  _editId = id || null;
  _positions = [];

  if (id) {
    const a = _load().find(x => x.id === id);
    if (!a) return;
    document.getElementById('modalTitle').textContent = 'Angebot bearbeiten';
    document.getElementById('fNr').value = a.nr || '';
    document.getElementById('fDatum').value = a.datum || '';
    document.getElementById('fGueltig').value = a.gueltig || '';
    document.getElementById('fStatus').value = a.status || 'offen';
    document.getElementById('fKunde').value = a.kunde || '';
    document.getElementById('fEmail').value = a.email || '';
    document.getElementById('fBetreff').value = a.betreff || '';
    document.getElementById('fNotiz').value = a.notiz || '';
    _positions = (a.positions || []).map(p => ({...p}));
    document.getElementById('btnZuRechnung').style.display = '';
  } else {
    document.getElementById('modalTitle').textContent = 'Neues Angebot';
    document.getElementById('fNr').value = _nextNr();
    document.getElementById('fDatum').value = todayIso();
    document.getElementById('fGueltig').value = futureIso(30);
    document.getElementById('fStatus').value = 'offen';
    document.getElementById('fKunde').value = '';
    document.getElementById('fEmail').value = '';
    document.getElementById('fBetreff').value = '';
    document.getElementById('fNotiz').value = '';
    document.getElementById('btnZuRechnung').style.display = 'none';
    _positions = [{ desc: '', qty: '1', unit: 'Std.', price: '', vat: '19' }];
  }

  _fillKundenList();
  renderPos();
  document.getElementById('overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('overlay').classList.remove('open');
  _editId = null;
}

function overlayBg(e) { if (e.target === document.getElementById('overlay')) closeModal(); }

function _fillKundenList() {
  try {
    const kunden = JSON.parse(localStorage.getItem('max4work_kunden') || '[]');
    const dl = document.getElementById('kundenListeAng');
    dl.innerHTML = kunden.map(k => `<option value="${esc(k.name)}">`).join('');
  } catch(e) {}
}

function addPos() {
  _positions.push({ desc: '', qty: '1', unit: 'Std.', price: '', vat: '19' });
  renderPos();
  const rows = document.querySelectorAll('#posBody tr');
  if (rows.length) rows[rows.length - 1].querySelector('input')?.focus();
}

function renderPos() {
  const tbody = document.getElementById('posBody');
  tbody.innerHTML = _positions.map((p, i) => `
    <tr>
      <td><input type="text" value="${esc(p.desc)}" placeholder="Leistung / Artikel" oninput="_positions[${i}].desc=this.value"></td>
      <td><input type="number" value="${esc(p.qty)}" min="0" step="any" oninput="_positions[${i}].qty=this.value;_updSum()"></td>
      <td><input type="text" value="${esc(p.unit)}" placeholder="Std." style="max-width:60px" oninput="_positions[${i}].unit=this.value"></td>
      <td><input type="number" value="${esc(p.price)}" min="0" step="0.01" placeholder="0,00" oninput="_positions[${i}].price=this.value;_updSum()"></td>
      <td>
        <select oninput="_positions[${i}].vat=this.value;_updSum()">
          <option value="0" ${p.vat==='0'?'selected':''}>0%</option>
          <option value="7" ${p.vat==='7'?'selected':''}>7%</option>
          <option value="19" ${p.vat==='19'||!p.vat?'selected':''}>19%</option>
        </select>
      </td>
      <td><button class="pos-del" onclick="_positions.splice(${i},1);renderPos()">✕</button></td>
    </tr>`).join('');
  _updSum();
}

function _updSum() {
  document.getElementById('posSumLine').innerHTML = `Gesamt (brutto): <strong>${fmtE(_calcTotal())}</strong>`;
}

function saveAngebot() {
  const nr = document.getElementById('fNr').value.trim();
  const kunde = document.getElementById('fKunde').value.trim();
  if (!nr || !kunde) { alert('Bitte Angebotsnummer und Kunde angeben.'); return; }

  const list = _load();
  const total = _calcTotal();
  const entry = {
    id: _editId || _uniqueId(),
    nr,
    datum: document.getElementById('fDatum').value || todayIso(),
    gueltig: document.getElementById('fGueltig').value || '',
    status: document.getElementById('fStatus').value || 'offen',
    kunde,
    email: document.getElementById('fEmail').value.trim(),
    betreff: document.getElementById('fBetreff').value.trim(),
    notiz: document.getElementById('fNotiz').value.trim(),
    betrag: total,
    positions: _positions.filter(p => p.desc || p.price)
  };

  if (_editId) {
    const idx = list.findIndex(a => a.id === _editId);
    if (idx >= 0) list[idx] = entry; else list.push(entry);
  } else {
    list.push(entry);
  }
  _save(list);
  closeModal();
  render();
}

function deleteAngebot(id) {
  if (!confirm('Angebot wirklich löschen?')) return;
  _save(_load().filter(a => a.id !== id));
  render();
}

function zuRechnung() {
  if (!_editId) return;
  const a = _load().find(x => x.id === _editId);
  if (!a) return;

  // Rechnungsdaten aus Angebot übernehmen und als URL-Params übergeben
  const params = new URLSearchParams({
    ang_id: a.id,
    ang_nr: a.nr,
    ang_kunde: a.kunde,
    ang_email: a.email || '',
    ang_betrag: a.betrag,
    ang_positions: JSON.stringify(a.positions || [])
  });

  // Status auf "verrechnet" setzen
  const list = _load();
  const idx = list.findIndex(x => x.id === _editId);
  if (idx >= 0) {
    list[idx].status = 'verrechnet';
    _save(list);
  }
  closeModal();
  render();
  window.location.href = `rechnungen.html?${params.toString()}`;
}

document.addEventListener('DOMContentLoaded', render);
