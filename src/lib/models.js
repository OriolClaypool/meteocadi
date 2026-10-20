// "Quin model encerta més al Cadí?" (/models): la previsió de cada model (dades/models/AAAA-MM.json, que desa cada nit
// api/arxiva.js amb api/_models.js) comparada amb el que han mesurat les estacions de la xarxa (l'arxiu diari, amb el
// control de qualitat de src/lib/archive.js). En temps de build.
//
// - Temperatura: error mitjà absolut de la màxima i de la mínima del dia (°C) i la tendència (biaix: + vol dir que el
//   model fa més calor de la que fa). Els dies sospitosos d'una estació (suspicious) no compten.
// - Pluja: si el dia plou (1 mm o més) o no, a la previsió i a l'estació: encert = dies que coincideixen.
// - lead 1: la previsió feta el dia abans; lead 2: la de dos dies abans.
import fs from 'node:fs';
import path from 'node:path';
import { loadDays, suspicious } from './archive.js';
import { BY_ID } from './stations.js';

const ROOT = path.resolve(process.env.DADES_DIR || 'dades', 'models');
const RAIN = 1; // mm: a partir d'aquí el dia "plou"

// Nom i qui fa cada model (l'ordre és el de la taula quan empaten)
export const MODEL_INFO = {
  best_match: { name: 'Open-Meteo', who: 'Combinació de models que fa servir Meteocadí' },
  ecmwf_ifs: { name: 'ECMWF IFS', who: 'Centre Europeu de Predicció a Mitjà Termini (9 km)' },
  ecmwf_ifs025: { name: 'ECMWF IFS 25 km', who: 'El mateix model europeu, a menys resolució' },
  ecmwf_aifs025_single: { name: 'ECMWF AIFS', who: 'Centre Europeu, amb intel·ligència artificial' },
  icon_seamless: { name: 'ICON', who: 'Servei Meteorològic d’Alemanya (DWD)' },
  meteofrance_seamless: { name: 'AROME i ARPEGE', who: 'Météo-France' },
  gfs_seamless: { name: 'GFS', who: 'Servei Meteorològic dels Estats Units (NOAA)' },
  ukmo_seamless: { name: 'UKMO', who: 'Met Office, del Regne Unit' },
  gem_seamless: { name: 'GEM', who: 'Servei Meteorològic del Canadà' },
};

let _cache = null;
// { 'AAAA-MM-DD': { estació: { model: [tmax1, tmin1, pluja1, tmax2, tmin2, pluja2] } } }
export function loadModels() {
  if (_cache) return _cache;
  const days = {};
  if (fs.existsSync(ROOT)) {
    for (const f of fs.readdirSync(ROOT).sort()) {
      if (!/^\d{4}-\d{2}\.json$/.test(f)) continue;
      try {
        Object.assign(days, JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')).days || {});
      } catch {
        /* fitxer malmès: l'ignorem */
      }
    }
  }
  _cache = days;
  return days;
}

const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// n: els darrers n dies arxivats que tinguin previsions; group: 'alta' o 'vall' (null, totes); lead: 1 o 2
export function verify({ n = 30, lead = 1, group = null } = {}) {
  const F = loadModels();
  const days = loadDays().filter((d) => F[d.date]).slice(-n);
  if (!days.length) return null;
  const k = lead === 2 ? 3 : 0;
  const acc = {};
  for (const day of days) {
    const bad = suspicious(day);
    for (const [id, obs] of Object.entries(day.stations)) {
      const st = BY_ID[id];
      if (!st || (group && st.group !== group)) continue;
      const fc = F[day.date]?.[id];
      if (!fc) continue;
      for (const [m, v] of Object.entries(fc)) {
        if (!MODEL_INFO[m] || !v) continue;
        const a = (acc[m] ||= { eMax: [], eMin: [], rain: { n: 0, ok: 0, hit: 0, miss: 0, fa: 0 } });
        if (!bad.has(id)) {
          if (v[k] != null && obs.tempHigh != null) a.eMax.push(v[k] - obs.tempHigh);
          if (v[k + 1] != null && obs.tempLow != null) a.eMin.push(v[k + 1] - obs.tempLow);
        }
        if (v[k + 2] != null && obs.precipTotal != null) {
          const f = v[k + 2] >= RAIN, o = obs.precipTotal >= RAIN;
          a.rain.n++;
          if (f === o) a.rain.ok++;
          if (f && o) a.rain.hit++;
          if (!f && o) a.rain.miss++;
          if (f && !o) a.rain.fa++;
        }
      }
    }
  }
  const rows = Object.entries(acc)
    .map(([m, a]) => {
      const maeMax = avg(a.eMax.map(Math.abs)), maeMin = avg(a.eMin.map(Math.abs));
      return {
        model: m,
        ...MODEL_INFO[m],
        n: Math.min(a.eMax.length, a.eMin.length),
        maeMax: r1(maeMax),
        maeMin: r1(maeMin),
        biasMax: r1(avg(a.eMax)),
        biasMin: r1(avg(a.eMin)),
        mae: maeMax == null || maeMin == null ? null : Math.round(((maeMax + maeMin) / 2) * 100) / 100,
        rain: a.rain.n ? { ...a.rain, acc: Math.round((100 * a.rain.ok) / a.rain.n) } : null,
      };
    })
    // Un model amb molt poques dades (va començar tard o falla sovint) no entra al rànquing
    .filter((r) => r.mae != null && r.n >= 20)
    .sort((a, b) => a.mae - b.mae || Object.keys(MODEL_INFO).indexOf(a.model) - Object.keys(MODEL_INFO).indexOf(b.model));
  const rainy = days.filter((d) => Object.values(d.stations).some((s) => s.precipTotal != null && s.precipTotal >= RAIN)).length;
  return { from: days[0].date, to: days[days.length - 1].date, days: days.length, rainy, rows };
}

// Hi ha prou dades per publicar la comparació (si no, la pàgina ho diu, és noindex i queda fora del mapa del web)
export const modelsReady = (v = verify({ n: 30 })) => !!v && v.days >= 7 && v.rows.length >= 3;
