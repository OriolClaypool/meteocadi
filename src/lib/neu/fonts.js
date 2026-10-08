// Meteocadí Neu: previsió d'Open-Meteo per a les estacions d'esquí (al servidor: funcions de /api i build).
// - previsio(resorts): totes les estacions, dia a dia (7 dies i 5 enrere), al cim i a la base
// - horaria(resort): una estació, hora a hora, avui i demà, al cim i a la base
// No fa servir la memòria de build de mountain.js: a les funcions, la instància viu hores i la previsió canvia.
import { mountainUrl, parseMountain } from '../mountain.js';
import { todayMadrid } from '../format.js';

const OM = 'https://api.open-meteo.com/v1/forecast';
const PAST = 5;
const DAYS = 7;

async function getJson(url, ms) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { 'User-Agent': 'meteocadi.cat' } });
  if (!r.ok) throw new Error(`Open-Meteo HTTP ${r.status}`);
  return r.json();
}

// { updated, today, resorts: { slug: { top: [dies], base: [dies] } } }
export async function previsio(resorts, ms = 15000) {
  const points = resorts.flatMap((r) => r.points);
  const json = await getJson(mountainUrl(points, DAYS, PAST), ms);
  const data = parseMountain(json, points);
  const out = {};
  resorts.forEach((r, k) => {
    const top = data[2 * k]?.days ?? [];
    const base = data[2 * k + 1]?.days ?? [];
    if (top.length) out[r.slug] = { top, base };
  });
  if (!Object.keys(out).length) throw new Error('Open-Meteo: resposta buida');
  return { updated: new Date().toISOString(), today: todayMadrid(), source: 'Open-Meteo', resorts: out };
}

const HOURLY = 'temperature_2m,precipitation,snowfall,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility,freezing_level_height';

// { updated, slug, hours: [{ t: '2026-01-14T08:00', iso, top: {...}, base: {...} }] }
export async function horaria(resort, ms = 12000) {
  const p = new URLSearchParams({
    latitude: resort.points.map((x) => x.lat).join(','),
    longitude: resort.points.map((x) => x.lng).join(','),
    elevation: resort.points.map((x) => x.alt).join(','),
    hourly: HOURLY,
    timezone: 'Europe/Madrid',
    forecast_days: '2',
  });
  const json = await getJson(`${OM}?${p}`, ms);
  const arr = Array.isArray(json) ? json : [json];
  const [T, B] = [arr[0], arr[arr.length - 1]];
  if (!T?.hourly?.time?.length) throw new Error('Open-Meteo: sense hores');
  const off = (T.utc_offset_seconds ?? 0) * 1000;
  const pick = (j, i) => {
    const h = j?.hourly;
    if (!h) return null;
    const v = (k) => (h[k]?.[i] ?? null);
    return { temp: v('temperature_2m'), precip: v('precipitation'), snow: v('snowfall'), code: v('weather_code'), wind: v('wind_speed_10m'), gust: v('wind_gusts_10m'), dir: v('wind_direction_10m'), vis: v('visibility'), frz: v('freezing_level_height') };
  };
  const hours = T.hourly.time.map((t, i) => ({ t, iso: new Date(Date.parse(`${t}:00Z`) - off).toISOString(), top: pick(T, i), base: pick(B, i) }));
  return { updated: new Date().toISOString(), slug: resort.slug, source: 'Open-Meteo', hours };
}
