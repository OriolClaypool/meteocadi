// Estudi · dibuix de les imatges verticals (1080 × 1920) per a Stories i X.
// Tres plantilles amb el mateix sistema: capçalera (data + títol en dues línies, la segona en color),
// contingut i peu amb meteocadi.cat. Marges pensats per a Stories: capçalera a 180 px, peu a ~1.700 px.
import { tempColor, num, dayName, dayMonth, cap } from '../../lib/format.js';
import { SCALES, fieldColor, readableOn, rainClasses } from '../../lib/escales.js';

export const W = 1080;
export const H = 1920;
const TOP = 180;
const PV_TOP = 280; // la previsió comença més avall (més aire a dalt a Stories)
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
    // Només els espais normals separen paraules: els no separables de nbsp() mantenen "10 mm" junt
    for (const word of para.trim().split(/[ \t]+/)) {
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

// Majúscula a l'inici del text i de cada paràgraf que comença després d'un punt o d'una línia en blanc
// ("Demà: al matí…" enganxat deixa "al matí…"). No toca les línies que continuen una frase.
export function capFirst(text) {
  let prev = '';
  return String(text || '')
    .split('\n')
    .map((line) => {
      const out = !prev.trim() || /[.!?…]["'»)]*\s*$/.test(prev)
        ? line.replace(/^([^\p{L}\p{N}]*)(\p{Ll})/u, (m, a, b) => a + b.toLocaleUpperCase('ca'))
        : line;
      prev = line;
      return out;
    })
    .join('\n');
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

// foot i hh: on va el peu i l'alçada de la imatge (per defecte, la vertical de 1080 × 1920)
function footer(ctx, dark, pageLabel = '', credit = '', foot = FOOT_Y, hh = H) {
  ctx.textBaseline = 'middle';
  tracking(ctx, -0.36);
  font(ctx, 'head', 36, 800);
  ctx.fillStyle = dark ? A.txt : L.ink;
  ctx.textAlign = 'left';
  ctx.fillText('meteocadi.cat', X0, foot + 30);
  tracking(ctx, 0);
  if (pageLabel) {
    font(ctx, 'mono', 22);
    ctx.fillStyle = dark ? A.mut2 : L.mut;
    spaced(ctx, pageLabel, X1, foot + 30, 2.6, 'right');
  }
  if (credit) {
    font(ctx, 'mono', 17);
    ctx.fillStyle = dark ? A.mut2 : L.mut;
    spaced(ctx, credit, X1, foot + 32, 1.8, 'right');
  }
  const w = W / 4;
  STRIP.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * w, hh - 8, w + 1, 8);
  });
}

// Data en majúscules i títol de dues línies. Retorna on acaba. k: escala (1 a les imatges verticals; menys a la 4:5)
function header(ctx, eyebrow, l1, l2, c0, c1, c2, top = TOP, k = 1) {
  ctx.textBaseline = 'middle';
  const eb = eyebrow.toLocaleUpperCase('ca');
  let es = Math.round(24 * k);
  font(ctx, 'mono', es);
  while (es > 15 && spacedWidth(ctx, eb, es * 0.14) > X1 - X0) font(ctx, 'mono', --es);
  ctx.fillStyle = c0;
  spaced(ctx, eb, X0, top + 15 * k, es * 0.14);
  tracking(ctx, -3.36 * k);
  const s1 = fitFont(ctx, 'head', Math.round(96 * k), 800, l1, X1 - X0);
  ctx.fillStyle = c1;
  ctx.fillText(l1, X0, top + 93 * k);
  if (!l2) {
    tracking(ctx, 0);
    return top + 140 * k; // títol d'una sola línia
  }
  const s2 = fitFont(ctx, 'head', Math.round(96 * k), 800, l2, X1 - X0);
  ctx.fillStyle = c2;
  font(ctx, 'head', Math.min(s1, s2), 800);
  ctx.fillText(l2, X0, top + 187 * k);
  tracking(ctx, 0);
  return top + 234 * k;
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
  spaced(ctx, 'ESTACIONS DE LA XARXA METEOCADÍ', X0, y + 11, 1.9);
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

// Colors del rànquing: la mateixa escala que els mapes (src/lib/escales.js), perquè el color digui la magnitud
// (pluja per classes del Meteocat, temperatura cada 5 °C, ratxes). La xifra, del mateix to però prou fosc per llegir-se.
const SCALE_OF = { max: 'tmax', min: 'tmin', pluja: 'rain', ratxa: 'gust' };
const UNIT_OF = { max: '°C', min: '°C', pluja: 'mm', ratxa: 'km/h' };
const DRY = '#c9d5e3';
const barColor = (variable, v) => (variable === 'pluja' && v < 0.1 ? DRY : fieldColor(SCALE_OF[variable], v));
const valueColor = (variable, v) => (variable === 'pluja' && v < 0.1 ? L.rank : readableOn(fieldColor(SCALE_OF[variable], v)));

// Llegenda de l'escala (com la del mapa): una casella per classe o tram amb el valor a sota, i el títol a sobre.
// Retorna l'alçada que ocupa. Si les xifres no hi caben, només se n'escriu una de cada dues.
// max: el valor més alt del rànquing; a la pluja, la llegenda mostra les mateixes classes que el mapa (rainClasses)
function drawScale(ctx, variable, x0, x1, y, { sw = 22, fs = 17, cs = 16, gap = 4, max = null } = {}) {
  const all = SCALES[SCALE_OF[variable]].stops;
  const keep = variable === 'pluja' ? new Set(rainClasses(max ?? 0).steps) : null;
  const stops = keep ? all.filter(([v]) => keep.has(v)) : all;
  const n = stops.length;
  const w = (x1 - x0 - gap * (n - 1)) / n;
  ctx.textBaseline = 'middle';
  font(ctx, 'mono', cs);
  ctx.fillStyle = L.mut;
  spaced(ctx, `ESCALA DE COLORS DEL MAPA (${UNIT_OF[variable]})`, x0, y + cs / 2, cs * 0.11);
  const top = y + cs + 8;
  font(ctx, 'mono', fs);
  const label = (v) => (Number.isInteger(v) ? num(v, 0) : num(v, 1));
  const widest = Math.max(...stops.map(([v]) => ctx.measureText(label(v)).width));
  const every = widest + 6 > w + gap ? 2 : 1;
  stops.forEach(([v, r, g, b], i) => {
    const x = x0 + i * (w + gap);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.beginPath();
    ctx.roundRect(x, top, w, sw, 4);
    ctx.fill();
    if (i % every) return;
    ctx.fillStyle = L.mut;
    ctx.textAlign = 'center';
    ctx.fillText(label(v), x + w / 2, top + sw + fs * 0.85);
    ctx.textAlign = 'left';
  });
  return top + sw + fs * 1.4 - y;
}

// Rànquing de Catalunya: les 10 primeres de les estacions automàtiques del Meteocat (XEMA). La llicència de les
// dades obertes demana citar-ne la font.
export const CAT_TOP = 10;
const CAT_CREDIT = 'DADES: SERVEI METEOROLÒGIC DE CATALUNYA';

// "Catalunya · dissabte 3 d'octubre" (i, de les darreres 24 hores, fins a quina hora)
function rankEyebrow(d) {
  // Diversos dies: "Període de 7 dies" (i l'hora, si arriba fins avui)
  const day = d.kind === 'range' ? `Període de ${d.days} dies${d.time ? ` · fins avui a les ${d.time}` : ''}` : `${dayName(d.date)} ${dayMonth(d.date)}`;
  if (d.net !== 'cat') return day;
  return `Catalunya · ${day}${d.kind === '24h' && d.time ? ` · fins a les ${d.time}` : ''}`;

}

// Nom de l'estació a l'amplada: lletra més petita i, si encara no hi cap, sense la part de després del guió
// ("Os de Balaguer - el Monestir d'Avellanes" → "Os de Balaguer") o retallat amb "…"
function fitName(ctx, name, maxW, size, min) {
  fitFont(ctx, 'head', size, 700, name, maxW, min);
  if (ctx.measureText(name).width <= maxW) return name;
  const short = name.split(' - ')[0];
  if (short !== name) {
    fitFont(ctx, 'head', size, 700, short, maxW, min);
    if (ctx.measureText(short).width <= maxW) return short;
  }
  let t = name;
  while (t.length > 3 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

// Segona línia de cada fila: altitud (i comarca, a Catalunya), en lletra més petita si cal
function rowSub(ctx, r, cat, x, y, maxW, size) {
  const t = cat && r.com ? `${altTxt(r.alt)} · ${r.com}` : altTxt(r.alt);
  let s = size;
  font(ctx, 'mono', s);
  while (s > 14 && ctx.measureText(t).width > maxW) font(ctx, 'mono', --s);
  ctx.fillStyle = L.mut;
  ctx.fillText(t, x, y);
}

// Peu de la llista: deixa clar de quina xarxa són les estacions (al costat del mapa de Catalunya a X).
// total: a Catalunya, quantes estacions tenien dades (n són les que surten)
function networkCaption(ctx, n, x, y, size, sp, align = 'left', total = null) {
  const cat = total != null;
  const a = cat ? 'XARXA DEL METEOCAT' : 'XARXA METEOCADÍ';
  const b = !cat
    ? ` · ${n} ${n === 1 ? 'ESTACIÓ' : 'ESTACIONS'} DEL BERGUEDÀ`
    : total > n ? ` · LES ${n} PRIMERES DE ${total} ESTACIONS` : ` · ${n} ${n === 1 ? 'ESTACIÓ' : 'ESTACIONS'}`;
  ctx.textBaseline = 'middle';
  font(ctx, 'mono', size);
  const wa = spacedWidth(ctx, a, sp);
  const wb = spacedWidth(ctx, b, sp);
  const x0 = align === 'right' ? x - wa - wb - sp : x;
  ctx.fillStyle = L.ink;
  spaced(ctx, a, x0, y, sp);
  ctx.fillStyle = L.mut;
  spaced(ctx, b, x0 + wa + sp, y, sp);
}

// "a La Tosa d'Alp" → "a la Tosa d'Alp", "a El Prat de Llobregat" → "al Prat de Llobregat"
const ART = [[/^El /, 'al '], [/^Els /, 'als '], [/^La /, 'a la '], [/^Les /, 'a les '], [/^L'/, "a l'"]];
function aLloc(name) {
  for (const [re, to] of ART) if (re.test(name)) return name.replace(re, to);
  return `a ${name}`;
}

// Frase automàtica de Catalunya: el primer i el darrer de totes les estacions i quantes passen d'un llindar
function catSentence(rows, v) {
  const list = rankRows(rows, v);
  if (!list.length) return '';
  const first = list[0];
  const last = list[list.length - 1];
  const where = (r) => `${aLloc(r.name)} (${r.com || altTxt(r.alt)})`;
  const high = (r) => `${aLloc(r.name)} (${altTxt(r.alt)})`;
  const count = (f) => list.filter(f).length;
  const above = (ts, f, txt) => {
    for (const t of ts) {
      const c = count((r) => f(r.v, t));
      if (c >= 2) return ` ${txt(c, t)}`;
    }
    return '';
  };
  if (v === 'max') {
    return `La més alta, ${num(first.v)} °C ${where(first)}; la més baixa, ${num(last.v)} °C ${high(last)}.`
      + above([40, 35, 30], (x, t) => x >= t, (c, t) => `${c} estacions van arribar als ${t} °C.`);
  }
  if (v === 'min') {
    const frost = count((r) => r.v < 0);
    const warm = count((r) => r.v >= 20);
    return `La més baixa, ${num(first.v)} °C ${high(first)}; la més alta, ${num(last.v)} °C ${where(last)}.`
      + (frost >= 2 ? ` ${frost} estacions van baixar de 0 °C.` : warm >= 2 ? ` ${warm} estacions no van baixar dels 20 °C.` : '');
  }
  if (v === 'pluja') {
    const wet = count((r) => r.v > 0);
    if (!wet) return 'Cap estació del Meteocat va recollir pluja.';
    return `Va ploure a ${wet} de ${list.length} estacions. El màxim, ${num(first.v)} mm ${where(first)}.`
      + above([200, 100, 50], (x, t) => x > t, (c, t) => `${c} van passar dels ${t} mm.`);
  }
  return `La ratxa més forta, ${num(first.v)} km/h ${high(first)}.`
    + above([120, 100, 90, 70], (x, t) => x > t, (c, t) => `${c} estacions van superar els ${t} km/h.`);
}

// Frase automàtica (es pot editar a l'estudi)
export function rankSentence(rows, v, net = 'mc') {
  if (net === 'cat') return catSentence(rows, v);
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

// Mides del rànquing vertical: Stories (1080 × 1920) i publicació 4:5 (1080 × 1350, Instagram i Facebook).
// A la 4:5 la capçalera es redueix (k) i les files s'encongeixen si cal perquè hi càpiguen totes les estacions.
// legend: on comença la llegenda de colors; limit: fins on arriba la llista.
export const POST = { W: 1080, H: 1350 };
function rankLayout(fmt, cat) {
  if (fmt === 'post') {
    return { post: true, H: POST.H, top: 62, k: 0.8, foot: 1262, legend: 1164, limit: 1140, sent: 26, lh: 36, gapA: 10, gapB: 22, capGap: 32, lines: 3, axis: 44, rowMax: cat ? 84 : 78, leg: { sw: 18, fs: 15, cs: 14 } };
  }
  return { post: false, H, top: TOP, k: 1, foot: FOOT_Y, legend: 1580, limit: 1552, sent: 30, lh: 42, gapA: 14, gapB: 30, capGap: 38, lines: cat ? 4 : 3, axis: 52, rowMax: cat ? 100 : 88, leg: { sw: 22, fs: 17, cs: 16 } };
}

// d: { date, when: "d'ahir" | "d'avui" | "del 25 de setembre", variable, rows, sentence, net, kind, time, fmt: 'story' | 'post' }
export function drawRanking(ctx, d) {
  const cat = d.net === 'cat';
  const F = rankLayout(d.fmt, cat);
  background(ctx, false);
  const cfg = RANK_VARS[d.variable];
  const all = rankRows(d.rows, d.variable);
  const list = cat ? all.slice(0, CAT_TOP) : all;
  // Columnes: nom (des de NX) i barres (des de BX). A Catalunya els noms són més llargs i les barres, més curtes.
  const NX = 120, BX = cat ? 500 : 450, BAR = cat ? 330 : 380;
  let y = header(ctx, rankEyebrow(d), cfg.t1, d.when, L.blue, L.ink, cfg.color, F.top, F.k);

  y += F.gapA;
  const sentence = nbsp(d.sentence);
  if (sentence.trim()) {
    font(ctx, 'ui', F.sent);
    ctx.fillStyle = L.ink2;
    ctx.textBaseline = 'middle';
    const lines = wrap(ctx, sentence, 900).slice(0, F.lines);
    for (const line of lines) {
      ctx.fillText(line, X0, y + F.lh / 2);
      y += F.lh;
    }
  }
  y += F.gapB;
  networkCaption(ctx, list.length, X0, y + 11, 20, 2.2, 'left', cat ? all.length : null);
  y += F.capGap;
  hline(ctx, X0, X1, y, L.ink, 2);
  const vals = list.map((r) => r.v);
  const temp = d.variable === 'max' || d.variable === 'min';

  // Mínimes: cada estació és un punt sobre una escala de temperatura (la més freda, més a l'esquerra),
  // perquè una barra més llarga per a la temperatura més baixa confon. La resta: barres (valor més alt, barra més llarga).
  const dots = d.variable === 'min' && list.length > 0;
  let sc = null;
  if (dots) {
    let s0 = Math.floor(Math.min(...vals)) - 1;
    let s1 = Math.ceil(Math.max(...vals)) + 1;
    if (s1 - s0 < 6) {
      const m = (s0 + s1) / 2;
      s0 = Math.floor(m - 3);
      s1 = Math.ceil(m + 3);
    }
    const step = s1 - s0 <= 12 ? 2 : s1 - s0 <= 30 ? 5 : 10;
    sc = { s0, s1, step, x0: BX + 20, x1: 810 };
    sc.x = (v) => sc.x0 + ((v - sc.s0) / (sc.s1 - sc.s0)) * (sc.x1 - sc.x0);
    // Eix: valors de l'escala a sobre de la primera fila
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    font(ctx, 'mono', 20);
    for (let t = Math.ceil(s0 / step) * step; t <= s1; t += step) {
      ctx.fillStyle = t === 0 ? '#1d4ed8' : L.mut;
      ctx.fillText(`${num(t, 0)}°`, sc.x(t), y + F.axis / 2 + 2);
    }
    ctx.textAlign = 'left';
    y += F.axis;
  }

  const RH = Math.min(F.rowMax, Math.floor((F.limit - y) / Math.max(list.length, 1)));
  // Escala de les files: a la 4:5, si n'hi ha moltes, tot (lletra, barres, punts) una mica més petit
  const rs = F.post ? Math.min(1, RH / 88) : 1;

  if (dots) {
    // Línies verticals de l'escala (la de 0 °C, més marcada)
    const yEnd = y + RH * list.length;
    for (let t = Math.ceil(sc.s0 / sc.step) * sc.step; t <= sc.s1; t += sc.step) {
      ctx.save();
      ctx.strokeStyle = t === 0 ? '#7fb2e5' : '#cfd9e4';
      ctx.lineWidth = t === 0 ? 2 : 1.5;
      if (t !== 0) ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(Math.round(sc.x(t)) + 0.5, y);
      ctx.lineTo(Math.round(sc.x(t)) + 0.5, yEnd);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Escala de les barres: la més llarga fa BAR px i totes en tenen una mica
  const hi = Math.max(...vals, 0);
  const lo = temp ? Math.min(...vals) - Math.max(2, (hi - Math.min(...vals)) * 0.5) : 0;
  const big = Math.round(40 * rs);
  list.forEach((r, i) => {
    const cy = y + RH / 2;
    ctx.textBaseline = 'middle';
    font(ctx, 'mono', Math.round(26 * rs));
    ctx.fillStyle = L.rank;
    ctx.fillText(String(i + 1).padStart(2, '0'), X0, cy);
    const ns = Math.round(32 * rs);
    const name = cat ? fitName(ctx, r.name, BX - NX - 24, ns, Math.round(20 * rs)) : (fitFont(ctx, 'head', ns, 700, r.name, 318, Math.round(24 * rs)), r.name);
    ctx.fillStyle = L.ink;
    ctx.fillText(name, NX, cy - 12 * rs);
    rowSub(ctx, r, cat, NX, cy + 21 * rs, BX - NX - 24, Math.max(15, Math.round(19 * rs)));
    if (dots) {
      // Pista de l'escala i punt a la temperatura de l'estació
      ctx.strokeStyle = L.line;
      ctx.lineWidth = 6 * rs;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sc.x0, cy);
      ctx.lineTo(sc.x1, cy);
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.arc(sc.x(r.v), cy, 15 * rs, 0, Math.PI * 2);
      ctx.fillStyle = barColor(d.variable, r.v);
      ctx.fill();
      ctx.lineWidth = 4 * rs;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      font(ctx, 'mono', big, 500);
      ctx.fillStyle = valueColor(d.variable, r.v);
      ctx.fillText(`${num(r.v)}°`, 848, cy + 1);
      y += RH;
      hline(ctx, X0, X1, y, L.line);
      return;
    }
    const len = hi - lo > 0 ? Math.max(0, ((r.v - lo) / (hi - lo)) * BAR) : 0;
    const bh = 34 * rs;
    if (len > 0) {
      ctx.fillStyle = barColor(d.variable, r.v);
      ctx.beginPath();
      ctx.roundRect(BX, cy - bh / 2, Math.max(len, 12), bh, 6);
      ctx.fill();
    }
    const vx = BX + (len > 0 ? Math.max(len, 12) + 18 : 0);
    font(ctx, 'mono', big, 500);
    ctx.fillStyle = valueColor(d.variable, r.v);
    const txt = temp ? `${num(r.v)}°` : num(r.v);
    ctx.fillText(txt, vx, cy + 1);
    if (!temp) {
      const tw = ctx.measureText(txt).width;
      font(ctx, 'mono', Math.round(22 * rs));
      ctx.fillStyle = L.mut;
      ctx.fillText(cfg.unit, vx + tw + 8, cy + 5 * rs);
    }
    y += RH;
    hline(ctx, X0, X1, y, L.line);
  });
  drawScale(ctx, d.variable, X0, X1, F.legend, { ...F.leg, max: Math.max(0, ...vals) });
  footer(ctx, false, '', cat ? CAT_CREDIT : '', F.foot, F.H);
}

// Rànquing horitzontal (1600 × 900, per a X i webs): títol i frase a l'esquerra, llista a la dreta
export const WIDE = { W: 1600, H: 900 };
export function drawRankingWide(ctx, d) {
  const { W: WW, H: HH } = WIDE;
  const LX0 = 64, LX1 = 560, RX0 = 640, RX1 = 1536;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = L.bg;
  ctx.fillRect(0, 0, WW, HH);
  const cfg = RANK_VARS[d.variable];
  const cat = d.net === 'cat';
  const all = rankRows(d.rows, d.variable);
  const list = cat ? all.slice(0, CAT_TOP) : all;

  // Columna esquerra: data, títol de dues línies (la segona en color) i frase
  ctx.textBaseline = 'middle';
  const eb = rankEyebrow(d).toLocaleUpperCase('ca');
  let es = 21;
  font(ctx, 'mono', es);
  while (es > 14 && spacedWidth(ctx, eb, es * 0.138) > LX1 - LX0) font(ctx, 'mono', --es);
  ctx.fillStyle = L.blue;
  spaced(ctx, eb, LX0, 92, es * 0.138);
  tracking(ctx, -2.8);
  const s1 = fitFont(ctx, 'head', 84, 800, cfg.t1, LX1 - LX0);
  const s2 = fitFont(ctx, 'head', 84, 800, d.when, LX1 - LX0);
  font(ctx, 'head', Math.min(s1, s2), 800);
  ctx.fillStyle = L.ink;
  ctx.fillText(cfg.t1, LX0, 168);
  ctx.fillStyle = cfg.color;
  ctx.fillText(d.when, LX0, 250);
  tracking(ctx, 0);
  const sentence = nbsp(d.sentence);
  if (sentence.trim()) {
    font(ctx, 'ui', 28);
    ctx.fillStyle = L.ink2;
    wrap(ctx, sentence, LX1 - LX0).slice(0, 6).forEach((line, i) => ctx.fillText(line, LX0, 330 + i * 40));
  }
  // Llegenda de colors a sota de la frase (a l'altura on acaba la columna)
  drawScale(ctx, d.variable, LX0, LX1, 690, { sw: 18, fs: 13, cs: 13, gap: 3, max: Math.max(0, ...list.map((r) => r.v).filter((v) => v != null)) });
  tracking(ctx, -0.36);
  font(ctx, 'head', 36, 800);
  ctx.fillStyle = L.ink;
  ctx.fillText('meteocadi.cat', LX0, 820);
  tracking(ctx, 0);
  if (cat) {
    font(ctx, 'mono', 15);
    ctx.fillStyle = L.mut;
    spaced(ctx, CAT_CREDIT, LX0, 862, 1.5);
  }
  const sw = WW / 4;
  STRIP.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * sw, HH - 8, sw + 1, 8);
  });

  // Columna dreta: la llista
  const vals = list.map((r) => r.v);
  const temp = d.variable === 'max' || d.variable === 'min';
  const dots = d.variable === 'min' && list.length > 0;
  // Títol de la llista a l'altura de la data de l'esquerra
  networkCaption(ctx, list.length, RX0, 92, 18, 2.2, 'left', cat ? all.length : null);
  let y = 118;
  const NX = RX0 + 62, BX = RX0 + (cat ? 450 : 420), BAR = cat ? 270 : 300;
  let sc = null;
  if (dots) {
    let a = Math.floor(Math.min(...vals)) - 1;
    let b = Math.ceil(Math.max(...vals)) + 1;
    if (b - a < 6) { const m = (a + b) / 2; a = Math.floor(m - 3); b = Math.ceil(m + 3); }
    const step = b - a <= 12 ? 2 : b - a <= 30 ? 5 : 10;
    sc = { s0: a, s1: b, step, x0: BX, x1: BX + (cat ? 250 : 280) };
    sc.x = (v) => sc.x0 + ((v - sc.s0) / (sc.s1 - sc.s0)) * (sc.x1 - sc.x0);
    ctx.textAlign = 'center';
    font(ctx, 'mono', 17);
    for (let t = Math.ceil(a / step) * step; t <= b; t += step) {
      ctx.fillStyle = t === 0 ? '#1d4ed8' : L.mut;
      ctx.fillText(`${num(t, 0)}°`, sc.x(t), y + 12);
    }
    ctx.textAlign = 'left';
    y += 30;
  }
  hline(ctx, RX0, RX1, y, L.ink, 2);
  const RH = Math.min(72, Math.floor((860 - y) / Math.max(list.length, 1)));
  if (dots) {
    const yEnd = y + RH * list.length;
    for (let t = Math.ceil(sc.s0 / sc.step) * sc.step; t <= sc.s1; t += sc.step) {
      ctx.save();
      ctx.strokeStyle = t === 0 ? '#7fb2e5' : '#cfd9e4';
      ctx.lineWidth = t === 0 ? 2 : 1.5;
      if (t !== 0) ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(Math.round(sc.x(t)) + 0.5, y);
      ctx.lineTo(Math.round(sc.x(t)) + 0.5, yEnd);
      ctx.stroke();
      ctx.restore();
    }
  }
  const hi = Math.max(...vals, 0);
  const lo = temp ? Math.min(...vals) - Math.max(2, (hi - Math.min(...vals)) * 0.5) : 0;
  const big = Math.min(36, Math.round(RH * 0.55));
  list.forEach((r, i) => {
    const cy = y + RH / 2;
    ctx.textBaseline = 'middle';
    font(ctx, 'mono', 22);
    ctx.fillStyle = L.rank;
    ctx.fillText(String(i + 1).padStart(2, '0'), RX0, cy);
    const name = cat ? fitName(ctx, r.name, BX - NX - 24, Math.min(28, RH * 0.42), 18) : (fitFont(ctx, 'head', Math.min(28, RH * 0.42), 700, r.name, BX - NX - 24, 18), r.name);
    ctx.fillStyle = L.ink;
    ctx.fillText(name, NX, cy - RH * 0.15);
    rowSub(ctx, r, cat, NX, cy + RH * 0.22, BX - NX - 24, Math.floor(Math.min(17, RH * 0.26)));
    if (dots) {
      ctx.strokeStyle = L.line;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sc.x0, cy);
      ctx.lineTo(sc.x1, cy);
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.arc(sc.x(r.v), cy, Math.min(13, RH * 0.2), 0, Math.PI * 2);
      ctx.fillStyle = barColor(d.variable, r.v);
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      font(ctx, 'mono', big, 500);
      ctx.fillStyle = valueColor(d.variable, r.v);
      ctx.fillText(`${num(r.v)}°`, sc.x1 + 36, cy + 1);
    } else {
      const len = hi - lo > 0 ? Math.max(0, ((r.v - lo) / (hi - lo)) * BAR) : 0;
      if (len > 0) {
        ctx.fillStyle = barColor(d.variable, r.v);
        ctx.beginPath();
        ctx.roundRect(BX, cy - RH * 0.2, Math.max(len, 10), RH * 0.4, 5);
        ctx.fill();
      }
      const vx = BX + (len > 0 ? Math.max(len, 10) + 16 : 0);
      font(ctx, 'mono', big, 500);
      ctx.fillStyle = valueColor(d.variable, r.v);
      const txt = temp ? `${num(r.v)}°` : num(r.v);
      ctx.fillText(txt, vx, cy + 1);
      if (!temp) {
        const tw = ctx.measureText(txt).width;
        font(ctx, 'mono', 19);
        ctx.fillStyle = L.mut;
        ctx.fillText(cfg.unit, vx + tw + 7, cy + 4);
      }
    }
    y += RH;
    hline(ctx, RX0, RX1, y, L.line);
  });
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
  const title = day.headline.trim() ? wrap(ctx, nbsp(capFirst(day.headline.trim())), 872) : [];
  tracking(ctx, 0);
  font(ctx, 'ui', bs);
  const body = day.text.trim() ? wrap(ctx, nbsp(capFirst(day.text.trim())), 872) : [];
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
  const lines = wrap(ctx, nbsp(capFirst(text.trim())), X1 - X0);
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
  // Si el text és llarg, primer ocupa l'espai de baix; després la capçalera puja (de 280 fins a 180 px);
  // i només si encara no hi cap, la lletra es fa una mica més petita o es reparteix en diverses imatges.
  const HEAD = 140 + 44; // de dalt de la capçalera a la primera targeta
  const GAP = 22;
  for (const k of [1, 0.94, 0.88, 0.84]) {
    const b = blocks(k);
    const total = b.reduce((n, x) => n + x.height, 0) + GAP * (b.length - 1);
    const room = LIMIT - total - HEAD;
    if (room >= TOP) {
      const headTop = Math.min(PV_TOP, Math.floor(room));
      let y = headTop + HEAD;
      return { pages: [b.map((x) => { const o = { ...x, y }; y += x.height + GAP; return o; })], k, error: '', headTop };
    }
  }
  const top = TOP + HEAD;
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
  return { pages, k: 0.84, error, headTop: TOP };
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
  header(ctx, `Previsió · ${dayName(st.date)} ${dayMonth(st.date)}`, 'El temps', '', A.cy, '#ffffff', A.cy, layout.headTop ?? TOP);
  const items = layout.pages[Math.min(page, layout.pages.length - 1)] || [];
  for (const b of items) b.type === 'day' ? drawCard(ctx, b, st, icons) : drawSummary(ctx, b);
  footer(ctx, true, layout.pages.length > 1 ? `${page + 1} / ${layout.pages.length}` : '');
}
