// Llocs amb pàgina pròpia "El temps a …" (/temps/<slug>).
// stations: estacions de la xarxa associades, la primera és la de referència.
// intro: text propi de cada lloc. Revisa'l i afegeix-hi coneixement local: és el que el fa únic.

export const PLACES = [
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
    lat: 42.2397, lng: 1.7028, alt: 2270,
    stations: ['IGSOL7', 'IGSOL4'],
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
    lat: 42.2778, lng: 1.7361, alt: 2440,
    stations: ['IGISCL6', 'IGSOL7'],
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
    lat: 42.2847, lng: 1.8889, alt: 2090,
    stations: ['IGUARD34', 'IBAG67'],
    intro: [
      'El Coll de Pal és el pas de muntanya entre el Berguedà i la Cerdanya per la carretera de Bagà a la Molina, a la zona de l\'antiga estació d\'esquí de Puigllançada. L\'estació de la xarxa és a 2.090 m.',
      'Com a coll obert entre dues valls, és un punt molt exposat al vent, i una bona referència per saber quina temperatura fa a la carretera els mesos freds.',
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
    lat: 42.1922, lng: 1.8694, alt: 940,
    stations: ['ILANOU4', 'IBAG72'],
    intro: [
      'La Nou de Berguedà és un municipi de masies i veïnats escampats, al sud de Guardiola. L\'estació de la xarxa és a 940 m.',
      'És l\'estació més meridional de la xarxa i serveix per comparar el temps de la part baixa del Berguedà amb el de les valls del Cadí-Moixeró.',
    ],
  },
];

export const PLACE_BY_SLUG = Object.fromEntries(PLACES.map((p) => [p.slug, p]));

// Els llocs per als selectors de previsió de la portada
export const FORECAST_CHIPS = ['baga', 'gosol', 'saldes', 'coll-de-pal', 'la-pobla-de-lillet'];
