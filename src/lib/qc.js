// Control de qualitat de les dades de la xarxa Meteocadí (estacions de Weather Underground).
// Els valors impossibles, o incoherents amb les estacions veïnes, queden fora (a null) mentre duri el problema.
// No hi ha cap llista d'estacions espatllades per mantenir: es torna a comprovar a cada lectura (/api/ara) i a
// cada dia de l'arxiu (src/lib/archive.js), així que una estació torna a sortir sola quan les dades tornen a ser bones.
import { BY_ID } from './stations.js';

// Límits físics: fora d'aquí és un error del sensor o un valor de "sense dades" (WU en fa servir de -99, -9999…)
export const LIMITS = {
  temp: [-40, 48],
  hum: [1, 100],
  wind: [0, 200],
  gust: [0, 250],
  dir: [0, 360],
  pres: [850, 1090],
  rain: [0, 500],
};
export const inRange = (v, [a, b]) => v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) >= a && Number(v) <= b;
export const clean = (v, lim) => (inRange(v, lim) ? Number(v) : null);

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function km(a, b) {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.hypot(x, y) * 6371;
}

// values: { id: valor } (els null no compten). Retorna els ids sospitosos.

// Pluviòmetre que no recull (embussat o espatllat). Hi ha molta diferència de pluja d'un lloc a l'altre, així que
// només es descarta en dos casos clars:
// a) una estació a menys de 3 km i amb menys de 400 m de desnivell recull 4 mm o més i aquesta, menys d'una cinquena
//    part (Cerdanyola-Forcat, 0,25 mm, i Cerdanyola-Poble, a 1 km, 8,4 mm);
// b) a la resta de la xarxa ha plogut (mediana de 5 mm o més i 3 de cada 4 estacions amb 1 mm o més) i aquesta marca 0.
export function rainSuspects(values) {
  const out = new Set();
  const ids = Object.keys(values).filter((id) => values[id] != null && BY_ID[id]);
  for (const id of ids) {
    const v = values[id];
    const s = BY_ID[id];
    const near = ids.filter((j) => j !== id && km(s, BY_ID[j]) <= 3 && Math.abs(BY_ID[j].alt - s.alt) <= 400);
    if (near.some((j) => values[j] >= 4 && v < values[j] / 5)) {
      out.add(id);
      continue;
    }
    const others = ids.filter((j) => j !== id).map((j) => values[j]);
    if (v === 0 && others.length >= 4 && median(others) >= 5 && others.filter((x) => x >= 1).length >= others.length * 0.75) out.add(id);
  }
  return out;
}

// Anemòmetre encallat: ratxa màxima de 0 (o cap) quan la mediana de la resta de la xarxa és de 20 km/h o més
export function windSuspects(values) {
  const out = new Set();
  const ids = Object.keys(values).filter((id) => BY_ID[id]);
  for (const id of ids) {
    const others = ids.filter((j) => j !== id && values[j] != null).map((j) => values[j]);
    if (!values[id] && others.length >= 4 && median(others) >= 20) out.add(id);
  }
  return out;
}

// Pluja impossible en una sola estació: 20 mm o més mentre cap altra estació de la xarxa (com a mínim 3 amb dades)
// arriba a una desena part ni a 2 mm. Un xàfec local pot deixar molta més pluja en un lloc que en un altre, però no
// 250 mm al Coll de Pal amb 0 a tot arreu (29/3/2026, un error del pluviòmetre).
export function rainSpikes(values) {
  const out = new Set();
  const ids = Object.keys(values).filter((id) => values[id] != null && BY_ID[id]);
  for (const id of ids) {
    const v = values[id];
    const others = ids.filter((j) => j !== id).map((j) => values[j]);
    if (v >= 20 && others.length >= 3 && Math.max(...others) < Math.max(2, v / 10)) out.add(id);
  }
  return out;
}

// Ratxa impossible en una sola estació: 100 km/h o més, amb el vent mitjà del dia per sota d'una dotzena part de la
// ratxa i cap altra estació per sobre del 45 % (l'anemòmetre del Pedraforca en dona de 150 a 210 km/h en dies de
// calma). Un temporal real a dalt (Tancalaporta, 160 km/h amb 49 km/h de mitjana) no hi entra. gusts i avgs: { id: valor }.
export function gustSpikes(gusts, avgs = {}) {
  const out = new Set();
  const ids = Object.keys(gusts).filter((id) => gusts[id] != null && BY_ID[id]);
  for (const id of ids) {
    const g = gusts[id];
    const others = ids.filter((j) => j !== id).map((j) => gusts[j]);
    const avg = avgs[id];
    if (g >= 100 && others.length >= 3 && Math.max(...others) < g * 0.45 && (avg == null || avg < g / 12)) out.add(id);
  }
  return out;
}

// Pluja d'ahir repetida: algunes consoles (la Pobla de Lillet, la Nou de Berguedà i Cerdanyola-Poble) no posen a zero
// el comptador de pluja a mitjanit sinó una o dues hores més tard, i el resum diari de WU (el valor més alt del dia)
// torna a donar el total del dia abans. Quan el valor és exactament el mateix que el del dia anterior (1 mm o més),
// la pluja real d'aquell dia no se sap (és com a molt aquest valor): es deixa a null. prev i cur: { id: valor }.
export function rainCarryOver(prev, cur) {
  const out = new Set();
  for (const [id, v] of Object.entries(cur)) {
    const p = prev?.[id];
    if (v != null && p != null && v >= 1 && Math.abs(v - p) < 0.005) out.add(id);
  }
  return out;
}

// Pluja des de mitjanit a partir d'una sèrie del comptador de la consola (precipTotal de cada lectura, en ordre):
// només compten els increments. Si el comptador es posa a zero més tard de mitjanit, el valor de després és la pluja
// des de la posada a zero; el primer valor del dia (que pot ser el total d'ahir) és el punt de partida.
// Retorna l'acumulat a cada lectura.
export function rainFromCounter(values) {
  const out = [];
  let acc = 0, prev = null;
  for (const v of values) {
    if (v == null || !Number.isFinite(v) || v < 0) { out.push(prev == null ? null : acc); continue; }
    if (prev != null) acc += v >= prev ? v - prev : v;
    prev = v;
    out.push(Math.round(acc * 100) / 100);
  }
  return out;
}

// Temperatura incoherent: a més de maxDiff graus de la mediana de les estacions d'altitud semblant (±300 m, com a
// mínim 2). Amb inversió tèrmica hi pot haver diferències grans entre fons de vall i cims, per això només es
// compara amb estacions de la mateixa franja i el marge és ample: només salten els errors grossos.
export function tempSuspects(values, maxDiff = 8) {
  const out = new Set();
  const ids = Object.keys(values).filter((id) => values[id] != null && BY_ID[id]);
  for (const id of ids) {
    const near = ids.filter((j) => j !== id && Math.abs(BY_ID[j].alt - BY_ID[id].alt) <= 300).map((j) => values[j]);
    if (near.length >= 2 && Math.abs(values[id] - median(near)) > maxDiff) out.add(id);
  }
  return out;
}

// Pics aïllats d'una sèrie de temperatura: un punt que s'allunya més de 5 °C dels dos veïns (en la mateixa direcció)
// en menys de mitja hora. t: temps en segons; v: valors (es retorna una còpia amb els pics a null).
export function despike(t, v, jump = 5) {
  const out = [...v];
  for (let i = 1; i < v.length - 1; i++) {
    const a = v[i - 1], b = v[i], c = v[i + 1];
    if (a == null || b == null || c == null || t[i + 1] - t[i - 1] > 1800) continue;
    if (Math.abs(b - a) > jump && Math.abs(b - c) > jump && Math.sign(b - a) === Math.sign(b - c)) out[i] = null;
  }
  return out;
}
