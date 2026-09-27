// Pàgina d'una estació: lectura actual, variables i gràfics d'avui (dades de /api/ara).
import { loadAra } from './live.js';
import { tempColor, windColor, precipColor, num, dirLabel } from '../lib/format.js';

const hhmm = (epoch) =>
  new Intl.DateTimeFormat('ca-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(new Date(epoch * 1000));

function chart(t, series, { color = '#3db8ff', unit = '', fill = true, second = null, step = false, min0 = false }) {
  const W = 400, H = 170, L = 34, R = 8, T = 12, B = 24;
  const vals = [...series, ...(second || [])].filter((v) => v != null);
  if (vals.length < 2) return '<p style="color:#93a3b8;font-size:14px;padding:40px 0;text-align:center;">Encara no hi ha prou dades d\'avui.</p>';
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (min0) lo = 0;
  if (hi - lo < 1) { hi += 0.5; lo = min0 ? 0 : lo - 0.5; }
  const pad = (hi - lo) * 0.1; hi += pad; if (!min0) lo -= pad;
  const t0 = t[0], t1 = t[t.length - 1];
  const x = (e) => L + ((e - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = (arr) => {
    let d = '';
    let started = false;
    arr.forEach((v, i) => {
      if (v == null) { started = false; return; }
      const X = x(t[i]).toFixed(1), Y = y(v).toFixed(1);
      if (!started) { d += ` M${X} ${Y}`; started = true; }
      else d += step ? ` H${X} V${Y}` : ` L${X} ${Y}`;
    });
    return d.trim();
  };
  const o = [`<svg viewBox="0 0 ${W} ${H}" role="img">`];
  const ticks = 4;
  for (let k = 0; k <= ticks; k++) {
    const v = lo + ((hi - lo) * k) / ticks;
    o.push(`<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="rgba(255,255,255,0.06)"></line><text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#7d8fa6" font-family="Geist Mono Variable, monospace">${hi - lo < 5 ? v.toFixed(1).replace('.', ',') : Math.round(v)}</text>`);
  }
  // hores
  const first = Math.ceil(t0 / 10800) * 10800;
  for (let e = first; e <= t1; e += 10800) o.push(`<text x="${x(e).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="#7d8fa6" font-family="Geist Mono Variable, monospace">${hhmm(e).slice(0, 2)}h</text>`);
  const d1 = line(series);
  if (fill && d1) {
    const lastI = series.map((v, i) => (v != null ? i : -1)).filter((i) => i >= 0);
    o.push(`<path d="${d1} L${x(t[lastI[lastI.length - 1]]).toFixed(1)} ${H - B} L${x(t[lastI[0]]).toFixed(1)} ${H - B} Z" fill="${color}" fill-opacity="0.1"></path>`);
  }
  if (second) o.push(`<path d="${line(second)}" fill="none" stroke="#fbbf24" stroke-width="1.2" stroke-opacity="0.8" stroke-dasharray="2 3"></path>`);
  o.push(`<path d="${d1}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"></path>`);
  o.push('</svg>');
  return o.join('');
}

export function mountStation(root) {
  const id = root.dataset.station;
  const f = (k) => root.querySelector(`[data-v="${k}"]`);
  const set = (k, text, color) => { const el = f(k); if (el) { el.textContent = text; if (color) el.style.color = color; } };
  loadAra().then((j) => {
    const d = j?.stations?.[id];
    const badge = root.querySelector('[data-badge]');
    if (!d) {
      if (badge) badge.textContent = 'SENSE DADES ARA MATEIX';
      return;
    }
    if (badge) badge.textContent = d.stale ? `ÚLTIMA LECTURA · ${hhmm(d.epoch)}` : `EN DIRECTE · LECTURA DE LES ${hhmm(d.epoch)}`;
    set('temp', `${num(d.temp)}°`, tempColor(d.temp));
    set('max', d.max != null ? `${num(d.max)}°` : '—', tempColor(d.max));
    set('min', d.min != null ? `${num(d.min)}°` : '—', tempColor(d.min));
    const feels = d.temp != null && d.temp < 10 ? d.windchill : d.heatindex;
    set('feels', feels != null ? `${num(feels)}°` : '—', tempColor(feels));
    set('dew', d.dewpt != null ? `${num(d.dewpt)}°` : '—');
    set('hum', d.hum != null ? `${Math.round(d.hum)} %` : '—');
    set('wind', d.wind != null ? `${Math.round(d.wind)} km/h ${dirLabel(d.dir)}` : '—', windColor(d.wind));
    set('gust', d.gust != null ? `${Math.round(d.gust)} km/h` : '—', windColor(d.gust));
    set('gustmax', d.gustMax != null ? `${Math.round(d.gustMax)} km/h` : '—', windColor(d.gustMax));
    set('pres', d.pres != null ? `${Math.round(d.pres)} hPa` : '—');
    set('rain', d.rain != null ? `${num(d.rain)} mm` : '—', precipColor(d.rain));
    const s = d.series;
    const put = (k, html) => { const el = root.querySelector(`[data-chart="${k}"]`); if (el) el.innerHTML = html; };
    if (s && s.t.length > 1) {
      put('temp', chart(s.t, s.temp, { color: tempColor(d.temp) }));
      put('wind', chart(s.t, s.wind, { color: '#3db8ff', second: s.gust, min0: true }));
      put('rain', chart(s.t, s.rain, { color: '#60a5fa', step: true, min0: true }));
    } else {
      ['temp', 'wind', 'rain'].forEach((k) => put(k, '<p style="color:#93a3b8;font-size:14px;padding:40px 0;text-align:center;">Sense sèrie d\'avui.</p>'));
    }
  });
}
