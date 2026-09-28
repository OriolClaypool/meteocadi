// Codis WMO (Open-Meteo) → icona Meteocons (public/imatges/icones) i descripció en català (o en castellà, per a /es/).

export function wmoIcon(code, isDay = true) {
  const d = isDay ? 'day' : 'night';
  if (code === 0) return `clear-${d}`;
  if (code === 1) return `mostly-clear-${d}`;
  if (code === 2) return `partly-cloudy-${d}`;
  if (code === 3) return `overcast-${d}`;
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return isDay ? 'partly-cloudy-day-drizzle' : 'drizzle';
  if (code >= 61 && code <= 65) return isDay ? 'overcast-day-rain' : 'overcast-night-rain';
  if (code === 66 || code === 67) return 'sleet';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return isDay ? 'partly-cloudy-day-snow' : 'partly-cloudy-night-snow';
  if (code >= 80 && code <= 82) return isDay ? 'overcast-day-rain' : 'partly-cloudy-night-rain';
  if (code >= 95) return isDay ? 'thunderstorms-day-rain' : 'thunderstorms-night-rain';
  return 'cloudy';
}

const ES = [
  [0, 'Cielo despejado'], [1, 'Casi despejado'], [2, 'Parcialmente nuboso'], [3, 'Cubierto'], [45, 'Niebla'], [48, 'Niebla'],
  [51, 'Llovizna'], [53, 'Llovizna'], [55, 'Llovizna'], [56, 'Llovizna helada'], [57, 'Llovizna helada'],
  [61, 'Lluvia débil'], [63, 'Lluvia'], [65, 'Lluvia fuerte'], [66, 'Lluvia helada'], [67, 'Lluvia helada'],
  [71, 'Nieve débil'], [73, 'Nieve'], [75, 'Nieve fuerte'], [77, 'Nieve granulada'],
  [80, 'Chubascos'], [81, 'Chubascos moderados'], [82, 'Chubascos fuertes'], [85, 'Chubascos de nieve'], [86, 'Chubascos de nieve'],
  [95, 'Tormenta'], [96, 'Tormenta con granizo'], [99, 'Tormenta con granizo'],
];
const ES_MAP = new Map(ES);

export function wmoText(code, lang = 'ca') {
  if (lang === 'es') return ES_MAP.get(code) ?? 'Variable';
  if (code === 0) return 'Cel serè';
  if (code === 1) return 'Gairebé serè';
  if (code === 2) return 'Parcialment ennuvolat';
  if (code === 3) return 'Cobert';
  if (code === 45 || code === 48) return 'Boira';
  if (code >= 51 && code <= 55) return 'Plugim';
  if (code === 56 || code === 57) return 'Plugim gelat';
  if (code === 61) return 'Pluja feble';
  if (code === 63) return 'Pluja';
  if (code === 65) return 'Pluja forta';
  if (code === 66 || code === 67) return 'Pluja gelada';
  if (code === 71) return 'Neu feble';
  if (code === 73) return 'Neu';
  if (code === 75) return 'Neu forta';
  if (code === 77) return 'Neu granulada';
  if (code === 80) return 'Ruixats';
  if (code === 81) return 'Ruixats moderats';
  if (code === 82) return 'Ruixats forts';
  if (code === 85 || code === 86) return 'Ruixats de neu';
  if (code === 95) return 'Tempesta';
  if (code >= 96) return 'Tempesta amb calamarsa';
  return 'Variable';
}

export function iconUrl(name) {
  return `/imatges/icones/${name}.svg`;
}
