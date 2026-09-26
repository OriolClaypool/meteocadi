// Daily archiving cron — runs at 04:00 UTC via Vercel Cron. Self-healing: each run
// scans the last 7 complete days and archives any that are still missing, so a
// failed night gets backfilled automatically. ?backfill=N overrides the scan window.
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

async function ghPut(path, content, message, sha, token) {
  const body = {
    message,
    content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
    branch: GITHUB_BRANCH,
    ...(sha ? { sha } : {}),
  };
  const res = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub PUT ${path} → ${res.status}: ${err.slice(0, 300)}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  // Auth: accept Vercel Cron header or manual Bearer token.
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  if (cronSecret) {
    const auth = req.headers['authorization'] ?? '';
    if (auth !== `Bearer ${cronSecret}`) {
      console.warn('[arxiva] unauthorized request');
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  const apiKey  = (process.env.WU_API_KEY || '').trim() || 'b146442062ee4f8a86442062ee4f8acd';
  const ghToken = (process.env.GITHUB_TOKEN || '').trim().replace(/^["']|["']$/g, '');
  if (!ghToken) {
    console.error('[arxiva] GITHUB_TOKEN not set');
    return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });
  }
  console.log('[arxiva] token prefix', ghToken.slice(0, 4), 'length', ghToken.length);

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
      monthlyPath: `dades/${year}/resum-${year}-${month}.json`,
    };
  });

  console.log(`[arxiva] archiving ${targetDates.join(', ')}`);

  // Idempotency: skip days whose daily file already exists.
  const existingChecks = await Promise.all(dateInfos.map(info => ghGet(info.dailyPath, ghToken)));
  const toArchive = dateInfos.filter((_, i) => existingChecks[i] === null);
  const skipped   = dateInfos.filter((_, i) => existingChecks[i] !== null).map(info => info.date);

  if (targetDates.length === 1 && toArchive.length === 0) {
    console.log(`[arxiva] already archived ${targetDates[0]}, skipping`);
    return res.status(200).json({ status: 'skipped', date: targetDates[0], reason: 'already exists' });
  }
  if (toArchive.length === 0) {
    console.log(`[arxiva] nothing to archive, all of ${targetDates.join(', ')} already exist`);
    return res.status(200).json({ status: 'skipped', dates: targetDates, reason: 'already exists' });
  }

  // Fetch all stations once — the 7day summary covers every date we might need.
  const stationIds = Object.keys(STATIONS_META);
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
  const dailyDocs = {};
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
  }

  // Write daily files.
  for (const info of toArchive) {
    await ghPut(info.dailyPath, dailyDocs[info.date], `dades: arxiva ${info.date}`, null, ghToken);
    console.log(`[arxiva] wrote ${info.dailyPath}`);
  }

  // Update (or create) monthly aggregates, grouped by year-month so a
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
    const monthlyDoc = { year: group.year, month: group.month, days };

    await ghPut(
      group.monthlyPath,
      monthlyDoc,
      `dades: actualitza resum ${group.year}-${group.month}`,
      monthlyExisting?.sha ?? null,
      ghToken
    );
    console.log(`[arxiva] wrote ${group.monthlyPath}`);
  }

  const archivedDates = toArchive.map(info => info.date);
  if (targetDates.length === 1) {
    const date = archivedDates[0];
    return res.status(200).json({
      status:   'archived',
      date,
      stations: Object.fromEntries(stationIds.map(id => [id, dailyDocs[date].stations[id] !== null ? 'ok' : 'missing'])),
    });
  }

  return res.status(200).json({ status: 'archived', archived: archivedDates, skipped });
}
