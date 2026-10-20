// Els dies amb la pluja del radar desada (dades/radar/AAAA/AAAA-MM-DD.json, cada nit des del 20/10/2026, api/_pluja-dia.js).
// Es publiquen tal qual a /radar-pluja/AAAA-MM-DD.json (src/pages/radar-pluja/[dia].json.js) i el mapa de Catalunya en
// rep la llista en compilar, per saber quins dies pot ajustar la pluja amb el radar.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.env.DADES_DIR || 'dades', 'radar');

export const radarFile = (day) => path.join(ROOT, day.slice(0, 4), `${day}.json`);

let _days = null;
export function radarDays() {
  if (_days) return _days;
  const out = [];
  try {
    for (const y of fs.readdirSync(ROOT)) {
      if (!/^\d{4}$/.test(y)) continue;
      for (const f of fs.readdirSync(path.join(ROOT, y))) {
        const m = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f);
        if (m) out.push(m[1]);
      }
    }
  } catch {
    // Encara no n'hi ha cap
  }
  _days = out.sort();
  return _days;
}
