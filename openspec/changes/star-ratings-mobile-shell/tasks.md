## 1. Demolish the one-vote surface

- [x] 1.1 Delete `src/lib/stores/votes-store.ts` and `src/lib/stores/http-votes-store.ts`
- [x] 1.2 Delete `src/lib/ui/VoteCard.svelte` and `src/lib/ui/DishRow.svelte`
- [x] 1.3 Delete `src/routes/api/votes/+server.ts` and `src/routes/api/votes/[voteId]/+server.ts`
- [x] 1.4 Delete the old `src/routes/api/leaderboard/+server.ts` (will be rewritten against `ratings`)
- [x] 1.5 Delete the old `src/routes/+page.svelte` (will be rewritten as home-leaderboard-with-inline-rate)
- [x] 1.6 Grep the `src/` tree to confirm no remaining references to the deleted modules

## 2. Database: switch from votes to ratings

- [x] 2.1 Rewrite `src/lib/server/db.ts`: `VoteDoc` becomes `RatingDoc { _id, userId, dishId, stars, timestamp }`; `getCollections()` exposes `{ ratings }` instead of `{ votes }`
- [x] 2.2 Update `ensureIndexes()` to create `ratings({ userId: 1, dishId: 1 }, { unique: true })` and `ratings({ dishId: 1 })`
- [x] 2.3 Inside the first-init path, attempt `db.collection('votes').drop()` inside a try/catch that swallows "collection not found" errors (namespace not found code 26)
- [x] 2.4 Remove any reference to the `votes` collection from TypeScript types and imports

## 3. Server: user id resolver

- [x] 3.1 Create `src/lib/server/userId.ts` exporting `getUserId(event: RequestEvent): string`
- [x] 3.2 Read the `x-user-id` request header; if missing, empty, or not a non-empty string of reasonable length (≤ 256), throw SvelteKit's `error(400, 'Missing or invalid x-user-id header')`
- [x] 3.3 Return the validated id

## 4. Server: ratings + leaderboard API routes

- [x] 4.1 Create `src/routes/api/leaderboard/+server.ts` with a `GET` handler that calls `getUserId(event)` (to enforce the header requirement), then runs `ratings.aggregate([{ $group: { _id: '$dishId', averageStars: { $avg: '$stars' }, ratingCount: { $sum: 1 } } }])` and normalizes to `[{ dishId, averageStars, ratingCount }]`
- [x] 4.2 Create `src/routes/api/ratings/+server.ts` with a `GET` handler that calls `getUserId(event)` and returns `ratings.find({ userId }).project({ _id: 0, userId: 0 }).toArray()` as `[{ dishId, stars, timestamp }]`
- [x] 4.3 Create `src/routes/api/ratings/[dishId]/+server.ts` with a `PUT` handler that validates `stars` is integer in `[1, 10]`, validates `dishId` via `hasDish`, calls `getUserId(event)`, and upserts with `ratings.updateOne({ userId, dishId }, { $set: { stars, timestamp: Date.now() } }, { upsert: true })`; returns `200` with `{ dishId, stars, timestamp }`
- [x] 4.4 Add a `DELETE` handler in the same file that calls `ratings.deleteOne({ userId, dishId })` and returns `204`
- [x] 4.5 In every handler, wrap Mongo calls in try/catch, map connect failures to `503`, validation failures to `400`, everything else to `500`

## 5. Client: RatingsStore interface + HTTP adapter

- [x] 5.1 Create `src/lib/stores/ratings-store.ts` defining the `RatingsStore` interface and the `RatingAggregate` and `MyRating` supporting types
- [x] 5.2 Create `src/lib/stores/http-ratings-store.ts` implementing `HttpRatingsStore`:
  - internal `getUserId()` helper that reads/creates the `user:v1` localStorage UUID (shape-validate, regenerate on invalid)
  - internal `fetchJson(url, init?)` helper that injects `x-user-id` header, parses JSON, throws on non-2xx
  - `getLeaderboard()` → `GET /api/leaderboard`
  - `getMyRatings()` → `GET /api/ratings`
  - `rate(dishId, stars)` → `PUT /api/ratings/<dishId>` with body `{ stars }`
  - `clear(dishId)` → `DELETE /api/ratings/<dishId>`
- [x] 5.3 Export module-level `ratingsStore: RatingsStore = new HttpRatingsStore()` singleton

## 6. Types

- [x] 6.1 Edit `src/lib/types.ts`: remove `VoteCount` and `MyVote`; add `RatingAggregate` and `MyRating` matching the interface definitions in the store
- [x] 6.2 Keep `Dish`, `Restaurant`, `CatalogDataset`, `OrderMethod` untouched

## 7. Reinstated UI primitives

- [x] 7.1 Re-create `src/lib/stars/queue.ts` with `getQueue(catalog, myRatings)` returning dishes the user hasn't rated, sorted by `popularity` desc then `id` asc; `getNext(catalog, myRatings, skipped)` picking the first queue entry not in the session skip set
- [x] 7.2 Re-create `src/lib/ui/StarSelector.svelte` — 10 pill buttons `1`–`10` emitting `onSelect(stars)`, supporting an optional `current` prop to highlight the current value
- [x] 7.3 Create `src/lib/ui/BottomTabBar.svelte` with two tabs (home `/`, rate `/rate`), inline SVG icons (trophy for home, star for rate), active state via `$page.url.pathname`, re-tap-scroll-to-top, safe-area padding, constrained to the same max-width as the content
- [x] 7.4 Create `src/lib/ui/RatingRow.svelte` — leaderboard row component: rank (with medal for top 3), image (or typographic fallback), name, restaurant, price, `averageStars` (1 decimal) + `(מתוך N)`, user's own star (or muted indicator). Tap → expand inline

## 8. Layout: responsive shell + tab bar mount

- [x] 8.1 Rewrite `src/routes/+layout.svelte`: imports `app.css` and `BottomTabBar`; wraps `{@render children()}` in a `<div class="mx-auto w-full max-w-[520px] pb-[calc(env(safe-area-inset-bottom)+88px)]">`; mounts `<BottomTabBar />` below the content
- [x] 8.2 Keep `ssr = false` in `+layout.ts`; no `prerender`

## 9. Home route `/`

- [x] 9.1 Create the new `src/routes/+page.svelte` loading catalog + `ratingsStore.getLeaderboard()` + `ratingsStore.getMyRatings()` in parallel on mount
- [x] 9.2 Compute a `counts: Map<dishId, RatingAggregate>` from the leaderboard response and a `myRatings: Map<dishId, MyRating>` from my-ratings
- [x] 9.3 Render loading skeleton (hero + 5 list rows) while any load is pending
- [x] 9.4 Render the hero: if the user has ratings, pick their top-rated dish (stars desc then timestamp desc); if they don't but leaderboard has entries, pick the global leader with the `מה שכולם אוהבים הכי הרבה` label; if both are empty, render the bowl-illustration empty state
- [x] 9.5 Wire tap on hero → expand inline `StarSelector` + clear button, same editor pattern as rows
- [x] 9.6 Render the rated leaderboard list: all dishes with `ratingCount > 0`, sorted by `averageStars` desc then `ratingCount` desc then `popularity` desc, each row via `RatingRow`, top 3 get medals
- [x] 9.7 Render the unrated section: dishes with zero ratings, sorted by `popularity` desc, under divider `מנות שעדיין לא דורגו · {N}`, muted styling, also tappable for inline rate
- [x] 9.8 Implement tap-to-expand: tapping a row toggles an `openId` state; the expanded row shows `StarSelector` + clear control
- [x] 9.9 Implement optimistic `onRate(dishId, stars)`: compute the exact `averageStars` / `ratingCount` / `myRatings` locally via the formulas in design.md; call `ratingsStore.rate(dishId, stars)` in the background; on success fetch `getLeaderboard()` to reconcile; on failure revert to pre-action state and show error banner
- [x] 9.10 Implement optimistic `onClear(dishId)`: mirror the above with the clear formula
- [x] 9.11 Apply warm Hebrew copy: `המנה האהובה שלך`, `מה שכולם אוהבים הכי הרבה`, `הדירוג של כולם`, `(מתוך N)`, `לא דירגת`, `מנות שעדיין לא דורגו · {N}`, error banner `משהו השתבש — נסה שוב`

## 10. Rate route `/rate`

- [x] 10.1 Create `src/routes/rate/+page.svelte` loading catalog + `ratingsStore.getMyRatings()` on mount
- [x] 10.2 Compute the queue via `getNext(catalog, myRatings, sessionSkipped)` where `sessionSkipped` is a session-local `Set<string>`
- [x] 10.3 Render loading skeleton while loading
- [x] 10.4 Render the current dish as a large card (image or typographic fallback), with name, restaurant, price, and the `StarSelector` below
- [x] 10.5 Show progress counter `{rated} / {total}` in the header
- [x] 10.6 Wire tapping a star → `ratingsStore.rate(dishId, stars)`; on success push `dishId` onto a session undo stack and advance to the next queued dish; on failure show an error banner and stay on the same dish
- [x] 10.7 Wire `אולי אחר כך` (skip) to add the dish to `sessionSkipped` and advance without a network call
- [x] 10.8 Wire `חזור אחורה` (undo) to pop the session undo stack, call `ratingsStore.clear(lastDishId)`, and show that dish again
- [x] 10.9 All-done state when the queue is empty: 🎉 headline, warm message, link to `/`
- [x] 10.10 Bind keyboard shortcuts on `(pointer: fine)` devices: `1`-`9` → rate 1-9, `0` → rate 10, `Space` → skip, `Backspace` → undo
- [x] 10.11 Apply copy polish: `מה דעתך?`, `אולי אחר כך`, `חזור אחורה`, `הכל דורג! יפה מאוד.`

## 11. Verification

- [x] 11.1 `npm run check` passes with 0 errors and 0 warnings
- [x] 11.2 `npm run build` completes successfully against adapter-node
- [x] 11.3 Grep the production client bundle for `adminall` and `mongodb+srv` — neither string must appear
- [x] 11.4 With a real `MONGODB_URI`, dev server boots and `GET /api/leaderboard` returns `200 []` for a fresh browser (with `x-user-id` header)
- [x] 11.5 Automated end-to-end smoke test via curl with a synthetic `x-user-id`:
  - `PUT /api/ratings/<known-dish>` with `{"stars":7}` → 200 upsert
  - `GET /api/leaderboard` → contains that dish with average 7, count 1
  - `PUT /api/ratings/<same-dish>` with `{"stars":4}` → 200 update
  - `GET /api/leaderboard` → same dish with average 4, count 1
  - `DELETE /api/ratings/<same-dish>` → 204
  - `GET /api/leaderboard` → dish absent
- [x] 11.6 Automated end-to-end multi-user smoke test:
  - user A rates dish X as 8 → server records
  - user B (different `x-user-id`) rates dish X as 6 → server records
  - `GET /api/leaderboard` → dish X with average 7, count 2
  - `GET /api/ratings` with user A header → returns only A's rating
  - `GET /api/ratings` with user B header → returns only B's rating
- [ ] 11.7 Manual pass in a browser: open `/`, tap a leaderboard row, rate it, confirm the average and user-star update optimistically; refresh, confirm persistence
- [ ] 11.8 Manual pass: open `/rate`, rate a few dishes, confirm queue advances, confirm undo works
- [ ] 11.9 Manual pass: open the app on a narrow mobile viewport (~360px) and on a wide desktop viewport (~1440px); confirm the tab bar, hero, and list render cleanly at both widths, with the desktop content centered in a phone-shape column
- [ ] 11.10 Manual pass: confirm the bottom tab bar is visible and sticky on both routes, active tab highlights correctly, scroll-to-top on re-tap works on `/`
