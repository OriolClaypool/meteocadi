// Episodis destacats: dies seguits amb alguna xifra fora del normal a la xarxa, detectats a partir de l'arxiu diari
// (dades mesurades, mai previsions). Cada nit, amb el nou dia arxivat, el build torna a calcular-los.
// Els llindars són aquí per poder-los ajustar.
import { loadDays, suspicious } from './archive.js';
import { STATIONS, BY_ID, shortName, fmtAlt } from './stations.js';
import { num, parseDay, deMonth, monthName, dayShort, cap, desDe, tempColorLight } from './format.js';

export const LLINDARS = {
  // mm en una estació: en un sol dia, o acumulats en dies seguits de pluja (dies amb ≥ 1 mm en alguna estació)
  pluja: { dia: 25, total: 40 },
  // km/h de ratxa màxima, segons si l'estació és d'alta muntanya o de vall
  vent: { alta: 120, vall: 70 },
  // °C de temperatura màxima
  calor: { max: 34 },
  // °C de temperatura mínima
  fred: { alta: -15, vall: -8 },
};
// Perquè una estació espatllada no generi un episodi, cal que una altra estació també ho noti
const SUPORT = { pluja: 5, vent: 45, calor: 32, fred: -3 };
// Valors impossibles (errors de sensor): no es tenen en compte
const SANE = { rain: 300, gust: 200, tmax: 45, tmin: -35 };
// Per dir "la dada més alta des que hi ha arxiu" l'estació ha de tenir prou dies arxivats
const MIN_DAYS_RECORD = 60;

export const TYPES = {
  pluja: 'Pluja intensa',
  vent: 'Vent fort',
  calor: 'Calor intensa',
  fred: 'Fred intens',
  glacada: 'Primera glaçada',
};

// ---- dates en català ----
const D = (iso) => parseDay(iso).getUTCDate();
const M = (iso) => parseDay(iso).getUTCMonth() + 1;
const Y = (iso) => parseDay(iso).getUTCFullYear();
const nextDay = (iso) => new Date(parseDay(iso).getTime() + 864e5).toISOString().slice(0, 10);
const elNum = (n) => (n === 1 || n === 11 ? `l'${n}` : `el ${n}`);
const delNum = (n) => (n === 1 || n === 11 ? `de l'${n}` : `del ${n}`);
const alNum = (n) => (n === 1 || n === 11 ? `a l'${n}` : `al ${n}`);
// "el 14 d'octubre", "l'1 d'octubre"
export const elDia = (iso) => `${elNum(D(iso))} ${deMonth(M(iso))}`;
// "dc 14"
const diaCurt = (iso) => `${dayShort(iso)} ${D(iso)}`;

// "del 14 al 16 d'octubre de 2026" / "el 14 d'octubre de 2026" (sense any si year = false)
export function rangeText(a, b, year = true) {
  const y = (iso) => (year ? ` de ${Y(iso)}` : '');
  if (a === b) return `${elDia(a)}${y(a)}`;
  if (Y(a) !== Y(b)) return `${delNum(D(a))} ${deMonth(M(a))} de ${Y(a)} ${alNum(D(b))} ${deMonth(M(b))} de ${Y(b)}`;
  if (M(a) === M(b)) return `${delNum(D(a))} ${alNum(D(b))} ${deMonth(M(a))}${y(a)}`;
  return `${delNum(D(a))} ${deMonth(M(a))} ${alNum(D(b))} ${deMonth(M(b))}${y(a)}`;
}
// "el 14 d'octubre" / "entre el 14 i el 16 d'octubre"
function whenText(a, b) {
  if (a === b) return elDia(a);
  if (M(a) === M(b) && Y(a) === Y(b)) return `entre ${elNum(D(a))} i ${elNum(D(b))} ${deMonth(M(a))}`;
  return `entre ${elNum(D(a))} ${deMonth(M(a))} i ${elNum(D(b))} ${deMonth(M(b))}`;
}
// "d'octubre" / "de setembre i octubre"
function monthsText(keys) {
  const ms = keys.map((k) => Number(k.slice(5, 7)));
  return ms.length === 1 ? deMonth(ms[0]) : `${deMonth(ms[0])} i ${ms.slice(1).map((m) => monthName(m)).join(' i ')}`;
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const nameList = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} i ${xs[xs.length - 1]}`);

// ---- lectures ----
const suspCache = new WeakMap();
const susp = (d) => {
  if (!suspCache.has(d)) suspCache.set(d, suspicious(d));
  return suspCache.get(d);
};
function vals(day, field, lo, hi, skip) {
  const out = [];
  for (const [id, v] of Object.entries(day.stations)) {
    const s = BY_ID[id];
    if (!s || v?.[field] == null || skip?.has(id)) continue;
    const x = Number(v[field]);
    if (isNaN(x) || x < lo || x > hi) continue;
    out.push({ id, s, v: x });
  }
  return out;
}
const rainV = (d) => vals(d, 'precipTotal', 0, SANE.rain);
const gustV = (d) => vals(d, 'windgustHigh', 0, SANE.gust);
const maxV = (d) => vals(d, 'tempHigh', -40, SANE.tmax, susp(d));
const minV = (d) => vals(d, 'tempLow', SANE.tmin, 40, susp(d));

// Dies seguits que compleixen test (un dia sense arxiu talla la sèrie)
function runs(days, test) {
  const out = [];
  let cur = [];
  for (const d of days) {
    if (test(d)) {
      if (cur.length && nextDay(cur[cur.length - 1].date) !== d.date) {
        out.push(cur);
        cur = [];
      }
      cur.push(d);
    } else if (cur.length) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

// Per estació: valor de cada dia i el millor (dir 1 = màxim, -1 = mínim), o la suma
function perStation(run, get, dir) {
  const map = new Map();
  for (const d of run) {
    for (const x of get(d)) {
      const e = map.get(x.id) || { s: x.s, byDay: {}, best: null, total: 0 };
      e.byDay[d.date] = x.v;
      e.total += x.v;
      if (!e.best || (dir > 0 ? x.v > e.best.v : x.v < e.best.v)) e.best = { v: x.v, date: d.date };
      map.set(x.id, e);
    }
  }
  return [...map.values()];
}

// ---- context de tot l'arxiu (mitjanes del mes, rècords) ----
function context(days) {
  const last = days[days.length - 1]?.date;
  const first = days[0]?.date;
  const byStation = {};
  for (const d of days) {
    for (const [id, v] of Object.entries(d.stations)) {
      if (!BY_ID[id]) continue;
      (byStation[id] ||= []).push({ date: d.date, ...v, susp: susp(d).has(id) });
    }
  }
  const monthOpen = (key) => {
    if (!last || last.slice(0, 7) !== key) return false;
    const lastDay = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)).getUTCDate();
    return D(last) < lastDay;
  };
  const inMonths = (id, keys) => (byStation[id] || []).filter((r) => keys.includes(r.date.slice(0, 7)));
  const avg = (rows, f) => {
    const v = rows.filter((r) => !r.susp && r[f] != null).map((r) => Number(r[f]));
    return v.length >= 10 ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  // És el valor més extrem de tot l'arxiu de l'estació? (només si n'hi ha prou dies)
  const isRecord = (id, f, v, dir) => {
    const rows = (byStation[id] || []).filter((r) => r[f] != null && !(f.startsWith('temp') && r.susp));
    if (rows.length < MIN_DAYS_RECORD) return false;
    return rows.every((r) => (dir > 0 ? Number(r[f]) <= v : Number(r[f]) >= v));
  };
  const firstOf = (id) => byStation[id]?.[0]?.date;
  return { last, first, byStation, monthOpen, inMonths, avg, isRecord, firstOf };
}

const monthKeys = (dates) => [...new Set(dates.map((d) => d.slice(0, 7)))];
const recordSince = (ctx, id) => `${desDe(ctx.firstOf(id))} de ${Y(ctx.firstOf(id))}`;
const card = (k, v, u, sub) => ({ k, v, u, sub });
const cell = (t, o = {}) => ({ t, ...o });

// Taula per estació: valor principal, dia (si n'hi ha més d'un) i, fins a 7 dies, una columna per dia
function stationTable(rows, run, { main, mainOf, dayOf, fmt, fmtDay = fmt, color }) {
  const dates = run.map((d) => d.date);
  const perDay = dates.length > 1 && dates.length <= 7;
  const head = [cell('Estació'), cell('Altitud', { n: 1 }), cell(main, { n: 1 })];
  if (dates.length > 1 && !perDay) head.push(cell('Dia', { n: 1 }));
  if (perDay) dates.forEach((d) => head.push(cell(diaCurt(d), { n: 1 })));
  const body = rows.map((r) => {
    const v = mainOf(r);
    const cells = [cell(shortName(r.s), { href: `/estacions/${r.s.slug}` }), cell(fmtAlt(r.s.alt), { n: 1 }), cell(fmt(v), { n: 1, b: 1, color: color?.(v) })];
    if (dates.length > 1 && !perDay) cells.push(cell(dayOf(r) ? diaCurt(dayOf(r)) : '—', { n: 1 }));
    if (perDay) dates.forEach((d) => cells.push(cell(r.byDay[d] == null ? '—' : fmtDay(r.byDay[d]), { n: 1, color: color?.(r.byDay[d]) })));
    return cells;
  });
  return { head, body };
}

// ---- constructors per tipus ----
function base(type, run, ctx) {
  const start = run[0].date;
  const end = run[run.length - 1].date;
  return {
    type,
    slug: `${start}-${type}`,
    start,
    end,
    ndays: run.length,
    dates: run.map((d) => d.date),
    months: monthKeys(run.map((d) => d.date)),
    open: end === ctx.last,
    label: TYPES[type],
  };
}

function rainEpisode(run, ctx) {
  const L = LLINDARS.pluja;
  const rows = perStation(run, rainV, 1).sort((a, b) => b.total - a.total);
  if (!rows.length) return null;
  const top = rows[0];
  const dayTop = rows.reduce((a, b) => (!a || b.best.v > a.best.v ? b : a), null);
  if (!(top.total >= L.total || dayTop.best.v >= L.dia)) return null;
  if (rows.filter((r) => r.total >= SUPORT.pluja).length < 2) return null;

  const e = base('pluja', run, ctx);
  const W = whenText(e.start, e.end);
  const n20 = rows.filter((r) => r.total >= 20).length;
  const wet = rows.filter((r) => r.total >= 0.2).length;
  const mean = rows.reduce((a, r) => a + r.total, 0) / rows.length;
  const p = [];
  p.push(`${cap(W)} van caure ${num(top.total)} mm ${top.s.a} (${fmtAlt(top.s.alt)}), la xifra més alta de la xarxa.`);
  if (n20 >= 2) p.push(`${n20 === rows.length ? `Totes les ${rows.length} estacions amb dades` : `En total, ${n20} de les ${rows.length} estacions amb dades`} van superar els 20 mm, i la mitjana de la xarxa va ser de ${num(mean)} mm.`);
  else if (rows[1]?.total > 0) p.push(`La segona estació amb més pluja va ser ${shortName(rows[1].s)}, amb ${num(rows[1].total)} mm, i la mitjana de la xarxa va ser de ${num(mean)} mm.`);
  if (e.ndays > 1) p.push(`El dia més plujós va ser ${elDia(dayTop.best.date)}, amb ${num(dayTop.best.v)} mm ${dayTop.s.a}.`);
  const month = ctx.inMonths(top.s.id, e.months).reduce((a, r) => a + (Number(r.precipTotal) || 0), 0);
  const open = e.months.some(ctx.monthOpen);
  if (month > 0) {
    const pct = Math.round((top.total / month) * 100);
    p.push(
      pct >= 99
        ? `${cap(top.s.a)}, és tota la pluja ${monthsText(e.months)}${open ? ' fins ara' : ''}.`
        : `${cap(top.s.a)}, aquest episodi és el ${pct} % de la pluja ${monthsText(e.months)}${open ? ' fins ara' : ''}, que suma ${num(month)} mm.`,
    );
  }
  if (ctx.isRecord(dayTop.s.id, 'precipTotal', dayTop.best.v, 1)) p.push(`És el dia més plujós ${dayTop.s.a} des que hi ha arxiu (${recordSince(ctx, dayTop.s.id)}).`);
  const cold = run.some((d) => minV(d).some((x) => x.v <= 1 && (Number(d.stations[x.id]?.precipTotal) || 0) > 0));
  e.note = cold
    ? 'Amb temperatures properes als 0 °C, una part de la precipitació podria haver estat en forma de neu. Els pluviòmetres de la xarxa no mesuren bé la neu, i la xifra real pot ser més alta.'
    : '';
  e.paras = p;
  e.headline = { v: num(top.total), u: 'mm', where: shortName(top.s) };
  e.cards =
    e.ndays > 1
      ? [card('Màxim acumulat', num(top.total), 'mm', shortName(top.s)), card('Màxim en un dia', num(dayTop.best.v), 'mm', `${shortName(dayTop.s)} · ${diaCurt(dayTop.best.date)}`), card('Mitjana de la xarxa', num(mean), 'mm', `${rows.length} estacions`), card('Durada', String(e.ndays), 'dies', rangeText(e.start, e.end, false))]
      : [card('Màxim en un dia', num(top.total), 'mm', shortName(top.s)), card('Mitjana de la xarxa', num(mean), 'mm', `${rows.length} estacions`), card('Estacions amb 20 mm o més', String(n20), `de ${rows.length}`, ''), card('Estacions amb pluja', String(wet), `de ${rows.length}`, '')];
  e.table = stationTable(rows, run, { main: e.ndays > 1 ? 'Total' : 'Pluja', mainOf: (r) => r.total, dayOf: (r) => r.best.date, fmt: (v) => `${num(v)} mm`, fmtDay: (v) => num(v) });
  e.tableTitle = 'Pluja a cada estació';
  return e;
}

function windEpisode(run, ctx) {
  const L = LLINDARS.vent;
  const rows = perStation(run, gustV, 1).sort((a, b) => b.best.v - a.best.v);
  if (!rows.length) return null;
  const e = base('vent', run, ctx);
  const top = rows[0];
  const other = rows.find((r) => r.s.group !== top.s.group);
  const nA = rows.filter((r) => r.s.group === 'alta' && r.best.v >= L.alta).length;
  const nV = rows.filter((r) => r.s.group !== 'alta' && r.best.v >= L.vall).length;
  const W = whenText(e.start, e.end);
  const p = [];
  p.push(`${cap(W)} va bufar vent fort: la ratxa més forta va ser de ${num(top.best.v, 0)} km/h ${top.s.a} (${fmtAlt(top.s.alt)})${e.ndays > 1 ? `, ${elDia(top.best.date)}` : ''}.`);
  if (other) p.push(`${top.s.group === 'alta' ? 'A la vall' : "A alta muntanya"}, la ratxa més forta va ser de ${num(other.best.v, 0)} km/h ${other.s.a}.`);
  if (nA + nV >= 2) {
    // "3 estacions d'alta muntanya van superar els 100 km/h i 2 de vall, els 60 km/h."
    const a = nA ? `${plural(nA, "estació d'alta muntanya", "estacions d'alta muntanya")} ${nA === 1 ? 'va' : 'van'} superar els ${L.alta} km/h` : '';
    const v = nV ? (nA ? `${nV} de vall, els ${L.vall} km/h` : `${plural(nV, 'estació de vall', 'estacions de vall')} ${nV === 1 ? 'va' : 'van'} superar els ${L.vall} km/h`) : '';
    p.push(`${cap([a, v].filter(Boolean).join(' i '))}.`);
  }
  const key = top.best.date.slice(0, 7);
  const monthMax = STATIONS.flatMap((s) => ctx.inMonths(s.id, [key]).map((r) => Number(r.windgustHigh)).filter((x) => !isNaN(x) && x <= SANE.gust));
  if (monthMax.length && top.best.v >= Math.max(...monthMax)) p.push(`És la ratxa més forta ${deMonth(M(top.best.date))} a la xarxa${ctx.monthOpen(key) ? ' fins ara' : ''}.`);
  if (ctx.isRecord(top.s.id, 'windgustHigh', top.best.v, 1)) p.push(`${cap(top.s.a)}, és la ratxa més forta des que hi ha arxiu (${recordSince(ctx, top.s.id)}).`);
  e.note = "Les ratxes són la màxima diària que registra l'anemòmetre de cada estació. Als cims i carenes, el vent pot ser més fort que el que marca l'estació més propera.";
  e.paras = p;
  e.headline = { v: num(top.best.v, 0), u: 'km/h', where: shortName(top.s) };
  e.cards = [
    card('Ratxa més forta', num(top.best.v, 0), 'km/h', `${shortName(top.s)}${e.ndays > 1 ? ` · ${diaCurt(top.best.date)}` : ''}`),
    other ? card(top.s.group === 'alta' ? 'Ratxa més forta a la vall' : "Ratxa més forta a alta muntanya", num(other.best.v, 0), 'km/h', shortName(other.s)) : null,
    card('Estacions per sobre del llindar', String(nA + nV), `de ${rows.length}`, `${L.alta} km/h a dalt, ${L.vall} a la vall`),
    card(e.ndays > 1 ? 'Durada' : 'Dia', e.ndays > 1 ? String(e.ndays) : String(D(e.start)), e.ndays > 1 ? 'dies' : deMonth(M(e.start)), e.ndays > 1 ? rangeText(e.start, e.end, false) : ''),
  ].filter(Boolean);
  e.table = stationTable(rows, run, { main: 'Ratxa màxima', mainOf: (r) => r.best.v, dayOf: (r) => r.best.date, fmt: (v) => `${num(v, 0)} km/h`, fmtDay: (v) => num(v, 0) });
  e.tableTitle = 'Ratxa màxima a cada estació';
  return e;
}

function heatEpisode(run, ctx) {
  const rows = perStation(run, maxV, 1).sort((a, b) => b.best.v - a.best.v);
  if (!rows.length) return null;
  const e = base('calor', run, ctx);
  const top = rows[0];
  const hi = [...rows].sort((a, b) => b.s.alt - a.s.alt)[0];
  const n30 = rows.filter((r) => r.best.v >= 30).length;
  const W = whenText(e.start, e.end);
  const p = [];
  p.push(`${cap(W)} va fer molta calor: la màxima més alta va ser de ${num(top.best.v)} °C ${top.s.a} (${fmtAlt(top.s.alt)})${e.ndays > 1 ? `, ${elDia(top.best.date)}` : ''}.`);
  if (n30 >= 2) p.push(`${n30} de les ${rows.length} estacions amb dades van arribar als 30 °C o més.`);
  if (e.ndays > 1) p.push(`Van ser ${e.ndays} dies seguits amb ${LLINDARS.calor.max} °C o més en alguna estació de la xarxa.`);
  if (hi && hi !== top && hi.best.v >= 18) p.push(`Fins i tot ${hi.s.a}, a ${fmtAlt(hi.s.alt)}, la màxima va ser de ${num(hi.best.v)} °C.`);
  const key = top.best.date.slice(0, 7);
  const avg = ctx.avg(ctx.inMonths(top.s.id, [key]), 'tempHigh');
  if (avg != null && top.best.v - avg >= 1) p.push(`${cap(top.s.a)}, són ${num(top.best.v - avg)} °C més que la mitjana de les màximes ${deMonth(M(top.best.date))}${ctx.monthOpen(key) ? ' fins ara' : ''} (${num(avg)} °C).`);
  if (ctx.isRecord(top.s.id, 'tempHigh', top.best.v, 1)) p.push(`És la màxima més alta ${top.s.a} des que hi ha arxiu (${recordSince(ctx, top.s.id)}).`);
  e.note = '';
  e.paras = p;
  e.headline = { v: num(top.best.v), u: '°C', where: shortName(top.s) };
  e.cards = [
    card('Màxima més alta', num(top.best.v), '°C', `${shortName(top.s)}${e.ndays > 1 ? ` · ${diaCurt(top.best.date)}` : ''}`),
    card('Estacions amb 30 °C o més', String(n30), `de ${rows.length}`, ''),
    hi && hi !== top ? card('Màxima a alta muntanya', num(hi.best.v), '°C', `${shortName(hi.s)} · ${fmtAlt(hi.s.alt)}`) : null,
    card(e.ndays > 1 ? 'Durada' : 'Dia', e.ndays > 1 ? String(e.ndays) : String(D(e.start)), e.ndays > 1 ? 'dies' : deMonth(M(e.start)), e.ndays > 1 ? rangeText(e.start, e.end, false) : ''),
  ].filter(Boolean);
  e.table = stationTable(rows, run, { main: 'Màxima', mainOf: (r) => r.best.v, dayOf: (r) => r.best.date, fmt: (v) => `${num(v)}°`, color: tempColorLight });
  e.tableTitle = 'Màxima a cada estació';
  return e;
}

function coldEpisode(run, ctx) {
  const rows = perStation(run, minV, -1).sort((a, b) => a.best.v - b.best.v);
  if (!rows.length) return null;
  const e = base('fred', run, ctx);
  const top = rows[0];
  const other = rows.find((r) => r.s.group !== top.s.group);
  const below = rows.filter((r) => r.best.v < 0).length;
  const W = whenText(e.start, e.end);
  const p = [];
  p.push(`${cap(W)} va fer molt de fred: la mínima més baixa va ser de ${num(top.best.v)} °C ${top.s.a} (${fmtAlt(top.s.alt)})${e.ndays > 1 ? `, ${elDia(top.best.date)}` : ''}.`);
  if (other) p.push(`${top.s.group === 'alta' ? 'A la vall' : 'A alta muntanya'}, la mínima més baixa va ser de ${num(other.best.v)} °C ${other.s.a}.`);
  p.push(below === rows.length ? `Totes les estacions amb dades van baixar de 0 °C.` : `${below} de les ${rows.length} estacions amb dades van baixar de 0 °C.`);
  if (e.ndays > 1) p.push(`El fred va durar ${e.ndays} dies seguits.`);
  const key = top.best.date.slice(0, 7);
  const avg = ctx.avg(ctx.inMonths(top.s.id, [key]), 'tempLow');
  if (avg != null && avg - top.best.v >= 1) p.push(`${cap(top.s.a)}, són ${num(avg - top.best.v)} °C menys que la mitjana de les mínimes ${deMonth(M(top.best.date))}${ctx.monthOpen(key) ? ' fins ara' : ''} (${num(avg)} °C).`);
  if (ctx.isRecord(top.s.id, 'tempLow', top.best.v, -1)) p.push(`És la mínima més baixa ${top.s.a} des que hi ha arxiu (${recordSince(ctx, top.s.id)}).`);
  e.note = '';
  e.paras = p;
  e.headline = { v: num(top.best.v), u: '°C', where: shortName(top.s) };
  e.cards = [
    card('Mínima més baixa', num(top.best.v), '°C', `${shortName(top.s)}${e.ndays > 1 ? ` · ${diaCurt(top.best.date)}` : ''}`),
    other ? card(top.s.group === 'alta' ? 'Mínima a la vall' : 'Mínima a alta muntanya', num(other.best.v), '°C', shortName(other.s)) : null,
    card('Estacions sota 0 °C', String(below), `de ${rows.length}`, ''),
    card(e.ndays > 1 ? 'Durada' : 'Dia', e.ndays > 1 ? String(e.ndays) : String(D(e.start)), e.ndays > 1 ? 'dies' : deMonth(M(e.start)), e.ndays > 1 ? rangeText(e.start, e.end, false) : ''),
  ].filter(Boolean);
  e.table = stationTable(rows, run, { main: 'Mínima', mainOf: (r) => r.best.v, dayOf: (r) => r.best.date, fmt: (v) => `${num(v)}°`, color: tempColorLight });
  e.tableTitle = 'Mínima a cada estació';
  return e;
}

// Primera glaçada de cada temporada (d'agost a juliol) en una estació de vall
function frostEpisodes(days, ctx) {
  const out = [];
  const seasons = new Map();
  for (const d of days) {
    const season = M(d.date) >= 8 ? Y(d.date) : Y(d.date) - 1;
    if (!seasons.has(season)) seasons.set(season, []);
    seasons.get(season).push(d);
  }
  let prev = null;
  for (const [season, list] of [...seasons.entries()].sort((a, b) => a[0] - b[0])) {
    // Si l'arxiu comença amb la tardor avançada, no podem saber quina va ser la primera
    if (list[0].date > `${season}-09-30`) {
      prev = null;
      continue;
    }
    const day = list.find((d) => minV(d).some((x) => x.s.group === 'vall' && x.v <= 0));
    if (!day) continue;
    const e = base('glacada', [day], ctx);
    e.open = false;
    e.label = M(day.date) >= 8 && M(day.date) <= 11 ? 'Primera glaçada de la tardor' : 'Primera glaçada de la temporada';
    const all = minV(day).sort((a, b) => a.v - b.v);
    const vall = all.filter((x) => x.s.group === 'vall');
    const alta = all.filter((x) => x.s.group === 'alta');
    const top = vall[0];
    const also = vall.slice(1).filter((x) => x.v <= 0);
    const p = [];
    p.push(`${cap(elDia(day.date))} va glaçar per primer cop ${M(day.date) <= 11 && M(day.date) >= 8 ? 'aquesta tardor' : 'aquesta temporada'} en una estació de vall de la xarxa: ${num(top.v)} °C ${top.s.a} (${fmtAlt(top.s.alt)}).`);
    if (also.length) p.push(`També ${also.length === 1 ? 'va' : 'van'} baixar de 0 °C ${nameList(also.map((x) => `${shortName(x.s)} (${num(x.v)} °C)`))}.`);
    else if (vall[1]) p.push(`A la resta d'estacions de vall, la mínima més baixa va ser de ${num(vall[1].v)} °C ${vall[1].s.a}.`);
    if (alta[0]) p.push(`A alta muntanya, la mínima va ser de ${num(alta[0].v)} °C ${alta[0].s.a}.`);
    if (prev) p.push(`La temporada passada, la primera glaçada a la vall va ser ${elDia(prev.date)}${Y(prev.date) !== Y(day.date) ? ` de ${Y(prev.date)}` : ''}, amb ${num(prev.v)} °C ${prev.s.a}.`);
    e.note = '';
    e.paras = p;
    e.headline = { v: num(top.v), u: '°C', where: shortName(top.s) };
    e.cards = [
      card('Mínima a la vall', num(top.v), '°C', shortName(top.s)),
      card('Estacions de vall sota 0 °C', String(also.length + 1), `de ${vall.length}`, ''),
      alta[0] ? card('Mínima a alta muntanya', num(alta[0].v), '°C', shortName(alta[0].s)) : null,
      prev ? card('Temporada passada', String(D(prev.date)), deMonth(M(prev.date)), shortName(prev.s)) : null,
    ].filter(Boolean);
    const rows = all.map((x) => ({ s: x.s, best: { v: x.v, date: day.date }, byDay: { [day.date]: x.v } }));
    e.table = stationTable(rows, [day], { main: 'Mínima', mainOf: (r) => r.best.v, dayOf: () => day.date, fmt: (v) => `${num(v)}°`, color: tempColorLight });
    e.tableTitle = 'Mínima a cada estació';
    out.push(e);
    prev = { date: day.date, v: top.v, s: top.s };
  }
  return out;
}

let _cache = null;
// Tots els episodis, del més recent al més antic
export function episodes() {
  if (_cache) return _cache;
  const days = loadDays().filter((d) => Object.keys(d.stations).length);
  const ctx = context(days);
  const out = [];
  for (const run of runs(days, (d) => rainV(d).some((x) => x.v >= 1))) {
    const e = rainEpisode(run, ctx);
    if (e) out.push(e);
  }
  const L = LLINDARS;
  const windHit = (d) => {
    const g = gustV(d);
    return g.some((x) => x.v >= (x.s.group === 'alta' ? L.vent.alta : L.vent.vall)) && g.filter((x) => x.v >= SUPORT.vent).length >= 2;
  };
  const heatHit = (d) => {
    const t = maxV(d);
    return t.some((x) => x.v >= L.calor.max) && t.filter((x) => x.v >= SUPORT.calor).length >= 2;
  };
  const coldHit = (d) => {
    const t = minV(d);
    return t.some((x) => x.v <= (x.s.group === 'alta' ? L.fred.alta : L.fred.vall)) && t.filter((x) => x.v <= SUPORT.fred).length >= 2;
  };
  for (const run of runs(days, windHit)) out.push(windEpisode(run, ctx));
  for (const run of runs(days, heatHit)) out.push(heatEpisode(run, ctx));
  for (const run of runs(days, coldHit)) out.push(coldEpisode(run, ctx));
  out.push(...frostEpisodes(days, ctx));
  const list = out.filter(Boolean).sort((a, b) => (a.end === b.end ? a.start.localeCompare(b.start) : b.end.localeCompare(a.end)));
  for (const e of list) {
    e.h1 = { main: e.label, em: rangeText(e.start, e.end, false) };
    e.rangeText = rangeText(e.start, e.end, true);
    e.published = nextDay(e.end);
  }
  _cache = list;
  return list;
}

export function episodesInMonth(key) {
  return episodes().filter((e) => e.months.includes(key));
}
