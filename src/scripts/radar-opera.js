// Radar públic (/radar): la composició europea d'OPERA (EUMETNET, CC BY 4.0) que fa /api/capes/radar, sobre un mapa de
// relleu amb les comarques. Les dues últimes hores, una imatge cada 10 minuts, en bucle; i les estacions de la xarxa.
// Les imatges són PNG de paleta ja georeferenciats en Web Mercator (api/_opera.js): aquí només es carreguen i es
// pinten en un canvas, una darrere l'altra.
import L from 'leaflet';
import CONTORN from '../lib/catalunya-contorn.json';
import { STATIONS, shortName } from '../lib/stations.js';
import { loadAra } from './live.js';
import { num, hourMadrid, todayMadrid, dayName, dayMonth, precipColor } from '../lib/format.js';

const REFRESH = 2 * 60e3; // cada quan es mira si hi ha una imatge nova
// Vistes: tot Catalunya o el Cadí-Moixeró i el Berguedà
const VIEWS = {
  cat: [[40.52, 0.16], [42.86, 3.33]],
  cadi: [[41.95, 1.45], [42.52, 2.25]],
};
// Poblacions de referència (les petites només en apropar-s'hi)
const PLACES = [
  ['Barcelona', 41.387, 2.17, 7], ['Girona', 41.98, 2.82, 7], ['Lleida', 41.617, 0.62, 7], ['Tarragona', 41.119, 1.245, 7],
  ['Tortosa', 40.812, 0.521, 8], ['Manresa', 41.728, 1.824, 8], ['Vic', 41.93, 2.255, 8], ['Berga', 42.104, 1.845, 8],
  ['la Seu d’Urgell', 42.358, 1.461, 8], ['Puigcerdà', 42.432, 1.928, 8], ['Olot', 42.181, 2.49, 8], ['Figueres', 42.267, 2.961, 8],
  ['Tremp', 42.167, 0.895, 8.5], ['Vielha', 42.702, 0.796, 8.5], ['Solsona', 41.994, 1.517, 8.5], ['Ripoll', 42.2, 2.19, 8.5],
  ['Andorra la Vella', 42.507, 1.522, 8], ['Perpinyà', 42.699, 2.895, 8], ['Sant Llorenç de Morunys', 42.137, 1.592, 10],
  ['Castellar de n’Hug', 42.283, 2.017, 10], ['Alp', 42.373, 1.887, 10],
];
// (Bagà, Gósol, Guardiola i la Pobla de Lillet no hi són: ja hi ha les estacions, amb el nom en passar-hi per sobre)

// Canvas com a capa del mapa (com una imatge georeferenciada)
const CanvasOverlay = L.ImageOverlay.extend({
  _initImage() {
    const el = (this._image = this._url);
    L.DomUtil.addClass(el, 'leaflet-image-layer');
    if (this._zoomAnimated) L.DomUtil.addClass(el, 'leaflet-zoom-animated');
    if (this.options.className) L.DomUtil.addClass(el, this.options.className);
    el.onselectstart = L.Util.falseFn;
    el.onmousemove = L.Util.falseFn;
  },
});

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
function ago(d, now = Date.now()) {
  const m = Math.round((now - d.getTime()) / 60e3);
  if (m < 2) return 'ara mateix';
  if (m < 60) return `fa ${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return `fa ${h} h${r ? ` ${r} min` : ''}`;
}

// Una imatge: { t, date, img, cover, rain, max } o null
async function loadFrame(f) {
  try {
    const r = await fetch(f.url);
    if (!r.ok) return null;
    const blob = await r.blob();
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await img.decode();
    const h = (k) => (r.headers.get(k) == null ? null : Number(r.headers.get(k)));
    return { t: f.t, date: new Date(f.time), img, cover: h('x-radar-cobertura'), rain: h('x-radar-pluja'), max: h('x-radar-max') };
  } catch {
    return null;
  }
}

export function startRadarPage() {
  const $ = (id) => document.getElementById(id);
  const el = $('radarMap');
  if (!el) return null;
  const map = L.map(el, { zoomSnap: 0.25, minZoom: 6.5, maxZoom: 11, attributionControl: true });
  map.fitBounds(VIEWS.cat);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Relleu © <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>',
    maxZoom: 17,
    maxNativeZoom: 15,
  }).addTo(map);
  map.createPane('radar').style.zIndex = '350';
  map.createPane('lines').style.zIndex = '420';
  map.getPane('lines').style.pointerEvents = 'none';
  map.createPane('places').style.zIndex = '440';
  map.getPane('places').style.pointerEvents = 'none';

  // Comarques i contorn de Catalunya, per sobre del radar
  const RINGS = CONTORN.coordinates.map((p) => p[0].map(([lng, lat]) => [lat, lng]));
  fetch('/api/comarques')
    .then((r) => (r.ok ? r.json() : null))
    .then((g) => {
      if (g?.features) L.geoJSON(g, { pane: 'lines', interactive: false, style: { color: '#1f2d3d', weight: 0.8, opacity: 0.45, fill: false } }).addTo(map);
    })
    .catch(() => {});
  L.polygon(RINGS, { pane: 'lines', interactive: false, fill: false, color: '#10233b', weight: 1.6, opacity: 0.75 }).addTo(map);

  // Poblacions
  const placeMarkers = PLACES.map(([name, lat, lng, z]) => ({
    z,
    m: L.marker([lat, lng], { pane: 'places', interactive: false, keyboard: false, icon: L.divIcon({ className: 'rp-place', html: `<span>${name}</span>`, iconSize: null }) }),
  }));
  const syncPlaces = () => {
    const z = map.getZoom();
    for (const p of placeMarkers) {
      if (z >= p.z) p.m.addTo(map);
      else p.m.remove();
    }
  };
  map.on('zoomend', syncPlaces);
  syncPlaces();

  // Radar
  const st = { frames: [], i: -1, playing: false, index: null, bounds: null };
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  let layer = null;
  function ensureLayer(ix) {
    if (layer) return;
    cv.width = ix.size[0];
    cv.height = ix.size[1];
    layer = new CanvasOverlay(cv, ix.bounds, {
      pane: 'radar',
      className: 'rp-cv',
      interactive: false,
      attribution: 'Radar: <a href="https://www.eumetnet.eu/observations/weather-radar-network/" target="_blank" rel="noopener">EUMETNET OPERA</a> (CC BY 4.0)',
    }).addTo(map);
  }
  function paint(f) {
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (f) ctx.drawImage(f.img, 0, 0);
  }
  function show(i) {
    if (!st.frames.length) return;
    st.i = Math.max(0, Math.min(st.frames.length - 1, i));
    const f = st.frames[st.i];
    paint(f);
    const day = todayMadrid(f.date);
    $('rpTime').textContent = `${day === todayMadrid() ? 'Avui' : cap(dayName(day))} ${dayMonth(day)} · ${hourMadrid(f.date)}`;
    $('rpAge').textContent = st.i === st.frames.length - 1 ? `Imatge més nova, ${ago(f.date)}` : ago(f.date);
    const sl = $('rpSlider');
    sl.max = String(st.frames.length - 1);
    sl.value = String(st.i);
    sl.setAttribute('aria-valuetext', `${hourMadrid(f.date)}`);
    note();
  }
  // Nota sota el mapa: si ara no plou enlloc de Catalunya, o si a la imatge hi falten radars
  function note() {
    const f = st.frames[st.i];
    const last = st.frames[st.frames.length - 1];
    let t = '';
    if (f?.cover != null && f.cover < 0.97) t = 'En aquesta imatge hi falten radars: hi ha zones de Catalunya sense dades (en gris).';
    else if (last && st.i === st.frames.length - 1 && last.rain != null && last.rain < 0.0005) t = 'Ara mateix el radar no veu precipitació enlloc de Catalunya.';
    $('rpNote').textContent = t;
  }

  let timer = null;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  function play(on) {
    st.playing = on && st.frames.length > 1;
    const b = $('rpPlay');
    b.setAttribute('aria-pressed', String(st.playing));
    b.setAttribute('aria-label', st.playing ? 'Atura l’animació' : 'Reprodueix les dues últimes hores');
    b.querySelector('span').textContent = st.playing ? 'Atura' : 'Reprodueix';
    clearTimeout(timer);
    if (!st.playing) return;
    const tick = () => {
      const end = st.i >= st.frames.length - 1;
      show(end ? 0 : st.i + 1);
      timer = setTimeout(tick, st.i === st.frames.length - 1 ? 1600 : 380);
    };
    tick();
  }
  $('rpPlay').addEventListener('click', () => play(!st.playing));
  $('rpSlider').addEventListener('input', (e) => {
    play(false);
    show(Number(e.target.value));
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' && e.shiftKey) { play(false); show(st.i - 1); e.preventDefault(); }
    if (e.key === 'ArrowRight' && e.shiftKey) { play(false); show(st.i + 1); e.preventDefault(); }
  });
  document.querySelectorAll('[data-rp-view]').forEach((b) =>
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-rp-view]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      map.flyToBounds(VIEWS[b.dataset.rpView], { duration: 0.6 });
    }),
  );

  async function loadAll() {
    let ix = null;
    try {
      const r = await fetch('/api/capes/radar');
      ix = r.ok ? await r.json() : null;
    } catch {}
    if (!ix?.frames?.length) {
      $('rpStatus').textContent = "No s'ha pogut carregar el radar. Torna-ho a provar d'aquí a una estona.";
      return;
    }
    st.index = ix;
    ensureLayer(ix);
    // Primer la més nova (es veu de seguida) i després la resta, de la més nova a la més antiga
    const list = ix.frames;
    const slots = list.map((f) => ({ f, fr: null }));
    const sync = () => {
      const atEnd = st.i === -1 || st.i === st.frames.length - 1;
      st.frames = slots.map((s) => s.fr).filter(Boolean);
      if (st.frames.length) show(atEnd ? st.frames.length - 1 : st.i);
    };
    slots[slots.length - 1].fr = await loadFrame(list[list.length - 1]);
    sync();
    $('rpStatus').textContent = st.frames.length ? 'Carregant les dues últimes hores…' : '';
    // De 3 en 3, de la més nova a la més antiga
    for (let k = slots.length - 2; k >= 0; k -= 3) {
      const part = slots.slice(Math.max(0, k - 2), k + 1);
      await Promise.all(part.map(async (s) => { s.fr = await loadFrame(s.f); }));
      sync();
    }
    $('rpStatus').textContent = st.frames.length ? '' : "No s'ha pogut carregar el radar. Torna-ho a provar d'aquí a una estona.";
    $('rpPlay').disabled = st.frames.length < 2;
    $('rpSlider').disabled = st.frames.length < 2;
    if (st.frames.length > 1 && !reduce?.matches) play(true);
  }

  // Imatges noves: es torna a demanar la llista (a la CDN, 1 minut) i s'hi afegeixen les que faltin
  async function refresh() {
    if (document.hidden || !st.index) return;
    let ix = null;
    try {
      const r = await fetch('/api/capes/radar');
      ix = r.ok ? await r.json() : null;
    } catch {}
    if (!ix?.frames?.length) return;
    const have = new Set(st.frames.map((f) => f.t));
    const fresh = ix.frames.filter((f) => !have.has(f.t) && f.t > (st.frames[st.frames.length - 1]?.t ?? ''));
    if (!fresh.length) return;
    const got = (await Promise.all(fresh.map(loadFrame))).filter(Boolean);
    if (!got.length) return;
    const atEnd = st.i === st.frames.length - 1;
    const keep = new Set(ix.frames.map((f) => f.t));
    const old = st.frames.filter((f) => !keep.has(f.t));
    st.frames = [...st.frames.filter((f) => keep.has(f.t)), ...got].sort((a, b) => (a.t < b.t ? -1 : 1));
    for (const f of old) URL.revokeObjectURL(f.img.src);
    if (!st.playing) show(atEnd ? st.frames.length - 1 : st.i);
  }
  setInterval(refresh, REFRESH);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

  // Estacions de la xarxa: un punt amb la pluja d'avui (el valor, en apropar-s'hi)
  const pins = STATIONS.map((s) => {
    const m = L.marker([s.lat, s.lng], { keyboard: false, icon: L.divIcon({ className: 'rp-pin', html: '<span></span>', iconSize: null }) }).addTo(map);
    m.bindTooltip(shortName(s), { direction: 'top', offset: [0, -8] });
    return { s, m };
  });
  // De prop, el valor de la pluja; si les etiquetes es trepitgen, la de més pluja es queda i les altres són un punt
  function syncPins() {
    const near = map.getZoom() >= 10;
    el.classList.toggle('rp-near', near);
    if (!near) return;
    const placed = [];
    const list = pins.map((p) => ({ ...p, span: p.m.getElement()?.firstElementChild })).filter((p) => p.span);
    list.sort((a, b) => Number(b.span.dataset.v ?? -1) - Number(a.span.dataset.v ?? -1));
    for (const p of list) {
      p.span.classList.remove('is-dot');
      if (!p.span.textContent) continue;
      const c = map.latLngToContainerPoint(p.m.getLatLng());
      const w = p.span.offsetWidth || 36, h = p.span.offsetHeight || 20;
      const box = [c.x - w / 2 - 3, c.y - h / 2 - 3, c.x + w / 2 + 3, c.y + h / 2 + 3];
      if (placed.some((q) => !(box[2] < q[0] || box[0] > q[2] || box[3] < q[1] || box[1] > q[3]))) p.span.classList.add('is-dot');
      else placed.push(box);
    }
  }
  map.on('zoomend', syncPins);
  syncPins();
  loadAra()
    .then((j) => {
      for (const { s, m } of pins) {
        const d = j?.stations?.[s.id];
        const r = d && !d.stale ? d.rain : null;
        const span = m.getElement()?.firstElementChild;
        if (span) {
          span.textContent = r != null ? num(r) : '';
          span.dataset.v = String(r ?? -1);
          span.style.setProperty('--c', r != null && r >= 0.1 ? precipColor(r) : '#ffffff');
          span.classList.toggle('is-wet', r != null && r >= 0.1);
        }
        m.setTooltipContent(`<b>${shortName(s)}</b><br>${r != null ? `${num(r)} mm avui` : 'sense dades'}`);
      }
      syncPins();
    })
    .catch(() => {});

  loadAll();
  return { map, state: st };
}
