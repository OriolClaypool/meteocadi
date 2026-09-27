// Dades en directe de TOTES les estacions en una sola resposta, amb memòria cau a la CDN.
//
// Per què: abans cada visita demanava les 12 estacions a Weather Underground des del navegador.
// La clau de WU permet 1.500 crides al dia i 30 per minut; amb poc trànsit ja es podia exhaurir.
// Ara el servidor fa com a màxim 12 crides cada 15 minuts, independentment de les visites.
//
// Per estació retorna: lectura actual, màxima/mínima/ratxa d'avui i la sèrie d'avui cada 15 min.
import { STATIONS } from '../src/lib/stations.js';

const KEY = () => process.env.WU_API_KEY || 'b146442062ee4f8a86442062ee4f8acd';
const BASE = 'https://api.weather.com/v2/pws/observations';

function todayMadrid(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

const r1 = (v) => (v == null || isNaN(v) ? null : Math.round(Number(v) * 10) / 10);

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
  const todays = obs.filter((o) => String(o.obsTimeLocal || '').slice(0, 10) === today);
  const pool = todays.length ? todays : [last];
  const hi = Math.max(...pool.map((o) => o.metric.tempHigh ?? o.metric.tempAvg ?? -99));
  const lo = Math.min(...pool.map((o) => o.metric.tempLow ?? o.metric.tempAvg ?? 99));
  const gustMax = Math.max(...pool.map((o) => o.metric.windgustHigh ?? 0));

  // Sèrie cada 15 minuts (per a minigràfics i gràfics de la pàgina de l'estació)
  const series = { t: [], temp: [], wind: [], gust: [], rain: [], hum: [] };
  let lastSlot = -1;
  for (const o of obs) {
    const slot = Math.floor(o.epoch / 900);
    if (slot === lastSlot) continue;
    lastSlot = slot;
    series.t.push(o.epoch);
    series.temp.push(r1(o.metric.tempAvg));
    series.wind.push(r1(o.metric.windspeedAvg));
    series.gust.push(r1(o.metric.windgustHigh));
    series.rain.push(r1(o.metric.precipTotal));
    series.hum.push(o.humidityAvg ?? null);
  }

  return {
    temp: r1(m.tempAvg),
    dewpt: r1(m.dewptAvg),
    windchill: r1(m.windchillAvg),
    heatindex: r1(m.heatindexAvg),
    wind: r1(m.windspeedAvg),
    gust: r1(m.windgustHigh),
    dir: last.winddirAvg ?? null,
    hum: last.humidityAvg ?? null,
    pres: r1(m.pressureMax),
    rain: r1(m.precipTotal),
    rainRate: r1(m.precipRate),
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
    temp: r1(m.temp), dewpt: r1(m.dewpt), windchill: r1(m.windChill), heatindex: r1(m.heatIndex),
    wind: r1(m.windSpeed), gust: r1(m.windGust), dir: o.winddir ?? null, hum: o.humidity ?? null,
    pres: r1(m.pressure), rain: r1(m.precipTotal), rainRate: r1(m.precipRate),
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

export default async function handler(req, res) {
  const out = await Promise.all(STATIONS.map(async (s) => [s.id, await station(s.id)]));
  const now = Math.floor(Date.now() / 1000);
  const stations = {};
  for (const [id, d] of out) {
    if (d) d.stale = d.epoch ? now - d.epoch > 90 * 60 : false;
    stations[id] = d;
  }
  const ok = out.filter(([, d]) => d && !d.stale).length;
  // Si no ha respost cap estació, no ho guardem a la memòria cau gaire estona
  res.setHeader('Cache-Control', ok ? 'public, s-maxage=900, stale-while-revalidate=1800' : 'public, s-maxage=60');
  res.status(200).json({ updated: new Date().toISOString(), ok, total: STATIONS.length, stations });
}
