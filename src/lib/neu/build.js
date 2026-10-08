// Només en temps de build: una sola crida a Open-Meteo per a totes les pàgines de /neu (portada i fitxes).
// Si falla (sense xarxa, Open-Meteo caigut), les pàgines surten sense previsió i el navegador la carrega de /api/neu.
import { NEU } from './estacions.js';
import { previsio } from './fonts.js';

let p = null;
export function previsioBuild() {
  p ??= previsio(NEU, 20000).catch((e) => {
    console.warn('[neu] build sense previsió:', String(e));
    return null;
  });
  return p;
}
