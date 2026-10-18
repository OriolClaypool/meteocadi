// Dies de l'arxiu en el format compacte del navegador (estudi i mapa de Catalunya): per estació,
// [màxima, mínima, ratxa màxima, pluja]; susp: estacions amb el dia probablement incomplet.
// /estudi-dades.json porta els darrers RECENT dies, el primer dia de l'arxiu i la llista d'anys; els dies d'abans són a
// /estudi-dades/AAAA.json (src/scripts/arxiu-dades.js els demana només quan calen).
import fs from 'node:fs';
import path from 'node:path';
import { loadDays, suspicious } from './archive.js';

export const RECENT = 400;
const r1 = (v) => (v == null || isNaN(v) ? null : Math.round(Number(v) * 10) / 10);

export function compactDays() {
  return loadDays()
    .filter((d) => Object.keys(d.stations).length)
    .map((d) => ({
      date: d.date,
      s: Object.fromEntries(Object.entries(d.stations).map(([id, v]) => [id, [r1(v.tempHigh), r1(v.tempLow), r1(v.windgustHigh), r1(v.precipTotal)]])),
      susp: [...suspicious(d)],
    }));
}

export const json = (body) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

// Hora a hora del darrer dia arxivat (dades/AAAA/hores/), per a les "Darreres 24 h" de les nostres estacions al mapa de
// Catalunya: les hores d'ahir que entren a la finestra, més el que porten d'avui (/api/ara). Per estació i hora:
// th màxima, tl mínima, g ratxa, r pluja (mm en aquella hora). Si el control de qualitat de l'arxiu va descartar una
// variable aquell dia (o el dia és probablement incomplet), no s'hi posa.
export function lastHours() {
  const root = path.resolve(process.env.DADES_DIR || 'dades');
  const files = [];
  if (fs.existsSync(root)) {
    for (const y of fs.readdirSync(root)) {
      const dir = path.join(root, y, 'hores');
      if (!/^\d{4}$/.test(y) || !fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) if (/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) files.push(path.join(dir, f));
    }
  }
  files.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  const file = files[files.length - 1];
  if (!file) return { date: null, s: {} };
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const day = compactDays().find((d) => d.date === j.date);
  const s = {};
  for (const [id, v] of Object.entries(j.stations || {})) {
    const dv = day?.s?.[id];
    if (!v?.h?.length || !dv) continue;
    const ok = (k) => Array.isArray(v[k]) && v[k].length === v.h.length;
    const susp = day.susp.includes(id);
    s[id] = {
      h: v.h,
      th: !susp && dv[0] != null && ok('tempHigh') ? v.tempHigh.map(r1) : null,
      tl: !susp && dv[1] != null && ok('tempLow') ? v.tempLow.map(r1) : null,
      g: dv[2] != null && ok('windgustHigh') ? v.windgustHigh.map(r1) : null,
      r: dv[3] != null && ok('rain') ? v.rain.map((x) => (x == null ? null : Math.round(x * 100) / 100)) : null,
    };
  }
  return { date: j.date, s };
}
