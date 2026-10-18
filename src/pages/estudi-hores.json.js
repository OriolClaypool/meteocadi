// Hora a hora del darrer dia arxivat de les nostres estacions, per a les "Darreres 24 h" del mapa de Catalunya
// (src/lib/estudi-dades.js, lastHours). Com que l'arxiu de cada nit dispara un build, ahir hi és cap a les 6 del matí.
import { json, lastHours } from '../lib/estudi-dades.js';

export async function GET() {
  return json({ built: new Date().toISOString(), ...lastHours() });
}
