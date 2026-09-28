import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const HIDDEN = /\/(estudi|404|webcams)(\.html)?$/;

export default defineConfig({
  site: 'https://www.meteocadi.cat',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [
    sitemap({
      filter: (page) => !HIDDEN.test(page),
      changefreq: 'hourly',
    }),
  ],
});
