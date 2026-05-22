export default async function handler(req, res) {
  const { stationId } = req.query;

  if (!stationId) {
    return res.status(400).json({ error: 'stationId required' });
  }

  const apiKey = process.env.WU_API_KEY || 'b146442062ee4f8a86442062ee4f8acd';
  const url = `https://api.weather.com/v2/pws/dailysummary/observations/current?stationId=${stationId}&format=json&units=m&apiKey=${apiKey}&numericPrecision=decimal`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'WU API error', status: response.status });
    }
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'fetch failed', detail: String(err) });
  }
}
