// Límits de les comarques de Catalunya (ICGC, dades obertes de la Generalitat), simplificats per dibuixar-los
// sobre el mapa. Canvien molt poc: memòria cau a la CDN de 30 dies.

const URL =
  'https://analisi.transparenciacatalunya.cat/resource/aasi-gwnd.geojson?' +
  new URLSearchParams({
    $select: 'codicomar,nomcomar,simplify_preserve_topology(georefer_ncia,0.003) as geom',
    $limit: '100',
  });

// Àrea d'un anell en graus² (per descartar illots de pocs metres)
function area(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
}

export default async function handler(req, res) {
  try {
    const r = await fetch(URL, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'meteocadi.cat' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const g = await r.json();
    const features = g.features.map((f) => {
      const polys = [];
      for (const poly of f.geometry?.coordinates ?? []) {
        const rings = [];
        for (const ring of poly) {
          if (ring.length < 4 || area(ring) < 0.00002) continue;
          const out = [];
          for (const [x, y] of ring) {
            const p = [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
            const q = out[out.length - 1];
            if (!q || q[0] !== p[0] || q[1] !== p[1]) out.push(p);
          }
          if (out.length >= 4) rings.push(out);
        }
        if (rings.length) polys.push(rings);
      }
      return { type: 'Feature', properties: { codi: f.properties.codicomar, nom: f.properties.nomcomar }, geometry: { type: 'MultiPolygon', coordinates: polys } };
    });
    res.setHeader('Cache-Control', 'public, s-maxage=2592000, stale-while-revalidate=604800');
    res.status(200).json({ type: 'FeatureCollection', features });
  } catch (e) {
    console.error('[comarques]', String(e));
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    res.status(502).json({ error: true });
  }
}
