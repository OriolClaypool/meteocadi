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
      storm: 'temporal de neu', snowing: 'nevada', rain: 'pluja a la base', cloud: 'cel tapat', fog: 'boira', sun: 'sol',
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
      storm: 'temporal de nieve', snowing: 'nevada', rain: 'lluvia en la base', cloud: 'cielo cubierto', fog: 'niebla', sun: 'sol',
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
  if (rainAtBase) { s -= 25; bad.push('rain'); }
  if (p >= 10) { s -= 40; bad.push('storm'); }
  else if (p >= 3) { s -= 20; if (!rainAtBase) bad.push('snowing'); }
  else if (p >= 0.5) s -= 6;
  if (T.code === 45 || T.code === 48) { s -= 15; bad.push('fog'); }
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
  const snow = idx.reduce((a, i) => a + (days[i].snow ?? 0), 0);
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
