// Lectures en directe: una sola crida a /api/ara (amb memòria cau al servidor)
// i pinta tots els elements marcats amb data-* de la pàgina.
import { STATIONS, BY_ID } from '../lib/stations.js';
import { tempColor, windColor, precipColor, num, dirLabel, hourMadrid } from '../lib/format.js';
import { t, pageLang } from '../lib/i18n.js';

const REFRESH = 10 * 60 * 1000;
let current = null;
let pending = null;

export function loadAra(force = false) {
  if (pending && !force) return pending;
  pending = fetch('/api/ara', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((j) => {
      current = j;
      return j;
    })
    .catch(() => current);
  return pending;
}

const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const set = (el, text, color) => {
  if (!el) return;
  el.textContent = text;
  if (color !== undefined) el.style.color = color;
};

export function sparkPath(values, w, h, pad = 3) {
  const pts = values.map((v, i) => [i, v]).filter(([, v]) => v != null);
  if (pts.length < 2) return null;
  const vs = pts.map(([, v]) => v);
  let lo = Math.min(...vs);
  let hi = Math.max(...vs);
  if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
  const n = values.length - 1;
  const xy = pts.map(([i, v]) => [pad + (i / n) * (w - 2 * pad - 4), pad + (h - 2 * pad) * (1 - (v - lo) / (hi - lo))]);
  const d = 'M' + xy.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L');
  return { d, area: `${d} L${xy[xy.length - 1][0].toFixed(1)} ${h} L${xy[0][0].toFixed(1)} ${h} Z`, last: xy[xy.length - 1] };
}

function paintSpark(svg, d) {
  if (!svg) return;
  const temps = d?.series?.temp;
  const w = Number(svg.getAttribute('width')) || 190;
  const h = Number(svg.getAttribute('height')) || 30;
  const p = temps ? sparkPath(temps, w, h) : null;
  const [area, line, dot] = svg.children;
  if (!p) { line.setAttribute('d', ''); area.setAttribute('d', ''); dot.setAttribute('r', '0'); return; }
  area.setAttribute('d', p.area);
  line.setAttribute('d', p.d);
  dot.setAttribute('cx', p.last[0].toFixed(1));
  dot.setAttribute('cy', p.last[1].toFixed(1));
  dot.setAttribute('r', '3.2');
  dot.setAttribute('fill', tempColor(d.temp));
}

function rotate(el, deg) {
  if (!el) return;
  if (deg == null) { el.style.opacity = '0'; return; }
  el.style.opacity = '1';
  el.style.transform = `rotate(${(deg + 180) % 360}deg)`;
}

export function paint(j) {
  const L = t(pageLang());
  const data = j?.stations || {};
  const ok = j?.ok ?? 0;

  $$('[data-live-badge]').forEach((el) => {
    const on = ok > 0;
    el.classList.toggle('live--off', !on);
    const txt = el.querySelector('[data-live-text]');
    if (txt) txt.textContent = on ? `${L.live} · ${hourMadrid(new Date(j.updated))}` : L.offline;
  });
  $$('[data-live-count]').forEach((el) => (el.textContent = L.online(ok, STATIONS.length)));

  for (const s of STATIONS) {
    const d = data[s.id];
    const off = !d || d.stale;
    // cinta
    $$(`[data-tk="${s.id}"]`).forEach((el) => {
      set(el.querySelector('.t'), off ? '—' : `${num(d.temp)}°`, off ? undefined : tempColor(d.temp));
      set(el.querySelector('.w'), off || d.wind == null ? '' : `${dirLabel(d.dir)} ${Math.round(d.wind)} km/h`);
    });
    // files de taula
    $$(`[data-row="${s.id}"]`).forEach((row) => {
      row.classList.toggle('is-stale', !!d?.stale);
      const f = (k) => row.querySelector(`[data-f="${k}"]`);
      set(f('now'), d ? `${num(d.temp)}°` : '—', d ? tempColor(d.temp) : undefined);
      set(f('max'), d?.max != null ? `${num(d.max)}°` : '—', d?.max != null ? tempColor(d.max) : undefined);
      set(f('min'), d?.min != null ? `${num(d.min)}°` : '—', d?.min != null ? tempColor(d.min) : undefined);
      set(f('windv'), d?.wind != null ? `${dirLabel(d.dir)} ${Math.round(d.wind)}` : '—');
      rotate(f('arrow'), d?.dir);
      const g = d?.gustMax ?? d?.gust;
      set(f('gust'), g != null ? `${Math.round(g)}` : '—', g != null ? (g >= 40 ? '#fbbf24' : '#c3cfde') : undefined);
      set(f('rain'), d?.rain != null ? `${num(d.rain)} mm` : '—', d?.rain != null ? precipColor(d.rain) : undefined);
      const ago = d?.stale && d.epoch ? L.lastReading(Math.round((Date.now() / 1000 - d.epoch) / 3600)) : null;
      const nameEl = row.querySelector('.st-name small');
      if (nameEl && !nameEl.dataset.orig) nameEl.dataset.orig = nameEl.textContent;
      if (nameEl) nameEl.textContent = ago ? `${nameEl.dataset.orig} · ${ago.toLowerCase()}` : nameEl.dataset.orig;
      set(
        f('mob'),
        d
          ? [d.max != null ? L.maxMin(`${num(d.max)}°`, `${num(d.min)}°`) : null, d.wind != null ? `${dirLabel(d.dir)} ${Math.round(d.wind)} km/h` : null, d.rain ? `${num(d.rain)} mm` : null]
              .filter(Boolean)
              .join('  ·  ')
          : L.noDataNow,
      );
      paintSpark(f('spark'), d);
    });
  }
  document.dispatchEvent(new CustomEvent('meteocadi:ara', { detail: j }));
}

export function startLive() {
  const run = (force) => loadAra(force).then((j) => j && paint(j));
  run(false);
  setInterval(() => run(true), REFRESH);
}

export { BY_ID, windColor };
