// Imatge de previsualització (1200 × 630) de cada pàgina: la que surt en compartir l'enllaç a WhatsApp, X, Telegram…
// Text (satori, amb les fonts del web convertides a corbes) a l'esquerra i, a la dreta, el contorn de Catalunya i
// Andorra amb el lloc de la pàgina marcat. Tot es dibuixa en un sol SVG que sharp passa a JPEG.
import { readFileSync } from 'node:fs';
import satori from 'satori';
import sharp from 'sharp';

const here = (p) => new URL(p, import.meta.url);
const font = (pkg, file) => readFileSync(here(`../node_modules/@fontsource/${pkg}/files/${file}`));
const FONTS = [
  { name: 'Schibsted', data: font('schibsted-grotesk', 'schibsted-grotesk-latin-800-normal.woff'), weight: 800, style: 'normal' },
  { name: 'Geist', data: font('geist', 'geist-latin-500-normal.woff'), weight: 500, style: 'normal' },
  { name: 'Geist Mono', data: font('geist-mono', 'geist-mono-latin-500-normal.woff'), weight: 500, style: 'normal' },
];
const CAT = JSON.parse(readFileSync(here('../src/lib/catalunya-contorn.json'), 'utf8'));
const AND = JSON.parse(readFileSync(here('../src/lib/andorra-contorn.json'), 'utf8'));
// Estacions de la xarxa (per al mapa de les pàgines generals)
const NET = [[42.2838, 1.7371], [42.2402, 1.7014], [42.2991, 1.9252], [42.2872, 1.8852], [42.2415, 1.6577], [42.2304, 1.8898],
  [42.2215, 1.8948], [42.165, 1.874], [42.2578, 1.8602], [42.2445, 1.9736], [42.2517, 1.8638], [42.2468, 1.8677]];

const W = 1200, H = 630;
const INK = '#10233b', MUTED = '#5b7086', BG = '#eef2f6';
const STRIP = ['#22477a', '#47a838', '#be282c', '#fbbd28'];

// Projecció de Mercator encaixada a la caixa del mapa (a la dreta)
const BOX = { x: 700, y: 46, w: 440, h: 500 };
const B = { lng0: 0.12, lng1: 3.36, lat0: 40.48, lat1: 42.9 };
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const rad = (d) => (d * Math.PI) / 180;
const SX = rad(B.lng1 - B.lng0), SY = merc(B.lat1) - merc(B.lat0);
const K = Math.min(BOX.w / SX, BOX.h / SY);
const OX = BOX.x + (BOX.w - SX * K) / 2, OY = BOX.y + (BOX.h - SY * K) / 2;
const proj = (lng, lat) => [OX + rad(lng - B.lng0) * K, OY + (merc(B.lat1) - merc(lat)) * K];
const ring = (pts) => `M${pts.map(([x, y]) => proj(x, y).map((v) => v.toFixed(1)).join(' ')).join('L')}Z`;
const CAT_D = CAT.coordinates.map((poly) => poly.map(ring).join('')).join('');
const AND_D = AND.coordinates.map(ring).join('');

function mapSvg(card) {
  // Sense variant: el punt de la pàgina si en té (lat/lng) i, si no, les estacions de la xarxa
  const v = card.v || (card.lat != null || card.pins ? 'pin' : 'net');
  const parts = [];
  parts.push(`<defs>
    <linearGradient id="fg" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#2563eb"/><stop offset="0.28" stop-color="#14b8a6"/><stop offset="0.5" stop-color="#22c55e"/>
      <stop offset="0.72" stop-color="#eab308"/><stop offset="1" stop-color="#f97316"/>
    </linearGradient>
    <clipPath id="cc"><path d="${CAT_D}"/></clipPath>
  </defs>`);
  parts.push(`<path d="${AND_D}" fill="#f6f8fa" stroke="${INK}" stroke-opacity="0.45" stroke-width="1.6" stroke-linejoin="round"/>`);
  parts.push(`<path d="${CAT_D}" fill="${v === 'field' ? 'url(#fg)' : '#ffffff'}" fill-opacity="${v === 'field' ? 0.85 : 1}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`);
  if (v === 'radar') {
    // Centre: el punt de la pàgina (el radar del Berguedà) o el centre de Catalunya
    const [cx, cy] = card.lat != null ? proj(card.lng, card.lat) : proj(1.75, 41.75);
    const rings = [60, 120, 180, 240].map((r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${STRIP[0]}" stroke-opacity="0.35" stroke-width="2"/>`).join('');
    const a = (deg, r) => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];
    const [x1, y1] = a(-80, 260), [x2, y2] = a(-35, 260);
    parts.push(`<g clip-path="url(#cc)">${rings}<path d="M${cx} ${cy}L${x1} ${y1}A260 260 0 0 1 ${x2} ${y2}Z" fill="${STRIP[1]}" fill-opacity="0.28"/>
      <line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${STRIP[1]}" stroke-width="3"/></g>`);
    parts.push(`<circle cx="${cx}" cy="${cy}" r="7" fill="${INK}"/>`);
  }
  if (v === 'net') {
    for (const [lat, lng] of NET) {
      const [x, y] = proj(lng, lat);
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" fill="${STRIP[2]}" stroke="#fff" stroke-width="2"/>`);
    }
  }
  if (card.pins) {
    for (const [lat, lng] of card.pins) {
      const [x, y] = proj(lng, lat);
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6.5" fill="${STRIP[2]}" stroke="#fff" stroke-width="2.4"/>`);
    }
  }
  if (card.lat != null && card.lng != null && v !== 'radar') {
    const [x, y] = proj(card.lng, card.lat);
    parts.push(`<circle cx="${x}" cy="${y}" r="30" fill="${STRIP[2]}" fill-opacity="0.16"/>`);
    parts.push(`<circle cx="${x}" cy="${y}" r="12" fill="${STRIP[2]}" stroke="#fff" stroke-width="4"/>`);
  }
  // Franja de colors del logo a baix, com al web
  const strip = STRIP.map((c, i) => `<rect x="${(i * W) / 4}" y="${H - 12}" width="${W / 4 + 1}" height="12" fill="${c}"/>`).join('');
  return `<rect width="${W}" height="${H}" fill="${BG}"/>${parts.join('')}${strip}`;
}

const el = (type, style, children) => ({ type, props: { style, children } });

function titleSize(t) {
  const n = t.length;
  return n <= 12 ? 100 : n <= 18 ? 88 : n <= 26 ? 76 : n <= 36 ? 66 : n <= 48 ? 58 : 50;
}

function layout(card) {
  const kids = [];
  if (card.k) kids.push(el('div', { fontFamily: 'Geist Mono', fontSize: 22, letterSpacing: 3, color: MUTED, textTransform: 'uppercase', marginBottom: 22 }, card.k));
  kids.push(el('div', { fontFamily: 'Schibsted', fontWeight: 800, fontSize: titleSize(card.t), lineHeight: 1.02, letterSpacing: -2, color: INK }, card.t));
  if (card.s) kids.push(el('div', { fontFamily: 'Geist', fontSize: 30, lineHeight: 1.3, color: '#3d5168', marginTop: 24, lineClamp: 3 }, card.s));
  // Com a les imatges per a xarxes: sense logo, només meteocadi.cat (WhatsApp ja hi posa la icona del web)
  const brand = el('div', { fontFamily: 'Schibsted', fontWeight: 800, fontSize: 34, letterSpacing: -0.5, color: INK }, 'meteocadi.cat');
  const children = [
    el('div', { position: 'absolute', left: 72, top: 70, width: 590, display: 'flex', flexDirection: 'column' }, kids),
    el('div', { position: 'absolute', left: 72, bottom: 52, display: 'flex' }, [brand]),
  ];
  // Etiqueta del punt (altitud o nom curt), al costat del marcador
  if (card.m && card.lat != null) {
    const [x, y] = proj(card.lng, card.lat);
    const right = x < BOX.x + BOX.w - 150;
    children.push(el('div', {
      position: 'absolute', top: y - 22, ...(right ? { left: x + 30 } : { right: W - x + 30 }),
      display: 'flex', padding: '6px 14px', borderRadius: 999, background: INK, color: '#fff',
      fontFamily: 'Geist Mono', fontSize: 22,
    }, card.m));
  }
  return el('div', { width: W, height: H, display: 'flex', position: 'relative' }, children);
}

export async function renderCard(card) {
  let svg = await satori(layout(card), { width: W, height: H, fonts: FONTS });
  // El mapa i el fons van per sota del text: s'afegeixen just després de l'etiqueta <svg ...>
  svg = svg.replace(/^(<svg[^>]*>)/, `$1${mapSvg(card)}`);
  return sharp(Buffer.from(svg)).jpeg({ quality: 88, chromaSubsampling: '4:4:4', mozjpeg: true }).toBuffer();
}
