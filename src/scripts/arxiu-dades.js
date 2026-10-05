// Arxiu diari de les estacions pròpies al navegador (estudi i mapa de Catalunya). /estudi-dades.json porta els
// darrers dies, el primer dia de l'arxiu (first) i els anys (years); els dies més antics són a /estudi-dades/AAAA.json
// i es demanen només quan el període en necessita.
let main = null;
const yearFiles = new Map();
const get = (url, opt) => fetch(url, opt).then((r) => (r.ok ? r.json() : null)).catch(() => null);

export function archiveMain() {
  return (main ||= get('/estudi-dades.json', { cache: 'no-cache' }));
}

// { first, years, days } amb tots els dies de from a to (dates AAAA-MM-DD); null si l'arxiu no es pot carregar
export async function archiveFor(from, to = from) {
  const m = await archiveMain();
  if (!m) return null;
  const start = m.days[0]?.date;
  if (!start || from >= start) return m;
  const ys = (m.years || []).filter((y) => y >= Number(from.slice(0, 4)) && y <= Math.min(Number(to.slice(0, 4)), Number(start.slice(0, 4))));
  const extra = await Promise.all(ys.map((y) => {
    if (!yearFiles.has(y)) yearFiles.set(y, get(`/estudi-dades/${y}.json`));
    return yearFiles.get(y);
  }));
  const byDate = new Map();
  for (const e of extra) for (const d of e?.days || []) byDate.set(d.date, d);
  for (const d of m.days) byDate.set(d.date, d);
  return { ...m, days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}
