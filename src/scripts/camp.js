// Capa de color interpolada entre estacions (mapa de Catalunya i portada).
// Graella de 340 × 290 punts en Web Mercator sobre Catalunya. Temperatura: s'interpola la temperatura "reduïda"
// (sense l'efecte de l'altitud, amb el gradient calculat amb les mateixes estacions) i es torna a sumar l'altitud
// del terreny de cada punt (graella fixa de public/dem-catalunya.json).
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

// Escales de color (compartides amb l'estudi): src/lib/escales.js. Les etiquetes del mapa i la llegenda fan servir
// els mateixos colors (fieldColor), perquè quadrin amb el fons.
import { TSTOP, RSTOP, WSTOP, HSTOP, ramp, fieldColor } from '../lib/escales.js';
export { ramp, fieldColor };

// Variables amb capa de color. rain: transparent on no ha plogut o no hi ha cap estació a menys de 35 km;
// log: s'interpola log(1 + valor) (l'escala de la pluja és gairebé logarítmica); step: colors per classes, sense degradat
export const FIELD = {
  t: { stops: TSTOP, alpha: 0.66, dem: true },
  tmax: { stops: TSTOP, alpha: 0.66, dem: true },
  tmin: { stops: TSTOP, alpha: 0.66, dem: true },
  rain: { stops: RSTOP, alpha: 0.7, min: 0.1, maxKm: 35, log: true, step: true },
  gust: { stops: WSTOP, alpha: 0.62 },
  wind: { stops: WSTOP, alpha: 0.62 },
  hr: { stops: HSTOP, alpha: 0.62 },
};

// Màscara de Catalunya (0-255 per punt de la graella) a partir de polígons GeoJSON [[[lng, lat], ...], ...].
// scale: graella més fina (per a les variables per classes, que es dibuixen amb més resolució; vegeu HI)
export function maskFrom(polygons, scale = 1) {
  const w = FW * scale, h = FH * scale;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d');
  c.fillStyle = '#000';
  for (const poly of polygons) {
    c.beginPath();
    for (const ring of poly) ring.forEach(([x, y], i) => { const [px, py] = toPx(x, y); i ? c.lineTo(px * scale, py * scale) : c.moveTo(px * scale, py * scale); });
    c.fill('evenodd');
  }
  const d = c.getImageData(0, 0, w, h).data;
  const m = new Uint8ClampedArray(w * h);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3];
  return m;
}
export const outlineMask = () => maskFrom(CONTORN.coordinates);
const comarquesPolys = (geo) => geo.features.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates));
export const comarquesMask = (geo, scale = 1) => maskFrom(comarquesPolys(geo), scale);
// Les variables per classes (step: la pluja) es pinten a 4 vegades la resolució de la graella: el valor s'interpola
// entre punts de la graella i cada píxel pren el color de la seva classe, perquè les vores entre franges siguin
// netes i no esglaonades quan s'hi fa zoom.
export const HI = 4;

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
// maskHi: la màscara a HI vegades la resolució (comarquesMask(geo, HI)) per a les variables per classes; si no n'hi
// ha, s'amplia la de la graella.
// min: per sota d'aquest valor no es pinta (la pluja l'adapta al màxim del mapa, vegeu rainClasses)
// Temperatura segons l'altitud (la "tendència" que es treu abans d'interpolar i es torna a sumar amb el relleu):
// - Un sol gradient, ajustat amb les mateixes estacions, entre -9,8 i -2 °C/km.
// - O dos trams que s'ajunten a l'alçada h: el de baix pot ser més suau o fins i tot pujar (inversió tèrmica: les
//   valls i els plans més freds que els vessants), el de dalt, entre -9,8 i -2 °C/km. Es fa servir quan redueix
//   l'error de l'ajust un 25 % o més i el tram de baix és clarament diferent; cada tram ha de tenir 6 estacions.
// Provat deixant fora cada estació (20/10/2026): a les mínimes de les 12 estacions de la xarxa en 460 dies, l'error
// mitjà passa d'1,12 a 1,07 °C, i els 230 matins amb inversió (les de la vall més fredes que el Rebost, a 1.650 m),
// d'1,89 a 1,57 °C; a les màximes, igual (0,94 i 0,93). Amb les 184 estacions de la XEMA d'un dia de pluja (19/10)
// no s'activa i el mapa queda igual. La posició al relleu (fons de vall o carena) no millorava res: la graella del
// relleu (4 km) és massa grossa per a les valls estretes.
// Els dos trams només per a la mínima i per a la temperatura d'ara amb el sol baix (inversion: true, vegeu lowSun): a
// les tardes d'estiu, la marinada refresca la costa i l'ajust ho prendria per una inversió (la costa, a 0 m, més freda
// que la plana de Lleida) i pintaria les serres de la costa més calentes que la costa mateixa.
function solve3(X, y) {
  const A = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  for (let i = 0; i < X.length; i++) for (let a = 0; a < 3; a++) { A[a][3] += X[i][a] * y[i]; for (let c = 0; c < 3; c++) A[a][c] += X[i][a] * X[i][c]; }
  for (let i = 0; i < 3; i++) {
    let mx = i;
    for (let r = i + 1; r < 3; r++) if (Math.abs(A[r][i]) > Math.abs(A[mx][i])) mx = r;
    [A[i], A[mx]] = [A[mx], A[i]];
    if (Math.abs(A[i][i]) < 1e-9) return null;
    for (let r = 0; r < 3; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let c = i; c < 4; c++) A[r][c] -= f * A[i][c]; }
  }
  return A.map((row, i) => row[3] / row[i]);
}
export function altTrend(pts, twoSegments = true) {
  const n = pts.length;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mz = pts.reduce((a, p) => a + p.alt, 0) / n, mv = pts.reduce((a, p) => a + p.v, 0) / n;
  const sxx = pts.reduce((a, p) => a + (p.alt - mz) ** 2, 0);
  const b = clamp(sxx > 0 ? pts.reduce((a, p) => a + (p.alt - mz) * (p.v - mv), 0) / sxx : -0.0065, -0.0098, -0.002);
  const lin = { f: (z) => b * z, b };
  if (!twoSegments) return lin;
  const rss0 = pts.reduce((a, p) => a + (p.v - mv - b * (p.alt - mz)) ** 2, 0);
  let best = null;
  for (let h = 300; h <= 2000; h += 100) {
    let lo = 0;
    for (const p of pts) if (p.alt < h) lo++;
    if (lo < 6 || n - lo < 6) continue;
    const c = solve3(pts.map((p) => [1, Math.min(p.alt, h), Math.max(p.alt - h, 0)]), pts.map((p) => p.v));
    if (!c) continue;
    const b1 = clamp(c[1], -0.0098, 0.025), b2 = clamp(c[2], -0.0098, -0.002);
    let rss = 0;
    for (const p of pts) rss += (p.v - c[0] - b1 * Math.min(p.alt, h) - b2 * Math.max(p.alt - h, 0)) ** 2;
    if (!best || rss < best.rss) best = { h, b1, b2, rss };
  }
  if (!best || best.rss > rss0 * 0.75 || best.b1 < best.b2 + 0.002) return lin;
  const { h, b1, b2 } = best;
  return { f: (z) => b1 * Math.min(z, h) + b2 * Math.max(z - h, 0), b: b2, h, b1 };
}

// radar (només la pluja): la pluja del radar a la mateixa graella (FW × FH, mm; NaN on no n'hi ha), per fer-ne la
// fusió condicional amb els pluviòmetres: a cada punt, la interpolació de les estacions més la diferència entre el
// radar en aquell punt i el radar interpolat de la mateixa manera des de les estacions (tot en log(1 + mm)). Així, a
// cada estació queda el que ha mesurat i, entre estacions, la forma de la pluja és la del radar.
function sampleGrid(grid, lat, lng) {
  const [x, y] = toPx(lng, lat);
  const c = Math.floor(x - 0.5), r = Math.floor(y - 0.5), tx = x - 0.5 - c, ty = y - 0.5 - r;
  const at = (cc, rr) => (cc < 0 || rr < 0 || cc >= FW || rr >= FH ? NaN : grid[rr * FW + cc]);
  const a = at(c, r), b = at(c + 1, r), d = at(c, r + 1), e = at(c + 1, r + 1);
  if (a !== a || b !== b || d !== d || e !== e) return at(Math.round(x - 0.5), Math.round(y - 0.5));
  return (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
}

// Sol baix al centre de Catalunya, quan hi pot haver inversió tèrmica a les valls: de nit, al matí fins que el sol és a
// 20° (a l'hivern, cap a les 11; les inversions triguen a desfer-se) i al vespre per sota de 5° (abans, a l'estiu, encara
// hi pot haver marinada)
export function lowSun(date = new Date(), lat = 41.8, lng = 1.6) {
  const rad = Math.PI / 180;
  const d = date.getTime() / 864e5 - 10957.5; // dies des del 2000-01-01 12:00 UTC
  const g = rad * ((357.529 + 0.98560028 * d) % 360);
  const q = (280.459 + 0.98564736 * d) % 360;
  const L = rad * ((q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) % 360);
  const e = rad * (23.439 - 0.00000036 * d);
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const ha = rad * (gmst * 15 + lng) - ra;
  const el = Math.asin(Math.sin(rad * lat) * Math.sin(dec) + Math.cos(rad * lat) * Math.cos(dec) * Math.cos(ha)) / rad;
  const morning = Math.sin(ha) < 0; // angle horari negatiu: abans del migdia solar
  return el < 5 || (morning && el < 20);
}

export function computeField(pts, key, { mask, maskHi = null, dem = null, alpha = null, min = null, radar = null, inversion = false }) {
  const cfg = FIELD[key] && min != null ? { ...FIELD[key], min } : FIELD[key];
  if (!cfg || !mask || pts.length < 5) return null;
  const useDem = !!cfg.dem && !!dem;
  const trend = useDem ? altTrend(pts, inversion) : null;
  const n = pts.length;
  const PX = new Float64Array(n), PY = new Float64Array(n), PR = new Float64Array(n);
  pts.forEach((p, j) => {
    PX[j] = p.lng;
    PY[j] = p.lat;
    PR[j] = cfg.log ? Math.log1p(Math.max(0, p.v)) : trend ? p.v - trend.f(p.alt) : p.v;
  });
  // Radar a cada estació (log(1 + mm); NaN si no n'hi ha). Només si s'assembla prou al que han recollit les estacions
  // (correlació de 0,4 o més amb 20 estacions com a mínim): un radar desfasat, buit o amb ecos falsos no hi entra
  let RS = radar && cfg.log && radar.length === FW * FH ? Float64Array.from(pts, (p) => { const r = sampleGrid(radar, p.lat, p.lng); return r === r ? Math.log1p(Math.max(0, r)) : NaN; }) : null;
  let radarCorr = null;
  if (RS) {
    const idx = [];
    for (let j = 0; j < n; j++) if (RS[j] === RS[j]) idx.push(j);
    if (idx.length >= 20) {
      const ma = idx.reduce((a, j) => a + PR[j], 0) / idx.length, mb = idx.reduce((a, j) => a + RS[j], 0) / idx.length;
      let sab = 0, saa = 0, sbb = 0;
      for (const j of idx) { sab += (PR[j] - ma) * (RS[j] - mb); saa += (PR[j] - ma) ** 2; sbb += (RS[j] - mb) ** 2; }
      radarCorr = saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : null;
    }
    if (!(radarCorr >= 0.4)) RS = null;
  }
  const useRadar = !!RS;
  const kk = Math.min(K, n - 1);
  // Les kk + 1 estacions més properes del punt, ordenades per distància (bd: km², bi: índex de l'estació)
  const bd = new Float64Array(kk + 1), bi = new Int32Array(kk + 1);
  // Per anar de pressa: es comença per les més properes del punt anterior (gairebé sempre són les mateixes) i
  // es descarten sense calcular-ne la distància les estacions que ja queden massa lluny en latitud (DY2)
  const prev = new Int32Array(kk + 1), seen = new Uint8Array(n), DY2 = new Float64Array(n);
  let warm = false;
  const step = !!cfg.step;
  // Per classes: primer el valor de cada punt de la graella (G, en l'escala d'interpolació; NaN on no se'n calcula)
  const G = step ? new Float32Array(FW * FH).fill(NaN) : null;
  const raw = step ? null : new ImageData(FW, FH);
  const web = step ? null : new ImageData(FW, FH);
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
      let sw = 0, sv = 0, rw = 0, rv = 0;
      for (let q = 0; q < kk; q++) {
        const t = 1 - bd[q] / R2;
        const x = bd[q] + S2;
        const w = (t * t) / (x * Math.sqrt(Math.sqrt(x))); // 1 / (d² + S²)^1,25 = potència 2,5 de la distància
        sw += w;
        sv += w * PR[bi[q]];
        if (RS && RS[bi[q]] === RS[bi[q]]) { rw += w; rv += w * RS[bi[q]]; }
      }
      let v = sw > 0 ? sv / sw : PR[bi[0]];
      // Fusió amb el radar (on n'hi ha al punt i a les estacions del voltant)
      if (RS && rw > 0 && radar[i] === radar[i]) v = Math.max(0, v + Math.log1p(Math.max(0, radar[i])) - rv / rw);
      if (step) {
        if (bd[0] <= maxD2) G[i] = v;
        continue;
      }
      if (cfg.log) v = Math.expm1(v);
      if (trend) v += trend.f(elevAt(dem, lat, lng));
      if ((cfg.min != null && v < cfg.min) || bd[0] > maxD2) continue;
      const c = ramp(cfg.stops, v, cfg.step);
      const k = i * 4;
      raw.data[k] = web.data[k] = c[1];
      raw.data[k + 1] = web.data[k + 1] = c[2];
      raw.data[k + 2] = web.data[k + 2] = c[3];
      raw.data[k + 3] = 255;
      web.data[k + 3] = Math.round(inside * (alpha ?? cfg.alpha));
    }
  }
  if (step) return { ...paintClasses(G, cfg, mask, maskHi, alpha ?? cfg.alpha), useDem, useRadar, radarCorr, alpha: cfg.alpha };
  return { raw, web, useDem, alpha: cfg.alpha, inversion: trend?.h != null ? { h: trend.h, below: trend.b1 } : null };
}

// Pinta per classes a HI × la graella: interpolació bilineal del valor (en l'escala d'interpolació) i classificació
// de cada píxel. Les vores de les classes es comparen ja transformades (log) per no fer cap exponencial per píxel.
function paintClasses(G, cfg, mask, maskHi, alpha) {
  const W2 = FW * HI, H2 = FH * HI;
  const raw = new ImageData(W2, H2);
  const web = new ImageData(W2, H2);
  const stops = cfg.stops;
  const T = stops.map((s) => (cfg.log ? Math.log1p(s[0]) : s[0]));
  const tMin = cfg.min != null ? (cfg.log ? Math.log1p(cfg.min) : cfg.min) : -Infinity;
  for (let oy = 0; oy < H2; oy++) {
    const gy = (oy + 0.5) / HI - 0.5;
    const y0 = Math.max(0, Math.min(FH - 2, Math.floor(gy)));
    const fy = Math.max(0, Math.min(1, gy - y0));
    for (let ox = 0; ox < W2; ox++) {
      const gx = (ox + 0.5) / HI - 0.5;
      const x0 = Math.max(0, Math.min(FW - 2, Math.floor(gx)));
      const fx = Math.max(0, Math.min(1, gx - x0));
      const i00 = y0 * FW + x0;
      const a = G[i00], b = G[i00 + 1], c = G[i00 + FW], d = G[i00 + FW + 1];
      let v;
      if (a === a && b === b && c === c && d === d) v = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
      else {
        // A la vora de la zona calculada: el punt de la graella més proper, si en té
        const near = G[Math.round(gy) * FW + Math.round(gx)];
        if (near !== near) continue;
        v = near;
      }
      if (v < tMin) continue;
      let s = T.length - 1;
      while (s > 0 && v < T[s]) s--;
      const col = stops[s];
      const k = (oy * W2 + ox) * 4;
      raw.data[k] = web.data[k] = col[1];
      raw.data[k + 1] = web.data[k + 1] = col[2];
      raw.data[k + 2] = web.data[k + 2] = col[3];
      raw.data[k + 3] = 255;
      const inside = maskHi ? maskHi[oy * W2 + ox] : mask[Math.min(FH - 1, Math.floor(oy / HI)) * FW + Math.min(FW - 1, Math.floor(ox / HI))];
      web.data[k + 3] = Math.round(inside * alpha);
    }
  }
  return { raw, web };
}

export function toCanvas(img) {
  const cv = document.createElement('canvas');
  cv.width = img.width;
  cv.height = img.height;
  cv.getContext('2d').putImageData(img, 0, 0);
  return cv;
}
