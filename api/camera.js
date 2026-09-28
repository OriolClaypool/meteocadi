// Imatge d'una càmera de trànsit del Servei Català de Trànsit (dades obertes).
// El servidor de l'SCT només serveix les imatges per http; aquí es passen per https i es guarden 5 minuts a la CDN.
// Només s'accepten les càmeres de la llista, perquè això no sigui un servidor intermediari obert.

import { createHash } from 'node:crypto';

// C-16: km 97,5 (Berga), 118,9 (Bagà) i 122,3 (Guardiola de Berguedà, a tocar de la boca sud del túnel)
const ALLOWED = new Set(['c1649', 'c1658', 'c1661']);
// Imatge "no disponible" que dona l'SCT quan una càmera no funciona: la tractem com un error perquè la pàgina l'amagui
const PLACEHOLDERS = new Set(['76bd674597bdbe5c437c5a5fad51e7272110e2bbde4ef7a715711a22c0f9382f']);

export default async function handler(req, res) {
  const id = String(req.query?.id || '');
  if (!ALLOWED.has(id)) {
    res.status(404).end();
    return;
  }
  try {
    const r = await fetch(`http://mct.gencat.cat/mct2bo/RenderService?sctidcam=${id}.gif`, {
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
      headers: { 'User-Agent': 'meteocadi.cat' },
    });
    const type = r.headers.get('content-type') || '';
    if (!r.ok || !type.startsWith('image/')) throw new Error(`HTTP ${r.status} ${type}`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (PLACEHOLDERS.has(createHash('sha256').update(buf).digest('hex'))) {
      res.setHeader('Cache-Control', 'public, s-maxage=300');
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).send(buf);
  } catch (e) {
    console.error('[camera]', id, String(e));
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.status(502).end();
  }
}
