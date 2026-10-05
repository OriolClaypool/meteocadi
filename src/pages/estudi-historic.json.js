// Historial de cada estació per a l'explorador de dades de l'estudi (/estudi/dades): un JSON estàtic que es regenera
// a cada build, amb el control de qualitat ja aplicat (pluja i ratxes descartades a null, temperatures dels dies
// incomplets a null). Per estació, columnes dia a dia des del primer dia que té dades ("from"); els dies sense dades
// hi són com a null, així el dia i és from + i.
import { loadDays, suspicious } from '../lib/archive.js';
import { STATIONS } from '../lib/stations.js';

const r1 = (v) => (v == null || v === '' || isNaN(v) ? null : Math.round(Number(v) * 10) / 10);
const COLS = {
  tmax: (v, s) => (s ? null : r1(v.tempHigh)),
  tmin: (v, s) => (s ? null : r1(v.tempLow)),
  tavg: (v, s) => (s ? null : r1(v.tempAvg)),
  rain: (v) => r1(v.precipTotal),
  gust: (v) => r1(v.windgustHigh),
  wind: (v) => r1(v.windspeedAvg),
  hum: (v) => (v.humidityAvg == null ? null : Math.round(v.humidityAvg)),
  pres: (v) => r1(v.pressureMax != null && v.pressureMin != null ? (Number(v.pressureMax) + Number(v.pressureMin)) / 2 : null),
};
const dayIndex = (iso) => Math.round(Date.parse(`${iso}T12:00:00Z`) / 864e5);

export async function GET() {
  const days = loadDays();
  const stations = {};
  for (const s of STATIONS) {
    const own = days.filter((d) => d.stations[s.id]);
    if (!own.length) continue;
    const from = own[0].date;
    const n = dayIndex(own[own.length - 1].date) - dayIndex(from) + 1;
    const cols = Object.fromEntries(Object.keys(COLS).map((k) => [k, new Array(n).fill(null)]));
    for (const d of own) {
      const i = dayIndex(d.date) - dayIndex(from);
      const susp = suspicious(d).has(s.id);
      for (const [k, f] of Object.entries(COLS)) cols[k][i] = f(d.stations[s.id], susp);
    }
    stations[s.id] = { from, n, cols };
  }
  return new Response(JSON.stringify({ built: new Date().toISOString(), stations }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
