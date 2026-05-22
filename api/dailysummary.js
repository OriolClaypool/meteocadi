export default async function handler(req, res) {
  const { stationId } = req.query;
  if (!stationId) return res.status(400).json({ error: 'stationId required' });

  const apiKey = process.env.WU_API_KEY || 'b146442062ee4f8a86442062ee4f8acd';

  const urlCurrent = `https://api.weather.com/v2/pws/dailysummary/observations/current?stationId=${stationId}&format=json&units=m&apiKey=${apiKey}&numericPrecision=decimal`;
  const url7day    = `https://api.weather.com/v2/pws/dailysummary/7day?stationId=${stationId}&format=json&units=m&apiKey=${apiKey}&numericPrecision=decimal`;

  try {
    // Try both endpoints in parallel so the logs show which one the key can access
    const [resCurrent, res7day] = await Promise.all([
      fetch(urlCurrent),
      fetch(url7day),
    ]);

    const [bodyCurrent, body7day] = await Promise.all([
      resCurrent.text(),
      res7day.text(),
    ]);

    console.log('[dailysummary]', stationId, 'current →', resCurrent.status, bodyCurrent.slice(0, 300));
    console.log('[dailysummary]', stationId, '7day    →', res7day.status,    body7day.slice(0, 300));

    // Prefer /current if it succeeded; fall back to /7day
    if (resCurrent.ok) {
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
      return res.status(200).json(JSON.parse(bodyCurrent));
    }

    if (res7day.ok) {
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
      return res.status(200).json(JSON.parse(body7day));
    }

    // Both failed — return 200 so the browser JS can inspect the error body
    return res.status(200).json({
      error:            'WU API error',
      currentStatus:    resCurrent.status,
      currentBody:      bodyCurrent,
      sevendayStatus:   res7day.status,
      sevendayBody:     body7day,
    });
  } catch (err) {
    console.error('[dailysummary] fetch failed:', err);
    return res.status(200).json({ error: 'fetch failed', detail: String(err) });
  }
}
