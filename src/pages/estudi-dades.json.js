// Dades de l'arxiu per a l'Estudi (/estudi) i el mapa de Catalunya: un JSON estàtic que es regenera a cada build.
// Com que l'arxiu de cada nit fa un commit i dispara un build, el dia d'ahir hi és cap a les 6 del matí.
// Només els darrers dies (RECENT); els anys anteriors són a /estudi-dades/AAAA.json (src/lib/estudi-dades.js).
import { compactDays, json, RECENT } from '../lib/estudi-dades.js';

export async function GET() {
  const all = compactDays();
  return json({
    built: new Date().toISOString(),
    first: all[0]?.date ?? null,
    years: [...new Set(all.map((d) => Number(d.date.slice(0, 4))))],
    days: all.slice(-RECENT),
  });
}
