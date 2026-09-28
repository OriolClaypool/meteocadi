// Incidències de trànsit del Servei Català de Trànsit (dades obertes, s'actualitzen cada hora),
// filtrades per carretera i tram, o per distància a uns punts.
// Ús: /api/transit?roads=C-16:110-135,BV-4024  ·  /api/transit?near=42.335:1.9:12,42.19:1.56:12 (lat:lng:km)
// Memòria cau a la CDN de 10 minuts: el servidor de l'SCT rep com a molt una crida cada 10 minuts per tram.

const FEED = 'https://www.gencat.cat/transit/opendata/incidenciesGML.xml';

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
const decode = (s) => (s || '').replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENT[m]).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).trim();
const tag = (block, name) => {
  const m = block.match(new RegExp(`<cite:${name}>([\\s\\S]*?)</cite:${name}>`));
  return m ? decode(m[1]) : '';
};

// "C-16:110-135" → { road: 'C-16', from: 110, to: 135 };  "BV-4024" → { road: 'BV-4024' }
function parseRoads(q) {
  return String(q || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[A-Z]{1,3}-?\d{1,5}[A-Z]?(:\d+(\.\d+)?-\d+(\.\d+)?)?$/i.test(s))
    .slice(0, 6)
    .map((s) => {
      const [road, range] = s.split(':');
      if (!range) return { road: road.toUpperCase() };
      const [from, to] = range.split('-').map(Number);
      return { road: road.toUpperCase(), from: Math.min(from, to), to: Math.max(from, to) };
    });
}

// "42.335:1.9:12" → { lat, lng, km } (radi màxim 30 km, com a molt 4 zones)
function parseNear(q) {
  return String(q || '')
    .split(',')
    .map((s) => s.trim().split(':').map(Number))
    .filter((a) => a.length === 3 && a.every((x) => !isNaN(x)) && Math.abs(a[0]) <= 90 && Math.abs(a[1]) <= 180 && a[2] > 0 && a[2] <= 30)
    .slice(0, 4)
    .map(([lat, lng, km]) => ({ lat, lng, km }));
}

function distanceKm(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export default async function handler(req, res) {
  const wanted = parseRoads(req.query?.roads);
  const near = parseNear(req.query?.near);
  if (!wanted.length && !near.length) {
    res.status(400).json({ error: 'roads' });
    return;
  }
  try {
    const r = await fetch(FEED, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'meteocadi.cat' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const xml = await r.text();
    const items = [];
    for (const block of xml.match(/<cite:mct2_v_afectacions_data[\s\S]*?<\/cite:mct2_v_afectacions_data>/g) || []) {
      const road = tag(block, 'carretera').toUpperCase();
      const a = parseFloat(tag(block, 'pk_inici'));
      const b = parseFloat(tag(block, 'pk_fi'));
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const c = block.match(/<gml:coordinates[^>]*>\s*([-\d.]+),([-\d.]+)/);
      const pos = c ? { lng: Number(c[1]), lat: Number(c[2]) } : null;
      const w = wanted.find((x) => x.road === road);
      const byRoad = w && !(w.from != null && !isNaN(lo) && (hi < w.from || lo > w.to));
      const byNear = pos && near.some((z) => distanceKm(z, pos) <= z.km);
      if (!byRoad && !byNear) continue;
      items.push({
        lat: pos?.lat ?? null,
        lng: pos?.lng ?? null,
        road,
        pkFrom: isNaN(lo) ? null : lo,
        pkTo: isNaN(hi) ? null : hi,
        type: tag(block, 'descripcio_tipus'),
        cause: tag(block, 'causa'),
        text: tag(block, 'descripcio'),
        towards: tag(block, 'cap_a'),
        direction: tag(block, 'sentit'),
        level: Number(tag(block, 'nivell')) || null,
        date: tag(block, 'data'),
      });
    }
    items.sort((x, y) => x.road.localeCompare(y.road) || (x.pkFrom ?? 0) - (y.pkFrom ?? 0));
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');
    res.status(200).json({ updated: new Date().toISOString(), source: 'Servei Català de Trànsit', items });
  } catch (e) {
    console.error('[transit]', String(e));
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.status(200).json({ updated: new Date().toISOString(), error: true, items: [] });
  }
}
