// Estacions de Meteocadí Neu (/neu): les estacions d'esquí de places.js (kind 'esqui'), amb el que només fa servir
// Neu: zona, país, ordre i la pàgina de l'estat de pistes oficial. Només en temps de build i a les funcions de /api:
// al navegador hi arriba la versió lleugera (lleugera()).
// Rasos de Peguera no hi surt: fa anys que no obre els remuntadors (només trineus i raquetes).
// Les xifres de cada estació (cotes, km) s'han de poder comprovar a la seva web oficial.
import { PLACES } from '../places.js';
import { REGION_BY_SLUG } from '../regions.js';

const FORA = new Set(['rasos-de-peguera']);

// Pàgina de l'estat de pistes oficial (si no n'hi ha cap de coneguda, s'enllaça la web de l'estació)
const ESTAT = {
  'la-molina': 'https://pirineu365.cat/en/lamolina/live/infosnow/',
  masella: 'https://www.masella.com/ca/infoneu',
  'port-del-comte': 'https://portdelcomte.net/pistes/',
  'baqueira-beret': 'https://www.baqueira.es/estado-pistas',
  grandvalira: 'https://www.grandvalira.com/ca/estacio/estat-de-pistes',
};

// Ordre de les zones a les llistes (d'est a oest i Andorra al final, com a la secció d'esquí anterior)
const ORDRE = ['cerdanya', 'bergueda', 'solsones', 'alt-urgell', 'ripolles', 'pallars-sobira', 'alta-ribagorca', 'vall-d-aran', 'andorra'];

// Nom curt per a les etiquetes del mapa
const CURT = {
  'estacio-d-aransa': 'Aransa', 'estacio-de-lles': 'Lles', 'guils-fontanera': 'Guils', 'tuixent-la-vansa': 'Tuixent',
  'vall-de-nuria': 'Núria', 'espot-esqui': 'Espot', 'baqueira-beret': 'Baqueira', 'ordino-arcalis': 'Arcalís',
};

export const NEU = PLACES.filter((p) => p.ski && !FORA.has(p.slug))
  .map((p) => {
    const reg = REGION_BY_SLUG[p.region];
    const pts = p.points ?? [];
    return {
      slug: p.slug,
      // A Neu tot són estacions d'esquí: "Estació de Lles" → "Lles"
      name: p.name.replace(/^Estació d(e |')/, ''),
      short: CURT[p.slug] ?? p.name.replace(/^Estació d(e |')/, ''),
      a: p.a,
      region: p.region,
      zone: p.ski.region,
      zoneA: reg?.a ?? `a ${p.ski.region}`,
      country: p.region === 'andorra' ? 'and' : 'cat',
      type: p.ski.type === 'nordic' ? 'fons' : 'alpi',
      base: p.ski.base,
      top: p.ski.top,
      km: p.ski.km ?? null,
      kmMin: p.ski.kmMin ?? null,
      opened: p.ski.opened ?? null,
      web: p.ski.web,
      cams: p.ski.webcams ?? null,
      estat: ESTAT[p.slug] ?? null,
      lat: p.lat,
      lng: p.lng,
      // Incidències de trànsit (Servei Català de Trànsit) a menys d'aquests km: només a Catalunya
      roadsKm: p.region === 'andorra' ? null : p.near ?? 14,
      // Punts de la previsió: el cim (primer) i la base (darrer)
      points: [pts[0], pts[pts.length - 1]].filter(Boolean).map(({ label, lat, lng, alt }) => ({ label, lat, lng, alt })),
    };
  })
  .filter((r) => r.points.length === 2)
  .sort((a, b) => ORDRE.indexOf(a.region) - ORDRE.indexOf(b.region) || a.name.localeCompare(b.name, 'ca'));

export const NEU_BY_SLUG = Object.fromEntries(NEU.map((r) => [r.slug, r]));

// El que necessita el navegador per pintar les llistes, el mapa i les fitxes
export const lleugera = (r) => ({
  slug: r.slug, name: r.name, short: r.short, zone: r.zone, zoneA: r.zoneA, country: r.country, type: r.type,
  base: r.base, top: r.top, lat: r.lat, lng: r.lng, points: r.points,
});

// Butlletí de perill d'allaus de la zona de cada estació
export const ALLAUS = {
  cat: { name: 'Institut Cartogràfic i Geològic de Catalunya', short: "l'ICGC", url: 'https://bpa.icgc.cat/' },
  aran: { name: "Centre de Lauegi d'Aran", short: "el Centre de Lauegi d'Aran", url: 'https://lauegi.report/' },
  and: { name: 'Andorra (meteo.ad)', short: 'Andorra', url: 'https://www.meteo.ad/estatneu' },
  fr: { name: 'Météo-France', short: 'Météo-France', url: 'https://meteofrance.com/meteo-montagne/pyrenees' },
};
export const allausOf = (r) => (r.region === 'vall-d-aran' ? ALLAUS.aran : r.country === 'and' ? ALLAUS.and : r.country === 'fr' ? ALLAUS.fr : ALLAUS.cat);

// Estacions més properes (per enllaçar-les a la fitxa)
export function properes(r, n = 4) {
  const d = (x) => Math.hypot((x.lat - r.lat) * 111, (x.lng - r.lng) * 82);
  return NEU.filter((x) => x.slug !== r.slug).map((x) => ({ r: x, km: d(x) })).sort((a, b) => a.km - b.km).slice(0, n);
}
