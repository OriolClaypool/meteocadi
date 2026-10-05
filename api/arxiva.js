// Daily archiving cron — runs at 04:00 UTC via Vercel Cron. Self-healing: each run
// scans the last 7 complete days and archives any that are still missing, so a
// failed night gets backfilled automatically. ?backfill=N overrides the scan window.
//
// També desa les dades hora a hora de cada estació (dades/AAAA/hores/AAAA-MM-DD.json, a partir de les lectures de
// 5 minuts de history/all de WU): el dia més recent que falti dels darrers 7, un per nit (12 crides). Amb les mateixes
// lectures es corregeix la pluja del dia (vegeu dayRain): precipTotal és la corregida i precipTotalWU, la del resum de WU.
// Tot el que es desa en una execució va en un sol commit (API de dades de Git), perquè cada commit fa un build.
//
// Required env vars in Vercel:
//   WU_API_KEY    — Weather Underground API key
//   GITHUB_TOKEN  — fine-grained PAT with Contents read+write on OriolClaypool/meteocadi
//   CRON_SECRET   — random secret; add it in Vercel project settings and Vercel Cron
//                   will send it automatically as Authorization: Bearer <secret>

const STATIONS_META = {
  IBAG65:     { name: 'Bagà Nord',                  alt: 865  },
  IBAG67:     { name: 'Refugi de Rebost',           alt: 1650 },
  IBAG72:     { name: 'Bagà Sud',                   alt: 770  },
  IBAG73:     { name: 'Bagà Centre',                alt: 798  },
  IGISCL6:    { name: 'Tancalaporta',               alt: 2440 },
  IGSOL7:     { name: 'Pedraforca',                 alt: 2270 },
  IGUARD34:   { name: 'Coll de Pal - Puigllançada', alt: 2090 },
  ISANTJ138:  { name: 'Cerdanyola-Forcat',          alt: 1115 },
  IGSOL4:     { name: 'Gósol',                      alt: 1450 },
  ILANOU4:    { name: 'La Nou de Berguedà',          alt: 940  },
  ISANTJ53:   { name: 'Cerdanyola-Poble',            alt: 964  },
  IBARCELO40: { name: 'La Pobla de Lillet',          alt: 843  },
};

const GITHUB_REPO  = 'OriolClaypool/meteocadi';
const GITHUB_BRANCH = 'main';
const GITHUB_API   = 'https://api.github.com';

// Returns "YYYY-MM-DD" for N days ago in UTC (n=1 → yesterday).
function dateNDaysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// Totes les lectures d'un dia (cada 5 minuts, history/all de WU) d'una estació: d'aquí surten les dades hora a hora
// i la pluja real del dia. Algunes consoles (la Pobla de Lillet, la Nou de Berguedà, Cerdanyola-Poble) posen a zero el
// comptador de pluja a mitjanit UTC (les 2 o la 1 de la matinada): fins aleshores la lectura porta el total d'ahir, i el
// resum diari de WU (el valor més alt del dia) dona el d'ahir o es menja la pluja de la matinada.
const at = (o, k) => k.split('.').reduce((x, p) => (x == null ? x : x[p]), o) ?? null;
const num = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const round = (v, d = 1) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// Pluja d'una sèrie del comptador (en ordre): si en algun moment baixa (s'ha posat a zero), es compten només els
// increments, prenent la primera lectura com a punt de partida; si no baixa mai, el comptador es va posar a zero a
// mitjanit i la darrera lectura ja és la pluja del dia.
export function dayRain(values) {
  const v = values.filter((x) => x != null && x >= 0);
  if (!v.length) return null;
  if (!v.some((x, i) => i > 0 && x < v[i - 1])) return round(v[v.length - 1], 2);
  let acc = 0;
  for (let i = 1; i < v.length; i++) acc += v[i] >= v[i - 1] ? v[i] - v[i - 1] : v[i];
  return round(acc, 2);
}

// Agrega les lectures de 5 minuts per hores: { h: [0..23], tempAvg, tempHigh, tempLow, dewptAvg, humidityAvg,
// windspeedAvg, windgustHigh, winddirAvg (mitjana de vectors), rain (mm en aquella hora), pressure, solarRadiationHigh, uvHigh }
export function hourly(obs) {
  const H = new Map();
  for (const o of obs) {
    const h = Number(String(o.obsTimeLocal).slice(11, 13));
    if (!H.has(h)) H.set(h, []);
    H.get(h).push(o);
  }
  const out = { h: [], tempAvg: [], tempHigh: [], tempLow: [], dewptAvg: [], humidityAvg: [], windspeedAvg: [], windgustHigh: [], winddirAvg: [], rain: [], pressure: [], solarRadiationHigh: [], uvHigh: [] };
  let prev = null; // darrer valor del comptador de pluja de l'hora anterior
  for (const h of [...H.keys()].sort((a, b) => a - b)) {
    const os = H.get(h);
    const col = (k) => os.map((o) => num(at(o, k))).filter((x) => x != null);
    const mx = (k) => (col(k).length ? Math.max(...col(k)) : null);
    const mn = (k) => (col(k).length ? Math.min(...col(k)) : null);
    let rain = 0, any = false;
    for (const o of os) {
      const v = num(at(o, 'metric.precipTotal'));
      if (v == null || v < 0) continue;
      if (prev != null) rain += v >= prev ? v - prev : v;
      prev = v;
      any = true;
    }
    // Direcció: mitjana dels vectors, pesats pel vent
    let x = 0, y = 0;
    for (const o of os) {
      const d = num(o.winddirAvg), w = num(at(o, 'metric.windspeedAvg'));
      if (d == null) continue;
      const k = w == null ? 1 : Math.max(w, 0.1);
      x += k * Math.sin((d * Math.PI) / 180);
      y += k * Math.cos((d * Math.PI) / 180);
    }
    const pres = os.map((o) => mean([num(at(o, 'metric.pressureMax')), num(at(o, 'metric.pressureMin'))].filter((v) => v != null))).filter((v) => v != null);
    out.h.push(h);
    out.tempAvg.push(round(mean(col('metric.tempAvg'))));
    out.tempHigh.push(round(mx('metric.tempHigh')));
    out.tempLow.push(round(mn('metric.tempLow')));
    out.dewptAvg.push(round(mean(col('metric.dewptAvg'))));
    out.humidityAvg.push(round(mean(col('humidityAvg')), 0));
    out.windspeedAvg.push(round(mean(col('metric.windspeedAvg'))));
    out.windgustHigh.push(round(mx('metric.windgustHigh')));
    out.winddirAvg.push(x || y ? Math.round(((Math.atan2(x, y) * 180) / Math.PI + 360) % 360) : null);
    out.rain.push(any ? round(rain, 2) : null);
    out.pressure.push(round(mean(pres)));
    out.solarRadiationHigh.push(mx('solarRadiationHigh'));
    out.uvHigh.push(mx('uvHigh'));
  }
  return out;
}

async function fetchAll(stationId, date, apiKey) {
  const url = `https://api.weather.com/v2/pws/history/all?stationId=${stationId}&format=json&units=m&date=${date.replace(/-/g, '')}&numericPrecision=decimal&apiKey=${apiKey}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`WU all ${res.status} for ${stationId}`);
  const obs = ((await res.json())?.observations || []).filter((o) => String(o.obsTimeLocal || '').startsWith(date)).sort((a, b) => a.epoch - b.epoch);
  if (!obs.length) return null;
  return { hours: hourly(obs), rain: dayRain(obs.map((o) => num(at(o, 'metric.precipTotal')))), n: obs.length };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchDailySummary(stationId, apiKey) {
  const url = `https://api.weather.com/v2/pws/dailysummary/7day?stationId=${stationId}&format=json&units=m&apiKey=${apiKey}&numericPrecision=decimal`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WU ${res.status} for ${stationId}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function extractDay(data, targetDate) {
  const summaries = data?.summaries;
  if (!Array.isArray(summaries)) return null;
  return summaries.find(s => s.obsTimeLocal?.slice(0, 10) === targetDate) ?? null;
}

function pickFields(s) {
  if (!s) return null;
  const m = s.imperial ?? s.metric ?? s;
  return {
    tempHigh:      s.tempHigh    ?? m.tempHigh    ?? null,
    tempLow:       s.tempLow     ?? m.tempLow     ?? null,
    tempAvg:       s.tempAvg     ?? m.tempAvg     ?? null,
    dewptAvg:      m.dewptAvg    ?? null,
    windspeedAvg:  m.windspeedAvg ?? null,
    windgustHigh:  m.windgustHigh ?? null,
    windgustAvgDir: s.windgustAvgDir ?? null,
    winddirAvg:    s.winddirAvg ?? null,
    precipTotal:   m.precipTotal ?? null,
    pressureMax:   m.pressureMax ?? null,
    pressureMin:   m.pressureMin ?? null,
    humidityHigh:  s.humidityHigh ?? null,
    humidityLow:   s.humidityLow  ?? null,
    humidityAvg:   s.humidityAvg  ?? null,
    uvHigh:        s.uvHigh       ?? null,
    solarRadiationHigh: s.solarRadiationHigh ?? null,
  };
}

// GitHub Contents API helpers

async function ghGet(path, token) {
  const res = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub GET ${path} → ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function gh(method, path, token, body) {
  const res = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.text();
    const e = new Error(`GitHub ${method} ${path} → ${res.status}: ${err.slice(0, 300)}`);
    e.status = res.status;
    throw e;
  }
  return res.json();
}

// Un sol commit amb tots els fitxers ({ camí: contingut en text }) a la branca principal. Si mentrestant algú hi
// ha fet un altre commit (la referència ja no avança directament), es torna a provar sobre el nou.
async function commitFiles(files, message, token) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await gh('GET', `/git/ref/heads/${GITHUB_BRANCH}`, token);
    const parent = ref.object.sha;
    const base = await gh('GET', `/git/commits/${parent}`, token);
    const tree = await gh('POST', '/git/trees', token, {
      base_tree: base.tree.sha,
      tree: Object.entries(files).map(([path, content]) => ({ path, mode: '100644', type: 'blob', content })),
    });
    const commit = await gh('POST', '/git/commits', token, { message, tree: tree.sha, parents: [parent] });
    try {
      await gh('PATCH', `/git/refs/heads/${GITHUB_BRANCH}`, token, { sha: commit.sha, force: false });
      return commit.sha;
    } catch (e) {
      if (e.status !== 422 || attempt === 2) throw e;
      console.warn('[arxiva] la branca ha canviat mentrestant, es torna a provar');
    }
  }
}

export default async function handler(req, res) {
  // Auth: accept Vercel Cron header or manual Bearer token.
  // Amb CRON_SECRET (recomanat), Vercel l'envia a cada execució del cron i és l'única manera d'entrar.
  // Sense, com a mínim només s'accepta el cron de Vercel (porta la capçalera x-vercel-cron-schedule), no qualsevol visita.
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  if (cronSecret) {
    const auth = req.headers['authorization'] ?? '';
    if (auth !== `Bearer ${cronSecret}`) {
      console.warn('[arxiva] unauthorized request');
      return res.status(401).json({ error: 'unauthorized' });
    }
  } else if (!req.headers['x-vercel-cron-schedule'] && !String(req.headers['user-agent'] || '').startsWith('vercel-cron')) {
    console.warn('[arxiva] no CRON_SECRET and not the Vercel cron');
    return res.status(401).json({ error: 'unauthorized' });
  }

  const apiKey  = (process.env.WU_API_KEY || '').trim() || 'b146442062ee4f8a86442062ee4f8acd';
  const ghToken = (process.env.GITHUB_TOKEN || '').trim().replace(/^["']|["']$/g, '');
  if (!ghToken) {
    console.error('[arxiva] GITHUB_TOKEN not set');
    return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });
  }

  // By default, self-heal: scan the last 7 complete days and archive any that are
  // still missing (so a failed night gets backfilled by the next run automatically).
  // ?backfill=N overrides the scan window (max 7).
  let daysToScan = 7;
  const backfillParam = Array.isArray(req.query?.backfill) ? req.query.backfill[0] : req.query?.backfill;
  if (backfillParam !== undefined) {
    const parsed = parseInt(backfillParam, 10);
    if (Number.isFinite(parsed) && parsed > 0) daysToScan = Math.min(parsed, 7);
  }

  const targetDates = [];
  for (let i = 1; i <= daysToScan; i++) targetDates.push(dateNDaysAgo(i));
  targetDates.sort();

  const dateInfos = targetDates.map(date => {
    const [year, month] = date.split('-');
    return {
      date, year, month,
      dailyPath:   `dades/${year}/${date}.json`,
      hourlyPath:  `dades/${year}/hores/${date}.json`,
      monthlyPath: `dades/${year}/resum-${year}-${month}.json`,
    };
  });

  console.log(`[arxiva] archiving ${targetDates.join(', ')}`);

  // Idempotency: skip days whose daily (or hourly) file already exists.
  const [dailyChecks, hourlyChecks] = await Promise.all([
    Promise.all(dateInfos.map(info => ghGet(info.dailyPath, ghToken))),
    Promise.all(dateInfos.map(info => ghGet(info.hourlyPath, ghToken))),
  ]);
  const toArchive = dateInfos.filter((_, i) => dailyChecks[i] === null);
  const skipped   = dateInfos.filter((_, i) => dailyChecks[i] !== null).map(info => info.date);
  // Hora a hora: el dia més recent que falti primer
  const hoursMissing = dateInfos.filter((_, i) => hourlyChecks[i] === null).reverse();

  if (toArchive.length === 0 && hoursMissing.length === 0) {
    console.log(`[arxiva] nothing to archive, all of ${targetDates.join(', ')} already exist`);
    return res.status(200).json({ status: 'skipped', dates: targetDates, reason: 'already exists' });
  }

  const stationIds = Object.keys(STATIONS_META);
  const files = {};
  const dailyDocs = {};

  if (toArchive.length) {
    // Fetch all stations once — the 7day summary covers every date we might need.
    const results = await Promise.allSettled(
      stationIds.map(id => fetchDailySummary(id, apiKey))
    );
    for (let i = 0; i < stationIds.length; i++) {
      const id = stationIds[i];
      const r  = results[i];
      if (r.status === 'rejected') console.error(`[arxiva] ${id} fetch error:`, r.reason?.message ?? r.reason);
      else console.log(`[arxiva] ${id}: fetched OK`);
    }

    // Build a daily doc per date that needs archiving.
    for (const info of toArchive) {
      const stations = {};
      for (let i = 0; i < stationIds.length; i++) {
        const id = stationIds[i];
        const r  = results[i];
        if (r.status === 'rejected') {
          stations[id] = null;
          continue;
        }
        const dayEntry = extractDay(r.value, info.date);
        if (!dayEntry) {
          console.warn(`[arxiva] ${id}: no entry for ${info.date}`);
          stations[id] = null;
          continue;
        }
        stations[id] = pickFields(dayEntry);
      }
      dailyDocs[info.date] = { date: info.date, stations };
      files[info.dailyPath] = JSON.stringify(dailyDocs[info.date], null, 2);
    }

  }

  // Hora a hora: una estació rere l'altra, espaiades (WU: 30 crides per minut com a molt, i la web també en fa).
  // Un dia per execució (el més recent que falti). Si aquell dia també s'arxiva ara, se'n corregeix la pluja.
  const hoursDone = [];
  for (const info of hoursMissing.slice(0, 1)) {
    const stations = {};
    let ok = 0;
    for (const id of stationIds) {
      try {
        const all = await fetchAll(id, info.date, apiKey);
        stations[id] = all ? all.hours : null;
        if (all) ok++;
        const day = dailyDocs[info.date]?.stations?.[id];
        if (all && day && all.rain != null) {
          day.precipTotalWU = day.precipTotal;
          day.precipTotal = all.rain;
        }
      } catch (e) {
        console.error(`[arxiva] ${id} all ${info.date}:`, e?.message ?? e);
        stations[id] = null;
      }
      await sleep(1500);
    }
    if (dailyDocs[info.date]) files[info.dailyPath] = JSON.stringify(dailyDocs[info.date], null, 2);
    if (!ok) continue; // cap estació: es tornarà a provar la nit següent
    // Una estació per línia: fitxer petit i encara llegible
    const lines = stationIds.map(id => `    ${JSON.stringify(id)}: ${JSON.stringify(stations[id])}`);
    files[info.hourlyPath] = `{\n  "date": ${JSON.stringify(info.date)},\n  "stations": {\n${lines.join(',\n')}\n  }\n}\n`;
    hoursDone.push(info.date);
  }

  // Update (or create) monthly aggregates (after the rain correction above), grouped by year-month so a
  // backfill spanning a month boundary updates each file correctly.
  const monthGroups = new Map();
  for (const info of toArchive) {
    const key = `${info.year}-${info.month}`;
    if (!monthGroups.has(key)) {
      monthGroups.set(key, { monthlyPath: info.monthlyPath, year: info.year, month: info.month, dates: [] });
    }
    monthGroups.get(key).dates.push(info.date);
  }
  for (const group of monthGroups.values()) {
    const monthlyExisting = await ghGet(group.monthlyPath, ghToken);
    const days = monthlyExisting
      ? (JSON.parse(Buffer.from(monthlyExisting.content, 'base64').toString('utf8')).days ?? [])
      : [];
    for (const date of group.dates) {
      const idx = days.findIndex(d => d.date === date);
      if (idx >= 0) days[idx] = dailyDocs[date];
      else days.push(dailyDocs[date]);
    }
    days.sort((a, b) => a.date.localeCompare(b.date));
    files[group.monthlyPath] = JSON.stringify({ year: group.year, month: group.month, days }, null, 2);
  }

  if (!Object.keys(files).length) {
    return res.status(200).json({ status: 'nothing-written', skipped });
  }
  const archivedDates = toArchive.map(info => info.date);
  const what = archivedDates.length ? archivedDates.join(', ') : `hores ${hoursDone.join(', ')}`;
  const sha = await commitFiles(files, `dades: arxiva ${what}`, ghToken);
  for (const f of Object.keys(files)) console.log(`[arxiva] wrote ${f}`);
  console.log(`[arxiva] commit ${sha}`);

  return res.status(200).json({
    status: 'archived',
    archived: archivedDates,
    hours: hoursDone,
    skipped,
    stations: archivedDates.length
      ? Object.fromEntries(stationIds.map(id => [id, dailyDocs[archivedDates[archivedDates.length - 1]].stations[id] !== null ? 'ok' : 'missing']))
      : undefined,
  });
}
