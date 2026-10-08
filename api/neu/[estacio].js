// Meteocadí Neu: previsió hora a hora d'una estació d'esquí (cim i base), avui i demà: /api/neu/<estació>, amb
// memòria cau a la CDN d'una hora. I el gruix de neu mesurat als sensors de la XEMA: /api/neu/mesurada (lògica a
// api/_neu-mesurada.js), 30 minuts. Tot en una sola funció: el pla Hobby de Vercel en permet 12 per desplegament.
// Qualsevol paràmetre afegit es redirigeix a l'adreça neta (com /api/xema).
import { NEU_BY_SLUG } from '../../src/lib/neu/estacions.js';
import { horaria } from '../../src/lib/neu/fonts.js';
import { neuMesurada } from '../_neu-mesurada.js';

const memo = new Map();

// Neu mesurada: si la XEMA falla, la darrera resposta bona de menys de 3 hores
async function mesurada(res) {
  try {
    const body = await neuMesurada();
    memo.set('mesurada', { at: Date.now(), body });
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
    res.status(200).json(body);
  } catch (e) {
    console.error('[neu/mesurada]', String(e));
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    const m = memo.get('mesurada');
    if (m && Date.now() - m.at < 3 * 3600e3) {
      res.status(200).json({ ...m.body, stale: true });
      return;
    }
    res.status(200).json({ updated: new Date().toISOString(), error: true, stations: [] });
  }
}

export default async function handler(req, res) {
  const url = new URL(req.url || '/', 'https://www.meteocadi.cat');
  const slug = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
  const clean = `/api/neu/${slug}`;
  // Vercel pot afegir el segment com a paràmetre ("estacio"); qualsevol altre es redirigeix
  if ([...url.searchParams.keys()].some((k) => k !== 'estacio')) {
    res.statusCode = 308;
    res.setHeader('Location', clean);
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    res.end();
    return;
  }
  if (slug === 'mesurada') return mesurada(res);
  const resort = NEU_BY_SLUG[slug];
  if (!resort) {
    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    res.status(404).json({ error: 'estacio', message: 'Aquesta estació no és a Meteocadí Neu.' });
    return;
  }
  try {
    const body = await horaria(resort);
    memo.set(slug, { at: Date.now(), body });
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    res.status(200).json(body);
  } catch (e) {
    console.error('[neu]', slug, String(e));
    res.setHeader('Cache-Control', 'public, s-maxage=120');
    const m = memo.get(slug);
    if (m && Date.now() - m.at < 6 * 3600e3) {
      res.status(200).json({ ...m.body, stale: true });
      return;
    }
    res.status(200).json({ updated: new Date().toISOString(), slug, error: true, hours: [] });
  }
}
