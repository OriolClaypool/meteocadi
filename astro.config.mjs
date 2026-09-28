import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { episodes } from './src/lib/episodes.js';

const HIDDEN = /\/(estudi|404|webcams)(\.html)?$/;
// La llista d'episodis és noindex mentre no n'hi ha cap
const NO_EPISODES = episodes().length === 0;

export default defineConfig({
  site: 'https://www.meteocadi.cat',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [
    sitemap({
      filter: (page) => !HIDDEN.test(page) && !(NO_EPISODES && /\/episodis$/.test(page)),
      changefreq: 'hourly',
    }),
  ],
});
