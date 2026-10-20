// Mapa base dels mapes amb capes del servidor (/radar i /mapa/previsio): relleu sense carreteres (Esri World
// Hillshade), comarques i contorn de Catalunya per sobre de la capa, i les poblacions de referència segons el zoom.
// La capa (radar, previsió) es pinta en un canvas georeferenciat (CanvasOverlay) a la capa 'layer'.
import L from 'leaflet';
import CONTORN from '../lib/catalunya-contorn.json';

// Poblacions de referència (les petites només en apropar-s'hi): [nom, lat, lng, zoom mínim]
export const PLACES = [
  ['Barcelona', 41.387, 2.17, 7], ['Girona', 41.98, 2.82, 7], ['Lleida', 41.617, 0.62, 7], ['Tarragona', 41.119, 1.245, 7],
  ['Tortosa', 40.812, 0.521, 8], ['Manresa', 41.728, 1.824, 8], ['Vic', 41.93, 2.255, 8], ['Berga', 42.104, 1.845, 8],
  ['la Seu d’Urgell', 42.358, 1.461, 8], ['Puigcerdà', 42.432, 1.928, 8], ['Olot', 42.181, 2.49, 8], ['Figueres', 42.267, 2.961, 8],
  ['Tremp', 42.167, 0.895, 8.5], ['Vielha', 42.702, 0.796, 8.5], ['Solsona', 41.994, 1.517, 8.5], ['Ripoll', 42.2, 2.19, 8.5],
  ['Andorra la Vella', 42.507, 1.522, 8], ['Perpinyà', 42.699, 2.895, 8], ['Sant Llorenç de Morunys', 42.137, 1.592, 10],
  ['Castellar de n’Hug', 42.283, 2.017, 10], ['Alp', 42.373, 1.887, 10],
];

// Canvas com a capa del mapa (com una imatge georeferenciada)
export const CanvasOverlay = L.ImageOverlay.extend({
  _initImage() {
    const el = (this._image = this._url);
    L.DomUtil.addClass(el, 'leaflet-image-layer');
    if (this._zoomAnimated) L.DomUtil.addClass(el, 'leaflet-zoom-animated');
    if (this.options.className) L.DomUtil.addClass(el, this.options.className);
    el.onselectstart = L.Util.falseFn;
    el.onmousemove = L.Util.falseFn;
  },
});

// el: element del mapa; view: límits inicials [[s, w], [n, e]]; places: noms a amagar (ja hi ha estacions, per exemple)
export function baseMap(el, { view, skip = [] } = {}) {
  const map = L.map(el, { zoomSnap: 0.25, minZoom: 6.5, maxZoom: 11, attributionControl: true });
  map.fitBounds(view);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Relleu © <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>',
    maxZoom: 17,
    maxNativeZoom: 15,
  }).addTo(map);
  map.createPane('layer').style.zIndex = '350';
  map.createPane('lines').style.zIndex = '420';
  map.getPane('lines').style.pointerEvents = 'none';
  map.createPane('places').style.zIndex = '440';
  map.getPane('places').style.pointerEvents = 'none';

  // Comarques i contorn de Catalunya, per sobre de la capa
  const rings = CONTORN.coordinates.map((p) => p[0].map(([lng, lat]) => [lat, lng]));
  fetch('/api/comarques')
    .then((r) => (r.ok ? r.json() : null))
    .then((g) => {
      if (g?.features) L.geoJSON(g, { pane: 'lines', interactive: false, style: { color: '#1f2d3d', weight: 0.8, opacity: 0.45, fill: false } }).addTo(map);
    })
    .catch(() => {});
  L.polygon(rings, { pane: 'lines', interactive: false, fill: false, color: '#10233b', weight: 1.6, opacity: 0.75 }).addTo(map);

  // Poblacions
  const marks = PLACES.filter((p) => !skip.includes(p[0])).map(([name, lat, lng, z]) => ({
    z,
    m: L.marker([lat, lng], { pane: 'places', interactive: false, keyboard: false, icon: L.divIcon({ className: 'mb-place', html: `<span>${name}</span>`, iconSize: null }) }),
  }));
  const sync = () => {
    const z = map.getZoom();
    for (const p of marks) {
      if (z >= p.z) p.m.addTo(map);
      else p.m.remove();
    }
  };
  map.on('zoomend', sync);
  sync();
  return map;
}

// Capa de canvas de mida w × h sobre els límits bounds, a la capa 'layer'
export function canvasLayer(map, w, h, bounds, { className = '', attribution = '', opacity = 1 } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const layer = new CanvasOverlay(cv, bounds, { pane: 'layer', className, interactive: false, attribution, opacity }).addTo(map);
  return { cv, ctx: cv.getContext('2d'), layer };
}
