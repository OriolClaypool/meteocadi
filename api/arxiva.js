// Daily archiving cron — runs at 04:00 UTC via Vercel Cron, archives yesterday's data.
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

// Returns "YYYY-MM-DD" for yesterday in UTC.
function yesterday() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
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
  if (!res.ok) throw new Error(`GitHub GET ${path} → ${res.status}`);
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
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers['authorization'] ?? '';
    if (auth !== `Bearer ${cronSecret}`) {
      console.warn('[arxiva] unauthorized request');
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  const apiKey = process.env.WU_API_KEY || 'b146442062ee4f8a86442062ee4f8acd';
  const ghToken = process.env.GITHUB_TOKEN;
  if (!ghToken) {
    console.error('[arxiva] GITHUB_TOKEN not set');
    return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });
  }

  const date = yesterday();
  const [year, month] = date.split('-');
  const dailyPath   = `dades/${year}/${date}.json`;
  const monthlyPath = `dades/${year}/resum-${year}-${month}.json`;

  console.log(`[arxiva] archiving ${date}`);

  // Idempotency: skip if daily file already exists.
  const existing = await ghGet(dailyPath, ghToken);
  if (existing) {
    console.log(`[arxiva] already archived ${date}, skipping`);
    return res.status(200).json({ status: 'skipped', date, reason: 'already exists' });
  }

  // Fetch all stations in parallel.
  const stationIds = Object.keys(STATIONS_META);
  const results = await Promise.allSettled(
    stationIds.map(id => fetchDailySummary(id, apiKey))
  );

  const stations = {};
  for (let i = 0; i < stationIds.length; i++) {
    const id = stationIds[i];
    const r  = results[i];
    if (r.status === 'rejected') {
      console.error(`[arxiva] ${id} fetch error:`, r.reason?.message ?? r.reason);
      stations[id] = null;
      continue;
    }
    const dayEntry = extractDay(r.value, date);
    if (!dayEntry) {
      console.warn(`[arxiva] ${id}: no entry for ${date}`);
      stations[id] = null;
      continue;
    }
    stations[id] = pickFields(dayEntry);
    console.log(`[arxiva] ${id}: OK`);
  }

  const dailyDoc = { date, stations };

  // Write daily file.
  await ghPut(dailyPath, dailyDoc, `dades: arxiva ${date}`, null, ghToken);
  console.log(`[arxiva] wrote ${dailyPath}`);

  // Update (or create) monthly aggregate.
  const monthlyExisting = await ghGet(monthlyPath, ghToken);
  let monthlyDoc;
  if (monthlyExisting) {
    const current = JSON.parse(Buffer.from(monthlyExisting.content, 'base64').toString('utf8'));
    // Replace entry for this date if it exists, otherwise append.
    const days = Array.isArray(current.days) ? current.days : [];
    const idx  = days.findIndex(d => d.date === date);
    if (idx >= 0) days[idx] = dailyDoc;
    else days.push(dailyDoc);
    days.sort((a, b) => a.date.localeCompare(b.date));
    monthlyDoc = { year, month, days };
  } else {
    monthlyDoc = { year, month, days: [dailyDoc] };
  }

  await ghPut(
    monthlyPath,
    monthlyDoc,
    `dades: actualitza resum ${year}-${month}`,
    monthlyExisting?.sha ?? null,
    ghToken
  );
  console.log(`[arxiva] wrote ${monthlyPath}`);

  return res.status(200).json({
    status:   'archived',
    date,
    stations: Object.fromEntries(stationIds.map(id => [id, stations[id] !== null ? 'ok' : 'missing'])),
  });
}
