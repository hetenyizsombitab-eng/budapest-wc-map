/* Budapest WC Térkép – app logika */
(() => {
  'use strict';

  const TZ = 'Europe/Budapest';
  const SUMMER_MONTHS = [5, 6, 7, 8, 9]; // május–szeptember
  const BUDAPEST = [47.4979, 19.0402];
  const DAY_NAMES = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
  const STORAGE_KEY = 'bpwc:filters';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const state = {
    toilets: (window.TOILETS || []).slice(),
    visible: [],
    query: '',
    filters: { openNow: false, free: false, h24: false, accessible: false, district: '' },
    sort: 'distance',
    user: null,          // { lat, lng, accuracy }
    selectedId: null,
    view: 'map',
  };

  let map, markerLayer, userMarker, userCircle;
  const markers = new Map();

  /* ---------- Segédfüggvények ---------- */

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const isFree = (t) => norm(t.price).startsWith('ingyenes');
  const isAccessible = (t) => norm(t.accessibility).startsWith('igen');
  const romanDistrict = (n) => {
    const r = [['XX', 20], ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]];
    let out = '';
    for (const [sym, val] of r) while (n >= val) { out += sym; n -= val; }
    return out;
  };

  function distance(a, b) {
    const R = 6371e3, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  const fmtDistance = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`);
  const walkMinutes = (m) => Math.max(1, Math.round(m / 80)); // ~4,8 km/h

  function fmtTime(h) {
    if (h >= 24) return '24:00';
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    return `${hh}:${String(mm).padStart(2, '0')}`;
  }

  /* ---------- Idő és nyitvatartás ---------- */

  function budapestNow(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, hourCycle: 'h23', weekday: 'short', month: 'numeric', hour: 'numeric', minute: 'numeric',
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    return { day: wd, month: Number(get('month')), hour: Number(get('hour')) + Number(get('minute')) / 60 };
  }

  // Egy adott nap [nyitás, zárás] intervalluma, vagy null ha zárva
  function intervalFor(schedule, day, month) {
    if (schedule === '24h') return [0, 24];
    if (!schedule || schedule === 'closed') return null;
    if (schedule.all) return schedule.all;
    if (schedule.summer || schedule.winter) return SUMMER_MONTHS.includes(month) ? schedule.summer : schedule.winter;
    if (schedule.days) return schedule.days[day] || null;
    return null;
  }

  // Olvasható nyitvatartás a részletekhez
  function hoursHtml(t) {
    const s = t.schedule;
    const iv = (x) => (x ? `${fmtTime(x[0])}–${fmtTime(x[1])}` : 'zárva');
    if (s === '24h') return 'Éjjel-nappal (0–24)';
    if (s === 'closed') return 'Jelenleg bezárt';
    if (!s) return 'Nincs adat';
    if (s.all) return `Minden nap ${iv(s.all)}`;
    if (s.summer || s.winter) return `Nyáron (máj–szept): ${iv(s.summer)}<br>Télen (okt–ápr): ${iv(s.winter)}`;
    if (s.days) {
      const order = [1, 2, 3, 4, 5, 6, 0];
      const short = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];
      const groups = [];
      order.forEach((d) => {
        const v = iv(s.days[d]);
        const last = groups[groups.length - 1];
        if (last && last.v === v) last.to = d; else groups.push({ from: d, to: d, v });
      });
      return groups.map((g) => `${short[g.from]}${g.from !== g.to ? '–' + short[g.to] : ''}: ${g.v}`).join('<br>');
    }
    return esc(t.hours);
  }

  /**
   * @returns {{ code: 'open'|'closed'|'unknown'|'shut', label: string, short: string }}
   */
  function openStatus(t, now = budapestNow()) {
    const s = t.schedule;
    if (s === '24h') return { code: 'open', label: 'Éjjel-nappal nyitva', short: '0–24' };
    if (s === 'closed') return { code: 'shut', label: 'Jelenleg bezárt', short: 'Bezárt' };
    if (!s) return { code: 'unknown', label: 'Nincs nyitvatartási adat', short: 'Nincs adat' };

    const today = intervalFor(s, now.day, now.month);
    if (today && now.hour >= today[0] && now.hour < today[1]) {
      return { code: 'open', label: `Nyitva, ${fmtTime(today[1])}-ig`, short: `${fmtTime(today[1])}-ig` };
    }
    // Következő nyitás keresése (ma később, vagy a következő 7 napban)
    if (today && now.hour < today[0]) {
      return { code: 'closed', label: `Zárva, ma ${fmtTime(today[0])}-kor nyit`, short: `${fmtTime(today[0])}-kor nyit` };
    }
    for (let i = 1; i <= 7; i++) {
      const d = (now.day + i) % 7;
      const iv = intervalFor(s, d, now.month);
      if (iv) {
        const when = i === 1 ? 'holnap' : DAY_NAMES[d];
        return { code: 'closed', label: `Zárva, ${when} ${fmtTime(iv[0])}-kor nyit`, short: `${when} ${fmtTime(iv[0])}` };
      }
    }
    return { code: 'closed', label: 'Zárva', short: 'Zárva' };
  }

  /* ---------- Szűrés, rendezés ---------- */

  function computeVisible() {
    const q = norm(state.query.trim());
    const f = state.filters;
    const now = budapestNow();

    let list = state.toilets.filter((t) => {
      if (q && !norm(`${t.name} ${t.address} ${t.district}. kerület ${romanDistrict(t.district)}. kerület`).includes(q)) return false;
      if (f.free && !isFree(t)) return false;
      if (f.h24 && t.schedule !== '24h') return false;
      if (f.accessible && !isAccessible(t)) return false;
      if (f.district && String(t.district) !== f.district) return false;
      if (f.openNow && openStatus(t, now).code !== 'open') return false;
      return true;
    });

    list.forEach((t) => { t._dist = state.user ? distance(state.user, t) : null; });

    const sort = state.sort === 'distance' && !state.user ? 'name' : state.sort;
    list.sort((a, b) => {
      if (sort === 'distance') return a._dist - b._dist;
      if (sort === 'district') return a.district - b.district || a.name.localeCompare(b.name, 'hu');
      return a.name.localeCompare(b.name, 'hu');
    });

    state.visible = list;
  }

  function activeFilterCount() {
    const f = state.filters;
    return [f.openNow, f.free, f.h24, f.accessible, !!f.district].filter(Boolean).length;
  }

  function saveFilters() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ filters: state.filters, sort: state.sort })); } catch (_) { /* nem baj */ }
  }

  function loadFilters() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved?.filters) Object.assign(state.filters, saved.filters);
      if (saved?.sort) state.sort = saved.sort;
    } catch (_) { /* nem baj */ }
  }

  /* ---------- Megjelenítés ---------- */

  function render() {
    computeVisible();
    renderChips();
    renderCount();
    renderMarkers();
    if (state.view === 'list') renderList();
  }

  function renderCount() {
    const n = state.visible.length;
    const total = state.toilets.length;
    const now = budapestNow();
    const open = state.visible.filter((t) => openStatus(t, now).code === 'open').length;
    $('#result-count').textContent = n === total && !state.query
      ? `${total} WC · ${open} most nyitva`
      : `${n} találat · ${open} most nyitva`;
  }

  function renderChips() {
    $$('.chip[data-filter]').forEach((btn) => {
      const on = !!state.filters[btn.dataset.filter];
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    const sel = $('#district');
    sel.value = state.filters.district;
    sel.classList.toggle('on', !!state.filters.district);
    $('#reset-filters').classList.toggle('hidden', activeFilterCount() === 0);
  }

  function markerIcon(t, status, selected) {
    const cls = ['pin', `pin-${status.code}`];
    if (isFree(t)) cls.push('pin-free');
    if (selected) cls.push('pin-selected');
    const acc = isAccessible(t) ? '<span class="pin-acc">♿</span>' : '';
    return L.divIcon({
      className: 'pin-wrap',
      html: `<div class="${cls.join(' ')}"><span>WC</span>${acc}</div>`,
      iconSize: [36, 44],
      iconAnchor: [18, 42],
    });
  }

  function renderMarkers() {
    if (!map) return;
    const now = budapestNow();
    const visibleIds = new Set(state.visible.map((t) => t.id));

    markers.forEach((m, id) => { if (!visibleIds.has(id)) { markerLayer.removeLayer(m); markers.delete(id); } });

    state.visible.forEach((t) => {
      const icon = markerIcon(t, openStatus(t, now), t.id === state.selectedId);
      let m = markers.get(t.id);
      if (!m) {
        m = L.marker([t.lat, t.lng], { icon, title: t.name, riseOnHover: true, keyboard: true });
        m.on('click', () => select(t.id, { pan: false }));
        m.addTo(markerLayer);
        markers.set(t.id, m);
      } else {
        m.setIcon(icon);
      }
      m.setZIndexOffset(t.id === state.selectedId ? 1000 : 0);
    });
  }

  function statusPill(st) {
    return `<span class="status status-${st.code}">${esc(st.label)}</span>`;
  }

  function renderList() {
    const ul = $('#list');
    $('#sort').value = state.sort;
    if (!state.visible.length) {
      ul.innerHTML = `
        <li class="empty">
          <div class="empty-icon">🚻</div>
          <h3>Nincs találat</h3>
          <p>Próbálj kevesebb szűrőt, vagy más keresőszót.</p>
          ${activeFilterCount() || state.query ? '<button class="btn btn-ghost" data-action="reset-all">Szűrők és keresés törlése</button>' : ''}
        </li>`;
      return;
    }
    const now = budapestNow();
    ul.innerHTML = state.visible.map((t) => {
      const st = openStatus(t, now);
      const dist = t._dist != null ? `<span class="dist">${fmtDistance(t._dist)}</span>` : '';
      return `
        <li>
          <button class="card" data-id="${t.id}">
            <div class="card-top">
              <h3>${esc(t.name)}</h3>${dist}
            </div>
            <p class="addr">${esc(t.address)}</p>
            <div class="card-tags">
              ${statusPill(st)}
              <span class="tag ${isFree(t) ? 'tag-free' : ''}">${esc(isFree(t) ? 'Ingyenes' : t.price === 'n.a.' ? 'Ár: nincs adat' : t.price)}</span>
              ${isAccessible(t) ? '<span class="tag tag-acc">♿ Akadálymentes</span>' : ''}
              <span class="tag">${romanDistrict(t.district)}. ker.</span>
            </div>
          </button>
        </li>`;
    }).join('');
  }

  function renderSheet(t) {
    const st = openStatus(t);
    const dist = t._dist != null
      ? `<div class="kv"><span>Távolság</span><strong>${fmtDistance(t._dist)} · kb. ${walkMinutes(t._dist)} perc gyalog</strong></div>` : '';
    const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}&travelmode=walking`;
    const appleUrl = `https://maps.apple.com/?daddr=${t.lat},${t.lng}&dirflg=w`;
    const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;

    $('#sheet-body').innerHTML = `
      <div class="sheet-inner">
        <div class="sheet-header">
          <div>
            <h2 id="sheet-title">${esc(t.name)}</h2>
            <p class="addr">${esc(t.address)}</p>
          </div>
          <button class="icon-btn" data-close aria-label="Bezárás">✕</button>
        </div>
        <div class="sheet-status">${statusPill(st)}</div>
        <div class="kvs">
          <div class="kv"><span>Nyitvatartás</span><strong>${hoursHtml(t)}</strong></div>
          <div class="kv"><span>Ár</span><strong>${esc(isFree(t) ? 'Ingyenes' : t.price === 'n.a.' ? 'Nincs adat' : t.price)}</strong></div>
          <div class="kv"><span>Akadálymentes</span><strong>${esc(t.accessibility.charAt(0).toUpperCase() + t.accessibility.slice(1))}</strong></div>
          <div class="kv"><span>Kerület</span><strong>${romanDistrict(t.district)}. kerület</strong></div>
          ${dist}
        </div>
        <div class="sheet-actions">
          <a class="btn btn-primary" href="${isApple ? appleUrl : navUrl}" target="_blank" rel="noopener">Útvonal ide</a>
          <button class="btn btn-ghost" data-action="copy" data-text="${esc(t.address)}">Cím másolása</button>
        </div>
        ${isApple ? `<p class="muted small center"><a href="${navUrl}" target="_blank" rel="noopener">Megnyitás Google Térképen</a></p>` : ''}
      </div>`;
  }

  /* ---------- Lapok (sheet) ---------- */

  function openSheet(id) {
    const el = $(id);
    $$('.sheet.open').forEach((s) => { if (s !== el) closeSheet(`#${s.id}`, true); });
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    $('#sheet-backdrop').classList.remove('hidden');
  }

  function closeSheet(id, keepBackdrop = false) {
    const el = $(id);
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    if (!keepBackdrop) $('#sheet-backdrop').classList.add('hidden');
    if (id === '#sheet' && state.selectedId != null) { state.selectedId = null; renderMarkers(); }
    if (id === '#info') setTab(state.view);
  }

  function closeAllSheets() { ['#sheet', '#info'].forEach((id) => $(id).classList.contains('open') && closeSheet(id)); }

  // Lehúzással bezárás
  function enableSwipeToClose(el, id) {
    let startY = null, dy = 0;
    el.addEventListener('touchstart', (e) => {
      if (el.scrollTop > 0) return;
      startY = e.touches[0].clientY; dy = 0; el.style.transition = 'none';
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      if (startY == null) return;
      dy = Math.max(0, e.touches[0].clientY - startY);
      el.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    el.addEventListener('touchend', () => {
      if (startY == null) return;
      el.style.transition = ''; el.style.transform = '';
      if (dy > 90) closeSheet(id);
      startY = null;
    });
  }

  /* ---------- Műveletek ---------- */

  function select(id, { pan = true } = {}) {
    const t = state.toilets.find((x) => x.id === id);
    if (!t) return;
    if (state.user) t._dist = distance(state.user, t);
    const switched = pan && map && state.view !== 'map';
    if (switched) setView('map');
    state.selectedId = id;
    renderMarkers();
    renderSheet(t);
    openSheet('#sheet');
    if (pan && map) {
      const doPan = () => {
        map.invalidateSize();
        const z = Math.max(map.getZoom(), 16);
        // a jelölő a lap fölött maradjon látható
        const pt = map.project([t.lat, t.lng], z).add([0, window.innerHeight * 0.18]);
        map.flyTo(map.unproject(pt, z), z, { duration: 0.6 });
      };
      if (switched) setTimeout(doPan, 80); else doPan();
    }
  }

  function setTab(view) {
    $$('.tab').forEach((b) => {
      const on = b.dataset.view === view;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  function setView(view) {
    if (view === 'info') { setTab('info'); openSheet('#info'); return; }
    closeAllSheets();
    state.view = view;
    setTab(view);
    $('#view-map').classList.toggle('hidden', view !== 'map');
    $('#view-list').classList.toggle('hidden', view !== 'list');
    if (view === 'map' && map) setTimeout(() => map.invalidateSize(), 50);
    if (view === 'list') renderList();
  }

  let toastTimer;
  function toast(msg, ms = 3200) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function locate({ silent = false } = {}) {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) {
        if (!silent) toast('Ez a böngésző nem támogatja a helymeghatározást.');
        return resolve(null);
      }
      if (!window.isSecureContext) {
        if (!silent) toast('A helymeghatározás csak https:// címen működik.');
        return resolve(null);
      }
      const btn = $('#btn-locate');
      btn.classList.add('busy');
      navigator.geolocation.getCurrentPosition((pos) => {
        btn.classList.remove('busy');
        btn.classList.add('located');
        state.user = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        showUser();
        if (state.sort !== 'distance') state.sort = 'distance';
        render();
        resolve(state.user);
      }, (err) => {
        btn.classList.remove('busy');
        if (!silent) {
          toast(err.code === 1
            ? 'A helyhozzáférés le van tiltva. Engedélyezd a böngésző beállításaiban.'
            : 'Nem sikerült meghatározni a helyzeted. Próbáld újra.');
        }
        resolve(null);
      }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    });
  }

  function showUser() {
    if (!map || !state.user) return;
    const ll = [state.user.lat, state.user.lng];
    if (!userMarker) {
      userCircle = L.circle(ll, { radius: state.user.accuracy, color: '#2563eb', weight: 1, fillOpacity: 0.08, interactive: false }).addTo(map);
      userMarker = L.marker(ll, {
        icon: L.divIcon({ className: 'me-wrap', html: '<div class="me"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
        zIndexOffset: 2000, interactive: false,
      }).addTo(map);
    } else {
      userMarker.setLatLng(ll);
      userCircle.setLatLng(ll).setRadius(state.user.accuracy);
    }
    map.flyTo(ll, Math.max(map.getZoom(), 15), { duration: 0.6 });
  }

  async function findNearestOpen() {
    const user = state.user || await locate();
    if (!user) return;
    const now = budapestNow();
    // a szűrőket (pl. ingyenes, akadálymentes) figyelembe veszi, a nyitvatartást mindig
    const candidates = state.visible.length ? state.visible : state.toilets;
    const open = candidates
      .filter((t) => openStatus(t, now).code === 'open')
      .map((t) => ({ t, d: distance(user, t) }))
      .sort((a, b) => a.d - b.d);
    if (!open.length) {
      toast(activeFilterCount() ? 'A szűrőknek megfelelő WC-k közül most egy sincs nyitva.' : 'Most egyik WC sincs nyitva.');
      return;
    }
    const { t, d } = open[0];
    if (map) {
      const bounds = L.latLngBounds([[user.lat, user.lng], [t.lat, t.lng]]);
      map.flyToBounds(bounds, { paddingTopLeft: [40, 40], paddingBottomRight: [40, window.innerHeight * 0.45], maxZoom: 17, duration: 0.7 });
    }
    select(t.id, { pan: false });
    toast(`${t.name} – ${fmtDistance(d)}`);
  }

  function resetAll() {
    state.filters = { openNow: false, free: false, h24: false, accessible: false, district: '' };
    state.query = '';
    $('#search').value = '';
    $('#search-clear').classList.add('hidden');
    saveFilters();
    render();
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Cím a vágólapon.');
    } catch (_) {
      toast(text, 5000);
    }
  }

  /* ---------- Inicializálás ---------- */

  function initMap() {
    if (typeof L === 'undefined') {
      $('#map').innerHTML = '<div class="map-error">A térkép nem töltődött be. Ellenőrizd az internetkapcsolatot, addig a Lista nézet használható.</div>';
      return;
    }
    map = L.map('map', { zoomControl: false, attributionControl: true, tap: true }).setView(BUDAPEST, 13);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    map.attributionControl.setPrefix(false);
  }

  function initDistricts() {
    const sel = $('#district');
    [...new Set(state.toilets.map((t) => t.district))].sort((a, b) => a - b).forEach((d) => {
      const o = document.createElement('option');
      o.value = String(d);
      o.textContent = `${romanDistrict(d)}. kerület`;
      sel.appendChild(o);
    });
  }

  function bindEvents() {
    let searchTimer;
    $('#search').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      $('#search-clear').classList.toggle('hidden', !e.target.value);
      searchTimer = setTimeout(() => { state.query = e.target.value; render(); }, 120);
    });
    $('#search').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.target.blur();
        if (state.visible.length === 1) select(state.visible[0].id);
        else if (state.visible.length && map) map.flyToBounds(L.latLngBounds(state.visible.map((t) => [t.lat, t.lng])), { padding: [50, 50], maxZoom: 16 });
      }
    });
    $('#search-clear').addEventListener('click', () => {
      $('#search').value = ''; state.query = ''; $('#search-clear').classList.add('hidden'); render();
    });

    $$('.chip[data-filter]').forEach((btn) => btn.addEventListener('click', () => {
      const k = btn.dataset.filter;
      state.filters[k] = !state.filters[k];
      saveFilters(); render();
    }));
    $('#district').addEventListener('change', (e) => { state.filters.district = e.target.value; saveFilters(); render(); });
    $('#reset-filters').addEventListener('click', resetAll);

    $('#sort').addEventListener('change', (e) => {
      state.sort = e.target.value;
      if (state.sort === 'distance' && !state.user) locate();
      saveFilters(); render();
    });

    $$('.tab').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $('#btn-locate').addEventListener('click', () => locate());
    $('#btn-nearest').addEventListener('click', findNearestOpen);

    $('#list').addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (card) return select(Number(card.dataset.id));
      if (e.target.closest('[data-action="reset-all"]')) resetAll();
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) {
        const sheet = e.target.closest('.sheet');
        if (sheet) closeSheet(`#${sheet.id}`);
      }
      const copy = e.target.closest('[data-action="copy"]');
      if (copy) copyText(copy.dataset.text);
    });
    $('#sheet-backdrop').addEventListener('click', closeAllSheets);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllSheets(); });

    enableSwipeToClose($('#sheet'), '#sheet');
    enableSwipeToClose($('#info'), '#info');

    // percenként frissül a nyitva/zárva állapot
    setInterval(render, 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  }

  function registerSW() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* offline mód nélkül is működik */ });
    });
  }

  async function maybeAutoLocate() {
    // Ha korábban már engedélyezte, kérdezés nélkül megkeressük
    try {
      if (!navigator.permissions) return;
      const p = await navigator.permissions.query({ name: 'geolocation' });
      if (p.state === 'granted') locate({ silent: true });
    } catch (_) { /* Safari régebbi verziók */ }
  }

  // a fejléc magassága eszközönként (és notch-tól függően) más, ehhez igazítjuk a tartalmat
  function fitLayout() {
    const h = $('.topbar').offsetHeight;
    $('main').style.top = `${h}px`;
    if (map) map.invalidateSize();
  }

  function init() {
    fitLayout();
    window.addEventListener('resize', fitLayout);
    window.addEventListener('orientationchange', () => setTimeout(fitLayout, 200));
    loadFilters();
    initMap();
    initDistricts();
    bindEvents();
    render();
    registerSW();
    maybeAutoLocate();
  }

  // tesztekhez
  window.__bpwc = { openStatus, intervalFor, budapestNow, state, render };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
