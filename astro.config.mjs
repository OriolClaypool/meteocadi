import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const HIDDEN = /\/(ranking|taula|previsio|404|webcams)(\.html)?$/;

export default defineConfig({
  site: 'https://meteocadi.cat',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [
    sitemap({
      filter: (page) => !HIDDEN.test(page),
      changefreq: 'hourly',
    }),
  ],
});
