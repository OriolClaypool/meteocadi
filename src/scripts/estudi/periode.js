// Diversos dies a la xarxa pròpia (rànquing de l'estudi): per a cada estació, la pluja total, la màxima més alta, la
// mínima més baixa i la ratxa més forta del període, amb els dies de l'arxiu i, si el període arriba a avui, el
// directe (/api/ara).
// Un dia sense dades, o amb la variable descartada pel control de qualitat, no treu l'estació: hi surt amb una nota
// ("falta 1 dia", "falta avui"), perquè el total real pot ser més alt. Si li'n falten més d'un 10 % (sense comptar
// avui, que encara no s'ha acabat), aquella variable no es dona. Fins al 20 d'octubre del 2026 n'hi havia prou amb un
// dia sense dades per treure l'estació de tot el període: de l'1 al 20 d'octubre en sortien 7 de 12 (Coll de Pal, per
// exemple, perquè aquell matí no enviava dades; Oriol: "només surten aquestes estacions").
// stations: STATIONS; dates: ['AAAA-MM-DD', …]; byDate: Map data → dia de l'arxiu ({ s: { id: [max, min, ratxa,
// pluja] }, susp: [ids] }); live: resposta de /api/ara (o null).
export function periodRows({ stations, dates, today, byDate, live, name = (s) => s.name }) {
  const allowed = Math.floor(dates.length / 10);
  const rows = [];
  for (const s of stations) {
    let tmax = -Infinity, tmin = Infinity, gust = -Infinity, rain = 0, any = false, partial = false;
    const miss = { t: [], g: [], r: [] };
    for (const d of dates) {
      let v = null;
      if (d === today) {
        const x = live?.stations?.[s.id];
        // Fora de servei (down): avui no compta. Sense lectures fa més d'1 h 30 (stale) però amb dades d'abans: es fan
        // servir fins on arriben i la nota diu que avui és incomplet.
        if (x && !x.down) {
          v = [x.max ?? null, x.min ?? null, x.gustMax ?? x.gust ?? null, x.rain ?? null, false];
          partial = !!x.stale;
        }
      } else {
        const day = byDate.get(d);
        const x = day?.s?.[s.id];
        if (x) v = [...x, day.susp?.includes(s.id)];
      }
      if (!v) {
        miss.t.push(d);
        miss.g.push(d);
        miss.r.push(d);
        continue;
      }
      any = true;
      if (v[0] == null || v[1] == null || v[4]) miss.t.push(d);
      else {
        tmax = Math.max(tmax, v[0]);
        tmin = Math.min(tmin, v[1]);
      }
      if (v[2] == null) miss.g.push(d);
      else gust = Math.max(gust, v[2]);
      if (v[3] == null) miss.r.push(d);
      else rain += v[3];
    }
    if (!any) continue;
    const ok = (m) => m.length < dates.length && m.filter((d) => d !== today).length <= allowed;
    const note = (m) => {
      if (!m.length) return partial ? 'avui incomplet' : '';
      if (m.length === 1 && m[0] === today) return 'falta avui';
      return m.length === 1 ? 'falta 1 dia' : `falten ${m.length} dies`;
    };
    const tOk = ok(miss.t), gOk = ok(miss.g), rOk = ok(miss.r);
    rows.push({
      id: s.id,
      name: name(s),
      alt: s.alt,
      max: tOk ? tmax : null,
      min: tOk ? tmin : null,
      gust: gOk ? gust : null,
      rain: rOk ? Math.round(rain * 10) / 10 : null,
      susp: !tOk,
      // Nota de cada variable (amb la clau de la fila: max, min, gust, rain); buida si no hi falta res
      falta: { max: tOk ? note(miss.t) : '', min: tOk ? note(miss.t) : '', gust: gOk ? note(miss.g) : '', rain: rOk ? note(miss.r) : '' },
    });
  }
  return rows;
}
