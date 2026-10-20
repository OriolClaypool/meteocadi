// Mapes de previsió del model AROME de Météo-France (0,025°, uns 2,5 km; Licence Ouverte 2.0): hora a hora, les
// pròximes hores (fins a 42-48 segons la passada), per a /mapa/previsio. Mateixa clau (METEOFRANCE_API_KEY) i mateix
// servei WCS que el vent (api/vent.js, que ja funciona amb GetCoverage en GeoTIFF i el temps en ISO); aquí també es fa
// servir GetCapabilities (quines variables i passades hi ha) i DescribeCoverage (fins a quina hora arriba la passada).
//
// Els noms de les variables surten de la documentació de Météo-France i de clients de codi obert (meteole, de MAIF):
// es busquen a GetCapabilities i les que no hi siguin no surten. La llista (/api/capes/arome) diu quins indicadors ha
// trobat (ind) i què ha fallat (tried), per ajustar-ho si cal: el 20/10/2026 no es podia provar amb el servei de debò
// (la clau només és a Vercel i des de l'entorn de proves no s'hi arriba).
import { fromArrayBuffer } from 'geotiff';
import { palettePng } from './_png.js';
import { mercGrid } from './_merc.js';
import { TSTOP, RSTOP, WSTOP, ramp } from '../src/lib/escales.js';

const API = 'https://public-api.meteofrance.fr/public/arome/1.0/wcs/MF-NWP-HIGHRES-AROME-0025-FRANCE-WCS';
// Imatges a la resolució del zoom 7 (uns 900 m per píxel): el model fa 2,5 km i el navegador ja les suavitza
const G = mercGrid(7);
export const AW = G.w, AH = G.h, ABOUNDS = G.bounds;
const BOX = { lat0: 39.9, lat1: 43.4, lng0: -1.2, lng1: 4.6 };
const MIN = 60e3, HOUR = 60 * MIN;

// ------------------------------------------------------------------ escales (paletes dels PNG)
// Neu (cm en una hora, aprox.): de blau cel a lila
const NSTOP = [[0.2, 200, 230, 255], [0.5, 150, 205, 250], [1, 95, 170, 240], [2, 50, 125, 225], [3, 35, 85, 200], [5, 95, 60, 190], [8, 145, 45, 170], [12, 195, 40, 150], [20, 235, 70, 140]];
// Cota (m): de lila (baixa) a groc i vermell (alta)
const CSTOP = [[0, 110, 40, 150], [500, 75, 70, 200], [1000, 40, 120, 220], [1500, 20, 175, 170], [2000, 90, 195, 80], [2500, 210, 200, 40], [3000, 245, 140, 30], [3500, 225, 60, 40], [4000, 160, 30, 50]];
// Cada escala: llindars (bins) i el color de cada un. Índex 0 de la paleta: transparent (sense dada o per sota del
// mínim); i + 1: el bin i, del llindar i fins al següent.
function grad(stops, from, to, step) {
  const bins = [];
  for (let v = from; v <= to + 1e-9; v += step) bins.push(Math.round(v * 100) / 100);
  return { bins, colors: bins.map((v) => ramp(stops, v + step / 2).slice(1, 4)) };
}
const steps = (stops) => ({ bins: stops.map((s) => s[0]), colors: stops.map((s) => s.slice(1, 4)) });
const SCALES = {
  temp: grad(TSTOP, -25, 44, 1),
  wind: grad(WSTOP, 0, 150, 5),
  rain: steps(RSTOP.filter((s) => s[0] <= 150)),
  snow: steps(NSTOP),
  alt: grad(CSTOP, 0, 4000, 100),
};
const legendOf = (sc) => sc.bins.map((b, i) => [b, `#${sc.colors[i].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`]);

// ------------------------------------------------------------------ variables
// find: indicadors candidats per ordre; interval: el període preferit ('' instantani, 'PT1H' acumulat en una hora);
// height: nivell en metres (si l'indicador en té); conv: canvi d'unitats
export const VARS = [
  { key: 'temp', label: 'Temperatura', unit: '°C', find: [/^TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND$/], interval: '', height: 2, conv: 'kelvin', scale: 'temp', min: -Infinity },
  { key: 'pluja', label: 'Pluja', unit: 'mm/h', find: [/^TOTAL_WATER_PRECIPITATION__GROUND_OR_WATER_SURFACE$/, /^TOTAL_PRECIPITATION__GROUND_OR_WATER_SURFACE$/, /^TOTAL_(WATER_)?PRECIPITATION/], interval: 'PT1H', scale: 'rain', min: 0.1 },
  { key: 'neu', label: 'Neu', unit: 'cm/h', find: [/^TOTAL_SNOW_PRECIPITATION__GROUND_OR_WATER_SURFACE$/, /^SNOW_PRECIPITATION__GROUND_OR_WATER_SURFACE$/, /SNOW.*PRECIPITATION/, /SNOW_?FALL/], interval: 'PT1H', conv: 'snow', scale: 'snow', min: 0.2 },
  { key: 'vent', label: 'Vent', unit: 'km/h', find: [/^WIND_SPEED__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND$/], interval: '', height: 10, conv: 'kmh', scale: 'wind', min: -Infinity },
  { key: 'ratxa', label: 'Ratxes', unit: 'km/h', find: [/^WIND_SPEED_GUST__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND$/, /^WIND_SPEED_GUST/, /^WIND_GUST/], interval: 'PT1H', height: 10, conv: 'kmh', scale: 'wind', min: -Infinity },
  { key: 'cota', label: 'Cota de neu', unit: 'm', find: [/SNOW_?LEVEL/, /ISO.*WET_?BULB/, /WET_?BULB.*(ZERO|0_DEGREE|273)/, /ISO_?(0|ZERO)\b/, /(0|ZERO)_?DEGREE.*ISOTHERM|ISOTHERM.*(0|ZERO)/, /FREEZING_LEVEL/], interval: '', conv: 'alt', scale: 'alt', min: -Infinity },
];
export const VAR = Object.fromEntries(VARS.map((v) => [v.key, v]));

// ------------------------------------------------------------------ servei
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const iso = (d) => `${ymd(d)}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00Z`;
const runId = (d) => `${ymd(d)}T${pad(d.getUTCHours())}.00.00Z`;
// 'AAAAMMDDHH' (UTC)
export const hstamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}`;
export const fromHstamp = (t) => new Date(Date.UTC(+t.slice(0, 4), +t.slice(4, 6) - 1, +t.slice(6, 8), +t.slice(8, 10)));
const key = () => (process.env.METEOFRANCE_API_KEY || '').trim();

async function wcs(op, params, ms = 10000) {
  const qs = new URLSearchParams({ service: 'WCS', version: '2.0.1', ...params.base });
  for (const s of params.subset || []) qs.append('subset', s);
  const r = await fetch(`${API}/${op}?${qs}`, { headers: { apikey: key() }, signal: AbortSignal.timeout(ms) });
  return r;
}

// Durada ISO 8601 (PT1H, PT3H, P1D, P2D…) en hores
const hoursOf = (p) => {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(p || '');
  return m ? (+(m[1] || 0)) * 24 + (+(m[2] || 0)) + (+(m[3] || 0)) / 60 : Infinity;
};
// 'IND___2026-10-20T06.00.00Z_PT1H' → { ind, run (Date), interval }
function parseId(id) {
  const m = /^(.+?)___(\d{4})-(\d{2})-(\d{2})T(\d{2})\.(\d{2})\.(\d{2})Z(?:_(P[0-9A-Z]+))?$/.exec(id);
  if (!m) return null;
  return { id, ind: m[1], run: new Date(Date.UTC(+m[2], +m[3] - 1, +m[4], +m[5], +m[6], +m[7])), interval: m[8] || '' };
}

// Totes les cobertures (memòria de 15 minuts)
let caps = null;
async function capabilities(tried) {
  if (caps && Date.now() - caps.at < 15 * MIN) return caps.list;
  const r = await wcs('GetCapabilities', { base: { language: 'eng' } }, 12000);
  const text = await r.text();
  if (!r.ok) {
    tried?.push({ op: 'GetCapabilities', status: r.status, text: text.replace(/\s+/g, ' ').slice(0, 200) });
    throw new Error(`GetCapabilities: HTTP ${r.status}`);
  }
  const list = [...text.matchAll(/<(?:wcs:)?CoverageId>([^<]+)<\/(?:wcs:)?CoverageId>/g)].map((m) => parseId(m[1].trim())).filter(Boolean);
  if (!list.length) throw new Error(`GetCapabilities sense cobertures: ${text.replace(/\s+/g, ' ').slice(0, 160)}`);
  caps = { at: Date.now(), list };
  return list;
}

// Les 3 passades més noves (les que l'índex pot fer servir)
const newestRuns = (list) => [...new Set(list.filter((c) => VAR.temp.find[0].test(c.ind)).map((c) => c.run.getTime()))].sort((a, b) => b - a).slice(0, 3);

// Per a cada variable, l'indicador i el període que es fan servir (dins d'una passada)
function choose(list, run) {
  const inRun = list.filter((c) => c.run.getTime() === run.getTime());
  const out = {};
  for (const v of VARS) {
    for (const re of v.find) {
      const cands = inRun.filter((c) => re.test(c.ind));
      if (!cands.length) continue;
      const ind = cands[0].ind;
      const ints = [...new Set(cands.filter((c) => c.ind === ind).map((c) => c.interval))];
      // El període preferit; si no hi és, l'instantani o el més curt
      const interval = ints.includes(v.interval) ? v.interval : ints.includes('') ? '' : ints.sort((a, b) => hoursOf(a) - hoursOf(b))[0];
      // Acumulats de més de 3 hores no serveixen per a un mapa hora a hora; i la pluja i la neu (mm/h, cm/h), només d'una
      // hora: un acumulat de 3 hores amb la llegenda per hora triplicaria la intensitat
      if (interval && hoursOf(interval) > (v.unit.endsWith('/h') ? 1 : 3)) continue;
      out[v.key] = { ind, interval, id: `${ind}___${runId(run)}${interval ? `_${interval}` : ''}` };
      break;
    }
  }
  return out;
}

// Hores (segons des de la passada) i alçades d'una cobertura (memòria per id: una passada no canvia)
const described = new Map();
async function describe(id, tried) {
  if (described.has(id)) return described.get(id);
  const r = await wcs('DescribeCoverage', { base: { coverageid: id } }, 8000);
  const text = await r.text();
  if (!r.ok) {
    tried?.push({ op: 'DescribeCoverage', id, status: r.status, text: text.replace(/\s+/g, ' ').slice(0, 200) });
    return null;
  }
  const axis = (name) => {
    for (const m of text.matchAll(/<(?:gmlrgrid:)?GeneralGridAxis>([\s\S]*?)<\/(?:gmlrgrid:)?GeneralGridAxis>/g)) {
      if (!new RegExp(`<(?:gmlrgrid:)?gridAxesSpanned>\\s*${name}\\s*<`).test(m[1])) continue;
      const c = /<(?:gmlrgrid:)?coefficients>([^<]*)<\/(?:gmlrgrid:)?coefficients>/.exec(m[1]);
      return c ? c[1].trim().split(/\s+/).map(Number).filter(Number.isFinite) : [];
    }
    return [];
  };
  const d = { times: axis('time'), heights: axis('height') };
  described.set(id, d);
  if (described.size > 200) described.delete(described.keys().next().value);
  return d;
}

// La passada més nova que ja arriba prou lluny (12 hores com a mínim) i les variables que hi ha
export async function aromeIndex(now = new Date()) {
  const tried = [];
  if (!key()) return { error: 'no-key', message: 'Falta la clau METEOFRANCE_API_KEY a Vercel.' };
  try {
    const list = await capabilities(tried);
    const runs = newestRuns(list);
    for (const t of runs) {
      const run = new Date(t);
      const pick = choose(list, run);
      if (!pick.temp) continue;
      const d = await describe(pick.temp.id, tried);
      if (!d || d.times.length < 12) {
        tried.push({ run: iso(run), times: d?.times.length ?? null });
        continue;
      }
      // Les hores que encara no han passat (des de l'hora en punt d'ara), com a molt 48
      const from = Math.floor(now.getTime() / HOUR) * HOUR;
      const times = d.times.map((s) => t + s * 1000).filter((v) => v >= from).slice(0, 48);
      const vars = VARS.filter((v) => pick[v.key]).map((v) => ({ key: v.key, label: v.label, unit: v.unit, ind: pick[v.key].ind, interval: pick[v.key].interval, min: Number.isFinite(v.min) ? v.min : null, legend: legendOf(SCALES[v.scale]) }));
      return {
        model: 'AROME',
        run: iso(run),
        source: 'Model AROME de Météo-France (Licence Ouverte 2.0)',
        bounds: ABOUNDS,
        size: [AW, AH],
        vars,
        // Imatge: /api/capes/arome-<variable>-<r>-<t>
        r: hstamp(run),
        times: times.map((v) => ({ t: hstamp(new Date(v)), time: new Date(v).toISOString() })),
        tried: tried.length ? tried : undefined,
        indicators: [...new Set(list.map((c) => c.ind))].sort(),
      };
    }
    return { error: 'arome', message: 'cap passada amb prou hores', tried, indicators: [...new Set(list.map((c) => c.ind))].sort() };
  } catch (e) {
    return { error: 'arome', message: String(e), tried };
  }
}

// Una imatge: variable k, passada run (Date), hora valid (Date) → { png, min, max } o null si no hi és
export async function aromeImage(k, run, valid) {
  const v = Object.hasOwn(VAR, k) ? VAR[k] : null;
  if (!v || !key()) return null;
  const list = await capabilities();
  // Només les passades més noves (cada adreça vàlida costa una crida a Météo-France: així n'hi ha poques)
  if (!newestRuns(list).includes(run.getTime())) return null;
  const pick = choose(list, run)[k];
  if (!pick) return null;
  const subset = [`time(${iso(valid)})`, `lat(${BOX.lat0},${BOX.lat1})`, `long(${BOX.lng0},${BOX.lng1})`];
  // I només les hores que té la cobertura
  const d = await describe(pick.id);
  if (d?.times.length && !d.times.includes((valid.getTime() - run.getTime()) / 1000)) return null;
  if (v.height != null) {
    // Si la cobertura no té aquesta alçada, la primera que tingui
    const hs = d?.heights || [];
    if (!hs.length || hs.includes(v.height)) subset.push(`height(${v.height})`);
    else subset.push(`height(${hs[0]})`);
  }
  const r = await wcs('GetCoverage', { base: { coverageid: pick.id, format: 'image/tiff' }, subset }, 12000);
  if (r.status === 404) return null;
  const buf = await r.arrayBuffer();
  if (!r.ok) throw new Error(`GetCoverage ${pick.id} ${iso(valid)}: HTTP ${r.status} ${new TextDecoder().decode(buf.slice(0, 200)).replace(/\s+/g, ' ')}`);
  let img, data;
  try {
    img = await (await fromArrayBuffer(buf)).getImage();
    [data] = await img.readRasters();
  } catch (e) {
    throw new Error(`no és un GeoTIFF (${String(e).slice(0, 100)}): ${new TextDecoder().decode(buf.slice(0, 160))}`);
  }
  return render(v, data, img.getWidth(), img.getHeight(), img.getBoundingBox());
}

// Graella del model (fila 0 al nord) → PNG de paleta en Web Mercator, amb interpolació bilineal
export function render(v, data, w, h, bbox) {
  const [x0, y0, x1, y1] = bbox;
  const dx = (x1 - x0) / w, dy = (y1 - y0) / h;
  // Unitats
  let off = 0, mul = 1;
  if (v.conv === 'kelvin') {
    let s = 0, n = 0;
    for (let i = 0; i < data.length; i += 7) if (Number.isFinite(data[i]) && Math.abs(data[i]) < 1e5) { s += data[i]; n++; }
    if (n && s / n > 150) off = -273.15;
  } else if (v.conv === 'kmh') mul = 3.6;
  // neu: kg/m² d'aigua → cm de neu (densitat de 100 kg/m³, aproximat); alt i la resta, tal qual
  const val = (c, r) => {
    if (c < 0 || r < 0 || c >= w || r >= h) return NaN;
    const x = data[r * w + c];
    return Number.isFinite(x) && Math.abs(x) < 1e5 ? x * mul + off : NaN;
  };
  const sc = SCALES[v.scale];
  const bins = sc.bins;
  // Índex de la paleta: 0 per sota del mínim (pluja i neu: transparent); per sota del primer llindar, el primer color
  const idxOf = (x) => {
    if (x < v.min) return 0;
    if (x < bins[0]) return 1;
    let lo = 0, hi = bins.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (bins[mid] <= x) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  const out = new Uint8Array(AW * AH);
  let mn = Infinity, mx = -Infinity;
  for (let j = 0; j < AH; j++) {
    const fy = (y1 - G.rowLat[j]) / dy - 0.5;
    const r = Math.floor(fy), ty = fy - r;
    for (let i = 0; i < AW; i++) {
      const fx = (G.colLng[i] - x0) / dx - 0.5;
      const c = Math.floor(fx), tx = fx - c;
      const a = val(c, r), b = val(c + 1, r), d = val(c, r + 1), e = val(c + 1, r + 1);
      let x;
      if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(d) || Number.isNaN(e)) x = val(Math.round(fx), Math.round(fy));
      else x = (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
      if (Number.isNaN(x)) continue;
      if (x < mn) mn = x;
      if (x > mx) mx = x;
      out[j * AW + i] = idxOf(x);
    }
  }
  const palette = [[0, 0, 0, 0], ...sc.colors.map((c) => [...c.map(Math.round), 255])];
  return { png: palettePng(AW, AH, out, palette), min: Number.isFinite(mn) ? Math.round(mn * 10) / 10 : null, max: Number.isFinite(mx) ? Math.round(mx * 10) / 10 : null };
}

export const _resetCache = () => { caps = null; described.clear(); };
