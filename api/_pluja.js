// Pluja d'una hora segons el radar (OPERA, producte ACRR: acumulació d'una hora, 2 km, una cada 15 minuts; el nom del
// fitxer porta l'hora del final), passada a la graella del mapa de color de Catalunya (src/scripts/camp.js: FB, 340 ×
// 290 punts en Web Mercator). El mapa en suma les hores d'avui i les ajusta amb els pluviòmetres (fusió condicional,
// vegeu computeField): el radar dona la forma de la pluja entre estacions i les estacions, la quantitat.
//
// Mateixa projecció i convenció que la reflectivitat (api/_opera.js); la mida del píxel surt de l'amplada del fitxer
// (1900 × 2200 per a 2 km). NaN: el radar hi veu i no hi ha pluja (0 mm); -9999000: fora de l'abast (sense dades).
// NO PROVAT encara amb els fitxers ACRR de debò (20/10/2026): /api/capes/pluja-… diu la mida i el màxim que llegeix.
import { deflateRawSync } from 'node:zlib';
import { fromUrl } from 'geotiff';
import { laea, fileUrl } from './_opera.js';

// La graella del mapa de color (ha de ser la mateixa que camp.js)
const FB = { lat0: 40.48, lat1: 42.9, lng0: 0.12, lng1: 3.36 };
export const FW = 340, FH = 290;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const Y0 = mercY(FB.lat1), Y1 = mercY(FB.lat0);
const rowLat = (py) => ((2 * Math.atan(Math.exp(Y0 + ((py + 0.5) / FH) * (Y1 - Y0))) - Math.PI / 2) * 180) / Math.PI;
const colLng = (px) => FB.lng0 + ((px + 0.5) / FW) * (FB.lng1 - FB.lng0);
const EXT_X = 3800000, EXT_Y = 4400000, NODATA = -9999000;

// Posició de cada punt de la graella a la graella del radar (centres als enters) per a una mida de píxel, i la finestra
const geoms = new Map();
function geom(px) {
  if (geoms.has(px)) return geoms.get(px);
  const fx = new Float32Array(FW * FH), fy = new Float32Array(FW * FH);
  let c0 = Infinity, r0 = Infinity, c1 = -Infinity, r1 = -Infinity;
  for (let j = 0; j < FH; j++) {
    const lat = rowLat(j);
    for (let i = 0; i < FW; i++) {
      const [x, y] = laea(lat, colLng(i));
      const c = x / px - 0.5, r = -y / px - 0.5;
      fx[j * FW + i] = c;
      fy[j * FW + i] = r;
      c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r);
    }
  }
  const win = [Math.floor(c0) - 1, Math.floor(r0) - 1, Math.ceil(c1) + 2, Math.ceil(r1) + 2];
  for (let p = 0; p < fx.length; p++) { fx[p] -= win[0]; fy[p] -= win[1]; }
  const g = { fx, fy, win, ww: win[2] - win[0], wh: win[3] - win[1] };
  geoms.set(px, g);
  return g;
}

async function readAcc(t) {
  let img;
  try {
    img = await (await fromUrl(fileUrl(t, 'ACRR'))).getImage(0);
  } catch (e) {
    const h = await fetch(fileUrl(t, 'ACRR'), { method: 'HEAD', signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (h && (h.status === 404 || h.status === 403)) return null;
    throw e;
  }
  const w = img.getWidth(), hgt = img.getHeight();
  const px = EXT_X / w;
  if (Math.abs(EXT_Y / hgt - px) > 1) throw new Error(`graella inesperada: ${w} × ${hgt}`);
  const g = geom(px);
  const [data] = await img.readRasters({ window: g.win, samples: [0] });
  return { data, g, w, h: hgt };
}
let reader = readAcc;
export const _setAccReader = (fn) => { reader = fn || readAcc; };
export const _accGeom = (px) => geom(px);

// Una hora ('AAAAMMDDHHMM', l'hora del final, en punt) → { w, h, data (base64 de deflate-raw, Uint16 en dècimes de mm,
// 65535 = sense dades), cover, max, grid } o null si el fitxer no hi és
export async function accHour(t) {
  const got = await reader(t);
  if (!got) return null;
  const { data, g } = got;
  const val = (c, r) => {
    if (c < 0 || r < 0 || c >= g.ww || r >= g.wh) return NaN;
    const v = data[r * g.ww + c];
    return Number.isNaN(v) ? 0 : v <= NODATA || v < 0 ? NaN : v;
  };
  const out = new Uint16Array(FW * FH);
  let seen = 0, max = 0;
  for (let p = 0; p < out.length; p++) {
    const x = g.fx[p], y = g.fy[p];
    const c = Math.floor(x), r = Math.floor(y), tx = x - c, ty = y - r;
    const a = val(c, r), b = val(c + 1, r), d = val(c, r + 1), e = val(c + 1, r + 1);
    let v;
    if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(d) || Number.isNaN(e)) v = val(Math.round(x), Math.round(y));
    else v = (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
    if (Number.isNaN(v)) { out[p] = 65535; continue; }
    seen++;
    if (v > max) max = v;
    out[p] = Math.min(65534, Math.round(v * 10));
  }
  const bytes = Buffer.from(out.buffer, out.byteOffset, out.byteLength);
  return { w: FW, h: FH, cover: Math.round((seen / out.length) * 1000) / 1000, max: Math.round(max * 10) / 10, src: [got.w, got.h], data: deflateRawSync(bytes, { level: 9 }).toString('base64') };
}
