// Imatge d'una càmera de trànsit del Servei Català de Trànsit (dades obertes).
// El servidor de l'SCT només serveix les imatges per http; aquí es passen per https i es guarden 5 minuts a la CDN.
// Només s'accepten les càmeres de la llista, perquè això no sigui un servidor intermediari obert.

const ALLOWED = new Set(['c1658', 'c1661']); // C-16 km 118,9 (Bagà) i km 122,3 (Guardiola de Berguedà)

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
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).send(buf);
  } catch (e) {
    console.error('[camera]', id, String(e));
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.status(502).end();
  }
}
