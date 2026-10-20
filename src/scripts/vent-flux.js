// Vent animat (flux de partícules) sobre un mapa de Leaflet, amb el vent a 10 m de /api/vent (AROME-PI o AROME de
// Météo-France, graella de 0,025°). Oriol, 20 d'octubre del 2026, veient tolemeteo.cat: "un mapa que pone temperatura
// y sale como un mapa de vientos, así como muy bonito". És la mateixa idea que earth.nullschool o webgl-wind, feta
// aquí amb un canvas 2D: milers de partícules que avancen amb el vent i deixen un rastre curt que s'esvaeix.
//
// - El vent es passa a una graella de pantalla (un punt cada STEP píxels) a cada moviment del mapa; cada partícula
//   l'hi llegeix interpolant, sense projectar res a cada fotograma.
// - Només dins de Catalunya (el contorn retalla el canvas). Mentre el mapa es mou, el canvas s'amaga.
// - S'atura amb la pestanya amagada o el mapa fora de la pantalla. Amb "reduir el moviment" dibuixa un sol fotograma
//   quiet (rastres curts) i no s'anima.
const STEP = 4;
const DPR = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1);
// Colors per velocitat (fluix, moderat, fort): blanc sobre el mapa de color, blau fosc sobre el mapa clar
const TONES = {
  light: ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.8)', 'rgba(255,255,255,1)'],
  dark: ['rgba(16,35,59,0.35)', 'rgba(16,35,59,0.55)', 'rgba(16,35,59,0.8)'],
};
// Llindars de velocitat dels tres tons (m/s)
const SLOW = 3, FAST = 8;

// Graella de /api/vent → valors en m/s (NaN on no n'hi ha). Fila 0 al nord, columna 0 a l'oest, al centre de cada cel·la.
export function windGrid(d) {
  if (!d || !d.u || !d.v || !d.nx || !d.ny) return null;
  const n = d.nx * d.ny;
  const u = new Float32Array(n), v = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    u[i] = d.u[i] == null ? NaN : d.u[i] / 10;
    v[i] = d.v[i] == null ? NaN : d.v[i] / 10;
  }
  return {
    nx: d.nx, ny: d.ny, lat1: d.lat1, lng0: d.lng0,
    dlat: (d.lat1 - d.lat0) / d.ny, dlng: (d.lng1 - d.lng0) / d.nx,
    u, v,
    // Si l'AROME-PI només dona la ratxa de 15 minuts (mateixa direcció), les partícules anirien massa de pressa
    f: d.kind === 'gust' ? 0.7 : 1,
  };
}

// Vent (m/s, [cap a l'est, cap al nord]) en un punt, interpolat entre els quatre centres de cel·la del voltant
export function windAt(g, lat, lng, out = [0, 0]) {
  const fy = (g.lat1 - lat) / g.dlat - 0.5, fx = (lng - g.lng0) / g.dlng - 0.5;
  const i = Math.floor(fy), j = Math.floor(fx);
  if (i < 0 || j < 0 || i >= g.ny - 1 || j >= g.nx - 1) return null;
  const ty = fy - i, tx = fx - j, a = i * g.nx + j, b = a + g.nx;
  const u = (g.u[a] * (1 - tx) + g.u[a + 1] * tx) * (1 - ty) + (g.u[b] * (1 - tx) + g.u[b + 1] * tx) * ty;
  const v = (g.v[a] * (1 - tx) + g.v[a + 1] * tx) * (1 - ty) + (g.v[b] * (1 - tx) + g.v[b + 1] * tx) * ty;
  if (Number.isNaN(u) || Number.isNaN(v)) return null;
  out[0] = u * g.f;
  out[1] = v * g.f;
  return out;
}

// rings: contorn de Catalunya, [[lat, lng], …] per anell
export function createFlux(map, L, rings) {
  const pane = map.createPane('flux');
  // Per sobre del mapa de color (350) i per sota dels límits comarcals (400), la marca d'aigua i les etiquetes
  pane.style.zIndex = '380';
  pane.style.pointerEvents = 'none';
  // Amagat fins que es demana (show)
  pane.style.display = 'none';
  const cv = L.DomUtil.create('canvas', 'cm-flux', pane);
  const ctx = cv.getContext('2d');
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let grid = null, on = false, tone = 'light', moving = false, seen = true, raf = 0;
  let W = 0, H = 0, k = 0, field = null, clip = null, parts = [];
  const tmp = [0, 0];

  // Píxels per fotograma per cada m/s: una mica més ràpid com més a prop
  const speed = () => 0.2 * Math.pow(1.22, map.getZoom() - 8);

  function at(x, y) {
    const f = field;
    const fx = x / STEP, fy = y / STEP;
    const c = Math.floor(fx), r = Math.floor(fy);
    if (c < 0 || r < 0 || c >= f.cols - 1 || r >= f.rows - 1) return null;
    const i = r * f.cols + c, j = i + f.cols;
    if (!f.ok[i] || !f.ok[i + 1] || !f.ok[j] || !f.ok[j + 1]) return null;
    const tx = fx - c, ty = fy - r;
    tmp[0] = (f.fu[i] * (1 - tx) + f.fu[i + 1] * tx) * (1 - ty) + (f.fu[j] * (1 - tx) + f.fu[j + 1] * tx) * ty;
    tmp[1] = (f.fv[i] * (1 - tx) + f.fv[i + 1] * tx) * (1 - ty) + (f.fv[j] * (1 - tx) + f.fv[j + 1] * tx) * ty;
    return tmp;
  }

  function spawn(p) {
    for (let n = 0; n < 12; n++) {
      p.x = Math.random() * W;
      p.y = Math.random() * H;
      if (at(p.x, p.y)) break;
    }
    p.age = 0;
    p.max = 35 + Math.random() * 65;
    return p;
  }

  function build() {
    const s = map.getSize();
    W = s.x;
    H = s.y;
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;
    L.DomUtil.setPosition(cv, map.containerPointToLayerPoint([0, 0]));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    k = speed();
    const cols = Math.ceil(W / STEP) + 2, rows = Math.ceil(H / STEP) + 2;
    const fu = new Float32Array(cols * rows), fv = new Float32Array(cols * rows), ok = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ll = map.containerPointToLatLng([c * STEP, r * STEP]);
        const w = windAt(grid, ll.lat, ll.lng, tmp);
        if (!w) continue;
        const i = r * cols + c;
        fu[i] = w[0] * k;
        fv[i] = -w[1] * k; // a la pantalla, y creix cap al sud
        ok[i] = 1;
      }
    }
    field = { cols, rows, fu, fv, ok };
    clip = new Path2D();
    for (const ring of rings) {
      ring.forEach(([lat, lng], i) => {
        const p = map.latLngToContainerPoint([lat, lng]);
        if (i) clip.lineTo(p.x, p.y);
        else clip.moveTo(p.x, p.y);
      });
      clip.closePath();
    }
    const n = Math.min(3500, Math.max(400, Math.round((W * H) / 380)));
    parts = Array.from({ length: n }, () => spawn({}));
    // Que no surtin totes alhora: edats repartides
    for (const p of parts) p.age = Math.random() * p.max;
    ctx.clearRect(0, 0, W, H);
  }

  // L'esvaïment multiplica l'opacitat per 0,94, però amb 8 bits una opacitat de 8 o menys es queda igual (8 × 0,94
  // s'arrodoneix a 8): sense res més, quedaria un vel i rastres fantasma per sempre. Cada 48 passos (menys d'un segon)
  // es neteja una quarta part del canvas (les opacitats molt baixes, a zero): llegir-lo de la targeta gràfica té un
  // cost, i així es fa poques vegades.
  const STRIPS = 4;
  let strip = 0, nStep = 0;
  function cleanStrip() {
    const h = Math.ceil(cv.height / STRIPS);
    const y = strip * h;
    strip = (strip + 1) % STRIPS;
    if (y >= cv.height || !cv.width) return;
    const img = ctx.getImageData(0, y, cv.width, Math.min(h, cv.height - y));
    const d = img.data;
    let changed = false;
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] && d[i] < 12) {
        d[i] = 0;
        changed = true;
      }
    }
    if (changed) ctx.putImageData(img, 0, y);
  }

  function step() {
    // Esvaeix el que hi ha (cap al transparent, no cap al gris) i hi dibuixa el tram nou de cada partícula
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = 'rgba(0,0,0,0.94)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    if (++nStep % 48 === 0) cleanStrip();
    const paths = [new Path2D(), new Path2D(), new Path2D()];
    for (const p of parts) {
      if (++p.age > p.max) { spawn(p); continue; }
      const w = at(p.x, p.y);
      if (!w) { spawn(p); continue; }
      const nx = p.x + w[0], ny = p.y + w[1];
      const ms = Math.hypot(w[0], w[1]) / k;
      const b = ms < SLOW ? 0 : ms < FAST ? 1 : 2;
      paths[b].moveTo(p.x, p.y);
      paths[b].lineTo(nx, ny);
      p.x = nx;
      p.y = ny;
    }
    ctx.save();
    ctx.clip(clip);
    for (let b = 0; b < 3; b++) {
      ctx.strokeStyle = TONES[tone][b];
      ctx.stroke(paths[b]);
    }
    ctx.restore();
  }

  const live = () => on && grid && field && !moving && seen && !document.hidden;
  function frame() {
    raf = 0;
    if (!live()) return;
    step();
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (!live() || raf) return;
    if (reduce?.matches) {
      // Sense animació: uns quants passos seguits i es queda quiet
      for (let n = 0; n < 24; n++) step();
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  function refresh() {
    stop();
    if (!on || !grid) { ctx.clearRect(0, 0, W, H); return; }
    build();
    start();
  }

  map.on('movestart zoomstart', () => {
    moving = true;
    stop();
    cv.style.visibility = 'hidden';
  });
  map.on('moveend', () => {
    moving = false;
    cv.style.visibility = '';
    refresh();
  });
  map.on('resize', refresh);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      seen = e.isIntersecting;
      if (seen) start();
      else stop();
    }).observe(map.getContainer());
  }

  return {
    // d: la resposta de /api/vent
    data(d) {
      grid = windGrid(d);
      refresh();
    },
    show(v) {
      if (v === on) return;
      on = v;
      pane.style.display = v ? '' : 'none';
      refresh();
    },
    tone(t) {
      tone = t === 'dark' ? 'dark' : 'light';
    },
    get on() { return on; },
  };
}
