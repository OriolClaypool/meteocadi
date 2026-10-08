// Estudi · lògica de la pàgina /estudi (editor de la previsió, tria de dia i descàrrega de la imatge).
// La part de la previsió manté el funcionament de l'eina anterior: enganxar el text dels tres apartats,
// copiar-lo, esborrany desat al dispositiu i repartiment en diverses imatges si el text és massa llarg.
import { STATIONS, shortName } from '../../lib/stations.js';
import { todayMadrid, hourMadrid, dayMonth, parseDay } from '../../lib/format.js';
import { archiveFor } from '../arxiu-dades.js';
import {
  loadFonts, loadIcons, drawResum, drawRanking, drawRankingWide, WIDE, POST, drawPrevisio, layoutPrevisio, rankSentence, capFirst, WEATHER, PHENOMENA,
} from './draw.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
const K_TAB = 'meteocadi-estudi-tab';
const K_NET = 'meteocadi-estudi-xarxa';
const K_FMT = 'meteocadi-estudi-format';
const K_PV = 'meteocadi-estudi-previsio-v1';

function addDays(iso, n) {
  const d = parseDay(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// "del 25 de setembre" / "de l'1 d'octubre"
function delDia(iso) {
  const n = Number(iso.slice(8));
  return n === 1 || n === 11 ? `de l'${dayMonth(iso)}` : `del ${dayMonth(iso)}`;
}

// "del 28 al 30 de setembre", "del 28 de setembre al 3 d'octubre", "de l'1 a l'11 d'octubre"
function delAl(a, b) {
  if (a === b) return delDia(a);
  const n = Number(b.slice(8));
  const al = n === 1 || n === 11 ? "a l'" : 'al ';
  const ya = a.slice(0, 4) !== b.slice(0, 4) ? ` de ${a.slice(0, 4)}` : '';
  return a.slice(0, 7) === b.slice(0, 7)
    ? `${delDia(a).replace(/ d(e |')\S+$/, '')} ${al}${dayMonth(b)}`
    : `${delDia(a)}${ya} ${al}${dayMonth(b)}`;
}
const spanDays = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 864e5) + 1;
// Diversos dies: com a molt 31 (el mateix límit que /api/xema/AAAA-MM-DD..AAAA-MM-DD)
const MAX_RANGE = 31;

export async function startEstudi() {
  const canvas = $('poster');
  const ctx = canvas.getContext('2d');
  const root = document.querySelector('.st');
  let icons = {};
  let ready = false;
  // La plantilla: la de l'enllaç (/estudi#resum, des del mapa) o la darrera que s'ha fet servir
  const TPLS = ['previsio', 'resum', 'ranquing'];
  const fromHash = location.hash.slice(1);
  let tpl = TPLS.includes(fromHash) ? fromHash : TPLS.includes(store.get(K_TAB)) ? store.get(K_TAB) : 'previsio';
  if (fromHash) history.replaceState(null, '', location.pathname);
  let page = 0;
  let pvLayout = null;
  let toastTimer;
  let undoState = null;

  const toast = (msg, undo = false) => {
    clearTimeout(toastTimer);
    $('toast').hidden = false;
    $('toast').querySelector('span').textContent = msg;
    $('undo').hidden = !undo;
    toastTimer = setTimeout(() => ($('toast').hidden = true), undo ? 9000 : 3500);
  };

  // ------------------------------------------------------------------ previsió: estat
  const emptyDay = () => ({ headline: '', text: '', mode: 'summary', weather: '', morning: '', afternoon: '', alert: 'none', alertType: 'pluja' });
  const demo = (date) => ({
    date,
    sample: true,
    days: [
      { ...emptyDay(), headline: 'Núvols i algun plugim.', text: 'Matí amb núvols i clarianes. A la tarda es tancarà més i pot caure algun plugim feble, sobretot a la zona del Cadí.', mode: 'split', morning: 'solnuvol', afternoon: 'solpluja' },
      { ...emptyDay(), headline: 'Dia de pluja.', text: 'Pluja durant bona part del dia, més intensa a la tarda i a la muntanya, on es poden superar els 10 mm. Vent de sud fort a les carenes.', weather: 'pluja' },
    ],
    summary: 'Dimecres millora, amb més estones de sol. Cap al cap de setmana tornen els ruixats a la muntanya.',
  });
  let checkedOn = todayMadrid();
  let pv = demo(checkedOn);
  const saved = store.get(K_PV);
  if (saved?.state?.days?.length === 2) {
    const s = saved.state;
    pv = {
      // Si l'esborrany és d'un altre dia, la data passa a la d'avui
      date: saved.checkedOn === checkedOn && /^\d{4}-\d{2}-\d{2}$/.test(s.date) ? s.date : checkedOn,
      sample: !!s.sample,
      summary: String(s.summary || ''),
      days: s.days.map((d) => {
        const a = { ...emptyDay(), ...d };
        for (const k of ['weather', 'morning', 'afternoon']) if (!WEATHER[a[k]]) a[k] = '';
        if (!['groc', 'taronja', 'vermell'].includes(a.alert)) a.alert = 'none';
        if (!PHENOMENA[a.alertType]) a.alertType = 'pluja';
        a.mode = a.mode === 'split' ? 'split' : 'summary';
        a.headline = String(a.headline || '');
        a.text = String(a.text || '');
        return a;
      }),
    };
  }
  let curDay = 0;
  let slot = 'morning';
  let saveTimer;
  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      $('saveStatus').textContent = store.set(K_PV, { state: pv, checkedOn }) ? 'Esborrany desat en aquest dispositiu' : '';
    }, 300);
  };

  // La data de la previsió és la d'avui i canvia sola a mitjanit
  let midnightTimer;
  const refreshDate = () => {
    const today = todayMadrid();
    if (today !== checkedOn) {
      checkedOn = today;
      pv.date = today;
      $('pvDate').value = today;
      persist();
      draw();
    }
    clearTimeout(midnightTimer);
    const now = new Date();
    midnightTimer = setTimeout(refreshDate, Math.max(1000, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime() + 1000));
  };
  window.addEventListener('focus', refreshDate);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refreshDate());

  // ------------------------------------------------------------------ dades: arxiu i directe
  let archive = null;
  let live = null;
  let liveAt = 0;
  let choice = 'ahir';
  // Període del rànquing de diversos dies (per defecte, els darrers 7 dies fins avui)
  let range = { from: addDays(todayMadrid(), -6), to: todayMadrid() };
  let rankVar = 'max';
  // Format del rànquing: 'story' (1080 × 1920), 'post' (1080 × 1350, 4:5) o 'wide' (1600 × 900, per a X). Es recorda.
  let rankFmt = ['story', 'post', 'wide'].includes(store.get(K_FMT)) ? store.get(K_FMT) : 'story';
  // Rànquing de la xarxa pròpia ('mc') o de les estacions del Meteocat de tot Catalunya ('cat')
  let rankNet = store.get(K_NET) === 'cat' ? 'cat' : 'mc';
  let sentence = { key: '', text: '', edited: false };
  const NOTES = {
    mc: "Les dades de cada dia es desen cada matí cap a les 6. Les estacions amb el dia incomplet no entren als extrems ni al rànquing de temperatures.",
    cat: "Estacions automàtiques del Servei Meteorològic de Catalunya (XEMA), de les dades obertes de la Generalitat, amb uns 45-75 minuts de retard. Surten les 10 primeres; les que tenen més de 2 hores sense dades no entren al rànquing de temperatures.",
  };
  const catMode = () => tpl === 'ranquing' && rankNet === 'cat';
  // Temperatura d'ara: només amb les dades d'avui (la darrera lectura)
  const isAra = () => rankVar === 'ara' || rankVar === 'arafred';
  // "20:30" → "a les 20:30"; "01:05" → "a la 1:05"
  const aLaHora = (t) => { const h = t.replace(/^0(?=\d)/, ''); return h.startsWith('1:') ? `a la ${h}` : `a les ${h}`; };
  let rankOrder = 'calor';

  // Arxiu de les estacions pròpies: els darrers dies i, si cal un dia més antic, el seu any (src/scripts/arxiu-dades.js)
  async function getArchive(date) {
    const a = await archiveFor(date || addDays(todayMadrid(), -1));
    if (!a) throw new Error('arxiu');
    const first = !archive;
    archive = a;
    if (first) syncNet();
    return a;
  }

  async function getLive() {
    if (live && Date.now() - liveAt < 5 * 60 * 1000) return live;
    const r = await fetch('/api/ara');
    if (!r.ok) throw new Error('directe');
    live = await r.json();
    liveAt = Date.now();
    return live;
  }

  // Estacions del Meteocat (/api/xema): les d'avui i les de les darreres 24 h es tornen a demanar al cap de 5 minuts;
  // els dies tancats ja no canvien
  const xcache = new Map();
  async function getXema(url, liveData) {
    const c = xcache.get(url);
    if (c && (!liveData || Date.now() - c.at < 5 * 60 * 1000)) return c.j;
    const r = await fetch(url);
    if (!r.ok) throw new Error('xema');
    const j = await r.json();
    if (j.error) throw new Error('xema');
    xcache.set(url, { at: Date.now(), j });
    return j;
  }

  // Diversos dies a les estacions del Meteocat: pluja total, màxima més alta, mínima més baixa i ratxa més forta
  async function xemaRangeData() {
    const today = todayMadrid();
    const { from, to } = range;
    const j = await getXema(`/api/xema/${from}..${to}`, to === today);
    const rows = (j.stations || []).map((s) => ({
      id: s.id, name: s.name, alt: s.alt ?? 0, com: s.com, max: s.tmax, min: s.tmin, gust: s.gust, rain: s.rinc ? null : s.rain, susp: !!s.inc,
    }));
    const time = to === today && j.latest ? hourMadrid(new Date(j.latest)) : '';
    let note = `${spanDays(from, to)} dies: pluja total, la màxima més alta, la mínima més baixa i la ratxa més forta del període.${time ? ` Fins a les ${time}.` : ''} Les estacions amb massa lectures que falten no entren a la pluja ni a les temperatures.`;
    if (j.stale) note += " Ara el portal de Meteocat no respon: són les darreres dades bones.";
    if (j.lag > 180) note += ` Atenció: el portal de dades obertes va endarrerit i avui només arriba fins a les ${time}.`;
    return { date: to, from, to, kind: 'range', time, rows, note, net: 'cat' };
  }

  // Diversos dies a la xarxa pròpia: els dies de l'arxiu i, si el període arriba a avui, el d'avui en directe. Una
  // estació amb algun dia sense dades no hi surt; una variable descartada algun dia (dia incomplet, control de qualitat)
  // no es dona per a tot el període (com al mapa de Catalunya).
  async function rangeData() {
    if (catMode()) return xemaRangeData();
    const today = todayMadrid();
    const { from, to } = range;
    const a = await archiveFor(from, to < today ? to : addDays(today, -1));
    if (a && !archive) { archive = a; syncNet(); }
    const byDate = new Map((a?.days || []).map((d) => [d.date, d]));
    const lv = to === today ? await getLive() : null;
    const dates = [];
    for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
    const rows = [];
    for (const s of STATIONS) {
      let tmax = -Infinity, tmin = Infinity, gust = -Infinity, rain = 0, tOk = true, gOk = true, rOk = true, ok = true;
      for (const d of dates) {
        let v;
        if (d === today) {
          const x = lv?.stations?.[s.id];
          if (!x || x.stale) { ok = false; break; }
          v = [x.max ?? null, x.min ?? null, x.gustMax ?? x.gust ?? null, x.rain ?? null, false];
        } else {
          const day = byDate.get(d);
          const x = day?.s?.[s.id];
          if (!x) { ok = false; break; }
          v = [...x, day.susp?.includes(s.id)];
        }
        if (v[0] == null || v[1] == null || v[4]) tOk = false; else { tmax = Math.max(tmax, v[0]); tmin = Math.min(tmin, v[1]); }
        if (v[2] == null) gOk = false; else gust = Math.max(gust, v[2]);
        if (v[3] == null) rOk = false; else rain += v[3];
      }
      if (!ok) continue;
      rows.push({ id: s.id, name: shortName(s), alt: s.alt, max: tOk ? tmax : null, min: tOk ? tmin : null, gust: gOk ? gust : null, rain: rOk ? Math.round(rain * 10) / 10 : null, susp: !tOk });
    }
    const time = to === today && lv?.updated ? hourMadrid(new Date(lv.updated)) : '';
    const note = `${dates.length} dies: pluja total, la màxima més alta, la mínima més baixa i la ratxa més forta del període.${time ? ` Avui, fins a les ${time}.` : ''} Les estacions amb algun dia sense dades no hi surten.`;
    return { date: to, from, to, kind: 'range', time, rows, note };
  }

  async function xemaData() {
    const today = todayMadrid();
    const yest = addDays(today, -1);
    let kind, date, url;
    if (choice === 'avui') [kind, date, url] = ['avui', today, '/api/xema'];
    else if (choice === '24h') [kind, date, url] = ['24h', today, '/api/xema/24h'];
    else {
      date = choice === 'ahir' ? yest : $('otherDate').value || yest;
      if (date > yest) date = yest;
      [kind, url] = [date === yest ? 'ahir' : 'dia', `/api/xema/${date}`];
    }
    const j = await getXema(url, kind === 'avui' || kind === '24h');
    // Temperatura d'ara: la darrera lectura de cada estació (amb el portal endarrerit no n'hi ha)
    const rows = (j.stations || []).map((s) => ({
      id: s.id, name: s.name, alt: s.alt ?? 0, com: s.com, t: kind === 'avui' && !(j.lag > 180) ? s.t ?? null : null, max: s.tmax, min: s.tmin, gust: s.gust, rain: s.rinc ? null : s.rain, susp: !!s.inc,
    }));
    let time = '', note = '';
    if (kind !== 'ahir' && kind !== 'dia' && j.latest) {
      const end = new Date(j.latest);
      time = hourMadrid(end);
      // Les 24 hores acaben avui (o a mitjanit, és a dir, ahir)
      date = todayMadrid(new Date(end.getTime() - 60e3));
      note = kind === '24h'
        ? `Les 24 hores que acaben a les ${time}, la darrera lectura del Meteocat.`
        : `Dades del Meteocat fins a les ${time}. S'actualitzen cada mitja hora.`;
      if (j.stale) note += " Ara el portal de Meteocat no respon: són les darreres dades bones.";
      if (j.lag > 180) note += ` Atenció: el portal de dades obertes va endarrerit (${Math.round(j.lag / 60)} hores sense dades noves).`;
    }
    return { date, kind, time, rows, note, net: 'cat' };
  }

  // Retorna { date, kind, time, rows, note }
  async function dayData() {
    if (choice === 'range' && tpl === 'ranquing') return rangeData();
    if (catMode()) return xemaData();
    const today = todayMadrid();
    const yest = addDays(today, -1);
    if (choice === 'avui') {
      const j = await getLive();
      const rows = [];
      for (const s of STATIONS) {
        const v = j.stations?.[s.id];
        if (!v || v.stale || (v.max == null && v.min == null && v.temp == null)) continue;
        rows.push({ id: s.id, name: shortName(s), alt: s.alt, t: v.temp ?? null, max: v.max, min: v.min, gust: v.gustMax, rain: v.rain, susp: false });
      }
      const time = hourMadrid(new Date(j.updated));
      return { date: today, kind: 'avui', time, rows, note: `Dades en directe de les ${time}. S'actualitzen cada 15 minuts.` };
    }
    let want = choice === 'ahir' ? yest : $('otherDate').value || yest;
    const a = await getArchive(want);
    let day = a.days.find((d) => d.date === want);
    let note = '';
    if (!day) {
      day = a.days[a.days.length - 1];
      note = choice === 'ahir'
        ? `Les dades d'ahir encara no s'han desat (arriben cap a les 6 del matí). Mostro l'últim dia disponible.`
        : "D'aquest dia no hi ha dades. Mostro l'últim dia disponible.";
    }
    if (!day) return { date: want, kind: 'dia', rows: [], note: "Encara no hi ha cap dia a l'arxiu." };
    const rows = [];
    for (const s of STATIONS) {
      const v = day.s[s.id];
      if (!v) continue;
      rows.push({ id: s.id, name: shortName(s), alt: s.alt, max: v[0], min: v[1], gust: v[2], rain: v[3], susp: day.susp.includes(s.id) });
    }
    return { date: day.date, kind: day.date === yest ? 'ahir' : 'dia', rows, note };
  }

  // ------------------------------------------------------------------ dibuix
  let drawSeq = 0;
  let lastData = null;
  // Mida del canvas segons la plantilla i el format
  function size() {
    const f = tpl === 'ranquing' ? rankFmt : 'story';
    const [w, h] = f === 'wide' ? [WIDE.W, WIDE.H] : f === 'post' ? [POST.W, POST.H] : [1080, 1920];
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    canvas.parentElement.classList.toggle('is-wide', f === 'wide');
    canvas.parentElement.classList.toggle('is-post', f === 'post');
    const el = document.querySelector('.st-size');
    if (el) el.textContent = `${w} × ${h} px · PNG`;
  }
  async function draw() {
    if (!ready) return;
    size();
    const seq = ++drawSeq;
    $('status').textContent = '';
    $('pageControls').hidden = true;
    if (tpl === 'previsio') {
      pvLayout = layoutPrevisio(ctx, pv);
      page = Math.min(page, pvLayout.pages.length - 1);
      drawPrevisio(ctx, pv, icons, pvLayout, page);
      const n = pvLayout.pages.length;
      $('pageControls').hidden = n < 2;
      $('pageNumber').textContent = `${page + 1} / ${n}`;
      $('prevPage').disabled = page === 0;
      $('nextPage').disabled = page === n - 1;
      $('status').textContent = pvLayout.error || (n > 1 ? `El text no hi cap en una imatge: surt en ${n}. Descarrega-les una a una.` : pv.sample ? 'Text de mostra: escriu la previsió del dia.' : '');
      $('download').disabled = !!pvLayout.error;
      return;
    }
    let d;
    try {
      d = await dayData();
    } catch {
      if (seq !== drawSeq) return;
      $('status').textContent = catMode()
        ? "No s'han pogut carregar les dades del Meteocat. Torna-ho a provar d'aquí a una estona."
        : choice === 'avui' ? "No s'han pogut carregar les dades en directe." : "No s'ha pogut carregar l'arxiu de dades.";
      $('download').disabled = true;
      return;
    }
    if (seq !== drawSeq) return;
    $('dayNote').textContent = d.note || '';
    if (!d.rows.length) {
      $('status').textContent = 'No hi ha dades per a aquest dia.';
      $('download').disabled = true;
      return;
    }
    $('download').disabled = false;
    if (tpl === 'resum') {
      drawResum(ctx, d);
    } else {
      const net = d.net || 'mc';
      const key = `${d.kind === 'range' ? `${d.from}..${d.to}` : d.date}|${rankVar}|${d.kind}|${net}`;
      if (sentence.key !== key) sentence = { key, text: rankSentence(d.rows, rankVar, net), edited: false };
      if ($('sentence').value !== sentence.text) $('sentence').value = sentence.text;
      const when = isAra() && d.time ? aLaHora(d.time) : d.kind === 'ahir' ? "d'ahir" : d.kind === 'avui' ? "d'avui" : d.kind === '24h' ? 'de les darreres 24 h' : d.kind === 'range' ? delAl(d.from, d.to) : delDia(d.date);
      (rankFmt === 'wide' ? drawRankingWide : drawRanking)(ctx, { date: d.date, from: d.from, to: d.to, days: d.kind === 'range' ? spanDays(d.from, d.to) : 1, when, variable: rankVar, rows: d.rows, sentence: sentence.text, net, kind: d.kind, time: d.time, fmt: rankFmt });
    }
    lastData = d;
  }

  // ------------------------------------------------------------------ plantilles i vista
  function syncTpl() {
    document.querySelectorAll('[data-tpl]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tpl === tpl)));
    document.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = !p.dataset.panel.split(' ').includes(tpl)));
    $('saveStatus').hidden = tpl !== 'previsio';
    page = 0;
    syncNet();
  }

  // Xarxa del rànquing: "24 hores" només hi és amb les estacions del Meteocat (de les nostres només hi ha dies
  // sencers a l'arxiu i el d'avui des de mitjanit). Les dates possibles també canvien.
  function syncNet() {
    const cat = catMode();
    document.querySelectorAll('[data-net]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.net === rankNet)));
    const b24 = document.querySelector('[data-choice="24h"]');
    b24.hidden = !cat;
    // Amb quatre botons, "Avui fins ara" no hi cap en una línia
    document.querySelector('[data-choice="avui"]').textContent = cat || tpl === 'ranquing' ? 'Avui' : 'Avui fins ara';
    if (!cat && choice === '24h') {
      choice = 'avui';
      document.querySelectorAll('[data-choice]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.choice === choice)));
    }
    // Diversos dies: només al rànquing (el resum és d'un sol dia)
    const bRange = document.querySelector('[data-choice="range"]');
    bRange.hidden = tpl !== 'ranquing';
    if (tpl !== 'ranquing' && choice === 'range') {
      choice = 'ahir';
      document.querySelectorAll('[data-choice]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.choice === choice)));
    }
    $('rangeBox').hidden = choice !== 'range';
    $('dataNote').textContent = NOTES[cat ? 'cat' : 'mc'];
    $('dataTitle').textContent = tpl === 'resum' ? 'Resum del dia' : cat ? 'Rànquing de Catalunya' : 'Rànquing';
    const od = $('otherDate');
    if (cat) {
      od.min = '2010-01-01';
      od.max = addDays(todayMadrid(), -1);
    } else if (archive?.days?.length) {
      od.min = archive.first || archive.days[0].date;
      od.max = archive.days[archive.days.length - 1].date;
    } else {
      od.removeAttribute('min');
      od.removeAttribute('max');
    }
  }
  document.querySelectorAll('[data-net]').forEach((b) =>
    b.addEventListener('click', () => {
      rankNet = b.dataset.net;
      store.set(K_NET, rankNet);
      syncNet();
      draw();
    }),
  );
  document.querySelectorAll('[data-tpl]').forEach((b) =>
    b.addEventListener('click', () => {
      tpl = b.dataset.tpl;
      store.set(K_TAB, tpl);
      syncTpl();
      draw();
    }),
  );
  document.querySelectorAll('[data-view]').forEach((b) =>
    b.addEventListener('click', () => {
      root.classList.toggle('is-preview', b.dataset.view === 'preview');
      document.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('on', x === b));
    }),
  );

  // ------------------------------------------------------------------ editor de la previsió
  function syncEditor() {
    const summary = curDay === 2;
    $('dayPanel').hidden = summary;
    $('summaryPanel').hidden = !summary;
    document.querySelectorAll('[data-day]').forEach((b) => b.setAttribute('aria-selected', String(+b.dataset.day === curDay)));
    $('pvDate').value = pv.date;
    $('summary').value = pv.summary;
    if (summary) return;
    const d = pv.days[curDay];
    $('headline').value = d.headline;
    $('forecast').value = d.text;
    $('textCount').textContent = `${d.text.length} car.`;
    $('modeSummary').setAttribute('aria-pressed', String(d.mode === 'summary'));
    $('modeSplit').setAttribute('aria-pressed', String(d.mode === 'split'));
    $('slotChooser').hidden = d.mode !== 'split';
    document.querySelectorAll('[data-slot]').forEach((b) => b.classList.toggle('on', b.dataset.slot === slot));
    $('alertLevel').value = d.alert;
    $('alertType').value = d.alertType;
    $('alertType').hidden = d.alert === 'none';
    syncWeather();
  }
  function syncWeather() {
    const d = pv.days[curDay];
    if (!d) return;
    const sel = d.mode === 'split' ? d[slot] : d.weather;
    document.querySelectorAll('[data-weather]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.weather === sel)));
  }
  const update = (real = false) => {
    if (real) pv.sample = false;
    draw();
    persist();
  };

  document.querySelectorAll('[data-day]').forEach((b) =>
    b.addEventListener('click', () => {
      curDay = +b.dataset.day;
      slot = 'morning';
      syncEditor();
      if (pvLayout) {
        const p = pvLayout.pages.findIndex((items) => items.some((i) => (curDay === 2 ? i.type === 'summary' : i.type === 'day' && i.index === curDay)));
        if (p >= 0 && p !== page) { page = p; draw(); }
      }
    }),
  );
  for (const [id, prop] of [['headline', 'headline'], ['forecast', 'text']]) {
    $(id).addEventListener('input', (e) => {
      pv.days[curDay][prop] = e.target.value;
      $('textCount').textContent = `${pv.days[curDay].text.length} car.`;
      update(true);
    });
  }
  $('summary').addEventListener('input', (e) => { pv.summary = e.target.value; update(true); });
  // En sortir del camp, la majúscula inicial també queda al text de l'editor (la imatge ja la posa sempre)
  for (const id of ['headline', 'forecast', 'summary']) {
    $(id).addEventListener('change', (e) => {
      const v = capFirst(e.target.value);
      if (v === e.target.value) return;
      e.target.value = v;
      if (id === 'summary') pv.summary = v;
      else pv.days[curDay][id === 'forecast' ? 'text' : 'headline'] = v;
      persist();
    });
  }
  $('pvDate').addEventListener('change', (e) => {
    if (e.target.value) { pv.date = e.target.value; update(); } else $('pvDate').value = pv.date;
  });
  $('modeSummary').addEventListener('click', () => { pv.days[curDay].mode = 'summary'; syncEditor(); update(); });
  $('modeSplit').addEventListener('click', () => { pv.days[curDay].mode = 'split'; syncEditor(); update(); });
  document.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => { slot = b.dataset.slot; syncEditor(); }));
  document.querySelectorAll('[data-weather]').forEach((b) =>
    b.addEventListener('click', () => {
      const d = pv.days[curDay];
      const prop = d.mode === 'split' ? slot : 'weather';
      d[prop] = d[prop] === b.dataset.weather ? '' : b.dataset.weather;
      syncWeather();
      update();
    }),
  );
  $('alertLevel').addEventListener('change', (e) => { pv.days[curDay].alert = e.target.value; $('alertType').hidden = e.target.value === 'none'; update(); });
  $('alertType').addEventListener('change', (e) => { pv.days[curDay].alertType = e.target.value; update(); });
  $('prevPage').addEventListener('click', () => { page = Math.max(0, page - 1); draw(); });
  $('nextPage').addEventListener('click', () => { page += 1; draw(); });

  $('newForecast').addEventListener('click', () => {
    undoState = structuredClone(pv);
    pv = { date: todayMadrid(), sample: false, days: [emptyDay(), emptyDay()], summary: '' };
    curDay = 0;
    page = 0;
    syncEditor();
    update();
    toast("Previsió nova. Pots recuperar l'anterior.", true);
  });
  $('undo').addEventListener('click', () => {
    if (!undoState) return;
    pv = undoState;
    undoState = null;
    syncEditor();
    update();
    toast('Previsió anterior recuperada.');
  });

  // Enganxar el text sencer i repartir-lo en Avui / Demà / Pròxims dies
  function parseForecast(text) {
    const parts = { avui: [], dema: [], proxims: [] };
    let active = null;
    const found = new Set();
    for (const line of text.replace(/\r/g, '').split('\n')) {
      const norm = line.replace(/[*_#]/g, '').trim();
      const m = norm.match(/^(?:[^\p{L}\p{N}]*)(Avui|Demà|Pròxims dies)(?=\s|:|$)\s*[:\-–—]?\s*(.*)$/iu);
      if (m) {
        const t = m[1].toLowerCase();
        active = t === 'avui' ? 'avui' : t === 'demà' ? 'dema' : 'proxims';
        found.add(active);
        if (m[2]) parts[active].push(m[2]);
      } else if (active) parts[active].push(line);
    }
    if (!found.has('avui') || !found.has('dema')) return null;
    const txt = (k) => capFirst(parts[k].join('\n').trim());
    return { avui: txt('avui'), dema: txt('dema'), proxims: txt('proxims') };
  }
  $('pasteOpen').addEventListener('click', () => { $('pasteError').textContent = ''; $('pasteDialog').showModal(); });
  $('pasteApply').addEventListener('click', () => {
    const p = parseForecast($('pasteText').value);
    if (!p) {
      $('pasteError').textContent = 'No he trobat els apartats «Avui» i «Demà». Escriu cada títol en una línia pròpia.';
      return;
    }
    undoState = structuredClone(pv);
    if (pv.sample) pv.days = [emptyDay(), emptyDay()];
    pv.days[0].text = p.avui;
    pv.days[1].text = p.dema;
    pv.days.forEach((d) => (d.headline = ''));
    pv.summary = p.proxims;
    pv.sample = false;
    syncEditor();
    update();
    $('pasteDialog').close();
    toast('Text repartit. Revisa els símbols de cada dia.', true);
  });

  // Copiar la previsió en text (per acompanyar la publicació)
  const EMOJI = { sol: '☀️', solnuvol: '🌤️', solpluja: '🌦️', nuvol: '☁️', pluja: '🌧️', tempesta: '⛈️', neu: '🌨️', boira: '🌫️', vent: '💨' };
  let withEmoji = false;
  function copyContent() {
    const pieces = pv.days.map((d, i) => {
      const e = withEmoji ? (d.mode === 'split' ? `${EMOJI[d.morning] || ''} ${EMOJI[d.afternoon] || ''}`.trim() : EMOJI[d.weather] || '') : '';
      return `${i ? 'Demà' : 'Avui'}${e ? ` ${e}` : ''}\n${[d.headline, d.text].filter(Boolean).map(capFirst).join('\n')}`;
    });
    if (pv.summary.trim()) pieces.push(`Pròxims dies${withEmoji ? ' 🗓️' : ''}\n${capFirst(pv.summary)}`);
    $('copyText').value = pieces.join('\n\n');
    $('copyPlain').setAttribute('aria-pressed', String(!withEmoji));
    $('copyEmoji').setAttribute('aria-pressed', String(withEmoji));
  }
  $('copyOpen').addEventListener('click', () => { copyContent(); $('copyDialog').showModal(); });
  $('copyPlain').addEventListener('click', () => { withEmoji = false; copyContent(); });
  $('copyEmoji').addEventListener('click', () => { withEmoji = true; copyContent(); });
  $('copyButton').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('copyText').value);
      toast('Previsió copiada.');
      $('copyDialog').close();
    } catch {
      $('copyText').select();
      toast('Selecciona el text i copia-ho.');
    }
  });

  // ------------------------------------------------------------------ resum i rànquing: controls
  document.querySelectorAll('[data-choice]').forEach((b) =>
    b.addEventListener('click', () => {
      choice = b.dataset.choice;
      document.querySelectorAll('[data-choice]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (choice !== 'avui' && isAra()) { rankVar = 'max'; syncVar(); }
      $('otherDate').hidden = choice !== 'altre';
      if (choice === 'altre' && !$('otherDate').value) $('otherDate').value = addDays(todayMadrid(), -2);
      $('rangeBox').hidden = choice !== 'range';
      if (choice === 'range') syncRange();
      draw();
    }),
  );
  $('otherDate').addEventListener('change', () => draw());

  // Període de diversos dies: dues dates (com a molt 31 dies, fins avui) i dreceres de 3, 7 i 30 dies fins avui
  function syncRange() {
    const today = todayMadrid();
    const first = catMode() ? '2010-01-01' : archive?.first || '2025-06-01';
    if (range.to > today) range.to = today;
    if (range.from > range.to) range.from = range.to;
    if (spanDays(range.from, range.to) > MAX_RANGE) range.from = addDays(range.to, -(MAX_RANGE - 1));
    if (range.from < first) range.from = first;
    for (const id of ['rangeFrom', 'rangeTo']) { $(id).min = first; $(id).max = today; }
    $('rangeFrom').value = range.from;
    $('rangeTo').value = range.to;
  }
  $('rangeFrom').addEventListener('change', () => {
    if (!$('rangeFrom').value) return;
    range.from = $('rangeFrom').value;
    // Si el període passa de 31 dies, s'escurça pel final
    if (spanDays(range.from, range.to) > MAX_RANGE) range.to = addDays(range.from, MAX_RANGE - 1);
    if (range.to < range.from) range.to = range.from;
    syncRange();
    draw();
  });
  $('rangeTo').addEventListener('change', () => {
    if (!$('rangeTo').value) return;
    range.to = $('rangeTo').value;
    syncRange();
    draw();
  });
  document.querySelectorAll('[data-range]').forEach((b) =>
    b.addEventListener('click', () => {
      const today = todayMadrid();
      range = { from: addDays(today, -(Number(b.dataset.range) - 1)), to: today };
      syncRange();
      draw();
    }),
  );
  // Variable del rànquing. "Temp. ara" és la darrera lectura: passa el dia a "Avui" i hi surt l'ordre (de més calor a
  // més fred o al revés); triar un altre dia torna a les màximes
  function setChoice(c) {
    choice = c;
    document.querySelectorAll('[data-choice]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.choice === choice)));
    $('otherDate').hidden = choice !== 'altre';
    $('rangeBox').hidden = choice !== 'range';
  }
  function syncVar() {
    const ara = rankVar === 'ara' || rankVar === 'arafred';
    document.querySelectorAll('[data-var]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.var === (ara ? 'ara' : rankVar))));
    $('rankOrder').hidden = !ara;
    document.querySelectorAll('[data-order]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.order === rankOrder)));
  }
  document.querySelectorAll('[data-var]').forEach((b) =>
    b.addEventListener('click', () => {
      rankVar = b.dataset.var === 'ara' ? (rankOrder === 'fred' ? 'arafred' : 'ara') : b.dataset.var;
      if (isAra() && choice !== 'avui') setChoice('avui');
      syncVar();
      draw();
    }),
  );
  document.querySelectorAll('[data-order]').forEach((b) =>
    b.addEventListener('click', () => {
      rankOrder = b.dataset.order;
      rankVar = rankOrder === 'fred' ? 'arafred' : 'ara';
      syncVar();
      draw();
    }),
  );
  document.querySelectorAll('[data-fmt]').forEach((b) =>
    b.addEventListener('click', () => {
      rankFmt = b.dataset.fmt;
      store.set(K_FMT, rankFmt);
      document.querySelectorAll('[data-fmt]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      draw();
    }),
  );
  $('sentence').addEventListener('input', (e) => { sentence.text = e.target.value; sentence.edited = true; draw(); });
  $('sentenceReset').addEventListener('click', () => { sentence.key = ''; draw(); });

  // ------------------------------------------------------------------ exportar
  function fileName() {
    const n = (d) => d.replaceAll('-', '');
    if (tpl === 'previsio') return `meteocadi-previsio-${n(pv.date)}${pvLayout?.pages.length > 1 ? `-${page + 1}` : ''}.png`;
    const date = lastData?.date || todayMadrid();
    if (tpl === 'resum') return `meteocadi-resum-${n(date)}.png`;
    const cat = lastData?.net === 'cat';
    if (lastData?.kind === 'range') return `meteocadi-ranquing-${cat ? 'catalunya-' : ''}${rankVar}-${n(lastData.from)}-${n(lastData.to)}${lastData.time ? `-${lastData.time.replace(':', '')}` : ''}${rankFmt === 'wide' ? '-horitzontal' : rankFmt === 'post' ? '-4x5' : ''}.png`;
    return `meteocadi-ranquing-${cat ? 'catalunya-' : ''}${rankVar}-${n(date)}${cat && lastData.kind === '24h' ? `-24h-${lastData.time.replace(':', '')}` : isAra() && lastData.time ? `-${lastData.time.replace(':', '')}` : ''}${rankFmt === 'wide' ? '-horitzontal' : rankFmt === 'post' ? '-4x5' : ''}.png`;
  }
  async function blob() {
    await document.fonts.ready;
    refreshDate();
    await draw();
    return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('png'))), 'image/png'));
  }
  $('download').addEventListener('click', async () => {
    const btn = $('download');
    btn.disabled = true;
    try {
      const b = await blob();
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName();
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 20000);
      toast('Imatge descarregada.');
    } catch {
      toast("No s'ha pogut generar la imatge. Torna-ho a provar.");
    } finally {
      btn.disabled = false;
    }
  });
  // Compartir directament (mòbil): obre el menú del sistema per enviar-la a Instagram, X…
  try {
    const probe = new File([new Blob(['x'], { type: 'image/png' })], 'x.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [probe] })) $('share').hidden = false;
  } catch { /* sense suport */ }
  $('share').addEventListener('click', async () => {
    try {
      const b = await blob();
      await navigator.share({ files: [new File([b], fileName(), { type: 'image/png' })] });
    } catch (e) {
      if (e?.name !== 'AbortError') toast("No s'ha pogut compartir. Descarrega-la.");
    }
  });

  // ------------------------------------------------------------------ inici
  syncTpl();
  syncEditor();
  document.querySelectorAll('[data-fmt]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.fmt === rankFmt)));
  $('pvDate').value = pv.date;
  refreshDate();
  try {
    [icons] = await Promise.all([loadIcons(), loadFonts()]);
  } catch {
    /* es dibuixa igualment amb les lletres del sistema */
  }
  ready = true;
  $('download').disabled = false;
  draw();
}
