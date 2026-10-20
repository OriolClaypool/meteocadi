// La pluja segons el radar (OPERA, /api/capes/pluja): la suma de les hores d'un període fins a l'hora de les dades de
// les estacions, a la graella del mapa de color (camp.js: FW × FH). El mapa la fa servir per ajustar la pluja entre
// estacions (computeField, radar): "Avui" (des de la mitjanit, hora local) i, des del 20/10/2026, "Darreres 24 h"
// (Oriol: amb el radar a "Avui" i sense a les 24 hores, la pluja es veia diferent). El dipòsit obert de l'OPERA només
// guarda les darreres 24 hores: per als dies anteriors, la pluja de cada dia es desa cada nit (api/_pluja-dia.js) i es
// publica a /radar-pluja/AAAA-MM-DD.json (radarDays). Retorna { grid (Float32Array, mm; NaN sense dades), … } o null
// si falten hores o dies.
import { hourMadrid, todayMadrid } from '../lib/format.js';
import { FW, FH } from './camp.js';

const cache = new Map(); // url → Promise<Float32Array | null>

async function inflate(b64) {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Una hora (/api/capes/pluja-…) o un dia desat (/radar-pluja/…): el mateix format
function hour(url) {
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then(async (j) => {
          if (!j?.data || j.w !== FW || j.h !== FH) return null;
          const raw = await inflate(j.data);
          const u = new Uint16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
          if (u.length !== FW * FH) return null;
          return Float32Array.from(u, (x) => (x === 65535 ? NaN : x / 10));
        })
        .catch(() => null),
    );
  }
  return cache.get(url);
}

// La mitjanit d'avui (hora local) en mil·lisegons UTC
function midnight() {
  const day = todayMadrid();
  const t = Date.parse(`${day}T00:00:00Z`);
  for (const off of [2, 1]) if (hourMadrid(new Date(t - off * 3600e3)) === '00:00') return t - off * 3600e3;
  return t - 3600e3;
}

// until: fins a quina hora (les dades de les estacions); per defecte, ara
export const radarToday = (until = new Date()) => radarSum(midnight(), until);
// Les darreres 24 hores fins a until (com el període "Darreres 24 h" del mapa, que acaba a la lectura més nova)
export const radar24h = (until = new Date()) => radarSum(until.getTime() - 24 * 3600e3, until);

// Les hores que acaben després de from (ms) i, com a molt, 20 minuts després de until
async function radarSum(from, until) {
  if (typeof DecompressionStream === 'undefined') return null;
  let ix = null;
  try {
    const r = await fetch('/api/capes/pluja');
    ix = r.ok ? await r.json() : null;
  } catch {}
  if (!ix?.hours?.length) return null;
  const to = until.getTime() + 20 * 60e3;
  const hs = ix.hours.filter((h) => { const e = Date.parse(h.end); return e > from && e <= to; });
  // Han de ser-hi gairebé totes (com a molt en falten dues): si no, la suma es quedaria curta
  const want = Math.floor((Math.min(to, Date.now()) - from) / 3600e3);
  if (!hs.length || hs.length < want - 2) return null;
  const grids = await Promise.all(hs.map((h) => hour(h.url)));
  const ok = grids.filter(Boolean);
  if (ok.length < want - 2 || !ok.length) return null;
  return { grid: sumGrids(ok), hours: ok.length, to: new Date(Date.parse(hs[hs.length - 1].end)) };
}

// Suma de graelles; on més d'una quarta part no en tenen dades, no se'n sap prou (NaN)
export function sumGrids(list) {
  const sum = new Float32Array(FW * FH);
  for (let p = 0; p < sum.length; p++) {
    let s = 0, n = 0;
    for (const g of list) if (g[p] === g[p]) { s += g[p]; n++; }
    sum[p] = n >= list.length * 0.75 ? (s * list.length) / n : NaN;
  }
  return sum;
}

// Dies desats ('AAAA-MM-DD', dies locals sencers): la suma, o null si en falta algun
export async function radarDays(days) {
  if (typeof DecompressionStream === 'undefined' || !days.length) return null;
  const grids = await Promise.all(days.map((d) => hour(`/radar-pluja/${d}.json`)));
  if (grids.some((g) => !g)) return null;
  return { grid: sumGrids(grids), days: days.length };
}
