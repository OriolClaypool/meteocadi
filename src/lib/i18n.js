// Textos de la interfície en català (principal) i castellà (només pàgines de lloc i de muntanya, a /es/).
// Al navegador, l'idioma es llegeix de <html lang>.

export const pageLang = () => (typeof document !== 'undefined' && document.documentElement.lang === 'es' ? 'es' : 'ca');

const T = {
  ca: {
    today: 'Avui',
    tomorrow: 'Demà',
    now: 'Ara',
    loading: 'Carregant…',
    loadingFc: 'Carregant la previsió…',
    fcNone: 'Previsió no disponible',
    fcError: "No s'ha pogut carregar la previsió. Torna-ho a provar d'aquí a una estona.",
    dry: 'sec',
    meteogram: 'Meteograma de les pròximes 48 hores',
    live: 'EN DIRECTE',
    offline: 'SENSE CONNEXIÓ',
    connecting: 'CONNECTANT…',
    online: (ok, n) => `${ok} de ${n} estacions en línia`,
    lastReading: (h) => `Última lectura fa ${h} h`,
    noDataNow: 'Sense dades ara mateix',
    noData: 'Sense dades',
    maxMin: (a, b) => `màx ${a} · mín ${b}`,
    // taula d'estacions
    thStation: 'ESTACIÓ', thNow: 'ARA', thMax: 'MÀX.', thMin: 'MÍN.', thWind: 'VENT', thGust: 'RATXA', thRain: 'PLUJA', thSpark: 'ÚLTIMES HORES',
    // llegenda del meteograma
    lgTemp: 'Temperatura (°C)', lgRain: 'Pluja (mm en 3 h)', lgWind: 'Vent (km/h)', lgNight: 'Nit', lgSrc: 'Previsió:', lgFor: 'per a',
    // taula de muntanya
    mtTemp: 'Temperatura', mtFeels: 'Sensació tèrmica mínima', mtWind: 'Vent màxim · ratxa', mtPrecip: 'Precipitació', mtSnow: 'Neu', mtFrz: 'Isoterma de 0 °C',
    mtPlace: 'Lloc', mtGust: 'ratxa', mtOfSnow: 'de neu',
    mtEyebrow: 'PREVISIÓ PER ALTITUD · 3 DIES',
    mtTitle: 'Condicions previstes a la muntanya',
    mtNote: 'Temperatura mínima i màxima, sensació tèrmica més baixa del dia, vent i ratxa màxims (km/h) amb la direcció dominant, precipitació i neu acumulades, i altitud de la isoterma de 0 °C entre les 6 i les 21 h. Font: Open-Meteo.',
    dirs: { N: 'nord', NE: 'nord-est', E: 'est', SE: 'sud-est', S: 'sud', SO: 'sud-oest', O: 'oest', NO: 'nord-oest' },
  },
  es: {
    today: 'Hoy',
    tomorrow: 'Mañana',
    now: 'Ahora',
    loading: 'Cargando…',
    loadingFc: 'Cargando la previsión…',
    fcNone: 'Previsión no disponible',
    fcError: 'No se ha podido cargar la previsión. Vuelve a probarlo dentro de un rato.',
    dry: 'seco',
    meteogram: 'Meteograma de las próximas 48 horas',
    live: 'EN DIRECTO',
    offline: 'SIN CONEXIÓN',
    connecting: 'CONECTANDO…',
    online: (ok, n) => `${ok} de ${n} estaciones en línea`,
    lastReading: (h) => `Última lectura hace ${h} h`,
    noDataNow: 'Sin datos ahora mismo',
    noData: 'Sin datos',
    maxMin: (a, b) => `máx ${a} · mín ${b}`,
    thStation: 'ESTACIÓN', thNow: 'AHORA', thMax: 'MÁX.', thMin: 'MÍN.', thWind: 'VIENTO', thGust: 'RACHA', thRain: 'LLUVIA', thSpark: 'ÚLTIMAS HORAS',
    lgTemp: 'Temperatura (°C)', lgRain: 'Lluvia (mm en 3 h)', lgWind: 'Viento (km/h)', lgNight: 'Noche', lgSrc: 'Previsión:', lgFor: 'para',
    mtTemp: 'Temperatura', mtFeels: 'Sensación térmica mínima', mtWind: 'Viento máximo · racha', mtPrecip: 'Precipitación', mtSnow: 'Nieve', mtFrz: 'Isoterma de 0 °C',
    mtPlace: 'Lugar', mtGust: 'racha', mtOfSnow: 'de nieve',
    mtEyebrow: 'PREVISIÓN POR ALTITUD · 3 DÍAS',
    mtTitle: 'Condiciones previstas en la montaña',
    mtNote: 'Temperatura mínima y máxima, sensación térmica más baja del día, viento y racha máximos (km/h) con la dirección dominante, precipitación y nieve acumuladas, y altitud de la isoterma de 0 °C entre las 6 y las 21 h. Fuente: Open-Meteo.',
    dirs: { N: 'norte', NE: 'nordeste', E: 'este', SE: 'sureste', S: 'sur', SO: 'suroeste', O: 'oeste', NO: 'noroeste' },
  },
};

export const t = (lang = 'ca') => T[lang === 'es' ? 'es' : 'ca'];
