# Meteocadí — notes for Claude Code

Weather-station network site for Cadí-Moixeró / Berguedà. **All user-facing copy is in Catalan**, except the Spanish versions of the place and mountain pages (see below).

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

## Mountain pages
- Places with `kind` cim / coll / esqui / refugi (see `MOUNTAIN_KINDS` in `src/lib/places.js`) are mountain pages: they need `points` (label, lat, lng, alt) for the forecast at altitude, and show the liability notice (`MountainNotice`) at the top and bottom.
- `src/lib/mountain.js` builds the Open-Meteo multi-point request (temperature, feels-like, wind/gusts, precipitation, snow, freezing level) and the tables/text, both at build time and in the browser.
- `/muntanya` is the hub (high stations live + summary table); `/avis-legal` holds the full disclaimer. Keep both linked from the footer.
- Facts in place intros must be verifiable (altitudes, municipalities, routes); don't add claims without a source.

## Catalonia map (/mapa/catalunya)
- `api/xema.js`: all operating XEMA stations of the Meteocat from the Generalitat open data portal (Socrata datasets `yqwd-vj5e` stations, `nzvn-apee` semi-hourly readings; no key needed, optional `SOCRATA_APP_TOKEN`). Latest value per variable (last 3 h) plus today's max/min/rain/gust aggregates. CDN cache 15 min. Readings arrive ~45–75 min late; `data_lectura` is the UTC start of each 30-min slot.
- `api/comarques.js`: ICGC comarca borders (dataset `aasi-gwnd`), simplified server-side, CDN cache 30 days.
- The page merges our stations from `/api/ara` (dark outline). Labels that collide become dots (priority: our stations, then the most extreme values). Snow depth only in season (sensors report a few cm of noise in summer).
- Always credit: Servei Meteorològic de Catalunya (XEMA) · dades obertes de la Generalitat; comarca borders: ICGC.

## Ski (Meteocadí Neu)
- `/esqui` and `/es/esqui` (`SkiHub.astro`): 7-day board for every place with a `ski` attribute in `places.js` (type, region, official web, webcams), roads near the resorts (`/api/transit?near=lat:lng:km`) and official links.
- `src/lib/ski.js` rates the weather for skiing (wind at the top, snowfall, rain at the base, sun, cold, heat, fresh snow). It is weather only, never slope status or whether a resort is open; the rating is hidden out of season (15 Nov–30 Apr), `?temporada` forces it for testing.
- Resort facts must be verifiable; the official site of each resort is the reference for opening, snow and prices.

## Episodes (automatic reports)
- `src/lib/episodes.js` scans the daily archive at build time for heavy rain, strong wind, heat, cold and the first valley frost of the autumn (thresholds in `LLINDARS`; another station must corroborate). Consecutive days merge into one episode; slug `/episodis/YYYY-MM-DD-type` (start date, stable while the episode grows).
- Measured data only, never forecasts; never claim snow amounts (gauges don't measure snow).
- `/episodis` is noindex and left out of the sitemap while there are no episodes (see `astro.config.mjs`). The home shows a strip for an episode that ended ≤ 6 days before the last archived day; month pages list their episodes.
- Test with fake data: `DADES_DIR=<dir> npm run build` (overrides the `dades/` folder read by `archive.js`).

## Spanish pages (/es/)
- Only `/es/tiempo`, `/es/tiempo/[slug]` and `/es/montana`, built from the same components as the Catalan pages (`PlacePage.astro`, `MountainHub.astro`) with `lang="es"`. Catalan is primary: hreflang pairs with Catalan as x-default, no automatic language redirects, and no Spanish home page (searches for "Meteocadí" must land on the Catalan site).
- Spanish place texts live in `src/lib/places-es.js` (keep in sync with `places.js`; toponyms stay in Catalan). UI strings for shared components are in `src/lib/i18n.js`; client scripts read the language from `<html lang>`.
- Base takes `lang` and `alternates` ({ ca, es } paths); the header shows a small ES / CA link when a page has both.

## Road status (Servei Català de Trànsit, open data)
- Places with `roads` (and optional `cameras`) in `places.js` show `RoadStatus` (tunnel, Coll de Pal).
- `api/transit.js` reads the SCT incidents GML feed (updated hourly) and filters by road and km range: `/api/transit?roads=C-16:110-135,BV-4024`. CDN cache 10 min.
- `api/camera.js` proxies SCT camera images (their server is http only). Only IDs in its `ALLOWED` set are served; add new cameras there too.

## Design
No italics in headings: the second part of a two-part heading goes in an accent colour (`<em>` is styled non-italic).
Social images: no logo or project name, only `meteocadi.cat` in the footer.

Direction "D": photo hero + light/dark alternating sections; data components use the "instrument" style (dark panels, Geist Mono numbers). Fonts self-hosted via Fontsource (Schibsted Grotesk, Geist, Geist Mono). Colors/tokens in `src/styles/global.css`. No emojis; icons are inline SVG or Meteocons (`public/imatges/icones`).

## Commands
`npm run dev` · `npm run build` · always finish with `git add . && git commit -m "..." && git push`.
