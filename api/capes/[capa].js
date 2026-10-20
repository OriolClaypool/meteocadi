// Capes per als mapes: imatges georeferenciades fetes al servidor.
//
// /api/capes/radar: les imatges del radar de les dues últimes hores, una cada 10 minuts (JSON, 1 minut a la CDN)
// /api/capes/radar-AAAAMMDDHHMM: una imatge del radar (PNG de paleta en Web Mercator; l'hora és UTC). Les imatges ja no
//   canvien: un any a la CDN, i cada una es fa una sola vegada per a tothom.
// /api/capes/pluja: les hores de pluja del radar (acumulació d'una hora, OPERA ACRR) de les darreres 24 hores (JSON)
// /api/capes/pluja-AAAAMMDDHH00: la pluja d'una hora (la que acaba a aquesta hora UTC) a la graella del mapa de color
//   (JSON amb les dades comprimides; un any a la CDN)
// /api/capes/arome: la passada més nova del model AROME, les variables que té i les hores (JSON, 10 minuts)
// /api/capes/arome-<variable>-AAAAMMDDHH-AAAAMMDDHH: una variable (temp, pluja, neu, vent, ratxa, cota) d'una passada a
//   una hora (UTC), en PNG de paleta en Web Mercator; set dies a la CDN (una passada ja no canvia).
// Les dades i com es fan les imatges: api/_opera.js. Com les altres funcions, qualsevol paràmetre es redirigeix a
// l'adreça neta (perquè no se salti la CDN) i l'hora de la imatge va dins del camí.
import { listFrames, radarFrame, stamp, fromStamp, BOUNDS, LEVELS, COLORS, W, H } from '../_opera.js';
import { aromeIndex, aromeImage, VAR, hstamp, fromHstamp } from '../_arome.js';
import { listProduct } from '../_opera.js';
import { accHour, FW, FH } from '../_pluja.js';

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

// ------------------------------------------------------------------ previsió AROME (api/_arome.js)
let aromeMemo = null;
async function aromeList(res) {
  const now = new Date();
  // La llista es guarda 10 minuts (a la CDN i a la funció): GetCapabilities és gran i les passades arriben cada 3 hores
  if (!aromeMemo || Date.now() - aromeMemo.at > 10 * 60e3) {
    const body = await aromeIndex(now);
    if (!body.error || !aromeMemo) aromeMemo = { at: Date.now(), body };
  }
  const body = aromeMemo.body;
  if (body.error) {
    console.error('[capes/arome]', body.message, JSON.stringify(body.tried || []));
    res.setHeader('Cache-Control', 'public, s-maxage=120');
  } else res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');
  res.status(200).json({ updated: now.toISOString(), ...body });
}

async function aromeImg(res, k, r, t) {
  const run = fromHstamp(r), valid = fromHstamp(t);
  const hrs = (valid - run) / 3600e3;
  if (!VAR[k] || hstamp(run) !== r || hstamp(valid) !== t || hrs < 0 || hrs > 54 || Date.now() - run.getTime() > 3 * 864e5 || run.getTime() > Date.now()) {
    send404(res, 'Imatge: arome-<variable>-AAAAMMDDHH (passada)-AAAAMMDDHH (hora), en UTC.');
    return;
  }
  try {
    const f = await aromeImage(k, run, valid);
    if (!f) {
      send404(res, 'Aquesta imatge de la previsió no hi és.', 300);
      return;
    }
    res.setHeader('Content-Type', 'image/png');
    // Una passada ja no canvia
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=604800, immutable');
    if (f.min != null) res.setHeader('X-Arome-Min', String(f.min));
    if (f.max != null) res.setHeader('X-Arome-Max', String(f.max));
    res.status(200).send(f.png);
  } catch (e) {
    console.error('[capes/arome]', k, r, t, String(e));
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.status(502).json({ error: 'arome', message: String(e) });
  }
}

// ------------------------------------------------------------------ pluja del radar per hores (api/_pluja.js)
async function plujaList(res) {
  const now = new Date();
  try {
    const all = await listProduct('ACRR', new Date(now.getTime() - 26 * 3600e3), now);
    const hours = all.filter((t) => t.endsWith('00'));
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    res.status(200).json({ updated: now.toISOString(), source: SOURCE, w: FW, h: FH, hours: hours.map((t) => ({ t, end: fromStamp(t).toISOString(), url: `/api/capes/pluja-${t}` })) });
  } catch (e) {
    console.error('[capes/pluja]', String(e));
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.status(200).json({ updated: now.toISOString(), error: 'pluja', message: String(e), hours: [] });
  }
}

async function plujaHour(res, t) {
  const d = fromStamp(t);
  const age = Date.now() - d.getTime();
  if (isNaN(d) || stamp(d) !== t || d.getUTCMinutes() !== 0 || age < 0 || age > 25 * 3600e3) {
    send404(res, 'Hora: pluja-AAAAMMDDHH00 (UTC, en punt, de les darreres 24 hores).');
    return;
  }
  try {
    const h = await accHour(t);
    if (!h) {
      send404(res, 'Aquesta hora encara no hi és.', 60);
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable');
    res.status(200).json({ t, end: d.toISOString(), ...h });
  } catch (e) {
    console.error('[capes/pluja]', t, String(e));
    res.setHeader('Cache-Control', 'public, s-maxage=30');
    res.status(502).json({ error: 'pluja', message: String(e) });
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
  if (capa === 'pluja') return plujaList(res);
  const pl = /^pluja-(\d{12})$/.exec(capa);
  if (pl) return plujaHour(res, pl[1]);
  if (capa === 'arome') return aromeList(res);
  const a = /^arome-([a-z]+)-(\d{10})-(\d{10})$/.exec(capa);
  if (a) return aromeImg(res, a[1], a[2], a[3]);
  send404(res, 'Capes: radar, radar-AAAAMMDDHHMM, pluja, pluja-AAAAMMDDHH00, arome i arome-<variable>-AAAAMMDDHH-AAAAMMDDHH.');
}
