// Capa de color interpolada entre estacions (mapa de Catalunya i portada).
// Graella de 340 × 290 punts en Web Mercator sobre Catalunya. Temperatura: s'interpola la temperatura "reduïda"
// (sense l'efecte de l'altitud, amb el gradient calculat amb les mateixes estacions) i es torna a sumar l'altitud
// del terreny de cada punt (graella de /api/dem).
// Interpolació local (vegeu interpolate): cada punt surt de les estacions més properes, amb un pes que baixa amb la
// distància prou de pressa perquè cada estació no pinti fins a mig camí de les veïnes, però sense fer una "diana" de
// color al seu voltant. La pluja s'interpola en escala logarítmica, com l'escala de colors: així un valor molt alt
// no s'escampa per sobre de les estacions del voltant que n'han recollit molt menys.
import CONTORN from '../lib/catalunya-contorn.json';

export const FB = { lat0: 40.48, lat1: 42.9, lng0: 0.12, lng1: 3.36 };
export const FW = 340;
export const FH = 290;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const Y0 = mercY(FB.lat1);
const Y1 = mercY(FB.lat0);
export const rowLat = (py) => ((2 * Math.atan(Math.exp(Y0 + ((py + 0.5) / FH) * (Y1 - Y0))) - Math.PI / 2) * 180) / Math.PI;
export const colLng = (px) => FB.lng0 + ((px + 0.5) / FW) * (FB.lng1 - FB.lng0);
export const toPx = (lng, lat) => [((lng - FB.lng0) / (FB.lng1 - FB.lng0)) * FW, ((mercY(lat) - Y0) / (Y1 - Y0)) * FH];

// Escales de color dels mapes: tons saturats i un canvi clar de to cada 5 °C (de 8 a 22 °C ha de veure's molt diferent).
// Les etiquetes del mapa i la llegenda fan servir els mateixos colors (fieldColor), perquè quadrin amb el fons.
const TSTOP = [[-10, 91, 33, 182], [-5, 79, 70, 229], [0, 37, 99, 235], [5, 14, 165, 233], [10, 20, 184, 166], [15, 34, 197, 94], [20, 234, 179, 8], [25, 249, 115, 22], [30, 220, 38, 38], [35, 153, 27, 27], [40, 112, 26, 117]];
const RSTOP = [[0.2, 147, 197, 253], [1, 96, 165, 250], [5, 37, 99, 235], [10, 13, 148, 136], [15, 22, 163, 74], [30, 234, 179, 8], [50, 249, 115, 22], [80, 220, 38, 38], [150, 192, 38, 211]];
const WSTOP = [[0, 203, 213, 225], [10, 14, 165, 233], [20, 20, 184, 166], [30, 132, 204, 22], [40, 234, 179, 8], [55, 249, 115, 22], [70, 220, 38, 38], [90, 153, 27, 27]];
const HSTOP = [[20, 234, 179, 8], [30, 191, 219, 254], [50, 96, 165, 250], [70, 59, 130, 246], [85, 37, 99, 235], [100, 30, 64, 175]];

// Variables amb capa de color. rain: transparent on no ha plogut o no hi ha cap estació a menys de 35 km;
// log: s'interpola log(1 + valor) (l'escala de la pluja és gairebé logarítmica: 1, 5, 10, 30, 80, 150 mm)
export const FIELD = {
  t: { stops: TSTOP, alpha: 0.66, dem: true },
  tmax: { stops: TSTOP, alpha: 0.66, dem: true },
  tmin: { stops: TSTOP, alpha: 0.66, dem: true },
  rain: { stops: RSTOP, alpha: 0.7, min: 0.2, maxKm: 35, log: true },
  gust: { stops: WSTOP, alpha: 0.62 },
  wind: { stops: WSTOP, alpha: 0.62 },
  hr: { stops: HSTOP, alpha: 0.62 },
};

// Color (#rrggbb) d'un valor amb l'escala de la variable: etiquetes i llegenda dels mapes
const hex2 = (x) => Math.round(x).toString(16).padStart(2, '0');
export function fieldColor(key, v) {
  const c = ramp(FIELD[key].stops, v);
  return `#${hex2(c[1])}${hex2(c[2])}${hex2(c[3])}`;
}

export function ramp(stops, v) {
  if (v <= stops[0][0]) return stops[0];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (v < b[0]) {
      const f = (v - a[0]) / (b[0] - a[0]);
      return [v, a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2]), a[3] + f * (b[3] - a[3])];
    }
  }
  return stops[stops.length - 1];
}

// Màscara de Catalunya (0-255 per punt de la graella) a partir de polígons GeoJSON [[[lng, lat], ...], ...]
export function maskFrom(polygons) {
  const cv = document.createElement('canvas');
  cv.width = FW;
  cv.height = FH;
  const c = cv.getContext('2d');
  c.fillStyle = '#000';
  for (const poly of polygons) {
    c.beginPath();
    for (const ring of poly) ring.forEach(([x, y], i) => { const [px, py] = toPx(x, y); i ? c.lineTo(px, py) : c.moveTo(px, py); });
    c.fill('evenodd');
  }
  const d = c.getImageData(0, 0, FW, FH).data;
  const m = new Uint8ClampedArray(FW * FH);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3];
  return m;
}
export const outlineMask = () => maskFrom(CONTORN.coordinates);
export const comarquesMask = (geo) => maskFrom(geo.features.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)));

function elevAt(dem, lat, lng) {
  const fr = (lat - dem.lat0) / dem.step, fc = (lng - dem.lng0) / dem.step;
  const r0 = Math.max(0, Math.min(dem.rows - 2, Math.floor(fr))), c0 = Math.max(0, Math.min(dem.cols - 2, Math.floor(fc)));
  const tr = Math.max(0, Math.min(1, fr - r0)), tc = Math.max(0, Math.min(1, fc - c0));
  const z = (r, c) => dem.z[r * dem.cols + c];
  return (z(r0, c0) * (1 - tc) + z(r0, c0 + 1) * tc) * (1 - tr) + (z(r0 + 1, c0) * (1 - tc) + z(r0 + 1, c0 + 1) * tc) * tr;
}

// Interpolació local (Shepard modificat): per a cada punt, les K estacions més properes, amb pes
// 1 / (d² + S²)^1,25 (potència 2,5 de la distància) multiplicat per (1 - d²/R²)², on R és la distància a la K+1-a
// estació. El pes s'esvaeix del tot a R, i per això no hi ha salts quan canvia quines estacions són les més
// properes, ni les llunyanes estiren el valor cap a la mitjana de Catalunya. Amb potència 2,5 (abans, 3 i totes les
// estacions) cada estació ja no omple de color tota la zona fins a mig camí de les veïnes, sinó que el color va
// canviant de mica en mica d'una a l'altra. S (2 km) arrodoneix el valor just a sobre de l'estació (sense punxa).
const K = 16;
const S2 = 2 * 2;

// pts: [{ lat, lng, alt, v }]. Retorna { raw, web, useDem } o null:
// raw: ImageData opac (també una mica fora del contorn, per retallar-lo net amb el contorn vectorial);
// web: la mateixa capa amb la transparència de la variable i retallada amb la màscara.
// alpha: opacitat de la capa "web" (per defecte la de la variable; el mapa la demana a 1 i la regula amb el control d'intensitat)
export function computeField(pts, key, { mask, dem = null, alpha = null }) {
  const cfg = FIELD[key];
  if (!cfg || !mask || pts.length < 5) return null;
  let slope = 0;
  const useDem = !!cfg.dem && !!dem;
  if (useDem) {
    const n = pts.length, mx = pts.reduce((a, p) => a + p.alt, 0) / n, my = pts.reduce((a, p) => a + p.v, 0) / n;
    const sxx = pts.reduce((a, p) => a + (p.alt - mx) ** 2, 0);
    slope = sxx > 0 ? pts.reduce((a, p) => a + (p.alt - mx) * (p.v - my), 0) / sxx : -0.0065;
    slope = Math.max(-0.0098, Math.min(-0.002, slope));
  }
  const n = pts.length;
  const PX = new Float64Array(n), PY = new Float64Array(n), PR = new Float64Array(n);
  pts.forEach((p, j) => {
    PX[j] = p.lng;
    PY[j] = p.lat;
    PR[j] = cfg.log ? Math.log1p(Math.max(0, p.v)) : p.v - slope * p.alt;
  });
  const kk = Math.min(K, n - 1);
  // Les kk + 1 estacions més properes del punt, ordenades per distància (bd: km², bi: índex de l'estació)
  const bd = new Float64Array(kk + 1), bi = new Int32Array(kk + 1);
  // Per anar de pressa: es comença per les més properes del punt anterior (gairebé sempre són les mateixes) i
  // es descarten sense calcular-ne la distància les estacions que ja queden massa lluny en latitud (DY2)
  const prev = new Int32Array(kk + 1), seen = new Uint8Array(n), DY2 = new Float64Array(n);
  let warm = false;
  const raw = new ImageData(FW, FH);
  const web = new ImageData(FW, FH);
  const maxD2 = cfg.maxKm ? cfg.maxKm * cfg.maxKm : Infinity;
  for (let py = 0; py < FH; py++) {
    const lat = rowLat(py);
    const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
    for (let j = 0; j < n; j++) { const dy = (lat - PY[j]) * 111.32; DY2[j] = dy * dy; }
    for (let px = 0; px < FW; px++) {
      const i = py * FW + px;
      const inside = mask[i];
      if (!inside && !(mask[i - 3] || mask[i + 3] || mask[i - 3 * FW] || mask[i + 3 * FW])) continue;
      const lng = colLng(px);
      let m = 0;
      for (let s = warm ? -(kk + 1) : 0; s < n; s++) {
        let j;
        if (s < 0) { j = prev[s + kk + 1]; seen[j] = 1; }
        else { j = s; if (seen[j] || (m > kk && DY2[j] >= bd[kk])) continue; }
        const dx = (lng - PX[j]) * kx;
        const d2 = dx * dx + DY2[j];
        if (m <= kk) m++;
        else if (d2 >= bd[kk]) continue;
        let q = m - 1;
        while (q > 0 && bd[q - 1] > d2) { bd[q] = bd[q - 1]; bi[q] = bi[q - 1]; q--; }
        bd[q] = d2;
        bi[q] = j;
      }
      if (warm) for (let q = 0; q <= kk; q++) seen[prev[q]] = 0;
      prev.set(bi);
      warm = true;
      const R2 = bd[kk];
      let sw = 0, sv = 0;
      for (let q = 0; q < kk; q++) {
        const t = 1 - bd[q] / R2;
        const x = bd[q] + S2;
        const w = (t * t) / (x * Math.sqrt(Math.sqrt(x))); // 1 / (d² + S²)^1,25 = potència 2,5 de la distància
        sw += w;
        sv += w * PR[bi[q]];
      }
      let v = sw > 0 ? sv / sw : PR[bi[0]];
      if (cfg.log) v = Math.expm1(v);
      if (useDem) v += slope * elevAt(dem, lat, lng);
      if ((cfg.min != null && v < cfg.min) || bd[0] > maxD2) continue;
      const c = ramp(cfg.stops, v);
      const k = i * 4;
      raw.data[k] = web.data[k] = c[1];
      raw.data[k + 1] = web.data[k + 1] = c[2];
      raw.data[k + 2] = web.data[k + 2] = c[3];
      raw.data[k + 3] = 255;
      web.data[k + 3] = Math.round(inside * (alpha ?? cfg.alpha));
    }
  }
  return { raw, web, useDem, alpha: cfg.alpha };
}

export function toCanvas(img) {
  const cv = document.createElement('canvas');
  cv.width = img.width;
  cv.height = img.height;
  cv.getContext('2d').putImageData(img, 0, 0);
  return cv;
}
