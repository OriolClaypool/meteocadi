// Genera, en acabar el build, la imatge de previsualització de cada pàgina (/og/<camí>.jpg).
// Base.astro deixa les dades de la targeta en una etiqueta <meta name="mc-og">: aquí es llegeix, es dibuixa la
// imatge (og-render.mjs) i es treu l'etiqueta de l'HTML final. Així cada pàgina nova en té una sense fer res més.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const TAG = /<meta name="mc-og" content="([^"]*)"\s*\/?>/;
const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');

async function htmlFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await htmlFiles(p)));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

export default function ogCards() {
  return {
    name: 'meteocadi-og-cards',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        // Només en el build: així `astro dev` no carrega satori ni les fonts
        const { renderCard } = await import('./og-render.mjs');
        const root = fileURLToPath(dir);
        const t0 = Date.now();
        let n = 0;
        for (const file of await htmlFiles(root)) {
          const html = await readFile(file, 'utf8');
          const m = html.match(TAG);
          if (!m) continue;
          const card = JSON.parse(unescape(m[1]));
          const out = path.join(root, card.o);
          await mkdir(path.dirname(out), { recursive: true });
          await writeFile(out, await renderCard(card));
          await writeFile(file, html.replace(TAG, ''));
          n++;
        }
        logger.info(`${n} imatges de previsualització en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      },
    },
  };
}
