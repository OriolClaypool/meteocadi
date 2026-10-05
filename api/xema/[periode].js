// /api/xema/24h: les darreres 24 hores (finestra mòbil que acaba a la lectura més nova de la XEMA).
// /api/xema/AAAA-MM-DD: un dia anterior sencer, de mitjanit a mitjanit (hora de Catalunya).
// /api/xema/AAAA-MM-DD..AAAA-MM-DD: diversos dies (fins a 31; el darrer pot ser avui, fins ara): pluja total,
// màxima i mínima del període i ratxa màxima.
// Mateixa resposta que /api/xema; per als dies anteriors només hi ha màxima, mínima, pluja i ratxa.
// Com a /api/xema, qualsevol paràmetre afegit es redirigeix a l'adreça neta (perquè no se salti la CDN).
import { xemaData, xemaRange, ymdMadrid } from '../_xema.js';

const FIRST = '2010-01-01';
const MAX_DAYS = 31;
const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && !isNaN(Date.parse(`${d}T12:00:00Z`)) && d >= FIRST;
const span = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5) + 1;

export default async function handler(req, res) {
  const url = new URL(req.url || '/', 'https://www.meteocadi.cat');
  const periode = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
  const clean = `/api/xema/${periode}`;
  // Vercel pot afegir el segment com a paràmetre ("periode"); qualsevol altre es redirigeix
  if ([...url.searchParams.keys()].some((k) => k !== 'periode')) {
    res.statusCode = 308;
    res.setHeader('Location', clean);
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    res.end();
    return;
  }
  const now = new Date();
  const today = ymdMadrid(now);
  let period;
  const [from, to] = periode.split('..');
  if (periode === '24h') period = { kind: '24h' };
  else if (isDay(periode) && periode < today) period = { kind: 'day', date: periode };
  else if (isDay(from) && isDay(to) && from <= to && to <= today && span(from, to) <= MAX_DAYS) period = { kind: 'range', from, to };
  else {
    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    res.status(404).json({ error: 'periode', message: `Període: 24h, una data anterior a avui (AAAA-MM-DD) o dues dates (AAAA-MM-DD..AAAA-MM-DD, fins a ${MAX_DAYS} dies i com a molt fins avui).` });
    return;
  }
  try {
    const body = period.kind === 'range' ? await xemaRange(period.from, period.to, now) : await xemaData(period, now);
    // Un dia (o uns quants) acabat fa més de 6 hores ja no canvia (les dades arriben amb una hora de retard): 30 dies a la CDN
    const closed = period.kind !== '24h' && now.getTime() - Date.parse(body.period.end) > 6 * 3600e3;
    res.setHeader('Cache-Control', closed ? 'public, s-maxage=2592000, stale-while-revalidate=86400' : 'public, s-maxage=900, stale-while-revalidate=1800');
    res.status(200).json(body);
  } catch (e) {
    console.error('[xema]', periode, String(e));
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.status(200).json({ updated: now.toISOString(), error: true, stations: [] });
  }
}
