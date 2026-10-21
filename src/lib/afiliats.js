// Enllaços d'afiliat d'Amazon (guia "Quina estació meteorològica comprar?", /quina-estacio-meteorologica-comprar).
// L'etiqueta d'associat no és secreta (va a la vista a cada enllaç): la de Meteocadí és "meteocadi08-21" (Oriol, 21/10/2026;
// "meteocadi-21" ja estava agafada). La variable PUBLIC_AMAZON_TAG de Vercel, si hi és, la substitueix (es llegeix en
// compilar).
// Es fa servir la cerca de cada model i no l'ASIN d'un producte concret: els productes d'Amazon canvien sovint
// (variants, venedors, versions noves) i una cerca no es trenca.
export const AMAZON_TAG = (import.meta.env?.PUBLIC_AMAZON_TAG || 'meteocadi08-21').trim();

export function amazon(query) {
  const p = new URLSearchParams({ k: query });
  if (AMAZON_TAG) p.set('tag', AMAZON_TAG);
  return `https://www.amazon.es/s?${p}`;
}
