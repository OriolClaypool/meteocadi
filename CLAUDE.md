# Meteocadí — notes for Claude Code

Weather-station network site for Cadí-Moixeró / Berguedà. **All user-facing copy is in Catalan.**

## Stack
- Canonical domain: `https://www.meteocadi.cat` (Vercel redirects the apex to www; Google indexes www). Use www in `site`, canonicals, JSON-LD and the sitemap.
- Astro (static output, `build.format: 'file'`, no trailing slash) deployed on Vercel. `vercel.json` sets framework/build/output, cron, redirects.
- Vercel functions live in `/api` (plain Node, not Astro): `ara.js` (all stations live, CDN-cached 15 min), `arxiva.js` (nightly archive → commits `dades/YYYY/*.json` to GitHub).
- The old image generators (`/taula`, `/ranking`, `/previsio`) were removed; `vercel.json` redirects them to `/estudi`.

## Data
- Stations: single source of truth in `src/lib/stations.js` (Weather Underground IDs). Keep `api/arxiva.js` STATIONS_META in sync when adding a station.
- WU key limit: 1,500 calls/day and 30/min. Never call WU from the browser; go through `/api/ara` (cached).
- Archive read at build time by `src/lib/archive.js` (every nightly archive commit triggers a rebuild, so "yesterday" data is baked into HTML).
- Forecast: Open-Meteo (no key), client-side in `src/scripts/forecast.js`; build-time snapshot for SEO text in `src/lib/forecast-build.js` and `src/lib/weekend.js` (must never fail the build).

## Pages
`/` home · `/estacions` + `/estacions/[slug]` · `/temps` + `/temps/[slug]` (places in `src/lib/places.js`) · `/cap-de-setmana` · `/mapa` (Leaflet, bundled) · `/radar` (Meteocat giny) · `/historial` · `/sobre` · `/contacte` (email from env `CONTACT_EMAIL`) · `/webcams` (noindex until cameras exist) · `/estudi` (internal, noindex + robots-disallowed: builds the 1080×1920 social images — forecast text editor, daily summary and rankings — drawn on canvas in `src/scripts/estudi/`; archive data from the static `/estudi-dades.json`, today's data from `/api/ara`).

## Design
No italics in headings: the second part of a two-part heading goes in an accent colour (`<em>` is styled non-italic).
Social images: no logo or project name, only `meteocadi.cat` in the footer.

Direction "D": photo hero + light/dark alternating sections; data components use the "instrument" style (dark panels, Geist Mono numbers). Fonts self-hosted via Fontsource (Schibsted Grotesk, Geist, Geist Mono). Colors/tokens in `src/styles/global.css`. No emojis; icons are inline SVG or Meteocons (`public/imatges/icones`).

## Commands
`npm run dev` · `npm run build` · always finish with `git add . && git commit -m "..." && git push`.
