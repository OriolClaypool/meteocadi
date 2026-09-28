// Meteograma de 48 hores i previsió de 7 dies (Open-Meteo, sense clau).
// La previsió es calcula per a l'altitud del lloc (paràmetre elevation).
import { tempColorLight, num, cap, dayName, dayShort, parseDay } from '../lib/format.js';
import { wmoIcon, wmoText, iconUrl } from '../lib/wmo.js';
import { t, pageLang } from '../lib/i18n.js';

const cache = new Map();

export function fetchForecast({ lat, lng, alt }) {
  const p = new URLSearchParams({
    latitude: lat, longitude: lng, elevation: alt, timezone: 'Europe/Madrid', forecast_days: '7',
    hourly: 'temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
  });
  const url = `https://api.open-meteo.com/v1/forecast?${p}`;
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))));
  return cache.get(url);
}

function nowKey() {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const g = (t) => f.find((x) => x.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:00`;
}

function smooth(pts) {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

const W = 1200, H = 412, X0 = 56, X1 = 1176, HOURS = 48;
const TY0 = 252, TY1 = 102, BASE = 334;
const INK = '#10233b', INK2 = '#44556b', MUTED = '#56667a', LINE = '#e3e9f0', BLUE = '#22477a';
const ARROW = 'M0 -8 L5.5 6 L0 3 L-5.5 6 Z';

export function meteogramSVG(j) {
  const lang = pageLang();
  const L = t(lang);
  const h = j.hourly;
  let s = h.time.indexOf(nowKey());
  if (s < 0) s = 0;
  const idx = [...Array(HOURS + 1).keys()].map((k) => s + k).filter((i) => i < h.time.length);
  if (idx.length < 12) return null;
  const px = (k) => X0 + (k / HOURS) * (X1 - X0);
  const temps = idx.map((i) => h.temperature_2m[i]);
  let tmin = Math.floor(Math.min(...temps) - 1);
  let tmax = Math.ceil(Math.max(...temps) + 1);
  if (tmax - tmin < 8) { const m = (tmax + tmin) / 2; tmin = Math.floor(m - 4); tmax = Math.ceil(m + 4); }
  const ty = (t) => TY0 - ((t - tmin) / (tmax - tmin)) * (TY0 - TY1);
  const step = tmax - tmin > 14 ? 5 : 2;
  const o = [];
  o.push(`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${L.meteogram}">`);
  // degradat de temperatura segons l'eix
  const stops = [];
  for (let t = tmax; t >= tmin; t -= 1) stops.push(`<stop offset="${((ty(t) - TY1) / (TY0 - TY1)).toFixed(3)}" stop-color="${tempColorLight(t)}"></stop>`);
  o.push(`<defs><linearGradient id="mg-t" x1="0" y1="${TY1}" x2="0" y2="${TY0}" gradientUnits="userSpaceOnUse">${stops.join('')}</linearGradient>
    <linearGradient id="mg-a" x1="0" y1="${TY1}" x2="0" y2="${TY0 + 8}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#f59e0b" stop-opacity="0.14"></stop><stop offset="1" stop-color="#14b8a6" stop-opacity="0.02"></stop></linearGradient></defs>`);
  // nit
  let k0 = null;
  idx.forEach((i, k) => {
    const night = h.is_day[i] === 0;
    if (night && k0 === null) k0 = k;
    if ((!night || k === idx.length - 1) && k0 !== null) {
      const k1 = night ? k : k;
      o.push(`<rect x="${px(k0).toFixed(1)}" y="72" width="${(px(k1) - px(k0)).toFixed(1)}" height="${BASE - 72}" fill="${BLUE}" fill-opacity="0.05"></rect>`);
      k0 = null;
    }
  });
  // graella de temperatura
  for (let t = Math.ceil(tmin / step) * step; t <= tmax; t += step) {
    const y = ty(t).toFixed(1);
    o.push(`<line x1="${X0}" y1="${y}" x2="${X1}" y2="${y}" stroke="${LINE}" stroke-dasharray="3 5"></line><text x="${X0 - 12}" y="${(+y + 5).toFixed(1)}" text-anchor="end" font-size="13" fill="${MUTED}" font-family="Geist Mono Variable, monospace">${t}°</text>`);
  }
  // dies
  const dayLabel = (i, first) => {
    const iso = h.time[i].slice(0, 10);
    const d = parseDay(iso).getUTCDate();
    return first ? L.now : `${cap(dayName(iso, lang))} ${d}`;
  };
  o.push(`<text x="${X0 + 8}" y="16" font-size="15" font-weight="700" fill="${INK}">${dayLabel(idx[0], true)}</text>`);
  idx.forEach((i, k) => {
    if (k > 0 && h.time[i].endsWith('T00:00')) {
      const x = px(k);
      o.push(`<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${H - 22}" stroke="#c7d2de"></line><text x="${(x + 10).toFixed(1)}" y="16" font-size="15" font-weight="700" fill="${INK}">${dayLabel(i)}</text>`);
    }
  });
  // corba
  const pts = idx.map((i, k) => [px(k), ty(h.temperature_2m[i])]);
  const curve = smooth(pts);
  o.push(`<path d="${curve} L${pts[pts.length - 1][0].toFixed(1)} ${TY0 + 8} L${pts[0][0].toFixed(1)} ${TY0 + 8} Z" fill="url(#mg-a)"></path>`);
  o.push(`<path class="a-draw" d="${curve}" fill="none" stroke="url(#mg-t)" stroke-width="3.5" stroke-linecap="round"></path>`);
  idx.forEach((i, k) => {
    if (k % 3) return;
    const t = h.temperature_2m[i];
    const [x, y] = pts[k];
    o.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="#fff" stroke="${tempColorLight(t)}" stroke-width="2"></circle>`);
    if (k % 6 === 0 && k > 0) o.push(`<text x="${x.toFixed(1)}" y="${(y - 14).toFixed(1)}" text-anchor="middle" font-size="16" font-weight="500" fill="${tempColorLight(t)}" font-family="Geist Mono Variable, monospace">${Math.round(t)}°</text>`);
    // icona
    o.push(`<image href="${iconUrl(wmoIcon(h.weather_code[i], h.is_day[i] === 1))}" x="${(x - 21).toFixed(1)}" y="22" width="42" height="42"><title>${wmoText(h.weather_code[i], lang)}</title></image>`);
  });
  // ara
  o.push(`<line x1="${X0}" y1="72" x2="${X0}" y2="${BASE}" stroke="${INK}" stroke-width="1.5"></line>`);
  // pluja cada 3 h
  o.push(`<line x1="${X0}" y1="${BASE}" x2="${X1}" y2="${BASE}" stroke="#c7d2de"></line>`);
  for (let k = 0; k + 3 <= idx.length - 1; k += 3) {
    const sum = [0, 1, 2].reduce((a, b) => a + (h.precipitation[idx[k + b]] || 0), 0);
    if (sum < 0.1) continue;
    const bh = Math.max(3, Math.min(70, sum * 18));
    const x = px(k) + 5, w = px(k + 3) - px(k) - 10;
    o.push(`<rect class="a-grow" x="${x.toFixed(1)}" y="${(BASE - bh).toFixed(1)}" width="${w.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="#2f6fde"></rect><text x="${(x + w / 2).toFixed(1)}" y="${(BASE - bh - 6).toFixed(1)}" text-anchor="middle" font-size="12.5" font-weight="600" fill="#1d4ed8" font-family="Geist Mono Variable, monospace">${num(sum)}</text>`);
  }
  // hores i vent
  idx.forEach((i, k) => {
    if (k % 3) return;
    const x = px(k).toFixed(1);
    const hh = h.time[i].slice(11, 13);
    o.push(`<text x="${x}" y="${BASE + 20}" text-anchor="middle" font-size="12.5" fill="${MUTED}" font-family="Geist Mono Variable, monospace">${hh}</text>`);
    const dir = h.wind_direction_10m[i];
    const v = Math.round(h.wind_speed_10m[i]);
    if (dir != null) o.push(`<g transform="translate(${x} ${BASE + 42}) rotate(${(dir + 180) % 360})"><path d="${ARROW}" fill="${v >= 30 ? '#c2410c' : BLUE}"></path></g>`);
    o.push(`<text x="${x}" y="${BASE + 66}" text-anchor="middle" font-size="12.5" font-weight="600" fill="${INK2}" font-family="Geist Mono Variable, monospace">${v}</text>`);
  });
  o.push('</svg>');
  return o.join('');
}

export function daysHTML(j, n = 7) {
  const lang = pageLang();
  const L = t(lang);
  const d = j.daily;
  return d.time
    .slice(0, n)
    .map((iso, i) => {
      const name = i === 0 ? L.today : i === 1 ? L.tomorrow : `${cap(dayShort(iso, lang))} ${parseDay(iso).getUTCDate()}`;
      const code = d.weather_code[i];
      const rain = d.precipitation_sum[i];
      const prob = d.precipitation_probability_max?.[i];
      return `<div class="day"><span class="day__d">${name}</span><img src="${iconUrl(wmoIcon(code, true))}" alt="${wmoText(code, lang)}" width="52" height="52" loading="lazy"><span class="day__t"><span style="color:${tempColorLight(d.temperature_2m_max[i])}">${Math.round(d.temperature_2m_max[i])}°</span> <span style="color:#8a99ab">/</span> <span style="color:${tempColorLight(d.temperature_2m_min[i])}">${Math.round(d.temperature_2m_min[i])}°</span></span><span class="day__r">${rain >= 0.1 ? `${num(rain)} mm` : L.dry}${prob != null && rain >= 0.1 ? ` · ${prob}%` : ''}</span></div>`;
    })
    .join('');
}

// Munta un bloc de previsió: data-forecast='{"lat":..,"lng":..,"alt":..}'
export function mountForecast(root) {
  const L = t(pageLang());
  const mg = root.querySelector('[data-mg]');
  const days = root.querySelector('[data-days]');
  const run = (place) => {
    if (mg) mg.innerHTML = `<div class="mg-empty">${L.loadingFc}</div>`;
    fetchForecast(place)
      .then((j) => {
        if (mg) mg.innerHTML = meteogramSVG(j) || `<div class="mg-empty">${L.fcNone}</div>`;
        if (days) days.innerHTML = daysHTML(j);
      })
      .catch(() => {
        if (mg) mg.innerHTML = `<div class="mg-empty">${L.fcError}</div>`;
      });
  };
  const chips = root.querySelectorAll('[data-place]');
  chips.forEach((c) =>
    c.addEventListener('click', () => {
      chips.forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
      const p = JSON.parse(c.dataset.place);
      const lab = root.querySelector('[data-place-name]');
      if (lab) lab.textContent = `${p.name} (${String(p.alt).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} m)`;
      run(p);
    }),
  );
  const first = root.dataset.forecast ? JSON.parse(root.dataset.forecast) : chips[0] && JSON.parse(chips[0].dataset.place);
  if (first) {
    // carrega quan s'acosta a la pantalla
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((e) => {
        if (e[0].isIntersecting) { io.disconnect(); run(first); }
      }, { rootMargin: '400px' });
      io.observe(root);
    } else run(first);
  }
}
