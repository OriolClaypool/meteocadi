// Versió en castellà de les pàgines de lloc (/es/tiempo/<slug>). El català és la versió principal:
// si canvies un text a places.js, canvia'l també aquí. Els topònims es mantenen en català.
// points / roads / cameras: etiquetes en el mateix ordre que a places.js.

export const PLACES_ES = {
  baga: {
    name: 'Bagà',
    a: 'en Bagà',
    intro: [
      'Bagà es la puerta de entrada al Parque Natural del Cadí-Moixeró, en el valle del Bastareny y a los pies de la sierra del Moixeró. Tiene cuatro estaciones de la red muy cerca: tres en el pueblo (Nord, Centre y Sud) y una en el Refugi de Rebost, a 1.650 m.',
      'Tener estaciones tan cerca en distintos puntos del pueblo permite ver bien las inversiones térmicas: en las noches despejadas y sin viento, el aire frío se acumula en el fondo del valle y Bagà Sud a menudo marca mínimas más bajas que estaciones situadas más arriba.',
    ],
  },
  gosol: {
    name: 'Gósol',
    a: 'en Gósol',
    intro: [
      'Gósol es uno de los pueblos más altos del Berguedà, entre la sierra del Cadí y el Pedraforca, donde Picasso pasó el verano de 1906. La estación de la red está a 1.450 m, y a pocos kilómetros están las del Pedraforca (2.270 m) y Tancalaporta (2.440 m).',
      'Con casi 650 metros más de altitud que Bagà, el contraste de temperatura entre los dos pueblos se puede seguir día a día en la tabla de estaciones.',
    ],
  },
  saldes: {
    name: 'Saldes',
    a: 'en Saldes',
    intro: [
      'Saldes es el pueblo a los pies de la cara norte del Pedraforca y el punto de partida de la carretera del mirador de Gresolet y de los caminos hacia el refugio Lluís Estasen. No tiene estación propia: los datos de referencia son los del Pedraforca (2.270 m) y los de Gósol (1.450 m).',
      'La previsión de esta página está calculada para la altitud del pueblo, de modo que las temperaturas se ajustan a Saldes y no a las de una estación más alta o más baja.',
    ],
  },
  pedraforca: {
    name: 'Pedraforca',
    a: 'en el Pedraforca',
    points: ['Cima del Pollegó Superior', 'Estación Pedraforca'],
    intro: [
      'El Pedraforca es la montaña más emblemática del Berguedà, con sus dos pollegons separados por la Enforcadura y la cima más alta, el Pollegó Superior, a 2.506 m. La estación Pedraforca de la red está a 2.270 m.',
      'Antes de subir, fíjate sobre todo en el viento y la sensación térmica en la estación: arriba, el viento del norte y del oeste sopla con mucha más fuerza que en los pueblos del valle, y la temperatura puede ser más de 10 °C inferior a la de Saldes o Gósol.',
    ],
  },
  'serra-del-cadi': {
    name: 'Sierra del Cadí',
    a: 'en la sierra del Cadí',
    points: ['Tancalaporta'],
    intro: [
      'La estación de Tancalaporta, a 2.440 m, es la más alta de la red Meteocadí y da datos de primera mano de la cresta de la sierra del Cadí, donde las condiciones pueden cambiar muy deprisa.',
      'Es la referencia para saber qué viento y qué temperatura hace arriba del todo antes de una travesía o una ascensión, y para seguir cuándo llegan las primeras nevadas del otoño.',
    ],
  },
  'coll-de-pal': {
    name: 'Coll de Pal',
    a: 'en el Coll de Pal',
    points: ['Coll de Pal'],
    roads: ['la BV-4024 (Bagà – Coll de Pal)'],
    intro: [
      'El Coll de Pal es el paso de montaña entre el Berguedà y la Cerdanya por la carretera de Bagà a La Molina, en la zona de la antigua estación de esquí de Puigllançada. La estación de la red está a 2.090 m.',
      'Como collado abierto entre dos valles, es un punto muy expuesto al viento, y una buena referencia para saber qué temperatura hace en la carretera en los meses fríos.',
      'La carretera BV-4024, que sube de Bagà al Coll de Pal, se corta a veces por la nieve en la parte alta, cerca del collado. Antes de cogerla en invierno, consulta el estado de la carretera en el Servei Català de Trànsit.',
    ],
  },
  'guardiola-de-bergueda': {
    name: 'Guardiola de Berguedà',
    a: 'en Guardiola de Berguedà',
    intro: [
      'Guardiola de Berguedà está en la confluencia del Bastareny con el Llobregat, en el cruce de caminos hacia Bagà, La Pobla de Lillet y el túnel del Cadí. Las estaciones de la red más cercanas son Bagà Sud (770 m) y Cerdanyola-Poble (964 m).',
      'La previsión de esta página está calculada para la altitud de Guardiola, en el fondo del valle.',
    ],
  },
  'la-pobla-de-lillet': {
    name: 'La Pobla de Lillet',
    a: 'en La Pobla de Lillet',
    intro: [
      'La Pobla de Lillet está en el valle alto del Llobregat y es conocida por los Jardines Artigas de Gaudí. La estación de la red está a 843 m, en el mismo pueblo.',
      'Con la estación de Cerdanyola-Forcat (1.115 m) a pocos kilómetros, se puede comparar el fondo del valle con la ladera de la montaña.',
    ],
  },
  'sant-julia-de-cerdanyola': {
    name: 'Sant Julià de Cerdanyola',
    a: 'en Sant Julià de Cerdanyola',
    intro: [
      'Sant Julià de Cerdanyola, entre Guardiola de Berguedà y La Pobla de Lillet, tiene dos estaciones de la red: Cerdanyola-Poble, a 964 m, y Cerdanyola-Forcat, a 1.115 m.',
      'Con solo 150 metros de diferencia entre las dos, es un buen lugar para ver cómo cambian la temperatura y el viento con poco desnivel.',
    ],
  },
  'la-nou-de-bergueda': {
    name: 'La Nou de Berguedà',
    a: 'en La Nou de Berguedà',
    intro: [
      'La Nou de Berguedà es un municipio de masías y núcleos dispersos, al sur de Guardiola. La estación de la red está a 940 m.',
      'Es la estación más meridional de la red y sirve para comparar el tiempo de la parte baja del Berguedà con el de los valles del Cadí-Moixeró.',
    ],
  },
  'tosa-d-alp': {
    name: "Tosa d'Alp",
    a: "en la Tosa d'Alp",
    points: ["Cima de la Tosa d'Alp"],
    intro: [
      "La Tosa d'Alp (2.536 m) es la cima que une las estaciones de esquí de La Molina y Masella, en el límite entre Alp, Urús, Das y Bagà. Junto a la cima está el refugio-restaurante Niu de l'Àliga, al que se llega en telecabina desde La Molina.",
      'Las estaciones de la red más cercanas son la del Coll de Pal (2.090 m) y la del Refugi de Rebost (1.650 m), las dos en la vertiente del Berguedà. En la cima, abierta a todos los vientos, la racha y la sensación térmica suelen ser peores que en el collado: fíjate en ellas sobre todo antes de salir.',
    ],
  },
  'la-molina': {
    name: 'La Molina',
    a: 'en La Molina',
    points: ["Cima de la Tosa d'Alp", 'Base de las pistas'],
    intro: [
      "La Molina, en el término de Alp (Cerdanya), es la estación de esquí donde en 1943 se puso en marcha el primer remonte de España. Las pistas van desde unos 1.700 m hasta la cima de la Tosa d'Alp (2.536 m) y, con Masella, forman el dominio Alp 2500.",
      'No tenemos ninguna estación allí, pero la del Coll de Pal (2.090 m) está en la otra vertiente de la misma cresta de la Tosa y el Puigllançada, y a una altitud parecida a la de buena parte de las pistas. Es una buena referencia para saber qué viento y qué temperatura hace arriba. Ten en cuenta que el collado mira al Berguedà: con viento del norte o niebla en la Cerdanya, en las pistas puede hacer un tiempo diferente.',
      'La previsión de esta página está calculada para la base de las pistas y para la cima de la Tosa.',
    ],
  },
  masella: {
    name: 'Masella',
    a: 'en Masella',
    points: ["Cima de la Tosa d'Alp", 'Pla de Masella'],
    intro: [
      "Masella es la estación de esquí de la cara norte de la Tosa d'Alp, entre los términos de Alp, Das y Urús, en la Cerdanya. Las pistas van del Pla de Masella (1.600 m) hasta la cima de la Tosa y, con La Molina, forman el dominio Alp 2500. Es una de las pocas estaciones del Pirineo donde también se puede esquiar de noche.",
      'La estación de la red más cercana es la del Coll de Pal (2.090 m), en la otra vertiente de la cresta de la Tosa. Sirve de referencia para el viento y la temperatura en la parte alta, pero la cara norte, donde están las pistas, suele ser más fría y umbría.',
      'La previsión de esta página está calculada para el Pla de Masella y para la cima de la Tosa.',
    ],
  },
  'port-del-comte': {
    name: 'Port del Comte',
    a: 'en Port del Comte',
    points: ['Parte alta de las pistas', 'Base de las pistas'],
    intro: [
      'Port del Comte es la estación de esquí alpino del Solsonès, en el término de La Coma i la Pedra, y abrió en 1973. Las pistas empiezan a unos 1.700 m y la mayoría pasan por dentro de un bosque de pinos.',
      'No tenemos ninguna estación allí: la más cercana de la red es la de Gósol (1.450 m), y la del Pedraforca (2.270 m) sirve de referencia para el viento arriba. La previsión de esta página está calculada para la base de las pistas y para 2.300 m, en la parte alta.',
    ],
  },
  'rasos-de-peguera': {
    name: 'Rasos de Peguera',
    a: 'en los Rasos de Peguera',
    points: ['Parte alta de las pistas', 'Base de las pistas'],
    intro: [
      "Los Rasos de Peguera son la estación de esquí del Berguedà, entre Castellar del Riu y Montmajor, en el espacio natural de la sierra de Ensija. Las pistas, orientadas al norte, van de unos 1.850 a 2.050 m, y también se practica esquí de montaña, esquí de fondo y raquetas.",
      'Es un lugar clave en la historia del esquí: según la propia estación, en 1908 un grupo de excursionistas usó esquís allí por primera vez. Como está más baja que las estaciones de la Cerdanya, la nieve depende mucho de cada invierno: antes de ir, comprueba siempre si está abierta.',
    ],
  },
  'tuixent-la-vansa': {
    name: 'Tuixent-La Vansa',
    a: 'en Tuixent-La Vansa',
    points: ['Parte alta de los circuitos', 'Base de los circuitos'],
    intro: [
      'Tuixent-La Vansa es una estación de esquí nórdico en la cara norte del macizo del Port del Comte, entre Josa i Tuixén y La Vansa i Fórnols, en el Alt Urgell. Tiene cerca de 30 km de circuitos, entre unos 1.830 y 2.150 m, e itinerarios para ir con raquetas.',
      'Desde los circuitos se ven la sierra del Cadí y el Pedraforca. La estación de la red más cercana es la de Gósol (1.450 m), y la del Pedraforca (2.270 m) sirve de referencia para el viento arriba.',
    ],
  },
  comabona: {
    name: 'Comabona',
    a: 'en el Comabona',
    points: ['Cima del Comabona'],
    intro: [
      'El Comabona (2.548 m) es una de las cimas más conocidas de la sierra del Cadí, en la cresta que separa Gisclareny (Berguedà) de Montellà i Martinet (Cerdanya). En la cima hay un vértice geodésico.',
      'La estación de Tancalaporta (2.440 m), la más alta de la red, está a menos de un kilómetro, en la misma cresta. Por eso sus datos en directo son la mejor referencia para saber qué tiempo hace en la cima antes de subir.',
    ],
  },
  'penyes-altes-de-moixero': {
    name: 'Penyes Altes de Moixeró',
    a: 'en las Penyes Altes de Moixeró',
    points: ['Cima de las Penyes Altes'],
    intro: [
      'Las Penyes Altes de Moixeró (2.276 m) son una de las cimas más conocidas de la sierra del Moixeró, dentro del Parque Natural del Cadí-Moixeró. Una de las rutas más conocidas sale del aparcamiento de Gréixer, en la carretera de Bagà al Coll de Pal, sube por el coll de Jou y baja por el hayedo de la canal de la Serp.',
      'La estación de la red más cercana es la del Refugi de Rebost (1.650 m). La del Coll de Pal (2.090 m), en la cresta, es la mejor referencia para el viento que puedes encontrar arriba.',
    ],
  },
  'refugi-de-rebost': {
    name: 'Refugi de Rebost',
    a: 'en el Refugi de Rebost',
    points: ['Refugi de Rebost'],
    intro: [
      "El Refugi de Rebost (1.640 m) está en el término de Bagà, dentro del Parque Natural del Cadí-Moixeró, en la vertiente sur de la Tosa d'Alp. Se llega por la carretera de Bagà al Coll de Pal (BV-4024) y, desde el aparcamiento, por un camino bien señalizado de unos 10 minutos.",
      "La estación Refugi de Rebost de la red está en el mismo refugio y da en directo la temperatura, el viento y la lluvia del punto de salida de muchas excursiones, como la subida a la Tosa d'Alp.",
    ],
  },
  'tunel-del-cadi': {
    name: 'Túnel del Cadí',
    a: 'en el túnel del Cadí',
    points: ['Boca norte, en Urús', 'Boca sur, en Guardiola de Berguedà'],
    roads: ['la C-16 entre los km 110 y 135'],
    cameras: ['C-16, km 118,9 (Bagà)', 'C-16, km 122,3 (Guardiola de Berguedà)'],
    intro: [
      'El túnel del Cadí, en la C-16, atraviesa la sierra del Cadí entre el Berguedà y la Cerdanya. Mide 5.026 metros y se inauguró el 30 de octubre de 1984. La boca sur está en el término de Guardiola de Berguedà, a 1.175 m, y la boca norte, en el de Urús, a 1.236 m.',
      'A cada lado del túnel el tiempo puede ser muy diferente, y por eso la previsión de esta página está calculada para las dos bocas. Fíjate sobre todo en la isoterma de 0 °C: si baja cerca de la altitud de las bocas, en la carretera puede haber nieve o hielo.',
      'Las estaciones de la red más cercanas son la del Refugi de Rebost (1.650 m), a unos 2 km de la boca sur, y la de Bagà Nord (865 m), en el valle. El estado de la carretera de esta página viene de los datos abiertos del Servei Català de Trànsit, que se actualizan cada hora: antes de salir, consulta siempre su web para saber si la carretera está abierta o si hacen falta cadenas.',
    ],
  },
};

// Lloc amb els textos en l'idioma demanat (el català és el de places.js)
export function localize(p, lang = 'ca') {
  if (lang !== 'es') return p;
  const e = PLACES_ES[p.slug];
  if (!e) throw new Error(`Falta la traducció al castellà de ${p.slug} a places-es.js`);
  return {
    ...p,
    name: e.name,
    a: e.a,
    intro: e.intro,
    points: p.points?.map((x, i) => ({ ...x, label: e.points?.[i] ?? x.label })),
    roads: p.roads?.map((x, i) => ({ ...x, label: e.roads?.[i] ?? x.label })),
    cameras: p.cameras?.map((x, i) => ({ ...x, label: e.cameras?.[i] ?? x.label })),
  };
}

export const esPath = (slug) => `/es/tiempo/${slug}`;
export const caPath = (slug) => `/temps/${slug}`;
