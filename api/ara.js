// Dades en directe de TOTES les estacions en una sola resposta, amb memòria cau a la CDN.
//
// Per què: abans cada visita demanava les 12 estacions a Weather Underground des del navegador.
// La clau de WU permet 1.500 crides al dia i 30 per minut; amb poc trànsit ja es podia exhaurir.
// Ara el servidor fa com a màxim 12 crides cada 15 minuts, independentment de les visites.
//
// Per estació retorna: lectura actual, màxima/mínima/ratxa d'avui i la sèrie d'avui cada 15 min.
// Control de qualitat (src/lib/qc.js): els valors impossibles o incoherents amb les veïnes surten a null, i
// l'estació porta bad: ['rain', 'wind', 'temp'] amb el que s'ha descartat. Si els sensors exteriors no donen
// res (temperatura, humitat i vent buits), l'estació surt com a down (fora de servei) i també stale.
import { STATIONS } from '../src/lib/stations.js';
import { LIMITS, clean, despike, rainSuspects, windSuspects, tempSuspects, rainSpikes, gustSpikes, rainFromCounter } from '../src/lib/qc.js';
import { onlyCleanUrl } from './_net.js';

const KEY = () => process.env.WU_API_KEY || 'b146442062ee4f8a86442062ee4f8acd';
const BASE = 'https://api.weather.com/v2/pws/observations';

function todayMadrid(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

const r1 = (v) => (v == null || isNaN(v) ? null : Math.round(Number(v) * 10) / 10);
const T = (v) => r1(clean(v, LIMITS.temp));
const MAXOF = (xs) => (xs.length ? Math.max(...xs) : null);
const MINOF = (xs) => (xs.length ? Math.min(...xs) : null);

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fromAllDay(id) {
  const j = await getJson(`${BASE}/all/1day?stationId=${id}&format=json&units=m&numericPrecision=decimal&apiKey=${KEY()}`);
  const obs = (j?.observations || []).filter((o) => o && o.metric).sort((a, b) => a.epoch - b.epoch);
  if (!obs.length) throw new Error('no data');
  const last = obs[obs.length - 1];
  const m = last.metric;
  const today = todayMadrid();
  // Temperatura de cada lectura, sense valors impossibles ni pics aïllats
  const tAvg = despike(obs.map((o) => o.epoch), obs.map((o) => T(o.metric.tempAvg)));
  const bad = new Set(obs.map((o, i) => (T(o.metric.tempAvg) != null && tAvg[i] == null ? i : -1)).filter((i) => i >= 0));
  const todays = obs.map((o, i) => i).filter((i) => String(obs[i].obsTimeLocal || '').slice(0, 10) === today);
  const pool = todays.length ? todays : [obs.length - 1];
  // Màxima i mínima de cada lectura (si s'allunya més de 6 °C de la mitjana de la mateixa lectura, és un pic)
  const ext = (i, k) => {
    const a = tAvg[i];
    const e = T(obs[i].metric[k]);
    if (bad.has(i)) return null;
    return e != null && (a == null || Math.abs(e - a) <= 6) ? e : a;
  };
  const hi = MAXOF(pool.map((i) => ext(i, 'tempHigh')).filter((v) => v != null));
  const lo = MINOF(pool.map((i) => ext(i, 'tempLow')).filter((v) => v != null));
  const gustMax = MAXOF(pool.map((i) => clean(obs[i].metric.windgustHigh, LIMITS.gust)).filter((v) => v != null));
  // Vent mitjà d'avui (per al control de ratxes impossibles, gustSpikes)
  const winds = pool.map((i) => clean(obs[i].metric.windspeedAvg, LIMITS.wind)).filter((v) => v != null);
  const windAvg = winds.length ? winds.reduce((a, b) => a + b, 0) / winds.length : null;
  // Pluja des de mitjanit comptant només els increments del comptador de la consola: algunes el posen a zero una
  // o dues hores tard i, fins aleshores, la lectura dona el total d'ahir (vegeu rainFromCounter). El punt de partida
  // és la darrera lectura d'ahir.
  const rainDay = new Array(obs.length).fill(null);
  if (todays.length) {
    const from = Math.max(0, todays[0] - 1);
    const idx = obs.map((o, i) => i).slice(from);
    const acc = rainFromCounter(idx.map((i) => clean(obs[i].metric.precipTotal, LIMITS.rain)));
    // Si no hi ha cap lectura d'ahir, la primera d'avui ja és pluja des de mitjanit (comptador posat a zero)
    const first = from === todays[0] ? clean(obs[from].metric.precipTotal, LIMITS.rain) ?? 0 : 0;
    idx.forEach((i, k) => { if (i >= todays[0] && acc[k] != null) rainDay[i] = r1(acc[k] + first); });
  }

  // Sèrie cada 15 minuts (per a minigràfics i gràfics de la pàgina de l'estació)
  // rain: el comptador de la consola tal com arriba (per a increments: darrera hora, 24 hores); rainDay: pluja des de mitjanit
  const series = { t: [], temp: [], wind: [], gust: [], rain: [], rainDay: [], hum: [] };
  // Una lectura per quart d'hora: la primera amb temperatura vàlida (si un pic s'ha descartat, la següent)
  const slots = new Map();
  obs.forEach((o, i) => {
    const slot = Math.floor(o.epoch / 900);
    const cur = slots.get(slot);
    if (cur == null || (tAvg[cur] == null && tAvg[i] != null)) slots.set(slot, i);
  });
  [...slots.values()].forEach((i) => {
    const o = obs[i];
    series.t.push(o.epoch);
    series.temp.push(tAvg[i]);
    series.wind.push(r1(clean(o.metric.windspeedAvg, LIMITS.wind)));
    series.gust.push(r1(clean(o.metric.windgustHigh, LIMITS.gust)));
    series.rain.push(r1(clean(o.metric.precipTotal, LIMITS.rain)));
    series.rainDay.push(rainDay[i]);
    series.hum.push(clean(o.humidityAvg, LIMITS.hum));
  });

  const li = obs.length - 1;
  return {
    temp: tAvg[li],
    dewpt: T(m.dewptAvg),
    windchill: T(m.windchillAvg),
    heatindex: T(m.heatindexAvg),
    wind: r1(clean(m.windspeedAvg, LIMITS.wind)),
    gust: r1(clean(m.windgustHigh, LIMITS.gust)),
    dir: clean(last.winddirAvg, LIMITS.dir),
    hum: clean(last.humidityAvg, LIMITS.hum),
    pres: r1(clean(m.pressureMax, LIMITS.pres)),
    rain: todays.length ? rainDay[todays[todays.length - 1]] ?? 0 : 0,
    rainRate: r1(clean(m.precipRate, LIMITS.rain)),
    windAvg: r1(windAvg),
    max: r1(hi),
    min: r1(lo),
    gustMax: r1(gustMax),
    epoch: last.epoch,
    obsTime: last.obsTimeLocal ?? null,
    lat: last.lat ?? null,
    lon: last.lon ?? null,
    series,
  };
}

// Pla B: només la lectura actual
async function fromCurrent(id) {
  const j = await getJson(`${BASE}/current?stationId=${id}&format=json&units=m&numericPrecision=decimal&apiKey=${KEY()}`);
  const o = j?.observations?.[0];
  if (!o) throw new Error('no data');
  const m = o.metric || {};
  return {
    temp: T(m.temp), dewpt: T(m.dewpt), windchill: T(m.windChill), heatindex: T(m.heatIndex),
    wind: r1(clean(m.windSpeed, LIMITS.wind)), gust: r1(clean(m.windGust, LIMITS.gust)), dir: clean(o.winddir, LIMITS.dir),
    hum: clean(o.humidity, LIMITS.hum), pres: r1(clean(m.pressure, LIMITS.pres)), rain: r1(clean(m.precipTotal, LIMITS.rain)),
    rainRate: r1(clean(m.precipRate, LIMITS.rain)),
    max: null, min: null, gustMax: null,
    epoch: o.epoch ?? null, obsTime: o.obsTimeLocal ?? null, lat: o.lat ?? null, lon: o.lon ?? null,
    series: null,
  };
}

async function station(id) {
  try {
    return await fromAllDay(id);
  } catch (e1) {
    try {
      return await fromCurrent(id);
    } catch (e2) {
      console.error('[ara]', id, String(e1), String(e2));
      return null;
    }
  }
}

// Control de qualitat de tota la xarxa (cal comparar cada estació amb les veïnes)
const OUTDOOR = ['temp', 'dewpt', 'windchill', 'heatindex', 'wind', 'windAvg', 'gust', 'dir', 'hum', 'rain', 'rainRate', 'max', 'min', 'gustMax'];
const DROP = {
  rain: { keys: ['rain', 'rainRate'], series: ['rain', 'rainDay'] },
  wind: { keys: ['wind', 'windAvg', 'gust', 'dir', 'gustMax'], series: ['wind', 'gust'] },
  temp: { keys: ['temp', 'dewpt', 'windchill', 'heatindex', 'max', 'min'], series: ['temp'] },
};
export function qualityControl(stations) {
  const live = Object.entries(stations).filter(([, d]) => d && !d.stale);
  const drop = (d, what) => {
    for (const k of DROP[what].keys) d[k] = null;
    if (d.series) for (const k of DROP[what].series) if (d.series[k]) d.series[k] = d.series[k].map(() => null);
    d.bad = [...new Set([...(d.bad || []), what])];
  };
  // Fora de servei: la lectura no porta res dels sensors exteriors (només en queda la pressió de la consola)
  for (const [, d] of live) {
    if (d.temp == null && d.hum == null && d.wind == null) {
      for (const k of OUTDOOR) d[k] = null;
      d.series = null;
      d.down = true;
      d.stale = true;
    }
  }
  const ok = live.filter(([, d]) => !d.down);
  const pick = (k) => Object.fromEntries(ok.map(([id, d]) => [id, d[k]]));
  for (const id of new Set([...rainSuspects(pick('rain')), ...rainSpikes(pick('rain'))])) drop(stations[id], 'rain');
  for (const id of new Set([...windSuspects(pick('gustMax')), ...gustSpikes(pick('gustMax'), pick('windAvg'))])) drop(stations[id], 'wind');
  for (const id of tempSuspects(pick('temp'))) drop(stations[id], 'temp');
  for (const id of tempSuspects(pick('max'), 10)) stations[id].max = null;
  for (const id of tempSuspects(pick('min'), 10)) stations[id].min = null;
  return stations;
}

// Darrera resposta bona, reutilitzada mentre la instància de la funció segueix activa (si la CDN no la té)
let memo = null;

export default async function handler(req, res) {
  if (onlyCleanUrl(req, res, '/api/ara')) return;
  if (memo && Date.now() - memo.at < 5 * 60 * 1000) {
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800');
    res.status(200).json(memo.body);
    return;
  }
  const out = await Promise.all(STATIONS.map(async (s) => [s.id, await station(s.id)]));
  const now = Math.floor(Date.now() / 1000);
  const stations = {};
  for (const [id, d] of out) {
    if (d) d.stale = d.epoch ? now - d.epoch > 90 * 60 : false;
    stations[id] = d;
  }
  qualityControl(stations);
  const ok = out.filter(([, d]) => d && !d.stale).length;
  // Si no ha respost cap estació, no ho guardem a la memòria cau gaire estona
  res.setHeader('Cache-Control', ok ? 'public, s-maxage=900, stale-while-revalidate=1800' : 'public, s-maxage=60');
  const body = { updated: new Date().toISOString(), ok, total: STATIONS.length, stations };
  if (ok) memo = { at: Date.now(), body };
  res.status(200).json(body);
}
