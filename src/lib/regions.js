// Zones (comarques i Andorra) amb pàgina pròpia: /temps/<slug> i /es/tiempo/<slug>.
// Cada lloc de places.js hi pertany pel camp region. areas: zones per a les incidències del Servei Català de
// Trànsit (lat, lng, radi en km; com a molt 4 i 30 km), buit a Andorra (el SCT no hi arriba).

export const REGIONS = [
  {
    slug: 'bergueda',
    name: 'Berguedà',
    a: 'al Berguedà',
    capital: 'berga',
    lat: 42.2, lng: 1.84,
    areas: [{ lat: 42.1, lng: 1.84, km: 12 }, { lat: 42.25, lng: 1.86, km: 14 }],
    intro: [
      "El Berguedà és la comarca de l'alt Llobregat, de la plana de Berga fins a les serres del Cadí i el Moixeró. Aquí hi ha la xarxa d'estacions de Meteocadí, de les valls de Bagà i Gósol fins als 2.440 metres de Tancalaporta.",
    ],
    es: {
      name: 'Berguedà',
      a: 'en el Berguedà',
      intro: [
        'El Berguedà es la comarca del alto Llobregat, desde el llano de Berga hasta las sierras del Cadí y el Moixeró. Aquí está la red de estaciones de Meteocadí, desde los valles de Bagà y Gósol hasta los 2.440 metros de Tancalaporta.',
      ],
    },
  },
  {
    slug: 'cerdanya',
    name: 'Cerdanya',
    a: 'a la Cerdanya',
    capital: 'puigcerda',
    lat: 42.4, lng: 1.85,
    areas: [{ lat: 42.4, lng: 1.9, km: 16 }, { lat: 42.37, lng: 1.72, km: 12 }],
    intro: [
      "La Cerdanya és una plana ampla a l'alta vall del Segre, a més de 1.000 metres d'altitud, entre la serra del Cadí i el Pirineu axial, i partida entre Catalunya i França. Puigcerdà n'és la capital històrica, i a l'extrem oriental hi ha les estacions d'esquí de la Molina i Masella.",
      "Com que és una plana envoltada de muntanyes, a les nits serenes d'hivern l'aire fred s'hi acumula i les mínimes poden ser molt més baixes al fons de la vall que a mitja muntanya.",
    ],
    es: {
      name: 'Cerdanya',
      a: 'en la Cerdanya',
      title: 'la Cerdanya (Cerdaña)',
      intro: [
        'La Cerdanya (Cerdaña) es un llano amplio en el alto valle del Segre, a más de 1.000 metros de altitud, entre la sierra del Cadí y el Pirineo axial, y repartido entre Cataluña y Francia. Puigcerdà es su capital histórica, y en el extremo oriental están las estaciones de esquí de La Molina y Masella.',
        'Como es un llano rodeado de montañas, en las noches despejadas de invierno el aire frío se acumula y las mínimas pueden ser mucho más bajas en el fondo del valle que a media montaña.',
      ],
    },
  },
  {
    slug: 'ripolles',
    name: 'Ripollès',
    a: 'al Ripollès',
    capital: 'ripoll',
    lat: 42.3, lng: 2.2,
    areas: [{ lat: 42.25, lng: 2.19, km: 14 }, { lat: 42.34, lng: 2.33, km: 12 }, { lat: 42.33, lng: 2.02, km: 8 }],
    intro: [
      "El Ripollès és la comarca de les capçaleres del Ter i del Freser, al Pirineu oriental, amb la capital a Ripoll. Hi ha dues estacions d'esquí de Ferrocarrils de la Generalitat: la Vall de Núria, on només s'arriba amb cremallera o a peu, i Vallter, a Setcases.",
    ],
    es: {
      name: 'Ripollès',
      a: 'en el Ripollès',
      intro: [
        'El Ripollès es la comarca de las cabeceras del Ter y del Freser, en el Pirineo oriental, con la capital en Ripoll. Tiene dos estaciones de esquí de Ferrocarrils de la Generalitat: la Vall de Núria, a la que solo se llega en tren cremallera o a pie, y Vallter, en Setcases.',
      ],
    },
  },
  {
    slug: 'alt-urgell',
    name: 'Alt Urgell',
    a: "a l'Alt Urgell",
    capital: 'la-seu-d-urgell',
    lat: 42.3, lng: 1.45,
    areas: [{ lat: 42.36, lng: 1.46, km: 14 }, { lat: 42.22, lng: 1.54, km: 10 }],
    intro: [
      "L'Alt Urgell és la comarca de la vall del Segre entre la Cerdanya i el Prepirineu, amb la capital a la Seu d'Urgell i la porta d'entrada a Andorra. Al sud, a tocar del Cadí, hi ha l'estació d'esquí nòrdic de Tuixent-la Vansa.",
    ],
    es: {
      name: 'Alt Urgell',
      a: 'en el Alt Urgell',
      intro: [
        "El Alt Urgell es la comarca del valle del Segre entre la Cerdanya y el Prepirineo, con la capital en la Seu d'Urgell y la puerta de entrada a Andorra. Al sur, junto al Cadí, está la estación de esquí nórdico de Tuixent-La Vansa.",
      ],
    },
  },
  {
    slug: 'solsones',
    name: 'Solsonès',
    a: 'al Solsonès',
    capital: 'solsona',
    lat: 42.08, lng: 1.55,
    areas: [{ lat: 42.0, lng: 1.52, km: 12 }, { lat: 42.15, lng: 1.58, km: 12 }],
    intro: [
      "El Solsonès és la comarca entre la Catalunya central i el Prepirineu, amb la capital a Solsona. Al nord, a la vall de Lord, hi ha l'estació d'esquí de Port del Comte.",
    ],
    es: {
      name: 'Solsonès',
      a: 'en el Solsonès',
      intro: [
        'El Solsonès es la comarca entre la Cataluña central y el Prepirineo, con la capital en Solsona. Al norte, en el valle de Lord, está la estación de esquí de Port del Comte.',
      ],
    },
  },
  {
    slug: 'pallars-sobira',
    name: 'Pallars Sobirà',
    a: 'al Pallars Sobirà',
    capital: 'sort',
    lat: 42.55, lng: 1.15,
    areas: [{ lat: 42.42, lng: 1.14, km: 12 }, { lat: 42.6, lng: 1.1, km: 14 }, { lat: 42.66, lng: 0.98, km: 8 }],
    intro: [
      "El Pallars Sobirà és la comarca de la Noguera Pallaresa, amb la capital a Sort. Al nord hi ha la Pica d'Estats, el cim més alt de Catalunya, i a l'oest part del Parc Nacional d'Aigüestortes i Estany de Sant Maurici. Hi ha tres estacions d'esquí: Espot, Port Ainé i Tavascan.",
    ],
    es: {
      name: 'Pallars Sobirà',
      a: 'en el Pallars Sobirà',
      intro: [
        "El Pallars Sobirà es la comarca de la Noguera Pallaresa, con la capital en Sort. Al norte está la Pica d'Estats, la cima más alta de Cataluña, y al oeste parte del Parque Nacional de Aigüestortes y Estany de Sant Maurici. Tiene tres estaciones de esquí: Espot, Port Ainé y Tavascan.",
      ],
    },
  },
  {
    slug: 'alta-ribagorca',
    name: 'Alta Ribagorça',
    a: "a l'Alta Ribagorça",
    capital: 'el-pont-de-suert',
    lat: 42.48, lng: 0.8,
    areas: [{ lat: 42.41, lng: 0.74, km: 10 }, { lat: 42.5, lng: 0.83, km: 10 }],
    intro: [
      "L'Alta Ribagorça és la comarca de la Noguera Ribagorçana, amb la capital al Pont de Suert. Hi ha la Vall de Boí, amb les esglésies romàniques declarades Patrimoni Mundial per la UNESCO, i l'estació d'esquí de Boí Taüll.",
    ],
    es: {
      name: 'Alta Ribagorça',
      a: 'en la Alta Ribagorça',
      intro: [
        'La Alta Ribagorça es la comarca de la Noguera Ribagorçana, con la capital en el Pont de Suert. Aquí está la Vall de Boí, con sus iglesias románicas declaradas Patrimonio Mundial por la UNESCO, y la estación de esquí de Boí Taüll.',
      ],
    },
  },
  {
    slug: 'vall-d-aran',
    name: "Vall d'Aran",
    a: "a la Vall d'Aran",
    capital: 'vielha',
    lat: 42.72, lng: 0.85,
    areas: [{ lat: 42.7, lng: 0.8, km: 12 }, { lat: 42.7, lng: 0.93, km: 10 }],
    intro: [
      "La Vall d'Aran és a la capçalera de la Garona, al vessant atlàntic dels Pirineus, i per això el temps hi pot ser molt diferent del de la resta de Catalunya. La capital és Vielha, i a l'est de la vall, camí del port de la Bonaigua, hi ha l'estació d'esquí de Baqueira Beret.",
    ],
    es: {
      name: 'Valle de Arán',
      a: 'en el Valle de Arán',
      intro: [
        "El Valle de Arán (Val d'Aran) está en la cabecera del Garona, en la vertiente atlántica de los Pirineos, y por eso el tiempo puede ser muy distinto del del resto de Cataluña. La capital es Vielha, y al este del valle, camino del puerto de la Bonaigua, está la estación de esquí de Baqueira Beret.",
      ],
    },
  },
  {
    slug: 'andorra',
    name: 'Andorra',
    a: 'a Andorra',
    capital: 'andorra-la-vella',
    lat: 42.55, lng: 1.58,
    areas: [],
    country: 'AD',
    intro: [
      "Andorra és un estat del Pirineu entre Catalunya i França, amb set parròquies i la capital a Andorra la Vella. Té tres estacions d'esquí: Grandvalira, Pal Arinsal i Ordino Arcalís.",
      "La previsió de cada lloc està calculada per a la seva altitud, que a Andorra va de menys de 1.000 metres a Sant Julià de Lòria a més de 2.000 al Pas de la Casa.",
    ],
    es: {
      name: 'Andorra',
      a: 'en Andorra',
      intro: [
        'Andorra es un estado del Pirineo entre Cataluña y Francia, con siete parroquias y la capital en Andorra la Vella. Tiene tres estaciones de esquí: Grandvalira, Pal Arinsal y Ordino Arcalís.',
        'La previsión de cada lugar está calculada para su altitud, que en Andorra va de menos de 1.000 metros en Sant Julià de Lòria a más de 2.000 en el Pas de la Casa.',
      ],
    },
  },
];

export const REGION_BY_SLUG = Object.fromEntries(REGIONS.map((r) => [r.slug, r]));

// Zona amb els textos en l'idioma demanat
export function localizeRegion(r, lang = 'ca') {
  if (!r || lang !== 'es') return r;
  return { ...r, name: r.es.name, a: r.es.a, intro: r.es.intro, title: r.es.title };
}

// "a la Cerdanya" → "de la Cerdanya", "a Alp" → "d'Alp", "en el Valle de Arán" → "del Valle de Arán"
export function deA(a, lang = 'ca') {
  if (lang === 'es') return a.replace(/^en el /, 'del ').replace(/^en /, 'de ');
  return a
    .replace(/^a l'/, "de l'")
    .replace(/^a la /, 'de la ')
    .replace(/^als /, 'dels ')
    .replace(/^al /, 'del ')
    .replace(/^a ([aeiouàèéíòóúAEIOUÀÈÉÍÒÓÚhH])/, "d'$1")
    .replace(/^a /, 'de ');
}
