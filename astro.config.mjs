import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import ogCards from './integrations/og-cards.mjs';
import { episodes } from './src/lib/episodes.js';
import { modelsReady } from './src/lib/models.js';

const HIDDEN = /\/(estudi(\/.*)?|404|webcams)(\.html)?$/;
// La llista d'episodis és noindex mentre no n'hi ha cap
const NO_EPISODES = episodes().length === 0;
// "Quin model encerta més al Cadí?" també, mentre no hi ha prou dies de previsions (src/lib/models.js)
const NO_MODELS = !modelsReady();

export default defineConfig({
  site: 'https://www.meteocadi.cat',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [
    ogCards(),
    sitemap({
      filter: (page) => !HIDDEN.test(page) && !(NO_EPISODES && /\/episodis$/.test(page)) && !(NO_MODELS && /\/models$/.test(page)),
      changefreq: 'hourly',
      // Data del build: les pàgines es regeneren cada dia amb la previsió i l'arxiu nous
      serialize: (item) => ({ ...item, lastmod: new Date().toISOString() }),
    }),
  ],
});
