// Vigila les estacions de la xarxa Meteocadí. S'executa a GitHub Actions tres cops al dia
// (.github/workflows/vigila.yml): quan una estació deixa de donar dades o el control de qualitat (src/lib/qc.js) en
// descarta un sensor, obre una incidència al repositori amb una menció al propietari (GitHub n'avisa per correu i a
// l'app); quan l'estació torna a funcionar, la tanca sola. També avisa si l'arxiu de la nit no ha desat el dia d'ahir.
// L'autor de les incidències és github-actions (no tu): per això sí que arriben les notificacions.
//
// Prova sense tocar GitHub: DRY=1 node scripts/vigila.mjs (ho escriu tot a la consola).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATIONS, BY_ID } from '../src/lib/stations.js';
import { LIMITS, inRange, rainSuspects, windSuspects } from '../src/lib/qc.js';

const SITE = 'https://www.meteocadi.cat';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
// "4/10 a les 13:20"
const when = (d) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('ca-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month} a les ${p.hour}:${p.minute}`;
};
const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const TEXT = {
  'sense-dades': ['sense dades', "Weather Underground no en retorna cap lectura (ni la d'ara ni el resum del dia)."],
  'fora-servei': ['fora de servei', "L'última lectura no porta temperatura, humitat ni vent: el bloc de sensors exteriors no transmet (piles, ràdio o consola). La pressió, que es mesura a la consola, sí que arriba."],
  'sense-lectures': ['sense lectures recents', ''],
  temperatura: ['temperatura incoherent', "La temperatura s'allunya més de 8 °C de la de les estacions d'altitud semblant. Pot ser el sensor o la protecció contra el sol."],
  pluja: ['el pluviòmetre no recull', "Recull molt menys que l'estació veïna, o res mentre a la resta de la xarxa plou. Sol ser l'embut embussat (fulles, insectes, brutícia)."],
  vent: ['anemòmetre encallat', 'Ratxa màxima de 0 km/h tot el dia mentre la resta de la xarxa en té 20 o més.'],
};

// ara: resposta de /api/ara (o null si no ha respost); yesterday: arxiu d'ahir (o null si no hi és);
// checkArchive: si ja és l'hora en què l'arxiu d'ahir hi hauria de ser.
// Retorna { problems: [{ key, id, kind, title, detail }], working: Set de claus que se sap que tornen a funcionar }.
export function inspect({ ara, yesterday, now = new Date(), checkArchive = true }) {
  const problems = new Map();
  const working = new Set();
  const add = (id, kind, title, detail) => {
    const key = `${id}:${kind}`;
    if (!problems.has(key)) problems.set(key, { key, id, kind, title, detail });
  };
  const station = (id, kind, extra = '') => {
    const s = BY_ID[id];
    add(id, kind, `${s.name}: ${TEXT[kind][0]}`, [TEXT[kind][1], extra].filter(Boolean).join(' '));
  };

  // 1) Ara mateix, amb el control de qualitat de /api/ara
  if (!ara) {
    add('web', 'no-respon', 'Les dades en directe no responen', `${SITE}/api/ara no ha respost. Pot ser una caiguda de la web o de Weather Underground.`);
  } else if (!ara.ok) {
    add('xarxa', 'sense-dades', 'Cap estació no dona dades', 'Totes les estacions han caigut alhora: sol ser la clau de Weather Underground (límit de crides superat o clau desactivada) o una caiguda de Weather Underground.');
  } else {
    working.add('web:no-respon').add('xarxa:sense-dades');
    const nowSec = now.getTime() / 1000;
    for (const s of STATIONS) {
      const d = ara.stations?.[s.id];
      if (!d) {
        station(s.id, 'sense-dades');
        continue;
      }
      working.add(`${s.id}:sense-dades`);
      if (d.down) {
        station(s.id, 'fora-servei');
        continue;
      }
      working.add(`${s.id}:fora-servei`);
      // Una estació pot trigar una estona a enviar: només s'avisa a partir de 3 hores sense lectures
      if (d.epoch && nowSec - d.epoch > 3 * 3600) {
        station(s.id, 'sense-lectures', `L'última lectura és del ${when(new Date(d.epoch * 1000))}.`);
        continue;
      }
      working.add(`${s.id}:sense-lectures`);
      const bad = new Set(d.bad || []);
      if (bad.has('temp')) station(s.id, 'temperatura');
      else if (d.temp != null) working.add(`${s.id}:temperatura`);
      if (bad.has('rain')) station(s.id, 'pluja');
      if (bad.has('wind')) station(s.id, 'vent');
    }
    // Pluviòmetre i anemòmetre: només es poden donar per bons quan plou o fa vent (si no, no se sap)
    const live = (k) => median(STATIONS.map((s) => ara.stations?.[s.id]?.[k]));
    for (const s of STATIONS) {
      const d = ara.stations?.[s.id];
      if (!d || d.down || (d.bad || []).length) continue;
      if (live('rain') >= 2 && d.rain >= 0.2) working.add(`${s.id}:pluja`);
      if (live('gustMax') >= 20 && d.gustMax > 0) working.add(`${s.id}:vent`);
    }
  }

  // 2) El dia d'ahir sencer, de l'arxiu: es veu millor que amb les primeres hores d'avui
  if (yesterday) {
    working.add('arxiu:no-desat');
    const S = yesterday.stations || {};
    const field = (k, lim) => Object.fromEntries(Object.entries(S).filter(([id, v]) => v && BY_ID[id]).map(([id, v]) => [id, inRange(v[k], lim) ? Number(v[k]) : null]));
    const rain = field('precipTotal', LIMITS.rain);
    const gust = field('windgustHigh', LIMITS.gust);
    const rs = rainSuspects(rain);
    const ws = windSuspects(gust);
    const day = yesterday.date ? ` (ahir, ${yesterday.date.split('-').reverse().slice(0, 2).map(Number).join('/')})` : '';
    for (const id of rs) station(id, 'pluja', `Darrer dia comprovat${day}: ${rain[id]} mm.`);
    for (const id of ws) station(id, 'vent');
    const mr = median(Object.values(rain));
    const mg = median(Object.values(gust));
    for (const id of Object.keys(rain)) {
      if (!rs.has(id) && mr >= 2 && rain[id] >= 0.2) working.add(`${id}:pluja`);
      if (!ws.has(id) && mg >= 20 && gust[id] > 0) working.add(`${id}:vent`);
    }
  } else if (checkArchive) {
    add('arxiu', 'no-desat', "L'arxiu d'ahir no s'ha desat", "El cron de la nit (api/arxiva.js) no ha desat el fitxer del dia d'ahir a dades/. Mira els registres de Vercel (Logs, /api/arxiva). Si torna a funcionar, l'endemà recupera sol els dies que falten.");
  }
  // Una clau que encara és un problema no pot ser "bona" (p. ex., pluviòmetre dolent avui però bo ahir)
  for (const k of problems.keys()) working.delete(k);
  return { problems: [...problems.values()], working };
}

// ------------------------------------------------------------------ incidències a GitHub
const MARK = (key) => `<!-- vigila:${key} -->`;
const keyOf = (body) => /<!-- vigila:([^ ]+) -->/.exec(body || '')?.[1] || null;

function issueBody(p, owner, now) {
  const s = BY_ID[p.id];
  const lines = [`@${owner}, el control de qualitat ha detectat un problema.`, ''];
  if (s) lines.push(`**${s.name}** (${s.id}, ${s.alt.toLocaleString('ca-ES')} m)`);
  lines.push(p.detail, '');
  if (s) {
    lines.push("Mentre duri, la web deixa de fer servir aquestes dades (ho fa sola). Aquesta incidència es tancarà sola quan l'estació torni a funcionar.", '');
    lines.push(`- Fitxa a la web: ${SITE}/estacions/${s.slug}`, `- Panell de Weather Underground: https://www.wunderground.com/dashboard/pws/${s.id}`, '');
  } else {
    lines.push('Aquesta incidència es tancarà sola quan tot torni a funcionar.', '');
  }
  lines.push(`Comprovat el ${when(now)}.`, MARK(p.key));
  return lines.join('\n');
}

export async function sync({ problems, working }, { gh, owner, now = new Date(), log = console.log }) {
  const open = (await gh('GET', '/issues?state=open&per_page=100')).filter((i) => !i.pull_request && keyOf(i.body));
  const byKey = new Map(open.map((i) => [keyOf(i.body), i]));
  const done = [];
  for (const p of problems) {
    if (byKey.has(p.key)) {
      log(`continua obert: ${p.title} (#${byKey.get(p.key).number})`);
      continue;
    }
    const i = await gh('POST', '/issues', { title: p.title, body: issueBody(p, owner, now) });
    log(`obert: ${p.title} (#${i?.number ?? '-'})`);
    done.push(['obert', p.key]);
  }
  for (const [key, issue] of byKey) {
    if (!working.has(key)) continue;
    await gh('POST', `/issues/${issue.number}/comments`, { body: `Torna a funcionar (comprovat el ${when(now)}). Tanco la incidència.` });
    await gh('PATCH', `/issues/${issue.number}`, { state: 'closed', state_reason: 'completed' });
    log(`tancat: ${issue.title} (#${issue.number})`);
    done.push(['tancat', key]);
  }
  return done;
}

// ------------------------------------------------------------------ execució
async function main() {
  const now = new Date();
  const dry = !!process.env.DRY || !process.env.GITHUB_TOKEN;
  let ara = null;
  for (let k = 0; k < 2 && !ara; k++) {
    try {
      const r = await fetch(`${SITE}/api/ara`, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'meteocadi-vigila' } });
      if (r.ok) ara = await r.json();
    } catch (e) {
      console.error('api/ara:', String(e));
    }
    if (!ara && k === 0) await new Promise((r) => setTimeout(r, 15000));
  }
  const y = ymd(new Date(now.getTime() - 24 * 3600e3));
  const file = path.join(ROOT, 'dades', y.slice(0, 4), `${y}.json`);
  const yesterday = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  // L'arxiu es fa entre les 4 i les 5 UTC; a la primera passada del matí encara pot no ser-hi
  const checkArchive = now.getUTCHours() >= 9;
  const result = inspect({ ara, yesterday, now, checkArchive });
  console.log(`Problemes: ${result.problems.length ? result.problems.map((p) => p.title).join(' · ') : 'cap'}`);
  if (dry) {
    console.log('(prova: no es toca GitHub)');
    for (const p of result.problems) console.log(`\n--- ${p.title}\n${issueBody(p, process.env.GITHUB_REPOSITORY_OWNER || 'propietari', now)}`);
    return;
  }
  const repo = process.env.GITHUB_REPOSITORY;
  const gh = async (method, url, body) => {
    const r = await fetch(`https://api.github.com/repos/${repo}${url}`, {
      method,
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'meteocadi-vigila',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error(`GitHub ${method} ${url}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return r.status === 204 ? null : r.json();
  };
  await sync(result, { gh, owner: process.env.GITHUB_REPOSITORY_OWNER, now });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
