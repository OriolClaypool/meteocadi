// Textos de Meteocadí Neu, separats de la lògica: el català (principal, /neu) i, més endavant, el castellà
// (/es/esqui). neu.js, nota.js i temporada.js els reben amb neuFor(), notaFor() i temporadaFor(); les pàgines, amb
// textos(lang). Els topònims (estacions, zones, sensors) van sempre en català.
// Els textos del català són exactament els d'abans de separar-los (27/11/2026): l'HTML de /neu i de les fitxes ha de
// sortir idèntic. Si en canvies un, canvia'l aquí.
import { num, dayName, dayShort, cap } from '../format.js';
import { wmoText } from '../wmo.js';

const thousands = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
// Unitats enganxades al número (que no quedin soles a la línia següent)
const u = (v, unit) => `${v}\u00A0${unit}`;

// ------------------------------------------------------------------ català

// "de 10 km/h", però "d'11 km/h" i "d'1 cm" (u i onze comencen amb vocal)
const deCa = (n) => (Math.round(n) === 1 || Math.round(n) === 11 ? "d'" : 'de ');
const listCa = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} i ${xs[xs.length - 1]}`);
const DIR8 = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-oest', 'oest', 'nord-oest'];
const DIES = ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte'];
const MESOS = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
const dt = (iso) => new Date(`${iso}T12:00:00Z`);
const deMes = (m) => (/^[aeiou]/.test(MESOS[m]) ? `d'${MESOS[m]}` : `de ${MESOS[m]}`);
const diaMesCa = (iso) => `${dt(iso).getUTCDate()} ${deMes(dt(iso).getUTCMonth())}`;
const entreLes = (a, b) => `entre les ${a} i les ${b} h`;

export const CA = {
  lang: 'ca',
  base: '/neu/',
  home: '/neu',
  de: deCa,
  list: listCa,
  dayName: (iso) => dayName(iso),
  dayShort: (iso) => dayShort(iso),
  wmo: (code) => wmoText(code),
  // "a les 9:40", però "a la 1:05"
  aLes(iso) {
    const t = new Date(iso).toLocaleTimeString('ca-ES', { timeZone: 'Europe/Madrid', hour: 'numeric', minute: '2-digit' });
    return t.startsWith('1:') ? `a la ${t}` : `a les ${t}`;
  },
  // Direcció del vent, com a la resta del web (mountain.js): "de nord-oest", "d'oest"
  dirFrom(deg) {
    if (deg == null || isNaN(deg)) return '';
    const n = DIR8[Math.round(deg / 45) % 8];
    return /^[aeiou]/.test(n) ? `d'${n}` : `de ${n}`;
  },
  // La zona de l'estació amb la preposició: "a la Cerdanya", "al Pallars Sobirà"
  zoneA: (r) => r.zoneA,
  obreNota: (r) => r.obreNota,
  parteText: (p) => p?.text,
  parteSigna: (p) => p?.signa,

  // ---- temporada.js
  diaMes: diaMesCa,
  diaLlarg: (iso) => `${DIES[dt(iso).getUTCDay()]} ${diaMesCa(iso)}`,
  elDia: (iso) => ([1, 11].includes(dt(iso).getUTCDate()) ? `l'${diaMesCa(iso)}` : `el ${diaMesCa(iso)}`),
  falten: (n) => (n <= 0 ? 'avui' : n === 1 ? 'demà' : `d'aquí a ${n}\u00A0dies`),
  obreEl: (dia) => `Obre el ${dia}, si la neu ho permet.`,
  noSeSap: 'No se sap si obrirà aquesta temporada.',
  noAnunciat: 'Encara no ha anunciat quin dia obre.',
  obreCurt: (elDia) => `Obre ${elDia}`,
  noConfirmada: 'Obertura no confirmada',
  senseData: "Sense data d'obertura",

  // ---- nota.js
  notaLabel: { 4: 'Molt bo', 3: 'Bo', 2: 'Regular', 1: 'Dolent', 0: 'Sense neu' },
  tancada: 'Tancada',
  uns: (x) => `uns ${x}`,
  wx: {
    sun: 'sol', calm: 'poc vent',
    wind3: 'vent molt fort a dalt', wind2: 'vent fort a dalt', wind1: 'una mica de vent a dalt',
    storm: 'temporal de neu', snowing: 'nevada', rain: 'pluja a la base', rainTop: 'pluja fins a dalt', cloud: 'cel tapat', fog: 'boira',
    cold2: 'molt fred a dalt', cold1: 'fred a dalt', hot: 'massa calor per a la neu', warm: 'neu humida a la tarda',
  },
  acc: { neu: 'neu a les carreteres', neu2: 'molta neu a les carreteres' },
  accCadenes: (road) => `cadenes a la ${road}`,
  accTallada: (road) => `${road} tallada per la neu`,
  why: {
    closed: 'Tancada.',
    noSnow: 'Sense neu a terra.',
    almost: 'Gairebé sense neu.',
    almostGone: (fresh) => `Gairebé sense neu: dels ${fresh}\u00A0cm de nova no en queda gairebé res.`,
    almostLeft: (fresh, d) => `Gairebé sense neu: dels ${fresh}\u00A0cm de nova en queden ${d}.`,
    almostOnly: (fresh) => `Gairebé sense neu: només ${fresh}\u00A0cm de nova.`,
    nova: (pols) => (pols ? 'pols' : 'nova'),
    little: (d) => `poca neu (${d})`,
    depthNew: (d, nova) => `${d} de neu ${nova}`,
    depth: (d) => `${d} de neu`,
    freshAfter: (fresh, nova) => `${fresh}\u00A0cm de ${nova}`,
    freshAlone: (fresh, nova) => `${fresh}\u00A0cm de neu ${nova}`,
    pols: 'neu pols',
    rainOn: 'pluja sobre la neu',
    hard: 'neu dura al matí',
    but: (g, b) => `${g}, però ${b}.`,
  },
  part: {
    noSnow: 'Sense neu a terra',
    almost: (d) => `Gairebé sense neu (${d})`,
    rainOn: ' · pluja a sobre',
    hard: ' · dura al matí',
    allNew: (d, pols) => `${d} de neu ${pols ? 'pols' : 'nova'}`,
    fresh: (fresh) => ` · ${fresh}\u00A0cm nous`,
    pols: ' · pols',
    good: 'Bon temps',
    variable: 'Variable',
    accOk: 'Sense problemes',
    open: (km, de) => `${km} de ${de}\u00A0km oberts`,
    oberta: 'Oberta',
  },
  src: {
    sensor: (where, km) => `Estimació de Meteocadí amb el sensor del Meteocat de ${where}${km != null ? ` (a ${km})` : ''}`,
    estimat: (many, where, km, model) => `Estimació de Meteocadí amb ${many ? 'els sensors' : 'el sensor'} del Meteocat de ${where}${km != null ? ` (el més proper, a ${km})` : ''}${model ? ' i el model' : ''}`,
    model: 'Estimació de Meteocadí amb el model de previsió',
    // A la capçalera de la fitxa, en minúscula i sense "de"
    short: (s) => s.replace(/^Estimació de Meteocadí/, 'estimació Meteocadí'),
  },

  // ---- neu.js
  level: { 4: ['Molt bo', 'mb'], 3: ['Bo', 'b'], 2: ['Regular', 'r'], 1: ['Dolent', 'd'] },
  Avui: 'Avui',
  Dema: 'Demà',
  avui: 'avui',
  dema: 'demà',
  kindText: { snow: 'Neu', snowtop: 'Neu a dalt i pluja a baix', rain: 'Pluja', wind: 'Vent fort a dalt', sun: 'Sol', part: 'Sol i núvols', cloud: 'Núvols', fog: 'Boira' },
  notaTitle: (v, label) => `Nota ${v} de 10: ${label}`,
  notaLegendAria: 'Escala de la nota',
  notaRanges: [[4, '7,5 a 10'], [3, '6 a 7,4'], [2, '4 a 5,9'], [1, 'menys de 4']],
  parts: [['neu', 'Neu'], ['temps', 'Temps'], ['acces', 'Accés'], ['pistes', 'Pistes']],
  // El parte automàtic
  pt: {
    what: (max) => (max >= 30 ? 'Nevada forta' : max >= 10 ? 'Nevada' : 'Neu feble'),
    fins: (d) => `fins ${d}`,
    deA: (a, b) => `de ${a} a ${b}`,
    title: (what, when, zones) => `${what} ${when} ${zones}.`,
    sub: (max, line) => `Fins a ${u(max, 'cm')} a dalt${line != null ? `; la cota de neu baixarà fins a uns ${u(line, 'm')}` : ''}.`,
    noSnowUntil: (d) => `Sense neu nova fins ${d}.`,
    noSnowWeek: 'Sense neu nova en tota la setmana.',
    iso: (a, b) => `La isoterma de 0\u00A0°C serà cap als ${a}–${u(b, 'm')}.`,
    windy: (days) => `${cap(days)}, vent fort a dalt.`,
    weekend: { sun: 'Cap de setmana de sol.', part: 'Cap de setmana de sol i núvols.', snow: 'Cap de setmana amb neu.', rain: 'Cap de setmana de pluja.', wind: 'Cap de setmana amb vent fort a dalt.', cloud: 'Cap de setmana ennuvolat.' },
  },
  // Obertures
  ob: {
    pre: (n, noms, dia) => `Les estacions encara són tancades: ${n === 1 ? `la primera, ${noms}, obre` : n <= 2 ? `les primeres, ${noms}, obren` : 'les primeres obren'} el ${dia}.`,
    sense: 'Sense data anunciada',
    solen: 'Solen obrir quan hi ha prou neu.',
    foot: (dia) => `Dates anunciades per les estacions, si la neu ho permet. Revisades el ${dia}.`,
    first: (name, dia) => `La primera estació, ${name}, obre el ${dia}.`,
    firsts: (dia) => `Les primeres estacions obren el ${dia}.`,
  },
  noSnowNone: 'Cap nevada a la vista els pròxims set dies.',
  noSnowFirst: (dw, names) => `Encara no hi ha neu a cap estació. La primera nevada prevista és ${dw} a ${names}.`,
  cmNova: 'cm nova',
  pin: {
    closed: (name, short) => `${name}: tancada${short ? `. ${short}` : ''}`,
    nota: (name, v, label) => `${name}: nota ${v}${label ? `, ${label.toLowerCase()}` : ''}`,
    sensor: (name, alt, v) => `${name}, ${thousands(alt)} m: ${v} cm de gruix`,
  },
  dayCm: (d, cm) => `${d} ${cm == null ? 'sense dada' : `${cm} cm`}`,
  dayCmPrev: (d, cm) => `${d} ${cm} cm previstos`,
  dayCmRain: (d, cm, rain) => `${d} ${cm} cm${rain ? ' i pluja a baix' : ''}`,
  sparkAria: (desc) => `Neu nova: ${desc}`,
  noZone: 'No hi ha cap estació en aquesta zona.',
  kindLow: (type) => (type === 'fons' ? 'esquí de fons' : 'esquí alpí'),
  windBadge: (dw) => `${cap(dw)}, vent fort a dalt`,
  en3dies: 'en 3 dies',
  card: {
    allNew: (d, pols) => `${d} de neu ${pols ? 'pols' : 'nova'}`,
    depth: (d) => `${d} de neu`,
    fresh: (cm, pols) => `${cm} cm de ${pols ? 'pols' : 'nova'}`,
    sol: 'Sol',
    pocVent: 'Poc vent',
    perFons: ' per a l’esquí de fons',
    best: 'Millor dia per esquiar',
    more: (more) => `i ${more === 1 ? 'una estació més' : `${more} estacions més`}`,
    cmNew: (cm) => `${cm} cm de neu nova`,
    noGood: 'Cap dia bo per esquiar aquesta setmana',
    noGoodSub: 'Cap estació arriba a un 6 de nota en els pròxims 7 dies.',
    most: 'On nevarà més',
    fromTo: (d) => `d'avui a ${d ?? 'demà passat'}`,
    noSnow3: 'Sense neu prevista en 3 dies',
    loading: 'Carregant la previsió',
    measured: 'Neu mesurada',
    loadingSens: 'Carregant els sensors',
    plus24h: (v) => `+${v} cm en 24 hores`,
    gruixAra: 'gruix de neu ara',
    noNew24: 'sense neu nova en 24 h',
  },
  prof: {
    aria: (base, top, frz, line) => `Perfil de l'estació, de ${base} a ${top} m${frz != null ? `. Isoterma de 0 °C a ${frz} m` : ''}${line != null ? `. Cota de neu a ${line} m` : ''}.`,
    frz: (x) => `0 °C a ${x} m`,
    rainTop: 'Pluja fins a dalt',
    snowAbove: (x) => `Neu per sobre de ${x} m`,
    snowTo: (x) => `Neu fins a ${x} m`,
    // Amplada de les pastilles (px), a la mida dels textos
    wFrz: 116,
    wLine: 140,
    baseNow: (temp, wb) => `${temp} °C · vent ${deCa(wb)}${wb} km/h`,
    topNow: (temp, gt) => `${temp} °C · ratxes ${deCa(gt)}${gt} km/h`,
    base: (x) => `Base · ${x} m`,
    cim: (x) => `Cim · ${x} m`,
  },
  // Títol del dia en una estació
  dt: {
    fogX: 'boira', windX: 'vent fort a dalt',
    snow: 'Dia de nevada', snowtop: 'Neu a dalt i pluja a baix', rainTop: 'Pluja fins a dalt', rain: 'Dia de pluja',
    wind: 'Sec, però amb vent fort a dalt', sunNew: 'Sol i neu nova', sun: 'Dia de sol', part: 'Sol i núvols', cloud: 'Dia ennuvolat', fog: 'Dia de boira',
    amb: (x) => `, amb ${x}`,
  },
  // Text del dia en una estació
  dx: {
    snow: (cm, line) => `Nevarà ${cm != null ? `uns ${u(cm, 'cm')} a dalt` : 'feblement'}${line != null ? `, amb la cota de neu a uns ${u(line, 'm')}` : ''}.`,
    snowtop: (cm, line) => `Uns ${u(cm, 'cm')} de neu al cim, però la cota de neu, a uns ${u(line, 'm')}, queda dins de l'estació: a baix plourà.`,
    rainTop: (line) => `Pluja fins a dalt: la cota de neu és a uns ${u(line, 'm')}, per sobre del cim.`,
    rain: 'Pluja.',
    wind: (gu) => `Sec, però amb ratxes ${deCa(gu)}${u(gu, 'km/h')} a dalt: poden tancar els remuntadors més alts.`,
    sun: (allDay, prev) => `${allDay ? 'Sol tot el dia' : 'Sol'}${prev != null ? `, amb ${u(prev, 'cm')} de neu nova dels dies anteriors` : ''}.`,
    fog: 'Boira: poca visibilitat a les pistes, sobretot a dalt.',
    cloudLight: 'Cel ennuvolat.',
    cloud: 'Cel ennuvolat, sense precipitació.',
    lightSnow: `Pot caure alguna nevada feble (menys ${deCa(3)}${u(3, 'cm')}).`,
    lightRain: 'Pot caure algun ruixat feble.',
    gusts: (gu) => `Ratxes ${deCa(gu)}${u(gu, 'km/h')} a dalt: poden tancar els remuntadors més alts.`,
    temps: (tmin, tmax, bmin, bmax) => {
      const t = (x) => Math.round(x ?? 0);
      return `Al cim, ${deCa(t(tmin))}${num(tmin, 0)} a ${u(num(tmax, 0), '°C')}; a la base, ${deCa(t(bmin))}${num(bmin, 0)} a ${u(num(bmax, 0), '°C')}.`;
    },
  },
  verd: {
    eb: (k, iso) => (k === 0 ? `Avui, ${dayName(iso)}` : k === 1 ? `Demà, ${dayName(iso)}` : `${cap(dayName(iso))} ${dt(iso).getUTCDate()}`),
    gruix: (s) => `Gruix: ${s}.`,
    closed: (why) => `L'estació encara és tancada aquest dia. ${why}`,
  },
  strip: {
    nota: (v) => `, nota ${v}`,
    closed: ', estació tancada',
    level: (l) => `, dia d'esquí ${l}`,
  },
  trio: {
    past: (n) => `Últims ${n} dies`,
    mesuradaA: (w) => `mesurada a ${w}`,
    estimadaCim: 'estimada al cim',
    prox3: 'Pròxims 3 dies',
    previstaCim: 'prevista al cim',
    dies47: 'Dies 4 a 7',
  },
  chart: {
    aria: (mes, where, past, fut) => `Neu nova per dies. Dies anteriors, ${mes ? `mesurada a ${where}` : 'estimada'}: ${past}. Pròxims dies, prevista al cim: ${fut}.`,
    legMes: (w) => `Mesurada a ${w}`,
    legEst: 'Estimada',
    legPrev: 'Prevista al cim',
    legRain: 'Pluja a la base',
  },
  // Tipus de neu probable (prev: "12 cm" ja amb la unitat; de: "de "/"d'")
  st: {
    nova: { t: 'Neu nova', s: 'Nevarà durant el dia: neu fresca, però amb poca visibilitat.' },
    pols: (de, prev) => ({ t: 'Neu pols', s: `Després ${de}${prev} de neu nova i amb fred, pols a tota l'estació.` }),
    pesant: (prev) => ({ t: 'Neu nova, pesant a la tarda', s: `${prev} de neu nova; amb la calor de la tarda es farà més pesant a les pistes encarades al sud.` }),
    capa: (prev, warm) => ({ t: 'Capa de neu nova', s: `${prev} de neu nova damunt de la neu compactada${warm ? '; a la tarda, més pesant a les pistes encarades al sud' : ''}.` }),
    dura: { t: 'Neu dura al matí', s: 'Després de la pluja, la neu es gela de nit: dura o glaçada a primera hora.' },
    primavera: { t: 'Neu primavera', s: 'Dura al matí i tova a partir del migdia, quan s’escalfa.' },
    compactada: { t: 'Neu compactada', s: 'Sense neu nova ni gaire calor: pistes compactades.' },
    eb: (dw) => `Tipus de neu, ${dw}`,
  },
  t7: {
    dia: 'Dia', neu: 'Neu', cota: 'Cota de neu', ratxes: 'Ratxes', nota: 'Nota', diaEsqui: 'Dia d\'esquí',
    aria: 'Previsió dels pròxims 7 dies',
  },
  wn: {
    snowtop: (when, line) => `${when}, cota de neu a uns ${u(line, 'm')}: pluja a la base i neu només a dalt.`,
    rain: (when, line) => `${when}, cota de neu a uns ${u(line, 'm')}: pluja fins a dalt.`,
  },
  hh: {
    cel: 'Cel', neuCim: 'Neu al cim', tCim: 'Temp. cim', tBase: 'Temp. base', ratxesCim: 'Ratxes cim', boiraCim: 'Boira cim',
    boira: 'Boira', boirina: 'Boirina',
    fog: (all, a, b) => `Boira a dalt ${all ? 'tot el dia' : entreLes(a, b)}.`,
    wind: (mx, all, a, b) => `Ratxes de fins a ${u(mx, 'km/h')} ${all ? 'tot el dia' : entreLes(a, b)}: poden tancar els remuntadors més alts.`,
    aria: 'Previsió hora a hora',
  },
  f: {
    nova24: 'Neu nova en 24 h', prevAvui: 'Neu prevista avui', alCim: 'al cim', gruixEst: 'Gruix estimat', neu7: 'Neu en 7 dies',
    araCim: 'Ara al cim', ratxesCim: 'Ratxes al cim',
    estimSensor: (name, km) => `estimació Meteocadí amb ${name} (a ${km}\u00A0km)`,
    vent: (dir) => `vent ${dir}`,
  },
  sen: {
    meta: (alt, km) => `${thousands(alt)}\u00A0m · a ${km}\u00A0km`,
    d24: (v) => `${v} cm en 24 h`,
    igual: 'igual que ahir',
  },

  // ---- pàgines: la portada de Neu (NeuInici.astro)
  pg: {
    title: 'Meteocadí Neu: previsió de neu i esquí al Pirineu | Meteocadí',
    desc: "Previsió de neu per a les estacions d'esquí de Catalunya i Andorra: on anar a esquiar, la nota de cada estació, on nevarà, cota de neu, vent al cim i gruix de neu mesurat.",
    h1: 'Neu i esquí al Pirineu, avui',
    topFallback: 'Neu i esquí al Pirineu, estació per estació.',
    ariaDia: 'Dia',
    ariaTipus: "Tipus d'esquí",
    alpi: 'Esquí alpí',
    fons: 'Esquí de fons',
    loading: 'Carregant la previsió…',
    veureTotes: 'Veure-les totes',
    updated: (aLes) => `Previsió actualitzada ${aLes}`,
    temporada: (t) => `Temporada ${t}`,
    obTitle: 'Quan obren les estacions',
    mapEbSea: 'On anar',
    mapEb: 'Mapa',
    onAnar: (w) => `On anar ${w}`,
    onNevara: 'On nevarà',
    quanta: 'Quanta neu hi ha',
    ariaLayers: 'Què es mostra al mapa',
    lNota: 'Nota',
    lPrev: 'Neu prevista',
    lGruix: 'Gruix mesurat',
    ariaPer: 'Període',
    d3: '3 dies',
    d7: '7 dies',
    ariaMap: "Mapa de les estacions d'esquí",
    noteNotaAvui: 'Nota de cada estació avui.',
    notePrev: 'Neu prevista al cim de cada estació.',
    noteNota: (w, fons) => `Nota de 0 a 10 de cada estació ${w === 'avui' ? 'avui' : w === 'demà' ? 'demà' : `per a ${w}`}${fons ? ' (esquí de fons)' : ''}. Toca una estació per veure’n el detall.`,
    notePrev1: 'Neu prevista avui al cim de cada estació.',
    notePrevN: (end) => `Neu prevista al cim de cada estació, d'avui a ${end ?? 'la setmana vinent'}.`,
    loadingSens: 'Carregant els sensors…',
    sensFail: 'Les dades dels sensors no arriben ara mateix. Ho tornem a provar d’aquí a uns minuts.',
    sensNote: 'Gruix de neu ara als sensors automàtics del Meteocat de més de 1.500 m.',
    fcFail: 'La previsió no arriba ara mateix. Ho tornem a provar d’aquí a uns minuts.',
    fcFailShort: 'La previsió no arriba ara mateix.',
    arome: 'Neu prevista hora a hora a tot el Pirineu, amb el model AROME →',
    foraPistes: 'Fora pistes',
    allausT: "Perill d'allaus",
    allausIntro: "Per a l'esquí de muntanya i el fora pista, el butlletí oficial de cada zona.",
    bulletins: { cat: 'Catalunya', aran: "Vall d'Aran", and: 'Andorra', andName: 'Servei meteorològic d’Andorra (meteo.ad)', fr: 'Pirineu francès' },
    estacions: 'Estacions',
    rank: (w, fons) => `Rànquing ${w === 'avui' ? 'd’avui' : `de ${w}`}${fons ? ', esquí de fons' : ''}`,
    neuCada: 'Neu a cada estació',
    introRank: 'De millor a pitjor per anar a esquiar, amb una nota de 0 a 10.',
    introNeu: 'Ordenades per la neu prevista els pròxims 3 dies.',
    zona: 'Zona',
    optTotes: (n) => `Totes les estacions (${n})`,
    optCat: (n) => `Catalunya (${n})`,
    optAnd: (n) => `Andorra (${n})`,
    legPast: 'Neu dels dies anteriors',
    legPrev: 'Neu prevista al cim',
    veureN: (n) => `Veure les ${n} estacions`,
    howT: 'Com es calcula la nota',
    howHTML: '<p>La nota parteix de 10 i baixa amb cada cosa que va malament. Si una falla molt (sense neu, vent molt fort, pluja), la nota baixa molt encara que la resta vagi bé.</p><ul><li><b>Neu.</b> El gruix de neu i la neu nova dels tres dies abans. El gruix és el del sensor del Meteocat que hi ha al costat de l’estació o, si no n’hi ha, una mitjana dels sensors de la zona i del model. Baixa si hi ha plogut a sobre o si la neu és dura.</li><li><b>Temps per esquiar.</b> El vent a dalt, la nevada, la pluja, la boira, el sol, el fred i la calor del dia.</li><li><b>Accés.</b> La neu prevista a les carreteres i, per a avui, les incidències per neu o gel del Servei Català de Trànsit.</li></ul><p>Una estació no té nota fins al dia que obre. La nota encara no sap quines pistes són obertes: abans d’anar-hi, mira l’estat de pistes de l’estació.</p>',
    kidsHref: '/neu-amb-nens',
    kidsT: 'Neu amb nens i trineus prop de Barcelona',
    kidsS: 'Set llocs per jugar amb la neu o anar amb raquetes sense pagar forfet, amb temperatura i carreteres en directe.',
    spQ: "Tens un negoci de muntanya, lloguer d'esquí o allotjament?",
    spLink: 'Patrocina Meteocadí Neu →',
  },

  // ---- pàgines: la fitxa d'una estació (NeuFitxa.astro)
  fx: {
    title: (name) => `${name}: previsió de neu i esquí | Meteocadí Neu`,
    desc: (r, cotes) => `Previsió de neu ${r.a} (${cotes} m): neu nova, cota de neu, vent al cim, hora a hora i 7 dies, i el gruix de neu mesurat a prop.`,
    cardSub: (cotes) => `Neu i esquí · ${cotes} m`,
    kmMin: (n) => `més de ${n} km`,
    facts: { cotes: 'Cotes (m)', desnivell: 'Desnivell', circuits: 'Circuits', pistes: 'Pistes', esqui: 'Esquí', deFons: 'De fons', alpi: 'Alpí', oberta: 'Oberta des de', zona: 'Zona' },
    estat: 'Estat de pistes',
    web: "Web de l'estació",
    webcams: 'Webcams',
    closed: 'Encara és tancada.',
    ariaTabs: 'Seccions de la fitxa',
    tabs: { neu: 'Neu', hores: 'Hora a hora', dies: '7 dies', mesurada: 'Neu mesurada', allaus: 'Allaus', arribar: 'Com arribar', enllacos: 'Enllaços' },
    neuT: 'Neu nova: la caiguda i la que vindrà',
    hhTitle: (word) => `${word}, hora a hora`,
    loadingHH: 'Carregant la previsió hora a hora…',
    diesT: 'Pròxims 7 dies',
    mesT: 'Neu mesurada a prop',
    mesNote: 'Sensors automàtics de gruix de neu del Servei Meteorològic de Catalunya, a menys de 35 km.',
    allausT: 'Allaus, fora pistes',
    butlleti: "Butlletí de perill d'allaus",
    allausNote: "Per a l'esquí de muntanya i el fora pista. Dins de les pistes obertes, l'estació en controla el risc.",
    arribarT: 'Com arribar',
    loadingRoads: "Carregant l'estat de les carreteres…",
    roadsNote: (km) => `Incidències del Servei Català de Trànsit a menys de ${km} km, actualitzades cada hora. Abans de sortir, consulta sempre l'<a href="https://transit.gencat.cat/ca/informacio-viaria/estat-transit/" rel="noopener">estat del trànsit</a>.`,
    roadsOk: '<p class="nv-road is-ok"><i></i><span><b>Cap incidència comunicada</b> a les carreteres properes.</span></p>',
    towards: (x) => ` · cap a ${x}`,
    roadsFail: 'Ara no arriben les dades del Servei Català de Trànsit.',
    linksT: 'Pistes i webcams',
    estatOf: 'Estat de pistes oficial',
    estatS: 'Pistes i remuntadors oberts, gruix i qualitat de la neu',
    camsS: "A la web de l'estació",
    webS: 'Forfets, horaris i serveis',
    estacioT: "L'estació",
    factsNote: "Xifres de la web oficial de l'estació; poden canviar d'una temporada a l'altra.",
    nearT: 'Estacions a prop',
  },

  // ---- plantilla de Neu (NeuLayout.astro)
  lay: {
    nav: { avui: 'Avui', estacions: 'Estacions', mapa: 'Mapa', allaus: 'Allaus' },
    brandAria: 'Meteocadí Neu, inici',
    share: 'Comparteix aquesta pàgina',
    copied: 'Enllaç copiat',
    suport: 'Amb el suport de',
    foot1: 'La previsió de neu i esquí de Meteocadí per a les estacions del Pirineu de Catalunya i Andorra.',
    foot2: 'Previsió: <a href="https://open-meteo.com/" rel="noopener">Open-Meteo</a>. Neu mesurada: Servei Meteorològic de Catalunya (XEMA), dades obertes de la Generalitat de Catalunya. Estat de pistes: la web de cada estació.',
    foot3: "Les previsions són orientatives. A la muntanya, cadascú n'assumeix el risc.",
    comparteix: 'Comparteix',
    links: [['/', 'meteocadi.cat'], ['/neu-amb-nens', 'Neu amb nens'], ['/colabora', 'Patrocina'], ['/avis-legal', 'Avís legal'], ['/contacte', 'Contacte']],
  },
};

export const textos = (lang) => CA;
