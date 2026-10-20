// La pluja d'avui segons el radar (OPERA, /api/capes/pluja): la suma de les hores des de la mitjanit (hora local) fins
// a l'hora de les dades de les estacions, a la graella del mapa de color (camp.js: FW × FH). El mapa la fa servir per
// ajustar la pluja entre estacions (computeField, radar). Retorna { grid (Float32Array, mm; NaN sense dades), hours,
// to } o null si falten hores o no n'hi ha.
import { hourMadrid, todayMadrid } from '../lib/format.js';
import { FW, FH } from './camp.js';

const cache = new Map(); // url → Promise<Float32Array | null>

async function inflate(b64) {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

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
export async function radarToday(until = new Date()) {
  if (typeof DecompressionStream === 'undefined') return null;
  let ix = null;
  try {
    const r = await fetch('/api/capes/pluja');
    ix = r.ok ? await r.json() : null;
  } catch {}
  if (!ix?.hours?.length) return null;
  const from = midnight(), to = until.getTime() + 20 * 60e3;
  const hs = ix.hours.filter((h) => { const e = Date.parse(h.end); return e > from && e <= to; });
  // Han de ser-hi gairebé totes (com a molt en falten dues): si no, la suma es quedaria curta
  const want = Math.floor((Math.min(to, Date.now()) - from) / 3600e3);
  if (!hs.length || hs.length < want - 2) return null;
  const grids = await Promise.all(hs.map((h) => hour(h.url)));
  const ok = grids.filter(Boolean);
  if (ok.length < want - 2 || !ok.length) return null;
  const sum = new Float32Array(FW * FH);
  for (let p = 0; p < sum.length; p++) {
    let s = 0, n = 0;
    for (const g of ok) if (g[p] === g[p]) { s += g[p]; n++; }
    // Sense dades en més d'una quarta part de les hores: no se'n sap prou
    sum[p] = n >= ok.length * 0.75 ? (s * ok.length) / n : NaN;
  }
  return { grid: sum, hours: ok.length, to: new Date(Date.parse(hs[hs.length - 1].end)) };
}
