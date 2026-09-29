// Versión en castellano de los lugares de places-pirineu.js. Los topónimos se mantienen en catalán (o en aranés).
// points: etiquetas en el mismo orden que en places-pirineu.js.

const PISTES = ['Parte alta de las pistas', 'Base de las pistas'];
const CIRCUITS = ['Parte alta de los circuitos', 'Base de los circuitos'];

export const PIRINEU_ES = {
  berga: {
    name: 'Berga',
    a: 'en Berga',
    intro: [
      'Berga, a 704 m, es la capital del Berguedà, al pie de la sierra de Queralt y frente al valle del Llobregat. Cada año, por Corpus, se celebra la Patum, declarada Patrimonio Inmaterial de la Humanidad por la UNESCO.',
      'La estación de la red Meteocadí más cercana es la de la Nou de Berguedà (940 m), valle arriba, y en esta página también aparecen en directo las estaciones del Meteocat más cercanas.',
    ],
  },
  'castellar-de-n-hug': {
    name: "Castellar de n'Hug",
    a: "en Castellar de n'Hug",
    intro: [
      "Castellar de n'Hug, a 1.395 m, es un pueblo del Berguedà en el límite con el Ripollès. En su término nace el Llobregat: las fuentes del río están a pocos minutos a pie del pueblo.",
      'Las estaciones de la red más cercanas son la de la Pobla de Lillet (843 m), en el valle, y la del Coll de Pal (2.090 m), en la cresta del Moixeró, que da una buena idea del viento que hace arriba.',
    ],
  },
  puigcerda: {
    name: 'Puigcerdà',
    a: 'en Puigcerdà',
    intro: [
      'Puigcerdà es la capital histórica de la Cerdanya, a 1.202 m, sobre una colina encima del llano que riegan el Segre y el río Querol, junto a la frontera francesa. Con unos 10.000 habitantes es la población más grande de la comarca, y está a menos de 20 km de las pistas de La Molina y Masella.',
      'El llano de la Cerdanya está rodeado de montañas: en las noches despejadas de invierno el aire frío se acumula y las mínimas del valle pueden ser más bajas que las de las estaciones de esquí, bastante más arriba.',
    ],
  },
  alp: {
    name: 'Alp',
    a: 'en Alp',
    intro: [
      'Alp, a 1.158 m, es el municipio más oriental de la Baixa Cerdanya y el que la une con el Ripollès por la collada de Toses. En su término están La Molina y parte de Masella, las dos estaciones de esquí del dominio Alp 2500.',
      "El pueblo está en el llano, a los pies de la Tosa d'Alp (2.536 m): entre el núcleo y la cima hay casi 1.400 metros de desnivel, y la temperatura y la nieve pueden ser muy distintas.",
    ],
  },
  llivia: {
    name: 'Llívia',
    a: 'en Llívia',
    intro: [
      'Llívia, a 1.224 m, es un enclave: un municipio catalán de la Cerdanya rodeado por completo de territorio francés, como consecuencia del Tratado de los Pirineos (1659) y del Tratado de Llívia (1660).',
      'Está en el mismo llano del Segre que Puigcerdà, a pocos kilómetros, y tiene un tiempo muy parecido: inviernos fríos, con heladas fuertes en las noches despejadas.',
    ],
  },
  'bellver-de-cerdanya': {
    name: 'Bellver de Cerdanya',
    a: 'en Bellver de Cerdanya',
    intro: [
      'Bellver de Cerdanya, a 1.061 m, es el núcleo principal de la Batllia, al suroeste de la Cerdanya, sobre una colina encima del Segre. El municipio reúne varios pueblos y masías a ambos lados del río y es uno de los más grandes de la comarca.',
      'Al sur se levanta la sierra del Cadí, y las estaciones de esquí nórdico de Lles y Aransa quedan al otro lado del valle, en la solana.',
    ],
  },
  'estacio-de-lles': {
    name: 'Estación de Lles',
    a: 'en la estación de Lles',
    points: CIRCUITS,
    intro: [
      'La estación de esquí nórdico de Lles está en el municipio de Lles de Cerdanya, en la falda de la Tossa Plana de Lles (2.916 m). Abrió en 1970 y tiene unos 35 km de circuitos de esquí de fondo entre los 1.900 y los 2.335 m, además de itinerarios para raquetas.',
      "El circuito de l'Autopista pasa por el refugio del Pradell y la une con la estación vecina de Aransa.",
    ],
  },
  'estacio-d-aransa': {
    name: 'Estación de Aransa',
    a: 'en la estación de Aransa',
    points: CIRCUITS,
    intro: [
      'Aransa es una estación de esquí nórdico junto al pueblo de Arànser, en el municipio de Lles de Cerdanya, rodeada por la Tossa Plana de Lles (2.916 m) y el pico del Sirvent (2.836 m). Abrió en 1986 y tiene unos 32 km de circuitos entre los 1.850 y los 2.150 m.',
      'El circuito del Mirador llega a la parte más alta de la estación, con vistas sobre la Cerdanya y el Cadí.',
    ],
  },
  'guils-fontanera': {
    name: 'Guils Fontanera',
    a: 'en Guils Fontanera',
    points: CIRCUITS,
    intro: [
      'Guils Fontanera es la estación municipal de esquí nórdico de Guils de Cerdanya, en el bosque de Fontanera, al norte de Puigcerdà. Abrió en 1993 y los circuitos, entre bosques de pino negro, van de los 1.905 a los 2.080 m.',
    ],
  },
  'vall-de-nuria': {
    name: 'Vall de Núria',
    a: 'en la Vall de Núria',
    points: ['Parte alta de las pistas', 'Base de las pistas, en el santuario'],
    intro: [
      'La estación de esquí de la Vall de Núria está en el fondo del valle del mismo nombre, alrededor del santuario, en el término de Queralbs, y la gestiona Ferrocarrils de la Generalitat. No se puede llegar en coche: solo en el tren cremallera, inaugurado en 1931, que sale de Ribes de Freser y pasa por Queralbs, o a pie.',
      'Tiene unas 11 pistas y 7,6 km esquiables entre los 1.964 y los 2.252 m, rodeadas de cimas de casi 3.000 metros.',
    ],
  },
  vallter: {
    name: 'Vallter',
    a: 'en Vallter',
    points: ['Parte alta de las pistas', 'Base de servicios'],
    intro: [
      "Vallter (Vallter 2000) es la estación de esquí de Setcases, en el extremo norte del Ripollès, en el circo de Ulldeter, donde nace el Ter, dentro del Parque Natural de las Capçaleres del Ter i del Freser. La gestiona Ferrocarrils de la Generalitat. Las pistas van de los 2.000 a los 2.500 m, y la base de servicios está a unos 2.100 m.",
      'La nieve depende mucho de los temporales de levante: la temporada 1995-1996, las tormentas de levante permitieron abrir hasta finales de mayo. Para los inviernos más secos, la estación tiene nieve artificial.',
    ],
  },
  ripoll: {
    name: 'Ripoll',
    a: 'en Ripoll',
    intro: [
      'Ripoll, a 691 m, es la capital del Ripollès, en la confluencia del Ter y el Freser. Se la conoce como la cuna de Cataluña por el monasterio de Santa Maria de Ripoll, donde están enterrados los condes de la casa de Barcelona.',
      'Desde aquí la N-260 sube por el valle del Freser hacia Ribes, la collada de Toses y la Cerdanya, y por Sant Joan de les Abadesses se llega a Camprodon y al valle alto del Ter.',
    ],
  },
  'ribes-de-freser': {
    name: 'Ribes de Freser',
    a: 'en Ribes de Freser',
    intro: [
      'Ribes de Freser, a 912 m, está en el corazón del valle del Freser, en el Pirineo oriental. De aquí sale el tren cremallera de Núria, que tiene dos estaciones en el municipio, y por aquí pasa la N-260 hacia la collada de Toses y la Cerdanya.',
    ],
  },
  queralbs: {
    name: 'Queralbs',
    a: 'en Queralbs',
    intro: [
      'Queralbs, a 1.236 m, es el pueblo más alto del valle del Freser y la última parada del cremallera antes de la Vall de Núria. La iglesia románica de Sant Jaume es del siglo X.',
      'Mucha gente deja aquí el coche para subir a Núria en el cremallera o a pie por el camino viejo de las gargantas del río de Núria.',
    ],
  },
  camprodon: {
    name: 'Camprodon',
    a: 'en Camprodon',
    intro: [
      "Camprodon, a 947 m, es la villa principal del valle de Camprodon, al noreste del Ripollès, atravesada por el Ter y el Ritort. Es el paso hacia Setcases y la estación de esquí de Vallter, y hacia Molló y Francia por el coll d'Ares.",
    ],
  },
  setcases: {
    name: 'Setcases',
    a: 'en Setcases',
    intro: [
      'Setcases, a 1.265 m, es el pueblo de la cabecera del Ter, en el extremo norte del Ripollès, y el último antes de subir a la estación de esquí de Vallter y al refugio de Ulldeter. El nombre está documentado desde el año 965.',
    ],
  },
  mollo: {
    name: 'Molló',
    a: 'en Molló',
    intro: [
      "Molló, a 1.182 m, está en la cabecera del Ritort, en el valle de Camprodon, junto a la frontera con Prats de Molló i la Presta, en el Vallespir. Es el último pueblo antes del coll d'Ares, el paso hacia Francia.",
    ],
  },
  'collada-de-toses': {
    name: 'Collada de Toses',
    a: 'en la collada de Toses',
    points: ['Collada de Toses, N-260'],
    intro: [
      'La collada de Toses, a unos 1.800 m, es el puerto de la N-260 entre el Ripollès y la Cerdanya, en los términos de Toses y Alp, junto a La Molina. Es un paso entre la sierra del Cadí-Moixeró y las montañas de la Vall de Núria.',
      'En invierno puede haber nieve y hielo en la calzada: fíjate sobre todo en la nieve prevista y en la isoterma de 0 °C, y consulta el estado de la carretera antes de salir.',
    ],
  },
  'la-seu-d-urgell': {
    name: "La Seu d'Urgell",
    a: "en la Seu d'Urgell",
    intro: [
      "La Seu d'Urgell, a 691 m, es la capital del Alt Urgell y la sede del obispado de Urgell, en la confluencia del Segre y el Valira. Es la población más grande del Alt Pirineu i Aran y la puerta de entrada a Andorra por la N-145.",
      'Como está en el fondo de un valle rodeado de sierras, en las noches despejadas de invierno el aire frío se acumula y puede hacer más frío que a media montaña.',
    ],
  },
  solsona: {
    name: 'Solsona',
    a: 'en Solsona',
    intro: [
      'Solsona, a 664 m, es la capital del Solsonès, en el altiplano del mismo nombre, y la ciudad más grande de la comarca. De aquí sale la carretera hacia el valle de Lord y la estación de esquí de Port del Comte, al norte de la comarca.',
    ],
  },
  'sant-llorenc-de-morunys': {
    name: 'Sant Llorenç de Morunys',
    a: 'en Sant Llorenç de Morunys',
    intro: [
      'Sant Llorenç de Morunys, a 925 m, es la villa del valle de Lord, al norte del Solsonès, en el valle alto del Cardener. Es el pueblo de referencia para subir a las pistas de Port del Comte y está junto al embalse de la Llosa del Cavall.',
    ],
  },
  'espot-esqui': {
    name: 'Espot Esquí',
    a: 'en Espot Esquí',
    points: PISTES,
    intro: [
      'Espot Esquí es la estación de esquí del municipio de Espot, en una de las puertas del Parque Nacional de Aigüestortes y Estany de Sant Maurici. Continúa la antigua Super Espot, inaugurada la temporada 1967-1968, y la gestiona Ferrocarrils de la Generalitat.',
      'Las pistas, orientadas al noreste y rodeadas de bosque, van de los 1.500 a los 2.500 m. Comparte forfait de temporada con el resto de estaciones de Ferrocarrils de la Generalitat.',
    ],
  },
  'port-aine': {
    name: 'Port Ainé',
    a: 'en Port Ainé',
    points: PISTES,
    intro: [
      'Port Ainé es la estación de esquí alpino del municipio de Rialp, en el Pallars Sobirà. Desde 2011 forma parte del grupo de Ferrocarrils de la Generalitat, con La Molina, la Vall de Núria, Vallter y Espot, con quienes comparte forfait de temporada.',
      'La previsión de esta página está calculada para la base de las pistas y para la parte alta, a unos 2.440 m.',
    ],
  },
  tavascan: {
    name: 'Tavascan',
    a: 'en Tavascan',
    points: ['Parte alta de las pistas', 'Pleta del Prat'],
    intro: [
      'La estación de Tavascan, o Tavascan Pleta del Prat, está alrededor del refugio de la Pleta del Prat, en el término de Lladorre, en el Pallars Sobirà. Abrió en 1991 y es mixta: tiene una pequeña zona de esquí alpino, con un telesilla de 500 metros de desnivel, y unos 14 km de circuitos de esquí de fondo entre los 1.750 y los 2.100 m.',
    ],
  },
  espot: {
    name: 'Espot',
    a: 'en Espot',
    intro: [
      'Espot, a 1.218 m, es una de las entradas al Parque Nacional de Aigüestortes y Estany de Sant Maurici: en su término están el lago de Sant Maurici y los Encantats. Junto al pueblo está la estación de esquí de Espot.',
    ],
  },
  sort: {
    name: 'Sort',
    a: 'en Sort',
    intro: [
      'Sort, a 696 m, es la capital del Pallars Sobirà, en el valle de la Noguera Pallaresa, y una de las capitales de comarca menos pobladas de Cataluña. A pocos kilómetros, en Rialp, sale la carretera hacia las pistas de Port Ainé.',
    ],
  },
  'esterri-d-aneu': {
    name: "Esterri d'Àneu",
    a: "en Esterri d'Àneu",
    intro: [
      "Esterri d'Àneu, a 957 m, está en el centro de la Vall d'Àneu, en un valle amplio de origen glaciar donde la Noguera Pallaresa se ensancha por primera vez. De aquí sale la C-28 hacia el puerto de la Bonaigua, el Valle de Arán y Baqueira.",
    ],
  },
  llavorsi: {
    name: 'Llavorsí',
    a: 'en Llavorsí',
    intro: [
      'Llavorsí, a 811 m, está en la confluencia de la Noguera Pallaresa y la Noguera de Cardós, en un punto donde el valle es estrecho y rodeado de montañas. Es el paso hacia los valles de Cardós y de Vallferrera.',
    ],
  },
  'port-de-la-bonaigua': {
    name: 'Puerto de la Bonaigua',
    a: 'en el puerto de la Bonaigua',
    points: ['Puerto de la Bonaigua, C-28'],
    intro: [
      "El puerto de la Bonaigua, a unos 2.070 m, es el paso de la C-28 entre la Vall d'Àneu, en el Pallars Sobirà, y el Valle de Arán. Es divisoria de aguas: al oeste, Arán está en la vertiente atlántica de los Pirineos, y al este las aguas van hacia la Noguera Pallaresa y el Mediterráneo.",
      'Es uno de los puertos con carretera más altos de Cataluña, y en invierno la nieve puede cortar el paso. Fíjate en la nieve prevista y en la isoterma de 0 °C, y consulta siempre el estado de la carretera antes de salir.',
    ],
  },
  'boi-taull': {
    name: 'Boí Taüll',
    a: 'en Boí Taüll',
    points: PISTES,
    intro: [
      'La estación de esquí de Boí Taüll está en la cabecera del valle de Mulleres, sobre Taüll, en la Vall de Boí. Abrió la temporada 1988-1989 y tiene la cota esquiable más alta del Pirineo catalán, en el cap de les Raspes Roies (2.747 m). La base está a unos 2.040 m, en el Pla de Vaques.',
      'Como las pistas empiezan tan arriba, a menudo hace más frío y viento que en las estaciones más bajas: arriba, fíjate en la racha y en la sensación térmica.',
    ],
  },
  taull: {
    name: 'Taüll',
    a: 'en Taüll',
    intro: [
      'Taüll, a 1.510 m, es un pueblo de la Vall de Boí, encaramado en el lado este del valle. Las iglesias románicas de Sant Climent y Santa Maria de Taüll forman parte del conjunto románico de la Vall de Boí, Patrimonio Mundial de la UNESCO.',
      'Se llega por la L-501, que en casi 4 km de fuerte subida sale de la carretera del valle, y es el pueblo más cercano a la estación de esquí de Boí Taüll.',
    ],
  },
  'el-pont-de-suert': {
    name: 'El Pont de Suert',
    a: 'en el Pont de Suert',
    intro: [
      'El Pont de Suert, a 838 m, es la capital de la Alta Ribagorça, a orillas de la Noguera Ribagorçana. Es el paso hacia la Vall de Boí y, por la N-230 y el túnel de Vielha, hacia el Valle de Arán.',
    ],
  },
  'baqueira-beret': {
    name: 'Baqueira Beret',
    a: 'en Baqueira Beret',
    points: PISTES,
    intro: [
      'Baqueira Beret es la estación de esquí del Naut Aran, en el Valle de Arán. Se fundó hacia 1964 y tiene cuatro sectores (Baqueira, Beret, Bonaigua y Baciver) que suman más de 150 km de pistas. Desde 2018, con el sector de Baciver, la cota más alta es el cap de Baciver (2.610 m); la base está a 1.500 m.',
      'Como está en la vertiente atlántica del Pirineo y las pistas miran sobre todo al norte, suele nevar más y hacer más frío que en las estaciones de la vertiente mediterránea.',
    ],
  },
  vielha: {
    name: 'Vielha',
    a: 'en Vielha',
    intro: [
      'Vielha es la capital del Valle de Arán, en el valle del Garona, a unos 974 m. Se llega desde el sur por la N-230 y el túnel de Vielha, y desde el Pallars por el puerto de la Bonaigua (C-28), que pasa por Baqueira.',
      'Arán está en la vertiente atlántica del Pirineo: el tiempo puede ser muy distinto del del resto de Cataluña, más húmedo, y con más nieve en invierno.',
    ],
  },
  salardu: {
    name: 'Salardú',
    a: 'en Salardú',
    intro: [
      'Salardú, a 1.268 m, es la capital del municipio del Naut Aran, a la entrada del Valle de Arán por el puerto de la Bonaigua. Está a pocos kilómetros de las pistas de Baqueira Beret.',
    ],
  },
  arties: {
    name: 'Arties',
    a: 'en Arties',
    intro: [
      'Arties, a 1.143 m, es un pueblo del Naut Aran en la confluencia del Garona y el río de Valarties. El nombre vendría del vasco artean, «en medio», por su posición en el llano donde se juntan los dos ríos. Está entre Vielha y las pistas de Baqueira Beret.',
    ],
  },
  grandvalira: {
    name: 'Grandvalira',
    a: 'en Grandvalira',
    points: PISTES,
    intro: [
      'Grandvalira es el dominio esquiable más grande de los Pirineos, con unos 215 km de pistas en las parroquias de Encamp y Canillo. Se creó en 2003 con la unión de Pas de la Casa - Grau Roig y Soldeu - El Tarter, y tiene sectores en el Pas de la Casa, Grau Roig, Soldeu, El Tarter, Canillo y Encamp.',
      'Las pistas van de los 1.710 a los 2.560 m. Grau Roig es el único sector con circuito de esquí de fondo, y desde 1999 el Funicamp sube desde Encamp hasta las pistas.',
    ],
  },
  'pal-arinsal': {
    name: 'Pal Arinsal',
    a: 'en Pal Arinsal',
    points: PISTES,
    intro: [
      'Pal Arinsal es la estación de esquí de la parroquia de la Massana, con dos zonas, Pal y Arinsal, unidas por un teleférico por el coll de la Botella. Las pistas van de los 1.550 a los 2.560 m.',
      'Desde 2004, un telecabina sale del centro de la Massana (1.200 m) y sube hasta las pistas, a 1.900 m, en unos seis minutos.',
    ],
  },
  'ordino-arcalis': {
    name: 'Ordino Arcalís',
    a: 'en Ordino Arcalís',
    points: PISTES,
    intro: [
      'Ordino Arcalís es la estación de esquí del norte de la parroquia de Ordino, junto a los lagos de Tristaina. Las pistas empiezan a unos 1.940 m y miran sobre todo al norte y al noreste, y por eso suele ser la estación de Andorra con la temporada más larga.',
    ],
  },
  'andorra-la-vella': {
    name: 'Andorra la Vella',
    a: 'en Andorra la Vella',
    intro: [
      'Andorra la Vella es la capital del Principado de Andorra, a 1.022 m, en la confluencia del Valira del Norte y el Valira de Oriente. Con Escaldes-Engordany forma una aglomeración urbana de unos 40.000 habitantes, y se la considera la capital de estado más alta de Europa.',
    ],
  },
  'escaldes-engordany': {
    name: 'Escaldes-Engordany',
    a: 'en Escaldes-Engordany',
    intro: [
      'Escaldes-Engordany, a 1.050 m, es la séptima parroquia de Andorra, creada en 1978, y forma un continuo urbano con Andorra la Vella al otro lado del Valira. Es la salida hacia el valle del Valira de Oriente, Encamp y Grandvalira.',
    ],
  },
  encamp: {
    name: 'Encamp',
    a: 'en Encamp',
    intro: [
      'Encamp, a 1.238 m, es la segunda parroquia de Andorra según el orden tradicional, en el valle del Valira de Oriente. Desde 1999, el Funicamp une el pueblo con las pistas de Grandvalira, y dentro de la parroquia están el Pas de la Casa y el puerto de Envalira.',
    ],
  },
  canillo: {
    name: 'Canillo',
    a: 'en Canillo',
    intro: [
      'Canillo, a 1.526 m, es la primera parroquia de Andorra según el orden tradicional y la más extensa del país. Es uno de los accesos a Grandvalira, y el sector de Canillo tiene el parque familiar Mon(t) Magic.',
    ],
  },
  soldeu: {
    name: 'Soldeu',
    a: 'en Soldeu',
    intro: [
      "Soldeu, a 1.826 m, es un pueblo de la parroquia de Canillo, en una ladera frente a la confluencia del Valira con el valle de Incles. Es uno de los accesos principales a las pistas de Grandvalira: en 1964 se instaló aquí el primer remonte.",
    ],
  },
  'pas-de-la-casa': {
    name: 'El Pas de la Casa',
    a: 'en el Pas de la Casa',
    intro: [
      'El Pas de la Casa, a 2.050 m, es un núcleo de la parroquia de Encamp junto a la frontera francesa, al otro lado del puerto de Envalira. Es uno de los sectores de Grandvalira, y desde 2002 se llega desde el resto de Andorra por el túnel de Envalira, que evita el puerto.',
      'A esta altitud, en invierno la nieve y las temperaturas bajo cero son habituales en el mismo pueblo: mira la previsión por horas antes de subir en coche.',
    ],
  },
  'la-massana': {
    name: 'La Massana',
    a: 'en la Massana',
    intro: [
      'La Massana, a 1.230 m, es la parroquia del noroeste de Andorra, que incluye los pueblos de Pal, Arinsal, Erts y Sispony. Desde 2004, un telecabina sale del centro del pueblo y sube hasta las pistas de Pal Arinsal, a 1.900 m.',
    ],
  },
  arinsal: {
    name: 'Arinsal',
    a: 'en Arinsal',
    intro: [
      'Arinsal, a 1.467 m, es un pueblo de la parroquia de la Massana, en el valle del río de Arinsal. En su término está el Comapedrosa, la cima más alta de Andorra, y una de las dos zonas de la estación de esquí de Pal Arinsal.',
    ],
  },
  ordino: {
    name: 'Ordino',
    a: 'en Ordino',
    intro: [
      'Ordino, a 1.298 m, es la parroquia del valle del Valira del Norte, al noroeste del Principado, y la más extensa después de Canillo. Es Reserva de la Biosfera de la UNESCO desde 2020, y al norte de la parroquia está la estación de esquí de Ordino Arcalís.',
    ],
  },
  'sant-julia-de-loria': {
    name: 'Sant Julià de Lòria',
    a: 'en Sant Julià de Lòria',
    intro: [
      "Sant Julià de Lòria, a 908 m, es la parroquia más al sur de Andorra y la primera que se encuentra al entrar desde la Seu d'Urgell por el valle del Valira.",
    ],
  },
  'port-d-envalira': {
    name: 'Puerto de Envalira',
    a: 'en el puerto de Envalira',
    points: ['Puerto de Envalira, CG-2'],
    intro: [
      'El puerto de Envalira, a 2.409 m, es el puerto con carretera más alto de los Pirineos. Está en la parroquia de Encamp, en la CG-2 entre Grau Roig y el Pas de la Casa, y lleva hacia Francia y la Cerdanya.',
      'Desde 2002, el túnel de Envalira, de peaje y de casi 2,9 km, permite evitar la parte más alta, que en invierno la nieve corta a menudo. Los datos de tráfico de esta web son del Servei Català de Trànsit y no llegan a Andorra: antes de salir, consulta el estado de las carreteras del Principado.',
    ],
  },
};
