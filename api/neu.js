// Meteocadí Neu: previsió de totes les estacions d'esquí (cim i base), dia a dia, 7 dies i els 5 anteriors.
// Una sola crida a Open-Meteo per a totes; memòria cau a la CDN d'una hora (Open-Meteo rep unes 24 crides al dia,
// vingui qui vingui). Lògica a src/lib/neu/fonts.js. Si Open-Meteo falla: la darrera resposta bona de menys de 6 hores.
import { onlyCleanUrl } from './_net.js';
import { NEU } from '../src/lib/neu/estacions.js';
import { previsio } from '../src/lib/neu/fonts.js';

let memo = null;

export default async function handler(req, res) {
  if (onlyCleanUrl(req, res, '/api/neu')) return;
  try {
    const body = await previsio(NEU);
    memo = { at: Date.now(), body };
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    res.status(200).json(body);
  } catch (e) {
    console.error('[neu]', String(e));
    res.setHeader('Cache-Control', 'public, s-maxage=120');
    if (memo && Date.now() - memo.at < 6 * 3600e3) {
      res.status(200).json({ ...memo.body, stale: true });
      return;
    }
    res.status(200).json({ updated: new Date().toISOString(), error: true, resorts: {} });
  }
}
