// Altitud del terreny en una graella de Catalunya (Copernicus DEM, a través de l'API d'elevació d'Open-Meteo).
// Serveix per corregir la temperatura interpolada del mapa segons el relleu. El relleu no canvia:
// es calcula un cop i queda a la CDN un any.

import { onlyCleanUrl } from './_net.js';
const GRID = { lat0: 40.48, lat1: 42.9, lng0: 0.12, lng1: 3.36, step: 0.04 };

export default async function handler(req, res) {
  if (onlyCleanUrl(req, res, '/api/dem')) return;
  try {
    const rows = Math.round((GRID.lat1 - GRID.lat0) / GRID.step) + 1;
    const cols = Math.round((GRID.lng1 - GRID.lng0) / GRID.step) + 1;
    const pts = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) pts.push([+(GRID.lat0 + r * GRID.step).toFixed(3), +(GRID.lng0 + c * GRID.step).toFixed(3)]);
    const z = new Array(pts.length).fill(0);
    const chunks = [];
    for (let i = 0; i < pts.length; i += 100) chunks.push(i);
    // Com a molt 6 peticions alhora (l'API accepta 100 punts per petició)
    for (let k = 0; k < chunks.length; k += 6) {
      await Promise.all(
        chunks.slice(k, k + 6).map(async (i) => {
          const part = pts.slice(i, i + 100);
          const p = new URLSearchParams({ latitude: part.map((x) => x[0]).join(','), longitude: part.map((x) => x[1]).join(',') });
          const r = await fetch(`https://api.open-meteo.com/v1/elevation?${p}`, { signal: AbortSignal.timeout(8000) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const j = await r.json();
          (j.elevation || []).forEach((e, n) => (z[i + n] = Math.max(0, Math.round(e || 0))));
        }),
      );
    }
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, immutable');
    res.status(200).json({ ...GRID, rows, cols, z, source: 'Copernicus DEM (Open-Meteo)' });
  } catch (e) {
    console.error('[dem]', String(e));
    res.setHeader('Cache-Control', 'public, s-maxage=600');
    res.status(502).json({ error: true });
  }
}
