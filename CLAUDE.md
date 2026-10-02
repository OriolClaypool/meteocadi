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
- Home hero speaks to all of Catalonia ("El temps a Catalunya, de la vall al cim.", first button to the Catalonia map, second to the network); the hero card and the stations section are labelled as the Meteocadí network ("La xarxa Meteocadí, ara").
- Home: right after the hero, `CatalunyaAra.astro` (temperature map of Catalonia with as many station labels as fit without overlapping, hottest and coldest first and bigger; labels scale up on mobile; small meteocadi.cat mark; links to the public map).
- Home hero card: from 8:00 (Madrid) it shows today's extremes so far from `/api/ara` (live, refreshed every 15 min); before 8:00 or if the live data fails, the last archived day (baked in at build).
- Forecast: Open-Meteo (no key), client-side in `src/scripts/forecast.js`; build-time snapshot for SEO text in `src/lib/forecast-build.js` and `src/lib/weekend.js` (must never fail the build).

## Pages
`/` home · `/estacions` + `/estacions/[slug]` · `/temps` + `/temps/[slug]` (places in `src/lib/places.js`) · `/cap-de-setmana` · `/mapa` (Leaflet, bundled) · `/radar` (Meteocat giny) · `/historial` · `/sobre` · `/contacte` (email from env `CONTACT_EMAIL`) · `/webcams` (noindex until cameras exist) · `/estudi` + `/estudi/mapa` (internal, noindex + robots-disallowed, out of the sitemap; shared header `EstudiTop.astro`, `/estudi#resum` opens a template: builds the 1080×1920 social images — forecast text editor, daily summary and rankings — drawn on canvas in `src/scripts/estudi/`, the ranking also as a 1600×900 horizontal image for X; archive data from the static `/estudi-dades.json`, today's data from `/api/ara`).

## Places and zones (Pirineu)
- `src/lib/places.js` = the Cadí places (zona 'cadi', with our stations) + `src/lib/places-pirineu.js` (Cerdanya, Ripollès, Alt Urgell, Solsonès, Pallars, Ribagorça, Aran, Andorra; zona 'pirineu'). Spanish texts: `places-es.js` + `places-pirineu-es.js`. `CADI` is what the footer place list, /muntanya and the weekend page use; `PLACES` is everything.
- Every place has a `region` (`src/lib/regions.js`); each region has a page at `/temps/<region>` and `/es/tiempo/<region>` (`RegionPage.astro`: 48 h chart with the towns as chips, today and tomorrow for every place, ski cards, SCT roads for `areas`).
- Places without a Meteocadí station show the nearest XEMA stations live (`NearbyXema.astro`, from `/api/xema`) and SCT incidents near them (`near` km); Andorra has no SCT data. Place pages link to their region, siblings and the nearest places (`nearbyPlaces`).
- Facts in new intros come from Catalan Wikipedia and official sites; ski figures change every season (`ski.km` approximate, `ski.kmMin` for "més de"): review them before each winter. Don't add claims without a source.
- Titles: places with our station keep the original "ara, previsió per hores i historial" titles; the rest use per-kind titles (town, ski resort, pass). Check duplicates after adding places (all titles and descriptions must be unique).

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
- Colour layer ("Mapa de color", every variable except snow): IDW (power 3) on a 340×290 canvas clipped to the comarques. Temperatures are reduced to sea level with the lapse rate fitted on the same stations and then re-projected on the terrain height from `api/dem.js` (Copernicus DEM via Open-Meteo, 0.04° grid, CDN cache 1 year); without the DEM it falls back to plain IDW. Wind and gust layers are labelled as only indicative. Colour scales (`TSTOP`, `RSTOP`, `WSTOP`, `HSTOP` in `camp.js`) are saturated with a clear hue change every 5 °C; the labels and the legend of both maps use the same scale (`fieldColor`), not `tempColor` (which stays for text on the dark panels of the rest of the site). The comarques' white fill is only drawn when the colour layer is off (it sits above the field and washed it out). An "Intensitat" slider in the legend multiplies each variable's default opacity (0.25–1.6×, the map asks `computeField` for an opaque layer and sets the overlay opacity); remembered in the browser and applied to the downloaded image too.
- Outside Catalonia nothing is shown: a mask polygon (world minus `src/lib/catalunya-contorn.json`, the union of the comarques, static) covers the basemap. The page CSS lifts the global `svg { max-width }` for Leaflet panes, otherwise the mask SVG collapses to 0 px.
- Two versions of the same component (`src/components/CatalunyaMapa.astro`): the public `/mapa/catalunya` (every variable and station mode, but no download at all: the image code is not in its bundle, tiled `meteocadi.cat` watermark between the colour layer and the labels, fixed to the viewport, plus a mark top left; no context menu, hidden when printing; screenshots cannot be blocked in a browser, the watermark is the protection) and the internal `/estudi/mapa` (`internal`: no watermark, exposes `window.__cmap.snapshot()` and the page adds the download buttons and the preview dialog).
- Station selector (top right): "Selecció" (default: labels that would overlap are hidden, so zooming in shows more), all (overlapping ones as dots), "Capitals" (nearest station with data to each comarca capital, ≤ 20 km, list `CAPITALS`) or none (colour only). The downloaded image follows the same mode.
- On mobile (≤ 640 px) the station selector goes above the map and the legend below it (out of the map, so they cover nothing); on wider screens they are map corners (`corner()` moves them on resize).
- The downloaded image follows the zoom: if the web map doesn't show all of Catalonia, the image shows the same area at the same scale (`view` in the snapshot, "cover" framing in a rounded window, labels only if they fit inside, legend below the window).
- Download (only in `/estudi/mapa`): `src/scripts/mapa-imatge.js` (lazy-loaded) draws a 1080×1350 post, a 1080×1920 story or a 1600×900 horizontal image (X, webs; text and legend on the left) on canvas from the same state (variable, station mode, colour layer): only Catalonia, labels decluttered at image scale, legend in the sea corner, data credits (XEMA licence requires them) and meteocadi.cat. Preview dialog with Download and, where the browser supports it, Share.
- Bagà Nord and Bagà Sud are hidden on this map (`HIDDEN_HERE`) so the three Bagà stations don't pile up; Bagà Centre stays.

## Ski (Meteocadí Neu)
- `/esqui` and `/es/esqui` (`SkiHub.astro`): compact cards (`skiCompactHTML`) for every place with a `ski` attribute, grouped by zone, roads on the busiest accesses (`/api/transit?near=lat:lng:km`, max 4 zones) and official links. The full 7-day table (`skiCardsHTML`) is on each resort's own page, with its facts (cotes, km, opening year).
- The header has a highlighted Esquí button (also next to the burger on mobile). The home shows `SKI_HOME` resorts, above the 48 h forecast in season.
- Hub: a Leaflet snow map (7-day snow per resort, labels shrink to number or dot when they overlap) and zone tabs (first zone by default, `#zona` selects one). Cards (`skiCompactHTML`): snow bars per day, resort profile with today's 0 °C level (`skiProfileSVG`). Resort pages: key figures (`skiHeadHTML`) and the 7-day chart of snow and freezing level against the pistes band (`skiChartSVG`), then the detailed table.
- `src/lib/ski.js` rates the weather for skiing (wind at the top, snowfall, rain at the base, sun, cold, heat, fresh snow). It is weather only, never slope status or whether a resort is open; the rating is hidden out of season (15 Nov–30 Apr), `?temporada` forces it for testing.
- Resort facts must be verifiable; the official site of each resort is the reference for opening, snow and prices.

## Navigation
Top menu: El temps (/temps), Mapa (/mapa/catalunya), Estacions, Muntanya, plus the Esquí and Contacte buttons. Radar, Historial, Sobre el projecte and the network map (/mapa) are linked from the home (Explora section), the stations page and the footer.

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
Social images: no logo, only `meteocadi.cat` in the footer. Exception: the studio images of our own stations (ranking, daily summary) say "Xarxa Meteocadí" above the list, because they are posted next to the Catalonia (XEMA) map. The forecast editor capitalises the first letter of each paragraph (`capFirst` in `draw.js`), in the image, the pasted text and the copied text.

Direction "D": photo hero + light/dark alternating sections; data components use the "instrument" style (dark panels, Geist Mono numbers). Fonts self-hosted via Fontsource (Schibsted Grotesk, Geist, Geist Mono). Colors/tokens in `src/styles/global.css`. No emojis; icons are inline SVG or Meteocons (`public/imatges/icones`).

## Security
- The GitHub repo is public: never commit keys or tokens (`.env*` is ignored). Secrets live in Vercel env vars: `WU_API_KEY`, `GITHUB_TOKEN` (fine-grained, this repo only, Contents read/write), `CRON_SECRET`, optional `SOCRATA_APP_TOKEN`, `CONTACT_EMAIL`. The old WU key is still in the code as a fallback (and in the git history): once a new key is set in `WU_API_KEY`, delete the old one at Weather Underground and remove the fallback from `api/ara.js` and `api/arxiva.js`.
- `/api/arxiva` only runs with `Authorization: Bearer $CRON_SECRET` (or, without the variable, only for the Vercel cron, `x-vercel-cron-schedule` header). Never log tokens.
- Functions without parameters (`ara`, `xema`, `comarques`, `dem`) redirect any query string to the clean URL (`api/_net.js`), so nobody can skip the CDN cache and burn the source quotas; `ara` also keeps its last good answer for 5 min in the instance.
- Text from third parties that ends up in `innerHTML` must be escaped or cleaned (`RoadStatus` escapes; `api/xema.js` strips `< > "` from names).
- `vercel.json` sets nosniff, Referrer-Policy, X-Frame-Options / `frame-ancestors 'self'` (no one can frame the site), Permissions-Policy. No full script CSP yet (inline scripts, tiles, fonts, Meteocat radar iframe).
- `/estudi` and `/estudi/mapa` are hidden (noindex, robots) but not password-protected.

## Commands
`npm run dev` · `npm run build` · always finish with `git add . && git commit -m "..." && git push`.
