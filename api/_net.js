// Utilitats compartides de les funcions (el prefix "_" fa que Vercel no el publiqui com a funció).

// Les funcions sense paràmetres es guarden a la CDN per adreça: una crida com /api/xema?x=123 se saltaria
// la memòria cau i faria crides noves a la font (Weather Underground, Meteocat, Open-Meteo), i algú podria
// exhaurir-ne el límit repetint-la. Qualsevol paràmetre es redirigeix a l'adreça neta, que sí que és a la CDN.
export function onlyCleanUrl(req, res, path) {
  if (!String(req.url || '').includes('?')) return false;
  res.statusCode = 308;
  res.setHeader('Location', path);
  res.setHeader('Cache-Control', 'public, s-maxage=86400');
  res.end();
  return true;
}
