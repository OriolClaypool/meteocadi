// Dades de totes les estacions automàtiques del Servei Meteorològic de Catalunya (XEMA) per a avui (des de
// mitjanit): valor actual de cada variable i màxima, mínima, pluja i ratxa del dia. Lògica a _xema.js.
// Memòria cau a la CDN de 15 minuts: el portal rep com a molt 3 crides cada 15 minuts.
// Les darreres 24 hores i els dies anteriors són a /api/xema/<període> (xema/[periode].js).
import { onlyCleanUrl } from './_net.js';
import { xemaData, ymdMadrid } from './_xema.js';

// Darrera resposta bona (mentre la instància de la funció segueix activa): si el portal falla, se serveix aquesta
// marcada amb stale, sempre que sigui del mateix dia i de fa menys de 3 hores
let memo = null;

export default async function handler(req, res) {
  if (onlyCleanUrl(req, res, '/api/xema')) return;
  try {
    const body = await xemaData({ kind: 'today' });
    memo = { at: Date.now(), day: ymdMadrid(), body };
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800');
    res.status(200).json(body);
  } catch (e) {
    console.error('[xema]', String(e));
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    if (memo && memo.day === ymdMadrid() && Date.now() - memo.at < 3 * 3600e3) {
      res.status(200).json({ ...memo.body, stale: true });
      return;
    }
    res.status(200).json({ updated: new Date().toISOString(), error: true, stations: [] });
  }
}
