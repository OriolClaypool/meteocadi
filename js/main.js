/* ============================================================
   METEOCADÍ — main.js
   ============================================================ */

/* ── Hamburger nav ── */
(function () {
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
    const open = links.classList.contains('open');
    toggle.setAttribute('aria-expanded', open);
  });
  // close on link click (mobile)
  links.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => links.classList.remove('open'))
  );
})();

/* ── Active nav link ── */
(function () {
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
})();

/* ── Contact form (basic client-side validation) ── */
(function () {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const feedback = document.getElementById('form-feedback');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const nom   = form.nom.value.trim();
    const email = form.email.value.trim();
    const msg   = form.missatge.value.trim();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!nom || !email || !msg) {
      showFeedback('Omple tots els camps abans d\'enviar.', 'error');
      return;
    }
    if (!emailRe.test(email)) {
      showFeedback('Introdueix un correu electrònic vàlid.', 'error');
      return;
    }
    /* TODO: substituir per crida real a backend / Formspree / similar */
    showFeedback('Missatge enviat correctament. Gràcies!', 'ok');
    form.reset();
  });

  function showFeedback(text, type) {
    if (!feedback) return;
    feedback.textContent = text;
    feedback.className   = 'form-feedback ' + type;
    feedback.style.display = 'block';
    setTimeout(() => { feedback.style.display = 'none'; }, 5000);
  }
})();

/* ── Timestamp "última actualització" ── */
(function () {
  const els = document.querySelectorAll('[data-last-update]');
  if (!els.length) return;
  const now = new Date();
  const fmt = now.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
  els.forEach(el => { el.textContent = fmt; });
})();

/* ── Wunderground dades en temps real ── */
(function () {
  const API_KEY    = 'b146442062ee4f8a86442062ee4f8acd';
  const REFRESH_MS = 15 * 60 * 1000;
  window._meteocadiApiKey = API_KEY;

  const STATIONS_META = {
    IBAG65:    { name: 'Bagà Nord',                  alt: 865,  loc: 'Bagà, Berguedà' },
    IBAG67:    { name: 'Refugi de Rebost',           alt: 1650, loc: 'Bagà, Berguedà' },
    IBAG72:    { name: 'Bagà Sud',                   alt: 770,  loc: 'Bagà, Berguedà' },
    IBAG73:    { name: 'Bagà Centre',                alt: 798,  loc: 'Bagà, Berguedà' },
    IGISCL6:   { name: 'Tancalaporta',               alt: 2440, loc: 'PN Cadí-Moixeró' },
    IGSOL7:    { name: 'Pedraforca',                 alt: 2270, loc: 'Gósol, Berguedà' },
    IGUARD34:  { name: 'Coll de Pal - Puigllançada', alt: 2090, loc: 'Guardiola de Berguedà' },
    ISANTJ138: { name: 'Cerdanyola-Forcat',          alt: 1115, loc: 'Sant Julià de Cerdanyola' },
    IGSOL4:    { name: 'Gósol',                       alt: 1450, loc: 'Gósol, Berguedà' },
    ILANOU4:   { name: 'La Nou de Berguedà',          alt: 940,  loc: 'La Nou de Berguedà' },
    ISANTJ53:  { name: 'Cerdanyola-Poble',            alt: 964,  loc: 'Sant Julià de Cerdanyola' },
    IBARCELO40: { name: 'La Pobla de Lillet',          alt: 843,  loc: 'La Pobla de Lillet, Berguedà' },
  };

  const WIND_DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];

  function windDirLabel(deg) {
    if (deg == null) return '';
    return ' ' + WIND_DIRS[Math.round(deg / 22.5) % 16];
  }

  function tempColor(t) {
    if (t == null || isNaN(t)) return '#e8edf5';
    t = Math.round(t);
    if (t <= -10) return '#a78bfa';
    if (t <   -5) return '#818cf8';
    if (t <    0) return '#60a5fa';
    if (t <    5) return '#38bdf8';
    if (t <   10) return '#2dd4bf';
    if (t <   15) return '#4ade80';
    if (t <   20) return '#a3e635';
    if (t <   25) return '#fbbf24';
    if (t <   30) return '#fb923c';
    if (t <   35) return '#ef4444';
    return '#dc2626';
  }

  function windColor(w) {
    if (w == null || isNaN(w)) return '#e8edf5';
    if (w < 10)  return '#64748b';
    if (w < 20)  return '#38bdf8';
    if (w < 30)  return '#2dd4bf';
    if (w < 40)  return '#a3e635';
    if (w < 55)  return '#fbbf24';
    if (w < 70)  return '#fb923c';
    if (w < 90)  return '#ef4444';
    return '#dc2626';
  }

  function precipColor(p) {
    if (p == null || isNaN(p)) return '#7dd3fc';
    if (p <= 0)  return '#475569';
    if (p < 1)   return '#7dd3fc';
    if (p < 5)   return '#38bdf8';
    if (p < 10)  return '#2dd4bf';
    if (p < 15)  return '#4ade80';
    if (p < 30)  return '#fbbf24';
    if (p < 50)  return '#fb923c';
    if (p < 80)  return '#ef4444';
    return '#f472b6';
  }

  function fmtTemp(t) {
    if (t == null || isNaN(t)) return '—';
    var n = Math.abs(Number(t)).toFixed(1);
    if (Number(t) > 0) return '+' + n + '°C';
    if (Number(t) < 0) return '−' + n + '°C';
    return n + '°C';
  }

  function fmtWind(speed, dir) {
    if (speed == null) return '—';
    return Math.round(speed) + ' km/h' + windDirLabel(dir);
  }

  function fmtGust(g) {
    if (g == null) return '—';
    return Math.round(g) + ' km/h';
  }

  function fmtHum(h)  { return h    != null ? h + '%'                    : '—'; }
  function fmtPres(p) { return p    != null ? Math.round(p) + ' hPa'    : '—'; }
  function fmtPrec(v) { return v    != null ? v.toFixed(1) + ' mm'      : '—'; }
  function fmtObsTime(t) {
    if (!t) return '—';
    const m = String(t).match(/(\d{2}:\d{2})/);
    return m ? m[1] : '—';
  }

  async function fetchStation(id) {
    const url = 'https://api.weather.com/v2/pws/observations/current' +
      '?stationId=' + id + '&format=json&units=m&apiKey=' + API_KEY;

    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const obs  = json.observations && json.observations[0];
    if (!obs) throw new Error('no data');
    const m = obs.metric || {};

    const precipTotal = m.precipTotal ?? null;

    return {
      temp:         m.temp            ?? null,
      humidity:     obs.humidity       ?? null,
      wind:         m.windSpeed        ?? null,
      windGust:     m.windGust         ?? null,
      winddir:      obs.winddir        ?? null,
      precipTotal,
      pressure:     m.pressure         ?? null,
      obsTimeLocal: obs.obsTimeLocal   ?? null,
      lat:          obs.lat            ?? null,
      lon:          obs.lon            ?? null,
    };
  }

  window._meteocadiMeta = STATIONS_META;

  // Cache: preserva l'últim fetch correcte de cada estació
  const cache = {};
  window._meteocadiCache = cache;

  async function refreshAll() {
    const ids     = Object.keys(STATIONS_META);
    const results = await Promise.allSettled(
      ids.map(id => fetchStation(id).then(d => ({ id, d })))
    );
    results.forEach(r => {
      if (r.status === 'fulfilled') cache[r.value.id] = r.value.d;
      // si falla, mantenim el valor anterior al cache
    });
    renderCards();
    renderTimestamp();
    renderStatsBar();
    document.dispatchEvent(new CustomEvent('meteocadiRefresh'));
  }

  function setBadge(badge, online) {
    if (!badge) return;
    badge.className   = online ? 'badge badge-ok' : 'badge badge-warn';
    badge.textContent = online ? 'Activa'          : 'Sense senyal';
  }

  function renderCompact(card, data) {
    const badge  = card.querySelector('.badge');
    const tempEl = card.querySelector('.station-temp');
    const spans  = card.querySelectorAll('.metric-box span');
    setBadge(badge, !!data);
    if (tempEl) {
      tempEl.className   = 'station-temp';
      tempEl.style.color = data ? tempColor(data.temp) : '';
      tempEl.textContent = data ? fmtTemp(data.temp) : '—';
    }
    if (spans[0]) { spans[0].style.color = data ? windColor(data.wind) : '';    spans[0].textContent = data ? fmtWind(data.wind, data.winddir) : '—'; }
    if (spans[1]) spans[1].textContent = data ? fmtHum(data.humidity) : '—';
    if (spans[2]) { spans[2].style.color = data ? precipColor(data.precipTotal) : ''; spans[2].textContent = data ? fmtPrec(data.precipTotal) : '—'; }
  }

  function renderFull(card, data) {
    const badge  = card.querySelector('.badge');
    const tempEl = card.querySelector('.station-full-temp');
    const spans  = card.querySelectorAll('.stat-item span');
    setBadge(badge, !!data);
    if (tempEl) {
      tempEl.className   = 'station-full-temp';
      tempEl.style.color = data ? tempColor(data.temp) : '';
      tempEl.textContent = data ? fmtTemp(data.temp) : '—';
    }
    if (spans[0]) { spans[0].style.color = data ? windColor(data.wind) : '';      spans[0].textContent = data ? fmtWind(data.wind, data.winddir)  : '—'; }
    if (spans[1]) { spans[1].style.color = data ? windColor(data.windGust) : '';  spans[1].textContent = data ? fmtGust(data.windGust)            : '—'; }
    if (spans[2]) spans[2].textContent = data ? fmtHum(data.humidity)  : '—';
    if (spans[3]) spans[3].textContent = data ? fmtPres(data.pressure) : '—';
    if (spans[4]) { spans[4].style.color = data ? precipColor(data.precipTotal) : ''; spans[4].textContent = data ? fmtPrec(data.precipTotal)  : '—'; }
    if (spans[5]) spans[5].textContent = data ? fmtObsTime(data.obsTimeLocal) : '—';
  }

  function renderCards() {
    document.querySelectorAll('[data-station-id]').forEach(card => {
      const id   = card.dataset.stationId;
      const data = cache[id] ?? null;
      if (card.classList.contains('station-card'))      renderCompact(card, data);
      else if (card.classList.contains('station-full-card')) renderFull(card, data);
    });
  }

  function renderTimestamp() {
    const fmt = new Date().toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
    document.querySelectorAll('[data-last-update]').forEach(el => el.textContent = fmt);
  }

  function renderStatsBar() {
    // Dades dinàmiques "Qui som"
    const countEl  = document.querySelector('[data-quisom-count]');
    const maxAltEl = document.querySelector('[data-quisom-maxalt]');
    if (countEl)  countEl.textContent  = Object.keys(cache).length;
    if (maxAltEl) {
      const maxAlt = Math.max(...Object.values(STATIONS_META).map(s => s.alt));
      maxAltEl.textContent = maxAlt.toLocaleString('ca-ES');
    }

    const entries = Object.entries(cache)
      .filter(([, d]) => d && d.temp != null)
      .map(([id, d]) => ({ id, temp: d.temp }));
    if (!entries.length) return;

    const minE = entries.reduce((a, b) => b.temp < a.temp ? b : a);
    const maxE = entries.reduce((a, b) => b.temp > a.temp ? b : a);

    const qs = s => document.querySelector(s);
    const minEl    = qs('[data-stats-min-temp]');
    const minName  = qs('[data-stats-min-name]');
    const maxEl    = qs('[data-stats-max-temp]');
    const maxName  = qs('[data-stats-max-name]');
    const activeEl = qs('[data-stats-active]');
    const activeSub = qs('[data-stats-active-sub]');

    if (minEl)   { minEl.className = 'stats-bar-value'; minEl.style.color = tempColor(minE.temp); minEl.textContent = (minE.temp > 0 ? '+' : minE.temp < 0 ? '−' : '') + Math.abs(Number(minE.temp)).toFixed(1) + '°'; }
    if (minName) minName.textContent = STATIONS_META[minE.id]?.name ?? minE.id;
    if (maxEl)   { maxEl.className = 'stats-bar-value'; maxEl.style.color = tempColor(maxE.temp); maxEl.textContent = (maxE.temp > 0 ? '+' : maxE.temp < 0 ? '−' : '') + Math.abs(Number(maxE.temp)).toFixed(1) + '°'; }
    if (maxName) maxName.textContent = STATIONS_META[maxE.id]?.name ?? maxE.id;

    const n = Object.keys(cache).length;
    const t = Object.keys(STATIONS_META).length;
    if (activeEl)  activeEl.textContent  = n;
    if (activeSub) activeSub.textContent = 'de ' + t + ' en línia';

    const precipEl    = qs('[data-stats-max-precip]');
    const precipName  = qs('[data-stats-max-precip-name]');
    if (precipEl && precipName) {
      const precipEntries = Object.entries(cache)
        .filter(([, d]) => d && d.precipTotal != null)
        .map(([id, d]) => ({ id, precip: d.precipTotal }));
      if (precipEntries.length) {
        const maxP = precipEntries.reduce((a, b) => b.precip > a.precip ? b : a);
        precipEl.textContent = maxP.precip.toFixed(1) + ' mm';
        precipEl.style.color = precipColor(maxP.precip);
        precipName.textContent = maxP.precip === 0
          ? 'sense precipitació'
          : (STATIONS_META[maxP.id]?.name ?? maxP.id);
      }
    }
  }

  function sortCardsByAlt() {
    document.querySelectorAll('.station-group').forEach(function (group) {
      var list = group.querySelector('.stations-list, .grid-4');
      if (!list) return;
      var cards = Array.from(list.querySelectorAll('[data-station-id]'));
      cards.sort(function (a, b) {
        var altA = (STATIONS_META[a.dataset.stationId] || {}).alt || 0;
        var altB = (STATIONS_META[b.dataset.stationId] || {}).alt || 0;
        return altB - altA;
      });
      cards.forEach(function (c) { list.appendChild(c); });
    });
  }

  function applyLocHiding() {
    document.querySelectorAll('[data-station-id]').forEach(function (card) {
      var id   = card.dataset.stationId;
      var meta = STATIONS_META[id];
      if (!meta) return;
      var hide = meta.loc.startsWith(meta.name) || meta.name.startsWith(meta.loc);
      var coordsEl = card.querySelector('.station-full-coords');
      if (coordsEl) {
        var altFmt = meta.alt.toLocaleString('ca-ES') + ' m s.n.m.';
        coordsEl.textContent = hide ? altFmt : (altFmt + ' · ' + meta.loc);
      }
    });
  }

  sortCardsByAlt();
  applyLocHiding();
  refreshAll();
  setInterval(refreshAll, REFRESH_MS);

  // Afegeix links "Veure detall" a les targetes de la pàgina estacions.html
  document.querySelectorAll('.station-full-card[data-station-id]').forEach(function (card) {
    const id = card.dataset.stationId;
    const a  = document.createElement('a');
    a.href      = 'estacio.html?id=' + id;
    a.className = 'station-detail-link';
    a.textContent = 'Veure detall →';
    card.appendChild(a);
  });
})();

/* ── Animació entrada (IntersectionObserver) ── */
(function () {
  if (!('IntersectionObserver' in window)) return;
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.station-card, .station-full-card').forEach(function (el, i) {
    el.classList.add('reveal');
    el.style.transitionDelay = (i * 80) + 'ms';
    observer.observe(el);
  });

  document.querySelectorAll('.webcam-card, .webcam-card-full').forEach(function (el) {
    el.classList.add('reveal');
    observer.observe(el);
  });

  document.querySelectorAll('.section-header').forEach(function (el) {
    el.classList.add('reveal');
    observer.observe(el);
  });
})();

/* ── Avís meteorològic Meteocat ── */
(function () {
  const banner   = document.getElementById('aviso-banner');
  const textEl   = document.getElementById('aviso-text');
  const closeBtn = document.getElementById('aviso-close');
  if (!banner) return;

  if (sessionStorage.getItem('mc_aviso_tancat')) return;

  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      banner.style.display = 'none';
      sessionStorage.setItem('mc_aviso_tancat', '1');
    });
  }

  /* Codis de comarca: Berguedà=26, Cerdanya=16, Alt Urgell=2 */
  var TARGET = new Set([2, 16, 26]);

  fetch('https://api.meteocat.gencat.cat/v1/prediccio/avisos')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      var items = Array.isArray(data) ? data :
        (data.avisos || data.features || data.data || []);

      var maxLvl = 0, foundType = '', foundComarca = '';

      items.forEach(function (item) {
        var p   = item.properties || item;
        var lvl = +(p.nivell || p.nivel || 1);

        var codesRaw = p.comarques || p.comarques_afectades || p.idComarques || [];
        if (!Array.isArray(codesRaw)) codesRaw = [codesRaw];

        var relevant = codesRaw.some(function (c) {
          return TARGET.has(+(c.codi || c.idComarca || c.id || c));
        });
        if (!relevant) return;

        if (lvl > maxLvl) {
          maxLvl       = lvl;
          foundType    = p.perill || p.descripcio || p.tipusAviso || 'Avís meteorològic';
          var matchC   = codesRaw.find(function (c) {
            return TARGET.has(+(c.codi || c.idComarca || c.id || c));
          });
          foundComarca = matchC ? (matchC.nom || matchC.nomComarca || '') : '';
        }
      });

      if (maxLvl < 1) return;
      banner.className = 'aviso-banner aviso-lvl-' + Math.min(maxLvl, 3);
      if (textEl) textEl.textContent = foundType + (foundComarca ? ' · ' + foundComarca : '');
      banner.style.display = '';
    })
    .catch(function () { /* silent: API pot requerir autenticació */ });
})();
