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
import { CA } from './textos.js';

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

const dt = (iso) => new Date(`${iso}T12:00:00Z`);
export const diesFins = (iso, today) => Math.round((dt(iso) - dt(today)) / 864e5);

// Les frases, en cada idioma (textos.js): temporadaFor(CA) és el català, el que s'exporta a sota
const cache = new Map();
export function temporadaFor(tx) {
  if (cache.has(tx)) return cache.get(tx);
  // "4 de desembre" · "divendres 4 de desembre" · "el 4 de desembre" / "l'1 de desembre"
  const { diaMes, diaLlarg, elDia } = tx;
  // "avui" · "demà" · "d'aquí a 13 dies"
  const falten = (iso, today) => tx.falten(diesFins(iso, today));
  // Frase de quan obre una estació que encara és tancada el dia `iso` ('' si ja és oberta)
  function obreText(resort, iso) {
    if (isOpen(resort, iso)) return '';
    if (resort.obre) return tx.obreEl(diaLlarg(resort.obre));
    if (resort.obreDes == null) return tx.obreNota(resort) || tx.noSeSap;
    return tx.obreNota(resort) || tx.noAnunciat;
  }
  // Curt, per a les llistes: "Obre el 4 de desembre" · "Sense data d'obertura"
  function obreCurt(resort, iso) {
    if (isOpen(resort, iso)) return '';
    if (resort.obre) return tx.obreCurt(elDia(resort.obre));
    return resort.obreDes == null ? tx.noConfirmada : tx.senseData;
  }
  const out = { diaMes, diaLlarg, elDia, falten, obreText, obreCurt };
  cache.set(tx, out);
  return out;
}
export const { diaMes, diaLlarg, elDia, falten, obreText, obreCurt } = temporadaFor(CA);

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
