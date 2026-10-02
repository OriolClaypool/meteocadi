// Vent a 10 m del model AROME de Météo-France (0,025°, dades obertes amb la Licence Ouverte 2.0) sobre Catalunya
// i voltants, per a l'hora en curs. Es demanen les components U i V a l'API WCS de Météo-France (GeoTIFF) i es
// tornen en la mateixa graella de 0,025° (valors en dècimes de m/s). Ús intern: /estudi/radar (fletxes i convergències).
//
// Cal la clau de l'API de Météo-France (portail-api.meteofrance.fr, API "AROME") a la variable METEOFRANCE_API_KEY.
// Les passades de l'AROME surten cada 3 hores (00, 03, 06… UTC) i triguen unes hores a estar disponibles: es prova
// la més recent i, si encara no hi és, les anteriors. Si no en surt cap, la resposta diu què ha fallat (sense la clau).
import { fromArrayBuffer } from 'geotiff';
import { onlyCleanUrl } from './_net.js';

const BASE = 'https://public-api.meteofrance.fr/public/arome/1.0/wcs/MF-NWP-HIGHRES-AROME-0025-FRANCE-WCS/GetCoverage';
// Catalunya i el seu entorn (mar, Aragó, sud de França), com la zona del radar
const BOX = { lat0: 39.9, lat1: 43.4, lng0: -1.2, lng1: 4.6 };
const H = 3600e3;

const pad = (n) => String(n).padStart(2, '0');
const ymdh = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}`;
const runId = (d) => `${ymdh(d)}.00.00Z`; // format de l'API: 2026-10-02T06.00.00Z
const iso = (d) => `${ymdh(d)}:00:00Z`;
const coverageId = (comp, run) => `${comp}_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND___${runId(run)}`;

async function coverage(comp, run, valid, key) {
  const qs = [
    'service=WCS',
    'version=2.0.1',
    `coverageid=${coverageId(comp, run)}`,
    'format=image/tiff',
    `subset=time(${iso(valid)})`,
    `subset=lat(${BOX.lat0},${BOX.lat1})`,
    `subset=long(${BOX.lng0},${BOX.lng1})`,
    'subset=height(10)',
  ].join('&');
  const r = await fetch(`${BASE}?${qs}`, { headers: { apikey: key, Accept: 'image/tiff' }, signal: AbortSignal.timeout(8000) });
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

// En dècimes de m/s (k > 1: mitjana de blocs de k × k). Els valors absurds (sense dades) queden com a null.
function shrink(c, k = 1) {
  const nx = Math.floor(c.w / k), ny = Math.floor(c.h / k);
  const out = new Array(nx * ny);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      let s = 0, n = 0;
      for (let dj = 0; dj < k; dj++)
        for (let di = 0; di < k; di++) {
          const v = c.data[(j * k + dj) * c.w + i * k + di];
          if (Number.isFinite(v) && Math.abs(v) < 150) { s += v; n++; }
        }
      out[j * nx + i] = n ? Math.round((s / n) * 10) : null;
    }
  return { nx, ny, out };
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
  const now = new Date();
  const valid = new Date(Math.floor(now.getTime() / H) * H);
  if (memo && memo.valid === iso(valid) && Date.now() - memo.at < 30 * 60e3) {
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
    res.status(200).json(memo.body);
    return;
  }
  const tried = [];
  try {
    // De la passada més recent cap enrere (cada 3 hores), fins que n'hi hagi una de disponible
    const last = new Date(Math.floor(now.getTime() / (3 * H)) * 3 * H);
    for (let k = 0; k < 4; k++) {
      const run = new Date(last.getTime() - k * 3 * H);
      const u = await coverage('U', run, valid, key);
      tried.push({ run: iso(run), status: u.ok ? 200 : u.status, text: u.ok ? undefined : u.text });
      if (!u.ok) continue;
      const v = await coverage('V', run, valid, key);
      if (!v.ok) { tried.push({ run: iso(run), comp: 'V', status: v.status, text: v.text }); continue; }
      const U = shrink(u), V = shrink(v);
      const [x0, y0, x1, y1] = u.bbox;
      const dx = (x1 - x0) / u.w, dy = (y1 - y0) / u.h;
      const body = {
        updated: now.toISOString(),
        run: iso(run),
        valid: iso(valid),
        source: 'Model AROME de Météo-France (Licence Ouverte 2.0)',
        // Graella: fila 0 al nord, columna 0 a l'oest; valors al centre de cada cel·la, en dècimes de m/s
        lat1: y1,
        lat0: y1 - U.ny * dy,
        lng0: x0,
        lng1: x0 + U.nx * dx,
        nx: U.nx,
        ny: U.ny,
        u: U.out,
        v: V.out,
      };
      memo = { at: Date.now(), valid: iso(valid), body };
      res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
      res.status(200).json(body);
      return;
    }
    throw new Error('cap passada disponible');
  } catch (e) {
    console.error('[vent]', String(e), JSON.stringify(tried));
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    res.status(200).json({ error: 'arome', message: String(e), tried });
  }
}
