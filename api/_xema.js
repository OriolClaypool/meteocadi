// Dades de les estacions automàtiques del Servei Meteorològic de Catalunya (XEMA), des del portal de dades obertes
// de la Generalitat (analisi.transparenciacatalunya.cat). Compartit per /api/xema (avui) i /api/xema/<període>
// (darreres 24 hores o un dia anterior). El prefix "_" fa que Vercel no el publiqui com a funció.
//
// Lectures de cada mitja hora, amb uns 45-75 minuts de retard; data_lectura és l'inici de cada mitja hora, en UTC.
// Codis de variable (metadades 4fb2-n3yi): 32 temperatura, 33 humitat, 30/48/46 vent a 10/6/2 m (m/s),
// 31/49/47 direcció, 50/53/56 ratxa màxima a 10/6/2 m (m/s), 35 precipitació (mm), 38 gruix de neu (cm),
// 40/42 temperatura màxima/mínima del període.
const BASE = 'https://analisi.transparenciacatalunya.cat/resource';
const HEADERS = { 'User-Agent': 'meteocadi.cat', ...(process.env.SOCRATA_APP_TOKEN ? { 'X-App-Token': process.env.SOCRATA_APP_TOKEN } : {}) };

// "2026-09-29T06:30:00" (UTC, sense zona: el format del portal)
const floating = (d) => d.toISOString().slice(0, 19);
const H = 3600e3;

export const ymdMadrid = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

// Mitjanit (a Madrid) del dia ymd, en UTC. L'hora d'estiu canvia de matinada: la diferència horària de les 22 h
// UTC del dia abans és la que hi ha a mitjanit.
export function midnightOf(ymd) {
  const probe = new Date(Date.parse(`${ymd}T00:00:00Z`) - 2 * H);
  const off = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', timeZoneName: 'shortOffset' })
    .formatToParts(probe)
    .find((p) => p.type === 'timeZoneName')?.value; // "GMT+2"
  const h = Number((off || 'GMT+1').replace('GMT', '')) || 0;
  return new Date(Date.parse(`${ymd}T00:00:00Z`) - h * H);
}

async function get(path, params) {
  const url = `${BASE}/${path}?${new URLSearchParams(params)}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(9000), headers: HEADERS });
  if (!r.ok) throw new Error(`${path} HTTP ${r.status}`);
  return r.json();
}

const n = (v) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));
// Límits físics (com els de la xarxa pròpia, src/lib/qc.js): fora d'aquí és un error del sensor
const lim = (v, a, b) => (v == null || v < a || v > b ? null : v);
const kmh = (ms) => (ms == null ? null : Math.round(ms * 3.6 * 10) / 10);
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
// Textos que venen de fora i es pinten a la pàgina: sense < > " (per si mai hi arribés codi HTML)
const plain = (s) => (s == null ? s : String(s).replace(/[<>"]/g, ''));
// "la Tosa d'Alp (2.478 m)" → "La Tosa d'Alp"
const cleanName = (s) => {
  const t = plain(String(s || '').replace(/\s*\(\d[\d.]* m\)/g, '')).trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
};
// Final d'una lectura (data_lectura n'és l'inici)
const endOf = (dl) => new Date(Date.parse(`${dl.slice(0, 19)}Z`) + 30 * 60e3);

const meta = () =>
  get('yqwd-vj5e.json', {
    $select: 'codi_estacio,nom_estacio,latitud,longitud,altitud,nom_comarca,nom_municipi',
    $where: "nom_estat_ema='Operativa'",
    $limit: '1000',
  });

// Darreres 3 hores: el valor actual de cada variable
const latestRows = (now) =>
  get('nzvn-apee.json', {
    $select: 'codi_estacio,codi_variable,data_lectura,valor_lectura',
    $where: `data_lectura>='${floating(new Date(now.getTime() - 3 * H))}' AND codi_variable in('32','33','30','31','46','47','48','49','38','35')`,
    $order: 'data_lectura DESC',
    $limit: '20000',
  });

// Màxima, mínima, pluja i ratxa de cada estació entre start (inclòs) i end (exclòs, o fins ara), amb el nombre de
// lectures (nn) per saber si hi falten dades
const aggRows = (start, end) =>
  get('nzvn-apee.json', {
    $select: 'codi_estacio,codi_variable,max(valor_lectura) as mx,min(valor_lectura) as mn,sum(valor_lectura) as sm,count(valor_lectura) as nn',
    $where: `data_lectura>='${floating(start)}'${end ? ` AND data_lectura<'${floating(end)}'` : ''} AND codi_variable in('40','42','35','50','53','56')`,
    $group: 'codi_estacio,codi_variable',
    $limit: '5000',
  });

// period: { kind: 'today' | '24h' | 'day', date? }. Retorna { updated, latest, period, source, stations }.
// Per a un dia anterior no hi ha valors actuals (temperatura, vent, humitat, neu): només els del dia sencer.
export async function xemaData(period, now = new Date()) {
  let start, end = null, stationsMeta, latest = [], today;
  const live = period.kind !== 'day';
  if (period.kind === 'day') {
    start = midnightOf(period.date);
    end = midnightOf(ymdMadrid(new Date(start.getTime() + 36 * H)));
    [stationsMeta, today] = await Promise.all([meta(), aggRows(start, end)]);
  } else if (period.kind === 'today') {
    start = midnightOf(ymdMadrid(now));
    [stationsMeta, latest, today] = await Promise.all([meta(), latestRows(now), aggRows(start, null)]);
  } else {
    // Darreres 24 hores: les 48 mitges hores que acaben a la lectura més nova
    [stationsMeta, latest] = await Promise.all([meta(), latestRows(now)]);
  }
  let newest = null;
  for (const row of latest) if (!newest || row.data_lectura > newest) newest = row.data_lectura;
  const lastEnd = newest ? endOf(newest) : null;
  if (period.kind === '24h') {
    start = new Date((lastEnd || now).getTime() - 24 * H);
    today = await aggRows(start, null);
  }

  // Darrera lectura de cada variable a cada estació (les files ja venen de la més nova a la més antiga)
  const last = {};
  for (const row of latest) {
    const k = `${row.codi_estacio}|${row.codi_variable}`;
    if (!last[k]) last[k] = { v: n(row.valor_lectura), t: row.data_lectura };
  }
  // Pluja de la darrera hora amb dades: les dues lectures semihoràries més noves de cada estació
  const r35 = {};
  for (const row of latest) {
    if (row.codi_variable !== '35') continue;
    const l = (r35[row.codi_estacio] ||= []);
    if (l.length < 2 && n(row.valor_lectura) != null) l.push(n(row.valor_lectura));
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

  // Lectures semihoràries que hi hauria d'haver al període. Si a una estació li'n falten més de 4 (2 hores) de
  // temperatura, la màxima i la mínima poden no ser les reals: es marca amb inc (com les "susp" de la xarxa pròpia)
  const until = live ? lastEnd || now : end;
  const expected = Math.round((until.getTime() - start.getTime()) / (30 * 60e3));
  const incomplete = (id) => {
    const nn = n(agg[`${id}|40`]?.nn);
    return nn != null && nn < expected - 4;
  };

  const stations = stationsMeta
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
        t: lim(t?.v ?? null, -40, 48),
        time: t ? `${t.t.slice(0, 19)}Z` : null,
        hr: lim(L(id, '33')?.v ?? null, 1, 100),
        wind: lim(kmh(wind?.v ?? null), 0, 200),
        dir: dir?.v ?? null,
        snow: lim(L(id, '38')?.v ?? null, 0, 1000),
        tmax: lim(A(id, 'mx', '40'), -40, 48),
        tmin: lim(A(id, 'mn', '42'), -40, 48),
        rain: lim(r1(A(id, 'sm', '35')), 0, 1000),
        rain1h: r35[id]?.length ? r1(r35[id].reduce((a, b) => a + b, 0)) : null,
        gust: lim(kmh(A(id, 'mx', '50', '53', '56')), 0, 250),
        ...(incomplete(id) ? { inc: true } : {}),
      };
    })
    .filter((s) => s.lat != null && s.lng != null && (live ? s.t != null || s.rain != null || s.wind != null : s.tmax != null || s.rain != null || s.gust != null));

  return {
    updated: now.toISOString(),
    // Fins on arriben les dades: la darrera lectura (avui, 24 h) o el final del dia
    latest: live ? (lastEnd ? lastEnd.toISOString() : null) : end.toISOString(),
    period: { kind: period.kind, ...(period.date ? { date: period.date } : {}), start: start.toISOString(), end: (live ? lastEnd : end)?.toISOString() ?? null },
    source: 'Servei Meteorològic de Catalunya (XEMA) · Dades obertes de la Generalitat de Catalunya',
    stations,
  };
}
