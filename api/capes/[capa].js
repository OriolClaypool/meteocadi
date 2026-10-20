// Capes per als mapes: imatges georeferenciades fetes al servidor (de moment, el radar).
//
// /api/capes/radar: les imatges del radar de les dues últimes hores, una cada 10 minuts (JSON, 1 minut a la CDN)
// /api/capes/radar-AAAAMMDDHHMM: una imatge del radar (PNG de paleta en Web Mercator; l'hora és UTC). Les imatges ja no
//   canvien: un any a la CDN, i cada una es fa una sola vegada per a tothom.
// Les dades i com es fan les imatges: api/_opera.js. Com les altres funcions, qualsevol paràmetre es redirigeix a
// l'adreça neta (perquè no se salti la CDN) i l'hora de la imatge va dins del camí.
import { listFrames, radarFrame, stamp, fromStamp, BOUNDS, LEVELS, COLORS, W, H } from '../_opera.js';

// Una imatge cada 10 minuts (les de les hores en punt, i 10, 20…): les composicions intermèdies (…5) solen arribar
// sense una part dels radars d'AEMET, que en fan una cada 10 minuts, i l'animació faria pampallugues
const STEP = 10;
const FRAMES = 13; // 2 hores
const SOURCE = "Radar: composició europea OPERA d'EUMETNET (CC BY 4.0), amb els radars d'AEMET, Météo-France i altres serveis meteorològics";

function send404(res, msg, maxAge = 3600) {
  res.setHeader('Cache-Control', `public, s-maxage=${maxAge}`);
  res.status(404).json({ error: 'capa', message: msg });
}

async function radarIndex(res) {
  const now = new Date();
  const since = new Date(now.getTime() - (FRAMES * STEP + 40) * 60e3);
  try {
    const all = await listFrames(since, now);
    const last = all.filter((t) => +t.slice(10, 12) % STEP === 0).at(-1);
    if (!last) throw new Error('cap imatge a la llista');
    const have = new Set(all);
    const end = fromStamp(last).getTime();
    const frames = Array.from({ length: FRAMES }, (_, k) => stamp(new Date(end - (FRAMES - 1 - k) * STEP * 60e3))).filter((t) => have.has(t));
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=240');
    res.status(200).json({
      updated: now.toISOString(),
      source: SOURCE,
      step: STEP,
      bounds: BOUNDS,
      size: [W, H],
      // Escala (dBZ): el nivell k va de levels[k] fins al següent, amb el color colors[k]
      levels: LEVELS,
      colors: COLORS,
      frames: frames.map((t) => ({ t, time: fromStamp(t).toISOString(), url: `/api/capes/radar-${t}` })),
    });
  } catch (e) {
    console.error('[capes/radar]', String(e));
    res.setHeader('Cache-Control', 'public, s-maxage=30');
    res.status(200).json({ updated: now.toISOString(), error: 'radar', message: String(e), frames: [] });
  }
}

async function radarImage(res, t) {
  const d = fromStamp(t);
  const age = Date.now() - d.getTime();
  // Només hores de veritat, cada 5 minuts, de les darreres 24 hores (les que guarda el dipòsit d'OPERA)
  if (isNaN(d) || stamp(d) !== t || d.getUTCMinutes() % 5 || age < -60e3 || age > 25 * 3600e3) {
    send404(res, 'Imatge: radar-AAAAMMDDHHMM (UTC, cada 5 minuts, de les darreres 24 hores).');
    return;
  }
  try {
    const f = await radarFrame(t);
    if (!f) {
      send404(res, 'Aquesta imatge del radar encara no hi és.', 60);
      return;
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable');
    // Per a la pàgina: quina part de Catalunya veuen els radars, quina part té eco, el màxim (dBZ) i quants radars hi ha
    res.setHeader('X-Radar-Cobertura', f.cover.toFixed(3));
    res.setHeader('X-Radar-Pluja', f.rain.toFixed(3));
    if (f.max != null) res.setHeader('X-Radar-Max', String(f.max));
    if (f.nodes != null) res.setHeader('X-Radar-Radars', String(f.nodes));
    res.status(200).send(f.png);
  } catch (e) {
    console.error('[capes/radar]', t, String(e));
    res.setHeader('Cache-Control', 'public, s-maxage=30');
    res.status(502).json({ error: 'radar', message: String(e) });
  }
}

export default async function handler(req, res) {
  const url = new URL(req.url || '/', 'https://www.meteocadi.cat');
  const capa = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
  // Vercel pot afegir el segment com a paràmetre ("capa"); qualsevol altre es redirigeix
  if ([...url.searchParams.keys()].some((k) => k !== 'capa')) {
    res.statusCode = 308;
    res.setHeader('Location', `/api/capes/${encodeURIComponent(capa)}`);
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    res.end();
    return;
  }
  if (capa === 'radar') return radarIndex(res);
  const m = /^radar-(\d{12})$/.exec(capa);
  if (m) return radarImage(res, m[1]);
  send404(res, 'Capes: radar (llista) i radar-AAAAMMDDHHMM (imatge).');
}
