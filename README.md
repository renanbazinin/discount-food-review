# food-review-discount

A shared Hebrew/RTL food ranking app for 10bis main courses. Each browser rates dishes 1–10 and sees a live aggregate leaderboard across all users. Built on SvelteKit + MongoDB Atlas.

## Stack

- **SvelteKit** with `@sveltejs/adapter-auto` (deploys to Vercel out of the box)
- **MongoDB Atlas** via the native `mongodb` Node driver
- **Tailwind CSS** with RTL logical properties
- Dish catalog scraped from 10bis public menu endpoints — see `scripts/scrape.ts`

## Routes

- `/` — aggregate leaderboard, tap any row to rate/change inline
- `/rate` — queue-driven 1-dish-at-a-time rating flow
- `/api/leaderboard` — `GET` aggregated average + count per dish
- `/api/ratings` — `GET` caller's own ratings
- `/api/ratings/[dishId]` — `PUT` upsert, `DELETE` clear

All API routes require an `x-user-id` header (anonymous UUID generated client-side and stored in localStorage).

## Local development

```bash
npm install
cp .env.example .env
# fill in MONGODB_URI
npm run dev
```

## Scraping new restaurants

Edit `data/restaurants.config.json` to add more 10bis restaurant ids, then:

```bash
npm run scrape
```

Regenerates `data/restaurants.json` and downloads any new dish images to `data/images/`.

## Project history

Design docs, change proposals, and specs live under `openspec/`. The OpenSpec workflow tracks each change as proposal → design → specs → tasks → implementation.
