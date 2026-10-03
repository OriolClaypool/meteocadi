// Vent a 10 m de Météo-France sobre Catalunya i voltants (dades obertes amb la Licence Ouverte 2.0), en una graella
// de 0,025° (valors en dècimes de m/s). Ús intern: /estudi/radar (fletxes i línies de convergència).
//
// 1. AROME-PI ("prévision immédiate"): una passada nova cada hora i una previsió cada 15 minuts, per seguir el radar
//    tan de prop com es pot. Cal estar subscrit a l'API "AROME-PI" al portal de Météo-France. Segons el que ofereixi,
//    s'agafa el vent mitjà o, si no n'hi ha, la ratxa de cada 15 minuts (la direcció és la mateixa).
// 2. Si l'AROME-PI no respon (sense subscripció, encara no publicada…), el model AROME de sempre: una passada cada
//    3 hores (00, 03, 06… UTC) amb una previsió per a cada hora.
// Cal la clau del portal (portail-api.meteofrance.fr) a la variable METEOFRANCE_API_KEY. Si no en surt cap, la
// resposta diu què s'ha provat i què ha fallat (sense la clau).
import { fromArrayBuffer } from 'geotiff';
import { onlyCleanUrl } from './_net.js';

const API = 'https://public-api.meteofrance.fr/public';
const AROME = `${API}/arome/1.0/wcs/MF-NWP-HIGHRES-AROME-0025-FRANCE-WCS/GetCoverage`;
const AROMEPI = `${API}/aromepi/1.0/wcs/MF-NWP-HIGHRES-AROMEPI-0025-FRANCE-WCS/GetCoverage`;
// Catalunya i el seu entorn (mar, Aragó, sud de França), com la zona del radar
const BOX = { lat0: 39.9, lat1: 43.4, lng0: -1.2, lng1: 4.6 };
const MIN = 60e3, H = 60 * MIN;
// Capes de vent de l'AROME-PI, per ordre de preferència: vent mitjà i, si no n'hi ha, ratxa de 15 minuts
const PI_KINDS = [
  { kind: 'mean', id: (c) => `${c}_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND` },
  { kind: 'gust', id: (c) => `${c}_COMPONENT_OF_WIND_GUST_15MIN__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND` },
];

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const runId = (d) => `${ymd(d)}T${pad(d.getUTCHours())}.00.00Z`; // format de l'API: 2026-10-02T06.00.00Z
const iso = (d) => `${ymd(d)}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00Z`;
const floorTo = (t, step) => new Date(Math.floor(t / step) * step);

async function coverage(base, id, valid, key, ms) {
  const qs = [
    'service=WCS',
    'version=2.0.1',
    `coverageid=${id}`,
    'format=image/tiff',
    `subset=time(${iso(valid)})`,
    `subset=lat(${BOX.lat0},${BOX.lat1})`,
    `subset=long(${BOX.lng0},${BOX.lng1})`,
    'subset=height(10)',
  ].join('&');
  let r;
  try {
    r = await fetch(`${base}?${qs}`, { headers: { apikey: key, Accept: 'image/tiff' }, signal: AbortSignal.timeout(ms) });
  } catch (e) {
    return { ok: false, status: 0, text: String(e).slice(0, 120) };
  }
  if (!r.ok) return { ok: false, status: r.status, text: (await r.text()).replace(/\s+/g, ' ').slice(0, 240) };
  const buf = await r.arrayBuffer();
  try {
    const img = await (await fromArrayBuffer(buf)).getImage();
    const [data] = await img.readRasters();
    return { ok: true, w: img.getWidth(), h: img.getHeight(), bbox: img.getBoundingBox(), data };
  } catch (e) {
    return { ok: false, status: r.status, text: `no és un GeoTIFF (${String(e).slice(0, 120)}): ${new TextDecoder().decode(buf.slice(0, 160))}` };
  }
}

// En dècimes de m/s. Els valors absurds (sense dades) queden com a null.
function tenths(c) {
  const out = new Array(c.w * c.h);
  for (let i = 0; i < out.length; i++) {
    const v = c.data[i];
    out[i] = Number.isFinite(v) && Math.abs(v) < 150 ? Math.round(v * 10) : null;
  }
  return out;
}

function body(u, v, meta) {
  const [x0, , x1, y1] = u.bbox;
  const dx = (x1 - x0) / u.w, dy = (u.bbox[3] - u.bbox[1]) / u.h;
  return {
    updated: new Date().toISOString(),
    ...meta,
    source: `Model ${meta.model} de Météo-France (Licence Ouverte 2.0)`,
    // Graella: fila 0 al nord, columna 0 a l'oest; valors al centre de cada cel·la, en dècimes de m/s
    lat1: y1,
    lat0: y1 - u.h * dy,
    lng0: x0,
    lng1: x0 + u.w * dx,
    nx: u.w,
    ny: u.h,
    u: tenths(u),
    v: tenths(v),
  };
}

// AROME-PI: la passada més recent que ja inclogui l'hora demanada (cada passada arriba fins a 6 hores)
let piKind = null; // la capa que ha funcionat (no cal tornar a provar la que no hi és)
async function fromAromePi(valid, key, tried) {
  const last = floorTo(Date.now(), H);
  // Com a molt 12 segons i 6 peticions: si no surt, queda temps per a l'AROME
  const until = Date.now() + 12e3;
  let n = 0;
  for (let k = 0; k < 4; k++) {
    const run = new Date(last.getTime() - k * H);
    if (valid.getTime() <= run.getTime() || valid.getTime() > run.getTime() + 6 * H) continue;
    for (const pk of piKind ? [piKind] : PI_KINDS) {
      if (Date.now() > until || ++n > 6) return null;
      const u = await coverage(AROMEPI, `${pk.id('U')}___${runId(run)}`, valid, key, 6000);
      tried.push({ model: 'AROME-PI', kind: pk.kind, run: iso(run), status: u.ok ? 200 : u.status, text: u.ok ? undefined : u.text });
      // Sense permís (no hi ha subscripció a l'AROME-PI): directament a l'AROME
      if (u.status === 401 || u.status === 403) return null;
      if (!u.ok) continue;
      const v = await coverage(AROMEPI, `${pk.id('V')}___${runId(run)}`, valid, key, 6000);
      if (!v.ok) { tried.push({ model: 'AROME-PI', kind: pk.kind, comp: 'V', status: v.status, text: v.text }); continue; }
      piKind = pk;
      return body(u, v, { model: 'AROME-PI', kind: pk.kind, step: 15, run: iso(run), valid: iso(valid) });
    }
  }
  return null;
}

// AROME: passades cada 3 hores, previsió per a cada hora
async function fromArome(now, key, tried) {
  const valid = floorTo(now, H);
  const last = floorTo(now, 3 * H);
  for (let k = 0; k < 4; k++) {
    const run = new Date(last.getTime() - k * 3 * H);
    const id = (c) => `${c}_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND___${runId(run)}`;
    const u = await coverage(AROME, id('U'), valid, key, 8000);
    tried.push({ model: 'AROME', run: iso(run), status: u.ok ? 200 : u.status, text: u.ok ? undefined : u.text });
    if (!u.ok) continue;
    const v = await coverage(AROME, id('V'), valid, key, 8000);
    if (!v.ok) { tried.push({ model: 'AROME', run: iso(run), comp: 'V', status: v.status, text: v.text }); continue; }
    return body(u, v, { model: 'AROME', kind: 'mean', step: 60, run: iso(run), valid: iso(valid) });
  }
  return null;
}

let memo = null;

export default async function handler(req, res) {
  if (onlyCleanUrl(req, res, '/api/vent')) return;
  const key = (process.env.METEOFRANCE_API_KEY || '').trim();
  if (!key) {
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    res.status(200).json({ error: 'no-key', message: 'Falta la clau METEOFRANCE_API_KEY a Vercel.' });
    return;
  }
  const now = Date.now();
  // El quart d'hora en curs, amb 5 minuts de marge: és l'hora de les darreres imatges del radar
  const valid15 = floorTo(now - 5 * MIN, 15 * MIN);
  if (memo && memo.key === iso(valid15) && now - memo.at < 15 * MIN) {
    res.setHeader('Cache-Control', `public, s-maxage=${memo.body.step === 15 ? 300 : 900}, stale-while-revalidate=1800`);
    res.status(200).json(memo.body);
    return;
  }
  const tried = [];
  try {
    const out = (await fromAromePi(valid15, key, tried)) || (await fromArome(now, key, tried));
    if (!out) throw new Error('cap passada disponible');
    if (out.model === 'AROME') out.tried = tried.filter((t) => t.model === 'AROME-PI'); // per saber per què no hi ha l'AROME-PI
    memo = { at: now, key: iso(valid15), body: out };
    res.setHeader('Cache-Control', `public, s-maxage=${out.step === 15 ? 300 : 900}, stale-while-revalidate=1800`);
    res.status(200).json(out);
  } catch (e) {
    console.error('[vent]', String(e), JSON.stringify(tried));
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    res.status(200).json({ error: 'arome', message: String(e), tried });
  }
}
