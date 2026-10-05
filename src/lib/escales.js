// Escales de color de les variables, compartides pels mapes (capa de color, etiquetes i llegenda: src/scripts/camp.js)
// i per les imatges de l'estudi (barres del rànquing). Un fitxer petit i sense dependències, perquè l'estudi no
// hagi de carregar el codi dels mapes.
//
// Tons saturats i un canvi clar de to cada 5 °C (de 8 a 22 °C ha de veure's molt diferent).
export const TSTOP = [[-10, 91, 33, 182], [-5, 79, 70, 229], [0, 37, 99, 235], [5, 14, 165, 233], [10, 20, 184, 166], [15, 34, 197, 94], [20, 234, 179, 8], [25, 249, 115, 22], [30, 220, 38, 38], [35, 153, 27, 27], [40, 112, 26, 117]];
// Pluja: la mateixa escala per classes que els mapes de precipitació acumulada del Meteocat (0,1 · 0,5 · 1 · 2 · 5 ·
// 10 · 20 · 35 · 50 · 65 · 80 · 100 · 150 · 200 mm), més classes en lila cada cop més fosc (250, 300, 350, 400 i
// 500 mm) per als acumulats grans d'un episodi. Cada valor pren el color de la seva classe, sense degradat.
// Quines classes es mostren depèn del màxim (rainClasses).
export const RSTOP = [[0.1, 150, 255, 250], [0.5, 50, 200, 250], [1, 0, 130, 255], [2, 65, 75, 255], [5, 0, 0, 255], [10, 0, 125, 130], [20, 80, 175, 50],
  [35, 160, 219, 0], [50, 255, 255, 0], [65, 255, 195, 0], [80, 255, 125, 0], [100, 255, 0, 0], [150, 200, 0, 0], [200, 212, 100, 195],
  [250, 182, 76, 182], [300, 150, 55, 165], [350, 122, 40, 140], [400, 95, 30, 115], [500, 62, 16, 82]];
const RAIN_CLASSES = RSTOP.map((s) => s[0]);

// Classes de pluja d'un mapa segons el valor més alt: amb acumulats grans les classes de baix (0,1, 0,5…) sobren i
// en calen més de dalt. floor: per sota, no es pinta (ni surt a la llegenda); steps: les classes de la llegenda, fins a
// la que queda just per sobre del màxim (com a mínim fins a 20 mm).
export function rainClasses(max) {
  const m = Number.isFinite(max) ? max : 0;
  const floor = m >= 300 ? 2 : m >= 150 ? 1 : m >= 50 ? 0.5 : 0.1;
  const top = Math.max(20, RAIN_CLASSES.find((c) => c > m) ?? RAIN_CLASSES[RAIN_CLASSES.length - 1]);
  return { floor, steps: RAIN_CLASSES.filter((c) => c >= floor && c <= top) };
}
export const WSTOP = [[0, 203, 213, 225], [10, 14, 165, 233], [20, 20, 184, 166], [30, 132, 204, 22], [40, 234, 179, 8], [55, 249, 115, 22], [70, 220, 38, 38], [90, 153, 27, 27]];
export const HSTOP = [[20, 234, 179, 8], [30, 191, 219, 254], [50, 96, 165, 250], [70, 59, 130, 246], [85, 37, 99, 235], [100, 30, 64, 175]];

// stops i si la variable va per classes (step) o en degradat
export const SCALES = {
  t: { stops: TSTOP }, tmax: { stops: TSTOP }, tmin: { stops: TSTOP },
  rain: { stops: RSTOP, step: true },
  gust: { stops: WSTOP }, wind: { stops: WSTOP },
  hr: { stops: HSTOP },
};

export function ramp(stops, v, step = false) {
  if (v <= stops[0][0]) return stops[0];
  if (step) {
    let i = stops.length - 1;
    while (i > 0 && v < stops[i][0]) i--;
    return stops[i];
  }
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (v < b[0]) {
      const f = (v - a[0]) / (b[0] - a[0]);
      return [v, a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2]), a[3] + f * (b[3] - a[3])];
    }
  }
  return stops[stops.length - 1];
}

// Color (#rrggbb) d'un valor amb l'escala de la variable
const hex2 = (x) => Math.round(x).toString(16).padStart(2, '0');
export function fieldColor(key, v) {
  const c = ramp(SCALES[key].stops, v, SCALES[key].step);
  return `#${hex2(c[1])}${hex2(c[2])}${hex2(c[3])}`;
}

// El mateix color, enfosquit fins que es pugui llegir com a text sobre un fons clar (contrast de 4,5 com a mínim)
function lum(r, g, b) {
  const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function readableOn(hex, bg = '#eef3f8') {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  let [r, g, b] = p(hex);
  const lb = lum(...p(bg));
  for (let i = 0; i < 30 && (lb + 0.05) / (lum(r, g, b) + 0.05) < 4.5; i++) [r, g, b] = [r * 0.9, g * 0.9, b * 0.9];
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

// Text llegible sobre un color de fons (cel·les de les taules de color de l'historial): blanc o blau fosc
export function inkOn(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.55 ? '#ffffff' : '#10233b';
}
