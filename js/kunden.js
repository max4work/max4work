  const COLORS_AV = ['#0066FF','#34C759','#FF9500','#AF52DE','#FF3B30','#5AC8FA','#FF6B6B','#43A047'];
  function avatarColor(name){let h=0;for(let c of name)h=(h*31+c.charCodeAt(0))%COLORS_AV.length;return COLORS_AV[h];}
  function initials(name){return name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();}
  const STORAGE_KEY='max4work_kunden';
  function load(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||[];}catch{return[];}}
  function save(d){localStorage.setItem(STORAGE_KEY,JSON.stringify(d));}
  let kunden=load().filter(k=>k.id>5||typeof k.id==='string'), currentFilter='alle', editId=null;
  save(kunden);
  function setFilter(el){document.querySelectorAll('.ftab').forEach(t=>t.classList.remove('on'));el.classList.add('on');currentFilter=el.dataset.filter;renderTable();}
  function renderTable(){
    const q=document.getElementById('searchInput').value.toLowerCase();
    const body=document.getElementById('tableBody');
    let list=kunden.filter(k=>{
      if(currentFilter==='aktiv'&&k.status!=='aktiv')return false;
      if(currentFilter==='inaktiv'&&k.status!=='inaktiv')return false;
      if(q&&!`${k.name} ${k.ort} ${k.notiz}`.toLowerCase().includes(q))return false;
      return true;
    });
    updateStats();
    if(!list.length){body.innerHTML=`<div class="empty"><div class="empty-icon">○</div><div class="empty-text">Keine Kunden gefunden</div></div>`;return;}
    body.innerHTML=list.map(k=>`
      <div class="k-row" onclick="editKunde(${k.id})">
        <div class="k-name-wrap">
          <div class="k-av" style="background:${avatarColor(k.name)}">${initials(k.name)}</div>
          <div><div class="k-name">${esc(k.name)}</div>${k.notiz?`<div class="k-adresse">${esc(k.notiz)}</div>`:''}</div>
        </div>
        <div class="k-cell">${esc(k.ort)}</div>
        <div class="k-cell">${esc(k.tel)}</div>
        <div class="k-cell">${esc(k.turnus)}</div>
        <div class="k-cell"><span class="badge ${k.status==='aktiv'?'badge-aktiv':'badge-inaktiv'}">${k.status==='aktiv'?'Aktiv':'Inaktiv'}</span></div>
        <div><button type="button" class="icon-btn" onclick="deleteKunde(event,${k.id})" title="Löschen">✕</button></div>
      </div>`).join('');
  }
  function updateStats(){
    document.getElementById('stat-gesamt').textContent=kunden.length;
    document.getElementById('stat-aktiv').textContent=kunden.filter(k=>k.status==='aktiv').length;
    document.getElementById('stat-inaktiv').textContent=kunden.filter(k=>k.status==='inaktiv').length;
  }
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function openModal(id=null){
    editId=id;
    document.getElementById('modal-title').textContent=id?'Kunde bearbeiten':'Neuer Kunde';
    const k=id?kunden.find(x=>x.id===id):{};
    document.getElementById('f-name').value=k.name||'';
    document.getElementById('f-strasse').value=k.strasse||'';
    const _om=((k.ort||'').match(/^(\d{5})\s+(.+)$/))||[];
    document.getElementById('f-plz').value=_om[1]||'';
    document.getElementById('f-ort').value=_om[2]||(k.ort||'');
    document.getElementById('f-tel').value=k.tel||'';
    document.getElementById('f-email').value=k.email||'';
    document.getElementById('f-turnus').value=k.turnus||'';
    document.getElementById('f-status').value=k.status||'aktiv';
    document.getElementById('f-notiz').value=k.notiz||'';
    document.getElementById('f-km').value=k.km||'';
    document.getElementById('f-km-anzeige').value=k.km ? (k.km*2).toLocaleString('de-DE',{maximumFractionDigits:1})+' km' : '– km';
    document.getElementById('overlay').classList.add('open');
    document.getElementById('f-name').focus();
    const s=document.getElementById('f-strasse').value.trim(), o=document.getElementById('f-ort').value.trim();
    if(s||o) setTimeout(()=>updateMiniMap(s,o),120);
  }
  function closeModal(){document.getElementById('overlay').classList.remove('open');editId=null;document.getElementById('miniMapContainer').style.display='none';}
  function overlayClick(e){if(e.target===document.getElementById('overlay'))closeModal();}
  function saveKunde(){
    const name=document.getElementById('f-name').value.trim();
    if(!name){document.getElementById('f-name').focus();return;}
    const kmVal = parseFloat(document.getElementById('f-km').value)||0;
    const _plz=document.getElementById('f-plz').value.trim(),_on=document.getElementById('f-ort').value.trim();
    const data={name,strasse:document.getElementById('f-strasse').value.trim(),ort:(_plz&&_on)?`${_plz} ${_on}`:(_on||_plz),tel:document.getElementById('f-tel').value.trim(),email:document.getElementById('f-email').value.trim(),turnus:document.getElementById('f-turnus').value,status:document.getElementById('f-status').value,notiz:document.getElementById('f-notiz').value.trim(),km:kmVal};
    if(editId){const i=kunden.findIndex(k=>k.id===editId);kunden[i]={...kunden[i],...data};}
    else{data.id=Date.now();kunden.push(data);}
    save(kunden);closeModal();renderTable();
  }
  function editKunde(id){openModal(id);}
  function deleteKunde(e,id){e.stopPropagation();if(!confirm('Kunden wirklich löschen?'))return;kunden=kunden.filter(k=>k.id!==id);save(kunden);renderTable();}
  renderTable();
  const _sv=localStorage.getItem('max4work_kunden_view');
  if(_sv==='karte')setTimeout(()=>setView('karte'),0);

  /* ── Kartenansicht & Mini-Karte ── */
  const GEO_CACHE = 'max4work_geocache';
  let mapInst=null, miniInst=null, miniMark=null, mapMarkers=[], geoRunId=0;

  function geoCache(){try{return JSON.parse(localStorage.getItem(GEO_CACHE)||'{}');}catch(e){return{};}}
  function saveGeoCache(c){try{localStorage.setItem(GEO_CACHE,JSON.stringify(c));}catch(e){}}

  async function geocode(strasse,ort){
    const key=(strasse+'|'+ort).trim().toLowerCase();
    const c=geoCache();
    if(key in c)return c[key];
    const q=[strasse,ort].filter(Boolean).join(', ');
    if(!q){c[key]=null;saveGeoCache(c);return null;}
    try{
      const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de&q='+encodeURIComponent(q));
      const d=await r.json();
      const v=d[0]?{lat:+d[0].lat,lon:+d[0].lon}:null;
      c[key]=v;saveGeoCache(c);return v;
    }catch(e){return null;}
  }

  function setView(v){
    localStorage.setItem('max4work_kunden_view',v);
    if(typeof refreshSubNav==='function')refreshSubNav();
    document.querySelectorAll('.view-btn').forEach(b=>b.classList.toggle('on',b.dataset.view===v));
    const tp=document.getElementById('tablePanel'), mv=document.getElementById('mapView');
    if(v==='karte'){
      tp.style.display='none'; mv.style.display='block';
      requestAnimationFrame(initKarte);
    }else{
      mv.style.display='none'; tp.style.display='block';
    }
  }

  function mkPin(k){
    return L.divIcon({
      className:'',
      html:`<div style="width:34px;height:34px;border-radius:50%;background:${avatarColor(k.name)};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.28);border:2.5px solid #fff;font-family:Outfit,sans-serif">${initials(k.name)}</div>`,
      iconSize:[34,34],iconAnchor:[17,17]
    });
  }

  function initKarte(){
    if(!mapInst){
      mapInst=L.map('mapView').setView([52.27,10.52],12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
        attribution:'© <a href="https://openstreetmap.org">OpenStreetMap</a>',maxZoom:19
      }).addTo(mapInst);
    }else{
      mapInst.invalidateSize();
    }
    ladeKarteMarker();
  }

  async function ladeKarteMarker(){
    const myId=++geoRunId;
    mapMarkers.forEach(m=>m.remove()); mapMarkers=[];
    const list=kunden.filter(k=>k.ort||k.strasse);
    const c=geoCache(), bounds=[];

    // Gecachte sofort anzeigen
    list.forEach(k=>{
      if(myId!==geoRunId)return;
      const key=(k.strasse+'|'+k.ort).trim().toLowerCase();
      if(c[key]){addPin(k,c[key]);bounds.push([c[key].lat,c[key].lon]);}
    });
    if(bounds.length)fitBnds(bounds);

    // Ungecachte sequenziell mit Rate-Limit geocodieren
    const uncached=list.filter(k=>!((k.strasse+'|'+k.ort).trim().toLowerCase() in c));
    const prog=document.getElementById('mapProgress');
    let done=0;
    for(const k of uncached){
      if(myId!==geoRunId)return;
      if(uncached.length>1&&prog){prog.style.display='block';prog.textContent=`Adressen suchen … ${++done}/${uncached.length}`;}
      const coords=await geocode(k.strasse,k.ort);
      if(myId!==geoRunId)return;
      if(coords){addPin(k,coords);bounds.push([coords.lat,coords.lon]);fitBnds(bounds);}
      if(done<uncached.length)await new Promise(r=>setTimeout(r,1050));
    }
    if(prog)prog.style.display='none';
  }

  function addPin(k,coords){
    const m=L.marker([coords.lat,coords.lon],{icon:mkPin(k)}).addTo(mapInst);
    m.bindPopup(
      `<div style="font-family:Outfit,sans-serif;min-width:150px;line-height:1.5">` +
      `<strong style="font-size:13px">${esc(k.name)}</strong>` +
      (k.strasse?`<br><span style="font-size:12px;color:#666">${esc(k.strasse)}</span>`:'') +
      (k.ort?`<br><span style="font-size:12px;color:#666">${esc(k.ort)}</span>`:'') +
      (k.tel?`<br><span style="font-size:12px">📞 ${esc(k.tel)}</span>`:'') +
      `<br><a href="javascript:void(0)" onclick="editKunde(${k.id})" ` +
      `style="font-size:12px;color:#0066ff;font-weight:500;text-decoration:none;margin-top:3px;display:inline-block">Bearbeiten →</a></div>`
    );
    mapMarkers.push(m);
  }

  function fitBnds(bounds){
    if(!mapInst||!bounds.length)return;
    if(bounds.length===1)mapInst.setView(bounds[0],14);
    else mapInst.fitBounds(bounds,{padding:[40,40]});
  }

  /* Mini-Karte im Modal */
  async function updateMiniMap(strasse,ort){
    const cont=document.getElementById('miniMapContainer');
    if(!strasse&&!ort){cont.style.display='none';return;}
    const coords=await geocode(strasse,ort);
    if(!coords){cont.style.display='none';return;}
    cont.style.display='block';
    cont.dataset.q=encodeURIComponent([strasse,ort].filter(Boolean).join(', '));
    if(!miniInst){
      miniInst=L.map('miniMap',{zoomControl:false,dragging:false,scrollWheelZoom:false,
        doubleClickZoom:false,touchZoom:false,attributionControl:false}).setView([coords.lat,coords.lon],15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(miniInst);
      miniMark=L.marker([coords.lat,coords.lon]).addTo(miniInst);
    }else{
      if(miniMark)miniMark.remove();
      miniMark=L.marker([coords.lat,coords.lon]).addTo(miniInst);
      miniInst.setView([coords.lat,coords.lon],15);
      miniInst.invalidateSize();
    }
  }

  let addrTimer;
  function onAddrChange(){
    clearTimeout(addrTimer);
    addrTimer=setTimeout(()=>{
      const _plz=document.getElementById('f-plz')?.value.trim()||'';
      const _on=document.getElementById('f-ort')?.value.trim()||'';
      const _ort=(_plz&&_on)?`${_plz} ${_on}`:(_on||_plz);
      updateMiniMap(document.getElementById('f-strasse').value.trim(),_ort);
    },700);
  }

  async function onPlzInput(val){
    onAddrChange();
    if(!/^\d{5}$/.test(val))return;
    try{
      const r=await fetch(`https://api.zippopotam.us/de/${val}`);
      if(!r.ok)return;
      const d=await r.json();
      const city=d.places?.[0]?.['place name'];
      if(city){document.getElementById('f-ort').value=city;onAddrChange();}
    }catch(e){}
  }

  function getMapUrl(q){
    let p='auto';
    try{p=(JSON.parse(localStorage.getItem('max4work_features')||'{}')).kartenAnbieter||'auto';}catch(e){}
    const isMac=/mac|iphone|ipad/i.test(navigator.platform+navigator.userAgent);
    switch(p){
      case 'apple':  return `maps://?q=${q}`;
      case 'google': return `https://www.google.com/maps/search/?api=1&query=${q}`;
      case 'osm':    return `https://www.openstreetmap.org/search?query=${q}`;
      case 'bing':   return `https://www.bing.com/maps?q=${q}`;
      case 'waze':   return `https://www.waze.com/ul?q=${q}`;
      default:       return isMac?`maps://?q=${q}`:`https://www.google.com/maps/search/?api=1&query=${q}`;
    }
  }

  function openInMaps(){
    const q=document.getElementById('miniMapContainer').dataset.q;
    if(!q)return;
    window.open(getMapUrl(q),'_blank');
  }
