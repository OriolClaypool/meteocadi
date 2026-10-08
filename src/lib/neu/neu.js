// Meteocadí Neu (/neu): lògica i peces HTML compartides entre el build i el navegador.
// Previsió: /api/neu (totes les estacions, dia a dia, amb 5 dies enrere) i /api/neu/<estació> (hora a hora, avui i
// demà). Neu mesurada: /api/neu/mesurada (sensors de gruix de neu de la XEMA).
// Els grups tenen el format de ski.js ({ resort, top: { days }, base: { days } }) per reaprofitar-ne la valoració
// del dia (rateDay) i el tipus de dia (dayVerdict).
// season: fora de temporada (inSeason de ski.js) no es valora el dia d'esquí: les estacions són tancades.
import { rateDay, dayVerdict } from '../ski.js';
import { num, dayName, dayShort, parseDay, cap } from '../format.js';
import { wmoText } from '../wmo.js';

export const thousands = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r100 = (v) => Math.round(v / 100) * 100;
const cm0 = (v) => Math.max(0, Math.round(v ?? 0));
// "de 10 km/h", però "d'11 km/h" i "d'1 cm" (u i onze comencen amb vocal)
export const de = (n) => (Math.round(n) === 1 || Math.round(n) === 11 ? "d'" : 'de ');
// Unitats enganxades al número (que no quedin soles a la línia següent)
const u = (v, unit) => `${v}\u00A0${unit}`;
// "a les 9:40", però "a la 1:05"
export function aLes(iso) {
  const t = new Date(iso).toLocaleTimeString('ca-ES', { timeZone: 'Europe/Madrid', hour: 'numeric', minute: '2-digit' });
  return t.startsWith('1:') ? `a la ${t}` : `a les ${t}`;
}

// ------------------------------------------------------------------ escales i etiquetes

// Escala de la neu nova (cm), la mateixa a tot arreu: barres, taules i mapa
const SNOW = [[50, '#4B2FB0', '#FFFFFF'], [30, '#2156C9', '#FFFFFF'], [20, '#3B82E6', '#FFFFFF'], [10, '#6FAEF5', '#0E1C2F'], [5, '#A9D2FF', '#0E1C2F'], [1, '#D6EBFF', '#0E1C2F']];
// Gruix de neu a terra (cm): els mateixos colors, amb llindars més alts
const DEPTH = [[150, '#4B2FB0', '#FFFFFF'], [100, '#2156C9', '#FFFFFF'], [50, '#3B82E6', '#FFFFFF'], [20, '#6FAEF5', '#0E1C2F'], [5, '#A9D2FF', '#0E1C2F'], [1, '#D6EBFF', '#0E1C2F']];
const fillOf = (S) => (cm) => (cm == null ? null : S.find(([v]) => cm >= v)?.[1] ?? null);
const inkOf = (S) => (cm) => (cm == null ? '#0E1C2F' : S.find(([v]) => cm >= v)?.[2] ?? '#0E1C2F');
export const snowFill = fillOf(SNOW);
export const snowInk = inkOf(SNOW);
export const depthFill = fillOf(DEPTH);
export const depthInk = inkOf(DEPTH);
export const SNOW_LEGEND = [1, 5, 10, 20, 30, 50].map((v) => ({ v, c: snowFill(v) }));

// Llegenda de l'escala (neu nova o gruix)
export function scaleHTML(kind = 'snow') {
  const S = [...(kind === 'depth' ? DEPTH : SNOW)].reverse();
  return `<div class="nv-scale" aria-hidden="true"><b>cm</b>${S.map(([v, c], j) => `<span><i style="background:${c}"></i>${v}${j === S.length - 1 ? '+' : ''}</span>`).join('')}</div>`;
}

// Dia d'esquí (rateDay de ski.js: 4 molt bo … 1 dolent)
export const LEVEL = { 4: ['Molt bo', 'mb'], 3: ['Bo', 'b'], 2: ['Regular', 'r'], 1: ['Dolent', 'd'] };
export const pill = (level, extra = '') => (LEVEL[level] ? `<span class="nv-pill nv-pill--${LEVEL[level][1]}${extra}"><i></i>${LEVEL[level][0]}</span>` : '');

export const dayLabel = (iso, k) => (k === 0 ? 'Avui' : k === 1 ? 'Demà' : cap(dayName(iso)));
export const dayWord = (iso, k) => (k === 0 ? 'avui' : k === 1 ? 'demà' : dayName(iso));
const list = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} i ${xs[xs.length - 1]}`);

// Direcció del vent, com a la resta del web (mountain.js): "de nord-oest", "d'oest"
const DIR8 = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-oest', 'oest', 'nord-oest'];
export function dirFrom(deg) {
  if (deg == null || isNaN(deg)) return '';
  const n = DIR8[Math.round(deg / 45) % 8];
  return /^[aeiou]/.test(n) ? `d'${n}` : `de ${n}`;
}

// Icones (traç, com les de la resta del web)
const P = {
  flake: '<path d="M2 12h20M12 2v20M20 16l-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  wind: '<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>',
  snow: '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01"/>',
  rain: '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6M8 14v6M12 16v6"/>',
  fog: '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 17H7M17 21H9"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  part: '<path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
  ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  cam: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
};
export const icon = (name, size = 20, cls = '') =>
  `<svg class="nv-ic${cls ? ` ${cls}` : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? ''}</svg>`;
// Tipus de dia (dayVerdict) → icona i color
const KIND_ICON = { snow: ['snow', ''], snowtop: ['snow', ''], rain: ['rain', 'is-rain'], wind: ['wind', ''], sun: ['sun', 'is-sun'], part: ['part', ''], cloud: ['cloud', ''], fog: ['fog', ''] };
export const kindIcon = (kind, size = 20) => (KIND_ICON[kind] ? icon(KIND_ICON[kind][0], size, KIND_ICON[kind][1]) : '');
const KIND_TEXT = { snow: 'Neu', snowtop: 'Neu a dalt i pluja a baix', rain: 'Pluja', wind: 'Vent fort a dalt', sun: 'Sol', part: 'Sol i núvols', cloud: 'Núvols', fog: 'Boira' };
// Codi WMO de l'hora → icona
export function codeIcon(code, size = 24) {
  if (code == null) return '';
  const k = code <= 1 ? 'sun' : code === 2 ? 'part' : code === 3 ? 'cloud' : code === 45 || code === 48 ? 'fog'
    : (code >= 71 && code <= 77) || code === 85 || code === 86 ? 'snow' : 'rain';
  return kindIcon(k, size);
}

// ------------------------------------------------------------------ dades

// fc: resposta de /api/neu; resorts: llista lleugera (estacions.js, lleugera)
export function groupsOf(resorts, fc) {
  if (!fc?.resorts) return null;
  const out = resorts
    .map((r) => {
      const x = fc.resorts[r.slug];
      return x?.top?.length ? { resort: r, top: { days: x.top }, base: { days: x.base?.length ? x.base : x.top } } : null;
    })
    .filter(Boolean);
  return out.length ? out : null;
}

export const todayIdx = (days, today) => {
  const i = (days ?? []).findIndex((d) => d.date >= today);
  return i < 0 ? 0 : i;
};
export const snowSum = (days, from, n) => (days ?? []).slice(Math.max(0, from), Math.max(0, from + n)).reduce((a, d) => a + Math.max(0, d?.snow ?? 0), 0);
const frzOf = (d) => (d?.frz ? (d.frz.min + d.frz.max) / 2 : null);
// Cota de neu: uns 300 m per sota de la isoterma de 0 °C (com a ski.js)
const lineOf = (d) => (frzOf(d) == null ? null : Math.max(0, r100(frzOf(d) - 300)));

// Millor dia per esquiar dels 7 propers: el que té més estacions amb un dia bo o molt bo i, aquell dia, la millor
export function bestDay(groups, today) {
  if (!groups?.length) return null;
  const days0 = groups[0].top.days;
  const i0 = todayIdx(days0, today);
  let best = null;
  for (let k = 0; k < 7; k++) {
    const i = i0 + k;
    if (!days0[i]) break;
    const rs = groups.map((g) => ({ g, r: rateDay(g.top, g.base, i) })).filter((x) => x.r);
    if (!rs.length) continue;
    const good = rs.filter((x) => x.r.level >= 3).length;
    rs.sort((a, b) => b.r.score - a.r.score || snowSum(b.g.top.days, i - 2, 2) - snowSum(a.g.top.days, i - 2, 2));
    const top = rs[0];
    const score = good * 100 + top.r.score;
    if (!best || score > best.score) best = { k, i, date: days0[i].date, g: top.g, r: top.r, same: rs.filter((x) => x.r.level === top.r.level).length, score };
  }
  return best && best.r.level >= 3 ? best : null;
}

// On nevarà més en n dies (a partir d'avui, al cim)
export function mostSnow(groups, today, n = 3) {
  if (!groups?.length) return null;
  const i0 = todayIdx(groups[0].top.days, today);
  const all = groups.map((g) => ({ g, cm: snowSum(g.top.days, i0, n) })).sort((a, b) => b.cm - a.cm);
  return { all, top: all[0], i0, end: groups[0].top.days[i0 + n - 1]?.date ?? null };
}

// El parte del dia, en paraules: { title, accent, sub }
export function parte(groups, today) {
  if (!groups?.length) return null;
  const days0 = groups[0].top.days;
  const i0 = todayIdx(days0, today);
  const out = { title: '', accent: '', sub: '' };
  const per = [0, 1, 2].map((k) => groups.filter((g) => (g.top.days[i0 + k]?.snow ?? 0) >= 1));
  const snowK = per.map((x, k) => (x.length ? k : -1)).filter((k) => k >= 0);
  const tot = groups.map((g) => ({ g, cm: snowSum(g.top.days, i0, 3) })).sort((a, b) => b.cm - a.cm);
  const dw = (k) => dayWord(days0[i0 + k].date, k);
  if (snowK.length && tot[0].cm >= 1) {
    const max = tot[0].cm;
    const what = max >= 30 ? 'Nevada forta' : max >= 10 ? 'Nevada' : 'Neu feble';
    const kf = snowK[0], kl = snowK[snowK.length - 1];
    const when = kf === kl ? dw(kf) : kf === 0 ? `fins ${dw(kl)}` : `de ${dw(kf)} a ${dw(kl)}`;
    const zones = [...new Set(tot.filter((x) => x.cm >= Math.max(1, max * 0.5)).map((x) => x.g.resort.zoneA))].slice(0, 2);
    out.title = `${what} ${when} ${list(zones)}.`;
    const lines = snowK.flatMap((k) => per[k].map((g) => lineOf(g.top.days[i0 + k]))).filter((v) => v != null);
    out.sub = `Fins a ${u(num(max, 0), 'cm')} a dalt${lines.length ? `; la cota de neu baixarà fins a uns ${u(thousands(Math.min(...lines)), 'm')}` : ''}.`;
  } else {
    // Sense neu en 3 dies: fins quan, i a quina altura és la isoterma
    const next = [3, 4, 5, 6].find((k) => days0[i0 + k] && groups.some((g) => (g.top.days[i0 + k]?.snow ?? 0) >= 1));
    out.title = next != null ? `Sense neu nova fins ${dw(next)}.` : 'Sense neu nova en tota la setmana.';
    const frs = [0, 1, 2].map((k) => frzOf(days0[i0 + k])).filter((v) => v != null);
    if (frs.length) out.sub = `La isoterma de 0\u00A0°C serà cap als ${thousands(r100(Math.min(...frs)))}–${u(thousands(r100(Math.max(...frs))), 'm')}.`;
  }
  const windy = [0, 1, 2].filter((k) => days0[i0 + k] && groups.filter((g) => (g.top.days[i0 + k]?.gust ?? 0) >= 70).length >= Math.max(2, groups.length * 0.3));
  if (windy.length) out.sub += ` ${cap(list(windy.map(dw)))}, vent fort a dalt.`;
  // Cap de setmana: el tipus de dia més repetit dissabte i diumenge
  const wk = [];
  for (let k = 0; k < 7; k++) {
    const d = days0[i0 + k];
    if (!d) break;
    const wd = parseDay(d.date).getUTCDay();
    if (wd === 6 || wd === 0) wk.push(i0 + k);
  }
  if (wk.length) {
    const count = {};
    for (const i of wk) for (const g of groups) {
      const v = dayVerdict(g, i);
      if (!v) continue;
      const kk = v.kind === 'snowtop' ? 'snow' : v.kind === 'fog' ? 'cloud' : v.kind;
      count[kk] = (count[kk] ?? 0) + 1;
    }
    const dom = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0];
    const WK = { sun: 'Cap de setmana de sol.', part: 'Cap de setmana de sol i núvols.', snow: 'Cap de setmana amb neu.', rain: 'Cap de setmana de pluja.', wind: 'Cap de setmana amb vent fort a dalt.', cloud: 'Cap de setmana ennuvolat.' };
    out.accent = WK[dom] ?? '';
  }
  out.sub = out.sub.trim();
  return out;
}

// ------------------------------------------------------------------ neu mesurada (sensors de la XEMA)

const R = 6371;
export function distKm(a, b, c, d) {
  const toR = (x) => (x * Math.PI) / 180;
  const dl = toR(c - a), dn = toR(d - b);
  const h = Math.sin(dl / 2) ** 2 + Math.cos(toR(a)) * Math.cos(toR(c)) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Sensors a menys de 35 km del cim i com a molt 300 m per sota de la base de l'estació, del més proper al més llunyà
export function nearSensors(resort, stations, n = 2) {
  if (!stations?.length) return [];
  const { lat, lng } = resort.points[0];
  return stations
    .filter((s) => s.now != null && s.alt != null && s.alt >= resort.base - 300)
    .map((s) => ({ ...s, km: distKm(lat, lng, s.lat, s.lng) }))
    .filter((s) => s.km <= 35)
    .sort((a, b) => a.km - b.km)
    .slice(0, n);
}

// La neu caiguda els n dies abans d'avui: mesurada al sensor més proper o, si no n'hi ha, la del model
export function pastSnow(g, sensors, today, n) {
  const s = sensors?.[0];
  const days = [];
  const d0 = parseDay(today);
  for (let k = n; k >= 1; k--) days.push(new Date(d0.getTime() - k * 864e5).toISOString().slice(0, 10));
  if (s?.days?.length) {
    const by = Object.fromEntries(s.days.map((d) => [d.date, d.nou]));
    if (days.some((d) => by[d] != null)) return { src: 'mesurada', where: s.name, vals: days.map((d) => ({ date: d, cm: by[d] ?? null })) };
  }
  const by = Object.fromEntries((g?.top?.days ?? []).map((d) => [d.date, d.snow]));
  return { src: 'estimada', where: null, vals: days.map((d) => ({ date: d, cm: by[d] ?? null })) };
}

// Per a la portada: l'estació amb més neu nova en 24 h (si n'hi ha) o, si no, la que en té més
export function measuredPick(stations) {
  const ok = (stations ?? []).filter((s) => s.now != null && s.alt >= 1500);
  if (!ok.length) return null;
  const fresh = ok.filter((s) => (s.d24 ?? 0) >= 3).sort((a, b) => b.d24 - a.d24);
  return fresh[0] ?? [...ok].sort((a, b) => b.now - a.now)[0];
}

// ------------------------------------------------------------------ mapa

// Neu prevista al cim de cada estació en n dies, a partir d'avui
export function mapItems(groups, today, n) {
  if (!groups?.length) return [];
  const i0 = todayIdx(groups[0].top.days, today);
  return groups.map((g) => ({ slug: g.resort.slug, name: g.resort.short ?? g.resort.name, lat: g.resort.lat, lng: g.resort.lng, cm: Math.round(snowSum(g.top.days, i0, n)) }));
}
// Gruix mesurat als sensors (estacions de més de 1.500 m amb dada recent)
export const sensorItems = (stations) =>
  (stations ?? []).filter((s) => s.now != null && s.alt >= 1500).map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, alt: s.alt, cm: s.now }));

// Punt a la posició exacta i, al costat, l'etiqueta (xifra i nom); el mapa decideix el costat i què hi cap
export function pinHTML(it, { base = '/neu/', depth = false } = {}) {
  const fill = (depth ? depthFill : snowFill)(it.cm) ?? '#FFFFFF';
  const ink = (depth ? depthInk : snowInk)(it.cm);
  const v = it.cm == null ? '…' : String(it.cm);
  const inner = `${it.cm == null ? '' : `<b style="--bg:${fill};--fg:${ink}">${v}</b>`}<span>${esc(it.name)}</span>`;
  const lab = it.slug
    ? `<a class="nv-pin__lab" href="${base}${it.slug}" aria-label="${esc(`${it.name}: ${v} cm`)}">${inner}</a>`
    : `<span class="nv-pin__lab" title="${esc(`${it.name}, ${thousands(it.alt)} m: ${v} cm de gruix`)}">${inner}</span>`;
  return `<span class="nv-pin${it.slug ? '' : ' is-sensor'}"><i class="nv-pin__dot" style="background:${fill}"></i>${lab}</span>`;
}

// ------------------------------------------------------------------ portada

// Barres petites: els dies abans d'avui (gris) i els propers (escala de la neu)
function sparkHTML(past, fut, selDate) {
  const H = 30;
  const max = Math.max(24, ...past.map((x) => x.cm ?? 0), ...fut.map((x) => x.cm ?? 0));
  const h = (cm) => (cm == null || cm < 0.5 ? 3 : Math.max(4, Math.round((cm / max) * H)));
  const bar = (cm, isPast) => `<span class="nv-spark__b${cm == null || cm < 0.5 ? ' is-zero' : ''}" style="height:${h(cm)}px;${cm >= 0.5 && !isPast ? `background:${snowFill(Math.max(1, cm))}` : ''}"></span>`;
  const lab = (d, isPast) => `<span class="${isPast ? '' : 'is-fut'}${d === selDate ? ' is-sel' : ''}">${dayShort(d)}</span>`;
  const desc = [...past.map((x) => `${dayName(x.date)} ${x.cm == null ? 'sense dada' : `${cm0(x.cm)} cm`}`), ...fut.map((x) => `${dayName(x.date)} ${cm0(x.cm)} cm previstos`)].join(', ');
  return `<div class="nv-spark" role="img" aria-label="Neu nova: ${esc(desc)}"><div class="nv-spark__bars">${past.map((x) => bar(x.cm, true)).join('')}${fut.map((x) => bar(x.cm, false)).join('')}</div><div class="nv-spark__days" aria-hidden="true">${past.map((x) => lab(x.date, true)).join('')}${fut.map((x) => lab(x.date, false)).join('')}</div></div>`;
}

// Llista d'estacions per al dia k (0 avui … 6): en temporada, de millor a pitjor; fora, per la neu prevista
export function listHTML(groups, { today, k = 0, zone = 'totes', stations = null, base = '/neu/', season = true }) {
  if (!groups?.length) return '';
  const i0 = todayIdx(groups[0].top.days, today);
  const i = i0 + k;
  const selDate = groups[0].top.days[i]?.date;
  const rows = groups
    .filter((g) => zone === 'totes' || g.resort.country === zone)
    .map((g) => ({ g, r: season ? rateDay(g.top, g.base, i) : null, tot: snowSum(g.top.days, i0, 3) }))
    .sort((a, b) => (b.r?.score ?? -1) - (a.r?.score ?? -1) || b.tot - a.tot || a.g.resort.name.localeCompare(b.g.resort.name, 'ca'));
  if (!rows.length) return '<p class="nv-empty">No hi ha cap estació en aquesta zona.</p>';
  return `<ol class="nv-list">${rows
    .map(({ g, r, tot }) => {
      const res = g.resort;
      const sens = nearSensors(res, stations, 1);
      const past = pastSnow(g, sens, today, 2).vals;
      const fut = [0, 1, 2, 3, 4, 5, 6].map((kk) => ({ date: g.top.days[i0 + kk]?.date, cm: g.top.days[i0 + kk]?.snow ?? 0 })).filter((x) => x.date);
      const windK = [0, 1, 2].find((kk) => (g.top.days[i0 + kk]?.gust ?? 0) >= 70);
      const wind = windK != null ? `<p class="nv-badge nv-badge--wind">${icon('wind', 13)}${cap(dayWord(g.top.days[i0 + windK].date, windK))}, vent fort a dalt</p>` : '';
      return `<li class="nv-card nv-row">
<div class="nv-row__top"><div class="nv-row__id"><a class="nv-row__name" href="${base}${res.slug}">${esc(res.name)}</a><p class="nv-row__meta">${esc(res.zone)} · ${res.type === 'fons' ? 'esquí de fons' : 'esquí alpí'}</p></div>${r ? pill(r.level) : ''}</div>
${wind}
<div class="nv-row__bot">${sparkHTML(past, fut, k > 0 ? selDate : null)}<p class="nv-row__tot"><b>${num(tot, 0)}</b> cm<small>en 3 dies</small></p></div>
</li>`;
    })
    .join('')}</ol>`;
}

// Targetes de dalt de la portada: millor dia (en temporada) i on nevarà més
// wait: la previsió encara es carrega (si no n'hi ha i no s'espera, no surt cap targeta)
export function forecastCardsHTML(groups, { today, base = '/neu/', season = true, wait = true }) {
  const b = groups && season ? bestDay(groups, today) : null;
  const m = groups ? mostSnow(groups, today, 3) : null;
  const out = [];
  if (b) {
    const prev = snowSum(b.g.top.days, b.i - 2, 2);
    const T = b.g.top.days[b.i];
    const why = [];
    if ((T.sun ?? 0) >= 6 || (T.sun == null && T.code != null && T.code <= 1)) why.push([icon('sun', 16, 'is-sun'), 'Sol']);
    if (prev >= 5) why.push([icon('flake', 16, 'is-ice'), `${num(prev, 0)} cm de neu nova`]);
    if ((T.gust ?? 0) < 30) why.push([icon('wind', 16), 'Poc vent']);
    const more = b.same - 1;
    out.push(`<a class="nv-hcard nv-hcard--wide" href="${base}${b.g.resort.slug}">
<span class="nv-eyebrow nv-eyebrow--ice">Millor dia per esquiar</span>
<span class="nv-hcard__row"><span class="nv-hcard__day">${dayLabel(b.date, b.k)}</span>${pill(b.r.level)}</span>
<span class="nv-hcard__name">${esc(b.g.resort.name)}${more > 0 ? ` <span>i ${more === 1 ? 'una estació més' : `${more} estacions més`}</span>` : ''}</span>
${why.length ? `<span class="nv-hcard__why">${why.map(([ic, t]) => `<span>${ic}${t}</span>`).join('')}</span>` : ''}
</a>`);
  } else if (groups && season) {
    out.push(`<div class="nv-hcard nv-hcard--wide"><span class="nv-eyebrow nv-eyebrow--ice">Millor dia per esquiar</span><span class="nv-hcard__name">Cap dia bo per esquiar aquesta setmana</span></div>`);
  }
  if (m && m.top.cm >= 1) {
    out.push(`<a class="nv-hcard" href="${base}${m.top.g.resort.slug}"><span class="nv-eyebrow nv-eyebrow--ice">On nevarà més</span><span class="nv-hcard__big">${num(m.top.cm, 0)}<small> cm</small></span><span class="nv-hcard__name nv-hcard__name--s">${esc(m.top.g.resort.name)}</span><span class="nv-hcard__sub">d'avui a ${m.end ? dayName(m.end) : 'demà passat'}</span></a>`);
  } else if (m) {
    out.push(`<div class="nv-hcard"><span class="nv-eyebrow nv-eyebrow--ice">On nevarà més</span><span class="nv-hcard__big">0<small> cm</small></span><span class="nv-hcard__sub">Sense neu prevista en 3 dies</span></div>`);
  } else if (wait) {
    out.push(`<div class="nv-hcard is-wait"><span class="nv-eyebrow nv-eyebrow--ice">On nevarà més</span><span class="nv-hcard__big">…</span><span class="nv-hcard__sub">Carregant la previsió</span></div>`);
  }
  return out.join('');
}

// Targeta de la neu mesurada: stations undefined mentre es carrega (en espera), null si no ha arribat (cap targeta)
export function measuredCardHTML(stations) {
  if (stations === undefined) return `<div class="nv-hcard is-wait"><span class="nv-eyebrow nv-eyebrow--ice">Neu mesurada</span><span class="nv-hcard__big">…</span><span class="nv-hcard__sub">Carregant els sensors</span></div>`;
  const s = measuredPick(stations);
  if (!s) return '';
  const up = (s.d24 ?? 0) >= 1;
  return `<a class="nv-hcard" href="#mapa" data-layer="gruix"><span class="nv-eyebrow nv-eyebrow--ice">Neu mesurada</span><span class="nv-hcard__big">${num(s.now, 0)}<small> cm</small></span><span class="nv-hcard__name nv-hcard__name--s">${esc(s.name)}, ${thousands(s.alt)}\u00A0m</span><span class="nv-hcard__sub${up ? ' is-ice' : ''}">${up ? `+${num(s.d24, 0)} cm en 24 hores` : s.d24 == null ? 'gruix de neu ara' : 'sense neu nova en 24 h'}</span></a>`;
}

// ------------------------------------------------------------------ fitxa d'una estació

// Perfil de l'estació, de la base al cim, amb la isoterma de 0 °C i la cota de neu del dia
// cover: 'snow' (tota l'estació amb neu), 'bare' (sense neu) o null (es dedueix de la cota de neu)
export function profileSVG(resort, { frz = null, line = null, cover = null, snowing = false, now = null } = {}) {
  const W = 358, H = 210;
  const lows = [resort.base, frz, line].filter((v) => v != null);
  const lo = Math.max(Math.min(...lows) - 250, resort.base - 1200);
  const hi = Math.min(Math.max(resort.top, frz ?? resort.top) + 220, resort.top + 900);
  const y = (a) => +Math.max(30, Math.min(205, 198 - ((a - lo) / (hi - lo)) * 158)).toFixed(1);
  const yb = y(resort.base), yt = y(resort.top), d = yb - yt;
  const y0 = Math.min(206, yb + 38);
  const m = `M0,${H}L0,${y0}C30,${(y0 - 10).toFixed(1)} 45,${(yb + 6).toFixed(1)} 70,${yb}L112,${(yb - 0.06 * d).toFixed(1)}C150,${(yb - 0.2 * d).toFixed(1)} 190,${(yb - 0.5 * d).toFixed(1)} 232,${(yt + 0.29 * d).toFixed(1)}L290,${yt}L322,${(yt + 0.14 * d).toFixed(1)}C336,${(yt + 0.25 * d).toFixed(1)} 346,${(yt + 0.4 * d).toFixed(1)} 358,${(yt + 0.47 * d).toFixed(1)}L358,${H}Z`;
  const face = `M290,${yt}L322,${(yt + 0.14 * d).toFixed(1)}C336,${(yt + 0.25 * d).toFixed(1)} 346,${(yt + 0.4 * d).toFixed(1)} 358,${(yt + 0.47 * d).toFixed(1)}L358,${H}L292,${H}L262,${yb}Z`;
  const id = `mt-${resort.slug}`;
  const bare = cover === 'bare' && line == null;
  const lab = `Perfil de l'estació, de ${thousands(resort.base)} a ${thousands(resort.top)} m${frz != null ? `. Isoterma de 0 °C a ${thousands(r100(frz))} m` : ''}${line != null ? `. Cota de neu a ${thousands(line)} m` : ''}.`;
  const out = [`<svg class="nv-prof" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(lab)}"><defs><clipPath id="${id}"><path d="${m}"/></clipPath></defs>`];
  if (snowing) out.push(`<g fill="#FFFFFF" opacity="0.45">${[[24, 24], [52, 54], [96, 22], [122, 66], [160, 50], [332, 14], [346, 44], [20, 132], [84, 74], [190, 66]].filter(([, yy]) => yy < yt + 0.2 * d || yy < 80).map(([x, yy]) => `<circle cx="${x}" cy="${yy}" r="1.5"/>`).join('')}</g>`);
  out.push(`<path d="${m}" fill="${bare ? '#5E7468' : '#EAF2FB'}"/>`);
  out.push(`<path d="${face}" fill="${bare ? '#4E6359' : '#CFDFF0'}" clip-path="url(#${id})"/>`);
  if (line != null && !bare) {
    const yl = y(line);
    out.push(`<rect x="0" y="${yl}" width="${W}" height="${(H - yl).toFixed(1)}" fill="#46625A" clip-path="url(#${id})"/>`);
  }
  const pills = [];
  if (frz != null) {
    const yf = y(frz);
    out.push(`<path d="M0 ${yf}H${W}" stroke="#FFB65C" stroke-width="1.5" stroke-dasharray="5 4"/>`);
    pills.push({ yy: yf, w: 116, t: `0 °C a ${thousands(r100(frz))} m`, c: '#FFB65C' });
  }
  if (line != null) {
    const yl = y(line);
    out.push(`<path d="M0 ${yl}H${W}" stroke="#2F7DD8" stroke-width="1.5" stroke-dasharray="2 3"/>`);
    const t = line >= resort.top ? 'Pluja fins a dalt' : line > resort.base ? `Neu per sobre de ${thousands(line)} m` : `Neu fins a ${thousands(line)} m`;
    pills.push({ yy: yl, w: 140, t, c: '#8FD3FF' });
  }
  pills.sort((a, b) => a.yy - b.yy);
  let prev = -99;
  for (const p of pills) {
    let top = Math.max(2, Math.min(H - 23, p.yy - 10.5));
    if (top < prev + 24) top = prev + 24;
    prev = top;
    out.push(`<rect x="${W - 4 - p.w}" y="${top.toFixed(1)}" width="${p.w}" height="21" rx="10.5" fill="#0B1A2C"/><text x="${W - 4 - p.w / 2}" y="${(top + 14.5).toFixed(1)}" text-anchor="middle" class="nv-prof__pill" fill="${p.c}">${esc(p.t)}</text>`);
  }
  out.push(`<circle cx="70" cy="${yb}" r="4.5" fill="#0B1A2C" stroke="#FFFFFF" stroke-width="2"/><circle cx="290" cy="${yt}" r="4.5" fill="#0B1A2C" stroke="#FFFFFF" stroke-width="2"/>`);
  const wb = Math.round(now?.base?.wind ?? 0), gt = Math.round(now?.top?.gust ?? 0);
  const tb = now?.base?.temp != null ? `${num(now.base.temp, 0)} °C · vent ${de(wb)}${wb} km/h` : '';
  const tt = now?.top?.temp != null ? `${num(now.top.temp, 0)} °C · ratxes ${de(gt)}${gt} km/h` : '';
  out.push(`<text x="10" y="${(yb - 34).toFixed(1)}" class="nv-prof__lab">Base · ${thousands(resort.base)} m</text>`);
  if (tb) out.push(`<text x="10" y="${(yb - 19).toFixed(1)}" class="nv-prof__sub">${tb}</text>`);
  out.push(`<text x="280" y="${(yt - (tt ? 21 : 9)).toFixed(1)}" text-anchor="end" class="nv-prof__lab">Cim · ${thousands(resort.top)} m</text>`);
  if (tt) out.push(`<text x="280" y="${(yt - 6).toFixed(1)}" text-anchor="end" class="nv-prof__sub">${tt}</text>`);
  out.push('</svg>');
  return out.join('');
}

// Dades del dia per a l'estat del perfil: isoterma i cota de neu (només si hi ha precipitació)
export function dayLines(g, i) {
  const T = g?.top?.days?.[i];
  if (!T) return { frz: null, line: null };
  const B = g.base?.days?.[i] ?? T;
  const p = Math.max(T.precip ?? 0, B.precip ?? 0);
  return { frz: frzOf(T), line: p >= 1 ? lineOf(T) : null };
}

// Títol i text del dia en una estació
export function dayTitle(g, i) {
  const v = dayVerdict(g, i);
  if (!v) return '';
  const r = rateDay(g.top, g.base, i);
  const fog = v.kind === 'fog' || r?.why?.includes('fog');
  const extra = [fog && v.kind !== 'fog' ? 'boira' : '', v.windy && v.kind !== 'wind' ? 'vent fort a dalt' : ''].filter(Boolean);
  const T = {
    snow: 'Dia de nevada',
    snowtop: 'Neu a dalt i pluja a baix',
    rain: v.line != null && v.line >= v.tAlt ? 'Pluja fins a dalt' : 'Dia de pluja',
    wind: 'Sec, però amb vent fort a dalt',
    sun: snowSum(g.top.days, i - 2, 2) >= 10 ? 'Sol i neu nova' : 'Dia de sol',
    part: 'Sol i núvols',
    cloud: 'Dia ennuvolat',
    fog: 'Dia de boira',
  }[v.kind];
  return `${T}${extra.length ? `, amb ${list(extra)}` : ''}`;
}

export function dayText(g, i) {
  const v = dayVerdict(g, i);
  if (!v) return '';
  const parts = [];
  const gu = Math.round(v.T.gust ?? 0);
  if (v.kind === 'snow') parts.push(`Nevarà ${v.cm >= 1 ? `uns ${u(num(v.cm, 0), 'cm')} a dalt` : 'feblement'}${v.line != null ? `, amb la cota de neu a uns ${u(thousands(v.line), 'm')}` : ''}.`);
  else if (v.kind === 'snowtop') parts.push(`Uns ${u(num(v.cm, 0), 'cm')} de neu al cim, però la cota de neu, a uns ${u(thousands(v.line), 'm')}, queda dins de l'estació: a baix plourà.`);
  else if (v.kind === 'rain') parts.push(v.line != null && v.line >= v.tAlt ? `Pluja fins a dalt: la cota de neu és a uns ${u(thousands(v.line), 'm')}, per sobre del cim.` : 'Pluja.');
  else if (v.kind === 'wind') parts.push(`Sec, però amb ratxes ${de(gu)}${u(gu, 'km/h')} a dalt: poden tancar els remuntadors més alts.`);
  else if (v.kind === 'sun') {
    const prev = snowSum(g.top.days, i - 2, 2);
    parts.push(`${(v.T.sun ?? 0) >= 8 ? 'Sol tot el dia' : 'Sol'}${prev >= 5 ? `, amb ${u(num(prev, 0), 'cm')} de neu nova dels dies anteriors` : ''}.`);
  } else if (v.kind === 'fog') parts.push('Boira: poca visibilitat a les pistes, sobretot a dalt.');
  else if (v.kind === 'cloud') parts.push('Cel ennuvolat, sense precipitació.');
  else parts.push(`${KIND_TEXT[v.kind]}.`);
  if (v.windy && v.kind !== 'wind') parts.push(`Ratxes ${de(gu)}${u(gu, 'km/h')} a dalt: poden tancar els remuntadors més alts.`);
  const t = (x) => Math.round(x ?? 0);
  parts.push(`Al cim, ${de(t(v.T.min))}${num(v.T.min, 0)} a ${u(num(v.T.max, 0), '°C')}; a la base, ${de(t(v.B.min))}${num(v.B.min, 0)} a ${u(num(v.B.max, 0), '°C')}.`);
  return parts.join(' ');
}

// Capçalera del dia triat: quin dia, valoració, títol i text
export function verdictHTML(g, today, k = 0, season = true) {
  const i0 = todayIdx(g.top.days, today);
  const i = i0 + k;
  const d = g.top.days[i];
  if (!d) return '';
  const r = season ? rateDay(g.top, g.base, i) : null;
  const eb = k === 0 ? `Avui, ${dayName(d.date)}` : k === 1 ? `Demà, ${dayName(d.date)}` : `${cap(dayName(d.date))} ${parseDay(d.date).getUTCDate()}`;
  return `<div class="nv-verd__h"><span class="nv-eyebrow">${eb}</span>${r ? pill(r.level) : ''}</div><h2 class="nv-verd__t">${esc(dayTitle(g, i))}</h2><p class="nv-verd__p">${esc(dayText(g, i))}</p>`;
}

// Els 7 dies en petit: tipus de dia i, en temporada, el dia d'esquí. Cada dia és un botó (data-k)
export function weekStripHTML(g, today, sel = 0, season = true) {
  const i0 = todayIdx(g.top.days, today);
  const cells = [];
  for (let k = 0; k < 7; k++) {
    const i = i0 + k;
    const d = g.top.days[i];
    if (!d) break;
    const v = dayVerdict(g, i);
    const r = season ? rateDay(g.top, g.base, i) : null;
    const lab = `${dayLabel(d.date, k)}: ${v ? KIND_TEXT[v.kind].toLowerCase() : ''}${r ? `, dia d'esquí ${LEVEL[r.level][0].toLowerCase()}` : ''}`;
    cells.push(`<li><button type="button" class="nv-wk__d${k === sel ? ' is-sel' : ''}" data-k="${k}" aria-pressed="${k === sel}" aria-label="${esc(lab)}"><span>${dayShort(d.date)}</span>${v ? kindIcon(v.kind) : ''}${r ? `<i class="nv-lv nv-lv--${LEVEL[r.level][1]}"></i>` : ''}</button></li>`);
  }
  return `<ul class="nv-wk">${cells.join('')}</ul>`;
}

export const LEVEL_LEGEND = `<p class="nv-wk__lg">${[4, 3, 2, 1].map((l) => `<span><i class="nv-lv nv-lv--${LEVEL[l][1]}"></i>${LEVEL[l][0]}</span>`).join('')}</p>`;

// Neu caiguda i prevista: tres xifres (ps: pastSnow)
export function trioHTML(g, today, ps) {
  const i0 = todayIdx(g.top.days, today);
  const known = ps.vals.filter((x) => x.cm != null);
  const past = known.reduce((a, x) => a + Math.max(0, x.cm), 0);
  const box = (k, v, s, fut) => `<div><p>${k}</p><b${fut ? ' class="is-fut"' : ''}>${v}<small> cm</small></b><p>${s}</p></div>`;
  return `<div class="nv-trio">${[
    box(`Últims ${ps.vals.length} dies`, known.length ? num(past, 0) : '—', ps.src === 'mesurada' ? `mesurada a ${esc(ps.where)}` : 'estimada al cim'),
    box('Pròxims 3 dies', num(snowSum(g.top.days, i0, 3), 0), 'prevista al cim', true),
    box('Dies 4 a 7', num(snowSum(g.top.days, i0 + 3, 4), 0), 'prevista al cim', true),
  ].join('')}</div>`;
}

// Gràfic de la neu nova: els dies abans d'avui (mesurada o estimada, ps: pastSnow) i els 7 propers (prevista al cim)
export function snowChartSVG(g, today, ps) {
  const past = ps.vals;
  const i0 = todayIdx(g.top.days, today);
  const fut = [];
  for (let k = 0; k < 7; k++) {
    const d = g.top.days[i0 + k];
    if (!d) break;
    const v = dayVerdict(g, i0 + k);
    fut.push({ date: d.date, cm: Math.max(0, d.snow ?? 0), rain: v?.kind === 'snowtop' || v?.kind === 'rain', k });
  }
  const W = 326, BASE = 118, MAXH = 78;
  const max = Math.max(10, ...past.map((x) => x.cm ?? 0), ...fut.map((x) => x.cm));
  const hh = (cm) => (cm * MAXH) / max;
  const desc = `Neu nova per dies. Dies anteriors, ${ps.src === 'mesurada' ? `mesurada a ${ps.where}` : 'estimada'}: ${past.map((x) => `${dayName(x.date)} ${x.cm == null ? 'sense dada' : `${cm0(x.cm)} cm`}`).join(', ')}. Pròxims dies, prevista al cim: ${fut.map((x) => `${dayName(x.date)} ${cm0(x.cm)} cm${x.rain ? ' i pluja a baix' : ''}`).join(', ')}.`;
  const out = [`<svg class="nv-chart" viewBox="0 0 ${W} 150" role="img" aria-label="${esc(desc)}">`, `<path d="M4 ${BASE}H${W - 4}" stroke="#C9D3DF" stroke-width="1"/>`];
  const xp = (j) => 10 + j * 26;
  const xf = (j) => 150 + j * 24;
  past.forEach((x, j) => {
    const X = xp(j);
    if (x.cm == null) out.push(`<text x="${X + 9}" y="${BASE - 4}" text-anchor="middle" class="nv-chart__na">·</text>`);
    else if (x.cm < 0.5) out.push(`<rect x="${X}" y="${BASE - 2}" width="18" height="2" fill="#DCE3EC"/>`);
    else out.push(`<rect x="${X}" y="${(BASE - hh(x.cm)).toFixed(1)}" width="18" height="${hh(x.cm).toFixed(1)}" rx="3" fill="#A3B1C2"/><text x="${X + 9}" y="${(BASE - hh(x.cm) - 6).toFixed(1)}" text-anchor="middle" class="nv-chart__v">${num(x.cm, 0)}</text>`);
    out.push(`<text x="${X + 9}" y="140" text-anchor="middle" class="nv-chart__d">${dayShort(x.date)}</text>`);
  });
  out.push(`<path d="M141 15V124" stroke="#0E1C2F" stroke-width="1" stroke-dasharray="3 3" opacity="0.5"/><text x="141" y="10" text-anchor="middle" class="nv-chart__now">avui</text>`);
  fut.forEach((x, j) => {
    const X = xf(j);
    if (x.cm < 0.5) out.push(`<rect x="${X}" y="${BASE - 2}" width="18" height="2" fill="#DCE3EC"/>`);
    else {
      const fill = snowFill(Math.max(1, x.cm));
      out.push(`<rect x="${X}" y="${(BASE - hh(x.cm)).toFixed(1)}" width="18" height="${hh(x.cm).toFixed(1)}" rx="3" fill="${fill}"${x.cm < 5 ? ' stroke="#6FAEF5" stroke-width="1"' : ''}/><text x="${X + 9}" y="${(BASE - hh(x.cm) - 6).toFixed(1)}" text-anchor="middle" class="nv-chart__v is-fut">${num(x.cm, 0)}</text>`);
    }
    if (x.rain) out.push(`<circle cx="${X + 9}" cy="125" r="3" fill="#2E9E7A"/>`);
    out.push(`<text x="${X + 9}" y="140" text-anchor="middle" class="nv-chart__d is-fut${x.k === 0 ? ' is-today' : ''}">${dayShort(x.date)}</text>`);
  });
  out.push('</svg>');
  return out.join('');
}

// Llegenda del gràfic de neu
export function chartLegendHTML(g, today, ps) {
  const i0 = todayIdx(g.top.days, today);
  const rain = [0, 1, 2, 3, 4, 5, 6].some((k) => {
    const v = g.top.days[i0 + k] ? dayVerdict(g, i0 + k) : null;
    return v?.kind === 'snowtop' || v?.kind === 'rain';
  });
  return `<p class="nv-legend-s"><span><i style="background:#A3B1C2"></i>${ps.src === 'mesurada' ? `Mesurada a ${esc(ps.where)}` : 'Estimada'}</span><span><i style="background:#6FAEF5"></i>Prevista al cim</span>${rain ? '<span><i class="is-dot" style="background:#2E9E7A"></i>Pluja a la base</span>' : ''}</p>`;
}

// Tipus de neu probable d'un dia (regles senzilles a partir de la previsió; orientatiu)
export function snowType(g, i) {
  const T = g.top.days[i], B = g.base?.days?.[i] ?? T;
  if (!T) return null;
  const prev = snowSum(g.top.days, i - 2, 2);
  const rainBefore = [i - 2, i - 1].some((j) => {
    const b = g.base?.days?.[j];
    return b && (b.precip ?? 0) >= 1 && (b.snow ?? 0) < (b.precip ?? 0) * 0.4;
  });
  if ((T.snow ?? 0) >= 5) return { t: 'Neu nova', s: 'Nevarà durant el dia: neu fresca, però amb poca visibilitat.' };
  if (prev >= 10 && (T.max ?? 0) <= 0) return { t: 'Neu pols', s: `Després ${de(prev)}${u(num(prev, 0), 'cm')} de neu nova i amb fred, pols a tota l'estació.` };
  if (prev >= 10) return { t: 'Neu nova, pesant a la tarda', s: `${u(num(prev, 0), 'cm')} de neu nova; amb la calor de la tarda es farà més pesant a les pistes encarades al sud.` };
  if (prev >= 3) return { t: 'Capa de neu nova', s: `${u(num(prev, 0), 'cm')} de neu nova damunt de la neu compactada${(T.max ?? 0) > 2 ? '; a la tarda, més pesant a les pistes encarades al sud' : ''}.` };
  if (rainBefore && (T.min ?? 0) <= -2) return { t: 'Neu dura al matí', s: 'Després de la pluja, la neu es gela de nit: dura o glaçada a primera hora.' };
  if ((B.max ?? 0) >= 6 && (T.min ?? 0) <= 0) return { t: 'Neu primavera', s: 'Dura al matí i tova a partir del migdia, quan s’escalfa.' };
  return { t: 'Neu compactada', s: 'Sense neu nova ni gaire calor: pistes compactades.' };
}

// Targeta del tipus de neu del millor dels 3 pròxims dies (només en temporada i si hi ha neu a terra)
export function snowTypeHTML(g, today, sensors, season = true) {
  if (!season) return '';
  const i0 = todayIdx(g.top.days, today);
  const ks = [0, 1, 2].filter((k) => g.top.days[i0 + k]);
  if (!ks.length) return '';
  const k = ks.map((kk) => ({ kk, s: rateDay(g.top, g.base, i0 + kk)?.score ?? 0 })).sort((a, b) => b.s - a.s)[0].kk;
  const s = sensors?.[0];
  if (s?.now != null && s.now < 5 && snowSum(g.top.days, i0 + k - 2, 3) < 5) return '';
  const t = snowType(g, i0 + k);
  if (!t) return '';
  return `<div class="nv-card nv-type"><span class="nv-type__ic">${icon('flake', 22)}</span><div><span class="nv-eyebrow">Tipus de neu, ${dayWord(g.top.days[i0 + k].date, k)}</span><p class="nv-type__t">${esc(t.t)}</p><p class="nv-type__s">${esc(t.s)}</p></div></div>`;
}

// Taula dels 7 dies
export function weekTableHTML(g, today, season = true) {
  const i0 = todayIdx(g.top.days, today);
  const rows = [];
  for (let k = 0; k < 7; k++) {
    const i = i0 + k;
    const d = g.top.days[i];
    if (!d) break;
    const v = dayVerdict(g, i);
    const r = season ? rateDay(g.top, g.base, i) : null;
    const cm = Math.max(0, d.snow ?? 0);
    const snow = cm >= 0.5 ? `<span class="nv-cm" style="background:${snowFill(Math.max(1, cm))};color:${snowInk(Math.max(1, cm))}">${num(cm, 0)} cm</span>` : '<span class="nv-dash">—</span>';
    const p = Math.max(d.precip ?? 0, g.base?.days?.[i]?.precip ?? 0);
    const line = p >= 1 ? lineOf(d) : null;
    const cota = line != null ? `<span class="nv-mono${v && (v.kind === 'snowtop' || v.kind === 'rain') ? ' is-rain' : ''}">${thousands(line)} m</span>` : '<span class="nv-dash">—</span>';
    const gust = d.gust != null ? `<span class="nv-mono${d.gust >= 60 ? ' nv-hi' : ''}">${Math.round(d.gust)}</span>` : '<span class="nv-dash">—</span>';
    const lv = r ? `<span role="cell" class="nv-t7__lv"><span class="nv-tdlv"><i class="nv-lv nv-lv--${LEVEL[r.level][1]} is-dot"></i>${LEVEL[r.level][0]}</span></span>` : '';
    rows.push(`<div class="nv-t7__r" role="row"><span role="cell" class="nv-t7__day">${v ? kindIcon(v.kind, 18) : ''}${dayShort(d.date)} ${parseDay(d.date).getUTCDate()}</span><span role="cell">${snow}</span><span role="cell">${cota}</span><span role="cell">${gust}</span>${lv}</div>`);
  }
  const head = `<div class="nv-t7__r nv-t7__h" role="row"><span role="columnheader">Dia</span><span role="columnheader">Neu</span><span role="columnheader">Cota de neu</span><span role="columnheader">Ratxes</span>${season ? '<span role="columnheader" class="nv-t7__lv">Dia d\'esquí</span>' : ''}</div>`;
  return `<div class="nv-card nv-t7${season ? '' : ' is-ns'}" role="table" aria-label="Previsió dels pròxims 7 dies">${head}${rows.join('')}</div>`;
}

// Nota sota la taula: el primer dia que la cota de neu queda dins de l'estació o per sobre
export function weekNote(g, today) {
  const i0 = todayIdx(g.top.days, today);
  for (let k = 0; k < 7; k++) {
    const d = g.top.days[i0 + k];
    if (!d) break;
    const v = dayVerdict(g, i0 + k);
    if (!v || v.line == null) continue;
    const when = cap(dayWord(d.date, k));
    if (v.kind === 'snowtop') return `${when}, cota de neu a uns ${u(thousands(v.line), 'm')}: pluja a la base i neu només a dalt.`;
    if (v.kind === 'rain' && v.line >= v.tAlt) return `${when}, cota de neu a uns ${u(thousands(v.line), 'm')}: pluja fins a dalt.`;
  }
  return '';
}

// Hora a hora d'un dia (de les 8 a les 18 h, cada 2 hores), a partir de /api/neu/<estació>
// Cada columna són dues hores: la neu i la pluja se sumen, la ratxa és la màxima i la visibilitat, la mínima
export function hoursOf(hourly, date, from = 8, to = 18) {
  const all = (hourly?.hours ?? []).filter((h) => h.t.startsWith(date));
  const at = (H) => all.find((h) => Number(h.t.slice(11, 13)) === H);
  const out = [];
  for (let H = from; H <= to; H += 2) {
    const a = at(H), b = at(H + 1);
    if (!a) continue;
    const both = [a, b].filter(Boolean);
    const sum = (side, k) => both.reduce((s, h) => s + (h[side]?.[k] ?? 0), 0);
    const mx = (side, k) => Math.max(...both.map((h) => h[side]?.[k] ?? -Infinity));
    const mn = (side, k) => Math.min(...both.map((h) => h[side]?.[k] ?? Infinity));
    const fin = (v) => (Number.isFinite(v) ? v : null);
    const side = (s) => (a[s] ? { temp: a[s].temp, code: a[s].code, wind: a[s].wind, snow: sum(s, 'snow'), precip: sum(s, 'precip'), gust: fin(mx(s, 'gust')), vis: fin(mn(s, 'vis')) } : null);
    out.push({ t: a.t, top: side('top'), base: side('base') });
  }
  return out;
}

// Quin dia es mostra hora a hora: avui o, a partir de les 17 h, demà
export function hoursDay(hourly, today, hour) {
  const days = [...new Set((hourly?.hours ?? []).map((h) => h.t.slice(0, 10)))];
  const next = days.find((d) => d > today);
  return hour >= 17 && next ? { date: next, word: 'Demà' } : { date: today, word: 'Avui' };
}

export function hoursHTML(hourly, date) {
  const hs = hoursOf(hourly, date).filter((h) => h.top);
  if (hs.length < 3) return '';
  const icn = (h) => {
    const T = h.top;
    if ((T.vis != null && T.vis < 1000) || T.code === 45 || T.code === 48) return icon('fog', 22);
    if ((T.snow ?? 0) > 0.05) return icon('snow', 22);
    if ((T.precip ?? 0) > 0.1) return icon('rain', 22, 'is-rain');
    if (T.code != null && T.code <= 1) return icon('sun', 22, 'is-sun');
    if (T.code === 2) return icon('part', 22);
    return icon('cloud', 22);
  };
  const cell = (v, cls = '') => `<span class="nv-hh__c${cls ? ` ${cls}` : ''}" role="cell">${v}</span>`;
  const rows = [
    ['', hs.map((h) => cell(`${Number(h.t.slice(11, 13))} h`, 'is-h'))],
    ['Cel', hs.map((h) => cell(icn(h), 'is-ic'))],
    ['Neu al cim', hs.map((h) => cell((h.top.snow ?? 0) >= 0.5 ? num(h.top.snow, 0) : (h.top.snow ?? 0) > 0.05 ? '&lt;1' : '—', (h.top.snow ?? 0) > 0.05 ? 'is-snow' : 'is-dim'))],
    ['Temp. cim', hs.map((h) => cell(`${num(h.top.temp, 0)}°`))],
    ['Temp. base', hs.map((h) => cell(h.base ? `${num(h.base.temp, 0)}°` : '—'))],
    ['Ratxes cim', hs.map((h) => cell(h.top.gust == null ? '—' : String(Math.round(h.top.gust)), (h.top.gust ?? 0) >= 55 ? 'nv-hi' : ''))],
    ['Boira cim', hs.map((h) => cell(h.top.vis != null && h.top.vis < 1000 ? '<i class="nv-fog" title="Boira"></i>' : h.top.vis != null && h.top.vis < 3000 ? '<i class="nv-fog is-light" title="Boirina"></i>' : '', 'is-fog'))],
  ];
  const notes = [];
  const fogH = hs.filter((h) => h.top.vis != null && h.top.vis < 1000).map((h) => Number(h.t.slice(11, 13)));
  if (fogH.length) notes.push(`<p class="nv-note">${icon('fog', 18)}Boira a dalt ${fogH.length === hs.length ? 'tot el dia' : `entre les ${fogH[0]} i les ${fogH[fogH.length - 1] + 2} h`}.</p>`);
  const windH = hs.filter((h) => (h.top.gust ?? 0) >= 60);
  if (windH.length) {
    const mx = Math.max(...windH.map((h) => h.top.gust));
    notes.push(`<p class="nv-note nv-note--wind">${icon('wind', 18)}Ratxes de fins a ${u(Math.round(mx), 'km/h')} ${windH.length === hs.length ? 'tot el dia' : `entre les ${Number(windH[0].t.slice(11, 13))} i les ${Number(windH[windH.length - 1].t.slice(11, 13)) + 2} h`}: poden tancar els remuntadors més alts.</p>`);
  }
  return `<div class="nv-card nv-hh"><div class="nv-hh__g" role="table" aria-label="Previsió hora a hora" style="grid-template-columns:74px repeat(${hs.length},minmax(0,1fr))">${rows
    .map(([lab, cs]) => `<span class="nv-hh__l" role="rowheader">${lab}</span>${cs.join('')}`)
    .join('')}</div>${notes.length ? `<div class="nv-notes">${notes.join('')}</div>` : ''}</div>`;
}

// Hora actual (o la més propera) per a la capçalera de la fitxa
export function nowHour(hourly) {
  const hs = hourly?.hours ?? [];
  if (!hs.length) return null;
  const now = Date.now();
  let best = null, bd = Infinity;
  for (const h of hs) {
    const t = Date.parse(h.iso);
    const dd = Math.abs(t - now);
    if (dd < bd) { bd = dd; best = h; }
  }
  return bd <= 3 * 3600e3 ? best : null;
}

// Les quatre xifres de la capçalera de la fitxa
// Neu: del sensor més proper si n'hi ha; si no, la prevista (mai "no hi ha dades"). wait: encara es carrega (…)
export function factsHTML(g, { today, now = null, sensors = null, wait = true }) {
  const na = wait ? '…' : '—';
  const i0 = g ? todayIdx(g.top.days, today) : 0;
  const s = sensors?.[0];
  const cm = (v) => `${num(v, 0)}<small> cm</small>`;
  const box = (k, v, sub, cls = '', ic = '') => `<div class="nv-fact${cls ? ` ${cls}` : ''}"><p class="nv-fact__k">${k}</p><p class="nv-fact__v"><span>${v}</span>${ic}</p><p class="nv-fact__s">${sub || '&nbsp;'}</p></div>`;
  const out = [];
  if (s?.d24 != null) out.push(box('Neu nova en 24 h', cm(Math.max(0, s.d24)), `mesurada a ${esc(s.name)}`));
  else if (g) out.push(box('Neu prevista avui', cm(cm0(g.top.days[i0]?.snow)), 'al cim'));
  else out.push(box('Neu prevista avui', na, ''));
  if (s) out.push(box('Gruix de neu', cm(s.now), `${esc(s.name)}, ${thousands(s.alt)}\u00A0m`));
  else if (g) out.push(box('Neu en 7 dies', cm(snowSum(g.top.days, i0, 7)), 'prevista al cim'));
  else out.push(box('Neu en 7 dies', na, ''));
  const T = now?.top;
  out.push(box('Ara al cim', T?.temp != null ? `${num(T.temp, 0)}°` : na, T?.code != null ? wmoText(T.code).toLowerCase() : '', '', T?.temp != null ? codeIcon(T.code, 26) : ''));
  out.push(box('Ratxes al cim', T?.gust != null ? `${Math.round(T.gust)}<small> km/h</small>` : na, T?.dir != null ? `vent ${dirFrom(T.dir)}` : '', (T?.gust ?? 0) >= 60 ? 'is-warn' : ''));
  return out.join('');
}

// Sensors de neu a prop d'una estació ('' si no n'hi ha: llavors la fitxa amaga la secció)
export function sensorsHTML(sensors) {
  if (!sensors?.length) return '';
  return `<div class="nv-sens">${sensors
    .map((s) => `<div class="nv-card nv-sen"><p class="nv-sen__n">${esc(s.name)}</p><p class="nv-sen__m">${thousands(s.alt)}\u00A0m · a ${Math.round(s.km)}\u00A0km</p><p class="nv-sen__v"><b>${num(s.now, 0)}</b> cm</p><p class="nv-sen__d${(s.d24 ?? 0) >= 1 ? ' is-up' : ''}">${s.d24 == null ? 'gruix de neu ara' : s.d24 >= 1 ? `+${num(s.d24, 0)} cm en 24 h` : s.d24 <= -1 ? `${num(s.d24, 0)} cm en 24 h` : 'igual que ahir'}</p></div>`)
    .join('')}</div>`;
}

export { wmoText };
