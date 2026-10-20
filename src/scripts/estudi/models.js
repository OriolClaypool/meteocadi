// Estudi · imatge "Quin model encerta més al Cadí?" (/estudi/models): el rànquing de models de /models (src/lib/models.js,
// verify) en una imatge per a xarxes, amb el mateix estil net que el rànquing d'estacions i els mapes (títol d'una línia
// amb icona, una línia petita amb què es compara, la llista i, a sota, els crèdits i meteocadi.cat).
// Oriol, 20/10/2026: "lo de los modelos… también tendría que estar en estudio".
import { font, tracking, spaced, spacedWidth, hline, netTitle, netFooter, fitFont, L } from './draw.js';
import { num, dayMonth } from '../../lib/format.js';

export const FORMATS = {
  post: { W: 1080, H: 1350, x0: 64, x1: 1016, head: 92, hs: 40, cap: 150, list: 184, limit: 1210, credits: 1262, foot: 1306, rowMax: 104 },
  story: { W: 1080, H: 1920, x0: 64, x1: 1016, head: 290, hs: 50, cap: 360, list: 396, limit: 1590, credits: 1640, foot: 1692, rowMax: 124 },
  wide: { W: 1600, H: 900, x0: 64, x1: 1536, head: 96, hs: 46, cap: 150, list: 180, limit: 760, credits: 800, foot: 848, rowMax: 72 },
};
const BEST = '#1f6fd1';
const REST = '#9cc2ea';
const GROUP = { alta: "a l'alta muntanya", vall: 'a la vall' };

// La línia petita de sota el títol: què es compara
function caption(ctx, d, F) {
  const a = d.by === 'pluja' ? 'PLUJA' : 'TEMPERATURA';
  const parts = [
    d.by === 'pluja' ? 'DIES ENCERTATS: PLOU O NO PLOU' : 'ERROR MITJÀ DE LA MÀXIMA I LA MÍNIMA',
    `DARRERS ${d.days} DIES`,
    d.lead === 2 ? 'PREVISIÓ DE DOS DIES ABANS' : 'PREVISIÓ DEL DIA ABANS',
  ];
  if (d.group) parts.push(d.group === 'alta' ? 'ALTA MUNTANYA' : 'VALL');
  const size = F.W === 1600 ? 17 : F.H === 1350 ? 16 : 18;
  const sp = 1.8;
  font(ctx, 'mono', size);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  let b = ` · ${parts.join(' · ')}`;
  // Si no hi cap, es treu el darrer tros
  while (spacedWidth(ctx, a, sp) + spacedWidth(ctx, b, sp) > F.x1 - F.x0 && parts.length > 2) {
    parts.pop();
    b = ` · ${parts.join(' · ')}`;
  }
  ctx.fillStyle = L.ink;
  spaced(ctx, a, F.x0, F.cap, sp);
  ctx.fillStyle = L.mut;
  spaced(ctx, b, F.x0 + spacedWidth(ctx, a, sp) + sp, F.cap, sp);
}

// d: { rows: verify().rows, days, from, to, lead, group, by: 'temp' | 'pluja', fmt }
export function drawModels(ctx, d) {
  const F = FORMATS[d.fmt] || FORMATS.post;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = L.bg;
  ctx.fillRect(0, 0, F.W, F.H);
  netTitle(ctx, { x0: F.x0, head: F.head, hs: F.hs, colR: F.x1, t1: 'Quin model encerta més', t2: d.group ? ` ${GROUP[d.group]}` : ' al Cadí', icon: 'models', accent: BEST });
  const rain = d.by === 'pluja';
  const rows = (d.rows || [])
    .filter((r) => (rain ? r.rain : r.mae != null))
    .sort((a, b) => (rain ? b.rain.acc - a.rain.acc || a.mae - b.mae : a.mae - b.mae));
  // "Del 21 de setembre al 20 d'octubre", "De l'1 a l'11 d'octubre"
  const dn = (iso) => Number(iso.slice(8, 10));
  const de = (iso) => (dn(iso) === 1 || dn(iso) === 11 ? "De l'" : 'Del ');
  const al = (iso) => (dn(iso) === 1 || dn(iso) === 11 ? "a l'" : 'al ');
  const period = d.from && d.to ? `${de(d.from)}${d.from.slice(0, 7) === d.to.slice(0, 7) ? dn(d.from) : dayMonth(d.from)} ${al(d.to)}${dayMonth(d.to)}` : '';
  const credit = `Previsions: Open-Meteo (CC BY 4.0), amb els models d'ECMWF, DWD, Météo-France, NOAA, Met Office i el Canadà, comparades amb les estacions de la xarxa Meteocadí${period ? `. ${period}` : ''}.`;
  if (!rows.length) {
    font(ctx, 'head', Math.round(F.hs * 0.8), 700);
    ctx.fillStyle = L.ink2;
    ctx.textBaseline = 'middle';
    ctx.fillText('Encara no hi ha prou dies de previsions.', F.x0, (F.list + F.limit) / 2);
    netFooter(ctx, { x0: F.x0, credits: F.credits, foot: F.foot, colR: F.x1, W: F.W, H: F.H, credit });
    return;
  }
  caption(ctx, { ...d, days: d.days }, F);

  // Columnes: posició, nom (i qui el fa) i barra amb el valor
  const wide = F.W === 1600;
  const NX = F.x0 + (wide ? 64 : 58);
  const BX = wide ? 900 : 560;
  const BAR = wide ? 440 : 250;
  let y = F.list;
  hline(ctx, F.x0, F.x1, y, L.ink, 2);
  const RH = Math.min(F.rowMax, Math.floor((F.limit - y) / rows.length));
  const rs = Math.min(1, RH / (wide ? 72 : 104));
  const vals = rows.map((r) => (rain ? r.rain.acc : r.mae));
  const hi = Math.max(...vals);
  // L'error, des de 0; els encerts de la pluja solen ser tots alts (85-95 %): la barra comença una mica per sota del pitjor
  const lo = rain ? Math.max(0, Math.min(...vals) - 8) : 0;
  rows.forEach((r, i) => {
    const cy = y + RH / 2;
    const v = vals[i];
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    font(ctx, 'mono', Math.round(26 * rs));
    ctx.fillStyle = L.rank;
    ctx.fillText(String(i + 1).padStart(2, '0'), F.x0, cy);
    const ns = Math.round((wide ? 28 : 32) * rs);
    fitFont(ctx, 'head', ns, 700, r.name, BX - NX - 24, Math.round(20 * rs));
    ctx.fillStyle = L.ink;
    ctx.fillText(r.name, NX, wide ? cy - 10 * rs : cy - 13 * rs);
    font(ctx, 'ui', Math.max(14, Math.round((wide ? 16 : 19) * rs)));
    ctx.fillStyle = L.mut;
    let who = r.who || '';
    while (who && ctx.measureText(who).width > BX - NX - 24) who = `${who.slice(0, -2).trimEnd()}…`;
    ctx.fillText(who, NX, wide ? cy + 15 * rs : cy + 19 * rs);
    // Barra: la llargada, el valor (més error, més llarga; a la pluja, més encerts, més llarga). La millor, en color
    const len = hi > lo ? Math.max(12, ((v - lo) / (hi - lo)) * BAR) : BAR;
    const bh = (wide ? 26 : 32) * rs;
    ctx.fillStyle = i === 0 ? BEST : REST;
    ctx.beginPath();
    ctx.roundRect(BX, cy - bh / 2, len, bh, 6);
    ctx.fill();
    const vx = BX + len + 16;
    font(ctx, 'mono', Math.round((wide ? 32 : 38) * rs), 500);
    ctx.fillStyle = i === 0 ? BEST : L.ink;
    const txt = rain ? `${v} %` : `${num(v, 1)}°`;
    ctx.fillText(txt, vx, cy + 1);
    const tw = ctx.measureText(txt).width;
    font(ctx, 'mono', Math.round((wide ? 17 : 19) * rs));
    ctx.fillStyle = L.mut;
    ctx.fillText(rain ? 'encerts' : "d'error", vx + tw + 10, cy + 4 * rs);
    y += RH;
    hline(ctx, F.x0, F.x1, y, L.line);
  });
  tracking(ctx, 0);
  netFooter(ctx, { x0: F.x0, credits: F.credits, foot: F.foot, colR: F.x1, W: F.W, H: F.H, credit });
}
