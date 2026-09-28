// Incidències de trànsit del Servei Català de Trànsit (dades obertes, s'actualitzen cada hora),
// filtrades per carretera i tram. Ús: /api/transit?roads=C-16:110-135,BV-4024
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

export default async function handler(req, res) {
  const wanted = parseRoads(req.query?.roads);
  if (!wanted.length) {
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
      const w = wanted.find((x) => x.road === road);
      if (!w) continue;
      const a = parseFloat(tag(block, 'pk_inici'));
      const b = parseFloat(tag(block, 'pk_fi'));
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      if (w.from != null && !isNaN(lo) && (hi < w.from || lo > w.to)) continue;
      items.push({
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
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');
    res.status(200).json({ updated: new Date().toISOString(), source: 'Servei Català de Trànsit', items });
  } catch (e) {
    console.error('[transit]', String(e));
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.status(200).json({ updated: new Date().toISOString(), error: true, items: [] });
  }
}
