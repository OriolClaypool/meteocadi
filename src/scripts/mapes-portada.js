// Portada · "Més mapes, en directe" (src/components/MapesPortada.astro): la darrera imatge del radar (/api/capes/radar)
// i la previsió AROME de la temperatura (/api/capes/arome) dibuixades sobre el contorn de Catalunya, i la temperatura
// d'ara a les estacions de la xarxa (/api/ara). Les imatges són PNG en Web Mercator: en una projecció Mercator com la
// del contorn, cada imatge és un rectangle. Tot es demana quan la secció s'acosta a la pantalla.
import CONTORN from '../lib/catalunya-contorn.json';
import { loadAra } from './live.js';
import { hourMadrid, todayMadrid, tempColor, num, cap } from '../lib/format.js';

const W = 840, H = 630, PAD = 34;
const my = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const CAPITALS = [
  ['Lleida', 41.6176, 0.62],
  ['Girona', 41.9794, 2.8214],
  ['Barcelona', 41.3874, 2.1686],
  ['Tarragona', 41.1189, 1.2445],
];

// Projecció: Catalunya centrada al canvas, amb marge
function projection() {
  let lng0 = 180, lng1 = -180, lat0 = 90, lat1 = -90;
  for (const poly of CONTORN.coordinates)
    for (const [x, y] of poly[0]) {
      lng0 = Math.min(lng0, x); lng1 = Math.max(lng1, x);
      lat0 = Math.min(lat0, y); lat1 = Math.max(lat1, y);
    }
  const wx = ((lng1 - lng0) * Math.PI) / 180, wy = my(lat1) - my(lat0);
  const S = Math.min((W - 2 * PAD) / wx, (H - 2 * PAD) / wy);
  const OX = (W - wx * S) / 2, OY = (H - wy * S) / 2;
  const P = (lng, lat) => [OX + (((lng - lng0) * Math.PI) / 180) * S, OY + (my(lat1) - my(lat)) * S];
  const land = new Path2D();
  for (const poly of CONTORN.coordinates)
    for (const ring of poly) {
      ring.forEach(([x, y], i) => {
        const [px, py] = P(x, y);
        i ? land.lineTo(px, py) : land.moveTo(px, py);
      });
      land.closePath();
    }
  return { P, land };
}

async function getJson(url) {
  try {
    const r = await fetch(url);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}
async function getImg(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const img = new Image();
    img.src = URL.createObjectURL(await r.blob());
    await img.decode();
    return { img, headers: r.headers };
  } catch {
    return null;
  }
}

// Una imatge Web Mercator amb límits [[sud, oest], [nord, est]]
const okBounds = (b) => Array.isArray(b) && b.length === 2 && b.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite));
function drawMerc(ctx, P, img, bounds) {
  const [[s, w], [n, e]] = bounds;
  const [x0, y0] = P(w, n), [x1, y1] = P(e, s);
  ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0);
}

// "15:00" i "de les 15:00", però "1:05" i "de la 1:05"
const hh = (d) => hourMadrid(d).replace(/^0(?=\d)/, '');
const prep = (t, la, les) => `${t.startsWith('1:') ? la : les} ${t}`;
// L'endemà d'un dia "AAAA-MM-DD", pel calendari (no sumant 24 hores: els dies del canvi d'hora en tenen 23 o 25)
const nextDay = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

function capitals(ctx, P, dark) {
  ctx.font = "600 22px 'Geist Variable', system-ui, sans-serif";
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const [name, lat, lng] of CAPITALS) {
    const [x, y] = P(lng, lat);
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = dark ? '#ffffff' : '#10233b';
    ctx.strokeStyle = dark ? '#0b1d35' : '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fill();
    // Barcelona i Tarragona, a l'esquerra (a la dreta hi ha el mar i la línia de costa)
    const left = name === 'Barcelona' || name === 'Tarragona';
    ctx.textAlign = left ? 'right' : 'left';
    const tx = x + (left ? -12 : 12);
    ctx.lineWidth = 5;
    ctx.strokeStyle = dark ? 'rgba(11, 29, 53, 0.85)' : 'rgba(255, 255, 255, 0.85)';
    ctx.strokeText(name, tx, y);
    ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.86)' : '#10233b';
    ctx.fillText(name, tx, y);
  }
}

function setText(sel, text) {
  const el = document.querySelector(sel);
  if (el) el.textContent = text;
}

// "Avui a les 15:00", "Demà a les 15:00"
function whenText(iso) {
  const d = new Date(iso);
  const day = todayMadrid(d);
  const today = todayMadrid();
  const tomorrow = nextDay(today);
  const at = prep(hh(d), 'a la', 'a les');
  if (day === today) return `avui ${at}`;
  if (day === tomorrow) return `demà ${at}`;
  return `${new Intl.DateTimeFormat('ca-ES', { timeZone: 'Europe/Madrid', weekday: 'long' }).format(d)} ${at}`;
}

async function radar(cv, G) {
  const ctx = cv.getContext('2d');
  const base = () => {
    ctx.fillStyle = '#0b1d35';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.fill(G.land, 'evenodd');
  };
  const top = () => {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke(G.land);
    capitals(ctx, G.P, true);
  };
  base();
  top();
  const ix = await getJson('/api/capes/radar');
  const frames = ix?.frames || [];
  // La més nova; si encara no hi és (acabada de publicar), l'anterior
  let f = null, shot = null;
  for (const fr of frames.slice(-2).reverse()) {
    shot = await getImg(fr.url);
    if (shot) { f = fr; break; }
  }
  if (!f || !shot || !okBounds(ix.bounds)) {
    setText('[data-mp-when="radar"]', 'El radar no respon ara mateix');
    return;
  }
  base();
  ctx.imageSmoothingEnabled = false;
  drawMerc(ctx, G.P, shot.img, ix.bounds);
  ctx.imageSmoothingEnabled = true;
  top();
  const h = hh(new Date(f.time));
  setText('[data-mp-pill="radar"]', h);
  // El mateix llindar que el radar (/radar): menys del 0,05 % de Catalunya amb eco
  const wet = shot.headers.get('x-radar-pluja');
  setText('[data-mp-when="radar"]', `Imatge ${prep(h, 'de la', 'de les')}${wet != null && Number(wet) < 0.0005 ? ' · ara no plou a Catalunya' : ''}`);
}

// L'hora de la previsió: avui a les 15:00 si encara és d'hora; si no, demà a les 15:00 (si la passada hi arriba; si
// no, la darrera hora que tingui)
function pickHour(times) {
  const now = Date.now();
  const future = times.filter((t) => Date.parse(t.time) > now);
  if (!future.length) return null;
  const hNow = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const want = hNow < 12 ? todayMadrid() : nextDay(todayMadrid());
  const at15 = future.find((t) => todayMadrid(new Date(t.time)) === want && hourMadrid(new Date(t.time)) === '15:00');
  return at15 || future[future.length - 1];
}

async function arome(cv, G) {
  const ctx = cv.getContext('2d');
  const top = () => {
    // Fora de Catalunya, més apagat
    ctx.save();
    const out = new Path2D();
    out.rect(0, 0, W, H);
    out.addPath(G.land);
    ctx.fillStyle = 'rgba(233, 238, 243, 0.55)';
    ctx.fill(out, 'evenodd');
    ctx.restore();
    ctx.strokeStyle = 'rgba(16, 35, 59, 0.8)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke(G.land);
    capitals(ctx, G.P, false);
  };
  ctx.fillStyle = '#e9eef3';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.fill(G.land, 'evenodd');
  top();
  const ix = await getJson('/api/capes/arome');
  const v = ix && !ix.error && okBounds(ix.bounds) ? (ix.vars || []).find((x) => x.key === 'temp') : null;
  const t = v ? pickHour(ix.times || []) : null;
  const shot = t ? await getImg(`/api/capes/arome-temp-${ix.r}-${t.t}`) : null;
  if (!shot) {
    setText('[data-mp-when="arome"]', 'La previsió no respon ara mateix');
    return;
  }
  ctx.fillStyle = '#e9eef3';
  ctx.fillRect(0, 0, W, H);
  drawMerc(ctx, G.P, shot.img, ix.bounds);
  top();
  const when = whenText(t.time);
  setText('[data-mp-pill="arome"]', cap(when));
  setText('[data-mp-when="arome"]', `Temperatura ${when} · model AROME`);
}

function xarxa(j) {
  const st = j?.stations || {};
  document.querySelectorAll('[data-mp-t]').forEach((el) => {
    const d = st[el.dataset.mpT];
    const ok = d && !d.stale && !d.down && d.temp != null;
    el.textContent = ok ? `${num(d.temp)}°` : '—';
    el.style.fill = ok ? tempColor(d.temp) : '';
  });
  document.querySelectorAll('[data-mp-dot]').forEach((el) => {
    const d = st[el.dataset.mpDot];
    const ok = d && !d.stale && !d.down && d.temp != null;
    el.setAttribute('fill', ok ? tempColor(d.temp) : '#7d8fa6');
  });
  if (j?.updated) {
    const h = hh(new Date(j.updated));
    setText('[data-mp-pill="xarxa"]', h);
    setText('[data-mp-when="xarxa"]', `Temperatura ${prep(h, 'de la', 'de les')}`);
  }
}

export function startMapesPortada() {
  const sec = document.getElementById('mapes');
  if (!sec) return;
  document.addEventListener('meteocadi:ara', (e) => xarxa(e.detail));
  let started = false;
  const go = () => {
    if (started) return;
    started = true;
    const G = projection();
    const rc = sec.querySelector('[data-mp="radar"]');
    const ac = sec.querySelector('[data-mp="arome"]');
    // Si una imatge no es pot dibuixar, la targeta es queda amb el contorn i ho diu
    if (rc) radar(rc, G).catch(() => setText('[data-mp-when="radar"]', 'El radar no respon ara mateix'));
    if (ac) arome(ac, G).catch(() => setText('[data-mp-when="arome"]', 'La previsió no respon ara mateix'));
    loadAra().then((j) => {
      if (j?.stations) xarxa(j);
      else if (!document.querySelector('[data-mp-pill="xarxa"]')?.textContent?.match(/\d/)) setText('[data-mp-when="xarxa"]', 'Les estacions no responen ara mateix');
    });
  };
  if (!('IntersectionObserver' in window)) return go();
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) {
      io.disconnect();
      go();
    }
  }, { rootMargin: '600px 0px' });
  io.observe(sec);
  // Sense menú de "desa la imatge" a les vistes prèvies
  sec.querySelectorAll('canvas').forEach((c) => c.addEventListener('contextmenu', (e) => e.preventDefault()));
}

// Per a les proves
if (typeof window !== 'undefined') window.__mapesPortada = { pickHour, whenText };
