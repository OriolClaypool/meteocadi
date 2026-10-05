// Explorador de dades de l'estudi (/estudi/dades): l'historial de les estacions de la xarxa (/estudi-historic.json),
// per dies, mesos o anys, amb gràfic, resum de cada estació, taula i CSV. Eina interna.
import { STATIONS, BY_ID, shortName, fmtAlt } from '../../lib/stations.js';
import { num, monthName } from '../../lib/format.js';

// Paleta categòrica (ordre fix): cada estació pren el primer color lliure quan s'hi afegeix i el conserva
const COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];
const MAX = COLORS.length;
const VARS = {
  tmax: { label: 'Màxima', unit: '°C', agg: 'mean', aggLabel: 'mitjana de les màximes', dec: 1 },
  tmin: { label: 'Mínima', unit: '°C', agg: 'mean', aggLabel: 'mitjana de les mínimes', dec: 1 },
  tavg: { label: 'Mitjana', unit: '°C', agg: 'mean', aggLabel: 'temperatura mitjana', dec: 1 },
  rain: { label: 'Pluja', unit: 'mm', agg: 'sum', aggLabel: 'pluja total', dec: 1, zero: true },
  gust: { label: 'Ratxa', unit: 'km/h', agg: 'max', aggLabel: 'ratxa màxima', dec: 0, zero: true },
  wind: { label: 'Vent mitjà', unit: 'km/h', agg: 'mean', aggLabel: 'vent mitjà', dec: 1, zero: true },
  hum: { label: 'Humitat', unit: '%', agg: 'mean', aggLabel: 'humitat mitjana', dec: 0 },
  pres: { label: 'Pressió', unit: 'hPa', agg: 'mean', aggLabel: 'pressió mitjana', dec: 1 },
};
const MESC = ['gen', 'febr', 'març', 'abr', 'maig', 'juny', 'jul', 'ag', 'set', 'oct', 'nov', 'des'];
const K = 'meteocadi-dades';

const dayIndex = (iso) => Math.round(Date.parse(`${iso}T12:00:00Z`) / 864e5);
const isoOf = (i) => new Date(i * 864e5).toISOString().slice(0, 10);
const dm = (iso) => `${Number(iso.slice(8))} ${MESC[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export async function mountDades(root) {
  const $ = (id) => root.querySelector(`#${id}`);
  const status = $('dStatus');
  let data;
  try {
    const r = await fetch('/estudi-historic.json');
    data = await r.json();
  } catch {
    status.textContent = "No s'han pogut carregar les dades.";
    return;
  }
  const have = STATIONS.filter((s) => data.stations[s.id]);
  const first = Math.min(...have.map((s) => dayIndex(data.stations[s.id].from)));
  const last = Math.max(...have.map((s) => dayIndex(data.stations[s.id].from) + data.stations[s.id].n - 1));

  // Estat (es recorda en aquest navegador)
  let st = { v: 'tavg', g: 'm', from: isoOf(Math.max(first, last - 364)), to: isoOf(last), sel: [], cum: false };
  try { Object.assign(st, JSON.parse(localStorage.getItem(K) || '{}')); } catch {}
  st.sel = (st.sel || []).filter((x) => data.stations[x.id] && x.c >= 0 && x.c < MAX);
  if (!st.sel.length) {
    const def = ['IBAG65', 'IGSOL4', 'IGISCL6'].filter((id) => data.stations[id]);
    st.sel = (def.length ? def : have.slice(0, 2).map((s) => s.id)).map((id, c) => ({ id, c }));
  }
  if (!VARS[st.v]) st.v = 'tavg';
  const save = () => { try { localStorage.setItem(K, JSON.stringify(st)); } catch {} };

  // ---- controls ----
  const fromEl = $('dFrom'), toEl = $('dTo');
  fromEl.min = toEl.min = isoOf(first);
  fromEl.max = toEl.max = isoOf(last);
  const chips = $('dStations');
  chips.innerHTML = have
    .map((s) => `<button type="button" data-id="${s.id}" aria-pressed="false"><i></i>${esc(shortName(s))}<small>${fmtAlt(s.alt)} · des de ${data.stations[s.id].from.slice(0, 4)}</small></button>`)
    .join('');
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    const id = b.dataset.id;
    const i = st.sel.findIndex((x) => x.id === id);
    if (i >= 0) {
      if (st.sel.length > 1) st.sel.splice(i, 1);
    } else {
      if (st.sel.length >= MAX) { status.textContent = `Com a molt ${MAX} estacions alhora (perquè els colors es distingeixin).`; return; }
      const used = new Set(st.sel.map((x) => x.c));
      st.sel.push({ id, c: [...Array(MAX).keys()].find((c) => !used.has(c)) });
    }
    render();
  });
  root.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { st.v = b.dataset.v; render(); }));
  root.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => { st.g = b.dataset.g; render(); }));
  $('dCum').addEventListener('click', () => { st.cum = !st.cum; render(); });
  const setRange = (a, b) => { st.from = isoOf(Math.max(first, a)); st.to = isoOf(Math.min(last, b)); render(); };
  root.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => {
    const p = b.dataset.p;
    if (p === '30') setRange(last - 29, last);
    else if (p === '365') setRange(last - 364, last);
    else if (p === 'any') setRange(dayIndex(`${isoOf(last).slice(0, 4)}-01-01`), last);
    else setRange(first, last);
  }));
  fromEl.addEventListener('change', () => { if (fromEl.value) { st.from = fromEl.value; if (st.from > st.to) st.to = st.from; render(); } });
  toEl.addEventListener('change', () => { if (toEl.value) { st.to = toEl.value; if (st.to < st.from) st.from = st.to; render(); } });
  $('dCsv').addEventListener('click', () => downloadCsv());

  // ---- dades agrupades ----
  // buckets: [{ key, label, a, b }] (a..b, índexs de dia inclosos)
  function buckets() {
    const a = dayIndex(st.from), b = dayIndex(st.to);
    const out = [];
    if (st.g === 'd') {
      for (let i = a; i <= b; i++) out.push({ key: isoOf(i), label: dm(isoOf(i)), a: i, b: i });
    } else {
      let i = a;
      while (i <= b) {
        const iso = isoOf(i);
        const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7));
        const end = st.g === 'm' ? dayIndex(new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)) : dayIndex(`${y}-12-31`);
        const key = st.g === 'm' ? iso.slice(0, 7) : String(y);
        out.push({ key, label: st.g === 'm' ? `${monthName(m)} de ${y}` : String(y), a: i, b: Math.min(end, b) });
        i = end + 1;
      }
    }
    return out;
  }
  const valAt = (id, v, i) => {
    const s = data.stations[id];
    const k = i - dayIndex(s.from);
    return k >= 0 && k < s.n ? s.cols[v][k] : null;
  };
  // Valor d'un període: suma, màxim o mitjana dels dies amb dades. Amb menys de la meitat de dies, res;
  // amb menys del 80 %, es marca com a incomplet.
  function aggregate(id, v, bk) {
    const xs = [];
    for (let i = bk.a; i <= bk.b; i++) { const x = valAt(id, v, i); if (x != null) xs.push(x); }
    const len = bk.b - bk.a + 1;
    if (!xs.length || xs.length < len * 0.5) return { v: null, n: xs.length, len };
    const agg = VARS[v].agg;
    const r = agg === 'sum' ? xs.reduce((p, q) => p + q, 0) : agg === 'max' ? Math.max(...xs) : xs.reduce((p, q) => p + q, 0) / xs.length;
    return { v: r, n: xs.length, len, part: xs.length < len * 0.8 };
  }
  function series() {
    const bks = buckets();
    const out = st.sel.map(({ id, c }) => {
      let acc = 0, any = false;
      const vals = bks.map((bk) => {
        const r = aggregate(id, st.v, bk);
        if (st.v === 'rain' && st.cum) {
          if (r.v != null) { acc += r.v; any = true; }
          return { ...r, v: any ? acc : null };
        }
        return r;
      });
      return { id, color: COLORS[c], name: shortName(BY_ID[id]), vals };
    });
    return { bks, out };
  }

  // ---- gràfic (SVG) ----
  const svgNS = 'http://www.w3.org/2000/svg';
  const box = $('dChart');
  const tip = $('dTip');
  function niceTicks(lo, hi, n = 5) {
    if (lo === hi) { lo -= 1; hi += 1; }
    const span = hi - lo;
    const step0 = span / n;
    const mag = 10 ** Math.floor(Math.log10(step0));
    const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => span / k <= n) || 10 * mag;
    const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step;
    const t = [];
    for (let x = a; x <= b + step / 2; x += step) t.push(Math.round(x * 1e6) / 1e6);
    return t;
  }
  function draw(bks, out) {
    const W = Math.max(320, box.clientWidth), H = W < 600 ? 300 : 420;
    const m = { l: 48, r: 14, t: 14, b: 34 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const nb = bks.length;
    const all = out.flatMap((s) => s.vals.map((x) => x.v)).filter((x) => x != null);
    box.innerHTML = '';
    if (!all.length) { box.innerHTML = '<p class="dd-empty">No hi ha dades d\'aquestes estacions en aquest període.</p>'; return; }
    const V = VARS[st.v];
    let lo = Math.min(...all), hi = Math.max(...all);
    if (V.zero) lo = Math.min(0, lo);
    const ticks = niceTicks(lo, hi);
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    const Y = (v) => m.t + ih - ((v - y0) / (y1 - y0)) * ih;
    const bars = st.v === 'rain' && !st.cum;
    const X = (i) => (bars || nb === 1 ? m.l + ((i + 0.5) * iw) / nb : m.l + (i * iw) / (nb - 1));
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${V.label} (${V.unit}) de ${out.map((s) => s.name).join(', ')}`);
    let h = '';
    for (const t of ticks) h += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}" class="g${t === 0 ? ' z' : ''}"/><text x="${m.l - 8}" y="${Y(t) + 4}" class="ty">${num(t, Number.isInteger(t) ? 0 : 1)}</text>`;
    // Etiquetes de l'eix X: candidates segons l'agrupació (anys; mesos; dies, o l'inici de cada mes si n'hi ha molts)
    // i, si no hi caben, una de cada tantes. L'any surt al gener i a la primera.
    const want = Math.max(2, Math.floor(iw / 80));
    const cand = [];
    for (let i = 0; i < nb; i++) {
      const k = bks[i].key;
      if (st.g === 'y') { cand.push([i, k]); continue; }
      const mm = Number(k.slice(5, 7)), yy = k.slice(0, 4);
      if (st.g === 'm') cand.push([i, MESC[mm - 1], yy, mm]);
      else if (nb <= 45) cand.push([i, `${Number(k.slice(8))} ${MESC[mm - 1]}`]);
      else if (k.slice(8) === '01') cand.push([i, MESC[mm - 1], yy, mm]);
    }
    const every = Math.max(1, Math.ceil(cand.length / want));
    cand.filter((_, j) => j % every === 0).forEach(([i, lab, yy, mm], j) => {
      const full = yy && (j === 0 || mm <= every) ? `${lab} ${yy}` : lab;
      h += `<text x="${X(i)}" y="${H - 10}" class="tx">${esc(full)}</text>`;
    });
    if (bars) {
      const gw = (iw / nb) * (nb > 60 ? 1 : 0.8);
      const ns = out.length;
      const bw = Math.max(1, gw / ns - (nb > 60 ? 0 : 2));
      out.forEach((s, k) => {
        s.vals.forEach((r, i) => {
          if (r.v == null) return;
          const x = X(i) - gw / 2 + k * (gw / ns);
          const y = Y(Math.max(0, r.v)), yb = Y(0);
          const hh = Math.max(0, yb - y);
          if (hh < 0.5) return;
          h += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="${bw > 6 ? 2 : 0}" fill="${s.color}"${r.part ? ' fill-opacity="0.45"' : ''}/>`;
        });
      });
    } else {
      out.forEach((s) => {
        let d = '', pen = false;
        s.vals.forEach((r, i) => {
          if (r.v == null) { pen = false; return; }
          d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)},${Y(r.v).toFixed(1)}`;
          pen = true;
        });
        h += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
        if (nb <= 40) s.vals.forEach((r, i) => { if (r.v != null) h += `<circle cx="${X(i)}" cy="${Y(r.v)}" r="4" fill="${r.part ? '#fff' : s.color}" stroke="${r.part ? s.color : '#fff'}" stroke-width="2"/>`; });
      });
    }
    h += `<line id="dCross" class="cross" y1="${m.t}" y2="${m.t + ih}" x1="-10" x2="-10"/>`;
    h += `<rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent" id="dHit"/>`;
    svg.innerHTML = h;
    box.appendChild(svg);
    const hit = svg.querySelector('#dHit'), cross = svg.querySelector('#dCross');
    const at = (ev) => {
      const r = svg.getBoundingClientRect();
      const x = ((ev.clientX - r.left) / r.width) * W;
      const i = bars || nb === 1 ? Math.floor(((x - m.l) / iw) * nb) : Math.round(((x - m.l) / iw) * (nb - 1));
      return Math.max(0, Math.min(nb - 1, i));
    };
    const show = (ev) => {
      const i = at(ev);
      cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i));
      const rows = out.map((s) => {
        const r = s.vals[i];
        return `<div><i style="background:${s.color}"></i>${esc(s.name)}<b>${r.v == null ? '—' : `${num(r.v, V.dec)} ${V.unit}`}</b>${r.part ? '<small>incomplet</small>' : ''}</div>`;
      }).join('');
      tip.innerHTML = `<p>${esc(bks[i].label)}</p>${rows}`;
      tip.hidden = false;
      const br = (tip.offsetParent || box).getBoundingClientRect();
      const px = ev.clientX - br.left;
      tip.style.left = `${Math.min(Math.max(8, px + 16), br.width - tip.offsetWidth - 8)}px`;
      tip.style.top = `${Math.max(8, ev.clientY - br.top - tip.offsetHeight - 12)}px`;
    };
    hit.addEventListener('pointermove', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('x1', -10); cross.setAttribute('x2', -10); });
  }

  // ---- resum de cada estació al període (dies) ----
  function summary() {
    const a = dayIndex(st.from), b = dayIndex(st.to);
    const V = VARS[st.v];
    return st.sel.map(({ id, c }) => {
      let n = 0, sum = 0, mx = null, mn = null, wet = 0;
      for (let i = a; i <= b; i++) {
        const x = valAt(id, st.v, i);
        if (x == null) continue;
        n++; sum += x;
        if (!mx || x > mx.v) mx = { v: x, d: isoOf(i) };
        if (!mn || x < mn.v) mn = { v: x, d: isoOf(i) };
        if (st.v === 'rain' && x >= 0.2) wet++;
      }
      const cards = st.v === 'rain'
        ? [['Total', n ? `${num(sum, 0)} mm` : '—'], ['Dia més plujós', mx ? `${num(mx.v)} mm` : '—', mx && dm(mx.d)], ['Dies de pluja', n ? String(wet) : '—']]
        : [['Mitjana', n ? `${num(sum / n, V.dec)} ${V.unit}` : '—'], ['Més alta', mx ? `${num(mx.v, V.dec)} ${V.unit}` : '—', mx && dm(mx.d)], ['Més baixa', mn ? `${num(mn.v, V.dec)} ${V.unit}` : '—', mn && dm(mn.d)]];
      return `<div class="dd-sum"><h3><i style="background:${COLORS[c]}"></i>${esc(shortName(BY_ID[id]))}</h3><p class="dd-n">${n} de ${b - a + 1} dies amb dades</p><dl>${cards.map(([k, v, s]) => `<div><dt>${k}</dt><dd>${v}${s ? `<small>${s}</small>` : ''}</dd></div>`).join('')}</dl></div>`;
    }).join('');
  }

  // ---- taula i CSV ----
  let lastTable = null;
  function table(bks, out) {
    const V = VARS[st.v];
    lastTable = { bks, out };
    const rows = bks.map((bk, i) => ({ bk, cells: out.map((s) => s.vals[i]) })).reverse();
    const shown = rows.slice(0, 400);
    const head = `<tr><th>${st.g === 'd' ? 'Dia' : st.g === 'm' ? 'Mes' : 'Any'}</th>${out.map((s) => `<th class="n"><i style="background:${s.color}"></i>${esc(s.name)}</th>`).join('')}</tr>`;
    const body = shown.map((r) => `<tr><td>${esc(r.bk.label)}</td>${r.cells.map((c) => `<td class="n">${c.v == null ? '—' : num(c.v, V.dec)}${c.part ? '<sup title="Període amb dades de menys del 80 % dels dies">*</sup>' : ''}</td>`).join('')}</tr>`).join('');
    $('dTable').innerHTML = `<table class="dtable"><thead>${head}</thead><tbody>${body}</tbody></table>${rows.length > shown.length ? `<p class="dd-note">Es mostren els ${shown.length} més recents de ${rows.length}. El CSV els porta tots.</p>` : ''}`;
  }
  function downloadCsv() {
    if (!lastTable) return;
    const { bks, out } = lastTable;
    const V = VARS[st.v];
    const lines = [[st.g === 'd' ? 'dia' : st.g === 'm' ? 'mes' : 'any', ...out.map((s) => `${s.name} (${V.unit})`)].join(';')];
    bks.forEach((bk, i) => lines.push([bk.key, ...out.map((s) => (s.vals[i].v == null ? '' : String(Math.round(s.vals[i].v * 10) / 10).replace('.', ',')))].join(';')));
    const blob = new Blob([`﻿${lines.join('\n')}\n`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `meteocadi-${st.v}${st.v === 'rain' && st.cum ? '-acumulada' : ''}-${st.g === 'd' ? 'dies' : st.g === 'm' ? 'mesos' : 'anys'}-${st.from}-${st.to}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function render() {
    save();
    status.textContent = '';
    fromEl.value = st.from;
    toEl.value = st.to;
    root.querySelectorAll('[data-v]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === st.v)));
    root.querySelectorAll('[data-g]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.g === st.g)));
    const cum = $('dCum');
    cum.hidden = st.v !== 'rain';
    cum.setAttribute('aria-pressed', String(st.cum));
    chips.querySelectorAll('button').forEach((b) => {
      const s = st.sel.find((x) => x.id === b.dataset.id);
      b.setAttribute('aria-pressed', String(!!s));
      b.querySelector('i').style.background = s ? COLORS[s.c] : '';
    });
    // Massa dies per veure'ls d'un en un: es passa a mesos
    const span = dayIndex(st.to) - dayIndex(st.from) + 1;
    if (st.g === 'd' && span > 800) { st.g = 'm'; status.textContent = 'Més de 800 dies: es mostren per mesos.'; return render(); }
    const V = VARS[st.v];
    const { bks, out } = series();
    $('dTitle').textContent = `${st.v === 'rain' && st.cum ? 'Pluja acumulada' : st.g === 'd' ? V.label : V.aggLabel[0].toUpperCase() + V.aggLabel.slice(1)} (${V.unit}) · ${st.g === 'd' ? 'per dies' : st.g === 'm' ? 'per mesos' : 'per anys'}`;
    $('dLegend').innerHTML = out.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('');
    draw(bks, out);
    $('dSummary').innerHTML = summary();
    table(bks, out);
  }
  let rt = null;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 150); });
  render();
}
