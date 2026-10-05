// Dies de l'arxiu en el format compacte del navegador (estudi i mapa de Catalunya): per estació,
// [màxima, mínima, ratxa màxima, pluja]; susp: estacions amb el dia probablement incomplet.
// /estudi-dades.json porta els darrers RECENT dies, el primer dia de l'arxiu i la llista d'anys; els dies d'abans són a
// /estudi-dades/AAAA.json (src/scripts/arxiu-dades.js els demana només quan calen).
import { loadDays, suspicious } from './archive.js';

export const RECENT = 400;
const r1 = (v) => (v == null || isNaN(v) ? null : Math.round(Number(v) * 10) / 10);

export function compactDays() {
  return loadDays()
    .filter((d) => Object.keys(d.stations).length)
    .map((d) => ({
      date: d.date,
      s: Object.fromEntries(Object.entries(d.stations).map(([id, v]) => [id, [r1(v.tempHigh), r1(v.tempLow), r1(v.windgustHigh), r1(v.precipTotal)]])),
      susp: [...suspicious(d)],
    }));
}

export const json = (body) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
