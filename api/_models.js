// Previsions dels models per a "Quin model encerta més al Cadí?" (/models, src/lib/models.js). Cada nit, api/arxiva.js
// hi afegeix la previsió que feia cada model el dia abans i dos dies abans per a cada estació de la xarxa, de l'API
// de passades anteriors d'Open-Meteo (previous-runs-api.open-meteo.com, sense clau): temperatura i pluja hora a hora,
// a l'alçada de l'estació (Open-Meteo hi corregeix la temperatura del model), resumides en màxima, mínima i pluja del
// dia en hora local.
//
// Fitxers: dades/models/AAAA-MM.json
//   { month, models: [id, …], days: { 'AAAA-MM-DD': { <estació>: { <model>: [tmax1, tmin1, pluja1, tmax2, tmin2, pluja2] } } } }
//   (1: la previsió feta el dia abans; 2: la feta dos dies abans; null on el model no en té)
// Si falten dies dels darrers BACK (la primera nit, o després d'una nit que falla), se'n recuperen fins a CHUNK per
// nit, a més d'ahir. Una petició per model amb les 12 estacions (si un model falla, els altres es desen igualment).
import { STATIONS } from '../src/lib/stations.js';

const API = 'https://previous-runs-api.open-meteo.com/v1/forecast';
// Identificadors d'Open-Meteo. Si un no existeix a l'API de passades anteriors, la seva petició falla i els altres es
// desen igualment (el motiu surt al registre d'arxiva i a la resposta, modelErrors)
export const MODELS = ['best_match', 'ecmwf_ifs', 'ecmwf_ifs025', 'ecmwf_aifs025_single', 'icon_seamless', 'meteofrance_seamless', 'gfs_seamless', 'ukmo_seamless', 'gem_seamless'];
const BACK = 92; // dies enrere que es mantenen complets
const CHUNK = 31; // dies recuperats per nit, com a molt
const VARS = ['temperature_2m_previous_day1', 'temperature_2m_previous_day2', 'precipitation_previous_day1', 'precipitation_previous_day2'];

const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const addDays = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

// Una petició d'un model per a totes les estacions i els dies [from, to] → { 'AAAA-MM-DD': { id: [6 valors] } }
export async function fetchModel(model, from, to, fetchFn = fetch) {
  const p = new URLSearchParams({
    latitude: STATIONS.map((s) => s.lat).join(','),
    longitude: STATIONS.map((s) => s.lng).join(','),
    elevation: STATIONS.map((s) => s.alt).join(','),
    hourly: VARS.join(','),
    models: model,
    timezone: 'Europe/Madrid',
    start_date: from,
    end_date: addDays(to, 1), // la pluja de l'hora 00 de l'endemà és la de les 23-24 h del dia
  });
  const r = await fetchFn(`${API}?${p}`, { signal: AbortSignal.timeout(20000) });
  const text = await r.text();
  if (!r.ok) throw new Error(`${model}: HTTP ${r.status} ${text.slice(0, 160)}`);
  let j = JSON.parse(text);
  if (!Array.isArray(j)) j = [j];
  const out = {};
  j.forEach((loc, k) => {
    const st = STATIONS[k];
    const h = loc?.hourly;
    if (!st || !h?.time) return;
    // Amb un sol model, les variables no porten el nom del model al final; per si de cas, s'accepten les dues formes
    const col = (v) => h[v] ?? h[`${v}_${model}`] ?? null;
    const T1 = col(VARS[0]), T2 = col(VARS[1]), P1 = col(VARS[2]), P2 = col(VARS[3]);
    const byDay = new Map();
    h.time.forEach((t, i) => {
      // Temperatura: les hores 00-23 del dia; pluja: les hores 01-24 (cada valor és la de l'hora anterior)
      const day = t.slice(0, 10), hh = +t.slice(11, 13);
      const pday = hh === 0 ? addDays(day, -1) : day;
      for (const [d, isT] of [[day, true], [pday, false]]) {
        if (d < from || d > to) continue;
        if (!byDay.has(d)) byDay.set(d, { t1: [], t2: [], p1: [], p2: [] });
        const o = byDay.get(d);
        if (isT) {
          if (T1?.[i] != null) o.t1.push(T1[i]);
          if (T2?.[i] != null) o.t2.push(T2[i]);
        } else {
          if (P1?.[i] != null) o.p1.push(P1[i]);
          if (P2?.[i] != null) o.p2.push(P2[i]);
        }
      }
    });
    for (const [d, o] of byDay) {
      // Només dies sencers (24 hores)
      const mx = (a) => (a.length >= 24 ? r1(Math.max(...a)) : null);
      const mn = (a) => (a.length >= 24 ? r1(Math.min(...a)) : null);
      const sum = (a) => (a.length >= 24 ? r1(a.reduce((x, y) => x + y, 0)) : null);
      const v = [mx(o.t1), mn(o.t1), sum(o.p1), mx(o.t2), mn(o.t2), sum(o.p2)];
      if (v.every((x) => x == null)) continue;
      (out[d] ||= {})[st.id] = v;
    }
  });
  return out;
}

// Els dies que cal demanar: ahir i, si en falten dels darrers BACK, el tros més antic (fins a CHUNK dies)
export function plan(have, yesterday) {
  const missing = [];
  for (let k = BACK - 1; k >= 0; k--) {
    const d = addDays(yesterday, -k);
    if (!have.has(d)) missing.push(d);
  }
  const spans = [];
  if (missing.includes(yesterday)) spans.push([yesterday, yesterday]);
  const old = missing.filter((d) => d !== yesterday);
  if (old.length) {
    const from = old[0];
    // Fins on arriben els que falten seguits a partir del primer (com a molt CHUNK dies)
    let to = from;
    while (old.includes(addDays(to, 1)) && to < addDays(from, CHUNK - 1)) to = addDays(to, 1);
    spans.push([from, to]);
  }
  return spans;
}

// ghJson(path) → el JSON del fitxer o null. Retorna { files: { camí: text }, days: [dies nous], errors }
export async function modelsUpdate(ghJson, yesterday, fetchFn = fetch) {
  const months = new Set();
  for (let k = 0; k < BACK; k++) months.add(addDays(yesterday, -k).slice(0, 7));
  const docs = {};
  for (const m of months) {
    try {
      docs[m] = (await ghJson(`dades/models/${m}.json`)) || null;
    } catch {
      docs[m] = null;
    }
  }
  const have = new Set(Object.values(docs).flatMap((d) => Object.keys(d?.days || {})));
  const spans = plan(have, yesterday);
  if (!spans.length) return { files: {}, days: [], errors: [] };
  const errors = [];
  const got = {};
  for (const [from, to] of spans) {
    const res = await Promise.allSettled(MODELS.map((m) => fetchModel(m, from, to, fetchFn)));
    res.forEach((r, i) => {
      if (r.status === 'rejected') {
        errors.push(String(r.reason?.message ?? r.reason).slice(0, 200));
        return;
      }
      for (const [d, sts] of Object.entries(r.value))
        for (const [id, v] of Object.entries(sts)) ((got[d] ||= {})[id] ||= {})[MODELS[i]] = v;
    });
  }
  const days = Object.keys(got).filter((d) => !have.has(d)).sort();
  const files = {};
  for (const d of days) {
    const m = d.slice(0, 7);
    docs[m] ||= { month: m, models: MODELS, days: {} };
    docs[m].models = [...new Set([...(docs[m].models || []), ...MODELS])];
    docs[m].days[d] = got[d];
  }
  for (const m of new Set(days.map((d) => d.slice(0, 7)))) {
    const doc = docs[m];
    const sorted = Object.fromEntries(Object.entries(doc.days).sort(([a], [b]) => a.localeCompare(b)));
    // Un dia per línia: fitxer petit i encara llegible
    const lines = Object.entries(sorted).map(([d, v]) => `    ${JSON.stringify(d)}: ${JSON.stringify(v)}`);
    files[`dades/models/${m}.json`] = `{\n  "month": ${JSON.stringify(m)},\n  "models": ${JSON.stringify(doc.models)},\n  "days": {\n${lines.join(',\n')}\n  }\n}\n`;
  }
  return { files, days, errors };
}
