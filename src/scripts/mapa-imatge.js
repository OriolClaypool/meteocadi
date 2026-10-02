// Imatge del mapa de Catalunya per a xarxes socials (publicació 4:5, història 9:16 o horitzontal 16:9 per a X i webs),
// dibuixada en canvas.
// Només es veu Catalunya (la resta queda en blanc), amb la capa de color, les etiquetes de les estacions com al web,
// la llegenda, els crèdits de les dades i meteocadi.cat al peu. Mateix sistema visual que les imatges de /estudi.
import CONTORN from '../lib/catalunya-contorn.json';
import { dayName, dayMonth, todayMadrid, hourMadrid } from '../lib/format.js';

const F = { head: "'Schibsted Grotesk Variable'", ui: "'Geist Variable'", mono: "'Geist Mono Variable'" };
const C = { bg: '#eef3f8', land: '#ffffff', ink: '#10233b', ink2: '#44556b', mut: '#56667a', blue: '#22477a', line: '#dfe6ee' };
const STRIP = ['#22477a', '#47a838', '#be282c', '#fbbd28'];
const X0 = 64;
const X1 = 1016;

// map: caixa on s'encaixa Catalunya [x0, y0, x1, y1]
const FORMATS = {
  post: { W: 1080, H: 1350, top: 58, size: 62, eyebrow: 22, map: [40, 246, 1040, 1196], credits: 1232, foot: 1300, pill: 21, dot: 6.5, sw: 44 },
  story: { W: 1080, H: 1920, top: 180, size: 92, eyebrow: 24, map: [28, 440, 1052, 1466], credits: 1516, foot: 1718, pill: 23, dot: 7, sw: 48 },
  // Horitzontal: text i llegenda a l'esquerra, mapa a la dreta
  wide: { W: 1600, H: 900, top: 76, size: 70, eyebrow: 20, map: [650, 26, 1574, 866], x1: 596, legendAt: [64, 372], credits: 700, foot: 836, pill: 20, dot: 6.5, sw: 50 },
};

const NOTES = {
  dem: "El color és una estimació entre estacions que té en compte l'altitud del terreny.",
  wind: "El color és una estimació entre estacions i només orientativa: el vent canvia molt d'un lloc a l'altre.",
  plain: 'El color és una estimació entre estacions.',
};

const HAS_LS = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;
const tracking = (ctx, px) => { if (HAS_LS) ctx.letterSpacing = `${px}px`; };
const font = (ctx, fam, size, weight = 400) => { ctx.font = `${weight} ${size}px ${F[fam]}`; };

function spaced(ctx, text, x, y, sp) {
  ctx.textAlign = 'left';
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + sp;
  }
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

function wrapText(ctx, text, width) {
  const lines = [];
  let line = '';
  for (const w of text.split(' ')) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > width && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

// ctx pot ser el context del canvas o un Path2D (per retallar)
function roundRect(ctx, x, y, w, h, r) {
  if (ctx.beginPath) ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function loadFonts(f) {
  const s = 'AaÀàÈèÉéÍíÏïÒòÓóÚúÜüÇç·°−0123456789';
  try {
    await Promise.all([
      document.fonts.load(`800 ${f.size}px ${F.head}`, s),
      document.fonts.load(`800 36px ${F.head}`, s),
      document.fonts.load(`700 ${f.pill}px ${F.ui}`, s),
      document.fonts.load(`400 17px ${F.ui}`, s),
      document.fonts.load(`400 ${f.eyebrow}px ${F.mono}`, s),
    ]);
  } catch {}
}

// Rectangle que ocupa Catalunya
const CAT = (() => {
  let lng0 = 180, lng1 = -180, lat0 = 90, lat1 = -90;
  for (const poly of CONTORN.coordinates)
    for (const [x, y] of poly[0]) {
      lng0 = Math.min(lng0, x); lng1 = Math.max(lng1, x);
      lat0 = Math.min(lat0, y); lat1 = Math.max(lat1, y);
    }
  return { lng0, lng1, lat0, lat1 };
})();

// La zona que es veu al web, si s'hi ha fet zoom (si es veu tot Catalunya o la zona en queda fora, null)
function zoomedView(v) {
  if (!v) return null;
  const m = 0.04;
  if (v.lng0 <= CAT.lng0 + m && v.lng1 >= CAT.lng1 - m && v.lat0 <= CAT.lat0 + m && v.lat1 >= CAT.lat1 - m) return null;
  if (v.lng1 < CAT.lng0 || v.lng0 > CAT.lng1 || v.lat1 < CAT.lat0 || v.lat0 > CAT.lat1) return null;
  return v;
}

// Projecció Web Mercator d'una zona (per defecte, tot Catalunya) dins la caixa, centrada i sense deformar.
// cover: la zona omple tota la caixa (amb zoom: la mateixa escala que la pantalla, i si les proporcions no
// coincideixen, es retallen les vores); si no, hi cap sencera.
function projector(box, bb = CAT, cover = false) {
  const { lng0, lng1, lat0, lat1 } = bb;
  const my = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const [bx0, by0, bx1, by1] = box;
  const wx = ((lng1 - lng0) * Math.PI) / 180, wy = my(lat1) - my(lat0);
  const s = (cover ? Math.max : Math.min)((bx1 - bx0) / wx, (by1 - by0) / wy);
  const ox = bx0 + (bx1 - bx0 - wx * s) / 2, oy = by0 + (by1 - by0 - wy * s) / 2;
  const top = my(lat1);
  const p = (lng, lat) => [ox + (((lng - lng0) * Math.PI) / 180) * s, oy + (top - my(lat)) * s];
  return { p, right: ox + wx * s, bottom: oy + wy * s };
}

function ringsPath(p, polys) {
  const path = new Path2D();
  for (const poly of polys)
    for (const ring of poly) {
      ring.forEach(([x, y], i) => {
        const [px, py] = p(x, y);
        i ? path.lineTo(px, py) : path.moveTo(px, py);
      });
      path.closePath();
    }
  return path;
}

// o: { format, title: [l1, l2], accent, today, when: Date, stations: [{ lat, lng, mc, text, bg, fg }] (per prioritat),
//      hideOverlap (les que no hi caben no surten, en lloc de sortir com a punt),
//      comarques (GeoJSON), field: { canvas, bounds, alpha, note } | null, legend: { title, steps: [{ color, label }] },
//      view: { lat0, lat1, lng0, lng1 } (la zona que es veu al web; si s'hi ha fet zoom, la imatge mostra aquesta zona) }
export async function renderMapImage(o) {
  const f = FORMATS[o.format] || FORMATS.post;
  await loadFonts(f);
  const cv = document.createElement('canvas');
  cv.width = f.W;
  cv.height = f.H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, f.W, f.H);

  // ---- capçalera: data i hora, i títol de dues línies (la segona en color)
  const day = todayMadrid(o.when);
  const hour = hourMadrid(o.when);
  const eyebrow = `${dayName(day)} ${dayMonth(day)} · ${o.today ? 'fins a les' : 'a les'} ${hour}`.toLocaleUpperCase('ca');
  ctx.textBaseline = 'middle';
  font(ctx, 'mono', f.eyebrow);
  ctx.fillStyle = C.blue;
  spaced(ctx, eyebrow, X0, f.top + 15, f.eyebrow * 0.14);
  tracking(ctx, -0.035 * f.size);
  const [l1, l2] = o.title;
  const TX1 = f.x1 ?? X1;
  const s = Math.min(fitFont(ctx, 'head', f.size, 800, l1, TX1 - X0), fitFont(ctx, 'head', f.size, 800, l2, TX1 - X0));
  font(ctx, 'head', s, 800);
  const y1 = f.top + 15 + 0.81 * f.size;
  ctx.fillStyle = C.ink;
  ctx.fillText(l1, X0, y1);
  ctx.fillStyle = o.accent || C.blue;
  ctx.fillText(l2, X0, y1 + 0.98 * f.size);
  tracking(ctx, 0);

  // ---- Catalunya (o la zona on s'ha fet zoom al web: llavors el mapa és una finestra retallada i la llegenda va a sota)
  const view = zoomedView(o.view);
  const LG_H = 116;
  const win = view && !f.legendAt ? [f.map[0], f.map[1], f.map[2], f.map[3] - LG_H - 28] : f.map;
  const { p, right, bottom } = projector(win, view || CAT, !!view);
  const land = ringsPath(p, CONTORN.coordinates);
  const frame = new Path2D();
  if (view) {
    roundRect(frame, win[0], win[1], win[2] - win[0], win[3] - win[1], 22);
    ctx.save();
    ctx.fillStyle = '#e4eaf1';
    ctx.fill(frame);
    ctx.clip(frame);
  }
  ctx.save();
  ctx.shadowColor = 'rgba(16, 35, 59, 0.16)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = C.land;
  ctx.fill(land, 'evenodd');
  ctx.restore();

  if (o.field) {
    const b = o.field.bounds;
    const [ax, ay] = p(b.lng0, b.lat1);
    const [cx, cy] = p(b.lng1, b.lat0);
    ctx.save();
    ctx.clip(land, 'evenodd');
    ctx.globalAlpha = o.field.alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(o.field.canvas, ax, ay, cx - ax, cy - ay);
    ctx.restore();
  }

  if (o.comarques?.features) {
    ctx.save();
    ctx.clip(land, 'evenodd');
    ctx.strokeStyle = 'rgba(16, 35, 59, 0.3)';
    ctx.lineWidth = 1.2;
    ctx.lineJoin = 'round';
    for (const ft of o.comarques.features) ctx.stroke(ringsPath(p, ft.geometry.coordinates));
    ctx.restore();
  }
  ctx.strokeStyle = C.ink;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.stroke(land);
  ctx.globalAlpha = 1;
  if (view) {
    ctx.restore();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.stroke(frame);
  }
  // Fora de la finestra no es dibuixa cap estació
  const inBox = (x, y) => x > win[0] + 6 && x < win[2] - 6 && y > win[1] + 6 && y < win[3] - 6;

  // ---- estacions: etiqueta si hi cap, i si no un punt (mateix criteri que al web)
  font(ctx, 'ui', f.pill, 700);
  tracking(ctx, -0.01 * f.pill);
  const ph = Math.round(f.pill * 1.5);
  const pad = Math.round(f.pill * 0.48);
  const placed = [];
  const pills = [];
  const dots = [];
  for (const st of o.stations) {
    const [x, y] = p(st.lng, st.lat);
    if (!inBox(x, y)) continue;
    const w = Math.ceil(ctx.measureText(st.text).width) + 2 * pad;
    // Amb zoom, l'etiqueta ha de cabre sencera dins la finestra (si no, com a molt hi surt el punt)
    const cut = view && (x - w / 2 < win[0] + 4 || x + w / 2 > win[2] - 4 || y - ph / 2 < win[1] + 4 || y + ph / 2 > win[3] - 4);
    if (cut) { if (!o.hideOverlap) dots.push({ ...st, x, y }); continue; }
    const g = o.hideOverlap ? 6 : 2;
    const box = [x - w / 2 - g, y - ph / 2 - g, x + w / 2 + g, y + ph / 2 + g];
    const hit = placed.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]));
    if (hit && o.hideOverlap) continue;
    if (hit) dots.push({ ...st, x, y });
    else { placed.push(box); pills.push({ ...st, x, y, w }); }
  }
  for (const d of dots) {
    ctx.beginPath();
    ctx.arc(d.x, d.y, f.dot, 0, Math.PI * 2);
    ctx.fillStyle = d.bg;
    ctx.fill();
    ctx.lineWidth = d.mc ? 2.5 : 2;
    ctx.strokeStyle = d.mc ? C.ink : '#ffffff';
    ctx.stroke();
  }
  // Primer les menys prioritàries: les de Meteocadí queden per sobre
  for (const q of [...pills].reverse()) {
    const x0 = q.x - q.w / 2, y0 = q.y - ph / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(16, 35, 59, 0.3)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 1.5;
    roundRect(ctx, x0, y0, q.w, ph, ph / 2);
    ctx.fillStyle = q.bg;
    ctx.fill();
    ctx.restore();
    roundRect(ctx, x0, y0, q.w, ph, ph / 2);
    if (q.mc) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
    } else if (o.field) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.stroke();
    }
    ctx.fillStyle = q.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(q.text, q.x, q.y + 1);
  }
  tracking(ctx, 0);

  // ---- llegenda, al mar (cantonada de baix a la dreta de Catalunya)
  const steps = o.legend.steps;
  const gap = 5, lp = 20;
  const bw = steps.length * f.sw + (steps.length - 1) * gap + 2 * lp;
  const bh = 116;
  const [bx, by] = f.legendAt ?? (view ? [X0, win[3] + 28] : [Math.round(right - bw), Math.round(bottom - bh)]);
  ctx.save();
  ctx.shadowColor = 'rgba(16, 35, 59, 0.12)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, bx, by, bw, bh, 14);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
  roundRect(ctx, bx, by, bw, bh, 14);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textBaseline = 'middle';
  font(ctx, 'mono', 15);
  ctx.fillStyle = C.mut;
  spaced(ctx, o.legend.title.toLocaleUpperCase('ca'), bx + lp, by + 30, 1.2);
  steps.forEach((st, i) => {
    const x = bx + lp + i * (f.sw + gap);
    roundRect(ctx, x, by + 52, f.sw, 16, 4);
    ctx.fillStyle = st.color;
    ctx.fill();
    font(ctx, 'mono', 15);
    ctx.fillStyle = C.ink2;
    ctx.textAlign = 'center';
    ctx.fillText(st.label, x + f.sw / 2, by + 88);
  });

  // ---- crèdits i peu
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.mut;
  const credit = 'Dades: Servei Meteorològic de Catalunya (XEMA, dades obertes de la Generalitat) i xarxa Meteocadí. Límits comarcals: ICGC.';
  const note = o.field ? NOTES[o.field.note] || NOTES.plain : '';
  if (f.x1) {
    // Columna estreta: el text es parteix en línies
    font(ctx, 'ui', 18);
    let cy = f.credits;
    for (const t of [credit, note].filter(Boolean)) {
      for (const line of wrapText(ctx, t, TX1 - X0)) { ctx.fillText(line, X0, cy); cy += 26; }
      cy += 8;
    }
  } else {
    fitFont(ctx, 'ui', 17, 400, credit, X1 - X0, 13);
    ctx.fillText(credit, X0, f.credits);
    if (note) {
      fitFont(ctx, 'ui', 17, 400, note, X1 - X0, 13);
      ctx.fillText(note, X0, f.credits + 26);
    }
  }
  tracking(ctx, -0.36);
  font(ctx, 'head', 36, 800);
  ctx.fillStyle = C.ink;
  ctx.fillText('meteocadi.cat', X0, f.foot);
  tracking(ctx, 0);
  const sw = f.W / 4;
  STRIP.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * sw, f.H - 8, sw + 1, 8);
  });
  return cv;
}
