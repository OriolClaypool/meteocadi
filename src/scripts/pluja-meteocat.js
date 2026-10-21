// Estudi (/estudi/mapa, període "Última hora"): la pluja d'una hora segons el radar del Meteocat, a la graella del
// mapa de color (camp.js: FW × FH, mm; NaN on no se'n sap prou). El mapa la fa servir com la de l'OPERA (computeField,
// radar): les estacions donen la quantitat i el radar, la forma de la pluja entre estacions.
//
// Només a l'estudi (Oriol, 20/10/2026: "només a l'estudi aquestes coses"): el radar del Meteocat no es fa servir al web
// públic, i el seu servidor només en guarda les darreres 3 hores (provat el 20/10/2026 a les 22:56: la imatge més antiga
// era la de les 19:54), o sigui que no hi ha prou imatges per a avui, les 24 hores o els dies anteriors. Per a aquests
// períodes, l'OPERA (src/scripts/pluja-radar.js).
//
// Les imatges són les tessel·les del web del Meteocat (static-m.meteo.cat/tiles/radar, una cada 6 minuts, zoom 7, les
// mateixes del visor de l'estudi, src/scripts/radar.js). Per a la graella del mapa n'hi ha prou amb 2 × 2 (columnes 64 i
// 65, files 47 i 48). A cada imatge, el color de cada píxel dona el nivell de l'escala (19 nivells de 2,5 en 2,5 dBZ a
// partir de 10 dBZ: els mateixos que l'OPERA, api/_opera.js) i el nivell, la intensitat amb la relació de Marshall i
// Palmer (Z = 200 R^1,6) al mig del nivell, amb un sostre a 53 dBZ (uns 75 mm/h): per sobre sol ser calamarsa, que la
// relació sobreestimaria. Cada imatge compta per 6 minuts. Si en falta més d'una quarta part, no se'n dona res; si en
// falta alguna, la suma s'escala.
import { FW, FH, rowLat, colLng } from './camp.js';
import { PAL } from './radar-pal.js';

const TILES = 'https://static-m.meteo.cat/tiles/radar';
const Z = 7;
const X0 = 64, Y0 = 47, NT = 2; // 2 × 2 tessel·les a partir de la columna 64 i la fila 47 (XYZ)
const S = NT * 256; // costat del bloc, en píxels
const STEP = 6; // minuts entre imatges

const LEVELS = [10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50, 52.5, 57];
// mm que deixa cada nivell en una imatge (6 minuts)
export const MM = LEVELS.map((d) => ((10 ** (Math.min(53, d + 1.25) / 10) / 200) ** (1 / 1.6) * STEP) / 60);

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const RGB = PAL.meteocat.map(hex);

const pad = (n, l = 2) => String(n).padStart(l, '0');
function tileUrl(date, x, y) {
  const d = `${date.getUTCFullYear()}/${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}/${pad(date.getUTCHours())}/${pad(date.getUTCMinutes())}`;
  return `${TILES}/${d}/${pad(Z)}/000/000/${pad(x, 3)}/000/000/${pad(2 ** Z - 1 - y, 3)}.png`; // fila en format TMS
}

function loadImg(url) {
  return new Promise((res) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });
}

// Posició de cada punt de la graella del mapa al bloc de tessel·les (Web Mercator tots dos: només canvia l'escala)
let geo = null;
function geometry() {
  if (geo) return geo;
  const n = 2 ** Z * 256;
  const fx = new Float32Array(FW), fy = new Float32Array(FH);
  for (let i = 0; i < FW; i++) fx[i] = ((colLng(i) + 180) / 360) * n - X0 * 256 - 0.5;
  for (let j = 0; j < FH; j++) {
    const m = Math.log(Math.tan(Math.PI / 4 + (rowLat(j) * Math.PI) / 360));
    fy[j] = ((1 - m / Math.PI) / 2) * n - Y0 * 256 - 0.5;
  }
  return (geo = { fx, fy });
}

// Una imatge: suma els mm de cada píxel a acc i diu quines tessel·les hi ha (ok[b], b = fila × 2 + columna).
// Retorna 'cors' si no es poden llegir els píxels i 'odd' si els colors no són els de l'escala coneguda.
async function addFrame(date, acc, ok, ctx, memo) {
  const jobs = [];
  for (let ty = 0; ty < NT; ty++)
    for (let tx = 0; tx < NT; tx++)
      jobs.push(loadImg(tileUrl(date, X0 + tx, Y0 + ty)).then((img) => ({ img, tx, ty })));
  const tiles = await Promise.all(jobs);
  let painted = 0, far = 0;
  for (const { img, tx, ty } of tiles) {
    if (!img) continue;
    ctx.clearRect(0, 0, 256, 256);
    ctx.drawImage(img, 0, 0);
    let data;
    try {
      data = ctx.getImageData(0, 0, 256, 256).data;
    } catch {
      return 'cors';
    }
    ok[ty * NT + tx]++;
    for (let p = 0, q = 0; p < 65536; p++, q += 4) {
      if (data[q + 3] < 40) continue;
      painted++;
      const key = (data[q] << 16) | (data[q + 1] << 8) | data[q + 2];
      let k = memo.get(key);
      if (k === undefined) {
        let bd = Infinity;
        for (let c = 0; c < RGB.length; c++) {
          const dd = (data[q] - RGB[c][0]) ** 2 + (data[q + 1] - RGB[c][1]) ** 2 + (data[q + 2] - RGB[c][2]) ** 2;
          if (dd < bd) { bd = dd; k = c; }
        }
        if (bd > 3 * 45 * 45) k = -1 - k; // negatiu: lluny de qualsevol color de l'escala
        memo.set(key, k);
      }
      if (k < 0) { far++; k = -1 - k; }
      acc[(ty * 256 + (p >> 8)) * S + tx * 256 + (p & 255)] += MM[k];
    }
  }
  // Si molts píxels no s'assemblen a l'escala, el Meteocat deu haver canviat els colors
  return painted > 200 && far / painted > 0.2 ? 'odd' : null;
}

const cache = new Map();

// La pluja entre from i to (Date; imatges de després de from fins a to, inclosa): { grid, frames, expected, from, to }
// o null (falten imatges, el servidor no deixa llegir els píxels o els colors han canviat)
export function radarMeteocat(from, to) {
  const key = `${from.getTime()}|${to.getTime()}`;
  if (!cache.has(key)) {
    const p = sumFrames(from, to).catch((e) => { console.warn('[pluja-meteocat]', e); return null; });
    cache.set(key, p);
    // Un intent fallit es pot tornar a fer (potser encara no hi era la darrera imatge)
    p.then((r) => { if (!r) cache.delete(key); });
  }
  return cache.get(key);
}

async function sumFrames(from, to) {
  const step = STEP * 60e3;
  const dates = [];
  for (let t = Math.floor(from.getTime() / step) * step + step; t <= to.getTime(); t += step) dates.push(new Date(t));
  if (!dates.length) return null;
  const acc = new Float32Array(S * S);
  const ok = new Uint16Array(NT * NT);
  const memo = new Map();
  // De 3 en 3 imatges (12 tessel·les alhora), cadascuna amb el seu canvas
  const canvases = [0, 1, 2].map(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    return c.getContext('2d', { willReadFrequently: true });
  });
  for (let i = 0; i < dates.length; i += 3) {
    const got = await Promise.all(dates.slice(i, i + 3).map((d, k) => addFrame(d, acc, ok, canvases[k], memo)));
    const bad = got.find(Boolean);
    if (bad) {
      console.warn('[pluja-meteocat]', bad === 'cors' ? "el servidor no deixa llegir els píxels" : "els colors no són els de l'escala coneguda");
      return null;
    }
  }
  const expected = dates.length;
  const need = Math.ceil(expected * 0.75);
  if (Math.min(...ok) < need) return null;
  // Escala per les imatges que falten (per tessel·la) i passa a la graella del mapa (interpolació bilineal)
  const scale = Array.from(ok, (n) => expected / n);
  const at = (x, y) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return NaN;
    return acc[y * S + x] * scale[(y >> 8) * NT + (x >> 8)];
  };
  const { fx, fy } = geometry();
  const grid = new Float32Array(FW * FH);
  for (let j = 0; j < FH; j++) {
    const y = fy[j], r = Math.floor(y), ty = y - r;
    for (let i = 0; i < FW; i++) {
      const x = fx[i], c = Math.floor(x), tx = x - c;
      const a = at(c, r), b = at(c + 1, r), d = at(c, r + 1), e = at(c + 1, r + 1);
      grid[j * FW + i] = a !== a || b !== b || d !== d || e !== e ? at(Math.round(x), Math.round(y)) : (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
    }
  }
  return { grid, frames: Math.min(...ok), expected, from, to, source: 'meteocat' };
}
