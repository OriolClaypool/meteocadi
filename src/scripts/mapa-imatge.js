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
  // De píxel a [lng, lat] (per mostrejar el vent en una graella de la imatge)
  const inv = (x, y) => [lng0 + (((x - ox) / s) * 180) / Math.PI, ((2 * Math.atan(Math.exp(top - (y - oy) / s)) - Math.PI / 2) * 180) / Math.PI];
  return { p, inv, right: ox + wx * s, bottom: oy + wy * s };
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
  // windowed: el mapa sempre dins una finestra amb la llegenda a sota (imatges del radar)
  const view = zoomedView(o.view);
  const windowed = !!view || !!o.windowed;
  const LG_H = 116;
  const win = windowed && !f.legendAt ? [f.map[0], f.map[1], f.map[2], f.map[3] - LG_H - 28] : f.map;
  const { p, inv, right, bottom } = projector(win, view || CAT, !!view);
  const land = ringsPath(p, CONTORN.coordinates);
  const frame = new Path2D();
  if (windowed) {
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

  // Radar (o una altra capa en píxels): per sobre de la terra i del mar, dins la finestra; píxels nítids si s'amplia
  if (o.raster) {
    const b = o.raster.bounds;
    const [ax, ay] = p(b.lng0, b.lat1);
    const [cx, cy] = p(b.lng1, b.lat0);
    ctx.save();
    ctx.globalAlpha = o.raster.alpha ?? 1;
    ctx.imageSmoothingEnabled = !o.raster.crisp;
    ctx.drawImage(o.raster.canvas, ax, ay, cx - ax, cy - ay);
    ctx.restore();
  }

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
  // Vent: línies de convergència, fletxes del model en una graella i fletxes mesurades a les estacions
  if (o.conv || o.arrows || o.windObs) {
    ctx.save();
    if (!windowed) { ctx.beginPath(); ctx.rect(win[0], win[1], win[2] - win[0], win[3] - win[1]); ctx.clip(); }
    if (o.conv) {
      ctx.setLineDash([12, 8]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const ln of o.conv)
        for (const [color, extra] of [['rgba(255,255,255,0.85)', 3.6], [C.ink, 0]]) {
          ctx.strokeStyle = color;
          ctx.lineWidth = ln.w * 1.5 + extra;
          ctx.beginPath();
          for (const path of ln.paths)
            path.forEach(([la, lo], n) => {
              const [x, y] = p(lo, la);
              n ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            });
          ctx.stroke();
        }
      ctx.setLineDash([]);
    }
    if (o.arrows) {
      const S = f.arrow || 46;
      for (let y = win[1] + S / 2; y < win[3]; y += S)
        for (let x = win[0] + S / 2; x < win[2]; x += S) {
          const [lng, lat] = inv(x, y);
          const w = o.arrows.sample(lat, lng);
          if (!w) continue;
          const ms = Math.hypot(w[0], w[1]);
          if (ms < 0.3) continue;
          windArrow(ctx, x, y, w[0], -w[1], o.arrows.len(ms, S * 0.8) * 1.2, 'rgba(16,35,59,0.75)');
        }
    }
    for (const a of o.windObs || []) {
      const [x, y] = p(a.lng, a.lat);
      if (x < win[0] || x > win[2] || y < win[1] || y > win[3]) continue;
      const rad = (a.dir * Math.PI) / 180, dx = -Math.sin(rad), dy = Math.cos(rad);
      const len = Math.max(30, Math.min(56, 10 + a.ms * 3));
      windArrow(ctx, x + (dx * len) / 2, y + (dy * len) / 2, dx, dy, len, '#c2410c');
    }
    ctx.restore();
  }
  if (windowed) {
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
    const cut = windowed && (x - w / 2 < win[0] + 4 || x + w / 2 > win[2] - 4 || y - ph / 2 < win[1] + 4 || y + ph / 2 > win[3] - 4);
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
    ctx.globalAlpha = q.dim ? 0.72 : 1; // valors zero (radar), més discrets
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
    } else if (o.field || o.raster) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.stroke();
    }
    ctx.fillStyle = q.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(q.text, q.x, q.y + 1);
  }
  ctx.globalAlpha = 1;
  tracking(ctx, 0);

  // ---- llegenda, al mar (cantonada de baix a la dreta de Catalunya), o sota la finestra
  const bar = o.legend.bar; // { colors, ticks: [text] }: barra contínua (radar)
  const steps = o.legend.steps || [];
  const gap = 5, lp = 20;
  const bw = bar ? Math.min(560, (f.x1 ?? X1) - X0) : steps.length * f.sw + (steps.length - 1) * gap + 2 * lp;
  const bh = 116;
  const [bx, by] = f.legendAt ?? (windowed ? [X0, win[3] + 28] : [Math.round(right - bw), Math.round(bottom - bh)]);
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
  if (bar) {
    const n = bar.colors.length, iw = (bw - 2 * lp) / n;
    ctx.save();
    roundRect(ctx, bx + lp, by + 52, bw - 2 * lp, 16, 4);
    ctx.clip();
    bar.colors.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(bx + lp + i * iw, by + 52, iw + 1, 16); });
    ctx.restore();
    roundRect(ctx, bx + lp, by + 52, bw - 2 * lp, 16, 4);
    ctx.strokeStyle = 'rgba(16,35,59,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
    font(ctx, 'ui', 15);
    ctx.fillStyle = C.ink2;
    bar.ticks.forEach((t, i) => {
      ctx.textAlign = i === 0 ? 'left' : i === bar.ticks.length - 1 ? 'right' : 'center';
      const x = bx + lp + ((bw - 2 * lp) * i) / (bar.ticks.length - 1);
      ctx.fillText(t, x, by + 88);
    });
  }
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
  const credit = o.credit || 'Dades: Servei Meteorològic de Catalunya (XEMA, dades obertes de la Generalitat) i xarxa Meteocadí. Límits comarcals: ICGC.';
  const note = o.note ?? (o.field ? NOTES[o.field.note] || NOTES.plain : '');
  if (f.x1) {
    // Columna estreta: el text es parteix en línies
    font(ctx, 'ui', 18);
    const blocks = [credit, note].filter(Boolean).map((t) => wrapText(ctx, t, TX1 - X0));
    const height = blocks.reduce((n, b) => n + b.length * 26 + 8, 0);
    let cy = Math.min(f.credits, f.foot - 52 - height + 26);
    for (const lines of blocks) {
      for (const line of lines) { ctx.fillText(line, X0, cy); cy += 26; }
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

// Fletxa de vent (cap on bufa) amb un contorn blanc perquè es vegi sobre el radar
function windArrow(ctx, x, y, dx, dy, len, color) {
  const m = Math.hypot(dx, dy) || 1;
  const ux = dx / m, uy = dy / m;
  const x0 = x - (ux * len) / 2, y0 = y - (uy * len) / 2, x1 = x + (ux * len) / 2, y1 = y + (uy * len) / 2;
  const hl = Math.min(9, len * 0.42);
  const draw = () => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.moveTo(x1 - ux * hl - uy * hl * 0.55, y1 - uy * hl + ux * hl * 0.55);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1 - ux * hl + uy * hl * 0.55, y1 - uy * hl - ux * hl * 0.55);
    ctx.stroke();
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 4;
  draw();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.9;
  draw();
}

const RADAR_VARS = { rain1h: "pluja de l'última hora (mm)", rain: "pluja d'avui (mm)", gust: "ratxa màxima d'avui (km/h)", t: 'temperatura (°C)' };

// Imatge del radar (estudi): el radar del Meteocat, les estacions i el vent, amb els crèdits de cada font.
// snap: el que retorna startRadar().snapshot() + format
export async function renderRadarImage(snap) {
  const { PAL } = await import('./radar-pal.js');
  const snow = snap.prod === 'plujaneu';
  const notes = [];
  if (snap.stations?.length && RADAR_VARS[snap.stVar]) notes.push(`Etiquetes: ${RADAR_VARS[snap.stVar]}.`);
  if (snap.wind && snap.windRun) notes.push(`Fletxes: ${snap.windRun.kind === 'gust' ? 'ratxes' : 'vent'} del model a les ${hourMadrid(new Date(snap.windRun.valid))}.`);
  if (snap.windObs) notes.push('En taronja: vent mesurat.');
  if (snap.conv) notes.push('Discontínua: convergència.');
  return renderMapImage({
    format: snap.format,
    title: snow ? ['Pluja, aiguaneu o neu', 'segons el radar'] : ['Radar de', 'precipitació'],
    accent: '#1d4ed8',
    today: false,
    when: snap.when,
    stations: snap.stations || [],
    hideOverlap: true,
    comarques: snap.comarques,
    raster: snap.raster,
    arrows: snap.wind,
    windObs: snap.windObs,
    conv: snap.conv,
    view: snap.view,
    windowed: true,
    legend: snow
      ? { title: 'Tipus de precipitació', bar: { colors: PAL.plujaneu, ticks: ['Pluja', 'Aiguaneu', 'Neu'] } }
      : { title: 'Intensitat de la precipitació', bar: { colors: PAL[snap.pal] || PAL.meteocat, ticks: ['Feble', 'Moderada', 'Forta', 'Calamarsa'] } },
    credit: `Radar: Servei Meteorològic de Catalunya.${snap.wind || snap.conv ? ` Vent: model ${snap.windRun?.model || 'AROME'} de Météo-France.` : ''} Estacions: XEMA i xarxa Meteocadí. Límits: ICGC.`,
    note: notes.join(' '),
  });
}
