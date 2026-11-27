// Temporada d'esquí: quan obre cada estació. Es fa servir al build i al navegador (no importa res del servidor).
//
// Fins al 15/11/2026 la temporada començava per data (15 de novembre) i des d'aquell dia Neu posava nota a totes les
// estacions: tot sortia "Dolent" en vermell i "Cap dia bo per esquiar aquesta setmana" amb totes les estacions
// tancades. Ara cada estació té la seva data: abans d'obrir no té nota (surt "Tancada" i quan obre) i la temporada
// (inSeason, a ski.js) comença el dia que obre la primera.
//
// CADA TARDOR: posar aquí les dates de la temporada nova (i revisar-les quan una estació avança o endarrereix
// l'obertura). Només dates anunciades per l'estació o per qui la gestiona; totes són "si la neu ho permet".
// - obre: 'AAAA-MM-DD', el dia anunciat
// - obre: null, sense data anunciada (obren quan hi ha prou neu): compten com a obertes des de PER_DEFECTE
// - incert: true, no se sap si obrirà: no té nota fins que es posi una data
// - nota: frase curta que surt a la fitxa i a la llista d'obertures
// Quan una estació sense data obre, o una n'anuncia una de nova, s'hi posa el dia: no cal tocar res més.

// Revisat el 27/11/2026 amb: nota de premsa del Govern del 6/11/2026 (Pirineu365: les sis estacions d'FGC, del 4 de
// desembre al 4 d'abril); grandvalira.com, palarinsal.com i ordinoarcalis.com (obertura prevista el 4 de desembre);
// Baqueira Beret (obertura del 28 de novembre ajornada per falta de gruixos; pendent de nova data). Masella diu que
// obrirà el primer dia que la neu ho permeti; Port del Comte i les estacions de nòrdic no han anunciat data; a
// Tavascan, l'obertura de l'esquí alpí no està confirmada.
export const TEMPORADA = '2026-27';
export const REVISAT = '2026-11-27';
// El dia que obre la majoria (pont de la Puríssima): les estacions sense data hi compten com a obertes
export const PER_DEFECTE = '2026-12-04';
const FGC = 'Ferrocarrils de la Generalitat (Pirineu365)';
const GVR = 'Grandvalira Resorts';
export const OBERTURES = {
  'baqueira-beret': { obre: null, nota: "Obertura prevista el 28 de novembre ajornada per falta de neu; pendent de nova data.", font: 'Baqueira Beret' },
  'la-molina': { obre: '2026-12-04', font: FGC },
  'vall-de-nuria': { obre: '2026-12-04', font: FGC },
  vallter: { obre: '2026-12-04', font: FGC },
  'espot-esqui': { obre: '2026-12-04', font: FGC },
  'port-aine': { obre: '2026-12-04', font: FGC },
  'boi-taull': { obre: '2026-12-04', font: FGC },
  grandvalira: { obre: '2026-12-04', font: GVR },
  'pal-arinsal': { obre: '2026-12-04', font: GVR },
  'ordino-arcalis': { obre: '2026-12-04', font: GVR },
  masella: { obre: null, nota: 'Obrirà el primer dia que la neu ho permeti.' },
  'port-del-comte': { obre: null },
  tavascan: { obre: null, incert: true, nota: "L'obertura de l'esquí alpí aquesta temporada no està confirmada." },
};
// Les estacions de nòrdic (i qualsevol que no surti a la llista): sense data, obren quan hi ha prou neu
const SENSE = { obre: null };

// El dia que obre la primera estació amb data (per a inSeason de ski.js): 'AAAA-MM-DD'
export const PRIMERA = Object.values(OBERTURES).map((o) => o.obre).filter(Boolean).sort()[0] ?? null;

// Camps d'obertura d'una estació (per a estacions.js): obre (anunciat o null), obreDes (el dia des del qual compta com
// a oberta; null si no se sap si obrirà) i obreNota
export function obertura(slug) {
  const o = OBERTURES[slug] ?? SENSE;
  return { obre: o.obre ?? null, obreDes: o.incert ? null : o.obre ?? PER_DEFECTE, obreNota: o.nota ?? null, obreFont: o.font ?? null };
}

// És oberta el dia iso? Una estació sense aquests camps (dades antigues, o ?temporada per fer proves) compta com a oberta
export const isOpen = (resort, iso) => resort?.obreDes === undefined || (resort.obreDes != null && iso >= resort.obreDes);

const DIES = ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte'];
const MESOS = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
const dt = (iso) => new Date(`${iso}T12:00:00Z`);
const deMes = (m) => (/^[aeiou]/.test(MESOS[m]) ? `d'${MESOS[m]}` : `de ${MESOS[m]}`);
// "4 de desembre" · "divendres 4 de desembre" · "el 4 de desembre" / "l'1 de desembre"
export const diaMes = (iso) => `${dt(iso).getUTCDate()} ${deMes(dt(iso).getUTCMonth())}`;
export const diaLlarg = (iso) => `${DIES[dt(iso).getUTCDay()]} ${diaMes(iso)}`;
export const elDia = (iso) => ([1, 11].includes(dt(iso).getUTCDate()) ? `l'${diaMes(iso)}` : `el ${diaMes(iso)}`);
export const diesFins = (iso, today) => Math.round((dt(iso) - dt(today)) / 864e5);
// "avui" · "demà" · "d'aquí a 13 dies"
export const falten = (iso, today) => {
  const n = diesFins(iso, today);
  return n <= 0 ? 'avui' : n === 1 ? 'demà' : `d'aquí a ${n} dies`;
};

// Frase de quan obre una estació que encara és tancada el dia `iso` ('' si ja és oberta)
export function obreText(resort, iso) {
  if (isOpen(resort, iso)) return '';
  if (resort.obre) return `Obre el ${diaLlarg(resort.obre)}, si la neu ho permet.`;
  if (resort.obreDes == null) return resort.obreNota || "No se sap si obrirà aquesta temporada.";
  return resort.obreNota || "Encara no ha anunciat quin dia obre.";
}
// Curt, per a les llistes: "Obre el 4 de desembre" · "Sense data d'obertura"
export function obreCurt(resort, iso) {
  if (isOpen(resort, iso)) return '';
  if (resort.obre) return `Obre ${elDia(resort.obre)}`;
  return resort.obreDes == null ? 'Obertura no confirmada' : "Sense data d'obertura";
}

// Les obertures que encara han de venir, agrupades per dia: [{ date, items: [estació] }] i, a part, les que no tenen
// data ({ date: null }). Buit quan ja no en queda cap amb data per obrir.
export function obertures(resorts, today) {
  const closed = (resorts ?? []).filter((r) => !isOpen(r, today));
  const dated = closed.filter((r) => r.obre);
  if (!dated.length) return [];
  const by = new Map();
  for (const r of dated) by.set(r.obre, [...(by.get(r.obre) ?? []), r]);
  const out = [...by.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, items]) => ({ date, items }));
  const none = closed.filter((r) => !r.obre);
  if (none.length) out.push({ date: null, items: none });
  return out;
}
