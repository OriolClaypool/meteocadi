// Lectura de l'arxiu diari (dades/YYYY/YYYY-MM-DD.json) en temps de build.
// L'arxiu l'escriu cada nit api/arxiva.js; cada commit dispara un nou build a Vercel,
// així que les pàgines estàtiques sempre porten les dades del darrer dia complet.
import fs from 'node:fs';
import path from 'node:path';
import { STATIONS, BY_ID } from './stations.js';
import { LIMITS, inRange, rainSuspects, windSuspects, tempSuspects, rainSpikes, gustSpikes, rainCarryOver } from './qc.js';

const ROOT = path.resolve(process.env.DADES_DIR || 'dades'); // DADES_DIR: només per a proves amb dades inventades
let _cache = null;

export function loadDays() {
  if (_cache) return _cache;
  const days = [];
  if (fs.existsSync(ROOT)) {
    for (const year of fs.readdirSync(ROOT).sort()) {
      const dir = path.join(ROOT, year);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const f of fs.readdirSync(dir).sort()) {
        if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) continue;
        try {
          const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
          const stations = {};
          for (const [id, v] of Object.entries(j.stations || {})) {
            // Sense temperatura vàlida (sensors exteriors apagats, valors de "sense dades"…) l'estació no compta aquell dia
            if (v && inRange(v.tempHigh, LIMITS.temp) && inRange(v.tempLow, LIMITS.temp) && v.tempHigh >= v.tempLow) stations[id] = { ...v };
          }
          // font: 'historic' als dies recuperats de l'historial de WU, d'abans de l'arxiu de cada nit
          days.push({ date: j.date || f.slice(0, 10), stations, ...(j.font ? { font: j.font } : {}) });
        } catch {
          /* fitxer malmès: l'ignorem */
        }
      }
    }
  }
  // Pluja d'ahir repetida (vegeu rainCarryOver): es compara amb el valor original del dia anterior
  const raw = days.map((d) => Object.fromEntries(Object.entries(d.stations).map(([id, v]) => [id, inRange(v.precipTotal, LIMITS.rain) ? Number(v.precipTotal) : null])));
  for (let i = 0; i < days.length; i++) {
    const prevDay = i > 0 && nextDate(days[i - 1].date) === days[i].date ? raw[i - 1] : null;
    // (els dies ja corregits amb les lectures de 5 minuts, amb precipTotalWU, no cal mirar-los)
    const cur = Object.fromEntries(Object.entries(raw[i]).filter(([id]) => days[i].stations[id].precipTotalWU === undefined));
    const carry = [...rainCarryOver(prevDay, cur)];
    for (const id of carry) days[i].stations[id].precipTotal = null;
    days[i].qc = { ...qcDay(days[i].stations), carry };
  }
  _cache = days;
  return days;
}
const nextDate = (iso) => new Date(Date.parse(`${iso}T12:00:00Z`) + 864e5).toISOString().slice(0, 10);

// Control de qualitat d'un dia (src/lib/qc.js): la pluja d'un pluviòmetre que no recull o que dona un pic
// impossible, i la ratxa d'un anemòmetre encallat o amb un pic impossible, queden a null; així cap pàgina (rècords,
// historial, episodis, estudi, mapa) no les fa servir. Retorna què s'ha descartat ({ rain: [ids], wind: [ids] }).
function qcDay(stations) {
  const field = (k, lim) => Object.fromEntries(Object.entries(stations).map(([id, v]) => [id, inRange(v[k], lim) ? Number(v[k]) : null]));
  for (const v of Object.values(stations)) {
    if (!inRange(v.precipTotal, LIMITS.rain)) v.precipTotal = null;
    if (!inRange(v.windgustHigh, LIMITS.gust)) v.windgustHigh = null;
  }
  const rainV = field('precipTotal', LIMITS.rain);
  const gustV = field('windgustHigh', LIMITS.gust);
  const rain = [...new Set([...rainSuspects(rainV), ...rainSpikes(rainV)])];
  const wind = [...new Set([...windSuspects(gustV), ...gustSpikes(gustV, field('windspeedAvg', LIMITS.wind))])];
  for (const id of rain) stations[id].precipTotal = null;
  for (const id of wind) stations[id].windgustHigh = null;
  return { rain, wind };
}

// Dies amb dades d'almenys la meitat de les estacions
export function completeDays() {
  return loadDays().filter((d) => Object.keys(d.stations).length >= Math.ceil(STATIONS.length / 2));
}

export function latestDay() {
  const d = completeDays();
  return d.length ? d[d.length - 1] : null;
}

// Estacions amb un dia probablement incomplet: rang diari molt petit comparat amb
// estacions d'altitud semblant (les de cim tenen rangs petits de manera natural).
// Es calcula una sola vegada per dia (amb anys d'arxiu, moltes pàgines el demanen per als mateixos dies).
const _susp = new WeakMap();
export function suspicious(day) {
  if (!_susp.has(day)) _susp.set(day, suspiciousOf(day));
  return _susp.get(day);
}
function suspiciousOf(day) {
  const out = new Set();
  const entries = Object.entries(day.stations).filter(([id]) => BY_ID[id]);
  for (const [id, v] of entries) {
    const alt = BY_ID[id].alt;
    const near = entries
      .filter(([j]) => j !== id && Math.abs(BY_ID[j].alt - alt) <= 350)
      .map(([, w]) => w.tempHigh - w.tempLow)
      .sort((a, b) => a - b);
    if (near.length < 2) continue;
    const m = near.length % 2 ? near[(near.length - 1) / 2] : (near[near.length / 2 - 1] + near[near.length / 2]) / 2;
    if (m >= 8 && v.tempHigh - v.tempLow < m * 0.35) out.add(id);
  }
  // Errors grossos: màxima o mínima a més de 10 °C de les estacions d'altitud semblant
  const field = (k) => Object.fromEntries(entries.map(([id, v]) => [id, Number(v[k])]));
  for (const id of tempSuspects(field('tempHigh'), 10)) out.add(id);
  for (const id of tempSuspects(field('tempLow'), 10)) out.add(id);
  return out;
}

function pick(day, field, dir, skip = new Set()) {
  let best = null;
  for (const [id, v] of Object.entries(day.stations)) {
    if (skip.has(id) || v[field] == null) continue;
    const x = Number(v[field]);
    if (!best || (dir > 0 ? x > best.v : x < best.v)) best = { id, v: x, station: BY_ID[id] };
  }
  return best;
}

// Extrems d'un dia a tota la xarxa
export function extremes(day) {
  if (!day) return null;
  const skip = suspicious(day);
  const rainy = Object.entries(day.stations).filter(([, v]) => (v.precipTotal ?? 0) > 0);
  return {
    date: day.date,
    n: Object.keys(day.stations).length,
    max: pick(day, 'tempHigh', 1, skip),
    min: pick(day, 'tempLow', -1, skip),
    gust: pick(day, 'windgustHigh', 1),
    rain: pick(day, 'precipTotal', 1),
    rainyStations: rainy.length,
  };
}

// Regressió de la màxima (o mínima) segons l'altitud, descartant valors anòmals
export function lapse(day, field = 'tempHigh') {
  if (!day) return null;
  const skip = suspicious(day);
  const pts = Object.entries(day.stations)
    .filter(([id, v]) => !skip.has(id) && v[field] != null && BY_ID[id])
    .map(([id, v]) => ({ id, alt: BY_ID[id].alt, t: Number(v[field]), station: BY_ID[id] }));
  const fit = (p) => {
    const n = p.length;
    const mx = p.reduce((a, b) => a + b.alt, 0) / n;
    const my = p.reduce((a, b) => a + b.t, 0) / n;
    const sxx = p.reduce((a, b) => a + (b.alt - mx) ** 2, 0);
    const slope = p.reduce((a, b) => a + (b.alt - mx) * (b.t - my), 0) / sxx;
    return { slope, intercept: my - slope * mx };
  };
  if (pts.length < 4) return null;
  const f = fit(pts);
  return { date: day.date, field, points: pts.sort((a, b) => a.alt - b.alt), slope100: f.slope * 100, intercept: f.intercept, slope: f.slope };
}

// Historial d'una estació (més recent primer)
export function stationHistory(id) {
  return loadDays()
    .filter((d) => d.stations[id])
    .map((d) => ({ date: d.date, ...d.stations[id] }))
    .reverse();
}

// Rècords d'una estació des que publica dades (cada valor, { v, date }). Les temperatures dels dies incomplets no compten.
export function stationRecords(id) {
  const rows = rowsOf(loadDays(), id);
  if (!rows.length) return null;
  const st = stats(rows);
  return {
    days: rows.length,
    from: rows[0].date,
    to: rows[rows.length - 1].date,
    maxHigh: st.max,
    minLow: st.min,
    maxGust: st.gust,
    maxRain: st.maxRain,
    rainTotal: st.rain,
    avgHigh: st.avgHigh,
    avgLow: st.avgLow,
  };
}

// Resum per mesos (a partir dels fitxers diaris)
export function months() {
  const byMonth = new Map();
  for (const d of loadDays()) {
    const key = d.date.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(d);
  }
  return [...byMonth.entries()]
    .map(([key, days]) => {
      const valid = days.filter((d) => Object.keys(d.stations).length);
      const all = (field, dir) => {
        let best = null;
        for (const d of valid) {
          const e = pick(d, field, dir, field.startsWith('temp') ? suspicious(d) : new Set());
          if (e && (!best || (dir > 0 ? e.v > best.v : e.v < best.v))) best = { ...e, date: d.date };
        }
        return best;
      };
      const rainByStation = {};
      for (const d of valid) for (const [id, v] of Object.entries(d.stations)) rainByStation[id] = (rainByStation[id] ?? 0) + (v.precipTotal ?? 0);
      const wettest = Object.entries(rainByStation).sort((a, b) => b[1] - a[1])[0];
      return {
        key,
        year: Number(key.slice(0, 4)),
        month: Number(key.slice(5, 7)),
        days: valid.length,
        first: valid[0]?.date,
        last: valid[valid.length - 1]?.date,
        max: all('tempHigh', 1),
        min: all('tempLow', -1),
        gust: all('windgustHigh', 1),
        wettest: wettest ? { id: wettest[0], v: wettest[1], station: BY_ID[wettest[0]] } : null,
        daysList: valid,
      };
    })
    .filter((m) => m.days > 0)
    .reverse();
}

// ---- Estadístiques d'una estació en un conjunt de dies (mes, any, tot l'arxiu) ----

// Files d'una estació: el dia, els seus valors i si les temperatures d'aquell dia són sospitoses (vegeu suspicious)
export function rowsOf(days, id) {
  return days.filter((d) => d.stations[id]).map((d) => ({ date: d.date, ...d.stations[id], susp: suspicious(d).has(id) }));
}

const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
// Dies de l'any (o fins a un dia, si l'any no s'ha acabat)
const daysInYear = (y) => ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365);

// Resum d'una llista de files: mitjanes (sense els dies sospitosos), extrems amb el dia, pluja total i dies de pluja.
// rainN: dies amb pluja vàlida (per saber si el total és complet).
export function stats(rows) {
  const t = rows.filter((r) => !r.susp);
  const avg = (list, k) => {
    const v = list.map((r) => r[k]).filter((x) => x != null && !isNaN(x)).map(Number);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const best = (list, k, dir) => {
    let b = null;
    for (const r of list) {
      if (r[k] == null || isNaN(r[k])) continue;
      if (!b || (dir > 0 ? r[k] > b.v : r[k] < b.v)) b = { v: Number(r[k]), date: r.date };
    }
    return b;
  };
  const rr = rows.filter((r) => r.precipTotal != null && !isNaN(r.precipTotal));
  return {
    days: rows.length,
    avgHigh: avg(t, 'tempHigh'),
    avgLow: avg(t, 'tempLow'),
    avgMean: avg(t, 'tempAvg'),
    max: best(t, 'tempHigh', 1),
    min: best(t, 'tempLow', -1),
    gust: best(rows, 'windgustHigh', 1),
    rain: rr.length ? rr.reduce((a, r) => a + Number(r.precipTotal), 0) : null,
    rainN: rr.length,
    rainDays: rr.filter((r) => r.precipTotal >= 0.2).length,
    maxRain: best(rr, 'precipTotal', 1),
  };
}

// Estadístiques del mes estació per estació (per a /historial/AAAA-MM).
// Les temperatures d'un dia incomplet (vegeu suspicious) no compten.
export function monthStations(month) {
  return STATIONS.map((s) => ({ station: s, ...stats(rowsOf(month.daysList, s.id)) })).filter((x) => x.days > 0);
}

// Un mes és complet per a una estació si té dades del 80 % dels dies (i de pluja, per al total de pluja)
const FULL = 0.8;

// Anys de l'arxiu (del més recent al més antic), amb els extrems de la xarxa i les dades per estació i per mes
let _years = null;
export function years() {
  if (_years) return _years;
  const byYear = new Map();
  for (const d of loadDays()) {
    if (!Object.keys(d.stations).length) continue;
    const y = Number(d.date.slice(0, 4));
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(d);
  }
  _years = [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, days]) => {
      const first = days[0].date;
      const last = days[days.length - 1].date;
      // Dies de l'any que cobreix l'arxiu (si l'arxiu comença o s'acaba a mig any, només aquest tros)
      const span = Math.round((Date.parse(`${last}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / 864e5) + 1;
      const open = last < `${year}-12-31`;
      const per = STATIONS.map((s) => {
        const rows = rowsOf(days, s.id);
        if (!rows.length) return null;
        const months = {};
        for (let m = 1; m <= 12; m++) {
          const key = `${year}-${String(m).padStart(2, '0')}`;
          const mr = rows.filter((r) => r.date.startsWith(key));
          if (!mr.length) continue;
          const st = stats(mr);
          const len = key === last.slice(0, 7) ? Number(last.slice(8)) : daysIn(year, m);
          months[m] = { ...st, full: st.days >= len * FULL, rainFull: st.rainN >= len * FULL };
        }
        const st = stats(rows);
        // Comparable amb la resta: dades de la major part de l'any (o del tros d'any que hi ha)
        return { station: s, ...st, months, full: st.days >= span * FULL, rainFull: st.rainN >= span * FULL };
      }).filter(Boolean);
      const top = (k, dir) => per.map((x) => x[k] && { ...x[k], station: x.station }).filter(Boolean).sort((a, b) => (dir > 0 ? b.v - a.v : a.v - b.v))[0] || null;
      const wettest = per.filter((x) => x.rainFull && x.rain != null).sort((a, b) => b.rain - a.rain)[0] || null;
      const monthKeys = [...new Set(days.map((d) => d.date.slice(0, 7)))];
      return {
        year, first, last, open, span, days: days.length,
        complete: !open && first === `${year}-01-01` && days.length >= daysInYear(year) * 0.95,
        stations: per,
        max: top('max', 1), min: top('min', -1), gust: top('gust', 1), maxRain: top('maxRain', 1),
        wettest: wettest ? { v: wettest.rain, station: wettest.station } : null,
        monthKeys,
        recovered: days.some((d) => d.font),
      };
    });
  return _years;
}

// Una estació any per any (del més recent al més antic)
export function stationYears(id) {
  return years()
    .map((y) => {
      const x = y.stations.find((r) => r.station.id === id);
      return x ? { year: y.year, open: y.open, ...x } : null;
    })
    .filter(Boolean);
}

// Clima de l'estació mes a mes: mitjanes dels mesos complets de tots els anys i rècords de cada mes.
// n: quants mesos complets hi ha per a cada mes de l'any (amb menys de 2, la mitjana diu poca cosa)
export function stationClimate(id) {
  const ys = stationYears(id);
  const out = [];
  for (let m = 1; m <= 12; m++) {
    const ms = ys.map((y) => y.months[m] && { ...y.months[m], year: y.year }).filter(Boolean);
    const full = ms.filter((x) => x.full);
    const rfull = ms.filter((x) => x.rainFull && x.rain != null);
    const mean = (list, k) => {
      const v = list.map((x) => x[k]).filter((v) => v != null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const rec = (k, dir) => ms.map((x) => x[k] && { ...x[k] }).filter(Boolean).sort((a, b) => (dir > 0 ? b.v - a.v : a.v - b.v))[0] || null;
    out.push({
      month: m,
      n: full.length,
      nRain: rfull.length,
      avgHigh: mean(full, 'avgHigh'),
      avgLow: mean(full, 'avgLow'),
      avgMean: mean(full, 'avgMean'),
      rain: mean(rfull, 'rain'),
      rainDays: mean(rfull, 'rainDays'),
      max: rec('max', 1),
      min: rec('min', -1),
      gust: rec('gust', 1),
      maxRain: rec('maxRain', 1),
    });
  }
  return out;
}

// Primer dia de l'arxiu de cada nit (els anteriors són recuperats de l'historial de WU)
export function firstNightly() {
  return loadDays().find((d) => !d.font)?.date ?? null;
}
