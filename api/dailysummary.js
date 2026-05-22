export default async function handler(req, res) {
  const { stationId } = req.query;
  if (!stationId) return res.status(400).json({ error: 'stationId required' });

  const apiKey = process.env.WU_API_KEY || 'b146442062ee4f8a86442062ee4f8acd';
  const url = `https://api.weather.com/v2/pws/dailysummary/7day?stationId=${stationId}&format=json&units=m&apiKey=${apiKey}&numericPrecision=decimal`;

  try {
    const response = await fetch(url);
    const bodyText = await response.text();
    console.log('[dailysummary]', stationId, 'HTTP', response.status, bodyText.slice(0, 200));

    if (!response.ok) {
      return res.status(200).json({
        error:    'WU API error',
        wuStatus: response.status,
        wuBody:   bodyText,
      });
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json(JSON.parse(bodyText));
  } catch (err) {
    console.error('[dailysummary] fetch failed:', err);
    return res.status(200).json({ error: 'fetch failed', detail: String(err) });
  }
}
