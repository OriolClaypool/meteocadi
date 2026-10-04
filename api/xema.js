// Dades de totes les estacions automàtiques del Servei Meteorològic de Catalunya (XEMA) per a avui (des de
// mitjanit): valor actual de cada variable i màxima, mínima, pluja i ratxa del dia. Lògica a _xema.js.
// Memòria cau a la CDN de 15 minuts: el portal rep com a molt 3 crides cada 15 minuts.
// Les darreres 24 hores i els dies anteriors són a /api/xema/<període> (xema/[periode].js).
import { onlyCleanUrl } from './_net.js';
import { xemaData } from './_xema.js';

export default async function handler(req, res) {
  if (onlyCleanUrl(req, res, '/api/xema')) return;
  try {
    const body = await xemaData({ kind: 'today' });
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800');
    res.status(200).json(body);
  } catch (e) {
    console.error('[xema]', String(e));
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.status(200).json({ updated: new Date().toISOString(), error: true, stations: [] });
  }
}
