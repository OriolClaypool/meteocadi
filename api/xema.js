// Dades de totes les estacions automàtiques del Servei Meteorològic de Catalunya (XEMA), des del portal
// de dades obertes de la Generalitat (analisi.transparenciacatalunya.cat). Lectures de cada mitja hora,
// amb uns 45-75 minuts de retard. Memòria cau a la CDN de 15 minuts: el portal rep com a molt 3 crides cada 15 minuts.
//
// Codis de variable (metadades 4fb2-n3yi): 32 temperatura, 33 humitat, 30/48/46 vent a 10/6/2 m (m/s),
// 31/49/47 direcció, 50/53/56 ratxa màxima a 10/6/2 m (m/s), 35 precipitació (mm), 38 gruix de neu (cm),
// 40/42 temperatura màxima/mínima del període.

import { onlyCleanUrl } from './_net.js';
const BASE = 'https://analisi.transparenciacatalunya.cat/resource';
const HEADERS = { 'User-Agent': 'meteocadi.cat', ...(process.env.SOCRATA_APP_TOKEN ? { 'X-App-Token': process.env.SOCRATA_APP_TOKEN } : {}) };

// "2026-09-29T06:30:00" (UTC, sense zona: el format del portal)
const floating = (d) => d.toISOString().slice(0, 19);

// Mitjanit d'avui a Madrid, en UTC
function midnightMadrid(now = new Date()) {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const off = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', timeZoneName: 'shortOffset' })
    .formatToParts(now)
    .find((p) => p.type === 'timeZoneName')?.value; // "GMT+2"
  const h = Number((off || 'GMT+1').replace('GMT', '')) || 0;
  return new Date(Date.parse(`${ymd}T00:00:00Z`) - h * 3600e3);
}

async function get(path, params) {
  const url = `${BASE}/${path}?${new URLSearchParams(params)}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(9000), headers: HEADERS });
  if (!r.ok) throw new Error(`${path} HTTP ${r.status}`);
  return r.json();
}

const n = (v) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));
const kmh = (ms) => (ms == null ? null : Math.round(ms * 3.6 * 10) / 10);
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
// "la Tosa d'Alp (2.478 m)" → "La Tosa d'Alp"
// Textos que venen de fora i es pinten a la pàgina: sense < > " (per si mai hi arribés codi HTML)
const plain = (s) => (s == null ? s : String(s).replace(/[<>"]/g, ''));
const cleanName = (s) => {
  const t = plain(String(s || '').replace(/\s*\(\d[\d.]* m\)/g, '')).trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
};

export default async function handler(req, res) {
  if (onlyCleanUrl(req, res, '/api/xema')) return;
  try {
    const now = new Date();
    const since = floating(new Date(now.getTime() - 3 * 3600e3));
    const midnight = floating(midnightMadrid(now));
    const [meta, latest, today] = await Promise.all([
      get('yqwd-vj5e.json', {
        $select: 'codi_estacio,nom_estacio,latitud,longitud,altitud,nom_comarca,nom_municipi',
        $where: "nom_estat_ema='Operativa'",
        $limit: '1000',
      }),
      get('nzvn-apee.json', {
        $select: 'codi_estacio,codi_variable,data_lectura,valor_lectura',
        $where: `data_lectura>='${since}' AND codi_variable in('32','33','30','31','46','47','48','49','38')`,
        $order: 'data_lectura DESC',
        $limit: '20000',
      }),
      get('nzvn-apee.json', {
        $select: 'codi_estacio,codi_variable,max(valor_lectura) as mx,min(valor_lectura) as mn,sum(valor_lectura) as sm',
        $where: `data_lectura>='${midnight}' AND codi_variable in('40','42','35','50','53','56')`,
        $group: 'codi_estacio,codi_variable',
        $limit: '5000',
      }),
    ]);

    // Darrera lectura de cada variable a cada estació (les files ja venen de la més nova a la més antiga)
    const last = {};
    let newest = null;
    for (const row of latest) {
      const k = `${row.codi_estacio}|${row.codi_variable}`;
      if (last[k]) continue;
      last[k] = { v: n(row.valor_lectura), t: row.data_lectura };
      if (!newest || row.data_lectura > newest) newest = row.data_lectura;
    }
    const agg = {};
    for (const row of today) agg[`${row.codi_estacio}|${row.codi_variable}`] = row;
    const L = (id, ...codes) => {
      for (const c of codes) if (last[`${id}|${c}`]?.v != null) return last[`${id}|${c}`];
      return null;
    };
    const A = (id, field, ...codes) => {
      for (const c of codes) {
        const v = n(agg[`${id}|${c}`]?.[field]);
        if (v != null) return v;
      }
      return null;
    };

    const stations = meta
      .map((s) => {
        const id = s.codi_estacio;
        const t = L(id, '32');
        const wind = L(id, '30', '48', '46');
        const dir = L(id, '31', '49', '47');
        return {
          id,
          name: cleanName(s.nom_estacio),
          lat: n(s.latitud),
          lng: n(s.longitud),
          alt: n(s.altitud),
          com: plain(s.nom_comarca),
          mun: plain(s.nom_municipi),
          t: t?.v ?? null,
          time: t ? `${t.t.slice(0, 19)}Z` : null,
          hr: L(id, '33')?.v ?? null,
          wind: kmh(wind?.v ?? null),
          dir: dir?.v ?? null,
          snow: L(id, '38')?.v ?? null,
          tmax: A(id, 'mx', '40'),
          tmin: A(id, 'mn', '42'),
          rain: r1(A(id, 'sm', '35')),
          gust: kmh(A(id, 'mx', '50', '53', '56')),
        };
      })
      .filter((s) => s.lat != null && s.lng != null && (s.t != null || s.rain != null || s.wind != null));

    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800');
    res.status(200).json({
      updated: now.toISOString(),
      // Les lectures són semihoràries i data_lectura n'és l'inici: la darrera acaba 30 minuts després
      latest: newest ? new Date(Date.parse(`${newest.slice(0, 19)}Z`) + 30 * 60e3).toISOString() : null,
      source: 'Servei Meteorològic de Catalunya (XEMA) · Dades obertes de la Generalitat de Catalunya',
      stations,
    });
  } catch (e) {
    console.error('[xema]', String(e));
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.status(200).json({ updated: new Date().toISOString(), error: true, stations: [] });
  }
}
