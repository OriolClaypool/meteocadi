// Llocs amb pàgina pròpia "El temps a …" (/temps/<slug>).
// stations: estacions de la xarxa associades, la primera és la de referència.
// intro: text propi de cada lloc. Revisa'l i afegeix-hi coneixement local: és el que el fa únic.

import { PIRINEU } from './places-pirineu.js';

const CADI_PLACES = [
  {
    slug: 'baga',
    name: 'Bagà',
    a: 'a Bagà',
    kind: 'poble',
    lat: 42.2530, lng: 1.8617, alt: 785,
    stations: ['IBAG65', 'IBAG73', 'IBAG72', 'IBAG67'],
    intro: [
      'Bagà és la porta d\'entrada al Parc Natural del Cadí-Moixeró, a la vall del Bastareny i als peus de la serra del Moixeró. Hi ha quatre estacions de la xarxa a tocar: tres al nucli (Nord, Centre i Sud) i una al Refugi de Rebost, a 1.650 m.',
      'Tenir estacions tan properes a diferents punts de la vila permet veure bé les inversions tèrmiques: les nits serenes i sense vent, l\'aire fred s\'acumula al fons de la vall i Bagà Sud sovint marca mínimes més baixes que estacions situades més amunt.',
    ],
  },
  {
    slug: 'gosol',
    name: 'Gósol',
    a: 'a Gósol',
    kind: 'poble',
    lat: 42.2378, lng: 1.6615, alt: 1423,
    stations: ['IGSOL4', 'IGSOL7', 'IGISCL6'],
    intro: [
      'Gósol és un dels pobles més alts del Berguedà, entre la serra del Cadí i el Pedraforca, on Picasso va passar l\'estiu de 1906. L\'estació de la xarxa és a 1.450 m, i a pocs quilòmetres hi ha les del Pedraforca (2.270 m) i Tancalaporta (2.440 m).',
      'Amb gairebé 650 metres més d\'altitud que Bagà, el contrast de temperatura entre tots dos pobles es pot seguir dia a dia a la taula d\'estacions.',
    ],
  },
  {
    slug: 'saldes',
    name: 'Saldes',
    a: 'a Saldes',
    kind: 'poble',
    lat: 42.2289, lng: 1.7333, alt: 1215,
    stations: ['IGSOL7', 'IGSOL4'],
    intro: [
      'Saldes és el poble als peus de la cara nord del Pedraforca i el punt de partida de la carretera del mirador de Gresolet i dels camins cap al refugi Lluís Estasen. No té estació pròpia: les dades de referència són les del Pedraforca (2.270 m) i les de Gósol (1.450 m).',
      'La previsió d\'aquesta pàgina està calculada per a l\'altitud del poble, de manera que les temperatures s\'ajusten a Saldes i no a la d\'una estació més alta o més baixa.',
    ],
  },
  {
    slug: 'pedraforca',
    name: 'Pedraforca',
    a: 'al Pedraforca',
    kind: 'cim',
    lat: 42.2402, lng: 1.7014, alt: 2270,
    stations: ['IGSOL7', 'IGSOL4'],
    points: [
      { label: 'Cim del Pollegó Superior', lat: 42.2402, lng: 1.7014, alt: 2506 },
      { label: 'Estació Pedraforca', lat: 42.2402, lng: 1.7014, alt: 2270 },
    ],
    intro: [
      'El Pedraforca és la muntanya més emblemàtica del Berguedà, amb els dos pollegons separats per l\'Enforcadura i el cim més alt, el Pollegó Superior, a 2.506 m. L\'estació Pedraforca de la xarxa és a 2.270 m.',
      'Abans de pujar-hi, mira sobretot el vent i la sensació tèrmica a l\'estació: a dalt, el vent del nord i l\'oest bufa amb molta més força que als pobles de la vall, i la temperatura pot ser més de 10 °C inferior a la de Saldes o Gósol.',
    ],
  },
  {
    slug: 'serra-del-cadi',
    name: 'Serra del Cadí',
    a: 'a la serra del Cadí',
    kind: 'cim',
    lat: 42.2838, lng: 1.7371, alt: 2440,
    stations: ['IGISCL6', 'IGSOL7'],
    points: [{ label: 'Tancalaporta', lat: 42.2838, lng: 1.7371, alt: 2440 }],
    intro: [
      'L\'estació de Tancalaporta, a 2.440 m, és la més alta de la xarxa Meteocadí i dona dades de primera mà de la carena de la serra del Cadí, on les condicions poden canviar molt de pressa.',
      'És la referència per saber quin vent i quina temperatura fa a dalt de tot abans d\'una travessa o una ascensió, i per seguir quan arriben les primeres nevades de la tardor.',
    ],
  },
  {
    slug: 'coll-de-pal',
    name: 'Coll de Pal',
    a: 'al Coll de Pal',
    kind: 'coll',
    lat: 42.2991, lng: 1.9252, alt: 2090,
    stations: ['IGUARD34', 'IBAG67'],
    points: [{ label: 'Coll de Pal', lat: 42.2991, lng: 1.9252, alt: 2090 }],
    roads: [{ road: 'BV-4024', label: 'la BV-4024 (Bagà – Coll de Pal)' }],
    intro: [
      'El Coll de Pal és el pas de muntanya entre el Berguedà i la Cerdanya per la carretera de Bagà a la Molina, a la zona de l\'antiga estació d\'esquí de Puigllançada. L\'estació de la xarxa és a 2.090 m.',
      'Com a coll obert entre dues valls, és un punt molt exposat al vent, i una bona referència per saber quina temperatura fa a la carretera els mesos freds.',
      "La carretera BV-4024, que puja de Bagà al Coll de Pal, es talla de vegades per la neu a la part alta, a prop del coll. Abans d'agafar-la a l'hivern, consulta l'estat de la carretera al Servei Català de Trànsit.",
    ],
  },
  {
    slug: 'guardiola-de-bergueda',
    name: 'Guardiola de Berguedà',
    a: 'a Guardiola de Berguedà',
    kind: 'poble',
    lat: 42.2333, lng: 1.8786, alt: 725,
    stations: ['IBAG72', 'ISANTJ53', 'IGUARD34'],
    intro: [
      'Guardiola de Berguedà és a la confluència del Bastareny amb el Llobregat, a la cruïlla de camins cap a Bagà, la Pobla de Lillet i el túnel del Cadí. Les estacions de la xarxa més properes són Bagà Sud (770 m) i Cerdanyola-Poble (964 m).',
      'La previsió d\'aquesta pàgina està calculada per a l\'altitud de Guardiola, al fons de la vall.',
    ],
  },
  {
    slug: 'la-pobla-de-lillet',
    name: 'La Pobla de Lillet',
    a: 'a la Pobla de Lillet',
    kind: 'poble',
    lat: 42.2447, lng: 1.9750, alt: 843,
    stations: ['IBARCELO40', 'ISANTJ138'],
    intro: [
      'La Pobla de Lillet és a la vall alta del Llobregat, coneguda pels Jardins Artigas de Gaudí. L\'estació de la xarxa és a 843 m, al mateix poble.',
      'Amb l\'estació de Cerdanyola-Forcat (1.115 m) a pocs quilòmetres, es pot comparar el fons de la vall amb el vessant de la muntanya.',
    ],
  },
  {
    slug: 'sant-julia-de-cerdanyola',
    name: 'Sant Julià de Cerdanyola',
    a: 'a Sant Julià de Cerdanyola',
    kind: 'poble',
    lat: 42.2217, lng: 1.8944, alt: 964,
    stations: ['ISANTJ53', 'ISANTJ138'],
    intro: [
      'Sant Julià de Cerdanyola, entre Guardiola de Berguedà i la Pobla de Lillet, té dues estacions de la xarxa: Cerdanyola-Poble, a 964 m, i Cerdanyola-Forcat, a 1.115 m.',
      'Amb només 150 metres de diferència entre totes dues, és un bon lloc per veure com canvien la temperatura i el vent en poc desnivell.',
    ],
  },
  {
    slug: 'la-nou-de-bergueda',
    name: 'La Nou de Berguedà',
    a: 'a la Nou de Berguedà',
    kind: 'poble',
    lat: 42.1650, lng: 1.8740, alt: 940,
    stations: ['ILANOU4', 'IBAG72'],
    intro: [
      'La Nou de Berguedà és un municipi de masies i veïnats escampats, al sud de Guardiola. L\'estació de la xarxa és a 940 m.',
      'És l\'estació més meridional de la xarxa i serveix per comparar el temps de la part baixa del Berguedà amb el de les valls del Cadí-Moixeró.',
    ],
  },
  // ------------------------------------------------------------------ muntanya i esquí
  // Sense estació pròpia al lloc: fan servir la de la xarxa més propera (vegeu la intro de cada un).
  {
    slug: 'tosa-d-alp',
    name: "Tosa d'Alp",
    a: "a la Tosa d'Alp",
    kind: 'cim',
    lat: 42.3206, lng: 1.8927, alt: 2536,
    stations: ['IGUARD34', 'IBAG67'],
    points: [{ label: "Cim de la Tosa d'Alp", lat: 42.3206, lng: 1.8927, alt: 2536 }],
    intro: [
      "La Tosa d'Alp (2.536 m) és el cim que uneix les estacions d'esquí de la Molina i Masella, al límit entre Alp, Urús, Das i Bagà. Al costat del cim hi ha el refugi-restaurant Niu de l'Àliga, on s'arriba en telecabina des de la Molina.",
      "Les estacions de la xarxa més properes són la del Coll de Pal (2.090 m) i la del Refugi de Rebost (1.650 m), totes dues al vessant del Berguedà. Al cim, obert a tots els vents, la ratxa i la sensació tèrmica solen ser pitjors que al coll: fixa-t'hi sobretot abans de sortir.",
    ],
  },
  {
    slug: 'la-molina',
    name: 'La Molina',
    a: 'a la Molina',
    kind: 'esqui',
    ski: { type: 'alpi', region: 'Cerdanya', web: 'https://www.lamolina.cat/' },
    lat: 42.3436, lng: 1.9561, alt: 1700,
    stations: ['IGUARD34', 'IBAG67'],
    points: [
      { label: "Cim de la Tosa d'Alp", lat: 42.3206, lng: 1.8927, alt: 2536 },
      { label: 'Base de les pistes', lat: 42.3436, lng: 1.9561, alt: 1700 },
    ],
    intro: [
      "La Molina, al terme d'Alp (Cerdanya), és l'estació d'esquí on el 1943 es va posar en marxa el primer remuntador de l'Estat. Les pistes van des d'uns 1.700 m fins al cim de la Tosa d'Alp (2.536 m) i, amb Masella, formen el domini Alp 2500.",
      "No hi tenim cap estació, però la del Coll de Pal (2.090 m) és a l'altre vessant de la mateixa carena de la Tosa i el Puigllançada, i a una altitud semblant a la de bona part de les pistes. És una bona referència per saber quin vent i quina temperatura fa a dalt. Tingues en compte que el coll mira al Berguedà: amb vent del nord o boira a la Cerdanya, a les pistes pot fer un temps diferent.",
      "La previsió d'aquesta pàgina està calculada per a la base de les pistes i per al cim de la Tosa.",
    ],
  },
  {
    slug: 'masella',
    name: 'Masella',
    a: 'a Masella',
    kind: 'esqui',
    ski: { type: 'alpi', region: 'Cerdanya', web: 'https://www.masella.com/', webcams: 'https://www.masella.com/es/webcam' },
    lat: 42.3512, lng: 1.9021, alt: 1600,
    stations: ['IGUARD34', 'IBAG67'],
    points: [
      { label: "Cim de la Tosa d'Alp", lat: 42.3206, lng: 1.8927, alt: 2536 },
      { label: 'Pla de Masella', lat: 42.3512, lng: 1.9021, alt: 1600 },
    ],
    intro: [
      "Masella és l'estació d'esquí de la cara nord de la Tosa d'Alp, entre els termes d'Alp, Das i Urús, a la Cerdanya. Les pistes van del Pla de Masella (1.600 m) fins al cim de la Tosa i, amb la Molina, formen el domini Alp 2500. És una de les poques estacions del Pirineu on també s'hi pot esquiar de nit.",
      "L'estació de la xarxa més propera és la del Coll de Pal (2.090 m), a l'altre vessant de la carena de la Tosa. Serveix de referència per al vent i la temperatura a la part alta, però la cara nord, on hi ha les pistes, sol ser més freda i ombrívola.",
      "La previsió d'aquesta pàgina està calculada per al Pla de Masella i per al cim de la Tosa.",
    ],
  },
  {
    slug: 'port-del-comte',
    name: 'Port del Comte',
    a: 'a Port del Comte',
    kind: 'esqui',
    ski: { type: 'alpi', region: 'Solsonès', web: 'https://portdelcomte.net/', webcams: 'https://portdelcomte.net/webcams-i-meteo/' },
    lat: 42.1728, lng: 1.5619, alt: 1700,
    stations: ['IGSOL4', 'IGSOL7'],
    points: [
      { label: 'Part alta de les pistes', lat: 42.1728, lng: 1.5619, alt: 2300 },
      { label: 'Base de les pistes', lat: 42.1728, lng: 1.5619, alt: 1700 },
    ],
    intro: [
      "Port del Comte és l'estació d'esquí alpí del Solsonès, al terme de la Coma i la Pedra, i va obrir el 1973. Les pistes comencen a uns 1.700 m i la majoria passen per dins d'un bosc de pins.",
      "No hi tenim cap estació: la més propera de la xarxa és la de Gósol (1.450 m), i la del Pedraforca (2.270 m) serveix de referència per al vent a dalt. La previsió d'aquesta pàgina està calculada per a la base de les pistes i per a 2.300 m, a la part alta.",
    ],
  },
  {
    slug: 'rasos-de-peguera',
    name: 'Rasos de Peguera',
    a: 'als Rasos de Peguera',
    kind: 'esqui',
    ski: { type: 'alpi', region: 'Berguedà', web: 'https://www.rasos.net/' },
    lat: 42.1367, lng: 1.7627, alt: 1850,
    stations: ['IGSOL7', 'ILANOU4'],
    points: [
      { label: 'Part alta de les pistes', lat: 42.1367, lng: 1.7627, alt: 2050 },
      { label: 'Base de les pistes', lat: 42.1367, lng: 1.7627, alt: 1850 },
    ],
    intro: [
      "Els Rasos de Peguera són l'estació d'esquí del Berguedà, entre Castellar del Riu i Montmajor, a l'espai natural de la serra d'Ensija. Les pistes, de cara al nord, van d'uns 1.850 a 2.050 m, i també s'hi fa esquí de muntanya, esquí de fons i raquetes.",
      "És un lloc clau de la història de l'esquí: segons la mateixa estació, el 1908 un grup d'excursionistes hi va fer servir esquís per primera vegada. Com que és més baixa que les estacions de la Cerdanya, la neu depèn molt de cada hivern: abans d'anar-hi, comprova sempre si és oberta.",
    ],
  },
  {
    slug: 'tuixent-la-vansa',
    name: 'Tuixent-La Vansa',
    a: 'a Tuixent-La Vansa',
    kind: 'esqui',
    ski: { type: 'nordic', region: 'Alt Urgell', web: 'https://www.tuixent-lavansa.com/' },
    lat: 42.2228, lng: 1.5383, alt: 1830,
    stations: ['IGSOL4', 'IGSOL7'],
    points: [
      { label: 'Part alta dels circuits', lat: 42.2228, lng: 1.5383, alt: 2150 },
      { label: 'Base dels circuits', lat: 42.2228, lng: 1.5383, alt: 1830 },
    ],
    intro: [
      "Tuixent-La Vansa és una estació d'esquí nòrdic a la cara nord del massís del Port del Comte, entre Josa i Tuixén i la Vansa i Fórnols, a l'Alt Urgell. Té prop de 30 km de circuits, entre uns 1.830 i 2.150 m, i itineraris per anar amb raquetes.",
      "Des dels circuits es veuen la serra del Cadí i el Pedraforca. L'estació de la xarxa més propera és la de Gósol (1.450 m), i la del Pedraforca (2.270 m) serveix de referència per al vent a dalt.",
    ],
  },
  {
    slug: 'comabona',
    name: 'Comabona',
    a: 'al Comabona',
    kind: 'cim',
    lat: 42.2837, lng: 1.7263, alt: 2548,
    stations: ['IGISCL6', 'IGSOL7'],
    points: [{ label: 'Cim del Comabona', lat: 42.2837, lng: 1.7263, alt: 2548 }],
    intro: [
      'El Comabona (2.548 m) és un dels cims més coneguts de la serra del Cadí, a la carena que separa Gisclareny (Berguedà) de Montellà i Martinet (Cerdanya). Al cim hi ha un vèrtex geodèsic.',
      "L'estació de Tancalaporta (2.440 m), la més alta de la xarxa, és a menys d'un quilòmetre, a la mateixa carena. Per això les seves dades en directe són la millor referència per saber quin temps fa al cim abans de pujar-hi.",
    ],
  },
  {
    slug: 'penyes-altes-de-moixero',
    name: 'Penyes Altes de Moixeró',
    a: 'a les Penyes Altes de Moixeró',
    kind: 'cim',
    lat: 42.3064, lng: 1.8425, alt: 2276,
    stations: ['IBAG67', 'IGUARD34'],
    points: [{ label: 'Cim de les Penyes Altes', lat: 42.3064, lng: 1.8425, alt: 2276 }],
    intro: [
      "Les Penyes Altes de Moixeró (2.276 m) són un dels cims més coneguts de la serra de Moixeró, dins del Parc Natural del Cadí-Moixeró. Una de les rutes més conegudes surt de l'aparcament de Gréixer, a la carretera de Bagà a Coll de Pal, puja pel coll de Jou i baixa per la fageda de la canal de la Serp.",
      "L'estació de la xarxa més propera és la del Refugi de Rebost (1.650 m). La del Coll de Pal (2.090 m), a la carena, és la millor referència per al vent que pots trobar a dalt.",
    ],
  },
  {
    slug: 'refugi-de-rebost',
    name: 'Refugi de Rebost',
    a: 'al Refugi de Rebost',
    kind: 'refugi',
    lat: 42.2872, lng: 1.8851, alt: 1640,
    stations: ['IBAG67', 'IGUARD34'],
    points: [{ label: 'Refugi de Rebost', lat: 42.2872, lng: 1.8851, alt: 1640 }],
    intro: [
      "El Refugi de Rebost (1.640 m) és al terme de Bagà, dins del Parc Natural del Cadí-Moixeró, al vessant sud de la Tosa d'Alp. S'hi arriba per la carretera de Bagà a Coll de Pal (BV-4024) i, des de l'aparcament, per un camí ben indicat d'uns 10 minuts.",
      "L'estació Refugi de Rebost de la xarxa és al mateix refugi i dona en directe la temperatura, el vent i la pluja del punt de sortida de moltes excursions, com la pujada a la Tosa d'Alp.",
    ],
  },
  // ------------------------------------------------------------------ carreteres
  {
    slug: 'tunel-del-cadi',
    name: 'Túnel del Cadí',
    a: 'al túnel del Cadí',
    kind: 'carretera',
    lat: 42.2947, lng: 1.8631, alt: 1175,
    stations: ['IBAG67', 'IBAG65'],
    points: [
      { label: 'Boca nord, a Urús', lat: 42.3350, lng: 1.8375, alt: 1236 },
      { label: 'Boca sud, a Guardiola de Berguedà', lat: 42.2947, lng: 1.8631, alt: 1175 },
    ],
    roads: [{ road: 'C-16', from: 110, to: 135, label: 'la C-16 entre els km 110 i 135' }],
    cameras: [
      { id: 'c1658', label: 'C-16, km 118,9 (Bagà)' },
      { id: 'c1661', label: 'C-16, km 122,3 (Guardiola de Berguedà)' },
    ],
    intro: [
      "El túnel del Cadí, a la C-16, travessa la serra del Cadí entre el Berguedà i la Cerdanya. Fa 5.026 metres i es va inaugurar el 30 d'octubre de 1984. La boca sud és al terme de Guardiola de Berguedà, a 1.175 m, i la boca nord, al d'Urús, a 1.236 m.",
      "A cada banda del túnel el temps pot ser molt diferent, i per això la previsió d'aquesta pàgina està calculada per a totes dues boques. Fixa't sobretot en la isoterma de 0 °C: si baixa a prop de l'altitud de les boques, a la carretera hi pot haver neu o gel.",
      "Les estacions de la xarxa més properes són la del Refugi de Rebost (1.650 m), a uns 2 km de la boca sud, i la de Bagà Nord (865 m), a la vall. L'estat de la carretera d'aquesta pàgina ve de les dades obertes del Servei Català de Trànsit, que s'actualitzen cada hora: abans de sortir, consulta sempre el seu web per saber si la carretera és oberta o si calen cadenes.",
    ],
  },
];

// Zona de cada lloc del Cadí (la de places-pirineu.js ja hi va escrita). zona 'cadi': la zona de la xarxa,
// la que surt al peu, a /muntanya i al cap de setmana.
const REGION_OF = { 'la-molina': 'cerdanya', masella: 'cerdanya', 'port-del-comte': 'solsones', 'tuixent-la-vansa': 'alt-urgell' };
export const PLACES = [
  ...CADI_PLACES.map((p) => ({ ...p, region: REGION_OF[p.slug] ?? 'bergueda', zona: 'cadi' })),
  ...PIRINEU.map((p) => ({ ...p, zona: 'pirineu' })),
];
export const CADI = PLACES.filter((p) => p.zona === 'cadi');

export const PLACE_BY_SLUG = Object.fromEntries(PLACES.map((p) => [p.slug, p]));
export const placesIn = (region) => PLACES.filter((p) => p.region === region);

// Llocs de muntanya (tenen la secció de condicions de muntanya i surten a /muntanya)
export const MOUNTAIN_KINDS = ['cim', 'coll', 'esqui', 'refugi'];
// Llocs amb previsió per altitud (muntanya i carreteres de port)
export const isMountain = (p) => MOUNTAIN_KINDS.includes(p.kind) || p.kind === 'carretera';
export const isRoad = (p) => p.kind === 'carretera';
export const MOUNTAINS = CADI.filter((p) => MOUNTAIN_KINDS.includes(p.kind));

// Llocs més propers a un lloc (per a l'enllaçat entre pàgines)
export function nearbyPlaces(p, n = 6) {
  return PLACES.filter((x) => x.slug !== p.slug)
    .map((x) => ({ x, d: distanceKm(p, x) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n);
}

// Distància en línia recta (km) entre un lloc i una estació
export function distanceKm(a, b) {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Els llocs per als selectors de previsió de la portada: a l'hivern (novembre-abril), els de la neu
export const FORECAST_CHIPS = ['baga', 'gosol', 'saldes', 'coll-de-pal', 'la-pobla-de-lillet'];
export const FORECAST_CHIPS_WINTER = ['la-molina', 'masella', 'puigcerda', 'port-del-comte', 'baga'];
export function forecastChips(iso) {
  const m = Number(iso.slice(5, 7));
  const list = m >= 11 || m <= 4 ? FORECAST_CHIPS_WINTER : FORECAST_CHIPS;
  return list.filter((s) => PLACE_BY_SLUG[s]);
}

// Estacions d'esquí de la portada
export const SKI_HOME = ['la-molina', 'masella', 'port-del-comte', 'rasos-de-peguera', 'tuixent-la-vansa', 'grandvalira'];
