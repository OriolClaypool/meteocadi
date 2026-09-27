// Xarxa Meteocadí — font única de les estacions (IDs de Weather Underground).
// Els IDs i noms són els mateixos que ja feia servir la web i l'arxiu diari (api/arxiva.js).
// lat/lng són aproximats: el mapa fa servir les coordenades que retorna l'API quan n'hi ha.

export const STATIONS = [
  { id: 'IGISCL6',    slug: 'tancalaporta',        a: 'a Tancalaporta', name: 'Tancalaporta',               alt: 2440, loc: 'PN Cadí-Moixeró',          comarca: 'Berguedà', group: 'alta', lat: 42.2778, lng: 1.7361 },
  { id: 'IGSOL7',     slug: 'pedraforca',          a: 'al Pedraforca', name: 'Pedraforca',                 alt: 2270, loc: 'Gósol',                    comarca: 'Berguedà', group: 'alta', lat: 42.2397, lng: 1.7028 },
  { id: 'IGUARD34',   slug: 'coll-de-pal',         a: 'al Coll de Pal', name: 'Coll de Pal - Puigllançada', alt: 2090, loc: 'Guardiola de Berguedà',    comarca: 'Berguedà', group: 'alta', lat: 42.2847, lng: 1.8889 },
  { id: 'IBAG67',     slug: 'refugi-de-rebost',    a: 'al Refugi de Rebost', name: 'Refugi de Rebost',           alt: 1650, loc: 'Bagà',                     comarca: 'Berguedà', group: 'alta', lat: 42.2486, lng: 1.8481 },
  { id: 'IGSOL4',     slug: 'gosol',               a: 'a Gósol', name: 'Gósol',                      alt: 1450, loc: 'Gósol',                    comarca: 'Berguedà', group: 'vall', lat: 42.2400, lng: 1.6622 },
  { id: 'ISANTJ138',  slug: 'cerdanyola-forcat',   a: 'a Cerdanyola-Forcat', name: 'Cerdanyola-Forcat',          alt: 1115, loc: 'Sant Julià de Cerdanyola', comarca: 'Berguedà', group: 'vall', lat: 42.2190, lng: 1.9010 },
  { id: 'ISANTJ53',   slug: 'cerdanyola-poble',    a: 'a Cerdanyola-Poble', name: 'Cerdanyola-Poble',           alt: 964,  loc: 'Sant Julià de Cerdanyola', comarca: 'Berguedà', group: 'vall', lat: 42.2217, lng: 1.8944 },
  { id: 'ILANOU4',    slug: 'la-nou-de-bergueda',  a: 'a la Nou de Berguedà', name: 'La Nou de Berguedà',         alt: 940,  loc: 'La Nou de Berguedà',       comarca: 'Berguedà', group: 'vall', lat: 42.1922, lng: 1.8694 },
  { id: 'IBAG65',     slug: 'baga-nord',           a: 'a Bagà Nord', name: 'Bagà Nord',                  alt: 865,  loc: 'Bagà',                     comarca: 'Berguedà', group: 'vall', lat: 42.2529, lng: 1.8619 },
  { id: 'IBARCELO40', slug: 'la-pobla-de-lillet',  a: 'a la Pobla de Lillet', name: 'La Pobla de Lillet',         alt: 843,  loc: 'La Pobla de Lillet',       comarca: 'Berguedà', group: 'vall', lat: 42.2378, lng: 1.9750 },
  { id: 'IBAG73',     slug: 'baga-centre',         a: 'a Bagà Centre', name: 'Bagà Centre',                alt: 798,  loc: 'Bagà',                     comarca: 'Berguedà', group: 'vall', lat: 42.2510, lng: 1.8615 },
  { id: 'IBAG72',     slug: 'baga-sud',            a: 'a Bagà Sud', name: 'Bagà Sud',                   alt: 770,  loc: 'Bagà',                     comarca: 'Berguedà', group: 'vall', lat: 42.2490, lng: 1.8610 },
];

export const GROUPS = {
  alta: { title: 'Alta muntanya', sub: 'Meteocadí i PN Cadí-Moixeró' },
  vall: { title: 'Vall i Prepirineu', sub: 'Meteocadí i col·laboradors' },
};

export const BY_ID = Object.fromEntries(STATIONS.map((s) => [s.id, s]));
export const BY_SLUG = Object.fromEntries(STATIONS.map((s) => [s.slug, s]));

// "Coll de Pal - Puigllançada" → "Coll de Pal" per a espais petits
export function shortName(s) {
  return s.name.split(' - ')[0];
}

// Text secundari: "2.440 m · PN Cadí-Moixeró" (sense repetir el nom)
export function subLine(s) {
  const a = fmtAlt(s.alt);
  const same = s.name.startsWith(s.loc) || s.loc.startsWith(s.name);
  return same ? `${a} · ${s.comarca}` : `${a} · ${s.loc}`;
}

export function fmtAlt(a) {
  return `${String(a).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} m`;
}
