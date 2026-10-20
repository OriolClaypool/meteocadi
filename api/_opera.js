// Radar de precipitació: la composició europea d'OPERA (EUMETNET), dades obertes amb llicència CC BY 4.0, al dipòsit
// públic s3.waw3-1.cloudferro.com/openradar-24h (les darreres 24 hores). Reflectivitat màxima (DBZH, producció
// "CIRRUS"): 1 km, una imatge cada 5 minuts que arriba uns 4 o 5 minuts després i ja no canvia. Hi entren els radars
// d'AEMET, de Météo-France i dels altres serveis europeus (els que hagin arribat a temps a cada imatge).
//
// Els fitxers són COG (GeoTIFF en tessel·les de 512 px, float32, dues bandes: dBZ i índex de qualitat): se'n llegeix
// només el tros de Catalunya i voltants amb peticions de rang (4 tessel·les, uns 100-300 kB).
// - NaN: el radar hi veu i no hi ha eco (sense precipitació)
// - -9999000: fora de l'abast dels radars (sense dades)
// Projecció: l'azimutal d'àrea igual de Lambert de la composició (+proj=laea +lat_0=55 +lon_0=10 +x_0=1950000
// +y_0=-2100000 +ellps=WGS84), 3800 × 4400 píxels d'1 km, amb la cantonada de dalt a l'esquerra a (0, 0) i les files
// cap al sud. El GeoTIFF la posa mig píxel desplaçada (-500, 500), com si les cantonades fossin centres: es fa servir
// la de l'ODIM, que encaixa al metre amb les cantonades de les metadades (comprovat amb pyproj el 20/10/2026).
//
// Sortida: PNG de paleta en Web Mercator (com els mapes de Leaflet) sobre la mateixa zona que el vent (/api/vent), a la
// resolució del nivell de zoom 8 (uns 450 m per píxel): la reflectivitat s'interpola entre els centres dels píxels
// d'1 km abans de passar-la a colors, i les vores queden suaus en lloc d'esglaonades.
import { createRequire } from 'node:module';
import { fromUrl } from 'geotiff';
import { palettePng } from './_png.js';

const require = createRequire(import.meta.url);
const CONTORN = require('../src/lib/catalunya-contorn.json');

const S3 = 'https://s3.waw3-1.cloudferro.com/openradar-24h';
const NX = 3800, NY = 4400, PX = 1000;
const NODATA = -9999000;

// Escala: 19 nivells cada 2,5 dBZ a partir de 10 dBZ i el blanc (calamarsa probable) a partir de 57 dBZ. Comparada
// píxel a píxel amb la del radar del Meteocat (20/10/2026, 10.25-10.30): cada color del Meteocat cau, de mitjana, al
// mateix nivell d'aquesta escala, i els colors són els de Meteocadí (src/scripts/radar-pal.js).
export const LEVELS = [10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50, 52.5, 57];
export const COLORS = ['#5aa5e6', '#3a86da', '#2566cb', '#1c49b5', '#0aa2cc', '#08b98f', '#16bf45', '#62c81a', '#b2d10c', '#f0cd00', '#f7a600', '#f57a00', '#ec4c0e', '#d62215', '#ad0f1f', '#cc1478', '#be12bd', '#8519d6', '#ffffff'];
// Fora de l'abast dels radars: un vel gris clar
const NOCOVER = [96, 108, 124, 70];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const PALETTE = [[0, 0, 0, 0], NOCOVER, ...COLORS.map((c) => [...hex(c), 255])];
// Els píxels sense eco valen això a l'hora d'interpolar: la vora d'un eco feble s'encongeix una mica i la d'un de fort
// s'eixampla una mica, com es veuria amb més resolució
const UNDETECT = 5;
const level = (v) => (!(v >= LEVELS[0]) ? 0 : v >= LEVELS[18] ? 20 : 2 + Math.min(17, Math.floor((v - LEVELS[0]) / 2.5)));

// ------------------------------------------------------------------ projeccions
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
// LAEA el·lipsoidal (Snyder, Map Projections: A Working Manual, p. 187-188)
const A = 6378137, FL = 1 / 298.257223563, E2 = FL * (2 - FL), E = Math.sqrt(E2);
const qf = (s) => (1 - E2) * (s / (1 - E2 * s * s) - (1 / (2 * E)) * Math.log((1 - E * s) / (1 + E * s)));
const QP = qf(1);
const RQ = A * Math.sqrt(QP / 2);
const LAT0 = rad(55), LNG0 = rad(10), FE = 1950000, FN = -2100000;
const B1 = Math.asin(qf(Math.sin(LAT0)) / QP);
const D = (A * (Math.cos(LAT0) / Math.sqrt(1 - E2 * Math.sin(LAT0) ** 2))) / (RQ * Math.cos(B1));
const SB1 = Math.sin(B1), CB1 = Math.cos(B1);
export function laea(lat, lng) {
  const b = Math.asin(qf(Math.sin(rad(lat))) / QP);
  const dl = rad(lng) - LNG0;
  const sb = Math.sin(b), cb = Math.cos(b), cdl = Math.cos(dl);
  const k = RQ * Math.sqrt(2 / (1 + SB1 * sb + CB1 * cb * cdl));
  return [FE + k * D * cb * Math.sin(dl), FN + (k / D) * (CB1 * sb - SB1 * cb * cdl)];
}

// Web Mercator al nivell de zoom 8
const Z = 8, WORLD = 256 * 2 ** Z;
const lngX = (lng) => ((lng + 180) / 360) * WORLD;
const latY = (lat) => ((1 - Math.log(Math.tan(Math.PI / 4 + rad(lat) / 2)) / Math.PI) / 2) * WORLD;
const xLng = (x) => (x / WORLD) * 360 - 180;
const yLat = (y) => deg(Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / WORLD))));
// La mateixa zona que el vent (api/vent.js): Catalunya, Andorra, el sud de França, l'Aragó i el mar
const BOX = { lat0: 39.9, lat1: 43.4, lng0: -1.2, lng1: 4.6 };
const OX = Math.floor(lngX(BOX.lng0)), OY = Math.floor(latY(BOX.lat1));
export const W = Math.ceil(lngX(BOX.lng1)) - OX, H = Math.ceil(latY(BOX.lat0)) - OY;
// Límits exactes de la imatge (per a L.imageOverlay): [[sud, oest], [nord, est]]
export const BOUNDS = [[yLat(OY + H), xLng(OX)], [yLat(OY), xLng(OX + W)]].map((p) => p.map((v) => Math.round(v * 1e6) / 1e6));

// Per a cada píxel de la sortida, la posició a la graella del radar (centres dels píxels als enters), la finestra que
// cal llegir del COG i la màscara de Catalunya (per saber si a la imatge hi falten radars i si plou a Catalunya)
let GEO = null;
function geo() {
  if (GEO) return GEO;
  const fx = new Float32Array(W * H), fy = new Float32Array(W * H);
  // Parts que només depenen de la fila (latitud) o de la columna (longitud)
  const cdl = new Float64Array(W), sdl = new Float64Array(W);
  for (let i = 0; i < W; i++) {
    const dl = rad(xLng(OX + i + 0.5)) - LNG0;
    cdl[i] = Math.cos(dl);
    sdl[i] = Math.sin(dl);
  }
  let c0 = Infinity, r0 = Infinity, c1 = -Infinity, r1 = -Infinity;
  for (let j = 0; j < H; j++) {
    const b = Math.asin(qf(Math.sin(rad(yLat(OY + j + 0.5)))) / QP);
    const sb = Math.sin(b), cb = Math.cos(b);
    for (let i = 0; i < W; i++) {
      const k = RQ * Math.sqrt(2 / (1 + SB1 * sb + CB1 * cb * cdl[i]));
      const x = FE + k * D * cb * sdl[i], y = FN + (k / D) * (CB1 * sb - SB1 * cb * cdl[i]);
      const c = x / PX - 0.5, r = -y / PX - 0.5;
      fx[j * W + i] = c;
      fy[j * W + i] = r;
      if (c < c0) c0 = c;
      if (c > c1) c1 = c;
      if (r < r0) r0 = r;
      if (r > r1) r1 = r;
    }
  }
  const win = [Math.max(0, Math.floor(c0) - 1), Math.max(0, Math.floor(r0) - 1), Math.min(NX, Math.ceil(c1) + 2), Math.min(NY, Math.ceil(r1) + 2)];
  for (let p = 0; p < fx.length; p++) {
    fx[p] -= win[0];
    fy[p] -= win[1];
  }
  // Màscara de Catalunya: emplenat per files (regla parell-senar) del contorn
  const mask = new Uint8Array(W * H);
  const rings = CONTORN.coordinates.map((poly) => poly[0].map(([lng, lat]) => [lngX(lng) - OX, latY(lat) - OY]));
  let inCat = 0;
  for (let j = 0; j < H; j++) {
    const y = j + 0.5;
    const xs = [];
    for (const ring of rings)
      for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
        const [xa, ya] = ring[a], [xb, yb] = ring[b];
        if (ya > y !== yb > y) xs.push(xa + ((y - ya) / (yb - ya)) * (xb - xa));
      }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let i = Math.max(0, Math.ceil(xs[k] - 0.5)); i < Math.min(W, xs[k + 1] - 0.5); i++) {
        mask[j * W + i] = 1;
        inCat++;
      }
  }
  GEO = { fx, fy, win, ww: win[2] - win[0], wh: win[3] - win[1], mask, inCat };
  return GEO;
}

// ------------------------------------------------------------------ fitxers
const pad = (n) => String(n).padStart(2, '0');
// 'AAAAMMDDHHMM' (UTC)
export const stamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
export const fromStamp = (t) => new Date(Date.UTC(+t.slice(0, 4), +t.slice(4, 6) - 1, +t.slice(6, 8), +t.slice(8, 10), +t.slice(10, 12)));
const dayDir = (t) => `${t.slice(0, 4)}/${t.slice(4, 6)}/${t.slice(6, 8)}/OPERA/COMP/`;
const fileUrl = (t) => `${S3}/${dayDir(t)}OPERA@${t.slice(0, 8)}T${t.slice(8, 12)}@0@DBZH.tiff`;

// Imatges DBZH disponibles a partir de 'since' (Date), de la més antiga a la més nova ('AAAAMMDDHHMM')
export async function listFrames(since, now = new Date()) {
  const days = [...new Set([stamp(since), stamp(now)].map((t) => t.slice(0, 8)))];
  const lists = await Promise.all(
    days.map(async (day) => {
      const prefix = dayDir(`${day}0000`);
      const after = `${prefix}OPERA@${day}T${stamp(since).slice(0, 8) === day ? stamp(since).slice(8) : '0000'}`;
      const qs = new URLSearchParams({ 'list-type': '2', prefix, 'start-after': after, 'max-keys': '1000' });
      const r = await fetch(`${S3}?${qs}`, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`llista ${day}: HTTP ${r.status}`);
      const xml = await r.text();
      return [...xml.matchAll(/<Key>[^<]*OPERA@(\d{8})T(\d{4})@0@DBZH\.tiff<\/Key>/g)].map((m) => m[1] + m[2]);
    }),
  );
  return [...new Set(lists.flat())].sort();
}

// Una imatge del radar ('AAAAMMDDHHMM') → { png, cover, rain, max, nodes } o null si el fitxer no hi és
// cover: part de Catalunya que veuen els radars (0-1); rain: part de Catalunya amb eco (≥ 10 dBZ); max: dBZ màxim a
// Catalunya (o null)
// Llegeix la finestra [c0, r0, c1, r1] de la banda de dBZ: { data (Float32Array), nodes } o null si no hi és
async function readCog(t, win) {
  let img;
  try {
    const tif = await fromUrl(fileUrl(t));
    img = await tif.getImage(0);
  } catch (e) {
    // Error genèric de geotiff: es mira si és que el fitxer no hi és
    const h = await fetch(fileUrl(t), { method: 'HEAD', signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (h && (h.status === 404 || h.status === 403)) return null;
    throw e;
  }
  if (img.getWidth() !== NX || img.getHeight() !== NY) throw new Error(`graella inesperada: ${img.getWidth()} × ${img.getHeight()}`);
  const [data] = await img.readRasters({ window: win, samples: [0] });
  const meta = img.getGDALMetadata?.() || {};
  return { data, nodes: String(meta.nodes || '').match(/[a-z]{5}/g)?.length ?? null };
}
let reader = readCog;
// Per a les proves: una altra font de dades (t, win) → { data, nodes }
export const _setReader = (fn) => { reader = fn || readCog; };
export const _geo = () => geo();

export async function radarFrame(t) {
  const g = geo();
  const got = await reader(t, g.win);
  if (!got) return null;
  const src = got.data;
  const { fx, fy, ww, wh, mask } = g;
  const out = new Uint8Array(W * H);
  // Valor d'un píxel de la font: dBZ, UNDETECT si no hi ha eco o NaN si és fora de l'abast
  const val = (c, r) => {
    if (c < 0 || r < 0 || c >= ww || r >= wh) return NaN;
    const v = src[r * ww + c];
    return Number.isNaN(v) ? UNDETECT : v <= NODATA ? NaN : v;
  };
  let seen = 0, wet = 0, max = -Infinity;
  for (let p = 0; p < out.length; p++) {
    const x = fx[p], y = fy[p];
    const c = Math.floor(x), r = Math.floor(y), tx = x - c, ty = y - r;
    const a = val(c, r), b = val(c + 1, r), d = val(c, r + 1), e = val(c + 1, r + 1);
    let v;
    if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(d) || Number.isNaN(e)) {
      // Vora de l'abast dels radars: el píxel més proper
      v = val(Math.round(x), Math.round(y));
      if (Number.isNaN(v)) {
        out[p] = 1;
        continue;
      }
    } else v = (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
    const k = level(v);
    out[p] = k;
    if (mask[p]) {
      seen++;
      if (k >= 2) {
        wet++;
        if (v > max) max = v;
      }
    }
  }
  return {
    png: palettePng(W, H, out, PALETTE),
    cover: seen / g.inCat,
    rain: wet / g.inCat,
    max: Number.isFinite(max) ? Math.round(max * 2) / 2 : null,
    nodes: got.nodes,
  };
}
