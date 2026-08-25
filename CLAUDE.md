# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm install        # Install dependencies
npm run dev        # Dev server at http://localhost:3000
npm run build      # Type-check + production build
npm run build-only # Production build without type-check
npm run type-check # Run vue-tsc type checking only
npm run preview    # Preview production build
npm run deploy     # Deploy dist/ to GitHub Pages (gh-pages)
```

No test runner is configured.

## Architecture

Vue 3 + TypeScript SPA built with Vite, deployed to GitHub Pages at `/vote-checker/`.

- **Router**: Uses `createWebHistory` (clean URLs, no `#`). GitHub Pages has no
  server-side routing, so `build-only` copies `dist/index.html` to `dist/404.html`;
  GH Pages serves that for unknown paths and the router resolves them client-side.
  Do not switch to hash history — the `/#/` URLs were rejected.
- **Pages**: New routes go in `src/pages/` as `.vue` files and are registered in `src/router/index.ts` using lazy imports (`() => import('@/pages/...')`).
- **Path alias**: `@` resolves to `src/`.
- **Base URL**: Vite is configured with `base: '/vote-checker/'` — all asset paths are prefixed accordingly.
- **Dead code**: `index.html` has a `sessionStorage.getItem('redirect')` block from
  the *other* GH Pages SPA pattern. Nothing writes that key (our `404.html` is a
  plain copy of `index.html`), so it never fires. Harmless; left in place.

## Data model

Supabase, table `votes`. There is **no `initiatives` table** and no foreign keys —
`initiative_id` is free-form `text`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | bigint | |
| `phone_number` | text | dash-separated digit pairs, e.g. `90-12-34-56` |
| `vote_date` | timestamp **without** time zone | |
| `created_at` | timestamp without time zone | nullable |
| `initiative_id` | text | not null |

Sibling tables `votes_origin` and `votes_2026_1` also exist and are anon-readable.

- **One deployment = one initiative.** `VITE_INITIATIVE_ID` filters every query.
  Any new query against `votes` must include `.eq('initiative_id', INITIATIVE_ID)`
  — including count/aggregate queries, or the totals won't match the rows shown.
- Since there is no initiatives table to join, the header subtitle comes from
  `VITE_INITIATIVE_NAME`.
- `vote_date` has no time zone, so `new Date(value)` resolves in the *viewer's*
  local zone. Not currently pinned to `Asia/Tashkent`.

## Environment

All four vars are build-time inlined by Vite, so **changing any of them requires a
rebuild and redeploy**. `.env` is gitignored — the machine that builds needs it.

| Variable | Required | Guard |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | yes | throws in `src/lib/supabase.ts` |
| `VITE_SUPABASE_ANON_KEY` | yes | throws in `src/lib/supabase.ts` |
| `VITE_INITIATIVE_ID` | yes | throws in `src/lib/config.ts` |
| `VITE_INITIATIVE_NAME` | no | falls back to hardcoded subtitle |

Missing vars throw loudly on purpose — a silently absent `INITIATIVE_ID` would
publish every initiative's votes. Types live in `env.d.ts`; add new vars there.

## Stats page (`/stats`)

Reads **aggregate views only**, never `votes` directly — `db/stats.sql` creates
them and must be run in Supabase before the page works (it shows a pointed error
if the views are missing).

| View | Feeds |
| --- | --- |
| `vote_stats_hourly` | cumulative line, daily-rate bars (client rolls hours→days) |
| `vote_stats_totals` | collected counts |
| `initiative_info` | labels, `total_elements`, `is_initial_done` |

- Views run `security_invoker = off` on purpose: they bypass RLS so aggregates stay
  public for every initiative while raw rows stay locked to ours.
- **`count(*)` on `votes` understates any initiative still being scraped.**
  `scrape_state.total_elements` is the true population; `is_initial_done` says
  whether `votes` has caught up. Charts show total with a collected-so-far overlay
  and an explicit "still loading" notice. Never present `count(*)` as a final
  standing — as of 2026-08-25 that would have shown 240–224 instead of 428–224.
- History is **retroactive**: the scraper backfills older pages, so past buckets
  grow for in-progress initiatives.
- Charts are Chart.js + vue-chartjs, lazy-loaded with the route (Рақамлар's chunk
  is unaffected). Ranking bars are plain HTML, not a chart, so values are labeled.
- Series colors live in `src/lib/palette.ts` — a validated 8-hue categorical set.
  Slots are pinned to `initiative_id` (sorted), never to rank, so re-sorting never
  repaints a series. Never add a 9th hue; fold the tail into `OTHER_COLOR`.
  Three slots fall below 3:1 contrast on white, which is why direct labels and the
  table view are mandatory relief, not decoration.

## Security

This app displays **real personal phone numbers**.

- The anon key ships in the client bundle. RLS on `votes` is the only access
  control. As of this writing the policy is `using (true)` — world-readable across
  every initiative — so the `VITE_INITIATIVE_ID` filter is presentation only, not
  isolation. README documents the policy that would actually restrict it.
- **Never render database text with `v-html`.** `CheckerPage.vue` previously did
  this for search highlighting; it now uses `highlightParts()`, which returns
  `{ text, match }` segments the template renders as real `<mark>` elements via
  `{{ }}`. Keep it that way.

## Conventions

- **Search matching**: phone numbers are stored as dash-separated pairs, so a typed
  substring can begin on an even or odd offset. `phoneQueryCandidates()` builds both
  alignments (`"1234"` → `["12-34", "1-23-4"]`) and queries with `.or(...ilike...)`.
  A normalized digits-only generated column would be the better long-term fix.
- **Async fetches** guard against races with a `requestId` counter — a response is
  discarded if a newer request started. Follow this in any new fetch.
- **Supabase errors** are surfaced to the user (`errorMsg`), never silently swallowed.
- **Mobile breakpoint is 600px**, used consistently across components.
- On mobile the nav is `position: absolute` and out of flow, which is what lets the
  burger button share a row with each page's `<h1>`. A new page's `h1` needs the
  matching mobile rule (`min-height: 40px`, flex centering, `padding: 0 48px`) to
  line up with it.
- Colors are consistent across components: `#2563eb` accent/active, `#6b7280` muted
  text, `#e5e7eb`/`#d1d5db` borders, white cards with soft shadows.
