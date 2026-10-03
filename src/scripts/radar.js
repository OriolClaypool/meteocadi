// Estudi · visor de radar (ús intern, /estudi/radar): el radar del Meteocat, les estacions i el vent sobre el mateix mapa.
//
// Radar: les tessel·les del Meteocat (les que fa servir el seu web: una imatge cada 6 minuts, nivell de zoom 7, uns 1 km
// per píxel) del bloc que cobreix Catalunya i voltants. Es compon cada imatge en un canvas, es llegeix el color de cada
// píxel i es converteix en un nivell de l'escala del Meteocat; després es pinta amb l'escala triada (l'original del
// Meteocat o la de Meteocadí) i amb els píxels nítids en apropar-se. Si el servidor no deixés llegir els píxels (CORS), es mostren les
// imatges tal com venen.
// Estacions: /api/xema i /api/ara. Vent: model AROME de Météo-France (/api/vent) i vent mesurat a les estacions.
import L from 'leaflet';
import CONTORN from '../lib/catalunya-contorn.json';
import { loadAra } from './live.js';
import { STATIONS } from '../lib/stations.js';
import { fieldColor } from './camp.js';
import { num, hourMadrid, todayMadrid, dayName, dayMonth } from '../lib/format.js';
import { PAL } from './radar-pal.js';

export { PAL };

// ---------------------------------------------------------------- radar: tessel·les i escales
const TILES = 'https://static-m.meteo.cat/tiles';
const Z = 7;
const BX = [63, 65]; // columnes (XYZ) de -2,8° a 5,6° de longitud
const BY = [46, 48]; // files (XYZ) de 39,6° a 44,1° de latitud
const STEP = 6; // minuts entre imatges
const FRAMES = 21; // 2 hores
const W = (BX[1] - BX[0] + 1) * 256;
const H = (BY[1] - BY[0] + 1) * 256;
const tileLat = (y) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** Z))) * 180) / Math.PI;
const tileLng = (x) => (x / 2 ** Z) * 360 - 180;
export const RADAR_BOUNDS = { lat0: tileLat(BY[1] + 1), lat1: tileLat(BY[0]), lng0: tileLng(BX[0]), lng1: tileLng(BX[1] + 1) };

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const RGB = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, v.map(hex)]));

const pad = (n, l = 2) => String(n).padStart(l, '0');
function tileUrl(prod, date, x, y) {
  const d = `${date.getUTCFullYear()}/${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}/${pad(date.getUTCHours())}/${pad(date.getUTCMinutes())}`;
  return `${TILES}/${prod}/${d}/${pad(Z)}/000/000/${pad(x, 3)}/000/000/${pad(2 ** Z - 1 - y, 3)}.png`; // fila en format TMS
}
const floorStep = (d) => new Date(Math.floor(d.getTime() / (STEP * 60e3)) * STEP * 60e3);

function loadImg(url, cors) {
  return new Promise((res) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });
}

// Una imatge del radar: { date, idx (Uint8Array amb el nivell de cada píxel, 255 = res) } o { date, raw (canvas) }
async function loadFrame(prod, date, cors) {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const jobs = [];
  for (let x = BX[0]; x <= BX[1]; x++)
    for (let y = BY[0]; y <= BY[1]; y++)
      jobs.push(
        loadImg(tileUrl(prod, date, x, y), cors).then((img) => {
          if (!img) return false;
          ctx.drawImage(img, (x - BX[0]) * 256, (y - BY[0]) * 256);
          return true;
        }),
      );
  const got = (await Promise.all(jobs)).filter(Boolean).length;
  if (!got) return null;
  if (!cors) return { date, raw: cv };
  let data;
  try {
    data = ctx.getImageData(0, 0, W, H).data;
  } catch {
    return { date, raw: cv };
  }
  // Color de cada píxel → nivell de l'escala més proper (amb memòria, perquè les tessel·les tenen pocs colors)
  const pal = RGB[prod === 'plujaneu' ? 'plujaneu' : 'meteocat'];
  const idx = new Uint8Array(W * H).fill(255);
  const memo = new Map();
  let painted = 0, far = 0;
  for (let i = 0, p = 0; i < idx.length; i++, p += 4) {
    if (data[p + 3] < 40) continue;
    painted++;
    const key = (data[p] << 16) | (data[p + 1] << 8) | data[p + 2];
    let m = memo.get(key);
    if (m === undefined) {
      let best = 0, bd = Infinity;
      for (let k = 0; k < pal.length; k++) {
        const c = pal[k];
        const dd = (data[p] - c[0]) ** 2 + (data[p + 1] - c[1]) ** 2 + (data[p + 2] - c[2]) ** 2;
        if (dd < bd) { bd = dd; best = k; }
      }
      m = bd > 3 * 45 * 45 ? -1 - best : best; // negatiu: lluny de qualsevol color de l'escala
      memo.set(key, m);
    }
    if (m < 0) { far++; m = -1 - m; }
    idx[i] = m;
  }
  // Si molts píxels no s'assemblen a l'escala, l'escala del Meteocat deu haver canviat: es mostra la imatge original
  if (painted > 200 && far / painted > 0.2) return { date, raw: cv, odd: true };
  return { date, idx };
}

// Canvas com a capa del mapa (com una imatge georeferenciada), amb els píxels nítids
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

// ---------------------------------------------------------------- vent: graella del model
function sampler(g) {
  const dlat = (g.lat1 - g.lat0) / g.ny, dlng = (g.lng1 - g.lng0) / g.nx;
  const at = (i, j) => {
    const k = j * g.nx + i;
    const u = g.u[k], v = g.v[k];
    return u == null || v == null ? null : [u / 10, v / 10];
  };
  return (lat, lng) => {
    const fx = (lng - g.lng0) / dlng - 0.5, fy = (g.lat1 - lat) / dlat - 0.5;
    const i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= g.nx - 1 || j >= g.ny - 1) return null;
    const tx = fx - i, ty = fy - j;
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    if (!a || !b || !c || !d) return null;
    return [0, 1].map((n) => (a[n] * (1 - tx) + b[n] * tx) * (1 - ty) + (c[n] * (1 - tx) + d[n] * tx) * ty);
  };
}

// Convergència (−divergència) a cada cel·la, en 10⁻⁴ s⁻¹, una mica suavitzada
export function convergence(g) {
  const dlat = (g.lat1 - g.lat0) / g.ny, dlng = (g.lng1 - g.lng0) / g.nx;
  const C = new Float32Array(g.nx * g.ny).fill(NaN);
  const U = (i, j) => g.u[j * g.nx + i], V = (i, j) => g.v[j * g.nx + i];
  for (let j = 1; j < g.ny - 1; j++) {
    const lat = g.lat1 - (j + 0.5) * dlat;
    const dx = dlng * 111320 * Math.cos((lat * Math.PI) / 180), dy = dlat * 111320;
    for (let i = 1; i < g.nx - 1; i++) {
      const ue = U(i + 1, j), uw = U(i - 1, j), vn = V(i, j - 1), vs = V(i, j + 1);
      if ([ue, uw, vn, vs].some((x) => x == null)) continue;
      const div = (ue - uw) / 10 / (2 * dx) + (vn - vs) / 10 / (2 * dy);
      C[j * g.nx + i] = -div * 1e4;
    }
  }
  const S = new Float32Array(C.length).fill(NaN);
  for (let j = 1; j < g.ny - 1; j++)
    for (let i = 1; i < g.nx - 1; i++) {
      let s = 0, n = 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const v = C[(j + dj) * g.nx + i + di];
          if (!Number.isNaN(v)) { s += v; n++; }
        }
      if (n >= 5) S[j * g.nx + i] = s / n;
    }
  return S;
}

// Línies de convergència: l'eix de les zones on el vent convergeix (no les vores), com es dibuixen als mapes del temps.
// Un punt de la graella és de l'eix si la convergència hi supera el llindar i és més gran que a banda i banda en la
// direcció en què baixa més de pressa (la de la curvatura més negativa). Els punts veïns de l'eix s'uneixen en segments
// i es descarten els trossos molt curts. El llindar s'adapta: com a mínim 2·10⁻⁴ s⁻¹ i, si avui n'hi ha molta, el 95è
// percentil. Retorna [{ w, paths: [[[lat, lng], …], …] }] (dos gruixos segons la intensitat).
export function ridges(g, C) {
  const { nx, ny } = g;
  const dlat = (g.lat1 - g.lat0) / ny, dlng = (g.lng1 - g.lng0) / nx;
  const at = (i, j) => (i < 0 || j < 0 || i >= nx || j >= ny ? NaN : C[j * nx + i]);
  const bil = (x, y) => {
    const i = Math.floor(x), j = Math.floor(y), tx = x - i, ty = y - j;
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
  const pos = Array.from(C).filter((v) => v > 0).sort((x, y) => x - y);
  const T = Math.max(2, pos.length ? pos[Math.floor(pos.length * 0.95)] : 2);
  const on = new Uint8Array(nx * ny);
  for (let j = 1; j < ny - 1; j++)
    for (let i = 1; i < nx - 1; i++) {
      const c = at(i, j);
      if (!(c >= T)) continue;
      const cxx = at(i + 1, j) - 2 * c + at(i - 1, j), cyy = at(i, j + 1) - 2 * c + at(i, j - 1);
      const cxy = (at(i + 1, j + 1) - at(i + 1, j - 1) - at(i - 1, j + 1) + at(i - 1, j - 1)) / 4;
      if ([cxx, cyy, cxy].some(Number.isNaN)) continue;
      const lam = (cxx + cyy) / 2 - Math.sqrt(((cxx - cyy) / 2) ** 2 + cxy ** 2);
      if (lam >= 0) continue;
      let vx = cxy, vy = lam - cxx;
      if (Math.abs(vx) + Math.abs(vy) < 1e-9) { vx = lam - cyy; vy = cxy; }
      const m = Math.hypot(vx, vy) || 1;
      vx /= m; vy /= m;
      const A = bil(i + vx, j + vy), B = bil(i - vx, j - vy);
      if (!(c >= A) || !(c >= B)) continue;
      on[j * nx + i] = 1;
    }
  // Trossos connectats (8 veïns): fora els de menys de 4 punts
  const comp = new Int32Array(nx * ny).fill(-1);
  const size = [];
  for (let k = 0; k < on.length; k++) {
    if (!on[k] || comp[k] >= 0) continue;
    const id = size.length, stack = [k];
    comp[k] = id;
    let n = 0;
    while (stack.length) {
      const q = stack.pop();
      n++;
      const qi = q % nx, qj = (q / nx) | 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const ii = qi + di, jj = qj + dj;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
          const r = jj * nx + ii;
          if (on[r] && comp[r] < 0) { comp[r] = id; stack.push(r); }
        }
    }
    size.push(n);
  }
  // Encadena els punts de cada tros en línies (de punta a punta) i les suavitza (mitjana mòbil), perquè no facin
  // esglaons de la graella
  const P = (i, j) => [g.lat1 - (j + 0.5) * dlat, g.lng0 + (i + 0.5) * dlng];
  const keep = (k) => on[k] && size[comp[k]] >= 4;
  const nb = (k) => {
    const i = k % nx, j = (k / nx) | 0, out = [];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ii = i + di, jj = j + dj;
      if (ii >= 0 && jj >= 0 && ii < nx && jj < ny && keep(jj * nx + ii)) out.push(jj * nx + ii);
    }
    return out;
  };
  const seen = new Uint8Array(nx * ny);
  const chains = [];
  const walk = (start) => {
    const path = [start];
    seen[start] = 1;
    for (let cur = start; ; ) {
      const next = nb(cur).find((q) => !seen[q]);
      if (next === undefined) break;
      seen[next] = 1;
      path.push(next);
      cur = next;
    }
    return path;
  };
  const cells = [];
  for (let k = 0; k < on.length; k++) if (keep(k)) cells.push(k);
  // Primer des de les puntes (un sol veí), després el que quedi
  for (const k of cells) if (!seen[k] && nb(k).length === 1) chains.push(walk(k));
  for (const k of cells) if (!seen[k]) chains.push(walk(k));
  const thin = [], thick = [];
  for (const ch of chains) {
    if (ch.length < 3) continue;
    const pts = ch.map((k) => P(k % nx, (k / nx) | 0));
    const R = 3;
    const smooth = pts.map((_, n) => {
      let a = 0, b = 0, c = 0;
      for (let m = Math.max(0, n - R); m <= Math.min(pts.length - 1, n + R); m++) { a += pts[m][0]; b += pts[m][1]; c++; }
      return [a / c, b / c];
    });
    const mean = ch.reduce((x, k) => x + C[k], 0) / ch.length;
    (mean >= T * 2 ? thick : thin).push(smooth);
  }
  return [{ w: 2, paths: thin }, { w: 3.2, paths: thick }];
}

// Fletxa del vent (cap on bufa) de longitud len a (x, y)
function arrow(ctx, x, y, dx, dy, len, color, halo) {
  const m = Math.hypot(dx, dy) || 1;
  const ux = dx / m, uy = dy / m;
  const x0 = x - (ux * len) / 2, y0 = y - (uy * len) / 2, x1 = x + (ux * len) / 2, y1 = y + (uy * len) / 2;
  const hl = Math.min(6, len * 0.42);
  const draw = () => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.moveTo(x1 - ux * hl - uy * hl * 0.55, y1 - uy * hl + ux * hl * 0.55);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1 - ux * hl + uy * hl * 0.55, y1 - uy * hl - ux * hl * 0.55);
    ctx.stroke();
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (halo) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; draw(); }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.3;
  draw();
}
export const arrowLen = (ms, max) => Math.max(7, Math.min(max, 6 + ms * 2.3));

// ---------------------------------------------------------------- estacions
const HIDDEN = new Set(['IBAG65', 'IBAG72']);
export const VARS = {
  rain1h: { label: 'Pluja 1 h', unit: 'mm', color: (v) => (v < 0.1 ? '#ffffff' : fieldColor('rain', v)), fmt: (v) => num(v) },
  rain: { label: "Pluja d'avui", unit: 'mm', color: (v) => (v < 0.1 ? '#ffffff' : fieldColor('rain', v)), fmt: (v) => num(v) },
  gust: { label: 'Ratxa', unit: 'km/h', color: (v) => fieldColor('gust', v), fmt: (v) => String(Math.round(v)) },
  t: { label: 'Temperatura', unit: '°C', color: (v) => fieldColor('t', v), fmt: (v) => num(v) },
};
const ink = (h) => {
  const [r, g, b] = hex(h).map((x) => x / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5 ? '#ffffff' : '#10233b';
};
export { ink };

// Pluja de la darrera hora d'una estació nostra, de la sèrie d'avui (pluja acumulada cada 15 minuts)
function lastHour(s) {
  if (!s?.t?.length || !s.rain?.length) return null;
  const n = s.t.length - 1;
  const last = s.rain[n];
  if (last == null) return null;
  let k = n;
  while (k > 0 && s.t[n] - s.t[k - 1] <= 3600) k--;
  const first = s.rain[k];
  return first == null ? null : Math.max(0, last - first);
}

async function loadStations() {
  const [x, a] = await Promise.all([
    fetch('/api/xema').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    loadAra().catch(() => null),
  ]);
  const list = (x?.stations || []).map((s) => ({ ...s, mc: false }));
  const ara = a?.stations || {};
  for (const st of STATIONS) {
    const d = ara[st.id];
    if (HIDDEN.has(st.id) || !d || d.stale) continue;
    list.push({ id: st.id, name: st.name, lat: st.lat, lng: st.lng, alt: st.alt, mc: true, t: d.temp ?? null, rain: d.rain ?? null, rain1h: lastHour(d.series), gust: d.gustMax ?? d.gust ?? null, wind: d.wind ?? null, dir: d.dir ?? null });
  }
  return { list, latest: x?.latest ? new Date(x.latest) : null };
}

// ---------------------------------------------------------------- inici
export function startRadar() {
  const $ = (id) => document.getElementById(id);
  const map = L.map('rmap', { zoomSnap: 0.25, minZoom: 7, maxZoom: 12, maxBounds: [[RADAR_BOUNDS.lat0, RADAR_BOUNDS.lng0], [RADAR_BOUNDS.lat1, RADAR_BOUNDS.lng1]], maxBoundsViscosity: 0.8 });
  map.fitBounds([[40.52, 0.16], [42.86, 3.33]]);
  // Fons: relleu sense carreteres (per defecte), el topogràfic (amb carreteres i pobles) o cap
  const BASES = {
    relleu: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Relleu © <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a> (World Hillshade)',
      maxZoom: 17,
      maxNativeZoom: 15,
    }),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM · estil © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
      subdomains: 'abc',
      maxZoom: 17,
    }),
    cap: null,
  };
  let base = null;
  const setBase = (k) => {
    if (base) map.removeLayer(base);
    base = BASES[k];
    if (base) base.addTo(map);
    map.getContainer().dataset.base = k;
  };
  setBase('relleu');
  map.createPane('radar').style.zIndex = '350';
  map.createPane('wind').style.zIndex = '450';
  map.getPane('wind').style.pointerEvents = 'none';

  // Contorn de Catalunya i comarques, per sobre del radar
  const RINGS = CONTORN.coordinates.map((p) => p[0].map(([lng, lat]) => [lat, lng]));
  let comarques = null;
  fetch('/api/comarques').then((r) => (r.ok ? r.json() : null)).then((g) => {
    if (!g?.features) return;
    comarques = g;
    L.geoJSON(g, { interactive: false, style: { color: '#1f2d3d', weight: 0.9, opacity: 0.5, fill: false } }).addTo(map);
    L.polygon(RINGS, { interactive: false, fill: false, color: '#10233b', weight: 1.6, opacity: 0.8 }).addTo(map);
  }).catch(() => {});

  // ------------------------------------------------ estat
  // Vent i convergències: amagats de moment; la pàgina (estudi/radar.astro, WIND) només en posa els controls si estan activats
  const WIND = !!document.querySelector('[data-wind]');
  const st = {
    prod: 'radar', // 'radar' (intensitat) o 'plujaneu' (tipus)
    pal: 'meteocat', // 'meteocat' o 'meteocadi'
    crisp: true,
    opacity: 1, // per defecte, el radar sense transparència
    frames: [], // de la més antiga a la més nova
    i: -1,
    cors: true,
    playing: false,
    stVar: 'rain', // la pluja d'avui en entrar
    windModel: WIND,
    windObs: false,
    conv: WIND,
  };
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const cctx = cv.getContext('2d');
  const radarLayer = new CanvasOverlay(cv, [[RADAR_BOUNDS.lat0, RADAR_BOUNDS.lng0], [RADAR_BOUNDS.lat1, RADAR_BOUNDS.lng1]], {
    pane: 'radar',
    className: 'rad-cv',
    interactive: false,
    attribution: 'Radar: <a href="https://www.meteo.cat/" target="_blank" rel="noopener">Meteocat</a>',
  }).addTo(map);
  const applyLook = () => {
    cv.style.opacity = String(st.opacity);
    cv.classList.toggle('is-smooth', !st.crisp);
  };
  applyLook();

  // Pinta una imatge al canvas visible amb l'escala triada
  let pix = null;
  function paint(f) {
    cctx.clearRect(0, 0, W, H);
    if (!f) return;
    if (f.raw) { cctx.drawImage(f.raw, 0, 0); return; }
    const pal = RGB[st.prod === 'plujaneu' ? 'plujaneu' : st.pal];
    pix = pix || cctx.createImageData(W, H);
    const d = pix.data;
    for (let i = 0, p = 0; i < f.idx.length; i++, p += 4) {
      const k = f.idx[i];
      if (k === 255) { d[p + 3] = 0; continue; }
      const c = pal[k];
      d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
    }
    cctx.putImageData(pix, 0, 0);
  }

  const fmtTime = (d) => hourMadrid(d);
  function show(i) {
    st.i = Math.max(0, Math.min(st.frames.length - 1, i));
    const f = st.frames[st.i];
    paint(f);
    $('rTime').textContent = f ? `${cap(dayName(todayMadrid(f.date)))} ${dayMonth(todayMadrid(f.date))} · ${fmtTime(f.date)}` : '—';
    const sl = $('rSlider');
    sl.max = String(Math.max(0, st.frames.length - 1));
    sl.value = String(st.i);
    $('rAge').textContent = f ? ago(f.date) : '';
    $('rNote').textContent = f?.odd ? "Els colors del radar no coincideixen amb l'escala coneguda del Meteocat: es mostren tal com venen." : !st.cors ? 'El servidor del Meteocat no deixa llegir els píxels: el radar es mostra amb els seus colors originals i no es pot descarregar com a imatge.' : '';
  }
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  function ago(d) {
    const m = Math.round((Date.now() - d.getTime()) / 60e3);
    return m < 2 ? 'ara mateix' : `fa ${m} min`;
  }

  // Busca la imatge més nova (les últimes 6, en paral·lel) i carrega les 2 hores anteriors
  let loadSeq = 0;
  async function findLatest(prod) {
    const now = floorStep(new Date());
    const cands = Array.from({ length: 8 }, (_, k) => new Date(now.getTime() - k * STEP * 60e3));
    const ok = await Promise.all(cands.map((d) => loadImg(tileUrl(prod, d, 64, 47), false).then(Boolean)));
    const k = ok.indexOf(true);
    return k < 0 ? null : cands[k];
  }
  async function loadAll() {
    const seq = ++loadSeq;
    st.frames = [];
    st.i = -1;
    paint(null);
    $('rStatus').textContent = 'Buscant la imatge més nova del radar…';
    const latest = await findLatest(st.prod);
    if (seq !== loadSeq) return;
    if (!latest) { $('rStatus').textContent = "No s'ha pogut carregar el radar del Meteocat. Torna-ho a provar d'aquí a una estona."; return; }
    const dates = Array.from({ length: FRAMES }, (_, k) => new Date(latest.getTime() - (FRAMES - 1 - k) * STEP * 60e3));
    // Primer la més nova (es veu de seguida) i després la resta, de la més nova a la més antiga
    let first = await loadFrame(st.prod, latest, st.cors);
    if (!first && st.cors) { st.cors = false; first = await loadFrame(st.prod, latest, false); }
    if (seq !== loadSeq) return;
    if (first?.raw && !first.odd) st.cors = false;
    const slots = dates.map((d) => ({ date: d, f: null }));
    slots[slots.length - 1].f = first;
    const sync = () => {
      const keepLatest = st.i === -1 || st.i === st.frames.length - 1;
      st.frames = slots.filter((s) => s.f).map((s) => s.f);
      show(keepLatest ? st.frames.length - 1 : st.i);
    };
    sync();
    $('rStatus').textContent = 'Carregant les dues últimes hores…';
    for (let k = dates.length - 2; k >= 0; k--) {
      const f = await loadFrame(st.prod, dates[k], st.cors);
      if (seq !== loadSeq) return;
      slots[k].f = f;
      if (k % 4 === 0) sync();
    }
    sync();
    $('rStatus').textContent = '';
    $('rPlay').disabled = st.frames.length < 2;
  }

  // Cada 2 minuts, mira si ja hi ha una imatge nova
  setInterval(async () => {
    if (!st.frames.length) return;
    const last = st.frames[st.frames.length - 1].date;
    const next = new Date(last.getTime() + STEP * 60e3);
    if (Date.now() - next.getTime() < 60e3) return;
    const f = await loadFrame(st.prod, next, st.cors);
    if (!f) return;
    const atEnd = st.i === st.frames.length - 1;
    st.frames.push(f);
    if (st.frames.length > FRAMES) st.frames.shift();
    show(atEnd ? st.frames.length - 1 : Math.max(0, st.i - 1));
  }, 120e3);

  // ------------------------------------------------ animació
  let timer = null;
  function play(on) {
    st.playing = on;
    $('rPlay').setAttribute('aria-pressed', String(on));
    $('rPlay').textContent = on ? 'Atura' : 'Reprodueix';
    clearTimeout(timer);
    if (!on) return;
    const tick = () => {
      const end = st.i >= st.frames.length - 1;
      show(end ? 0 : st.i + 1);
      timer = setTimeout(tick, end ? 400 : st.i === st.frames.length - 1 ? 1400 : 260);
    };
    tick();
  }
  $('rPlay').addEventListener('click', () => play(!st.playing));
  $('rSlider').addEventListener('input', (e) => { play(false); show(Number(e.target.value)); });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, select, textarea')) return;
    if (e.key === 'ArrowLeft') { play(false); show(st.i - 1); }
    if (e.key === 'ArrowRight') { play(false); show(st.i + 1); }
    if (e.key === ' ') { e.preventDefault(); play(!st.playing); }
  });

  // ------------------------------------------------ controls del radar
  const seg = (sel, attr, cb) =>
    document.querySelectorAll(sel).forEach((b) =>
      b.addEventListener('click', () => {
        document.querySelectorAll(sel).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        cb(b.dataset[attr]);
      }),
    );
  seg('[data-prod]', 'prod', (v) => { st.prod = v; play(false); legend(); $('rPalRow').hidden = v === 'plujaneu'; loadAll(); });
  seg('[data-pal]', 'pal', (v) => { st.pal = v; legend(); paint(st.frames[st.i]); });
  seg('[data-look]', 'look', (v) => { st.crisp = v === 'pixel'; applyLook(); });
  seg('[data-base]', 'base', (v) => setBase(v));
  $('rOpacity').addEventListener('input', (e) => { st.opacity = Number(e.target.value); applyLook(); });

  function legend() {
    const el = $('rLegend');
    if (st.prod === 'plujaneu') {
      const g = (a, b) => PAL.plujaneu.slice(a, b).map((c) => `<i style="background:${c}"></i>`).join('');
      el.innerHTML = `<b>Tipus de precipitació</b><div class="rl-types"><span><span class="rl-bar">${g(0, 6)}</span>Pluja</span><span><span class="rl-bar">${g(6, 12)}</span>Aiguaneu</span><span><span class="rl-bar">${g(12, 18)}</span>Neu</span></div>`;
    } else {
      el.innerHTML = `<b>Intensitat de la precipitació</b><div class="rl-bar rl-bar--full">${PAL[st.pal].map((c) => `<i style="background:${c}"></i>`).join('')}</div><div class="rl-ticks"><span>Feble</span><span>Moderada</span><span>Forta</span><span>Calamarsa</span></div>`;
    }
  }
  legend();

  // ------------------------------------------------ estacions
  let stations = [];
  const markers = new Map();
  function drawStations() {
    const v = VARS[st.stVar];
    for (const s of stations) {
      let m = markers.get(s.id);
      if (!m) {
        m = L.marker([s.lat, s.lng], { icon: L.divIcon({ className: 'xpin', html: `<div class="xp${s.mc ? ' xp--mc' : ''}"></div>`, iconSize: null }), keyboard: false, interactive: false }).addTo(map);
        markers.set(s.id, m);
      }
      const el = m.getElement()?.firstElementChild;
      if (!el) continue;
      const val = v ? s[st.stVar] : null;
      if (val == null) { el.style.display = 'none'; continue; }
      const bg = v.color(val);
      el.style.display = '';
      el.style.background = bg;
      el.style.color = ink(bg);
      el.textContent = v.fmt(val);
      el.classList.toggle('is-zero', (st.stVar === 'rain' || st.stVar === 'rain1h') && val < 0.1);
    }
    declutter();
  }
  function declutter() {
    const v = st.stVar;
    const placed = [];
    const list = stations.filter((s) => s[v] != null).sort((a, b) => (b.mc ? 1e5 : 0) + b[v] - ((a.mc ? 1e5 : 0) + a[v]));
    for (const s of list) {
      const el = markers.get(s.id)?.getElement()?.firstElementChild;
      if (!el) continue;
      el.style.display = '';
      const p = map.latLngToContainerPoint([s.lat, s.lng]);
      const w = el.offsetWidth || 36, h = el.offsetHeight || 20;
      const box = [p.x - w / 2 - 4, p.y - h / 2 - 4, p.x + w / 2 + 4, p.y + h / 2 + 4];
      if (placed.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) el.style.display = 'none';
      else placed.push(box);
    }
  }
  map.on('zoomend', declutter);
  seg('[data-stvar]', 'stvar', (v) => { st.stVar = v; drawStations(); });
  async function refreshStations() {
    const { list, latest } = await loadStations();
    stations = list;
    $('rStTime').textContent = latest ? `Estacions: dades de les ${hourMadrid(latest)}` : '';
    drawStations();
    drawWind();
  }
  refreshStations();
  setInterval(refreshStations, 15 * 60e3);

  // ------------------------------------------------ vent (model i estacions) i convergència
  const wcv = L.DomUtil.create('canvas', 'rad-wind', map.getPane('wind'));
  let grid = null, sample = null, conv = null, lines = [];
  async function loadWind() {
    const j = await fetch('/api/vent').then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const note = $('rWindNote');
    if (!j || j.error) {
      grid = null;
      note.textContent = j?.error === 'no-key'
        ? 'Vent del model: falta la clau de Météo-France (METEOFRANCE_API_KEY a Vercel).'
        : "Vent del model: ara no s'ha pogut carregar el model de Météo-France.";
      if (j?.tried) console.warn('[vent]', j);
    } else {
      grid = j;
      sample = sampler(j);
      conv = convergence(j);
      lines = ridges(j, conv);
      const run = new Date(j.run), valid = new Date(j.valid);
      // AROME-PI: passada cada hora i previsió cada 15 minuts; AROME: passada cada 3 hores i previsió per hores
      const what = j.model === 'AROME-PI'
        ? `${j.kind === 'gust' ? 'Ratxes de vent' : 'Vent'} del model AROME-PI (Météo-France, es renova cada hora)`
        : 'Vent del model AROME (Météo-France)';
      note.textContent = `${what}, passada de les ${hourMadrid(run)}, previst per a les ${hourMadrid(valid)}.`;
    }
    drawWind();
  }
  function drawWind() {
    const size = map.getSize();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    wcv.width = size.x * dpr;
    wcv.height = size.y * dpr;
    wcv.style.width = `${size.x}px`;
    wcv.style.height = `${size.y}px`;
    L.DomUtil.setPosition(wcv, map.containerPointToLayerPoint([0, 0]));
    const ctx = wcv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.x, size.y);
    if (grid && st.conv) {
      ctx.setLineDash([7, 5]);
      for (const ln of lines) {
        for (const [color, w] of [['rgba(255,255,255,0.85)', ln.w + 2.4], ['#10233b', ln.w]]) {
          ctx.strokeStyle = color;
          ctx.lineWidth = w;
          ctx.beginPath();
          for (const path of ln.paths)
            path.forEach(([la, lo], n) => {
              const q = map.latLngToContainerPoint([la, lo]);
              n ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
            });
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    }
    if (grid && st.windModel) {
      const S = size.x < 640 ? 34 : 40;
      for (let y = S / 2; y < size.y; y += S)
        for (let x = S / 2; x < size.x; x += S) {
          const ll = map.containerPointToLatLng([x, y]);
          const w = sample(ll.lat, ll.lng);
          if (!w) continue;
          const ms = Math.hypot(w[0], w[1]);
          if (ms < 0.3) continue;
          arrow(ctx, x, y, w[0], -w[1], arrowLen(ms, S * 0.9), 'rgba(16,35,59,0.72)', true);
        }
    }
    if (st.windObs) {
      for (const s of stations) {
        if (s.wind == null || s.dir == null || s.wind < 1) continue;
        const p = map.latLngToContainerPoint([s.lat, s.lng]);
        if (p.x < -20 || p.y < -20 || p.x > size.x + 20 || p.y > size.y + 20) continue;
        const ms = s.wind / 3.6, rad = (s.dir * Math.PI) / 180;
        const len = Math.max(22, arrowLen(ms, 44));
        const dx = -Math.sin(rad), dy = Math.cos(rad); // cap on bufa (en pantalla, y cap avall)
        arrow(ctx, p.x + (dx * len) / 2, p.y + (dy * len) / 2, dx, dy, len, '#c2410c', true);
      }
    }
  }
  map.on('moveend zoomend resize', drawWind);
  map.on('zoomstart', () => { wcv.style.opacity = '0'; });
  map.on('zoomend', () => { wcv.style.opacity = '1'; });
  if (WIND) {
    seg('[data-wind]', 'wind', (v) => { st.windModel = v === 'model' || v === 'tots'; st.windObs = v === 'mesurat' || v === 'tots'; drawWind(); });
    $('rConv').addEventListener('change', (e) => { st.conv = e.target.checked; drawWind(); });
    loadWind();
    // L'AROME-PI dona una previsió cada 15 minuts: es torna a demanar cada 5 (la resposta es guarda 5 minuts)
    setInterval(loadWind, 5 * 60e3);
  }

  loadAll();

  // Estat per fer la imatge per a xarxes (descàrrega)
  return {
    map,
    snapshot() {
      const f = st.frames[st.i];
      if (!f) return null;
      let raster = null;
      if (st.cors && !f.raw) {
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        c.getContext('2d').drawImage(cv, 0, 0);
        raster = { canvas: c, bounds: RADAR_BOUNDS, alpha: Math.min(1, st.opacity + 0.05), crisp: st.crisp };
      }
      const v = VARS[st.stVar];
      const pri = (s) => (s.mc ? 1e5 : 0) + s[st.stVar];
      const labels = v ? stations.filter((s) => s[st.stVar] != null).sort((a, b) => pri(b) - pri(a)).map((s) => {
        const bg = v.color(s[st.stVar]);
        return { lat: s.lat, lng: s.lng, mc: !!s.mc, text: v.fmt(s[st.stVar]), bg, fg: ink(bg), dim: (st.stVar === 'rain' || st.stVar === 'rain1h') && s[st.stVar] < 0.1 };
      }) : [];
      const vb = map.getBounds();
      return {
        when: f.date,
        prod: st.prod,
        pal: st.pal,
        raster,
        stations: labels,
        comarques,
        wind: st.windModel && grid ? { sample, len: arrowLen } : null,
        windObs: st.windObs ? stations.filter((s) => s.wind != null && s.dir != null && s.wind >= 1).map((s) => ({ lat: s.lat, lng: s.lng, ms: s.wind / 3.6, dir: s.dir })) : null,
        conv: grid && st.conv ? lines : null,
        windRun: grid ? { run: grid.run, valid: grid.valid, model: grid.model || 'AROME', kind: grid.kind } : null,
        view: { lat0: vb.getSouth(), lat1: vb.getNorth(), lng0: vb.getWest(), lng1: vb.getEast() },
        stVar: st.stVar,
      };
    },
  };
}
