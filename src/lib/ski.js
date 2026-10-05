// Neu i esquí: previsió de 7 dies a les estacions d'esquí (part alta i base) i valoració del temps per esquiar.
// La valoració només té en compte el temps previst (vent a dalt, nevada, pluja, sol, fred i calor),
// mai l'estat de les pistes ni si l'estació és oberta. Es fa servir en temps de build i al navegador.
import { num, dayName, dayShort, parseDay, cap } from './format.js';
import { wmoIcon, wmoText, iconUrl } from './wmo.js';
import { fetchMountain } from './mountain.js';

export const SKI_DAYS = 7; // dies de previsió a partir d'avui
export const SKI_PAST = 2; // dies anteriors, per saber la neu nova caiguda
// Les estacions són els llocs de places.js amb l'atribut ski (no s'importa aquí perquè aquest fitxer també va al navegador)

// Temporada d'esquí: del 15 de novembre al 30 d'abril. Fora de temporada no es mostra la valoració.
export function inSeason(iso) {
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return m === 12 || m <= 3 || m === 4 || (m === 11 && d >= 15);
}

const thousands = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const TXT = {
  ca: {
    today: 'Avui', tomorrow: 'Demà',
    levels: ['', 'Dolent', 'Regular', 'Bo', 'Molt bo'],
    rows: { rate: 'Temps per esquiar', sky: 'Cel', snow: 'Neu nova al cim', top: 'Temperatura al cim', base: 'Temperatura a la base', gust: 'Ratxa al cim', frz: 'Isoterma de 0 °C' },
    type: { alpi: 'Esquí alpí', nordic: 'Esquí nòrdic' },
    snow7: 'cm de neu prevista al cim en 7 dies',
    noSnow7: 'Sense neu prevista en 7 dies',
    best: 'Millor dia per esquiar',
    none: 'Cap dia bo per esquiar aquesta setmana',
    why: {
      wind3: 'vent molt fort a dalt', wind2: 'vent fort a dalt', wind1: 'una mica de vent a dalt', calm: 'poc vent',
      storm: 'temporal de neu', snowing: 'nevada', rain: 'pluja a la base', rainTop: 'pluja fins a dalt', cloud: 'cel tapat', fog: 'boira', sun: 'sol',
      cold2: 'molt fred a dalt', cold1: 'fred a dalt', hot: 'massa calor per a la neu', warm: 'neu humida a la tarda',
      fresh2: 'molta neu nova', fresh1: 'neu nova',
    },
  },
  es: {
    today: 'Hoy', tomorrow: 'Mañana',
    levels: ['', 'Malo', 'Regular', 'Bueno', 'Muy bueno'],
    rows: { rate: 'Tiempo para esquiar', sky: 'Cielo', snow: 'Nieve nueva en la cima', top: 'Temperatura en la cima', base: 'Temperatura en la base', gust: 'Racha en la cima', frz: 'Isoterma de 0 °C' },
    type: { alpi: 'Esquí alpino', nordic: 'Esquí nórdico' },
    snow7: 'cm de nieve prevista en la cima en 7 días',
    noSnow7: 'Sin nieve prevista en 7 días',
    best: 'Mejor día para esquiar',
    none: 'Ningún día bueno para esquiar esta semana',
    why: {
      wind3: 'viento muy fuerte arriba', wind2: 'viento fuerte arriba', wind1: 'algo de viento arriba', calm: 'poco viento',
      storm: 'temporal de nieve', snowing: 'nevada', rain: 'lluvia en la base', rainTop: 'lluvia hasta arriba', cloud: 'cielo cubierto', fog: 'niebla', sun: 'sol',
      cold2: 'mucho frío arriba', cold1: 'frío arriba', hot: 'demasiado calor para la nieve', warm: 'nieve húmeda por la tarde',
      fresh2: 'mucha nieve nueva', fresh1: 'nieve nueva',
    },
  },
};
const tx = (lang) => TXT[lang === 'es' ? 'es' : 'ca'];

// Valoració del temps per esquiar d'un dia (i: índex del dia a les dades, amb els dies anteriors inclosos)
export function rateDay(top, base, i) {
  const T = top.days[i];
  const B = base?.days[i] ?? T;
  if (!T) return null;
  let s = 100;
  const bad = [];
  const good = [];
  const g = T.gust ?? 0;
  if (g >= 90) { s -= 60; bad.push('wind3'); }
  else if (g >= 70) { s -= 35; bad.push('wind2'); }
  else if (g >= 50) { s -= 12; bad.push('wind1'); }
  else if (g < 30) good.push('calm');
  const p = T.precip ?? 0;
  const rainAtBase = (B.precip ?? 0) >= 1 && (B.min ?? 0) > 1;
  // Pluja fins a dalt: hi cau aigua però gairebé no neu (cm de neu molt per sota dels mm de precipitació)
  const rainAtTop = p >= 1 && (T.snow ?? 0) < p * 0.4;
  if (rainAtTop) { s -= 35; bad.push('rainTop'); }
  else if (rainAtBase) { s -= 25; bad.push('rain'); }
  if (p >= 10) { s -= 40; if (!rainAtTop) bad.push('storm'); }
  else if (p >= 3) { s -= 20; if (!rainAtBase && !rainAtTop) bad.push('snowing'); }
  else if (p >= 0.5) s -= 6;
  if (T.code === 45 || T.code === 48) { s -= 30; bad.push('fog'); }
  else if (T.sun != null) {
    if (T.sun < 3) { s -= 15; if (p < 3) bad.push('cloud'); }
    else if (T.sun < 6) s -= 5;
    else good.unshift('sun');
  } else if (T.code === 3) { s -= 12; bad.push('cloud'); }
  else if (T.code != null && T.code <= 1) good.unshift('sun');
  if (T.feels != null && T.feels <= -20) { s -= 20; bad.push('cold2'); }
  else if (T.feels != null && T.feels <= -14) { s -= 8; bad.push('cold1'); }
  if ((B.max ?? 0) >= 16) { s -= 30; bad.push('hot'); }
  else if ((B.max ?? 0) >= 12) { s -= 10; bad.push('warm'); }
  const prev = (top.days[i - 1]?.snow ?? 0) + (top.days[i - 2]?.snow ?? 0);
  if (p < 2 && prev >= 25) { s += 15; good.unshift('fresh2'); }
  else if (p < 2 && prev >= 10) { s += 10; good.unshift('fresh1'); }
  s = Math.max(0, Math.min(100, s));
  const level = s >= 75 ? 4 : s >= 55 ? 3 : s >= 35 ? 2 : 1;
  return { score: s, level, why: level >= 3 ? good.slice(0, 2) : bad.slice(0, 2) };
}

// Agrupa les dades per estació: cada estació té dos punts (part alta i base), en aquest ordre
export function groupSki(data, resorts) {
  if (!data?.length) return null;
  let k = 0;
  return resorts.map((r) => {
    const n = r.points.length;
    const g = { resort: r, top: data[k], base: data[k + n - 1] };
    k += n;
    return g;
  });
}

export const skiPoints = (resorts) => resorts.flatMap((r) => r.points);

export async function fetchSki(resorts, ms = 8000) {
  const data = await fetchMountain(skiPoints(resorts), SKI_DAYS, ms, SKI_PAST);
  return groupSki(data, resorts);
}

// Índex del primer dia que no és anterior a avui
const firstIndex = (days, today) => {
  const i = days.findIndex((d) => d.date >= today);
  return i < 0 ? 0 : i;
};

const dayLabel = (iso, k, lang) => (k === 0 ? tx(lang).today : k === 1 ? tx(lang).tomorrow : `${cap(dayShort(iso, lang))} ${parseDay(iso).getUTCDate()}`);

// Resum per estació: neu prevista en 7 dies i millor dia
export function skiSummary(g, today, lang = 'ca') {
  const days = g.top?.days ?? [];
  const i0 = firstIndex(days, today);
  const idx = days.map((_, i) => i).filter((i) => i >= i0).slice(0, SKI_DAYS);
  const snow = idx.reduce((a, i) => a + Math.max(0, days[i].snow ?? 0), 0);
  const rated = idx.map((i) => ({ i, r: rateDay(g.top, g.base, i) })).filter((x) => x.r);
  const best = rated.reduce((a, b) => (!a || b.r.score > a.r.score ? b : a), null);
  return { idx, snow, rated, best: best && best.r.level >= 3 ? { ...best, date: days[best.i].date } : null };
}

// Targetes de l'estació: capçalera, millor dia i taula de 7 dies
export function skiCardsHTML(groups, { today, lang = 'ca', season = true, base = '/temps/' }) {
  if (!groups?.length || !groups[0].top?.days?.length) return '';
  const L = tx(lang);
  return groups
    .map((g) => {
      const r = g.resort;
      const days = g.top.days;
      const { idx, snow, rated, best } = skiSummary(g, today, lang);
      const alts = `${thousands(r.points[r.points.length - 1].alt)}–${thousands(r.points[0].alt)} m`;
      const cell = (f) => idx.map((i, k) => `<td>${f(days[i], g.base?.days[i], i, k)}</td>`).join('');
      const head = `<tr><th></th>${idx.map((i, k) => `<th>${dayLabel(days[i].date, k, lang)}</th>`).join('')}</tr>`;
      const rateRow = season
        ? `<tr class="ski__rate"><th>${L.rows.rate}</th>${rated.map(({ r: x }) => `<td><span class="rt rt--${x.level}" title="${L.levels[x.level]}${x.why.length ? ` · ${x.why.map((w) => L.why[w]).join(', ')}` : ''}"></span><small>${L.levels[x.level]}</small></td>`).join('')}</tr>`
        : '';
      const sky = cell((d) => (d.code == null ? '—' : `<img src="${iconUrl(wmoIcon(d.code, true))}" alt="${wmoText(d.code, lang)}" title="${wmoText(d.code, lang)}" width="40" height="40" loading="lazy">`));
      const snowRow = cell((d) => (d.snow != null && d.snow >= 0.5 ? `<b class="ski__cm">${num(d.snow, 0)} cm</b>` : '<span class="ski__no">—</span>'));
      const tTop = cell((d) => `${num(d.min, 0)}° / ${num(d.max, 0)}°`);
      const tBase = cell((d, b) => (b ? `${num(b.min, 0)}° / ${num(b.max, 0)}°` : '—'));
      const gust = cell((d) => (d.gust == null ? '—' : `<span class="${d.gust >= 70 ? 'ski__hi' : ''}">${Math.round(d.gust)}</span> <small>km/h</small>`));
      const frz = cell((d) => (d.frz ? `${thousands(Math.round((d.frz.min + d.frz.max) / 200) * 100)} m` : '—'));
      const bestLine = season
        ? best
          ? `<p class="ski__best"><span class="rt rt--${best.r.level}"></span>${L.best}: <b>${best.i === idx[0] ? L.today.toLowerCase() : best.i === idx[1] ? L.tomorrow.toLowerCase() : `${dayName(best.date, lang)} ${parseDay(best.date).getUTCDate()}`}</b>${best.r.why.length ? ` · ${best.r.why.map((w) => L.why[w]).join(', ')}` : ''}</p>`
          : `<p class="ski__best ski__best--none">${L.none}</p>`
        : '';
      return `<article class="ski ski--${r.ski.type}">
<div class="ski__head">
  <div><span class="ski__k">${L.type[r.ski.type]} · ${r.ski.region}</span><h3><a href="${base}${r.slug}">${r.name}</a></h3><span class="ski__alt">${alts}</span></div>
  <div class="ski__snow">${snow >= 1 ? `<b>${num(snow, 0)}</b><span>${L.snow7}</span>` : `<span>${L.noSnow7}</span>`}</div>
</div>
${bestLine}
<div class="tscroll"><table class="ski__t"><thead>${head}</thead><tbody>
${rateRow}
<tr class="ski__sky"><th>${L.rows.sky}</th>${sky}</tr>
<tr><th>${L.rows.snow}</th>${snowRow}</tr>
<tr><th>${L.rows.top}</th>${tTop}</tr>
<tr><th>${L.rows.base}</th>${tBase}</tr>
<tr><th>${L.rows.gust}</th>${gust}</tr>
<tr><th>${L.rows.frz}</th>${frz}</tr>
</tbody></table></div>
</article>`;
    })
    .join('');
}

// ------------------------------------------------------------------ vistes gràfiques

const frzMid = (d) => (d?.frz ? Math.round((d.frz.min + d.frz.max) / 200) * 100 : null);
const dayWord = (days, best, idx, lang) => (best.i === idx[0] ? tx(lang).today.toLowerCase() : best.i === idx[1] ? tx(lang).tomorrow.toLowerCase() : `${dayName(best.date, lang)} ${parseDay(best.date).getUTCDate()}`);

// On queda la isoterma respecte de les pistes
function frzWhere(f, base, top, lang) {
  const es = lang === 'es';
  if (f == null) return '';
  if (f <= base) return es ? 'por debajo de las pistas' : 'per sota de les pistes';
  if (f >= top) return es ? 'por encima de la cima' : 'per sobre del cim';
  return es ? 'a media estación' : "a mitja estació";
}

// Esquema de l'estació, de la base al cim, amb la isoterma de 0 °C del dia (per sobre, zona de neu)
export function skiProfileSVG(id, base, top, frz, lang = 'ca', w = 78, h = 94) {
  const f = frz ? (frz.min + frz.max) / 2 : null;
  const lo = Math.min(base, f ?? base) - 250;
  const hi = Math.max(top, f ?? top) + 250;
  const y = (a) => +(h - 4 - ((a - lo) / (hi - lo)) * (h - 8)).toFixed(1);
  const yb = y(base), yt = y(top);
  const m = `M3 ${yb} L${(w * 0.44).toFixed(1)} ${yt} L${(w * 0.6).toFixed(1)} ${(yt + (yb - yt) * 0.22).toFixed(1)} L${w - 3} ${yb} Z`;
  const yf = f != null ? Math.max(0, Math.min(h, y(f))) : null;
  const label = f != null
    ? `${lang === 'es' ? 'Isoterma de 0 °C' : 'Isoterma de 0 °C'}: ${thousands(Math.round(f / 100) * 100)} m · ${lang === 'es' ? 'pistas' : 'pistes'} ${thousands(base)}–${thousands(top)} m`
    : `${lang === 'es' ? 'Pistas' : 'Pistes'} ${thousands(base)}–${thousands(top)} m`;
  return `<svg class="skp" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}"><title>${label}</title><defs><clipPath id="skp-${id}"><path d="${m}"/></clipPath></defs><path d="${m}" fill="#d6dde6"/>${yf != null ? `<rect x="0" y="0" width="${w}" height="${yf}" fill="#dff1ff" clip-path="url(#skp-${id})"/>` : ''}<path d="${m}" fill="none" stroke="#5b6b7e" stroke-width="1.3" stroke-linejoin="round"/>${yf != null ? `<line x1="0" x2="${w}" y1="${yf}" y2="${yf}" stroke="#ea580c" stroke-width="1.8" stroke-dasharray="4 3"/>` : ''}</svg>`;
}

// Targeta d'una estació (portada, zones i tauler): neu prevista, millor dia, barres de neu de 7 dies,
// esquema de l'estació amb la isoterma d'avui i temps a dalt. La taula completa és a la pàgina de l'estació.
export function skiCompactHTML(groups, { today, lang = 'ca', season = true, base = '/temps/' }) {
  if (!groups?.length || !groups[0].top?.days?.length) return '';
  const L = tx(lang);
  const es = lang === 'es';
  return groups
    .map((g) => {
      const r = g.resort;
      const days = g.top.days;
      const { idx, snow, rated, best } = skiSummary(g, today, lang);
      const bAlt = r.points[r.points.length - 1].alt, tAlt = r.points[0].alt;
      const rate = Object.fromEntries(rated.map((x) => [x.i, x.r]));
      const maxCm = Math.max(12, ...idx.map((i) => days[i].snow ?? 0));
      const t0 = days[idx[0]];
      const f0 = frzMid(t0);
      const bars = idx
        .map((i, k) => {
          const d = days[i];
          const cm = d.snow ?? 0;
          const hgt = cm >= 0.5 ? Math.max(8, Math.round((cm / maxCm) * 100)) : 0;
          const rt = season && rate[i] ? `<span class="rt rt--${rate[i].level}" title="${L.levels[rate[i].level]}"></span>` : '';
          const ic = d.code == null ? '' : `<img src="${iconUrl(wmoIcon(d.code, true))}" alt="${wmoText(d.code, lang)}" title="${wmoText(d.code, lang)}" width="28" height="28" loading="lazy">`;
          return `<li><span class="skc__d">${k === 0 ? L.today : cap(dayShort(d.date, lang))}</span>${ic}<span class="skc__bar">${hgt ? `<b>${num(cm, 0)}</b><i style="height:${hgt}%"></i>` : '<em></em>'}</span>${rt}</li>`;
        })
        .join('');
      const kpi2 = season
        ? best
          ? `<div><span class="skc__kl">${L.best}</span><b class="skc__kb"><span class="rt rt--${best.r.level}"></span>${cap(dayWord(days, best, idx, lang))}</b></div>`
          : `<div><span class="skc__kl">${L.best}</span><b class="skc__kb skc__kb--no">${es ? 'Ninguno bueno' : 'Cap de bo'}</b></div>`
        : `<div><span class="skc__kl">${es ? 'Hoy arriba' : 'Avui a dalt'}</span><b class="skc__kb">${num(t0?.min, 0)}° / ${num(t0?.max, 0)}°</b></div>`;
      const now = t0
        ? `${season ? `${es ? 'Hoy arriba' : 'Avui a dalt'}: <b>${num(t0.min, 0)}° / ${num(t0.max, 0)}°</b> · ` : ''}${es ? 'racha' : 'ratxa'} <b${t0.gust >= 70 ? ' class="ski__hi"' : ''}>${Math.round(t0.gust ?? 0)} km/h</b>${f0 != null ? ` · 0 °C ${es ? 'a' : 'a'} <b>${thousands(f0)} m</b>` : ''}`
        : '';
      return `<article class="skc skc--${r.ski.type}">
<a class="skc__a" href="${base}${r.slug}">
<div class="skc__head"><div><span class="ski__k">${L.type[r.ski.type]} · ${r.ski.region}</span><h3>${r.name}</h3><span class="ski__alt">${thousands(bAlt)}–${thousands(tAlt)} m</span></div>
<div class="skc__prof">${skiProfileSVG(r.slug, bAlt, tAlt, t0?.frz, lang)}${f0 != null ? `<span>${frzWhere(f0, bAlt, tAlt, lang)}</span>` : ''}</div></div>
<div class="skc__kpi"><div><span class="skc__kl">${es ? 'Nieve en 7 días' : 'Neu en 7 dies'}</span><b class="skc__kb skc__kb--snow">${num(snow, 0)} <small>cm</small></b></div>${kpi2}</div>
<ol class="skc__bars" aria-label="${es ? 'Nieve nueva prevista arriba cada día, en cm' : 'Neu nova prevista a dalt cada dia, en cm'}">${bars}</ol>
<p class="skc__now">${now}</p>
<span class="skc__more">${es ? 'Previsión completa' : 'Previsió completa'} →</span>
</a>
</article>`;
    })
    .join('');
}

// Xifres clau a dalt de la pàgina d'una estació
export function skiHeadHTML(g, { today, lang = 'ca', season = true }) {
  if (!g?.top?.days?.length) return '';
  const L = tx(lang);
  const es = lang === 'es';
  const r = g.resort;
  const days = g.top.days;
  const { idx, snow, best } = skiSummary(g, today, lang);
  const bAlt = r.points[r.points.length - 1].alt, tAlt = r.points[0].alt;
  const t0 = days[idx[0]];
  const f0 = frzMid(t0);
  const most = idx.reduce((a, i) => ((days[i].snow ?? 0) > (days[a]?.snow ?? 0) ? i : a), idx[0]);
  const mostTxt = (days[most]?.snow ?? 0) >= 1 ? `${es ? 'el día que más' : 'el dia que més'}: ${most === idx[0] ? L.today.toLowerCase() : most === idx[1] ? L.tomorrow.toLowerCase() : dayName(days[most].date, lang)} (${num(days[most].snow, 0)} cm)` : es ? 'sin nevadas a la vista' : 'sense nevades a la vista';
  const tiles = [
    [es ? 'Nieve nueva en 7 días' : 'Neu nova en 7 dies', `${num(snow, 0)} <small>cm</small>`, mostTxt, 'snow'],
    season
      ? [L.best, best ? `<span class="rt rt--${best.r.level}"></span>${cap(dayWord(days, best, idx, lang))}` : es ? 'Ninguno' : 'Cap', best ? `${L.levels[best.r.level]}${best.r.why.length ? ` · ${best.r.why.map((w) => L.why[w]).join(', ')}` : ''}` : L.none, '']
      : [L.best, es ? 'Fuera de temporada' : 'Fora de temporada', es ? 'La valoración se muestra del 15 de noviembre al 30 de abril' : "La valoració es mostra del 15 de novembre al 30 d'abril", 'off'],
    [es ? 'Hoy en la cima' : 'Avui al cim', t0 ? `${num(t0.min, 0)}° / ${num(t0.max, 0)}°` : '—', t0?.gust != null ? `${es ? 'racha' : 'ratxa'} de ${Math.round(t0.gust)} km/h` : '', ''],
    [es ? 'Isoterma de 0 °C hoy' : 'Isoterma de 0 °C avui', f0 != null ? `${thousands(f0)} <small>m</small>` : '—', f0 != null ? frzWhere(f0, bAlt, tAlt, lang) : '', 'frz'],
  ];
  return `<div class="skh">${tiles.map(([k, v, s, c]) => `<div class="skh__t${c ? ` skh__t--${c}` : ''}"><span class="skh__k">${k}</span><b class="skh__v">${v}</b><span class="skh__s">${s}</span></div>`).join('')}</div>`;
}

// Gràfic de 7 dies d'una estació: franja de les pistes, isoterma de 0 °C (mínim i màxim del dia) i neu nova al cim
export function skiChartSVG(g, { today, lang = 'ca', season = true }) {
  if (!g?.top?.days?.length) return '';
  const L = tx(lang);
  const es = lang === 'es';
  const r = g.resort;
  const days = g.top.days;
  const { idx, rated } = skiSummary(g, today, lang);
  const rate = Object.fromEntries(rated.map((x) => [x.i, x.r]));
  const bAlt = r.points[r.points.length - 1].alt, tAlt = r.points[0].alt;
  const W = 760, X0 = 70, X1 = W - 14, TOP = 50, BOT = 222, S0 = 250, S1 = 318, DAY = 342, H = season ? 370 : 356;
  const n = idx.length;
  const cw = (X1 - X0) / n;
  const cx = (k) => X0 + cw * (k + 0.5);
  const fr = idx.map((i) => days[i].frz).filter(Boolean);
  const lo = Math.max(0, Math.floor((Math.min(bAlt, ...fr.map((f) => f.min)) - 250) / 250) * 250);
  const hi = Math.ceil((Math.max(tAlt, ...fr.map((f) => f.max)) + 250) / 250) * 250;
  const y = (a) => +(BOT - ((a - lo) / (hi - lo)) * (BOT - TOP)).toFixed(1);
  const step = hi - lo > 2500 ? 1000 : 500;
  const ticks = [];
  for (let a = Math.ceil(lo / step) * step; a <= hi; a += step) ticks.push(a);
  const maxCm = Math.max(10, ...idx.map((i) => days[i].snow ?? 0));
  const out = [];
  out.push(`<svg class="skchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${es ? 'Nieve nueva e isoterma de 0 °C respecto a las pistas, día a día' : 'Neu nova i isoterma de 0 °C respecte de les pistes, dia a dia'}">`);
  // eix d'altitud
  ticks.forEach((a) => out.push(`<line x1="${X0}" x2="${X1}" y1="${y(a)}" y2="${y(a)}" stroke="#e3e9f0"/><text x="${X0 - 8}" y="${y(a) + 4}" text-anchor="end" class="skchart__ax">${thousands(a)} m</text>`));
  // franja de les pistes
  out.push(`<rect x="${X0}" y="${y(tAlt)}" width="${X1 - X0}" height="${(y(bAlt) - y(tAlt)).toFixed(1)}" fill="#dff1ff"/>`);
  out.push(`<line x1="${X0}" x2="${X1}" y1="${y(tAlt)}" y2="${y(tAlt)}" stroke="#7cc4ec" stroke-dasharray="5 4"/><line x1="${X0}" x2="${X1}" y1="${y(bAlt)}" y2="${y(bAlt)}" stroke="#7cc4ec" stroke-dasharray="5 4"/>`);
  out.push(`<text x="${X0 + 8}" y="${y(tAlt) + 15}" class="skchart__band">${es ? 'Cima' : 'Cim'} · ${thousands(tAlt)} m</text><text x="${X0 + 8}" y="${y(bAlt) - 7}" class="skchart__band">Base · ${thousands(bAlt)} m</text>`);
  // isoterma: rang del dia i línia pel mig
  const pts = [];
  idx.forEach((i, k) => {
    const f = days[i].frz;
    if (!f) return;
    const m = (f.min + f.max) / 2;
    pts.push([cx(k), y(m)]);
    if (f.max > f.min) out.push(`<line x1="${cx(k)}" x2="${cx(k)}" y1="${y(f.max)}" y2="${y(f.min)}" stroke="#fdba74" stroke-width="10" stroke-linecap="round"/>`);
  });
  if (pts.length > 1) out.push(`<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#ea580c" stroke-width="2.5" stroke-linejoin="round"/>`);
  idx.forEach((i, k) => {
    const f = days[i].frz;
    if (!f) return;
    const m = (f.min + f.max) / 2;
    out.push(`<circle cx="${cx(k)}" cy="${y(m)}" r="4.5" fill="#fff" stroke="#ea580c" stroke-width="2.5"/><text x="${cx(k)}" y="${y(m) - 11}" text-anchor="middle" class="skchart__frz">${thousands(Math.round(m / 100) * 100)}</text>`);
  });
  // icones del cel
  idx.forEach((i, k) => {
    const d = days[i];
    if (d.code != null) out.push(`<image href="${iconUrl(wmoIcon(d.code, true))}" x="${cx(k) - 17}" y="4" width="34" height="34"><title>${wmoText(d.code, lang)}</title></image>`);
  });
  // neu nova al cim
  out.push(`<line x1="${X0}" x2="${X1}" y1="${S1}" y2="${S1}" stroke="#c9d5e3"/><text x="${X0 - 8}" y="${S1 - 22}" text-anchor="end" class="skchart__ax">${es ? 'Nieve' : 'Neu'}</text><text x="${X0 - 8}" y="${S1 - 8}" text-anchor="end" class="skchart__ax">cm</text>`);
  idx.forEach((i, k) => {
    const cm = days[i].snow ?? 0;
    if (cm >= 0.5) {
      const hgt = Math.max(4, (cm / maxCm) * (S1 - S0 - 16));
      out.push(`<rect x="${cx(k) - 16}" y="${(S1 - hgt).toFixed(1)}" width="32" height="${hgt.toFixed(1)}" rx="4" fill="#2563eb"/><text x="${cx(k)}" y="${(S1 - hgt - 6).toFixed(1)}" text-anchor="middle" class="skchart__cm">${num(cm, 0)}</text>`);
    } else out.push(`<text x="${cx(k)}" y="${S1 - 6}" text-anchor="middle" class="skchart__none">—</text>`);
  });
  // dies i valoració
  idx.forEach((i, k) => {
    const d = days[i];
    const lab = k === 0 ? L.today : k === 1 ? L.tomorrow : `${cap(dayShort(d.date, lang))} ${parseDay(d.date).getUTCDate()}`;
    out.push(`<text x="${cx(k)}" y="${DAY}" text-anchor="middle" class="skchart__day">${lab}</text>`);
    if (season && rate[i]) {
      const c = { 4: '#1f9d55', 3: '#8bc34a', 2: '#e0a100', 1: '#c62828' }[rate[i].level];
      out.push(`<circle cx="${cx(k)}" cy="${DAY + 14}" r="5.5" fill="${c}"><title>${L.levels[rate[i].level]}</title></circle>`);
    }
  });
  out.push('</svg>');
  const legend = `<div class="skchart__lg"><span><i class="lg-band"></i>${es ? 'Pistas' : 'Pistes'} (${thousands(bAlt)}–${thousands(tAlt)} m)</span><span><i class="lg-frz"></i>${es ? 'Isoterma de 0 °C: por encima nieva, por debajo puede llover' : "Isoterma de 0 °C: per sobre neva, per sota pot ploure"}</span><span><i class="lg-snow"></i>${es ? 'Nieve nueva en la cima' : 'Neu nova al cim'}</span>${season ? `<span><i class="rt rt--4"></i>${es ? 'Día para esquiar' : 'Dia per esquiar'}</span>` : ''}</div>`;
  return `<div class="skchart__w">${out.join('')}</div>${legend}`;
}

// Frase per al text de la pàgina (es genera al build): on nevarà més
export function skiSnowText(groups, today, lang = 'ca') {
  if (!groups?.length || !groups[0].top?.days?.length) return '';
  const es = lang === 'es';
  const list = groups
    .map((g) => ({ name: g.resort.name, s: skiSummary(g, today, lang).snow }))
    .filter((x) => x.s >= 1)
    .sort((a, b) => b.s - a.s);
  if (!list.length) return es ? 'No se prevé nieve en ninguna de las estaciones durante los próximos 7 días.' : "No es preveu neu a cap de les estacions els pròxims 7 dies.";
  const items = list.map((x) => `${x.name} (${num(x.s, 0)} cm)`);
  const joined = items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} ${es ? 'y' : 'i'} ${items[items.length - 1]}`;
  return es
    ? `Nieve prevista en la parte alta de las pistas durante los próximos 7 días: ${joined}.`
    : `Neu prevista a la part alta de les pistes els pròxims 7 dies: ${joined}.`;
}

// ------------------------------------------------------------------ tauler de la setmana (totes les estacions × 7 dies)

// Com serà el dia en una estació, en paraules. La cota de neu és uns 300 m per sota de la isoterma de 0 °C.
// kind: snow (neva a tota l'estació) · snowtop (neu a dalt, pluja a baix) · rain · wind (sec i vent fort a dalt) ·
// sun · part (sol i núvols) · cloud · fog
export function dayVerdict(g, i) {
  const T = g.top?.days?.[i];
  if (!T) return null;
  const B = g.base?.days?.[i] ?? T;
  const pts = g.resort.points;
  const bAlt = pts[pts.length - 1].alt, tAlt = pts[0].alt;
  const cm = Math.max(0, T.snow ?? 0);
  const p = Math.max(T.precip ?? 0, B.precip ?? 0);
  const frz = T.frz ? (T.frz.min + T.frz.max) / 2 : null;
  const line = frz != null ? Math.max(0, Math.round((frz - 300) / 100) * 100) : null;
  const windy = (T.gust ?? 0) >= 70;
  let kind;
  if (cm >= 1) kind = line != null && line > bAlt + 100 ? 'snowtop' : 'snow';
  else if (p >= 1) kind = 'rain';
  else if (windy) kind = 'wind';
  else if (T.code === 45 || T.code === 48) kind = 'fog';
  else if ((T.sun != null && T.sun >= 6) || (T.sun == null && T.code != null && T.code <= 1)) kind = 'sun';
  else if ((T.sun != null && T.sun >= 3) || (T.sun == null && T.code === 2)) kind = 'part';
  else kind = 'cloud';
  return { kind, cm, line, windy, bAlt, tAlt, T, B };
}

const BOARD = {
  ca: {
    main: { rain: 'Pluja', wind: 'Vent', sun: 'Sol', part: 'Variable', cloud: 'Núvols', fog: 'Boira' },
    sub: { snow: "a tota l'estació", snowtop: 'a dalt; a baix, pluja', rain: 'fins a dalt', wind: 'fort a dalt' },
    legend: [['snow', 'Neva (cm a dalt)'], ['snowtop', 'Neu a dalt, pluja a baix'], ['rain', 'Pluja'], ['wind', 'Vent fort a dalt'], ['sun', 'Sol'], ['part', 'Sol i núvols'], ['cloud', 'Núvols o boira']],
    long: {
      snow: (v) => `Neva a tota l'estació: ${num(v.cm, 0)} cm a dalt${v.line != null ? ` (cota de neu a uns ${thousands(v.line)} m)` : ''}.`,
      snowtop: (v) => `Neu a dalt i pluja a baix: ${num(v.cm, 0)} cm al cim; la cota de neu, a uns ${thousands(v.line)} m, queda dins de l'estació.`,
      rain: (v) => `Pluja${v.line != null && v.line >= v.tAlt ? ' fins a dalt: la cota de neu és a uns ' + thousands(v.line) + ' m, per sobre del cim' : ''}.`,
      wind: (v) => `Sec, però amb vent fort a dalt: ratxes de ${Math.round(v.T.gust)} km/h.`,
      sun: () => 'Sol.', part: () => 'Sol i núvols.', cloud: () => 'Cel tapat.', fog: () => 'Boira.',
    },
    temps: (v) => `Al cim, ${num(v.T.min, 0)}° / ${num(v.T.max, 0)}°; a la base, ${num(v.B.min, 0)}° / ${num(v.B.max, 0)}°. Ratxa a dalt: ${Math.round(v.T.gust ?? 0)} km/h.`,
    windy: 'Vent fort a dalt.',
    windMark: 'I vent fort a dalt',
    rate: 'Per esquiar',
    total: '7 dies',
    title: 'Tauler de la setmana',
    tap: "Toca un dia per veure'n el detall.",
  },
  es: {
    main: { rain: 'Lluvia', wind: 'Viento', sun: 'Sol', part: 'Variable', cloud: 'Nubes', fog: 'Niebla' },
    sub: { snow: 'en toda la estación', snowtop: 'arriba; abajo, lluvia', rain: 'hasta arriba', wind: 'fuerte arriba' },
    legend: [['snow', 'Nieva (cm arriba)'], ['snowtop', 'Nieve arriba, lluvia abajo'], ['rain', 'Lluvia'], ['wind', 'Viento fuerte arriba'], ['sun', 'Sol'], ['part', 'Sol y nubes'], ['cloud', 'Nubes o niebla']],
    long: {
      snow: (v) => `Nieva en toda la estación: ${num(v.cm, 0)} cm arriba${v.line != null ? ` (cota de nieve a unos ${thousands(v.line)} m)` : ''}.`,
      snowtop: (v) => `Nieve arriba y lluvia abajo: ${num(v.cm, 0)} cm en la cima; la cota de nieve, a unos ${thousands(v.line)} m, queda dentro de la estación.`,
      rain: (v) => `Lluvia${v.line != null && v.line >= v.tAlt ? ' hasta arriba: la cota de nieve está a unos ' + thousands(v.line) + ' m, por encima de la cima' : ''}.`,
      wind: (v) => `Seco, pero con viento fuerte arriba: rachas de ${Math.round(v.T.gust)} km/h.`,
      sun: () => 'Sol.', part: () => 'Sol y nubes.', cloud: () => 'Cielo cubierto.', fog: () => 'Niebla.',
    },
    temps: (v) => `En la cima, ${num(v.T.min, 0)}° / ${num(v.T.max, 0)}°; en la base, ${num(v.B.min, 0)}° / ${num(v.B.max, 0)}°. Racha arriba: ${Math.round(v.T.gust ?? 0)} km/h.`,
    windy: 'Viento fuerte arriba.',
    windMark: 'Y viento fuerte arriba',
    rate: 'Para esquiar',
    total: '7 días',
    title: 'Panel de la semana',
    tap: 'Toca un día para ver el detalle.',
  },
};
const bx = (lang) => BOARD[lang === 'es' ? 'es' : 'ca'];
const escA = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Color de la neu prevista (el mateix que el mapa de neu): 1–9, 10–29 i 30 cm o més
export const snowBg = (cm) => (cm == null ? '#eef3f8' : cm >= 30 ? '#1d4ed8' : cm >= 10 ? '#60a5fa' : cm >= 1 ? '#bfdbfe' : '#ffffff');
export const snowFg = (cm) => (cm != null && cm >= 30 ? '#ffffff' : '#10233b');

// Text llarg d'un dia (detall del tauler)
export function verdictText(g, i, lang = 'ca', season = true) {
  const v = dayVerdict(g, i);
  if (!v) return '';
  const X = bx(lang);
  const parts = [X.long[v.kind](v)];
  if (v.windy && v.kind !== 'wind') parts.push(X.windy);
  parts.push(X.temps(v));
  if (season) {
    const r = rateDay(g.top, g.base, i);
    if (r) parts.push(`${X.rate}: ${tx(lang).levels[r.level].toLowerCase()}${r.why.length ? ` (${r.why.map((w) => tx(lang).why[w]).join(', ')})` : ''}.`);
  }
  return parts.join(' ');
}

// zones: [{ name, groups: [...] }] en l'ordre en què s'han de mostrar
export function skiBoardHTML(zones, { today, lang = 'ca', season = true, base = '/temps/' }) {
  const first = zones.flatMap((z) => z.groups).find((g) => g?.top?.days?.length);
  if (!first) return '';
  const X = bx(lang);
  const L = tx(lang);
  const days = first.top.days;
  const idx = skiSummary(first, today, lang).idx;
  const head = `<tr><th class="skb__n"></th>${idx.map((i, k) => `<th scope="col">${dayLabel(days[i].date, k, lang)}</th>`).join('')}<th scope="col" class="skb__tot">${X.total}</th></tr>`;
  const rows = zones
    .map((z) => {
      const rs = z.groups
        .filter((g) => g?.top?.days?.length)
        .map((g) => {
          const r = g.resort;
          const pts = r.points;
          const { idx: gi, snow } = skiSummary(g, today, lang);
          const cells = gi
            .map((i, k) => {
              const v = dayVerdict(g, i);
              if (!v) return '<td></td>';
              const isSnow = v.kind === 'snow' || v.kind === 'snowtop';
              const main = isSnow ? `${num(v.cm, 0)}<small> cm</small>` : X.main[v.kind];
              const sub = X.sub[v.kind] ?? `${num(v.T.min, 0)}° / ${num(v.T.max, 0)}°`;
              const style = isSnow ? ` style="--bg:${snowBg(v.cm)};--fg:${snowFg(v.cm)}"` : '';
              const rt = season ? rateDay(g.top, g.base, i) : null;
              const when = k === 0 ? L.today.toLowerCase() : k === 1 ? L.tomorrow.toLowerCase() : `${dayName(days[i].date, lang)} ${parseDay(days[i].date).getUTCDate()}`;
              const label = `${r.name}, ${when}: ${verdictText(g, i, lang, season)}`;
              return `<td><button type="button" class="skb__c skb__c--${v.kind}${v.windy && v.kind !== 'wind' ? ' is-windy' : ''}"${style} data-det="${escA(label)}" aria-label="${escA(label)}"><b>${main}</b><span>${sub}</span>${rt ? `<i class="rt rt--${rt.level}" aria-hidden="true"></i>` : ''}</button></td>`;
            })
            .join('');
          return `<tr><th scope="row" class="skb__n"><a href="${base}${r.slug}">${r.name}</a><small>${thousands(pts[pts.length - 1].alt)}–${thousands(pts[0].alt)} m</small></th>${cells}<td class="skb__tot"><b style="--bg:${snowBg(snow >= 1 ? snow : 0)};--fg:${snowFg(snow)}">${snow >= 1 ? `${num(snow, 0)}<small> cm</small>` : '—'}</b></td></tr>`;
        })
        .join('');
      return rs ? `<tr class="skb__z"><th colspan="${idx.length + 2}" scope="rowgroup"><span>${z.name}</span></th></tr>${rs}` : '';
    })
    .join('');
  const legend = X.legend.map(([k, t]) => `<span><i class="skb__sw skb__sw--${k}"></i>${t}</span>`).join('') + `<span><i class="skb__lg-wind"></i>${X.windMark}</span>`;
  const rate = season ? `<span class="skb__lr">${L.levels.slice(1).reverse().map((t, j) => `<span><i class="rt rt--${4 - j}"></i>${t}</span>`).join('')}</span>` : '';
  return `<div class="skb__lg">${legend}${rate}</div>
<div class="tscroll skb__w"><table class="skb"><thead>${head}</thead><tbody>${rows}</tbody></table></div>
<p class="skb__det" data-skb-det aria-live="polite">${X.tap}</p>`;
}

// Rànquing de neu prevista en 7 dies (de més a menys), amb els dies que més nevarà
export function skiRankHTML(groups, { today, lang = 'ca', base = '/temps/' }) {
  const es = lang === 'es';
  const list = (groups || [])
    .filter((g) => g?.top?.days?.length)
    .map((g) => {
      const s = skiSummary(g, today, lang);
      const top = s.idx.map((i, k) => ({ i, k, cm: g.top.days[i].snow ?? 0 })).filter((x) => x.cm >= 1).sort((a, b) => b.cm - a.cm).slice(0, 2).sort((a, b) => a.k - b.k);
      return { g, snow: s.snow, when: top.map((x) => dayLabel(g.top.days[x.i].date, x.k, lang).toLowerCase()) };
    })
    .sort((a, b) => b.snow - a.snow);
  if (!list.length) return '';
  const max = Math.max(10, list[0].snow);
  const withSnow = list.filter((x) => x.snow >= 1);
  if (!withSnow.length) return `<p class="skr__none">${es ? 'No se prevé nieve en ninguna estación durante los próximos 7 días.' : 'No es preveu neu a cap estació els pròxims 7 dies.'}</p>`;
  const and = es ? ' y ' : ' i ';
  return `<ol class="skr">${list
    .map((x) => `<li><a href="${base}${x.g.resort.slug}"><span class="skr__n">${x.g.resort.name}</span><span class="skr__b"><i style="width:${Math.max(x.snow >= 1 ? 3 : 0, (x.snow / max) * 100).toFixed(1)}%;--bg:${snowBg(x.snow >= 1 ? Math.max(x.snow, 1) : 0)}"></i></span><b>${x.snow >= 1 ? `${num(x.snow, 0)} cm` : '—'}</b><small>${x.when.length ? x.when.join(and) : ''}</small></a></li>`)
    .join('')}</ol>`;
}

// Resum de la setmana en paraules (capçalera de la pàgina): quan i on nevarà, fins on baixarà la neu, vent i millor dia
export function skiWeekText(groups, today, lang = 'ca', season = true) {
  const gs = (groups || []).filter((g) => g?.top?.days?.length);
  if (!gs.length) return '';
  const es = lang === 'es';
  const first = gs[0];
  const idx = skiSummary(first, today, lang).idx;
  const dayName2 = (k) => (k === 0 ? (es ? 'hoy' : 'avui') : k === 1 ? (es ? 'mañana' : 'demà') : dayName(first.top.days[idx[k]].date, lang));
  const per = idx.map((i, k) => {
    const vs = gs.map((g) => ({ g, v: dayVerdict(g, i) })).filter((x) => x.v);
    const snowy = vs.filter((x) => x.v.cm >= 1);
    const best = snowy.sort((a, b) => b.v.cm - a.v.cm)[0];
    const lines = vs.filter((x) => (x.v.T.precip ?? 0) >= 1 && x.v.line != null).map((x) => x.v.line);
    const windy = vs.filter((x) => x.v.windy).length;
    const good = season ? gs.filter((g) => (rateDay(g.top, g.base, i)?.level ?? 0) >= 3).length : 0;
    return { k, n: snowy.length, best, line: lines.length ? Math.min(...lines) : null, windy, good };
  });
  const out = [];
  const snowDays = per.filter((d) => d.n > 0);
  const list = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${es ? 'y' : 'i'} ${xs[xs.length - 1]}`);
  if (snowDays.length) {
    const top = [...snowDays].sort((a, b) => b.best.v.cm - a.best.v.cm)[0];
    const many = Math.max(...snowDays.map((d) => d.n));
    const where = many >= gs.length * 0.75 ? (es ? 'en casi todas las estaciones' : 'a gairebé totes les estacions') : es ? `en ${many} de las ${gs.length} estaciones` : `a ${many} de les ${gs.length} estacions`;
    out.push(es
      ? `Se prevé nieve ${list(snowDays.map((d) => dayName2(d.k)))}, ${where}. La nevada más fuerte, ${dayName2(top.k)}: hasta ${num(top.best.v.cm, 0)} cm en ${top.best.g.resort.name}.`
      : `Es preveu neu ${list(snowDays.map((d) => dayName2(d.k)))}, ${where}. La nevada més forta, ${dayName2(top.k)}: fins a ${num(top.best.v.cm, 0)} cm ${top.best.g.resort.a ?? `a ${top.best.g.resort.name}`}.`);
    const low = snowDays.map((d) => d.line).filter((x) => x != null);
    if (low.length) out.push(es ? `La cota de nieve bajará hasta unos ${thousands(Math.min(...low))} m.` : `La cota de neu baixarà fins a uns ${thousands(Math.min(...low))} m.`);
  } else {
    const frs = idx.map((i) => first.top.days[i].frz).filter(Boolean);
    out.push(es ? 'No se prevé nieve en ninguna estación durante los próximos 7 días.' : 'No es preveu neu a cap estació els pròxims 7 dies.');
    if (frs.length) out.push(es ? `La isoterma de 0 °C estará entre ${thousands(Math.min(...frs.map((f) => f.min)))} y ${thousands(Math.max(...frs.map((f) => f.max)))} m.` : `La isoterma de 0 °C serà entre ${thousands(Math.min(...frs.map((f) => f.min)))} i ${thousands(Math.max(...frs.map((f) => f.max)))} m.`);
  }
  const windDays = per.filter((d) => d.windy >= Math.max(2, gs.length * 0.3));
  if (windDays.length) out.push(es ? `Viento fuerte arriba ${list(windDays.map((d) => dayName2(d.k)))}.` : `Vent fort a dalt ${list(windDays.map((d) => dayName2(d.k)))}.`);
  if (season) {
    const b = [...per].sort((a, c) => c.good - a.good)[0];
    if (b && b.good > 0) out.push(es ? `${cap(dayName2(b.k))} es el día con buen tiempo para esquiar en más estaciones.` : `${cap(dayName2(b.k))} és el dia amb bon temps per esquiar a més estacions.`);
  }
  return out.join(' ');
}
