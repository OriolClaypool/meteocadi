// "Aquest cap de setmana": dies a mostrar i previsió de tots els llocs en una sola crida.
import { CADI as PLACES } from './places.js';
import { parseDay, todayMadrid } from './format.js';

const addDays = (iso, n) => {
  const d = parseDay(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Diumenge: només avui. Altrament: el proper dissabte i diumenge.
export function weekendDays(today = todayMadrid()) {
  const dow = parseDay(today).getUTCDay();
  if (dow === 0) return [today];
  const sat = addDays(today, (6 - dow + 7) % 7);
  return [sat, addDays(sat, 1)];
}

export function multiUrl(places = PLACES) {
  const p = new URLSearchParams({
    latitude: places.map((x) => x.lat).join(','),
    longitude: places.map((x) => x.lng).join(','),
    elevation: places.map((x) => x.alt).join(','),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max',
    timezone: 'Europe/Madrid',
    forecast_days: '9',
  });
  return `https://api.open-meteo.com/v1/forecast?${p}`;
}

// Resposta d'Open-Meteo (array, un per lloc) → { slug: { date: {...} } }
export function byPlace(json, places = PLACES) {
  const arr = Array.isArray(json) ? json : [json];
  const out = {};
  arr.forEach((j, i) => {
    const d = j?.daily;
    if (!d) return;
    const m = {};
    d.time.forEach((date, k) => {
      m[date] = {
        code: d.weather_code[k],
        max: d.temperature_2m_max[k],
        min: d.temperature_2m_min[k],
        rain: d.precipitation_sum[k],
        prob: d.precipitation_probability_max?.[k] ?? null,
        wind: d.wind_speed_10m_max[k],
        gust: d.wind_gusts_10m_max?.[k] ?? null,
      };
    });
    out[places[i].slug] = m;
  });
  return out;
}

export async function fetchWeekend(signalMs = 6000) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), signalMs);
    const r = await fetch(multiUrl(), { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return byPlace(await r.json());
  } catch {
    return null;
  }
}

// ---------- presentació (servidor i navegador) ----------
import { num, cap, longDate, tempColorLight } from './format.js';
import { wmoIcon, wmoText, iconUrl } from './wmo.js';

export function summaryHTML(data, days, places = PLACES) {
  if (!data) return '';
  return days
    .map((date) => {
      const rows = places.map((p) => ({ p, d: data[p.slug]?.[date] })).filter((x) => x.d);
      if (!rows.length) return '';
      const hot = rows.reduce((a, b) => (b.d.max > a.d.max ? b : a));
      const cold = rows.reduce((a, b) => (b.d.max < a.d.max ? b : a));
      const wet = rows.filter((x) => x.d.rain >= 1);
      const wettest = wet.length ? wet.reduce((a, b) => (b.d.rain > a.d.rain ? b : a)) : null;
      const gusty = rows.reduce((a, b) => ((b.d.gust ?? 0) > (a.d.gust ?? 0) ? b : a));
      let t = `<strong>${cap(longDate(date))}</strong>: màximes de ${Math.round(cold.d.max)} °C ${cold.p.a} a ${Math.round(hot.d.max)} °C ${hot.p.a}. `;
      t += wet.length
        ? `Es preveu pluja a ${wet.length === 1 ? '1 lloc' : `${wet.length} llocs`}, amb fins a ${num(wettest.d.rain)} mm ${wettest.p.a}.`
        : 'No es preveu pluja significativa enlloc.';
      if ((gusty.d.gust ?? 0) >= 40) t += ` Ratxes de fins a ${Math.round(gusty.d.gust)} km/h ${gusty.p.a}.`;
      return `<p>${t}</p>`;
    })
    .join('');
}

export function tableHTML(data, days, places = PLACES) {
  const head = `<thead><tr><th>Lloc</th>${days.map((d) => `<th>${cap(longDate(d))}</th>`).join('')}</tr></thead>`;
  const body = places
    .map((p) => {
      const cells = days
        .map((date) => {
          const d = data?.[p.slug]?.[date];
          if (!d) return '<td class="we-na">—</td>';
          return `<td><div class="we"><img src="${iconUrl(wmoIcon(d.code, true))}" alt="" width="48" height="48" loading="lazy"><div><span class="we-t mono"><span style="color:${tempColorLight(d.max)}">${Math.round(d.max)}°</span> / <span style="color:${tempColorLight(d.min)}">${Math.round(d.min)}°</span></span><span class="we-x">${wmoText(d.code)}${d.rain >= 0.2 ? ` · ${num(d.rain)} mm` : ''}${d.gust != null && d.gust >= 40 ? ` · ratxes ${Math.round(d.gust)} km/h` : ''}</span></div></div></td>`;
        })
        .join('');
      return `<tr><th scope="row"><a href="/temps/${p.slug}">${p.name}</a><span class="mono">${String(p.alt).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} m</span></th>${cells}</tr>`;
    })
    .join('');
  return head + `<tbody>${body}</tbody>`;
}

import { dayMonth, deMonth, parseDay as _pd } from './format.js';
export function rangeText(days) {
  if (days.length === 1) return `Previsió lloc per lloc per a avui, ${longDate(days[0])}, calculada per a l'altitud de cada poble i cim.`;
  const a = _pd(days[0]), b = _pd(days[1]);
  const txt = a.getUTCMonth() === b.getUTCMonth()
    ? `el dissabte ${a.getUTCDate()} i el diumenge ${b.getUTCDate()} ${deMonth(b.getUTCMonth() + 1)}`
    : `el dissabte ${dayMonth(days[0])} i el diumenge ${dayMonth(days[1])}`;
  return `Previsió lloc per lloc per a ${txt}, calculada per a l'altitud de cada poble i cim.`;
}
