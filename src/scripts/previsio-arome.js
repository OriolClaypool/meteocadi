// Mapa de previsió (/mapa/previsio): el model AROME de Météo-France (/api/capes/arome, api/_arome.js) hora a hora,
// per a les variables que tingui la passada més nova (temperatura, pluja, neu, vent, ratxes i, si n'hi ha, cota de
// neu). Les imatges són PNG de paleta en Web Mercator: es demanen quan calen (l'hora triada i les dues següents) i es
// pinten en un canvas. Es pot enllaçar una variable amb #temp, #pluja, #neu, #vent, #ratxa o #cota.
import { baseMap, canvasLayer } from './mapa-base.js';
import { hourMadrid, todayMadrid, dayName, num } from '../lib/format.js';

const VIEWS = {
  cat: [[40.52, 0.16], [42.86, 3.33]],
  pir: [[41.95, 0.55], [42.9, 2.75]],
};
const OPACITY = 0.8;
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

async function fetchImg(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const blob = await r.blob();
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await img.decode();
    const h = (k) => (r.headers.get(k) == null ? null : Number(r.headers.get(k)));
    return { img, min: h('x-arome-min'), max: h('x-arome-max') };
  } catch {
    return null;
  }
}

// Llegenda: amb molts llindars (temperatura, vent, cota), un degradat amb unes quantes marques; amb pocs (pluja,
// neu), una casella per classe
function legendHTML(v) {
  const L = v.legend;
  const lab = (x) => num(x, x % 1 ? 1 : 0);
  if (L.length > 20) {
    const lo = L[0][0], hi = L[L.length - 1][0];
    const span = hi - lo;
    const step = span > 2000 ? 1000 : span > 100 ? 30 : 10;
    const ticks = L.filter(([b]) => Math.round(b) % step === 0).map(([b]) => `<span style="left:${((b - lo) / span) * 100}%">${lab(b)}</span>`).join('');
    return `<b>${v.label} (${v.unit})</b><div class="pv-grad" style="background:linear-gradient(90deg,${L.map(([, c]) => c).join(',')})"></div><div class="pv-ticks">${ticks}</div>`;
  }
  return `<b>${v.label} (${v.unit})</b><div class="pv-sw">${L.map(([b, c]) => `<span><i style="background:${c}"></i>${lab(b)}</span>`).join('')}</div>`;
}

export function startPrevisio() {
  const $ = (id) => document.getElementById(id);
  const el = $('pvMap');
  if (!el) return null;
  const want = location.hash.slice(1);
  const map = baseMap(el, { view: want === 'neu' || want === 'cota' ? VIEWS.pir : VIEWS.cat });
  const st = { ix: null, v: null, i: 0, playing: false, cache: new Map(), shown: null };
  let cl = null;
  let seq = 0;

  const urlOf = (v, i) => `/api/capes/arome-${v}-${st.ix.r}-${st.ix.times[i].t}`;
  function load(v, i) {
    if (!st.ix?.times[i]) return Promise.resolve(null);
    const u = urlOf(v, i);
    if (!st.cache.has(u)) st.cache.set(u, fetchImg(u));
    return st.cache.get(u);
  }
  function paint(f) {
    if (!cl) return;
    cl.ctx.clearRect(0, 0, cl.cv.width, cl.cv.height);
    if (f) cl.ctx.drawImage(f.img, 0, 0);
  }
  function labels() {
    const t = st.ix.times[st.i];
    const d = new Date(t.time);
    const day = todayMadrid(d);
    const today = todayMadrid();
    const tomorrow = todayMadrid(new Date(Date.now() + 864e5));
    $('pvTime').textContent = `${day === today ? 'Avui' : day === tomorrow ? 'Demà' : cap(dayName(day))} a les ${hourMadrid(d)}`;
    const h = Math.round((d.getTime() - Date.now()) / 3600e3);
    $('pvAge').textContent = h <= 0 ? 'ara' : `d'aquí a ${h} h`;
    const sl = $('pvSlider');
    sl.max = String(st.ix.times.length - 1);
    sl.value = String(st.i);
    sl.setAttribute('aria-valuetext', `${$('pvTime').textContent}`);
  }
  async function show(i) {
    const my = ++seq;
    st.i = Math.max(0, Math.min(st.ix.times.length - 1, i));
    labels();
    const f = await load(st.v, st.i);
    if (my !== seq) return;
    paint(f);
    $('pvNote').textContent = f ? '' : 'Aquesta hora encara no és disponible.';
    // Les dues hores següents, per quan es reprodueixi o s'avanci
    load(st.v, st.i + 1);
    load(st.v, st.i + 2);
  }
  function setVar(k) {
    const v = st.ix.vars.find((x) => x.key === k) || st.ix.vars[0];
    st.v = v.key;
    document.querySelectorAll('#pvVars button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v.key)));
    $('pvLegend').innerHTML = legendHTML(v);
    try { history.replaceState(null, '', `#${v.key}`); } catch {}
    show(st.i);
  }

  let timer = null;
  function play(on) {
    st.playing = on && st.ix.times.length > 1;
    const b = $('pvPlay');
    b.setAttribute('aria-pressed', String(st.playing));
    b.setAttribute('aria-label', st.playing ? 'Atura l’animació' : 'Reprodueix la previsió hora a hora');
    b.querySelector('span').textContent = st.playing ? 'Atura' : 'Reprodueix';
    clearTimeout(timer);
    if (!st.playing) return;
    const tick = async () => {
      const next = st.i >= st.ix.times.length - 1 ? 0 : st.i + 1;
      await load(st.v, next); // no avança fins que la imatge és a punt
      if (!st.playing) return;
      await show(next);
      timer = setTimeout(tick, next === st.ix.times.length - 1 ? 1500 : 650);
    };
    tick();
  }
  $('pvPlay').addEventListener('click', () => play(!st.playing));
  $('pvSlider').addEventListener('input', (e) => { play(false); show(Number(e.target.value)); });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' && e.shiftKey) { play(false); show(st.i - 1); e.preventDefault(); }
    if (e.key === 'ArrowRight' && e.shiftKey) { play(false); show(st.i + 1); e.preventDefault(); }
  });
  document.querySelectorAll('[data-pv-view]').forEach((b) =>
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-pv-view]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      map.flyToBounds(VIEWS[b.dataset.pvView], { duration: 0.6 });
    }),
  );
  if (want === 'neu' || want === 'cota') document.querySelectorAll('[data-pv-view]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.pvView === 'pir')));

  async function start() {
    let ix = null;
    try {
      const r = await fetch('/api/capes/arome');
      ix = r.ok ? await r.json() : null;
    } catch {}
    if (!ix || ix.error || !ix.vars?.length || !ix.times?.length) {
      $('pvStatus').textContent = 'La previsió del model AROME ara no és disponible. Torna-ho a provar d’aquí a una estona.';
      document.querySelector('.pv')?.classList.add('is-off');
      return;
    }
    st.ix = ix;
    cl = canvasLayer(map, ix.size[0], ix.size[1], ix.bounds, {
      className: 'pv-cv',
      opacity: OPACITY,
      attribution: 'Previsió: <a href="https://meteofrance.com/" target="_blank" rel="noopener">Météo-France</a> (AROME)',
    });
    $('pvVars').innerHTML = ix.vars.map((v) => `<button type="button" data-v="${v.key}" aria-pressed="false">${v.label}</button>`).join('');
    $('pvVars').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { play(false); setVar(b.dataset.v); }));
    const run = new Date(ix.run);
    $('pvRun').textContent = `Model AROME · passada de les ${hourMadrid(run)}${todayMadrid(run) === todayMadrid() ? '' : ' d’ahir'}`;
    $('pvPlay').disabled = ix.times.length < 2;
    $('pvSlider').disabled = ix.times.length < 2;
    $('pvStatus').textContent = '';
    setVar(ix.vars.some((v) => v.key === want) ? want : 'temp');
  }
  start();
  return { map, state: st };
}
