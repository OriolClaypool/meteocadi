// Un any sencer de l'arxiu en el format compacte (/estudi-dades/2025.json), per als dies que ja no són a
// /estudi-dades.json. Vegeu src/lib/estudi-dades.js.
import { compactDays, json } from '../../lib/estudi-dades.js';

export function getStaticPaths() {
  return [...new Set(compactDays().map((d) => d.date.slice(0, 4)))].map((any) => ({ params: { any } }));
}

export async function GET({ params }) {
  return json({ year: Number(params.any), days: compactDays().filter((d) => d.date.startsWith(params.any)) });
}
