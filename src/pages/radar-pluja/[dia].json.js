// La pluja del radar d'un dia desat (/radar-pluja/AAAA-MM-DD.json): el fitxer de dades/radar tal qual, amb el format
// de les hores de /api/capes/pluja-… (graella del mapa de color, Uint16 en dècimes de mm). Vegeu src/lib/radar-dies.js.
import fs from 'node:fs';
import { radarDays, radarFile } from '../../lib/radar-dies.js';

export function getStaticPaths() {
  return radarDays().map((dia) => ({ params: { dia } }));
}

export function GET({ params }) {
  return new Response(fs.readFileSync(radarFile(params.dia), 'utf8'), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
