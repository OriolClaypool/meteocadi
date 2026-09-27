// Previsió d'Open-Meteo en temps de build (per tenir text indexable a les pàgines).
// Si falla la xarxa, retorna null i la pàgina la carrega igualment al navegador.

const cache = new Map();

export function forecastUrl({ lat, lng, alt }, days = 7) {
  const p = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    elevation: String(alt),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max',
    timezone: 'Europe/Madrid',
    forecast_days: String(days),
  });
  return `https://api.open-meteo.com/v1/forecast?${p}`;
}

export async function dailyForecast(place, days = 7) {
  const url = forecastUrl(place, days);
  if (cache.has(url)) return cache.get(url);
  const job = (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) return null;
      const j = await r.json();
      const d = j.daily;
      if (!d || !d.time) return null;
      return d.time.map((date, i) => ({
        date,
        code: d.weather_code[i],
        max: d.temperature_2m_max[i],
        min: d.temperature_2m_min[i],
        rain: d.precipitation_sum[i],
        prob: d.precipitation_probability_max?.[i] ?? null,
        wind: d.wind_speed_10m_max[i],
        gust: d.wind_gusts_10m_max?.[i] ?? null,
      }));
    } catch {
      return null;
    }
  })();
  cache.set(url, job);
  return job;
}
