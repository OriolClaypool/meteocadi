// Meteocadí Neu: gruix de neu mesurat als sensors de la XEMA (variable 38, cada mitja hora) i neu nova de cada dia.
// Per estació: gruix ara, diferència en 24 hores i neu nova dels 5 dies anteriors (el màxim del dia menys el gruix
// a l'inici del dia; no compta l'assentament ni la fusió). Les lectures passen per una mediana de 5 per treure pics,
// i per sota de 3 cm es compten com a 0 (soroll dels sensors fora de temporada).
// Es publica a /api/neu/mesurada (api/neu/[estacio].js): el prefix "_" fa que Vercel no en faci una funció a part
// (el pla Hobby en permet 12 per desplegament). Memòria cau a la CDN de 30 minuts (la XEMA publica cada mitja hora,
// amb uns 45-75 minuts de retard).
import { socrata, xemaMeta, cleanName, floating, midnightOf, ymdMadrid } from './_xema.js';

const DAY = 864e5;
const MIN_ALT = 1000; // les estacions més baixes no serveixen per a l'esquí

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

export async function neuMesurada(now = new Date()) {
  const today = ymdMadrid(now);
  const days = [5, 4, 3, 2, 1].map((k) => ymdMadrid(new Date(now.getTime() - k * DAY)));
  const from = midnightOf(days[0]);
  const [meta, rows] = await Promise.all([
    xemaMeta(),
    socrata('nzvn-apee.json', {
      $select: 'codi_estacio,data_lectura,valor_lectura',
      $where: `data_lectura>='${floating(from)}' AND codi_variable='38'`,
      $order: 'data_lectura ASC',
      $limit: '50000',
    }),
  ]);
  const byId = {};
  for (const r of rows) {
    const v = Number(r.valor_lectura);
    if (r.valor_lectura === '' || r.valor_lectura == null || isNaN(v) || v < 0 || v > 1000) continue;
    // data_lectura és l'inici de la mitja hora, en UTC
    (byId[r.codi_estacio] ||= []).push({ t: Date.parse(`${r.data_lectura.slice(0, 19)}Z`) + 30 * 60e3, v });
  }
  const bounds = [...days, today].map((d) => midnightOf(d).getTime());
  const stations = [];
  for (const s of meta) {
    const raw = byId[s.codi_estacio];
    const alt = Number(s.altitud);
    if (!raw?.length || !(alt >= MIN_ALT)) continue;
    const ser = raw.map((x, i) => {
      const w = raw.slice(Math.max(0, i - 2), i + 3).map((y) => y.v);
      const m = median(w);
      return { t: x.t, v: m < 3 ? 0 : m };
    });
    const last = ser[ser.length - 1];
    const fresh = now.getTime() - last.t < 6 * 3600e3;
    const near = (t) => {
      let b = null, bd = Infinity;
      for (const x of ser) {
        const d = Math.abs(x.t - t);
        if (d < bd) { bd = d; b = x; }
      }
      return bd <= 1.5 * 3600e3 ? b : null;
    };
    const ago = fresh ? near(last.t - DAY) : null;
    const nou = days.map((date, k) => {
      const inDay = ser.filter((x) => x.t > bounds[k] && x.t <= bounds[k + 1]);
      if (inDay.length < 12) return { date, nou: null };
      const before = ser.filter((x) => x.t <= bounds[k]).pop();
      const start = before && bounds[k] - before.t <= 3 * 3600e3 ? before.v : inDay[0].v;
      const gain = Math.max(...inDay.map((x) => x.v)) - start;
      return { date, nou: gain >= 1 ? Math.round(gain) : 0 };
    });
    stations.push({
      id: s.codi_estacio,
      name: cleanName(s.nom_estacio),
      lat: Number(s.latitud),
      lng: Number(s.longitud),
      alt,
      now: fresh ? Math.round(last.v) : null,
      d24: fresh && ago ? Math.round(last.v - ago.v) : null,
      time: new Date(last.t).toISOString(),
      days: nou,
    });
  }
  return {
    updated: now.toISOString(),
    source: 'Servei Meteorològic de Catalunya (XEMA) · Dades obertes de la Generalitat de Catalunya',
    stations: stations.sort((a, b) => b.alt - a.alt),
  };
}
