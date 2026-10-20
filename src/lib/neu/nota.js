// Meteocadí Neu: la nota de 0 a 10 de cada estació i dia, per triar on anar a esquiar. Es fa servir al build i al
// navegador (no importa res del servidor).
//
// La nota parteix de 10 i es multiplica per un factor de 0 a 1 de cada cosa que compta:
//  - Neu: el gruix i la neu nova dels 3 dies anteriors (més la meitat de la del mateix dia), i si hi ha plogut a sobre
//    o s'ha glaçat. Gruix: el del sensor de la XEMA si n'hi ha un al costat de l'estació (a 6 km o menys i a l'altura
//    de les pistes); si no, una mitjana dels sensors a menys de 30 km (com més a prop, més pes) i el gruix del model,
//    que compta com un sensor a uns 12 km. Un sol sensor no mana: a la carena de Salòria el vent s'emporta la neu
//    (19 cm el 17 de gener de 2026, quan Certascan en tenia 92). Els dies següents: el gruix d'avui més la neu prevista
//    i menys la que es fondrà.
//  - Temps per esquiar: la valoració del dia de ski.js (vent a dalt, nevada, pluja, boira, sol, fred, calor) sense el
//    plus de la neu nova, que ja compta a la Neu.
//  - Accés: neu prevista a les carreteres (la de la base de l'estació) i, avui, les incidències del Servei Català de
//    Trànsit causades per la neu o el gel a prop de l'estació (cadenes o carretera tallada) dels últims 3 dies. Les
//    obres no hi compten.
//  - Pistes obertes: la part de l'estació oberta, de l'estat de pistes oficial. Encara no n'hi ha dades (fora de
//    temporada les webs no en publiquen): sense dades, no compta ni surt.
// Com que es multiplica, quan una cosa falla molt (sense neu, vent molt fort, pluja) la nota baixa molt encara que la
// resta vagi bé, i mai és més alta que la pitjor de les parts.
import { rateDay } from '../ski.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const r1 = (v) => Math.round(v * 10) / 10;
const list = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} i ${xs[xs.length - 1]}`);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function distKm(a, b, c, d) {
  const t = (x) => (x * Math.PI) / 180;
  const h = Math.sin(t(c - a) / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(t(d - b) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// ------------------------------------------------------------------ escala i colors

// 4 molt bo (7,5 o més) · 3 bo (6 a 7,4) · 2 regular (4 a 5,9) · 1 dolent · 0 sense neu o tancada
export const notaLevel = (v) => (v == null ? null : v >= 7.5 ? 4 : v >= 6 ? 3 : v >= 4 ? 2 : 1);
export const NOTA_LABEL = { 4: 'Molt bo', 3: 'Bo', 2: 'Regular', 1: 'Dolent', 0: 'Sense neu' };
// Fons i text (contrast suficient per a xifres petites)
export const NOTA_FILL = { 4: '#0C8049', 3: '#7DBB3C', 2: '#F0B429', 1: '#CC3D27', 0: '#C9D3DF' };
export const NOTA_INK = { 4: '#FFFFFF', 3: '#0E1C2F', 2: '#0E1C2F', 1: '#FFFFFF', 0: '#3E4F66' };
export const notaFmt = (v) => (v == null ? '—' : v >= 10 ? '10' : v.toFixed(1).replace('.', ','));
// Color de cada part (factor de 0 a 1): com que es multipliquen, un 0,8 ja treu un 20 % de la nota. Verd: no en treu
// gairebé res; verd clar: poc; groc: força; vermell: molt.
export const partLevel = (f) => (f == null ? null : f >= 0.92 ? 4 : f >= 0.8 ? 3 : f >= 0.6 ? 2 : 1);

// ------------------------------------------------------------------ gruix de neu

// Sensors amb dada a menys de 30 km del cim i, com a molt, 300 m per sota de la base, del més proper al més llunyà
export function sensorsFor(resort, stations) {
  if (!stations?.length) return [];
  const { lat, lng } = resort.points[0];
  return stations
    .filter((s) => s.now != null && s.alt != null && s.alt >= resort.base - 300)
    .map((s) => ({ ...s, km: distKm(lat, lng, s.lat, s.lng) }))
    .filter((s) => s.km <= 30)
    .sort((a, b) => a.km - b.km);
}

// El sensor que és al costat de l'estació (a 6 km o menys i a l'altura de les pistes), si n'hi ha
export const directSensor = (resort, sens) => sens.find((s) => s.km <= 6 && s.alt >= resort.base - 300 && s.alt <= resort.top + 300) ?? null;

// Gruix del model el dia i (mitjana del cim i la base; null si no n'hi ha)
function modelDepth(g, i) {
  const t = g.top.days[i]?.depth, b = g.base?.days?.[i]?.depth;
  const v = [t, b].filter((x) => x != null);
  return v.length ? v.reduce((a, x) => a + x, 0) / v.length : null;
}

// Gruix d'avui: { cm, src: 'sensor' | 'estimat' | 'model', where: [noms dels sensors] } o null
export function depthToday(g, i0, sens) {
  const r = g.resort;
  const d = directSensor(r, sens);
  if (d) return { cm: d.now, src: 'sensor', where: [d.name], sensor: d };
  const m = modelDepth(g, i0);
  const parts = sens.map((s) => ({ v: s.now, w: 1 / (s.km + 3) ** 2, name: s.name }));
  if (m != null) parts.push({ v: m, w: 1 / 225, name: null });
  if (!parts.length) return null;
  const W = parts.reduce((a, p) => a + p.w, 0);
  const cm = parts.reduce((a, p) => a + p.v * p.w, 0) / W;
  const where = parts.filter((p) => p.name).slice(0, 2).map((p) => p.name);
  return { cm, src: where.length ? 'estimat' : 'model', where, sensor: null, model: m != null };
}

// Neu nova abans del dia i: els 3 dies anteriors (mesurada al sensor del costat, si n'hi ha, els dies passats) i la
// meitat de la del mateix dia (la que cau de nit, abans d'obrir)
function freshBefore(g, i, i0, direct) {
  const by = direct?.days?.length ? Object.fromEntries(direct.days.map((d) => [d.date, d.nou])) : null;
  let cm = 0;
  for (let j = i - 3; j < i; j++) {
    const d = g.top.days[j];
    if (!d) continue;
    const meas = j < i0 && by ? by[d.date] : null;
    cm += Math.max(0, meas != null ? meas : d.snow ?? 0);
  }
  return cm + 0.5 * Math.max(0, g.top.days[i]?.snow ?? 0);
}

// Pluja a dalt (hi cau aigua i gairebé gens de neu; com a ski.js)
const rainTop = (d) => d && (d.precip ?? 0) >= 1 && (d.snow ?? 0) < (d.precip ?? 0) * 0.4;
// Ha plogut a dalt el dia i o els dos d'abans, i no ha nevat prou després per tapar la crosta (10 cm)
function rainOnSnow(g, i) {
  for (let j = i; j >= i - 2; j--) {
    if (!rainTop(g.top.days[j])) continue;
    let after = 0;
    for (let x = j + 1; x < i; x++) after += Math.max(0, g.top.days[x]?.snow ?? 0);
    if (j < i) after += 0.5 * Math.max(0, g.top.days[i]?.snow ?? 0);
    return after < 10;
  }
  return false;
}

// ------------------------------------------------------------------ factors

// Neu: el gruix (fins a 0,85; per a l'esquí de fons n'hi ha prou amb menys neu) per la qualitat, més la neu nova
function fNeu(cm, fresh, q, fons) {
  const k = fons ? 15 : 22;
  const depth = 0.85 * (1 - Math.exp(-Math.max(0, cm) / k));
  const Q = q === 'pluja' ? 0.75 : q === 'dura' ? 0.9 : 1;
  const bonus = cm >= 15 ? 0.15 * Math.min(1, fresh / 25) : 0;
  return clamp(depth * Q + bonus);
}

const fTemps = (weather) => clamp((weather / 100) ** 0.6, 0.05, 1);

// Incidències de l'SCT que compten per a la nota: les de la neu o el gel que han començat fa menys de 3 dies. Les més
// velles són tancaments de temporada (el port de la Bonaigua, tot l'hivern), que no impedeixen arribar a l'estació per
// l'altra banda. El radi no distingeix la carretera d'accés de les altres de la zona: per això una carretera tallada
// treu menys que si fos segur que és l'accés.
const WINTER = /neu|nevad|gel|glaç|allau|cadenes|pneum[aà]tics d.hivern/i;
function sctAccess(items, now = Date.now()) {
  let best = null;
  for (const it of items ?? []) {
    const t = `${it.type} ${it.text} ${it.cause}`;
    if (!WINTER.test(t)) continue;
    const since = Date.parse(it.date);
    if (!isNaN(since) && now - since > 72 * 3600e3) continue;
    const cut = /tallad|tancad/i.test(t);
    const x = cut ? { f: 0.6, code: 'tallada', road: it.road } : { f: 0.75, code: 'cadenes', road: it.road };
    if (!best || x.f < best.f) best = x;
  }
  return best;
}

// ------------------------------------------------------------------ nota d'un dia

// g: grup de neu.js ({ resort, top, base }); i: índex del dia; i0: índex d'avui
// ctx: { depth (depthToday), direct (sensor del costat), transit (incidències a prop, només avui), pistes }
// pistes (quan n'hi hagi): { oberta: bool, km, de } (km oberts de km totals)
export function notaDay(g, i, i0, { depth = null, direct = null, transit = null, pistes = null } = {}) {
  const T = g.top.days[i];
  if (!T) return null;
  const B = g.base?.days?.[i] ?? T;
  const r = rateDay(g.top, g.base, i);
  if (!r) return null;
  const fons = g.resort.type === 'fons';
  // Gruix del dia: el d'avui, més la neu que caurà abans (assentada, el 70 %) i menys la que es fondrà (1 cm per
  // grau de màxima, entre el cim i la base). No el del model: el model fa créixer el gruix amb la seva neu, que als
  // cims es queda curta (fonts.js, snowAt).
  let cm = null;
  if (depth) {
    let delta = 0;
    for (let j = i0; j < i; j++) {
      const t = g.top.days[j], b = g.base?.days?.[j] ?? t;
      if (!t) continue;
      delta += 0.7 * Math.max(0, t.snow ?? 0) - Math.max(0, ((t.max ?? 0) + (b?.max ?? 0)) / 2);
    }
    cm = Math.max(0, depth.cm + delta);
  }
  const fresh = freshBefore(g, i, i0, direct);
  // Qualitat: pluja a dalt els 2 dies abans o el mateix dia; neu dura (pluja o calor el dia abans i glaçada de nit)
  let q = null;
  if (rainOnSnow(g, i)) q = 'pluja';
  else if (fresh < 5 && (T.min ?? 0) <= -3 && ((g.base?.days?.[i - 1]?.max ?? 0) >= 8 || rainTop(g.top.days[i - 1]))) q = 'dura';
  else if (fresh >= 10 && (T.max ?? 0) <= -2) q = 'pols';
  const neu = cm == null ? null : fNeu(cm, fresh, q, fons);
  // Accés: neu a la carretera (la prevista a la base) i, avui, les incidències de l'SCT. A Núria s'hi puja amb el
  // cremallera: la neu a la carretera no hi compta.
  const road = g.resort.tren ? 0 : Math.max(0, B.snow ?? 0) + 0.5 * Math.max(0, g.base?.days?.[i - 1]?.snow ?? 0);
  let acc = road >= 10 ? { f: 0.7, code: 'neu2' } : road >= 3 ? { f: 0.85, code: 'neu' } : { f: 1, code: null };
  const sct = i === i0 ? sctAccess(transit) : null;
  if (sct && sct.f <= acc.f) acc = sct; // l'observat mana sobre el previst
  // Pistes obertes (només amb dades oficials)
  const fp = pistes ? (pistes.oberta === false ? 0 : pistes.km != null && pistes.de ? clamp(Math.sqrt(pistes.km / pistes.de)) : 1) : null;
  const temps = fTemps(r.weather);
  const f = { neu, temps, acces: acc.f, pistes: fp };
  const v = neu == null ? null : r1(10 * neu * temps * acc.f * (fp ?? 1));
  const closed = fp === 0;
  const bare = cm != null && cm < 3 && fresh < 3;
  const level = v == null ? null : closed || bare ? 0 : notaLevel(v);
  const n = { v, level, label: closed ? 'Tancada' : NOTA_LABEL[level] ?? '', f, cm, fresh, q, depth, rate: r, acc, pistes, date: T.date, fons };
  n.why = whyText(n);
  return n;
}

// Notes dels 7 dies d'una estació (a partir d'avui): [nota de k = 0 … 6]
// ctx: { stations (sensors de /api/neu/mesurada), transit (incidències a prop de l'estació), pistes }
export function notesOf(g, today, { stations = null, transit = null, pistes = null } = {}) {
  const days = g?.top?.days ?? [];
  let i0 = days.findIndex((d) => d.date >= today);
  if (i0 < 0) return [];
  const sens = sensorsFor(g.resort, stations);
  const depth = depthToday(g, i0, sens);
  const direct = depth?.sensor ?? null;
  const out = [];
  for (let k = 0; k < 7 && days[i0 + k]; k++) out.push(notaDay(g, i0 + k, i0, { depth, direct, transit, pistes }));
  return out;
}

// ------------------------------------------------------------------ textos

// 85 cm · 1,2 m · 1 m (sense ",0")
const cmTxt = (cm) => (cm >= 100 ? `${(Math.round(cm / 10) / 10).toFixed(1).replace('.', ',').replace(/,0$/, '')}\u00A0m` : `${Math.round(cm)}\u00A0cm`);
// Gruix en paraules: el del sensor tal qual; l'estimat, arrodonit i amb "uns"
export const depthTxt = (n) => (n.cm == null ? '' : n.depth?.src === 'sensor' ? cmTxt(n.cm) : `uns ${cmTxt(n.cm >= 100 ? n.cm : Math.round(n.cm / 5) * 5)}`);

const WX = {
  sun: 'sol', calm: 'poc vent',
  wind3: 'vent molt fort a dalt', wind2: 'vent fort a dalt', wind1: 'una mica de vent a dalt',
  storm: 'temporal de neu', snowing: 'nevada', rain: 'pluja a la base', rainTop: 'pluja fins a dalt', cloud: 'cel tapat', fog: 'boira',
  cold2: 'molt fred a dalt', cold1: 'fred a dalt', hot: 'massa calor per a la neu', warm: 'neu humida a la tarda',
};
const ACC = { neu: 'neu a les carreteres', neu2: 'molta neu a les carreteres' };
export const accTxt = (a) => (a.code === 'cadenes' ? `cadenes a la ${a.road}` : a.code === 'tallada' ? `${a.road} tallada per la neu` : ACC[a.code] ?? '');

// Tota la neu que hi ha a terra és nova: n'ha caigut tanta o més que el gruix (la resta s'ha fos o assentat, o el
// gruix del sensor és més baix que la neu del model). Llavors no es diuen les dues xifres ("30 cm de neu, 45 cm de
// nova" es contradiu) sinó el gruix i que és nou: "uns 30 cm de neu nova".
export const allNew = (n) => n.cm != null && n.cm >= 3 && Math.round(n.fresh) >= 5 && Math.round(n.fresh) >= n.cm - 2;

// Frase del perquè: el bo i, després d'un "però", el dolent (com a molt 3 i 2 coses)
export function whyText(n) {
  if (n.label === 'Tancada') return 'Tancada.';
  const fresh = Math.round(n.fresh);
  // Sense base de neu, la resta no compta. Si n'ha caigut més de la que queda, es diu així (abans deia "només 19 cm
  // de nova" amb 5 cm a terra); les frases no tenen temps verbal perquè també valen per als dies que vénen.
  if (n.cm != null && n.cm < 10) {
    if (fresh < 5) return n.cm < 3 ? 'Sense neu a terra.' : 'Gairebé sense neu.';
    if (n.cm < 3) return `Gairebé sense neu: dels ${fresh}\u00A0cm de nova no en queda gairebé res.`;
    if (fresh > n.cm + 2) return `Gairebé sense neu: dels ${fresh}\u00A0cm de nova en queden ${depthTxt(n)}.`;
    return `Gairebé sense neu: només ${fresh}\u00A0cm de nova.`;
  }
  const good = [], bad = [];
  const nova = n.q === 'pols' ? 'pols' : 'nova';
  const tot = allNew(n);
  if (n.cm != null) {
    if (n.cm < 25) bad.push(`poca neu (${depthTxt(n)})`);
    else good.push(tot ? `${depthTxt(n)} de neu ${nova}` : `${depthTxt(n)} de neu`);
  }
  // La neu nova: "20 cm de nova" després del gruix; sola, "20 cm de neu nova"; amb fred, "de pols"
  // (amb poca neu a terra, la nova no és cap avantatge: es diu només que n'hi ha poca; si tota la neu és nova, ja
  // s'ha dit amb el gruix)
  const said = tot && n.cm >= 25;
  if (!said && fresh >= 5 && (n.cm == null || n.cm >= 25)) good.push(good.length ? `${fresh}\u00A0cm de ${nova}` : `${fresh}\u00A0cm de neu ${nova}`);
  else if (!said && n.q === 'pols') good.push('neu pols');
  if (n.q === 'pluja') bad.push('pluja sobre la neu');
  if (n.q === 'dura') bad.push('neu dura al matí');
  const g = n.rate.good.filter((c) => WX[c]), b = n.rate.bad.filter((c) => WX[c]);
  // El temps: si és bo, el bo; si no, el que el fa dolent
  if (n.f.temps >= 0.85) good.push(...g.slice(0, 2).map((c) => WX[c]));
  else bad.push(...b.slice(0, 2).map((c) => WX[c]));
  if (n.acc.code) bad.push(accTxt(n.acc));
  const G = good.slice(0, 3), Bd = bad.slice(0, 2);
  if (!G.length && !Bd.length) return '';
  if (!Bd.length) return `${cap(list(G))}.`;
  if (!G.length) return `${cap(list(Bd))}.`;
  return `${cap(list(G))}, però ${list(Bd)}.`;
}

// Text curt de cada part (per a les barres)
export function partTxt(n, key) {
  if (key === 'neu') {
    if (n.cm == null) return '';
    if (n.cm < 3) return 'Sense neu a terra';
    if (n.cm < 10) return `Gairebé sense neu (${depthTxt(n)})`;
    const fresh = Math.round(n.fresh);
    const q = n.q === 'pluja' ? ' · pluja a sobre' : n.q === 'dura' ? ' · dura al matí' : '';
    // Tota nova: "Uns 30 cm de neu nova" (no "Uns 30 cm · 45 cm nous")
    if (allNew(n)) return `${cap(depthTxt(n))} de neu ${n.q === 'pols' ? 'pols' : 'nova'}${q}`;
    return `${cap(depthTxt(n))}${fresh >= 5 ? ` · ${fresh}\u00A0cm nous` : ''}${q}${n.q === 'pols' ? ' · pols' : ''}`;
  }
  if (key === 'temps') {
    const g = n.rate.good.filter((c) => WX[c]), b = n.rate.bad.filter((c) => WX[c]);
    const t = n.f.temps >= 0.85 ? g.slice(0, 2) : b.slice(0, 2);
    return t.length ? cap(list(t.map((c) => WX[c]))) : n.f.temps >= 0.85 ? 'Bon temps' : 'Variable';
  }
  if (key === 'acces') return n.acc.code ? cap(accTxt(n.acc)) : 'Sense problemes';
  if (key === 'pistes') return !n.pistes ? '' : n.pistes.oberta === false ? 'Tancada' : n.pistes.km != null ? `${n.pistes.km} de ${n.pistes.de}\u00A0km oberts` : 'Oberta';
  return '';
}

// D'on surt el gruix (fitxa)
export function depthSource(n) {
  const d = n.depth;
  if (!d) return '';
  if (d.src === 'sensor') return `Mesurat al sensor de ${d.where[0]} (${String(d.sensor.alt).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}\u00A0m)`;
  if (d.src === 'estimat') return `Estimat a partir ${d.where.length > 1 ? 'dels sensors' : 'del sensor'} de ${list(d.where)}${d.model ? ' i del model' : ''}`;
  return 'Estimat pel model';
}

