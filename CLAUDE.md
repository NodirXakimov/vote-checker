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
