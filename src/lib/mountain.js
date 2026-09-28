// Previsió de muntanya (Open-Meteo) per a un o més punts d'altitud coneguda:
// temperatura, sensació tèrmica, vent i ratxa, precipitació, neu i isoterma de 0 °C.
// Es fa servir en temps de build (text indexable) i al navegador (dades fresques).
import { num, dayName, dayShort, parseDay, longDate, cap } from './format.js';

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
const dir8 = (deg) => (deg == null || isNaN(deg) ? '' : DIRS[Math.round(deg / 45) % 8]);
const DIR_NAMES = { N: 'nord', NE: 'nord-est', E: 'est', SE: 'sud-est', S: 'sud', SO: 'sud-oest', O: 'oest', NO: 'nord-oest' };
// "Cim de la Tosa d'Alp" → "cim de la Tosa d'Alp" (els noms propis es queden igual)
export const lowerCommon = (s) => (/^(Cim|Carena|Base|Estació)\s/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const r0 = (v) => (v == null || isNaN(v) ? null : Math.round(v));
const thousands = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function mountainUrl(points, days = 3) {
  const p = new URLSearchParams({
    latitude: points.map((x) => x.lat).join(','),
    longitude: points.map((x) => x.lng).join(','),
    elevation: points.map((x) => x.alt).join(','),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_min,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,precipitation_sum,snowfall_sum',
    hourly: 'freezing_level_height',
    timezone: 'Europe/Madrid',
    forecast_days: String(days),
  });
  return `https://api.open-meteo.com/v1/forecast?${p}`;
}

// Isoterma de 0 °C del dia: mínim i màxim entre les 6 i les 21 h
function freezing(h, date) {
  if (!h?.time || !h.freezing_level_height) return null;
  const v = h.time
    .map((t, i) => [t, h.freezing_level_height[i]])
    .filter(([t, x]) => t.startsWith(date) && x != null && Number(t.slice(11, 13)) >= 6 && Number(t.slice(11, 13)) <= 21)
    .map(([, x]) => x);
  if (!v.length) return null;
  const round = (x) => Math.max(0, Math.round(x / 100) * 100);
  return { min: round(Math.min(...v)), max: round(Math.max(...v)) };
}

export function parseMountain(json, points) {
  const arr = Array.isArray(json) ? json : [json];
  return points.map((pt, k) => {
    const j = arr[k];
    const d = j?.daily;
    if (!d?.time) return { point: pt, days: [] };
    return {
      point: pt,
      days: d.time.map((date, i) => ({
        date,
        code: d.weather_code?.[i] ?? null,
        max: d.temperature_2m_max[i],
        min: d.temperature_2m_min[i],
        feels: d.apparent_temperature_min?.[i] ?? null,
        wind: d.wind_speed_10m_max?.[i] ?? null,
        gust: d.wind_gusts_10m_max?.[i] ?? null,
        dir: d.wind_direction_10m_dominant?.[i] ?? null,
        precip: d.precipitation_sum?.[i] ?? null,
        snow: d.snowfall_sum?.[i] ?? null,
        frz: freezing(j.hourly, date),
      })),
    };
  });
}

export async function fetchMountain(points, days = 3, ms = 6000) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const r = await fetch(mountainUrl(points, days), { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return parseMountain(await r.json(), points);
  } catch {
    return null;
  }
}

const dayLabel = (date, i) => (i === 0 ? 'Avui' : i === 1 ? 'Demà' : `${dayName(date)[0].toUpperCase()}${dayName(date).slice(1)}`);

// Taula de condicions previstes (una fila per dada, una columna per dia; un bloc per punt)
export function mountainTableHTML(data) {
  if (!data?.length || !data[0].days.length) return '';
  const days = data[0].days;
  const head = `<tr><th></th>${days.map((d, i) => `<th>${dayLabel(d.date, i)}<small>${dayShort(d.date)} ${parseDay(d.date).getUTCDate()}</small></th>`).join('')}</tr>`;
  const rows = data
    .map(({ point, days: ds }) => {
      const cell = (f) => ds.map((d) => `<td>${f(d)}</td>`).join('');
      return `<tbody>
<tr class="mt-pt"><th colspan="${ds.length + 1}">${point.label} · ${thousands(point.alt)} m</th></tr>
<tr><th>Temperatura</th>${cell((d) => `<b>${num(d.min, 0)}°</b> / <b>${num(d.max, 0)}°</b>`)}</tr>
<tr><th>Sensació tèrmica mínima</th>${cell((d) => (d.feels == null ? '—' : `${num(d.feels, 0)}°`))}</tr>
<tr><th>Vent màxim · ratxa</th>${cell((d) => (d.wind == null ? '—' : `${r0(d.wind)} · <b>${r0(d.gust)}</b> km/h <small>${dir8(d.dir)}</small>`))}</tr>
<tr><th>Precipitació</th>${cell((d) => (d.precip == null ? '—' : d.precip < 0.2 ? '0' : `${num(d.precip)} mm`))}</tr>
<tr><th>Neu</th>${cell((d) => (d.snow == null ? '—' : d.snow < 0.5 ? '—' : `<b>${num(d.snow, 0)} cm</b>`))}</tr>
</tbody>`;
    })
    .join('');
  const frz = `<tbody><tr class="mt-frz"><th>Isoterma de 0 °C</th>${days.map((d) => `<td>${d.frz ? (d.frz.min === d.frz.max ? `${thousands(d.frz.min)} m` : `${thousands(d.frz.min)}–${thousands(d.frz.max)} m`) : '—'}</td>`).join('')}</tr></tbody>`;
  return `<table class="mtable"><thead>${head}</thead>${rows}${frz}</table>`;
}

// Frases per al text de la pàgina (el primer punt és el més alt)
export function mountainText(data, place) {
  if (!data?.length || !data[0].days.length) return [];
  const top = data[0];
  return top.days.slice(0, 2).map((d, i) => {
    const when = cap(longDate(d.date)); // data explícita: el text es genera al build
    const parts = [`${when}, a ${thousands(top.point.alt)} m (${lowerCommon(top.point.label)}): mínima de ${num(d.min, 0)} °C i màxima de ${num(d.max, 0)} °C`];
    if (d.feels != null && d.feels < d.min - 2) parts.push(`amb una sensació tèrmica de fins a ${num(d.feels, 0)} °C`);
    if (d.gust != null) parts.push(`ratxes de ${r0(d.gust)} km/h${dir8(d.dir) ? ` de ${DIR_NAMES[dir8(d.dir)]}` : ''}`);
    let s = parts.join(', ') + '.';
    if (d.snow != null && d.snow >= 1) s += ` Pot nevar: fins a ${num(d.snow, 0)} cm.`;
    else if (d.precip != null && d.precip >= 0.5) s += ` Precipitació prevista: ${num(d.precip)} mm.`;
    if (d.frz) s += ` Isoterma de 0 °C a uns ${thousands(Math.round((d.frz.min + d.frz.max) / 200) * 100)} m.`;
    return s;
  });
}

// Resum de tots els cims: una fila per lloc (el seu punt més alt) i una columna per dia
export function summitsTableHTML(data, places) {
  if (!data?.length || !data[0].days.length) return '';
  const days = data[0].days;
  const head = `<tr><th>Lloc</th>${days.map((d, i) => `<th>${dayLabel(d.date, i)}<small>${dayShort(d.date)} ${parseDay(d.date).getUTCDate()}</small></th>`).join('')}</tr>`;
  const rows = data
    .map(({ point, days: ds }, k) => {
      const pl = places[k];
      const cells = ds
        .map((d) => {
          const snow = d.snow != null && d.snow >= 0.5 ? ` · <b>${num(d.snow, 0)} cm</b> de neu` : '';
          return `<td><span class="mt-t"><b>${num(d.min, 0)}°</b> / <b>${num(d.max, 0)}°</b></span><span class="mt-w">ratxa ${r0(d.gust)} km/h ${dir8(d.dir)}${snow}</span></td>`;
        })
        .join('');
      return `<tr><th><a href="/temps/${pl.slug}">${pl.name}</a><small>${thousands(point.alt)} m</small></th>${cells}</tr>`;
    })
    .join('');
  const frz = `<tr class="mt-frz"><th>Isoterma de 0 °C</th>${days.map((d) => `<td>${d.frz ? `${thousands(d.frz.min)}–${thousands(d.frz.max)} m` : '—'}</td>`).join('')}</tr>`;
  return `<table class="mtable mtable--sum"><thead>${head}</thead><tbody>${rows}${frz}</tbody></table>`;
}
