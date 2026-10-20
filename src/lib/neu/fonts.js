// Meteocadí Neu: previsió d'Open-Meteo per a les estacions d'esquí (al servidor: funcions de /api i build).
// - previsio(resorts): totes les estacions, dia a dia (7 dies i 5 enrere), al cim i a la base
// - horaria(resort): una estació, hora a hora, avui i demà, al cim i a la base
// No fa servir la memòria de build de mountain.js: a les funcions, la instància viu hores i la previsió canvia.
import { mountainUrl, parseMountain } from '../mountain.js';
import { todayMadrid } from '../format.js';

const OM = 'https://api.open-meteo.com/v1/forecast';
const PAST = 5;
const DAYS = 7;

// Neu a l'altura del punt. Open-Meteo reparteix la precipitació entre pluja i neu amb la temperatura de la seva
// cel·la, que sovint és més baixa (i més calenta) que el cim: el 17 de gener de 2026 donava 10 cm a dalt d'Espot (34 mm
// amb −4 °C al cim i la isoterma a 1.850 m) i el sensor d'Espot (2.519 m) va mesurar 47 cm més en 24 hores; a Port del
// Comte, 7 cm previstos i 29 mesurats. Per sobre de la isoterma de 0 °C tota la precipitació és neu, i entre la cota
// de neu (300 m per sota) i la isoterma, una part; per sota de la cota de neu no es toca res (el 18 d'octubre de 2026,
// amb la isoterma a 2.900 m, Oriol: "la cota està molt més amunt"). La neu és la precipitació per la relació neu/aigua:
// 0,7 cm per mm a 0 °C (la d'Open-Meteo) i fins a 1 cm per mm a −5 °C o menys. També neva si al punt la màxima no
// passa de 0 °C (la isoterma surt de la cel·la del model, que no sempre lliga amb la temperatura del cim: a Guils, el
// 18 de gener, isoterma a 2.300 m i màxima de 0,2 °C a 2.080 m). Si al punt no baixa de 2 °C en tot el dia, no hi
// neva. Mai menys neu que la del model.
const clamp01 = (v) => Math.max(0, Math.min(1, v));
export function snowAt(alt, { precip, snow, frz, tmax, tmin }) {
  if (precip == null || precip < 0.1 || (frz == null && tmax == null)) return snow;
  // Per la isoterma: 0 a la cota de neu i per sota, 1 a la isoterma i per sobre. Per la màxima del punt: 1 fins a
  // −0,5 °C, 0 des d'1,5 °C. Mana la que dona més neu, i compta menys com més calenta sigui la mínima.
  const byLine = frz == null ? 0 : clamp01((alt - (frz - 300)) / 300);
  const byTemp = tmax == null ? 0 : clamp01((1.5 - tmax) / 2);
  const frac = Math.max(byLine, byTemp) * (tmin == null ? 1 : clamp01((2 - tmin) / 2));
  const t = tmax != null && tmin != null ? (tmax + tmin) / 2 : tmax ?? 0;
  const ratio = 0.7 + 0.3 * clamp01(-t / 5);
  return Math.max(snow ?? 0, Math.round(frac * ratio * precip * 100) / 100);
}
const fixDay = (d, alt) => ({ ...d, snow: snowAt(alt, { precip: d.precip, snow: d.snow, frz: d.frz ? (d.frz.min + d.frz.max) / 2 : null, tmax: d.max, tmin: d.min }) });

async function getJson(url, ms) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { 'User-Agent': 'meteocadi.cat' } });
  if (!r.ok) throw new Error(`Open-Meteo HTTP ${r.status}`);
  return r.json();
}

// { updated, today, resorts: { slug: { top: [dies], base: [dies] } } }
// Cada dia porta també el gruix de neu del model a les 9 h (depth, cm): la nota (nota.js) el fa servir quan no hi ha
// cap sensor de la XEMA a prop de l'estació, i per saber com canviarà el gruix els dies següents.
export async function previsio(resorts, ms = 15000) {
  const points = resorts.flatMap((r) => r.points);
  const json = await getJson(mountainUrl(points, DAYS, PAST, { depth: true }), ms);
  const data = parseMountain(json, points);
  const out = {};
  resorts.forEach((r, k) => {
    const top = (data[2 * k]?.days ?? []).map((d) => fixDay(d, r.points[0].alt));
    const base = (data[2 * k + 1]?.days ?? []).map((d) => fixDay(d, r.points[1].alt));
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
  const pick = (j, i, alt) => {
    const h = j?.hourly;
    if (!h) return null;
    const v = (k) => (h[k]?.[i] ?? null);
    const temp = v('temperature_2m');
    const precip = v('precipitation');
    const frz = v('freezing_level_height');
    // La neu de l'hora, amb la mateixa correcció que la diària (snowAt)
    const snow = snowAt(alt, { precip, snow: v('snowfall'), frz, tmax: temp, tmin: temp });
    return { temp, precip, snow, code: v('weather_code'), wind: v('wind_speed_10m'), gust: v('wind_gusts_10m'), dir: v('wind_direction_10m'), vis: v('visibility'), frz };
  };
  const [aT, aB] = [resort.points[0].alt, resort.points[resort.points.length - 1].alt];
  const hours = T.hourly.time.map((t, i) => ({ t, iso: new Date(Date.parse(`${t}:00Z`) - off).toISOString(), top: pick(T, i, aT), base: pick(B, i, aB) }));
  return { updated: new Date().toISOString(), slug: resort.slug, source: 'Open-Meteo', hours };
}
