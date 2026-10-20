// Arxiu de la pluja del radar (Oriol, 20/10/2026: "mantener los datos del radar unos días para cubrir episodios"): el
// dipòsit obert de l'OPERA només guarda les darreres 24 hores, i sense arxiu el mapa de Catalunya només podia ajustar
// la pluja amb el radar avui i les darreres 24 h. Cada nit, poc després de mitjanit (hora local), se suma la pluja de
// totes les hores del dia que acaba d'acabar (fitxers ACRR, una hora cadascun, a la graella del mapa de color: la
// mateixa de /api/capes/pluja-…) i es desa a dades/radar/AAAA/AAAA-MM-DD.json amb un commit a GitHub. En compilar,
// els dies desats es publiquen a /radar-pluja/AAAA-MM-DD.json (src/pages/radar-pluja/[dia].json.js) i el mapa els fa
// servir per a "Un altre dia" i "Diversos dies".
//
// El cron (vercel.json) és entre les 23 i les 24 h UTC (el pla Hobby de Vercel l'engega en algun moment d'aquella
// hora): a l'estiu (UTC+2) el dia local va de les 22 h a les 22 h UTC i la primera hora té llavors entre 24 i 25 hores;
// a l'hivern (UTC+1), de les 23 h a les 23 h, i la darrera hora (la que acaba a les 23 h) arriba uns minuts després.
// Si en falten més de dues, el dia no es desa (la forma de la pluja no seria la del dia).
import { accGrid, encodeGrid, FW, FH } from './_pluja.js';
import { listProduct, fromStamp, stamp } from './_opera.js';
import { midnightOf } from './_xema.js';

const H = 3600e3;
export const nextYmd = (ymd) => new Date(Date.parse(`${ymd}T12:00:00Z`) + 864e5).toISOString().slice(0, 10);
export const prevYmd = (ymd) => new Date(Date.parse(`${ymd}T12:00:00Z`) - 864e5).toISOString().slice(0, 10);
export const radarPath = (ymd) => `dades/radar/${ymd.slice(0, 4)}/${ymd}.json`;
const SOURCE = "Radar: composició europea OPERA d'EUMETNET (CC BY 4.0), pluja d'una hora (ACRR, 2 km), sumada per al dia local";

// ymd ('AAAA-MM-DD', dia local) → { date, from, to, expected, hours, missing, w, h, cover, max, data } o, si falten
// hores, { date, incomplete: true, expected, hours, missing }
export async function radarDay(ymd, { list = listProduct, read = accGrid, now = new Date() } = {}) {
  const from = midnightOf(ymd), to = midnightOf(nextYmd(ymd));
  // Les hores del dia: les que acaben de la 1 a les 24 h locals (23, 24 o 25 els dies del canvi d'hora)
  const want = [];
  for (let t = from.getTime() + H; t <= to.getTime(); t += H) want.push(stamp(new Date(t)));
  const listed = new Set((await list('ACRR', from, new Date(Math.min(now.getTime(), to.getTime() + H)))).filter((t) => t.endsWith('00')));
  const todo = want.filter((t) => listed.has(t));
  const grids = new Array(todo.length).fill(null);
  for (let i = 0; i < todo.length; i += 6) {
    const part = await Promise.all(todo.slice(i, i + 6).map((t) => read(t).catch(() => null)));
    part.forEach((g, k) => { grids[i + k] = g; });
  }
  const got = todo.filter((_, i) => grids[i]);
  const ok = grids.filter(Boolean).map((g) => g.grid);
  const missing = want.filter((t) => !got.includes(t));
  const base = { date: ymd, from: from.toISOString(), to: to.toISOString(), expected: want.length, hours: ok.length, missing };
  if (!ok.length || missing.length > 2) return { ...base, incomplete: true };
  // Suma de les hores a cada punt; on el radar no hi veu en més d'una quarta part de les hores, sense dades
  const sum = new Float32Array(FW * FH);
  for (let p = 0; p < sum.length; p++) {
    let s = 0, n = 0;
    for (const g of ok) {
      const v = g[p];
      if (v === v) { s += v; n++; }
    }
    sum[p] = n >= ok.length * 0.75 ? (s * ok.length) / n : NaN;
  }
  return { ...base, source: SOURCE, ...encodeGrid(sum) };
}

// Per a les proves: l'hora (Date) d'un nom de fitxer
export const _endOf = (t) => fromStamp(t);
