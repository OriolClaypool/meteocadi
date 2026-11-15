// Estudi · dibuix de les imatges verticals (1080 × 1920) per a Stories i X.
// Tres plantilles amb el mateix sistema: capçalera (data + títol en dues línies, la segona en color),
// contingut i peu amb meteocadi.cat. Marges pensats per a Stories: capçalera a 180 px, peu a ~1.700 px.
import { tempColor, num, dayName, dayMonth, cap } from '../../lib/format.js';
import { SCALES, fieldColor, readableOn, inkOn, rainClasses } from '../../lib/escales.js';
import { iconBadge } from '../icones.js';

export const W = 1080;
export const H = 1920;
const TOP = 180;
const PV_TOP = 280; // la previsió comença més avall (més aire a dalt a Stories)
const FOOT_Y = 1688;
const LIMIT = 1652; // on ha d'acabar el contingut
export const X0 = 64;
export const X1 = 1016;

// 'mono' és la lletra de les xifres i de les llegendes petites: des del 15 de novembre del 2026 és la mateixa del
// text (Geist) i no la de codi (Geist Mono), com al web. Per tornar-hi n'hi ha prou de canviar aquesta línia.
const F = { head: "'Schibsted Grotesk Variable'", ui: "'Geist Variable'", mono: "'Geist Variable'" };
const A = { bg: '#060a12', cy: '#3db8ff', txt: '#e6edf6', txt2: '#c3cfde', mut: '#93a3b8', mut2: '#7d8fa6', gold: '#f6c664' };
export const L = { bg: '#eef3f8', ink: '#10233b', ink2: '#44556b', mut: '#56667a', blue: '#22477a', line: '#dfe6ee', rank: '#8a99ab', warn: '#b45309' };
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
  ).then(async (e) => {
    const out = Object.fromEntries(e);
    out.__foto = await new Promise((res) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => res(null); img.src = '/imatges/portada-2400.webp'; });
    return out;
  });
}

export function font(ctx, fam, size, weight = 400) {
  ctx.font = `${weight} ${size}px ${F[fam]}`;
}

// Espaiat de lletra: natiu si el navegador el té; si no, lletra a lletra (només per a textos curts)
const HAS_LS = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;
export function tracking(ctx, px) {
  if (HAS_LS) ctx.letterSpacing = `${px}px`;
}

export function spacedWidth(ctx, text, sp) {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + sp;
  return w - sp;
}

// Text en majúscules espaiat (etiquetes en Geist Mono)
export function spaced(ctx, text, x, y, sp, align = 'left') {
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

export function fitFont(ctx, fam, size, weight, text, maxW, min = size * 0.6) {
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

export function hline(ctx, x0, x1, y, color, w = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(x0, Math.round(y) - (w > 1 ? w / 2 : 0), x1 - x0, w);
}

function vline(ctx, x, y0, y1, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y0, 1, y1 - y0);
}

// ------------------------------------------------------------------ Resum del dia
// d: { date, kind: 'ahir'|'avui'|'dia', time, rows: [{ name, alt, max, min, gust, rain, susp }] }
// Des del 15 de novembre del 2026 és de la mateixa família que el rànquing i els mapes nets: fons clar, un títol
// d'una línia amb icona, els quatre extrems d'un sol color i la taula amb la màxima i la mínima de cada estació
// dins d'una pastilla del color de l'escala del mapa, amb l'escala a sota. Abans era fosca, amb les quatre xifres
// de colors i una taula de 26 px que al mòbil no es llegia.
export function drawResum(ctx, d) {
  background(ctx, false);
  const rows = d.rows.filter((r) => r.max != null || r.min != null);
  const temps = rows.filter((r) => !r.susp);
  const best = (list, k, dir) => list.filter((r) => r[k] != null).sort((a, b) => dir * (b[k] - a[k]))[0] || null;
  const mx = best(temps, 'max', 1);
  const mn = best(temps, 'min', -1);
  const gu = best(rows, 'gust', 1);
  const rainy = rows.filter((r) => (r.rain ?? 0) > 0);
  const ra = best(rows, 'rain', 1);

  const t1 = d.kind === 'avui' ? 'Avui' : 'Resum';
  const t2 = d.kind === 'ahir' ? " d'ahir" : d.kind === 'avui' ? ` fins a les ${d.time}` : ` del ${dayMonth(d.date)}`;
  netTitle(ctx, { x0: X0, head: 290, hs: 50, colR: X1, t1, t2, icon: 'temp', accent: L.blue });
  networkCaption(ctx, rows.length, X0, 360, 19, 2, 'left', null, d.kind === 'ahir' ? `${dayName(d.date)} ${dayMonth(d.date)}` : '');
  let y = 388;
  hline(ctx, X0, X1, y, L.ink, 2);

  // Quatre extrems, d'un sol color
  const CH = 200;
  const cells = [
    ['Màxima', mx ? num(mx.max) : '—', '°C', mx ? `${mx.name} · ${altTxt(mx.alt)}` : 'Sense dades'],
    ['Mínima', mn ? num(mn.min) : '—', '°C', mn ? `${mn.name} · ${altTxt(mn.alt)}` : 'Sense dades'],
    ['Ratxa màxima', gu ? num(gu.gust) : '—', 'km/h', gu ? `${gu.name} · ${altTxt(gu.alt)}` : 'Sense dades'],
    [
      'Pluja',
      ra && ra.rain > 0 ? num(ra.rain) : '0,0',
      'mm',
      !rainy.length ? 'Sense pluja a la xarxa' : rainy.length === 1 ? `${ra.name} · única estació` : `${ra.name} · ${rainy.length} estacions amb pluja`,
    ],
  ];
  cells.forEach(([label, val, unit, who], i) => {
    const x = i % 2 ? 572 : X0;
    const cy = y + (i >= 2 ? CH : 0);
    const maxW = i % 2 ? X1 - 572 : 540 - X0 - 24;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    font(ctx, 'ui', 28);
    ctx.fillStyle = L.mut;
    ctx.fillText(label, x, cy + 54);
    tracking(ctx, -3);
    font(ctx, 'ui', 94, 600);
    ctx.fillStyle = L.ink;
    ctx.fillText(val, x, cy + 142);
    const vw = ctx.measureText(val).width;
    tracking(ctx, 0);
    font(ctx, 'ui', 34, 500);
    ctx.fillStyle = L.mut;
    ctx.fillText(unit, x + vw + 10, cy + 142);
    fitFont(ctx, 'ui', 27, 400, who, maxW, 20);
    ctx.fillStyle = L.ink2;
    ctx.fillText(who, x, cy + 182);
  });
  hline(ctx, X0, X1, y + CH, L.line);
  vline(ctx, 540, y + 16, y + 2 * CH - 16, L.line);
  y += 2 * CH;
  hline(ctx, X0, X1, y, L.ink, 2);

  // Taula de totes les estacions, de dalt a baix: màxima i mínima en una pastilla del color de l'escala
  const LEG = 1556; // on comença l'escala de colors
  const CW = 132;
  const cols = [772, 920];
  ctx.textBaseline = 'middle';
  font(ctx, 'mono', 19);
  ctx.fillStyle = L.mut;
  spaced(ctx, 'MÀX.', cols[0] - CW / 2, y + 30, 2, 'center');
  spaced(ctx, 'MÍN.', cols[1] - CW / 2, y + 30, 2, 'center');
  spaced(ctx, 'PLUJA MM', X1, y + 30, 2, 'right');
  y += 54;
  const RH = Math.min(84, Math.floor((LEG - 22 - y) / Math.max(rows.length, 1)));
  const PH = Math.min(50, RH - 14);
  for (const r of [...rows].sort((a, b) => b.alt - a.alt)) {
    const cy = y + RH / 2;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitFont(ctx, 'head', Math.min(33, RH * 0.5), 700, r.name, 400, 22);
    ctx.fillStyle = L.ink;
    ctx.fillText(r.name, X0, cy);
    const nw = ctx.measureText(r.name).width;
    font(ctx, 'ui', 21);
    ctx.fillStyle = L.mut;
    ctx.fillText(altTxt(r.alt), X0 + nw + 14, cy + 3);
    [[r.max, 'tmax'], [r.min, 'tmin']].forEach(([v, scale], i) => {
      const x = cols[i] - CW;
      ctx.textAlign = 'center';
      font(ctx, 'ui', Math.min(29, PH * 0.62), 600);
      if (v == null) { ctx.fillStyle = L.rank; ctx.fillText('—', x + CW / 2, cy); return; }
      const c = r.susp ? L.line : fieldColor(scale, v);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(x, cy - PH / 2, CW, PH, 10);
      ctx.fill();
      ctx.fillStyle = r.susp ? L.mut : inkOn(c);
      ctx.fillText(`${num(v)}°`, x + CW / 2, cy + 1);
    });
    ctx.textAlign = 'right';
    font(ctx, 'ui', Math.min(30, PH * 0.64), 500);
    ctx.fillStyle = (r.rain ?? 0) > 0 ? L.ink : L.rank;
    ctx.fillText(r.rain == null ? '—' : num(r.rain), X1, cy + 1);
    ctx.textAlign = 'left';
    y += RH;
    hline(ctx, X0, X1, y, L.line);
  }
  drawScale(ctx, 'max', X0, X1, LEG, { sw: 18, fs: 15, cs: 14 });
  netFooter(ctx, { x0: X0, credits: 1640, foot: 1692, colR: X1, W, H, credit: '' });
}

// ------------------------------------------------------------------ Neu (15 de novembre del 2026)
// Dues imatges de Meteocadí Neu, de la família neta: la neu nova prevista al cim de cada estació d'esquí (les deu
// primeres, a 3 o 7 dies) i, a la pretemporada, quan obre cada estació. Vertical 9:16 o publicació 4:5.
// d: { kind: 'nevada' | 'obertures', fmt: 'story' | 'post', days, caption: [negre, gris], credit,
//      rows: [{ name, sub, cm, color }], groups: [{ date, title, when, names }] }
const NEU_BLUE = '#1d4ed8';
export function drawNeu(ctx, d) {
  const post = d.fmt === 'post';
  const F = post
    ? { H: 1350, head: 92, hs: 40, cap: 150, capGap: 24, limit: 1218, credits: 1262, foot: 1306, cs: 17, rowMax: 100 }
    : { H, head: 290, hs: 50, cap: 360, capGap: 28, limit: 1590, credits: 1640, foot: 1692, cs: 19, rowMax: 118 };
  background(ctx, false);
  const ob = d.kind === 'obertures';
  netTitle(ctx, { x0: X0, head: F.head, hs: F.hs, colR: X1, t1: ob ? 'Quan obren' : 'Neu nova', t2: ob ? ' les estacions' : ` en ${d.days} dies`, icon: 'snow', accent: NEU_BLUE });
  ctx.textBaseline = 'middle';
  let cs = F.cs;
  font(ctx, 'mono', cs);
  while (cs > 13 && spacedWidth(ctx, d.caption[0] + d.caption[1], 2) > X1 - X0) font(ctx, 'mono', --cs);
  ctx.fillStyle = L.ink;
  const wa = spaced(ctx, d.caption[0], X0, F.cap, 2);
  ctx.fillStyle = L.mut;
  spaced(ctx, d.caption[1], X0 + wa + 2, F.cap, 2);
  let y = F.cap + F.capGap;
  hline(ctx, X0, X1, y, L.ink, 2);

  if (!ob) {
    // Una fila per estació: nom, zona i cota del cim, i una barra amb els centímetres (el color, el de l'escala de neu)
    const rows = d.rows;
    const RH = Math.min(F.rowMax, Math.floor((F.limit - y) / Math.max(rows.length, 1)));
    const NX = 120, BX = 590, BAR = 280;
    // La barra sencera són 20 cm o la nevada més gran: 1 cm no pot omplir tota la barra
    const max = Math.max(20, ...rows.map((r) => r.cm));
    rows.forEach((r, i) => {
      const cy = y + RH / 2;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      font(ctx, 'mono', Math.round(RH * 0.2));
      ctx.fillStyle = L.rank;
      ctx.fillText(String(i + 1).padStart(2, '0'), X0, cy);
      fitFont(ctx, 'head', Math.round(RH * 0.34), 700, r.name, BX - NX - 24, 22);
      ctx.fillStyle = L.ink;
      ctx.fillText(r.name, NX, cy - RH * 0.14);
      fitFont(ctx, 'mono', Math.round(RH * 0.19), 400, r.sub, BX - NX - 24, 13);
      ctx.fillStyle = L.mut;
      ctx.fillText(r.sub, NX, cy + RH * 0.2);
      const cm = Math.round(r.cm);
      const bw = cm > 0 ? Math.max(10, (r.cm / max) * BAR) : 0;
      const bh = Math.round(RH * 0.3);
      if (bw) {
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.roundRect(BX, cy - bh / 2, bw, bh, 4);
        ctx.fill();
      }
      font(ctx, 'mono', Math.round(RH * 0.34), 500);
      ctx.fillStyle = cm > 0 ? L.ink : L.rank;
      ctx.fillText(`${cm} cm`, BX + (bw ? bw + 16 : 0), cy + 1);
      y += RH;
      hline(ctx, X0, X1, y, L.line);
    });
  } else {
    // Un bloc per data: el dia, quant falta i les estacions que obren. La mida s'ajusta al que hi ha.
    const block = (k, paint) => {
      let yy = y + 10 * k;
      for (const g of d.groups) {
        yy += 70 * k;
        if (paint) {
          ctx.textBaseline = 'alphabetic';
          ctx.textAlign = 'left';
          tracking(ctx, -1);
          fitFont(ctx, 'head', Math.round((g.date ? 50 : 38) * k), 800, g.title, X1 - X0);
          ctx.fillStyle = g.date ? L.ink : L.ink2;
          ctx.fillText(g.title, X0, yy);
          tracking(ctx, 0);
        }
        // Quant falta, en una línia pròpia sota la data
        if (g.when) {
          yy += 42 * k;
          if (paint) {
            font(ctx, 'ui', Math.round(28 * k), 500);
            ctx.fillStyle = NEU_BLUE;
            ctx.fillText(g.when, X0, yy);
          }
        }
        font(ctx, 'ui', Math.round((g.date ? 34 : 30) * k), g.date ? 500 : 400);
        const lh = (g.date ? 48 : 42) * k;
        yy += 12 * k;
        for (const l of wrap(ctx, g.names, X1 - X0)) {
          yy += lh;
          if (paint) {
            ctx.fillStyle = g.date ? L.ink2 : L.mut;
            ctx.fillText(l, X0, yy);
          }
        }
        yy += 32 * k;
        if (paint) hline(ctx, X0, X1, yy, L.line);
      }
      return yy;
    };
    let k = post ? 1.5 : 1.8;
    while (k > 0.7 && block(k, false) > F.limit) k -= 0.05;
    block(k, true);
  }
  netFooter(ctx, { x0: X0, credits: F.credits, foot: F.foot, colR: X1, W, H: F.H, credit: d.credit });
}

// ------------------------------------------------------------------ Rànquing
export const RANK_VARS = {
  // t1: títol de la versió completa; short i icon: el de la versió neta ("Pluja del 17 al 20 d'octubre")
  max: { t1: 'Les màximes', short: 'Màximes', icon: 'temp', key: 'max', dir: 1, color: '#c2410c', unit: '°' },
  min: { t1: 'Les mínimes', short: 'Mínimes', icon: 'temp', key: 'min', dir: -1, color: '#0369a1', unit: '°' },
  pluja: { t1: 'La pluja', short: 'Pluja', icon: 'rain', key: 'rain', dir: 1, color: '#1d4ed8', unit: 'mm' },
  ratxa: { t1: 'Les ratxes', short: 'Ratxes', icon: 'wind', key: 'gust', dir: 1, color: '#b45309', unit: 'km/h' },
  // Temperatura d'ara (la darrera lectura): de més calor a més fred o al revés
  ara: { t1: 'La temperatura', short: 'Temperatura', icon: 'temp', key: 't', dir: 1, color: '#c2410c', unit: '°' },
  arafred: { t1: 'La temperatura', short: 'Temperatura', icon: 'temp', key: 't', dir: -1, color: '#0369a1', unit: '°' },
};
// Variables de temperatura (xifra en graus i barres que comencen més avall de zero) i les que es dibuixen amb punts
// sobre una escala (de més fred a més calor: una barra més llarga per a la temperatura més baixa confon)
const isTemp = (v) => v === 'max' || v === 'min' || v === 'ara' || v === 'arafred';
const isDots = (v) => v === 'min' || v === 'arafred';

export function rankRows(rows, v) {
  const cfg = RANK_VARS[v];
  return rows
    .filter((r) => r[cfg.key] != null && !(r.susp && (v === 'max' || v === 'min')))
    .map((r) => ({ ...r, v: r[cfg.key] }))
    .sort((a, b) => cfg.dir * (b.v - a.v) || b.alt - a.alt);
}

// Colors del rànquing: la mateixa escala que els mapes (src/lib/escales.js), perquè el color digui la magnitud
// (pluja per classes del Meteocat, temperatura cada 5 °C, ratxes). La xifra, del mateix to però prou fosc per llegir-se.
const SCALE_OF = { max: 'tmax', min: 'tmin', pluja: 'rain', ratxa: 'gust', ara: 't', arafred: 't' };
const UNIT_OF = { max: '°C', min: '°C', pluja: 'mm', ratxa: 'km/h', ara: '°C', arafred: '°C' };
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

// Segona línia de cada fila: altitud (i comarca, a Catalunya), en lletra més petita si cal. key: la variable del
// rànquing (max, min, gust, rain); si a l'estació li falta algun dia del període (r.falta, periode.js), la nota va
// darrere de l'altitud en un altre color: "770 m · falta 1 dia".
function rowSub(ctx, r, cat, x, y, maxW, size, key) {
  const t = cat && r.com ? `${altTxt(r.alt)} · ${r.com}` : altTxt(r.alt);
  const extra = (key && r.falta?.[key]) || '';
  const head = extra ? `${t} · ` : t;
  let s = size;
  font(ctx, 'mono', s);
  while (s > 14 && ctx.measureText(head + extra).width > maxW) font(ctx, 'mono', --s);
  ctx.fillStyle = L.mut;
  ctx.fillText(head, x, y);
  if (extra) {
    ctx.fillStyle = L.warn;
    ctx.fillText(extra, x + ctx.measureText(head).width, y);
  }
}

// Peu de la llista: deixa clar de quina xarxa són les estacions (al costat del mapa de Catalunya a X).
// total: a Catalunya, quantes estacions tenien dades (n són les que surten)
// extra: un tros més al final ("FINS A LES 10:06", a la versió neta)
function networkCaption(ctx, n, x, y, size, sp, align = 'left', total = null, extra = '') {
  const cat = total != null;
  const a = cat ? 'XARXA DEL METEOCAT' : 'XARXA METEOCADÍ';
  const b = (!cat
    ? ` · ${n} ${n === 1 ? 'ESTACIÓ' : 'ESTACIONS'} DEL BERGUEDÀ`
    : total > n ? ` · LES ${n} PRIMERES DE ${total} ESTACIONS` : ` · ${n} ${n === 1 ? 'ESTACIÓ' : 'ESTACIONS'}`) + (extra ? ` · ${extra.toLocaleUpperCase('ca')}` : '');
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
  if (v === 'ara') {
    return `Ara mateix, la temperatura més alta és de ${num(first.v)} °C ${where(first)} i la més baixa, de ${num(last.v)} °C ${high(last)}.`
      + above([40, 35, 30], (x, t) => x >= t, (c, t) => `${c} estacions passen dels ${t} °C.`);
  }
  if (v === 'arafred') {
    const frost = count((r) => r.v < 0);
    return `Ara mateix, la temperatura més baixa és de ${num(first.v)} °C ${high(first)} i la més alta, de ${num(last.v)} °C ${where(last)}.`
      + (frost >= 2 ? ` ${frost} estacions estan per sota de 0 °C.` : '');
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
  if (v === 'ara' || v === 'arafred') {
    // La més freda i la més calenta, sigui quin sigui l'ordre de la llista
    const cold = v === 'ara' ? last : first, warm = v === 'ara' ? first : last;
    const top = [...list].sort((a, b) => b.alt - a.alt)[0];
    if (top !== cold && cold.v < top.v && top.alt - cold.alt >= 300) {
      return `Inversió tèrmica: ara fa més fred a ${cold.name} (${altTxt(cold.alt)}) que a ${top.name}, ${(top.alt - cold.alt).toLocaleString('ca-ES')} metres més amunt.`;
    }
    if (list.length < 2) return `Ara, ${num(first.v)} °C a ${first.name}.`;
    return `Ara mateix, ${num(Math.abs(warm.v - cold.v), 0)} °C de diferència entre ${warm.name} i ${cold.name}, amb ${Math.abs(warm.alt - cold.alt).toLocaleString('ca-ES')} metres de desnivell.`;
  }
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

// Versió neta del rànquing (Oriol, 20 d'octubre del 2026: "sigue saliendo con mucho texto", com abans els mapes): una
// sola línia de títol amb icona ("Pluja del 17 al 20 d'octubre", el període en color), sense la data a sobre, sense
// frase i sense l'escala de colors, la llista més gran i, a sota, els crèdits en petit i meteocadi.cat. Les mateixes
// mides que les imatges netes dels mapes (mapa-imatge.js): títol a 90 px a la 4:5 i a 290 px a la vertical, per
// sota de la zona que tapen les Stories.
function rankLayoutNet(fmt, cat) {
  if (fmt === 'post') return { post: true, H: POST.H, head: 92, hs: 40, cap: 150, capGap: 24, limit: 1228, credits: 1262, foot: 1306, axis: 44, rowMax: cat ? 92 : 96 };
  return { post: false, H, head: 290, hs: 50, cap: 360, capGap: 28, limit: 1600, credits: 1640, foot: 1692, axis: 52, rowMax: cat ? 112 : 116 };
}

// Títol d'una línia: icona en un cercle suau, el que es classifica i el període en color. Si no hi cap i es pot
// (horitzontal), en dues línies. Retorna on acaba.
export function netTitle(ctx, { x0, head, hs, colR, t1, t2, icon, accent, two = false }) {
  const iconS = Math.round(hs * 0.92);
  const tx = x0 + iconS + Math.round(hs * 0.42);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  tracking(ctx, -0.02 * hs);
  let s = hs;
  font(ctx, 'head', s, 800);
  const one = () => ctx.measureText(t1).width + ctx.measureText(t2).width;
  const split = two && one() > colR - tx;
  if (split) { while (Math.max(ctx.measureText(t1).width, ctx.measureText(t2.trim()).width) > colR - tx && s > hs * 0.6) font(ctx, 'head', --s, 800); }
  else { while (one() > colR - tx && s > hs * 0.6) font(ctx, 'head', --s, 800); }
  iconBadge(ctx, icon, x0 + iconS / 2, head - s * 0.36, iconS * 0.92, accent);
  ctx.fillStyle = L.ink;
  ctx.fillText(t1, tx, head);
  ctx.fillStyle = accent;
  if (split) ctx.fillText(t2.trim(), tx, head + s * 1.12);
  else ctx.fillText(t2, tx + ctx.measureText(t1).width, head);
  tracking(ctx, 0);
  return head + (split ? s * 1.12 : 0) + s * 0.3;
}

// Peu de la versió neta: crèdits en petit (si n'hi ha), meteocadi.cat i la franja de colors
export function netFooter(ctx, { x0, credits, foot, colR, W: ww, H: hh, credit }) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  if (credit) {
    font(ctx, 'ui', 15);
    ctx.fillStyle = L.mut;
    const lines = wrap(ctx, credit, colR - x0);
    lines.forEach((l, i) => ctx.fillText(l, x0, credits - (lines.length - 1 - i) * 21));
  }
  tracking(ctx, -0.3);
  font(ctx, 'head', 30, 800);
  ctx.fillStyle = L.ink;
  ctx.fillText('meteocadi.cat', x0, foot);
  tracking(ctx, 0);
  const sw = ww / 4;
  STRIP.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * sw, hh - 8, sw + 1, 8);
  });
}

// "fins a les 10:06" al peu de la llista neta, quan el període arriba a ara (no a la temperatura d'ara, que ja ho diu)
const upTo = (d) => (d.time && ['avui', 'range', '24h'].includes(d.kind) && d.variable !== 'ara' && d.variable !== 'arafred' ? `fins a les ${d.time}` : '');
const CAT_CREDIT_NET = 'Dades: Servei Meteorològic de Catalunya (XEMA), dades obertes de la Generalitat.';

// d: { date, when: "d'ahir" | "d'avui" | "del 25 de setembre", variable, rows, sentence, net, kind, time, fmt: 'story' | 'post' }
export function drawRanking(ctx, d) {
  const cat = d.net === 'cat';
  const clean = !!d.clean;
  const F = clean ? rankLayoutNet(d.fmt, cat) : rankLayout(d.fmt, cat);
  background(ctx, false);
  const cfg = RANK_VARS[d.variable];
  const all = rankRows(d.rows, d.variable);
  const list = cat ? all.slice(0, CAT_TOP) : all;
  // Columnes: nom (des de NX) i barres (des de BX). A Catalunya els noms són més llargs i les barres, més curtes.
  const NX = 120, BX = cat ? 500 : 450, BAR = cat ? 330 : 380;
  let y;
  if (clean) {
    netTitle(ctx, { x0: X0, head: F.head, hs: F.hs, colR: X1, t1: cfg.short, t2: ` ${d.when}`, icon: cfg.icon, accent: cfg.color });
    networkCaption(ctx, list.length, X0, F.cap, F.post ? 17 : 19, 2, 'left', cat ? all.length : null, upTo(d));
    y = F.cap + F.capGap;
  } else {
  y = header(ctx, rankEyebrow(d), cfg.t1, d.when, L.blue, L.ink, cfg.color, F.top, F.k);

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
  }
  hline(ctx, X0, X1, y, L.ink, 2);
  const vals = list.map((r) => r.v);
  const temp = isTemp(d.variable);

  // Mínimes: cada estació és un punt sobre una escala de temperatura (la més freda, més a l'esquerra),
  // perquè una barra més llarga per a la temperatura més baixa confon. La resta: barres (valor més alt, barra més llarga).
  const dots = isDots(d.variable) && list.length > 0;
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
    rowSub(ctx, r, cat, NX, cy + 21 * rs, BX - NX - 24, Math.max(15, Math.round(19 * rs)), cfg.key);
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
  if (clean) {
    netFooter(ctx, { x0: X0, credits: F.credits, foot: F.foot, colR: X1, W, H: F.H, credit: cat ? CAT_CREDIT_NET : '' });
    return;
  }
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
  const clean = !!d.clean;

  if (clean) {
    // Versió neta: icona i títol (en dues línies si cal) a dalt a l'esquerra, i a baix els crèdits i meteocadi.cat
    netTitle(ctx, { x0: LX0, head: 100, hs: 48, colR: LX1, t1: cfg.short, t2: ` ${d.when}`, icon: cfg.icon, accent: cfg.color, two: true });
    netFooter(ctx, { x0: LX0, credits: 772, foot: 836, colR: LX1, W: WW, H: HH, credit: cat ? CAT_CREDIT_NET : '' });
  } else {
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
  }

  // Columna dreta: la llista
  const vals = list.map((r) => r.v);
  const temp = isTemp(d.variable);
  const dots = isDots(d.variable) && list.length > 0;
  // Títol de la llista a l'altura de la data de l'esquerra
  networkCaption(ctx, list.length, RX0, 92, 18, 2.2, 'left', cat ? all.length : null, clean ? upTo(d) : '');
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
    rowSub(ctx, r, cat, NX, cy + RH * 0.22, BX - NX - 24, Math.floor(Math.min(17, RH * 0.26)), cfg.key);
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
  ctx.strokeStyle = L.ink;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D('M12 3.5 2.5 20h19L12 3.5Z'));
  ctx.stroke(new Path2D('M12 10v4.5'));
  ctx.stroke(new Path2D('M12 17.3v.2'));
  ctx.restore();
  ctx.fillStyle = L.ink;
  ctx.textBaseline = 'middle';
  spaced(ctx, label, x + 54, y + 25, 2.2);
}

function drawCard(ctx, b, st, icons) {
  const { day, index, y } = b;
  const acc = index === 0 ? L.warn : L.blue;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = L.line;
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
  ctx.fillStyle = L.mut;
  const date = addDays(st.date, index);
  spaced(ctx, `${dayName(date)} ${Number(date.slice(8))}`.toLocaleUpperCase('ca'), 104 + lw + 18, y + 50, 2.64);

  // Símbols: matí i tarda, o un de sol per a tot el dia. Les icones són clares (pensades per al fons fosc d'abans):
  // van sobre una rajola del blau fosc de la casa perquè es vegin a la targeta blanca.
  const tile = (x, w) => {
    ctx.fillStyle = L.ink;
    ctx.beginPath();
    ctx.roundRect(x, y + 14, w, 104, 18);
    ctx.fill();
  };
  font(ctx, 'mono', 19);
  if (day.mode === 'split') {
    const both = [[day.morning, 810, 'MATÍ'], [day.afternoon, 934, 'TARDA']].filter(([k]) => k);
    both.forEach(([k, cx, lab]) => {
      tile(cx - 56, 112);
      if (icons[k]) ctx.drawImage(icons[k], cx - 46, y + 20, 92, 92);
      ctx.fillStyle = L.mut;
      spaced(ctx, lab, cx, y + 136, 2.28, 'center');
    });
  } else if (day.weather) {
    tile(928 - 56, 112);
    if (icons[day.weather]) ctx.drawImage(icons[day.weather], 928 - 46, y + 20, 92, 92);
    ctx.fillStyle = L.mut;
    spaced(ctx, WEATHER[day.weather].toLocaleUpperCase('ca'), 928, y + 136, 2.28, 'center');
  }

  let cy = y + b.start;
  const lh = Math.round(b.hs * 1.04);
  font(ctx, 'head', b.hs, 800);
  tracking(ctx, -0.03 * b.hs);
  ctx.fillStyle = L.ink;
  for (const line of b.title) {
    ctx.fillText(line, 104, cy + lh / 2);
    cy += lh;
  }
  tracking(ctx, 0);
  if (b.title.length && b.body.length) cy += 20;
  font(ctx, 'ui', b.bs);
  ctx.fillStyle = L.ink2;
  for (const line of b.body) {
    if (line) ctx.fillText(line, 104, cy + b.bl / 2);
    cy += line ? b.bl : b.bl * 0.5;
  }
  if (day.alert && day.alert !== 'none') alertPill(ctx, 104, cy + 28, day.alert, day.alertType);
}

function drawSummary(ctx, b) {
  const y = b.y + 6;
  hline(ctx, X0, X1, y, L.ink, 2);
  ctx.textBaseline = 'middle';
  font(ctx, 'mono', 22);
  ctx.fillStyle = L.blue;
  spaced(ctx, 'PRÒXIMS DIES', X0, y + 24 + 13, 3.08);
  font(ctx, 'ui', b.size);
  ctx.fillStyle = L.ink2;
  let cy = y + 24 + 26 + 10;
  for (const line of b.lines) {
    if (line) ctx.fillText(line, X0, cy + b.lh / 2);
    cy += line ? b.lh : b.lh * 0.5;
  }
}

// ------------------------------------------------------------------ Previsió: tres estils nous (15/11/2026, proposta)
// L'Oriol: la versió clara "visualment no m'agrada, abans estava millor". Tres propostes fosques, que fan servir la
// lletra a la mida que hi cap (amb poc text, la lletra creix i la imatge no queda mig buida):
//  - 'nit': com la d'abans (fons fosc amb corbes de nivell), sense caixes: cada dia és una secció amb les icones a la dreta
//  - 'foto': la foto de muntanya de la portada a dalt, amb la data a sobre, i els dies a sota
//  - 'avui': avui fa de protagonista (icona gran, centrat) i demà i els pròxims dies van en un plafó a sota
const PV = { bg: '#060a12', panel: '#0e1a2b', line: 'rgba(61,184,255,0.16)' };
const dayIcons = (day) =>
  day.mode === 'split'
    ? [[day.morning, 'Matí'], [day.afternoon, 'Tarda']].filter(([k]) => k)
    : day.weather ? [[day.weather, WEATHER[day.weather]]] : [];

// Una secció de dia: etiqueta (AVUI · DIUMENGE 15), icones a la dreta, titular i text. paint=false només mesura.
function pvDay(ctx, st, icons, day, index, x0, x1, y, k, paint, o = {}) {
  const big = index === 0;
  const ic = dayIcons(day);
  const iz = Math.round((o.icon ?? (big ? 150 : 112)) * k);
  const iw = ic.length ? ic.length * iz + (ic.length - 1) * 10 * k : 0;
  const hs = Math.round((o.hs ?? (big ? 78 : 58)) * k);
  const bs = Math.round((o.bs ?? (big ? 38 : 34)) * k);
  const lab = Math.round(25 * k);
  let yy = y;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  if (paint) {
    font(ctx, 'mono', lab, 600);
    ctx.fillStyle = big ? A.gold : A.cy;
    const lw = spaced(ctx, big ? 'AVUI' : 'DEMÀ', x0, yy + lab / 2, lab * 0.14);
    font(ctx, 'mono', lab);
    ctx.fillStyle = A.mut2;
    const date = addDays(st.date, index);
    spaced(ctx, `${dayName(date)} ${Number(date.slice(8))}`.toLocaleUpperCase('ca'), x0 + lw + 16 * k, yy + lab / 2, lab * 0.12);
    ic.forEach(([key, label], i) => {
      const ix = x1 - iw + i * (iz + 10 * k);
      if (icons[key]) ctx.drawImage(icons[key], ix, yy - 8 * k, iz, iz);
      font(ctx, 'mono', Math.round(18 * k));
      ctx.fillStyle = A.mut2;
      spaced(ctx, label.toLocaleUpperCase('ca'), ix + iz / 2, yy - 8 * k + iz + 14 * k, 2, 'center');
    });
  }
  const iconBottom = y - 8 * k + iz + 28 * k;
  yy += lab + 26 * k;
  // el titular es parteix més estret mentre les icones són al costat
  font(ctx, 'head', hs, 800);
  tracking(ctx, -0.03 * hs);
  const head = day.headline.trim() ? nbsp(capFirst(day.headline.trim())) : '';
  const narrow = x1 - x0 - (iw ? iw + 30 * k : 0);
  const tl = head ? wrap(ctx, head, narrow) : [];
  const lh = Math.round(hs * 1.06);
  tl.forEach((l) => {
    if (paint) { ctx.fillStyle = '#ffffff'; ctx.fillText(l, x0, yy + lh / 2); }
    yy += lh;
  });
  tracking(ctx, 0);
  if (tl.length) yy += 14 * k;
  const body = day.text.trim() ? nbsp(capFirst(day.text.trim())) : '';
  font(ctx, 'ui', bs);
  const bl = Math.round(bs * 1.42);
  const wBody = yy < iconBottom ? narrow : x1 - x0;
  for (const l of body ? wrap(ctx, body, wBody) : []) {
    if (paint && l) { ctx.fillStyle = A.txt2; ctx.fillText(l, x0, yy + bl / 2); }
    yy += l ? bl : bl * 0.5;
  }
  if (day.alert && day.alert !== 'none') {
    yy += 18 * k;
    if (paint) alertPill(ctx, x0, yy, day.alert, day.alertType);
    yy += 48;
  }
  return Math.max(yy, ic.length ? iconBottom : yy) - y;
}

function pvSummary(ctx, text, x0, x1, y, k, paint) {
  const lab = Math.round(23 * k);
  const s = Math.round(33 * k);
  if (paint) {
    ctx.textBaseline = 'middle';
    font(ctx, 'mono', lab, 600);
    ctx.fillStyle = A.cy;
    spaced(ctx, 'PRÒXIMS DIES', x0, y + lab / 2, lab * 0.14);
  }
  let yy = y + lab + 20 * k;
  font(ctx, 'ui', s);
  const lh = Math.round(s * 1.42);
  for (const l of wrap(ctx, nbsp(capFirst(text.trim())), x1 - x0)) {
    if (paint && l) { ctx.fillStyle = A.txt2; ctx.fillText(l, x0, yy + lh / 2); }
    yy += l ? lh : lh * 0.5;
  }
  return yy - y;
}

const pvSkip = (st, day, i) => (i === 0 ? !!st.noToday : dayEmpty(day));
// Mesura totes les seccions a una escala k i retorna l'alçada total (amb els separadors)
function pvMeasure(ctx, st, icons, k, x0, x1, gap, opts) {
  let h = 0, n = 0;
  st.days.forEach((day, i) => { if (!pvSkip(st, day, i)) { h += pvDay(ctx, st, icons, day, i, x0, x1, 0, k, false, opts(i)); n++; } });
  if (st.summary.trim()) { h += pvSummary(ctx, st.summary, x0, x1, 0, k, false); n++; }
  return h + gap * k * (n - 1);
}
// La k més gran (fins a 1,45) amb què tot hi cap entre y0 i y1
function pvFit(ctx, st, icons, x0, x1, gap, room, opts = () => ({})) {
  for (let k = 1.45; k > 0.62; k -= 0.03) if (pvMeasure(ctx, st, icons, k, x0, x1, gap, opts) <= room) return k;
  return 0.62;
}
function pvPaint(ctx, st, icons, x0, x1, y, k, gap, opts = () => ({}), sep = PV.line, extra = 0) {
  const parts = [];
  st.days.forEach((day, i) => { if (!pvSkip(st, day, i)) parts.push(['d', day, i]); });
  if (st.summary.trim()) parts.push(['s']);
  parts.forEach((p, j) => {
    if (j > 0) {
      const g = (gap * k + extra) / 2;
      hline(ctx, x0, x1, y + g - 4, sep);
      y += g * 2;
    }
    y += p[0] === 'd' ? pvDay(ctx, st, icons, p[1], p[2], x0, x1, y, k, true, opts(p[2])) : pvSummary(ctx, st.summary, x0, x1, y, k, true);
  });
  return y;
}

export function drawPrevisioEstil(ctx, st, icons, style) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = PV.bg;
  ctx.fillRect(0, 0, W, H);
  const LIM = 1640;
  const dateL1 = cap(dayName(st.date));
  const dateL2 = dayMonth(st.date);

  if (style === 'nit') {
    contours(ctx);
    const y0 = header(ctx, 'Previsió del temps', dateL1, dateL2, A.cy, '#ffffff', A.cy, 230) + 64;
    const GAP = 92;
    const k = pvFit(ctx, st, icons, X0, X1, GAP, LIM - y0);
    const used = pvMeasure(ctx, st, icons, k, X0, X1, GAP, () => ({}));
    const n = st.days.filter((d, i) => !(i > 0 && dayEmpty(d))).length + (st.summary.trim() ? 1 : 0);
    const extra = n > 1 ? Math.min(60, (LIM - y0 - used) / (n - 1)) : 0;
    pvPaint(ctx, st, icons, X0, X1, y0, k, GAP, () => ({}), PV.line, extra);
  } else if (style === 'foto') {
    // Foto a dalt (retall vertical de la de la portada), enfosquida cap avall fins al color de fons
    const PH = 820;
    const img = icons.__foto;
    if (img) {
      const sw = img.width * 0.62, sh = sw * (PH / W);
      ctx.drawImage(img, img.width * 0.2, img.height * 0.08, sw, sh, 0, 0, W, PH);
    }
    const g = ctx.createLinearGradient(0, 0, 0, PH);
    g.addColorStop(0, 'rgba(6,10,18,0.55)');
    g.addColorStop(0.35, 'rgba(6,10,18,0.15)');
    g.addColorStop(0.75, 'rgba(6,10,18,0.7)');
    g.addColorStop(1, PV.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, PH);
    ctx.textBaseline = 'middle';
    font(ctx, 'mono', 24, 600);
    ctx.fillStyle = '#ffffff';
    spaced(ctx, 'PREVISIÓ DEL TEMPS', X0, 470, 3.4);
    tracking(ctx, -3.6);
    fitFont(ctx, 'head', 104, 800, dateL1, X1 - X0);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(dateL1, X0, 560);
    fitFont(ctx, 'head', 104, 800, dateL2, X1 - X0);
    ctx.fillStyle = A.cy;
    ctx.fillText(dateL2, X0, 660);
    tracking(ctx, 0);
    const y0 = 760;
    const GAP = 80;
    const k = pvFit(ctx, st, icons, X0, X1, GAP, LIM - y0);
    const used = pvMeasure(ctx, st, icons, k, X0, X1, GAP, () => ({}));
    const n = st.days.filter((d, i) => !(i > 0 && dayEmpty(d))).length + (st.summary.trim() ? 1 : 0);
    const extra = n > 1 ? Math.min(50, (LIM - y0 - used) / (n - 1)) : 0;
    pvPaint(ctx, st, icons, X0, X1, y0, k, GAP, () => ({}), PV.line, extra);
  } else {
    // 'avui': avui centrat i gran; demà i pròxims dies en un plafó a sota
    ctx.textBaseline = 'middle';
    font(ctx, 'mono', 24, 600);
    ctx.fillStyle = A.cy;
    spaced(ctx, `PREVISIÓ · ${dateL1} ${dateL2}`.toLocaleUpperCase('ca'), W / 2, 250, 3, 'center');
    const day = st.days[0];
    const rest = { ...st, noToday: true };
    // plafó de baix (demà i pròxims dies), a mida fixa de lletra
    const PX0 = X0 + 40, PX1 = X1 - 40;
    const hasRest = st.days.slice(1).some((d) => !dayEmpty(d)) || !!st.summary.trim();
    const kr = 0.9;
    const restH = hasRest ? pvMeasure(ctx, rest, icons, kr, PX0, PX1, 70, () => ({})) : 0;
    // avui: icona, titular i text centrats, que creixen fins a omplir l'espai de dalt
    const ic = dayIcons(day);
    const top = 300, bottom = hasRest ? LIM - restH - 68 - 50 : LIM;
    const fitAvui = (k, paint) => {
      let y = top + 20 * k;
      const iz = Math.round(230 * k);
      if (ic.length) {
        const gap = 30 * k;
        const tw = ic.length * iz + (ic.length - 1) * gap;
        ic.forEach(([key, label], i) => {
          const ix = W / 2 - tw / 2 + i * (iz + gap);
          if (paint && icons[key]) ctx.drawImage(icons[key], ix, y, iz, iz);
          if (paint && ic.length > 1) { font(ctx, 'mono', Math.round(22 * k)); ctx.fillStyle = A.mut2; spaced(ctx, label.toLocaleUpperCase('ca'), ix + iz / 2, y + iz + 18 * k, 2, 'center'); }
        });
        y += iz + (ic.length > 1 ? 56 : 30) * k;
      }
      if (paint) { font(ctx, 'mono', Math.round(26 * k), 600); ctx.fillStyle = A.gold; spaced(ctx, 'AVUI', W / 2, y + 13 * k, 4, 'center'); }
      y += 56 * k;
      const hs = Math.round(96 * k);
      tracking(ctx, -0.03 * hs);
      font(ctx, 'head', hs, 800);
      const lh = Math.round(hs * 1.05);
      for (const l of day.headline.trim() ? wrap(ctx, nbsp(capFirst(day.headline.trim())), X1 - X0) : []) {
        if (paint) { ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.fillText(l, W / 2, y + lh / 2); ctx.textAlign = 'left'; }
        y += lh;
      }
      tracking(ctx, 0);
      y += 18 * k;
      const bs = Math.round(40 * k), bl = Math.round(bs * 1.42);
      font(ctx, 'ui', bs);
      for (const l of day.text.trim() ? wrap(ctx, nbsp(capFirst(day.text.trim())), X1 - X0 - 40) : []) {
        if (paint && l) { ctx.textAlign = 'center'; ctx.fillStyle = A.txt2; ctx.fillText(l, W / 2, y + bl / 2); ctx.textAlign = 'left'; }
        y += l ? bl : bl * 0.5;
      }
      if (day.alert && day.alert !== 'none') {
        y += 22 * k;
        if (paint) {
          font(ctx, 'mono', 22, 500);
          const w = 18 + 24 + 12 + spacedWidth(ctx, `AVÍS ${day.alert} · ${PHENOMENA[day.alertType] || day.alertType}`.toLocaleUpperCase('ca'), 2.2) + 18;
          alertPill(ctx, W / 2 - w / 2, y, day.alert, day.alertType);
        }
        y += 48;
      }
      return y;
    };
    let k = 1.3;
    while (k > 0.6 && fitAvui(k, false) > bottom) k -= 0.03;
    const endA = fitAvui(k, false);
    // centra avui verticalment a l'espai que té
    ctx.save();
    ctx.translate(0, Math.max(0, (bottom - endA) / 2));
    fitAvui(k, true);
    ctx.restore();
    if (hasRest) {
      const py = LIM - restH - 68;
      ctx.fillStyle = PV.panel;
      ctx.beginPath();
      ctx.roundRect(X0, py, X1 - X0, restH + 68, 28);
      ctx.fill();
      pvPaint(ctx, rest, icons, PX0, PX1, py + 34, kr, 70, () => ({}), 'rgba(255,255,255,0.08)');
    }
  }
  footer(ctx, true);
}

export function drawPrevisio(ctx, st, icons, layout, page = 0) {
  // Des del 15 de novembre del 2026, de la família clara de la resta d'imatges: fons clar, targetes blanques i la data
  // com a títol (abans: fons fosc amb corbes de nivell i el títol fix "El temps").
  background(ctx, false);
  header(ctx, 'Previsió del temps', `${cap(dayName(st.date))} ${dayMonth(st.date)}`, '', L.blue, L.ink, L.ink, layout.headTop ?? TOP);
  const items = layout.pages[Math.min(page, layout.pages.length - 1)] || [];
  for (const b of items) b.type === 'day' ? drawCard(ctx, b, st, icons) : drawSummary(ctx, b);
  footer(ctx, false, layout.pages.length > 1 ? `${page + 1} / ${layout.pages.length}` : '');
}
