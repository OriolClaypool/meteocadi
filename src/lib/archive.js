// Lectura de l'arxiu diari (dades/YYYY/YYYY-MM-DD.json) en temps de build.
// L'arxiu l'escriu cada nit api/arxiva.js; cada commit dispara un nou build a Vercel,
// així que les pàgines estàtiques sempre porten les dades del darrer dia complet.
import fs from 'node:fs';
import path from 'node:path';
import { STATIONS, BY_ID } from './stations.js';

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
            if (v && v.tempHigh != null && v.tempLow != null) stations[id] = v;
          }
          days.push({ date: j.date || f.slice(0, 10), stations });
        } catch {
          /* fitxer malmès: l'ignorem */
        }
      }
    }
  }
  _cache = days;
  return days;
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
export function suspicious(day) {
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

export function stationRecords(id) {
  const h = stationHistory(id);
  if (!h.length) return null;
  const best = (field, dir) =>
    h.reduce((a, b) => (b[field] == null ? a : !a || (dir > 0 ? b[field] > a[field] : b[field] < a[field]) ? b : a), null);
  const avg = (field) => {
    const v = h.map((x) => x[field]).filter((x) => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  return {
    days: h.length,
    from: h[h.length - 1].date,
    to: h[0].date,
    maxHigh: best('tempHigh', 1),
    minLow: best('tempLow', -1),
    maxGust: best('windgustHigh', 1),
    maxRain: best('precipTotal', 1),
    rainTotal: h.reduce((a, b) => a + (b.precipTotal ?? 0), 0),
    avgHigh: avg('tempHigh'),
    avgLow: avg('tempLow'),
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

// Estadístiques del mes estació per estació (per a /historial/AAAA-MM).
// Les temperatures d'un dia incomplet (vegeu suspicious) no compten.
export function monthStations(month) {
  return STATIONS.map((s) => {
    const rows = month.daysList
      .filter((d) => d.stations[s.id])
      .map((d) => ({ date: d.date, ...d.stations[s.id], susp: suspicious(d).has(s.id) }));
    const t = rows.filter((r) => !r.susp);
    const avg = (list, k) => {
      const v = list.map((r) => r[k]).filter((x) => x != null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const best = (list, k, dir) =>
      list.filter((r) => r[k] != null).reduce((a, b) => (!a || (dir > 0 ? b[k] > a[k] : b[k] < a[k]) ? b : a), null);
    const mx = best(t, 'tempHigh', 1);
    const mn = best(t, 'tempLow', -1);
    const gu = best(rows, 'windgustHigh', 1);
    return {
      station: s,
      days: rows.length,
      avgHigh: avg(t, 'tempHigh'),
      avgLow: avg(t, 'tempLow'),
      max: mx ? { v: mx.tempHigh, date: mx.date } : null,
      min: mn ? { v: mn.tempLow, date: mn.date } : null,
      gust: gu ? { v: gu.windgustHigh, date: gu.date } : null,
      rain: rows.reduce((a, r) => a + (r.precipTotal ?? 0), 0),
      rainDays: rows.filter((r) => (r.precipTotal ?? 0) >= 0.2).length,
    };
  }).filter((x) => x.days > 0);
}
