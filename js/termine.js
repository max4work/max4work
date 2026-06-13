const WOCHENTAGE  = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const MONATE_LANG = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const COLORS = [
  {hex:'#C8D93A',name:'Lime'},{hex:'#2B3829',name:'Dunkelgrün'},{hex:'#34C759',name:'Grün'},
  {hex:'#0066FF',name:'Blau'},{hex:'#5AC8FA',name:'Hellblau'},{hex:'#AF52DE',name:'Lila'},
  {hex:'#FF9500',name:'Orange'},{hex:'#FF3B30',name:'Rot'},{hex:'#FF6B6B',name:'Rosa'},
  {hex:'#FF2D55',name:'Pink'},{hex:'#FFD60A',name:'Gelb'},{hex:'#1C1C1E',name:'Schwarz'},
];
const STORAGE_KEY = 'max4work_termine';

function isoWeek(d) {
  const t = new Date(d); t.setHours(0,0,0,0);
  t.setDate(t.getDate() + 3 - (t.getDay() + 6) % 7);
  const w1 = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
}

const today = new Date(); today.setHours(0,0,0,0);
let viewYear = today.getFullYear(), viewMonth = today.getMonth();
let selectedDate = dateStr(today);
let termine = loadTermine(), editId = null, selectedColor = COLORS[0].hex;

function loadTermine() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveStorage() { localStorage.setItem(STORAGE_KEY, JSON.stringify(termine)); }
function dateStr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function parseDate(s) { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtDatum(s) { const d=parseDate(s); return `${WOCHENTAGE[d.getDay()]}, ${d.getDate()}. ${MONATE_LANG[d.getMonth()]} ${d.getFullYear()}`; }
function termineForDay(d) { return termine.filter(t=>t.datum===d).sort((a,b)=>(a.von||'00:00').localeCompare(b.von||'00:00')); }

function renderCalendar() {
  document.getElementById('monthTitle').textContent = `${MONATE_LANG[viewMonth]} ${viewYear}`;
  const grid = document.getElementById('daysGrid'); grid.innerHTML = '';
  const first = new Date(viewYear,viewMonth,1), last = new Date(viewYear,viewMonth+1,0);
  const startDow = (first.getDay() + 6) % 7; // 0=Mo … 6=So
  const days = [];
  for(let i=0;i<startDow;i++) days.push({d: new Date(viewYear,viewMonth,-startDow+i+1), other:true});
  for(let day=1;day<=last.getDate();day++) days.push({d: new Date(viewYear,viewMonth,day), other:false});
  const rest = (startDow+last.getDate())%7===0?0:7-((startDow+last.getDate())%7);
  for(let i=1;i<=rest;i++) days.push({d: new Date(viewYear,viewMonth+1,i), other:true});
  const totalWeeks = Math.ceil(days.length / 7);
  days.forEach(({d,other},i) => {
    const notLastWeek = Math.floor(i/7) < totalWeeks - 1;
    if(i%7===0) {
      const kw=document.createElement('div'); kw.className=notLastWeek?'kw-cell week-end':'kw-cell'; kw.textContent=isoWeek(d); grid.appendChild(kw);
    }
    addDayCell(grid, d, other, notLastWeek);
  });
  renderMiniList(); renderDayView();
}
function addDayCell(grid,d,otherMonth,weekEnd=false) {
  const ds=dateStr(d), isToday=ds===dateStr(today), isSelected=ds===selectedDate, isSun=d.getDay()===0, hasEvt=termine.some(t=>t.datum===ds);
  const cell=document.createElement('div');
  cell.className=['day-cell',otherMonth?'other-month':'',isToday?'today':'',isSelected&&!isToday?'selected':'',isSun?'sunday':'',hasEvt?'has-events':'',weekEnd?'week-end':''].filter(Boolean).join(' ');
  const nr=document.createElement('div'); nr.className='day-nr'; nr.textContent=d.getDate();
  cell.appendChild(nr); cell.onclick=()=>selectDay(ds); grid.appendChild(cell);
}
function renderMiniList() {
  const d=parseDate(selectedDate), isToday=selectedDate===dateStr(today);
  document.getElementById('miniHead').textContent = isToday?'Heute':`${d.getDate()}. ${MONATE_LANG[d.getMonth()]}`;
  const list=document.getElementById('miniList'), evts=termineForDay(selectedDate);
  if(!evts.length){list.innerHTML='<div class="mini-empty">Keine Termine</div>';return;}
  list.innerHTML=evts.map(t=>`<div class="mini-event" onclick="openDetail(${t.id})"><div class="mini-event-dot" style="background:${t.farbe}"></div><div class="mini-event-title">${esc(t.titel)}</div><div class="mini-event-time">${t.ganztag==='ja'?'Ganztag':(t.von||'')}</div></div>`).join('');
}
function renderDayView() {
  const d=parseDate(selectedDate), isToday=selectedDate===dateStr(today);
  document.getElementById('dayHeaderDate').innerHTML=`${d.getDate()}. ${MONATE_LANG[d.getMonth()]} <strong>${d.getFullYear()}</strong>`;
  document.getElementById('dayHeaderWeekday').textContent=WOCHENTAGE[d.getDay()];
  const grid=document.getElementById('timeGrid'), evts=termineForDay(selectedDate);
  const allDay=evts.filter(t=>t.ganztag==='ja'), timed=evts.filter(t=>t.ganztag!=='ja');
  let html='';
  if(allDay.length>0){
    html+=`<div style="padding:8px 28px;border-bottom:1px solid var(--border);display:flex;flex-wrap:wrap;gap:6px;">`;
    allDay.forEach(t=>{html+=`<div class="event-block" onclick="openDetail(${t.id})" style="background:${t.farbe}18;border-left:3px solid ${t.farbe};padding:6px 10px;border-radius:6px;flex-shrink:0;"><div class="event-block-title" style="color:${t.farbe};">${esc(t.titel)}</div><div class="event-block-sub" style="color:${t.farbe};">Ganztägig</div></div>`;});
    html+=`</div>`;
  }
  const nowH=new Date().getHours(), nowMin=new Date().getMinutes();
  for(let h=0;h<24;h++){
    const slotEvts=timed.filter(t=>{if(!t.von)return false;const[eh]=t.von.split(':').map(Number);return eh===h;});
    const showNow=isToday&&h===nowH, nowPct=Math.round(nowMin/60*56);
    html+=`<div class="time-slot"><div class="time-label">${h===0?'':String(h).padStart(2,'0')+':00'}</div><div class="time-content" style="position:relative;">`;
    if(showNow)html+=`<div class="time-now-dot" style="top:${nowPct}px;"></div><div class="time-now-line" style="top:${nowPct+4}px;left:0;right:0;position:absolute;"></div>`;
    slotEvts.forEach(t=>{
      const duration=t.bis?(()=>{const[bh,bm]=t.bis.split(':').map(Number),[vh,vm]=t.von.split(':').map(Number);return Math.max(30,(bh*60+bm)-(vh*60+vm));})():60;
      const ht=Math.round(duration/60*52);
      html+=`<div class="event-block" onclick="openDetail(${t.id})" style="background:${t.farbe}18;border-left:3px solid ${t.farbe};min-height:${ht}px;"><div class="event-block-title" style="color:${t.farbe};">${esc(t.titel)}</div><div class="event-block-sub" style="color:${t.farbe};">${t.von}${t.bis?' – '+t.bis:''} · ${esc(t.kunde||'')}</div></div>`;
    });
    html+=`</div></div>`;
  }
  grid.innerHTML=html;
  if(isToday) setTimeout(()=>grid.scrollTop=Math.max(0,(nowH-1)*56),0);
  else {const f=timed[0];if(f?.von){const[fh]=f.von.split(':').map(Number);grid.scrollTop=Math.max(0,(fh-1)*56);}else grid.scrollTop=8*56;}
}
function selectDay(ds){selectedDate=ds;const d=parseDate(ds);if(d.getMonth()!==viewMonth||d.getFullYear()!==viewYear){viewMonth=d.getMonth();viewYear=d.getFullYear();}renderCalendar();}
function prevMonth(){viewMonth--;if(viewMonth<0){viewMonth=11;viewYear--;}renderCalendar();}
function nextMonth(){viewMonth++;if(viewMonth>11){viewMonth=0;viewYear++;}renderCalendar();}
function goToday(){selectedDate=dateStr(today);viewMonth=today.getMonth();viewYear=today.getFullYear();renderCalendar();}
function buildColorPicker() {
  const isCustom = !COLORS.find(c => c.hex === selectedColor);
  document.getElementById('colorPicker').innerHTML =
    COLORS.map(c => `<div class="cp-dot${c.hex===selectedColor?' on':''}" style="background:${c.hex};" title="${c.name}" onclick="selectColor('${c.hex}')"></div>`).join('') +
    `<div class="cp-custom${isCustom?' on':''}" title="Eigene Farbe wählen">
       <input type="color" value="${isCustom?selectedColor:'#888888'}" oninput="selectColor(this.value)" onchange="selectColor(this.value)">
     </div>`;
}
function selectColor(hex){selectedColor=hex;buildColorPicker();}
function openModal(id=null){
  editId=id;const t=id?termine.find(x=>x.id===id):null;
  document.getElementById('detail-view').style.display='none';
  document.getElementById('edit-view').style.display='block';
  document.getElementById('modal-title').textContent=id?'Termin bearbeiten':'Neuer Termin';
  document.getElementById('f-titel').value=t?.titel||'';
  document.getElementById('f-datum').value=t?.datum||selectedDate;
  document.getElementById('f-von').value=t?.von||'08:00';
  document.getElementById('f-bis').value=t?.bis||'09:00';
  document.getElementById('f-kunde').value=t?.kunde||'';
  document.getElementById('f-notiz').value=t?.notiz||'';
  document.getElementById('f-ganztag').value=t?.ganztag||'nein';
  selectedColor=t?.farbe||COLORS[0].hex;
  toggleTime(); buildColorPicker();
  const delBtn=document.getElementById('btn-delete-edit');
  if(id){delBtn.style.visibility='visible';delBtn.onclick=()=>deleteTermin(id);}
  else delBtn.style.visibility='hidden';
  document.getElementById('overlay').classList.add('open');
  setTimeout(()=>document.getElementById('f-titel').focus(),80);
}
function openDetail(id){
  const t=termine.find(x=>x.id===id);if(!t)return;
  document.getElementById('detail-view').style.display='block';
  document.getElementById('edit-view').style.display='none';
  document.getElementById('modal-title').textContent=t.titel;
  document.getElementById('detail-content').innerHTML=`<div style="display:flex;flex-direction:column;gap:0;margin-bottom:8px;"><div class="detail-row"><div class="detail-icon">◷</div><div class="detail-val">${fmtDatum(t.datum)}${t.ganztag==='ja'?' · Ganztägig':(t.von?` · ${t.von}${t.bis?' – '+t.bis:''}`:'' )}</div></div>${t.kunde?`<div class="detail-row"><div class="detail-icon">○</div><div class="detail-val">${esc(t.kunde)}</div></div>`:''} ${t.notiz?`<div class="detail-row"><div class="detail-icon">◳</div><div class="detail-val">${esc(t.notiz)}</div></div>`:''}<div class="detail-row"><div class="detail-icon">◉</div><div class="detail-val" style="display:flex;align-items:center;gap:6px;"><span style="width:12px;height:12px;border-radius:50%;background:${t.farbe};display:inline-block;flex-shrink:0;"></span>${COLORS.find(c=>c.hex===t.farbe)?.name||'Eigene Farbe'} <span style="font-size:11px;color:var(--muted);">${t.farbe}</span></div></div></div>`;
  document.getElementById('btn-delete').onclick = () => deleteTermin(id);
  document.getElementById('btn-edit').onclick   = () => openModal(id);
  document.getElementById('btn-fahrt').onclick  = () => terminToFahrt(id);
  document.getElementById('overlay').classList.add('open');
}

function terminToFahrt(id) {
  const t = termine.find(x => x.id === id);
  if (!t) return;
  let startOrt = '';
  try {
    const e = JSON.parse(localStorage.getItem('max4work_einstellungen') || '{}');
    startOrt = [e.sPlz, e.sCity].filter(Boolean).join(' ') || e.sCity || '';
  } catch(e) {}
  const pending = {
    datum:    t.datum,
    abfahrt:  t.von  || '',
    ankunft:  t.bis  || '',
    zielOrt:  t.kunde || '',
    startOrt,
    zweck:    'dienstlich',
    kunde:    t.kunde || '',
    notiz:    t.notiz || '',
    _titel:   t.titel,
  };
  localStorage.setItem('max4work_fahrt_pending', JSON.stringify(pending));
  window.location.href = 'fahrtenbuch.html';
}
function closeModal(){document.getElementById('overlay').classList.remove('open');editId=null;}
function overlayClick(e){if(e.target===document.getElementById('overlay'))closeModal();}
function toggleTime(){document.getElementById('time-fields').style.display=document.getElementById('f-ganztag').value==='ja'?'none':'grid';}
function saveTermin(){
  const titel=document.getElementById('f-titel').value.trim();
  if(!titel){document.getElementById('f-titel').focus();return;}
  const data={titel,datum:document.getElementById('f-datum').value,von:document.getElementById('f-von').value,bis:document.getElementById('f-bis').value,kunde:document.getElementById('f-kunde').value.trim(),notiz:document.getElementById('f-notiz').value.trim(),ganztag:document.getElementById('f-ganztag').value,farbe:selectedColor};
  if(editId){const i=termine.findIndex(t=>t.id===editId);termine[i]={...termine[i],...data};}
  else{data.id=Date.now();termine.push(data);}
  saveStorage();closeModal();selectedDate=data.datum;
  viewMonth=parseDate(data.datum).getMonth();viewYear=parseDate(data.datum).getFullYear();renderCalendar();
}
function deleteTermin(id){
  if(!confirm('Termin wirklich löschen?'))return;
  termine=termine.filter(t=>t.id!==id);saveStorage();closeModal();renderCalendar();
}

/* ══════════════ ICS Generierung (shared) ══════════════ */
function _buildICS() {
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
  const colorCat = {
    '#C8D93A':'Lime','#2B3829':'Dunkelgrün','#34C759':'Grün',
    '#3B82F6':'Blau','#8B5CF6':'Lila','#F97316':'Orange',
    '#EF4444':'Rot','#EC4899':'Pink',
  };
  let lines = [
    'BEGIN:VCALENDAR','VERSION:2.0',
    'PRODID:-//max4work//Terminplaner//DE',
    'CALSCALE:GREGORIAN','METHOD:PUBLISH',
    'X-WR-CALNAME:max4work Termine',
    'X-WR-TIMEZONE:Europe/Berlin',
  ];
  termine.forEach(t => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:max4work-${t.id}@max4work.com`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}Z`);
    if (t.ganztag === 'ja') {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(t.datum)}`);
      const end = new Date(t.datum + 'T00:00:00');
      end.setDate(end.getDate() + 1);
      const [ey,em,ed] = end.toISOString().split('T')[0].split('-');
      lines.push(`DTEND;VALUE=DATE:${ey}${em}${ed}`);
    } else {
      lines.push(`DTSTART;TZID=Europe/Berlin:${icsDate(t.datum, t.von || '00:00')}`);
      lines.push(`DTEND;TZID=Europe/Berlin:${icsDate(t.datum, t.bis || t.von || '01:00')}`);
    }
    lines.push(`SUMMARY:${icsEscape(t.titel)}`);
    if (t.kunde) lines.push(`LOCATION:${icsEscape(t.kunde)}`);
    if (t.notiz) lines.push(`DESCRIPTION:${icsEscape(t.notiz)}`);
    if (t.farbe && colorCat[t.farbe]) lines.push(`CATEGORIES:${colorCat[t.farbe]}`);
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/* ══════════════ ICS Export für iOS Kalender ══════════════ */
function exportICS() {
  if (!termine.length) { alert('Keine Termine vorhanden.'); return; }
  const ics = _buildICS();
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = `max4work_Termine_${new Date().toISOString().slice(0,10)}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showICSHint();
  }
}

/* ══════════════ Kalender auf GitHub veröffentlichen ══════════════ */
async function publishCalendar() {
  if (!termine.length) { alert('Keine Termine vorhanden.'); return; }
  const token = localStorage.getItem('max4work_gh_token') || '';
  if (!token) {
    if (confirm('Kein GitHub-Token gespeichert.\nJetzt in Einstellungen → Daten & Sync eintragen?')) {
      location.href = 'einstellungen.html';
    }
    return;
  }
  const ics = _buildICS();
  const encoded = btoa(unescape(encodeURIComponent(ics)));
  const api = 'https://api.github.com/repos/max4work/max4work/contents/calendar.ics';
  const hdr = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };
  _showPubToast('Wird veröffentlicht…', 'info');
  let sha = null;
  try {
    const chk = await fetch(api, { headers: hdr });
    if (chk.ok) sha = (await chk.json()).sha;
  } catch(e) {}
  const body = { message: `Update calendar.ics (${termine.length} Termine)`, content: encoded };
  if (sha) body.sha = sha;
  try {
    const res = await fetch(api, { method: 'PUT', headers: hdr, body: JSON.stringify(body) });
    if (res.ok) {
      _showPubToast(`✓ ${termine.length} Termin${termine.length!==1?'e':''} veröffentlicht – iPhone aktualisiert automatisch`, 'ok');
    } else {
      const err = await res.json().catch(() => ({}));
      _showPubToast('Fehler: ' + (err.message || 'Token prüfen'), 'err');
    }
  } catch(e) {
    _showPubToast('Netzwerkfehler', 'err');
  }
}

function _showPubToast(msg, type) {
  document.getElementById('_pubToast')?.remove();
  const bg = type === 'ok' ? '#34C759' : type === 'err' ? '#FF3B30' : 'var(--surface,#2c2c2e)';
  const d = document.createElement('div');
  d.id = '_pubToast';
  d.style.cssText = `position:fixed;bottom:calc(110px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);background:${bg};color:#fff;border-radius:12px;padding:11px 20px;font-size:13px;font-weight:500;z-index:600;box-shadow:0 6px 24px rgba(0,0,0,.3);white-space:nowrap;max-width:88vw;text-align:center;border:1px solid rgba(255,255,255,.1);`;
  d.textContent = msg;
  document.body.appendChild(d);
  if (type !== 'info') setTimeout(() => d.remove(), 4500);
}

function showICSHint() {
  const existing = document.getElementById('icsHint');
  if (existing) { existing.remove(); return; }
  const div = document.createElement('div');
  div.id = 'icsHint';
  div.style.cssText = `position:fixed;bottom:32px;right:24px;background:var(--dark,#1c1c1e);color:#fff;border-radius:14px;padding:18px 22px;max-width:320px;z-index:500;box-shadow:0 8px 32px rgba(0,0,0,.3);font-size:13px;line-height:1.6;`;
  div.innerHTML = `
    <div style="font-weight:600;font-size:14px;margin-bottom:8px;">Kalender-Export</div>
    <ol style="padding-left:16px;color:rgba(255,255,255,.85);">
      <li>.ics-Datei speichern</li>
      <li>Auf iPhone übertragen (AirDrop / iCloud)</li>
      <li>Datei antippen → <strong>„Zum Kalender hinzufügen"</strong></li>
    </ol>
    <button onclick="document.getElementById('icsHint').remove()" style="position:absolute;top:12px;right:14px;background:none;border:none;color:rgba(255,255,255,.6);cursor:pointer;font-size:18px;">×</button>`;
  document.body.appendChild(div);
  setTimeout(() => { if (document.getElementById('icsHint')) document.getElementById('icsHint').remove(); }, 10000);
}

/* ══════════════ Kalender Sync Sheet (Mobile) ══════════════ */
function openSyncSheet() {
  if (document.getElementById('kalSyncSheet')) { closeSyncSheet(); return; }
  const sheet = document.createElement('div');
  sheet.id = 'kalSyncSheet';
  sheet.className = 'mob-mehr-sheet';
  sheet.innerHTML = `
    <div class="mob-mehr-backdrop" onclick="closeSyncSheet()"></div>
    <div class="mob-mehr-panel">
      <div class="mob-mehr-handle"></div>
      <div class="mob-mehr-header">Kalender Sync</div>
      <div class="mob-mehr-section">
        <div class="mob-mehr-list">
          <button class="mob-mehr-row" style="width:100%;border:none;background:none;cursor:pointer;text-align:left;font-family:inherit;" onclick="closeSyncSheet();exportICS()">
            <div class="mob-mehr-row-icon" style="background:rgba(52,199,89,.15);border-radius:8px;width:34px;height:34px;flex-shrink:0;color:#34C759;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <div style="flex:1">
              <div class="mob-mehr-row-label">Exportieren</div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px;">Termine → iOS Kalender</div>
            </div>
            <div class="mob-mehr-chevron"><svg width="8" height="13" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 8 13"><path d="M1.5 1.5 6.5 6.5 1.5 11.5"/></svg></div>
          </button>
          <button class="mob-mehr-row" style="width:100%;border:none;background:none;cursor:pointer;text-align:left;font-family:inherit;" onclick="closeSyncSheet();importICS()">
            <div class="mob-mehr-row-icon" style="background:rgba(0,122,255,.15);border-radius:8px;width:34px;height:34px;flex-shrink:0;color:#007AFF;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>
            <div style="flex:1">
              <div class="mob-mehr-row-label">Importieren</div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px;">ICS-Datei → Termine</div>
            </div>
            <div class="mob-mehr-chevron"><svg width="8" height="13" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 8 13"><path d="M1.5 1.5 6.5 6.5 1.5 11.5"/></svg></div>
          </button>
          <button class="mob-mehr-row" style="width:100%;border:none;background:none;cursor:pointer;text-align:left;font-family:inherit;" onclick="closeSyncSheet();publishCalendar()">
            <div class="mob-mehr-row-icon" style="background:rgba(255,149,0,.15);border-radius:8px;width:34px;height:34px;flex-shrink:0;color:#FF9500;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            </div>
            <div style="flex:1">
              <div class="mob-mehr-row-label">Kalender-Abo aktualisieren</div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px;">Termine live auf max4work.com veröffentlichen</div>
            </div>
            <div class="mob-mehr-chevron"><svg width="8" height="13" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 8 13"><path d="M1.5 1.5 6.5 6.5 1.5 11.5"/></svg></div>
          </button>
        </div>
      </div>
      <div class="mob-mehr-section" style="margin-top:10px;">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:13px;padding:13px 15px;font-size:12.5px;color:var(--muted);line-height:1.65;">
          <span style="color:var(--text);font-weight:600;">Export:</span> iOS öffnet „Zum Kalender hinzufügen" (einmalig)<br>
          <span style="color:var(--text);font-weight:600;">Abo aktualisieren:</span> Termine live auf max4work.com → iPhone synct automatisch
        </div>
      </div>
      <div style="height:20px;"></div>
    </div>`;
  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('open'));
}

function closeSyncSheet() {
  const sheet = document.getElementById('kalSyncSheet');
  if (!sheet) return;
  sheet.classList.remove('open');
  setTimeout(() => sheet.remove(), 340);
}

function titelTerminInput(val){
  const dd=document.getElementById('titelTerminDd');
  if(!val||val.length<1){dd.style.display='none';return;}
  const produkte=JSON.parse(localStorage.getItem('max4work_produkte')||'[]');
  const q=val.toLowerCase();
  const matches=produkte.filter(p=>(p.name||'').toLowerCase().includes(q)).slice(0,8);
  if(!matches.length){dd.style.display='none';return;}
  dd.innerHTML=matches.map(p=>`<div class="kunde-dd-item" onmousedown="titelTerminSelect(event,'${(p.name||'').replace(/'/g,"\\'")}')">
    <div class="kunde-dd-name">${p.name||''}</div>
  </div>`).join('');
  dd.style.display='block';
}
function titelTerminSelect(e,name){
  e.preventDefault();
  document.getElementById('f-titel').value=name;
  document.getElementById('titelTerminDd').style.display='none';
}
function kundeTerminInput(val){
  const dd=document.getElementById('kundeTerminDd');
  if(!val||val.length<2){dd.style.display='none';return;}
  const kunden=JSON.parse(localStorage.getItem('max4work_kunden')||'[]');
  const q=val.toLowerCase();
  const matches=kunden.filter(k=>(k.name||'').toLowerCase().includes(q)||(k.ort||'').toLowerCase().includes(q)).slice(0,8);
  if(!matches.length){dd.style.display='none';return;}
  dd.innerHTML=matches.map(k=>{
    const addr=[k.strasse,k.ort].filter(Boolean).join(', ');
    return `<div class="kunde-dd-item" onmousedown="kundeTerminSelect(event,'${(k.name||'').replace(/'/g,"\\'")}','${(k.strasse||'').replace(/'/g,"\\'")}','${(k.ort||'').replace(/'/g,"\\'")}')">
      <div class="kunde-dd-name">${k.name||''}</div>
      ${addr?`<div class="kunde-dd-sub">${addr}</div>`:''}
    </div>`;
  }).join('');
  dd.style.display='block';
}
function kundeTerminSelect(e,name,strasse,ort){
  e.preventDefault();
  const parts=[name,strasse,ort].filter(Boolean);
  document.getElementById('f-kunde').value=parts.join(', ');
  document.getElementById('kundeTerminDd').style.display='none';
}
document.addEventListener('click',e=>{
  if(!e.target.closest('.kunde-wrap')){
    document.getElementById('kundeTerminDd').style.display='none';
    document.getElementById('titelTerminDd').style.display='none';
  }
});

/* ══════════════ ICS Import (Smartphone Sync) ══════════════ */
function importICS() {
  document.getElementById('icsFileInput').click();
}

function _handleICSFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const events = _parseICSText(e.target.result);
    if (!events.length) { alert('Keine Termine in der Datei gefunden.'); input.value = ''; return; }
    const { imported, skipped } = _importToTermine(events);
    saveStorage(); renderCalendar();
    _showImportToast(imported, skipped);
    input.value = '';
  };
  reader.readAsText(file, 'UTF-8');
}

function _parseICSText(text) {
  const raw = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = raw.split(/\r\n|\r|\n/);
  const events = [];
  let cur = null;
  for (const line of lines) {
    const ci = line.indexOf(':');
    if (ci < 0) continue;
    const propFull = line.slice(0, ci);
    const propUpper = propFull.toUpperCase();
    const propName = propUpper.split(';')[0];
    const value = line.slice(ci + 1);
    if (propName === 'BEGIN' && value.trim() === 'VEVENT') { cur = {}; continue; }
    if (propName === 'END'   && value.trim() === 'VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    switch (propName) {
      case 'UID':         cur.uid         = value.trim(); break;
      case 'SUMMARY':     cur.summary     = _icsUnescape(value); break;
      case 'LOCATION':    cur.location    = _icsUnescape(value); break;
      case 'DESCRIPTION': cur.description = _icsUnescape(value); break;
      case 'DTSTART': cur.dtstart = value.trim(); cur.dtstartFull = propUpper; break;
      case 'DTEND':   cur.dtend   = value.trim(); break;
    }
  }
  return events;
}

function _icsUnescape(s) {
  return s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
}

function _parseICSDate(value, propFull) {
  if (!value) return null;
  const allDay = ((propFull || '').includes('VALUE=DATE')) || value.length === 8;
  const y = value.slice(0,4), m = value.slice(4,6), d = value.slice(6,8);
  if (allDay) return { date: `${y}-${m}-${d}`, time: null, allDay: true };
  const h = value.slice(9,11) || '00', min = value.slice(11,13) || '00';
  return { date: `${y}-${m}-${d}`, time: `${h}:${min}`, allDay: false };
}

function _importToTermine(events) {
  let imported = 0, skipped = 0;
  const existingUIDs = new Set(termine.filter(t => t.icsUID).map(t => t.icsUID));
  const baseId = Date.now();

  for (const evt of events) {
    if (!evt.summary || !evt.dtstart) { skipped++; continue; }

    if (evt.uid) {
      const own = evt.uid.match(/^max4work-(\d+)@max4work\.com$/);
      if (own && termine.find(t => t.id === parseInt(own[1]))) { skipped++; continue; }
      if (existingUIDs.has(evt.uid)) { skipped++; continue; }
    }

    const start = _parseICSDate(evt.dtstart, evt.dtstartFull);
    if (!start) { skipped++; continue; }

    let bis = '';
    if (evt.dtend && !start.allDay) {
      const end = _parseICSDate(evt.dtend, '');
      if (end?.time) bis = end.time;
    }

    const termin = {
      id:      baseId + imported,
      titel:   evt.summary,
      datum:   start.date,
      von:     start.allDay ? '' : (start.time || ''),
      bis:     start.allDay ? '' : bis,
      kunde:   evt.location || '',
      notiz:   evt.description || '',
      ganztag: start.allDay ? 'ja' : 'nein',
      farbe:   '#5AC8FA',
    };
    if (evt.uid) { termin.icsUID = evt.uid; existingUIDs.add(evt.uid); }
    termine.push(termin);
    imported++;
  }
  return { imported, skipped };
}

function _showImportToast(imported, skipped) {
  document.getElementById('importToast')?.remove();
  const div = document.createElement('div');
  div.id = 'importToast';
  div.style.cssText = 'position:fixed;bottom:24px;right:24px;background:var(--dark);color:#fff;border-radius:12px;padding:14px 20px;z-index:500;box-shadow:0 8px 32px rgba(0,0,0,.3);font-size:13px;line-height:1.5;min-width:220px;';
  const skipNote = skipped ? `<div style="font-size:11.5px;color:rgba(255,255,255,.6);margin-top:4px;">${skipped} bereits vorhanden / übersprungen</div>` : '';
  div.innerHTML = `<div style="font-weight:600;margin-bottom:2px;">✓ ${imported} Termin${imported !== 1 ? 'e' : ''} importiert</div>${skipNote}<button onclick="document.getElementById('importToast').remove()" style="position:absolute;top:10px;right:12px;background:none;border:none;color:rgba(255,255,255,.6);cursor:pointer;font-size:16px;">×</button>`;
  document.body.appendChild(div);
  setTimeout(() => document.getElementById('importToast')?.remove(), 6000);
}

renderCalendar();
