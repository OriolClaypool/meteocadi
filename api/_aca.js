// Pluviòmetres de l'Agència Catalana de l'Aigua (ACA) per al mapa de Catalunya: la pluja d'avui i de les darreres 24
// hores en uns 60 punts de les conques internes (Llobregat, Cardener, Ter, Fluvià, Muga, Tordera, Besòs, Foix, Gaià,
// Francolí, Siurana…), molts al Berguedà, el Solsonès i el Ripollès, on la XEMA en té pocs. Dades obertes en temps
// real de l'ACA (plataforma Sentilo, sense clau):
//   catàleg: https://aplicacions.aca.gencat.cat/sdim2/apirest/catalog?componentType=pluviometre
//            proveïdor PLUVIOMETREACA-EST; per sensor: location "lat lng", componentDesc "Abrera (Llobregat)",
//            type 0012 i unit mm/h ("Intensitat de precipitació"), componentAdditionalInfo (Comarca, Terme municipal,
//            Estat…). No hi ha l'altitud.
//   dades:   https://aplicacions.aca.gencat.cat/sdim2/apirest/data/PLUVIOMETREACA-EST?from=…&to=…&limit=…
//            → { sensors: [{ sensor, observations: [{ value: "1.2", timestamp: "20/10/2026T11:35:00", time: <ms> }] }] }
// Cada lectura és la intensitat de precipitació (mm/h) dels 5 minuts que acaben a l'hora de la lectura (UTC): la
// pluja d'una lectura és la intensitat / 12 (els valors van de 1,2 en 1,2 mm/h: 0,1 mm cada 5 minuts). from i to
// (dd/MM/yyyyTHH:mm:ss, UTC) hi entren tots dos; de tot el proveïdor, com a molt 50 lectures per sensor i petició (les
// més noves de la finestra, encara que limit sigui més gran; d'un sol sensor, 200), i de vegades n'hi ha de repetides.
// Arriben amb uns 5-10 minuts de retard. Comprovat el 20/10/2026 (amb el navegador: 50 lectures per sensor).
import { midnightOf, ymdMadrid } from './_xema.js';

const BASE = 'https://aplicacions.aca.gencat.cat/sdim2/apirest';
const PROVIDER = 'PLUVIOMETREACA-EST';
const STEP = 5 * 60e3;
const CHUNK = 235 * 60e3; // 3 h 55 min: 48 lectures com a molt per sensor i petició (el màxim de l'API és 50)
const MAX_RATE = 400; // mm/h ("Rang màxim" dels sensors): per sobre, és un error
const HEADERS = { 'User-Agent': 'meteocadi.cat', Accept: 'application/json' };
export const SOURCE = "Agència Catalana de l'Aigua (pluviòmetres, dades obertes en temps real)";

const r1 = (v) => Math.round(v * 10) / 10;
// Textos que es pinten a la pàgina: sense < > " i amb els espais nets
const plain = (s) => String(s ?? '').replace(/[<>"]/g, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
const SMALL = new Set(['de', 'del', 'dels', 'la', 'les', 'el', 'els', 'i', 'a']);
// "PLA DE L'ESTANY" → "Pla de l'Estany"; "ABRERA" → "Abrera"
export function titleCa(s) {
  return plain(s)
    .toLowerCase()
    .split(' ')
    .map((w, i) => {
      if (!w || (i > 0 && SMALL.has(w))) return w;
      const m = /^([dl]['’])(.*)$/.exec(w);
      const cap = (x) => (x ? x[0].toUpperCase() + x.slice(1) : x);
      return m ? (i > 0 ? m[1] : cap(m[1])) + cap(m[2]) : cap(w);
    })
    .join(' ');
}
// "LA SELVA" i "SELVA" → "Selva" (com els noms de comarca de la XEMA)
const comarca = (s) => titleCa(s).replace(/^(La|El|Les|Els) /, '');
// Noms del catàleg que es corregeixen
const NAMES = {
  '430496-002-ANA011': 'Cornudella de Montsant, assut (Siurana)', // "Cornudella de M_Assut (Siurana)"
  '170221-002-ANA002': "La Bisbal d'Empordà (Daró)",
};

// "20/10/2026T11:35:00" (UTC)
const two = (n) => String(n).padStart(2, '0');
export const fmtAca = (ms) => {
  const d = new Date(ms);
  return `${two(d.getUTCDate())}/${two(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}T${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}`;
};
const parseAca = (s) => {
  const m = /^(\d\d)\/(\d\d)\/(\d{4})T(\d\d):(\d\d):(\d\d)/.exec(String(s || ''));
  return m ? Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]) : NaN;
};

async function getJson(url, fetchFn) {
  const r = await fetchFn(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`ACA: HTTP ${r.status} a ${url.replace(BASE, '')}`);
  return r.json();
}

// Els pluviòmetres (es guarden 6 hores a la instància; si el catàleg falla, es fa servir el que hi havia)
let catMemo = null;
async function catalog(fetchFn) {
  if (catMemo && Date.now() - catMemo.at < 6 * 3600e3) return catMemo.list;
  try {
    const j = await getJson(`${BASE}/catalog?componentType=pluviometre`, fetchFn);
    const prov = (j?.providers || []).find((p) => p.provider === PROVIDER);
    const list = [];
    for (const s of prov?.sensors || []) {
      // Només la intensitat de precipitació en mm/h (si mai n'hi afegeixen d'altres, no es barregen)
      if (s.type !== '0012' && s.unit !== 'mm/h') continue;
      if (s.publicAccess === false || s.componentPublicAccess === false) continue;
      const info = s.componentAdditionalInfo || {};
      if (/fora/i.test(info.Estat || '')) continue; // "Fora de servei"
      const [lat, lng] = String(s.location || '').trim().split(/\s+/).map(Number);
      if (!(lat > 40.4 && lat < 42.95 && lng > 0.1 && lng < 3.4)) continue;
      const name = NAMES[s.sensor] || plain(s.componentDesc) || plain(s.sensor);
      if (!name) continue;
      list.push({
        sensor: String(s.sensor),
        name: name[0].toUpperCase() + name.slice(1),
        lat: Math.round(lat * 1e5) / 1e5,
        lng: Math.round(lng * 1e5) / 1e5,
        com: info.Comarca ? comarca(info.Comarca) : undefined,
        mun: info['Terme municipal'] ? titleCa(info['Terme municipal']) : undefined,
      });
    }
    if (!list.length) throw new Error('ACA: el catàleg no té cap pluviòmetre');
    catMemo = { at: Date.now(), list };
    return list;
  } catch (e) {
    if (catMemo) return catMemo.list;
    throw e;
  }
}

// Les lectures de [from, to] de tots els pluviòmetres, en trossos de menys de 4 hores (un dia sencer, 7 peticions alhora)
// → Map(sensor → Map(ms → mm/h))
async function readings(from, to, fetchFn) {
  const spans = [];
  for (let a = from; a < to; a += CHUNK) spans.push([a, Math.min(to, a + CHUNK)]);
  const parts = await Promise.all(spans.map(([a, b]) => getJson(`${BASE}/data/${PROVIDER}?from=${fmtAca(a)}&to=${fmtAca(b)}&limit=50`, fetchFn)));
  const by = new Map();
  for (const j of parts)
    for (const s of j?.sensors || []) {
      const id = String(s.sensor);
      if (!by.has(id)) by.set(id, new Map());
      const m = by.get(id);
      for (const o of s.observations || []) {
        const t = typeof o.time === 'number' ? o.time : parseAca(o.timestamp);
        const v = Number(o.value);
        if (!Number.isFinite(t) || o.value === '' || o.value == null || !Number.isFinite(v)) continue;
        m.set(t, v);
      }
    }
  return by;
}

// kind: 'today' (des de mitjanit, hora de Madrid), '24h' (les darreres 24 hores) o 'day' (el dia sencer date,
// 'AAAA-MM-DD'; l'ACA en guarda uns tres mesos). Retorna { updated, latest, period, source, complete (dia sencer: ja hi
// són les lectures fins a mitjanit), stations: [{ id, name, lat, lng, alt: null, com, mun, rain, rain1h, time, rinc? }] }.
// rinc: més de 2 hores sense lectures (com a la XEMA): el total quedaria curt i el mapa no el fa servir.
export async function acaRain(kind, now = new Date(), fetchFn = fetch, date = null) {
  const nowMs = now.getTime();
  let start, end;
  if (kind === 'day') {
    start = midnightOf(date).getTime();
    end = midnightOf(ymdMadrid(new Date(start + 36 * 3600e3))).getTime();
  } else {
    start = kind === '24h' ? Math.floor(nowMs / STEP) * STEP - 24 * 3600e3 : midnightOf(ymdMadrid(now)).getTime();
    end = nowMs;
  }
  const [cat, by] = await Promise.all([catalog(fetchFn), readings(start, end, fetchFn)]);
  // Fins on arriben les dades: la lectura més nova de tots els pluviòmetres
  let newest = 0;
  for (const m of by.values()) for (const t of m.keys()) if (t > start && t <= end && t > newest) newest = t;
  // D'un dia sencer s'esperen les lectures fins a mitjanit; d'avui i de les 24 hores, fins a la més nova o, si l'ACA
  // va endarrerida, fins fa 15 minuts (amb més de 2 hores de retard, tots els totals queden marcats com a incomplets)
  const until = kind === 'day' ? end : Math.max(newest, Math.floor((nowMs - 15 * 60e3) / STEP) * STEP);
  const expected = newest ? Math.round((until - start) / STEP) : 0;
  const stations = [];
  for (const g of cat) {
    const m = by.get(g.sensor);
    if (!m || !expected) continue;
    let n = 0, sum = 0, last = 0, hour = 0;
    for (const [t, v] of m) {
      if (t <= start || t > until || v < 0 || v > MAX_RATE) continue;
      n++;
      sum += v / 12;
      if (t > until - 3600e3) hour += v / 12;
      if (t > last) last = t;
    }
    if (!n) continue;
    stations.push({
      id: `aca-${g.sensor.replace(/[^\w.-]/g, '')}`,
      name: g.name,
      lat: g.lat,
      lng: g.lng,
      alt: null,
      com: g.com,
      mun: g.mun,
      rain: r1(sum),
      rain1h: r1(hour),
      time: new Date(last).toISOString(),
      ...(n < expected - 24 ? { rinc: true } : {}),
    });
  }
  return {
    updated: now.toISOString(),
    latest: newest ? new Date(newest).toISOString() : null,
    period: { kind, ...(date ? { date } : {}), start: new Date(start).toISOString(), end: kind === 'day' ? new Date(end).toISOString() : newest ? new Date(newest).toISOString() : null },
    // Un dia sencer és definitiu quan ja hi ha les lectures fins a mitjanit i fa 2 hores que ha acabat (alguns
    // pluviòmetres arriben més tard que d'altres)
    ...(kind === 'day' ? { complete: newest >= end - 15 * 60e3 && nowMs > end + 2 * 3600e3 } : {}),
    source: SOURCE,
    stations,
  };
}

export const _resetAca = () => { catMemo = null; };
