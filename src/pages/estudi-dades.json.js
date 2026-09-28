// Dades de l'arxiu per a l'Estudi (/estudi): un JSON estàtic que es regenera a cada build.
// Com que l'arxiu de cada nit fa un commit i dispara un build, el dia d'ahir hi és cap a les 6 del matí.
// Per estació: [màxima, mínima, ratxa màxima, pluja]. "susp": estacions amb el dia probablement incomplet.
import { loadDays, suspicious } from '../lib/archive.js';

const r1 = (v) => (v == null || isNaN(v) ? null : Math.round(Number(v) * 10) / 10);

export async function GET() {
  const days = loadDays()
    .filter((d) => Object.keys(d.stations).length)
    .map((d) => ({
      date: d.date,
      s: Object.fromEntries(
        Object.entries(d.stations).map(([id, v]) => [id, [r1(v.tempHigh), r1(v.tempLow), r1(v.windgustHigh), r1(v.precipTotal)]]),
      ),
      susp: [...suspicious(d)],
    }));
  return new Response(JSON.stringify({ built: new Date().toISOString(), days }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
