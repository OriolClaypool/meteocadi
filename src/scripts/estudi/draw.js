// Estudi · dibuix de les imatges verticals (1080 × 1920) per a Stories i X.
// Tres plantilles amb el mateix sistema: capçalera (data + títol en dues línies, la segona en color),
// contingut i peu amb meteocadi.cat. Marges pensats per a Stories: capçalera a 180 px, peu a ~1.700 px.
import { tempColor, tempColorLight, num, dayName, dayMonth, cap } from '../../lib/format.js';

export const W = 1080;
export const H = 1920;
const TOP = 180;
const FOOT_Y = 1688;
const LIMIT = 1652; // on ha d'acabar el contingut
const X0 = 64;
const X1 = 1016;

const F = { head: "'Schibsted Grotesk Variable'", ui: "'Geist Variable'", mono: "'Geist Mono Variable'" };
const A = { bg: '#060a12', cy: '#3db8ff', txt: '#e6edf6', txt2: '#c3cfde', mut: '#93a3b8', mut2: '#7d8fa6', gold: '#f6c664' };
const L = { bg: '#eef3f8', ink: '#10233b', ink2: '#44556b', mut: '#56667a', blue: '#22477a', line: '#dfe6ee', rank: '#8a99ab' };
const STRIP = ['#22477a', '#47a838', '#be282c', '#fbbd28'];

export const WEATHER = { sol: 'Sol', solnuvol: 'Sol i núvols', solpluja: 'Ruixats', nuvol: 'Ennuvolat', pluja: 'Pluja', tempesta: 'Tempesta', neu: 'Neu', boira: 'Boira', vent: 'Vent' };
export const ALERTS = { groc: '#f6c664', taronja: '#fba06a', vermell: '#fa858c' };
export const PHENOMENA = { pluja: 'pluja', tempesta: 'tempesta', neu: 'neu', vent: 'vent', calor: 'calor', fred: 'fred' };

// ------------------------------------------------------------------ utilitats
export async function loadFonts() {
  const s = 'AaÀàÈèÉéÍíÏïÒòÓóÚúÜüÇç·°−—0123456789';
  await Promise.all([
    document.fonts.load(`800 96px ${F.head}`, s),
    document.fonts.load(`700 32px ${F.head}`, s),
    document.fonts.load(`400 30px ${F.ui}`, s),
    document.fonts.load(`400 24px ${F.mono}`, s),
    document.fonts.load(`500 40px ${F.mono}`, s),
  ]);
}

export function loadIcons() {
  return Promise.all(
    Object.keys(WEATHER).map(
      (k) =>
        new Promise((res) => {
          const img = new Image();
          img.onload = () => res([k, img]);
          img.onerror = () => res([k, null]);
          img.src = `/imatges/estudi/${k}.svg`;
        }),
    ),
  ).then((e) => Object.fromEntries(e));
}

function font(ctx, fam, size, weight = 400) {
  ctx.font = `${weight} ${size}px ${F[fam]}`;
}

// Espaiat de lletra: natiu si el navegador el té; si no, lletra a lletra (només per a textos curts)
const HAS_LS = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;
function tracking(ctx, px) {
  if (HAS_LS) ctx.letterSpacing = `${px}px`;
}

function spacedWidth(ctx, text, sp) {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + sp;
  return w - sp;
}

// Text en majúscules espaiat (etiquetes en Geist Mono)
function spaced(ctx, text, x, y, sp, align = 'left') {
  const w = spacedWidth(ctx, text, sp);
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.textAlign = 'left';
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + sp;
  }
  return w;
}

export function wrap(ctx, text, width) {
  const out = [];
  for (const para of String(text || '').split('\n')) {
    if (!para.trim()) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of para.trim().split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > width && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    if (line) out.push(line);
  }
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
}

// Espai no separable entre xifra i unitat ("10 mm" no es parteix)
export function nbsp(t) {
  return String(t || '').replace(/(\d) (mm|°C|°|km\/h|m|%|cm|l\/m²)(?=[\s.,;:)]|$)/g, '$1 $2');
}

function fitFont(ctx, fam, size, weight, text, maxW, min = size * 0.6) {
  let s = size;
  font(ctx, fam, s, weight);
  while (ctx.measureText(text).width > maxW && s > min) {
    s -= 2;
    font(ctx, fam, s, weight);
  }
  return s;
}

const altTxt = (a) => `${String(a).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} m`;

// ------------------------------------------------------------------ peces comunes
const CONT = 'M-200 -20C-190 -140 -40 -190 80 -160C200 -130 260 -40 230 60C200 160 60 190 -60 170C-170 150 -210 80 -200 -20Z';
function contours(ctx) {
  const p = new Path2D(CONT);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, 760);
  ctx.clip();
  ctx.strokeStyle = 'rgba(61,184,255,0.10)';
  for (let j = 0; j < 9; j++) {
    const s = 0.3 + 0.3 * j + 0.025 * j * j;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(900, 250);
    ctx.rotate(((-8 + 3 * j) * Math.PI) / 180);
    ctx.scale(s, s);
    ctx.lineWidth = 1.5 / s;
    ctx.stroke(p);
  }
  ctx.restore();
}

function background(ctx, dark) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = dark ? A.bg : L.bg;
  ctx.fillRect(0, 0, W, H);
  if (dark) contours(ctx);
}

function footer(ctx, dark, pageLabel = '') {
  ctx.textBaseline = 'middle';
  tracking(ctx, -0.36);
  font(ctx, 'head', 36, 800);
  ctx.fillStyle = dark ? A.txt : L.ink;
  ctx.textAlign = 'left';
  ctx.fillText('meteocadi.cat', X0, FOOT_Y + 30);
  tracking(ctx, 0);
  if (pageLabel) {
    font(ctx, 'mono', 22);
    ctx.fillStyle = dark ? A.mut2 : L.mut;
    spaced(ctx, pageLabel, X1, FOOT_Y + 30, 2.6, 'right');
  }
  const w = W / 4;
  STRIP.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * w, H - 8, w + 1, 8);
  });
}

// Data en majúscules i títol de dues línies. Retorna on acaba.
function header(ctx, eyebrow, l1, l2, c0, c1, c2) {
  ctx.textBaseline = 'middle';
  font(ctx, 'mono', 24);
  ctx.fillStyle = c0;
  spaced(ctx, eyebrow.toLocaleUpperCase('ca'), X0, TOP + 15, 3.36);
  tracking(ctx, -3.36);
  const s1 = fitFont(ctx, 'head', 96, 800, l1, X1 - X0);
  ctx.fillStyle = c1;
  ctx.fillText(l1, X0, TOP + 93);
  const s2 = fitFont(ctx, 'head', 96, 800, l2, X1 - X0);
  ctx.fillStyle = c2;
  font(ctx, 'head', Math.min(s1, s2), 800);
  ctx.fillText(l2, X0, TOP + 187);
  tracking(ctx, 0);
  return TOP + 234;
}

function hline(ctx, x0, x1, y, color, w = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(x0, Math.round(y) - (w > 1 ? w / 2 : 0), x1 - x0, w);
}

function vline(ctx, x, y0, y1, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y0, 1, y1 - y0);
}

// ------------------------------------------------------------------ Resum del dia
// d: { date, kind: 'ahir'|'avui'|'dia', time, rows: [{ name, alt, max, min, gust, rain, susp }] }
export function drawResum(ctx, d) {
  background(ctx, true);
  const rows = d.rows.filter((r) => r.max != null || r.min != null);
  const temps = rows.filter((r) => !r.susp);
  const best = (list, k, dir) => list.filter((r) => r[k] != null).sort((a, b) => dir * (b[k] - a[k]))[0] || null;
  const mx = best(temps, 'max', 1);
  const mn = best(temps, 'min', -1);
  const gu = best(rows, 'gust', 1);
  const rainy = rows.filter((r) => (r.rain ?? 0) > 0);
  const ra = best(rows, 'rain', 1);
  const alts = rows.map((r) => r.alt);

  const lead = d.kind === 'ahir' ? "Resum d'ahir" : d.kind === 'avui' ? `Avui fins a les ${d.time}` : 'Resum del dia';
  const eyebrow = `${lead} · ${rows.length} estacions · ${Math.min(...alts).toLocaleString('ca-ES')} — ${Math.max(...alts).toLocaleString('ca-ES')} m`;
  const y0 = header(ctx, eyebrow, cap(dayName(d.date)), dayMonth(d.date), A.cy, '#ffffff', A.cy) + 44;

  // Quatre extrems
  const CH = 244;
  const cells = [
    ['Màxima', mx ? num(mx.max) : '—', '°C', '#ef4444', mx ? `${mx.name} · ${altTxt(mx.alt)}` : 'Sense dades'],
    ['Mínima', mn ? num(mn.min) : '—', '°C', '#2dd4bf', mn ? `${mn.name} · ${altTxt(mn.alt)}` : 'Sense dades'],
    ['Ratxa màxima', gu ? num(gu.gust) : '—', 'km/h', '#fbbf24', gu ? `${gu.name} · ${altTxt(gu.alt)}` : 'Sense dades'],
    [
      'Pluja',
      ra && ra.rain > 0 ? num(ra.rain) : '0,0',
      'mm',
      '#60a5fa',
      !rainy.length ? 'Sense pluja a la xarxa' : rainy.length === 1 ? `${ra.name} · única estació` : `${ra.name} · ${rainy.length} estacions amb pluja`,
    ],
  ];
  hline(ctx, X0, X1, y0, 'rgba(61,184,255,0.22)');
  hline(ctx, X0, X1, y0 + CH, 'rgba(61,184,255,0.10)');
  hline(ctx, X0, X1, y0 + 2 * CH, 'rgba(61,184,255,0.22)');
  vline(ctx, 540, y0, y0 + 2 * CH, 'rgba(61,184,255,0.14)');
  cells.forEach(([label, val, unit, color, who], i) => {
    const x = i % 2 ? 576 : X0;
    const y = y0 + (i >= 2 ? CH : 0);
    const maxW = i % 2 ? X1 - 576 : 540 - X0 - 24;
    ctx.textBaseline = 'middle';
    font(ctx, 'mono', 22);
    ctx.fillStyle = A.mut2;
    spaced(ctx, label.toLocaleUpperCase('ca'), x, y + 42, 2.64);
    ctx.textBaseline = 'alphabetic';
    tracking(ctx, -4.48);
    font(ctx, 'mono', 112, 500);
    ctx.fillStyle = color;
    ctx.fillText(val, x, y + 158);
    const vw = ctx.measureText(val).width;
    tracking(ctx, 0);
    font(ctx, 'mono', 36);
    ctx.fillStyle = A.mut;
    ctx.fillText(unit, x + vw + 10, y + 158);
    ctx.textBaseline = 'middle';
    fitFont(ctx, 'ui', 26, 400, who, maxW, 20);
    ctx.fillStyle = A.txt2;
    ctx.fillText(who, x, y + 202);
  });

  // Taula de totes les estacions (de dalt a baix)
  let y = y0 + 2 * CH + 32;
  const RH = Math.min(48, Math.floor((LIMIT - y - 34) / Math.max(rows.length, 1)));
  const cols = [736, 886, X1];
  ctx.textBaseline = 'middle';
  font(ctx, 'mono', 19);
  ctx.fillStyle = A.mut2;
  spaced(ctx, 'ESTACIÓ', X0, y + 11, 1.9);
  ['MÀX.', 'MÍN.', 'MM'].forEach((t, i) => spaced(ctx, t, cols[i], y + 11, 1.9, 'right'));
  y += 33;
  hline(ctx, X0, X1, y, 'rgba(61,184,255,0.16)');
  for (const r of [...rows].sort((a, b) => b.alt - a.alt)) {
    const cyy = y + RH / 2;
    font(ctx, 'ui', 26);
    ctx.fillStyle = A.txt;
    ctx.textAlign = 'left';
    ctx.fillText(r.name, X0, cyy);
    const nw = ctx.measureText(r.name).width;
    font(ctx, 'mono', 18);
    ctx.fillStyle = A.mut2;
    ctx.fillText(altTxt(r.alt), X0 + nw + 10, cyy + 2);
    ctx.textAlign = 'right';
    font(ctx, 'mono', 29);
    ctx.fillStyle = r.susp ? '#56677e' : tempColor(r.max);
    ctx.fillText(r.max == null ? '—' : `${num(r.max)}°`, cols[0], cyy);
    ctx.fillStyle = r.susp ? '#56677e' : tempColor(r.min);
    ctx.fillText(r.min == null ? '—' : `${num(r.min)}°`, cols[1], cyy);
    font(ctx, 'mono', 25);
    ctx.fillStyle = (r.rain ?? 0) > 0 ? '#60a5fa' : '#56677e';
    ctx.fillText(r.rain == null ? '—' : num(r.rain), cols[2], cyy);
    ctx.textAlign = 'left';
    y += RH;
    hline(ctx, X0, X1, y, 'rgba(255,255,255,0.06)');
  }
  footer(ctx, true);
}

// ------------------------------------------------------------------ Rànquing
export const RANK_VARS = {
  max: { t1: 'Les màximes', key: 'max', dir: 1, color: '#c2410c', unit: '°' },
  min: { t1: 'Les mínimes', key: 'min', dir: -1, color: '#0369a1', unit: '°' },
  pluja: { t1: 'La pluja', key: 'rain', dir: 1, color: '#1d4ed8', unit: 'mm' },
  ratxa: { t1: 'Les ratxes', key: 'gust', dir: 1, color: '#b45309', unit: 'km/h' },
};

export function rankRows(rows, v) {
  const cfg = RANK_VARS[v];
  return rows
    .filter((r) => r[cfg.key] != null && !(r.susp && (v === 'max' || v === 'min')))
    .map((r) => ({ ...r, v: r[cfg.key] }))
    .sort((a, b) => cfg.dir * (b.v - a.v) || b.alt - a.alt);
}

// Frase automàtica (es pot editar a l'estudi)
export function rankSentence(rows, v) {
  const list = rankRows(rows, v);
  if (!list.length) return '';
  const first = list[0];
  const last = list[list.length - 1];
  if (v === 'max' || v === 'min') {
    const diff = Math.abs(first.v - last.v);
    const dalt = Math.abs(first.alt - last.alt);
    const what = v === 'max' ? 'màxima' : 'mínima';
    // Inversió tèrmica: una estació de vall més freda que la més alta de la xarxa
    const top = [...list].sort((a, b) => b.alt - a.alt)[0];
    if (v === 'min' && top !== first && first.v < top.v && top.alt - first.alt >= 300) {
      return `Inversió tèrmica: ${first.name} (${altTxt(first.alt)}) va ser més freda que ${top.name}, ${(top.alt - first.alt).toLocaleString('ca-ES')} metres més amunt.`;
    }
    if (list.length < 2) return `${cap(what)} de ${num(first.v)} °C a ${first.name}.`;
    return `${num(diff, 0)} °C de diferència de ${what} entre ${first.name} i ${last.name}, amb ${dalt.toLocaleString('ca-ES')} metres de desnivell.`;
  }
  if (v === 'pluja') {
    const wet = list.filter((r) => r.v > 0);
    if (!wet.length) return 'Cap estació de la xarxa va recollir pluja.';
    if (wet.length === 1) return `Només va ploure a ${first.name}: ${num(first.v)} mm.`;
    return `${wet.length} estacions amb pluja. El màxim, ${num(first.v)} mm a ${first.name}.`;
  }
  return `La ratxa més forta, ${num(first.v)} km/h a ${first.name} (${altTxt(first.alt)}).`;
}

// d: { date, when: "d'ahir" | "d'avui" | "del 25 de setembre", variable, rows, sentence }
export function drawRanking(ctx, d) {
  background(ctx, false);
  const cfg = RANK_VARS[d.variable];
  const list = rankRows(d.rows, d.variable);
  let y = header(ctx, `${dayName(d.date)} ${dayMonth(d.date)}`, cfg.t1, d.when, L.blue, L.ink, cfg.color);

  y += 14;
  const sentence = nbsp(d.sentence);
  if (sentence.trim()) {
    font(ctx, 'ui', 30);
    ctx.fillStyle = L.ink2;
    ctx.textBaseline = 'middle';
    const lines = wrap(ctx, sentence, 900).slice(0, 3);
    for (const line of lines) {
      ctx.fillText(line, X0, y + 21);
      y += 42;
    }
  }
  y += 40;
  hline(ctx, X0, X1, y, L.ink, 2);
  const RH = Math.min(88, Math.floor((LIMIT - y) / Math.max(list.length, 1)));

  // Escala de les barres: la més llarga fa 380 px i totes en tenen una mica
  const vals = list.map((r) => r.v);
  const hi = Math.max(...vals, 0);
  const temp = d.variable === 'max' || d.variable === 'min';
  const lo = temp ? Math.min(...vals) - Math.max(2, (hi - Math.min(...vals)) * 0.5) : 0;
  const lo2 = Math.min(...vals); // per invertir l'escala de les mínimes
  const BAR = 380;
  list.forEach((r, i) => {
    const cy = y + RH / 2;
    ctx.textBaseline = 'middle';
    font(ctx, 'mono', 26);
    ctx.fillStyle = L.rank;
    ctx.fillText(String(i + 1).padStart(2, '0'), X0, cy);
    fitFont(ctx, 'head', 32, 700, r.name, 318, 24);
    ctx.fillStyle = L.ink;
    ctx.fillText(r.name, 120, cy - 12);
    font(ctx, 'mono', 19);
    ctx.fillStyle = L.mut;
    ctx.fillText(altTxt(r.alt), 120, cy + 21);
    // A les mínimes la barra més llarga és la de l'estació més freda (la primera del rànquing)
    const len = hi - lo > 0 ? Math.max(0, ((d.variable === 'min' ? hi + lo2 - r.v - lo : r.v - lo) / (hi - lo)) * BAR) : 0;
    const barColor = temp ? tempColor(r.v) : d.variable === 'pluja' ? (r.v > 0 ? '#60a5fa' : '#c9d5e3') : '#fbbf24';
    if (len > 0) {
      ctx.fillStyle = barColor;
      ctx.beginPath();
      ctx.roundRect(450, cy - 17, Math.max(len, 12), 34, 6);
      ctx.fill();
    }
    const vx = 450 + (len > 0 ? Math.max(len, 12) + 18 : 0);
    font(ctx, 'mono', 40, 500);
    ctx.fillStyle = temp ? tempColorLight(r.v) : r.v > 0 ? cfg.color : L.rank;
    const txt = temp ? `${num(r.v)}°` : num(r.v);
    ctx.fillText(txt, vx, cy + 1);
    if (!temp) {
      const tw = ctx.measureText(txt).width;
      font(ctx, 'mono', 22);
      ctx.fillStyle = L.mut;
      ctx.fillText(cfg.unit, vx + tw + 8, cy + 5);
    }
    y += RH;
    hline(ctx, X0, X1, y, L.line);
  });
  footer(ctx, false);
}

// ------------------------------------------------------------------ Previsió
// st: { date, days: [{ headline, text, mode, weather, morning, afternoon, alert, alertType }, …], summary }
const hasWeather = (day) => !!(day.mode === 'split' ? day.morning || day.afternoon : day.weather);
const dayEmpty = (day) => !day.headline.trim() && !day.text.trim() && !hasWeather(day);

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function measureCard(ctx, day, index, k) {
  const hs = Math.round((index === 0 ? 72 : 64) * k);
  const bs = Math.round(35 * k);
  const bl = Math.round(bs * 1.4);
  const w = hasWeather(day);
  font(ctx, 'head', hs, 800);
  tracking(ctx, -0.03 * hs);
  const title = day.headline.trim() ? wrap(ctx, nbsp(day.headline.trim()), 872) : [];
  tracking(ctx, 0);
  font(ctx, 'ui', bs);
  const body = day.text.trim() ? wrap(ctx, nbsp(day.text.trim()), 872) : [];
  const start = w ? 144 : 100;
  const th = title.length * Math.round(hs * 1.04);
  const bh = body.reduce((n, l) => n + (l ? bl : bl * 0.5), 0);
  const alertH = day.alert && day.alert !== 'none' ? 28 + 48 : 0;
  const h = Math.max(start + th + (title.length && body.length ? 20 : 0) + bh + alertH + 36, w ? 176 : 112);
  return { type: 'day', index, day, hs, bs, bl, title, body, start, height: h };
}

function measureSummary(ctx, text, k) {
  const s = Math.round(33 * k);
  font(ctx, 'ui', s);
  const lines = wrap(ctx, nbsp(text.trim()), X1 - X0);
  const lh = Math.round(s * 1.4);
  return { type: 'summary', lines, size: s, lh, height: 28 + 24 + 26 + 10 + lines.reduce((n, l) => n + (l ? lh : lh * 0.5), 0) };
}

export function layoutPrevisio(ctx, st) {
  const blocks = (k) => {
    const out = [];
    st.days.forEach((day, i) => {
      if (!(i > 0 && dayEmpty(day))) out.push(measureCard(ctx, day, i, k));
    });
    if (st.summary.trim()) out.push(measureSummary(ctx, st.summary, k));
    return out;
  };
  const top = TOP + 234 + 44;
  const GAP = 22;
  for (const k of [1, 0.94, 0.88, 0.84]) {
    const b = blocks(k);
    const total = b.reduce((n, x) => n + x.height, 0) + GAP * (b.length - 1);
    if (top + total <= LIMIT) {
      let y = top;
      return { pages: [b.map((x) => { const o = { ...x, y }; y += x.height + GAP; return o; })], k, error: '' };
    }
  }
  // No hi cap en una imatge: es reparteix en diverses
  const b = blocks(0.84);
  const pages = [[]];
  let y = top;
  let error = '';
  for (const x of b) {
    if (top + x.height > LIMIT) error = 'Algun bloc és massa llarg per a una sola imatge. Escurça el text.';
    if (y + x.height > LIMIT && pages[pages.length - 1].length) {
      pages.push([]);
      y = top;
    }
    pages[pages.length - 1].push({ ...x, y });
    y += x.height + GAP;
  }
  return { pages, k: 0.84, error };
}

function alertPill(ctx, x, y, level, type) {
  const c = ALERTS[level];
  const label = `AVÍS ${level} · ${PHENOMENA[type] || type}`.toLocaleUpperCase('ca');
  font(ctx, 'mono', 22, 500);
  const tw = spacedWidth(ctx, label, 2.2);
  const w = 18 + 24 + 12 + tw + 18;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 48, 8);
  ctx.fill();
  // triangle d'avís
  ctx.save();
  ctx.translate(x + 18, y + 12);
  ctx.strokeStyle = A.bg;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D('M12 3.5 2.5 20h19L12 3.5Z'));
  ctx.stroke(new Path2D('M12 10v4.5'));
  ctx.stroke(new Path2D('M12 17.3v.2'));
  ctx.restore();
  ctx.fillStyle = A.bg;
  ctx.textBaseline = 'middle';
  spaced(ctx, label, x + 54, y + 25, 2.2);
}

function drawCard(ctx, b, st, icons) {
  const { day, index, y } = b;
  const acc = index === 0 ? A.gold : A.cy;
  ctx.fillStyle = 'rgba(61,184,255,0.045)';
  ctx.strokeStyle = 'rgba(61,184,255,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(X0 + 0.5, y + 0.5, X1 - X0 - 1, b.height - 1, 20);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = acc;
  ctx.fillRect(X0, y + 32, 4, 34);

  ctx.textBaseline = 'middle';
  font(ctx, 'mono', 26, 500);
  ctx.fillStyle = acc;
  const lw = spaced(ctx, index === 0 ? 'AVUI' : 'DEMÀ', 104, y + 49, 3.64);
  font(ctx, 'mono', 22);
  ctx.fillStyle = A.mut2;
  const date = addDays(st.date, index);
  spaced(ctx, `${dayName(date)} ${Number(date.slice(8))}`.toLocaleUpperCase('ca'), 104 + lw + 18, y + 50, 2.64);

  // Símbols: matí i tarda, o un de sol per a tot el dia
  font(ctx, 'mono', 19);
  ctx.fillStyle = A.mut2;
  if (day.mode === 'split') {
    [[day.morning, 810, 'MATÍ'], [day.afternoon, 934, 'TARDA']].forEach(([k, cx, lab]) => {
      if (!k) return;
      if (icons[k]) ctx.drawImage(icons[k], cx - 50, y + 14, 100, 100);
      spaced(ctx, lab, cx, y + 124, 2.28, 'center');
    });
  } else if (day.weather) {
    if (icons[day.weather]) ctx.drawImage(icons[day.weather], 928 - 54, y + 12, 108, 108);
    spaced(ctx, WEATHER[day.weather].toLocaleUpperCase('ca'), 928, y + 130, 2.28, 'center');
  }

  let cy = y + b.start;
  const lh = Math.round(b.hs * 1.04);
  font(ctx, 'head', b.hs, 800);
  tracking(ctx, -0.03 * b.hs);
  ctx.fillStyle = '#ffffff';
  for (const line of b.title) {
    ctx.fillText(line, 104, cy + lh / 2);
    cy += lh;
  }
  tracking(ctx, 0);
  if (b.title.length && b.body.length) cy += 20;
  font(ctx, 'ui', b.bs);
  ctx.fillStyle = A.txt2;
  for (const line of b.body) {
    if (line) ctx.fillText(line, 104, cy + b.bl / 2);
    cy += line ? b.bl : b.bl * 0.5;
  }
  if (day.alert && day.alert !== 'none') alertPill(ctx, 104, cy + 28, day.alert, day.alertType);
}

function drawSummary(ctx, b) {
  const y = b.y + 6;
  hline(ctx, X0, X1, y, 'rgba(61,184,255,0.22)');
  ctx.textBaseline = 'middle';
  font(ctx, 'mono', 22);
  ctx.fillStyle = A.cy;
  spaced(ctx, 'PRÒXIMS DIES', X0, y + 24 + 13, 3.08);
  font(ctx, 'ui', b.size);
  ctx.fillStyle = A.txt2;
  let cy = y + 24 + 26 + 10;
  for (const line of b.lines) {
    if (line) ctx.fillText(line, X0, cy + b.lh / 2);
    cy += line ? b.lh : b.lh * 0.5;
  }
}

export function drawPrevisio(ctx, st, icons, layout, page = 0) {
  background(ctx, true);
  const both = st.days[1] && !dayEmpty(st.days[1]);
  header(ctx, `Previsió · ${dayName(st.date)} ${dayMonth(st.date)}`, 'El temps', both ? "d'avui i demà" : "d'avui", A.cy, '#ffffff', A.cy);
  const items = layout.pages[Math.min(page, layout.pages.length - 1)] || [];
  for (const b of items) b.type === 'day' ? drawCard(ctx, b, st, icons) : drawSummary(ctx, b);
  footer(ctx, true, layout.pages.length > 1 ? `${page + 1} / ${layout.pages.length}` : '');
}
