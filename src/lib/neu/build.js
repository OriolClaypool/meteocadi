// Només en temps de build: una sola crida a Open-Meteo per a totes les pàgines de /neu (portada i fitxes).
// Si falla (sense xarxa, Open-Meteo caigut), les pàgines surten sense previsió i el navegador la carrega de /api/neu.
// Per a les proves sense xarxa: NEU_PREVISIO=<fitxer amb una resposta desada de /api/neu> npm run build
import fs from 'node:fs';
import { NEU } from './estacions.js';
import { previsio } from './fonts.js';

let p = null;
export function previsioBuild() {
  if (process.env.NEU_PREVISIO) p ??= Promise.resolve(JSON.parse(fs.readFileSync(process.env.NEU_PREVISIO, 'utf8')));
  p ??= previsio(NEU, 20000).catch((e) => {
    console.warn('[neu] build sense previsió:', String(e));
    return null;
  });
  return p;
}
