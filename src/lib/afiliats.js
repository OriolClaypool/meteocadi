// Enllaços d'afiliat d'Amazon (guia "Quina estació meteorològica comprar?", /quina-estacio-meteorologica-comprar).
// L'etiqueta d'associat (per exemple "meteocadi-21") no és secreta, però va en una variable perquè l'Oriol la pugui
// posar sense tocar el codi: PUBLIC_AMAZON_TAG a Vercel (es llegeix en compilar). Sense etiqueta, els enllaços són
// cerques normals d'Amazon, sense comissió.
// Es fa servir la cerca de cada model i no l'ASIN d'un producte concret: els productes d'Amazon canvien sovint
// (variants, venedors, versions noves) i una cerca no es trenca.
export const AMAZON_TAG = (import.meta.env?.PUBLIC_AMAZON_TAG || '').trim();

export function amazon(query) {
  const p = new URLSearchParams({ k: query });
  if (AMAZON_TAG) p.set('tag', AMAZON_TAG);
  return `https://www.amazon.es/s?${p}`;
}
