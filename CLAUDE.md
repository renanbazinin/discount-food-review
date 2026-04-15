# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Hebrew/RTL food ranking app for 10bis main courses. Each browser rates dishes 1–10; the home page shows a live aggregate leaderboard across all users. SvelteKit + MongoDB Atlas, deployed to Vercel.

## Commands

- `npm run dev` — vite dev server
- `npm run build` / `npm run preview` — production build / preview
- `npm run check` — `svelte-kit sync && svelte-check` (the only typecheck/lint step; there is no test suite)
- `npm run scrape` — runs `scripts/scrape.ts` via tsx; regenerates `data/restaurants.json` from 10bis menu endpoints and downloads dish images to `data/images/`. Edit `data/restaurants.config.json` to add restaurant ids before scraping.
- `npm run scrape:append` — same script with `--append`; non-destructive merge that preserves every existing dish (by `dishId`) and only appends newly-listed main courses. Use this instead of `scrape` when you want to pick up new 10bis items without invalidating MongoDB ratings that reference old `dishId`s. Categories `טלבנק` and `GTG` are skipped entirely; any dish name still containing `טלבנק` is skipped too.

Requires `MONGODB_URI` in `.env` (copy from `.env.example`).

## Architecture

**Dish catalog is static, ratings are dynamic.** The catalog of restaurants/dishes is a JSON file (`data/restaurants.json`) that's bundled into the server build via a static import in `src/lib/server/catalog.ts`. This is deliberate — a previous Vercel 500 was caused by runtime fs reads, so do not reintroduce filesystem loads for the catalog. Re-run `npm run scrape` to refresh it.

**MongoDB access** is centralized in `src/lib/server/db.ts`:
- Single cached `MongoClient` per server process (`getCollections()`).
- On first connect it (a) drops the legacy `votes` collection if present — this repo migrated from one-vote to 1–10 star ratings — and (b) ensures a unique index on `{userId, dishId}` plus a `{dishId}` index.
- Only one collection: `ratings` (`{userId, dishId, stars, timestamp}`).

**User identity** is an anonymous UUID generated client-side, stored in localStorage, and sent on every API call as the `x-user-id` header. Server helpers in `src/lib/server/userId.ts` read it. There is no auth.

**API routes** (all under `src/routes/api/`):
- `GET /api/leaderboard` — aggregated avg + count per dish
- `GET /api/ratings` — the caller's own ratings
- `PUT /api/ratings/[dishId]` / `DELETE /api/ratings/[dishId]` — upsert/clear a single rating

**Two rating UX flows** share the same backend:
- `/` — leaderboard; tap a row to rate/change inline
- `/rate` — queue-driven, one dish at a time. Queue ordering lives in `src/lib/stars/queue.ts`: filter out already-rated dishes, demote `DEPRIORITIZED_RESTAURANT_IDS` (e.g. salad bar / "build your own" concepts) to the end, then sort by `popularity` desc, then dish id. Add ids to that set to push a restaurant to the back of the queue.

**Types** flow from `src/lib/types.ts` (shared Dish/Rating/Catalog shapes) and `src/lib/catalog/load.ts` (`LoadedCatalog` wrapper with `allDishes()`).

## OpenSpec workflow

Design docs and change proposals live under `openspec/` (proposal → design → specs → tasks → implementation). Consult existing changes there for context on why something is shaped the way it is before large refactors.
