// Graella de sortida de les capes dels mapes (/api/capes): Web Mercator (la projecció de Leaflet) sobre la mateixa
// zona que el vent (api/vent.js): Catalunya, Andorra, el sud de França, l'Aragó i el mar. Cada píxel de la imatge
// té una latitud (segons la fila) i una longitud (segons la columna); BOUNDS són els límits exactes per a
// L.imageOverlay.
export const BOX = { lat0: 39.9, lat1: 43.4, lng0: -1.2, lng1: 4.6 };

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

// z: nivell de zoom de la resolució (8: uns 450 m per píxel a Catalunya; 7: uns 900 m)
export function mercGrid(z) {
  const world = 256 * 2 ** z;
  const lngX = (lng) => ((lng + 180) / 360) * world;
  const latY = (lat) => ((1 - Math.log(Math.tan(Math.PI / 4 + rad(lat) / 2)) / Math.PI) / 2) * world;
  const xLng = (x) => (x / world) * 360 - 180;
  const yLat = (y) => deg(Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / world))));
  const ox = Math.floor(lngX(BOX.lng0)), oy = Math.floor(latY(BOX.lat1));
  const w = Math.ceil(lngX(BOX.lng1)) - ox, h = Math.ceil(latY(BOX.lat0)) - oy;
  const colLng = Float64Array.from({ length: w }, (_, i) => xLng(ox + i + 0.5));
  const rowLat = Float64Array.from({ length: h }, (_, j) => yLat(oy + j + 0.5));
  const bounds = [[yLat(oy + h), xLng(ox)], [yLat(oy), xLng(ox + w)]].map((p) => p.map((v) => Math.round(v * 1e6) / 1e6));
  return { z, w, h, ox, oy, bounds, colLng, rowLat, lngX, latY, xLng, yLat };
}

// Màscara (1 dins, 0 fora) d'un contorn GeoJSON MultiPolygon [[[[lng, lat], …]]] sobre la graella g: emplenat per
// files amb la regla parell-senar
export function maskOf(g, multipolygon) {
  const mask = new Uint8Array(g.w * g.h);
  const rings = multipolygon.map((poly) => poly[0].map(([lng, lat]) => [g.lngX(lng) - g.ox, g.latY(lat) - g.oy]));
  let n = 0;
  for (let j = 0; j < g.h; j++) {
    const y = j + 0.5;
    const xs = [];
    for (const ring of rings)
      for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
        const [xa, ya] = ring[a], [xb, yb] = ring[b];
        if (ya > y !== yb > y) xs.push(xa + ((y - ya) / (yb - ya)) * (xb - xa));
      }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let i = Math.max(0, Math.ceil(xs[k] - 0.5)); i < Math.min(g.w, xs[k + 1] - 0.5); i++) {
        mask[j * g.w + i] = 1;
        n++;
      }
  }
  return { mask, n };
}
