## 1. Stars store

- [x] 1.1 Add `StarRating` type to `src/lib/types.ts` with fields `dishId: string`, `stars: number`, `timestamp: number`
- [x] 1.2 Define the `StarsStore` interface in `src/lib/stores/stars-store.ts` with fully-async methods: `list`, `get`, `set`, `clear`, `clearAll`, `export`, `import`
- [x] 1.3 Implement `LocalStorageStarsStore` in `src/lib/stores/local-storage-stars-store.ts` under the key `stars:v1`, storing as `Record<dishId, StarRating>`
- [x] 1.4 Validate `set(dishId, stars)` rejects non-integers and values outside `[1, 10]`
- [x] 1.5 Validate `import(json)` rejects malformed payloads without touching the existing state
- [x] 1.6 Export a single module-level `starsStore` accessor so components never touch `localStorage` directly

## 2. Rating queue

- [x] 2.1 Create `src/lib/stars/queue.ts` exporting `getQueue(catalog, ratings)` returning dishes with no star rating, sorted by `popularity` descending then `id` ascending
- [x] 2.2 Expose `getNext(catalog, ratings, skippedInSession)` helper that picks the next queued dish excluding any ids in the session-skip set

## 3. Relocate the pairwise game

- [x] 3.1 Create `src/routes/game/+page.svelte` by moving the entire current `src/routes/+page.svelte` file verbatim
- [x] 3.2 Update the top-end navigation control on `/game` from its current link (ranking) to a pair: back-home (`/`) and results (`/game/results`)
- [x] 3.3 Delete the old `src/routes/+page.svelte` (it will be recreated for the star flow in group 4)

## 4. Star-rating home route

- [x] 4.1 Create the new `src/routes/+page.svelte` star-rating flow scaffolding that loads the catalog and the current ratings from `starsStore`
- [x] 4.2 Implement `StarSelector.svelte` component with 10 pill buttons emitting `select(stars)` events
- [x] 4.3 Render the current queued dish using the existing `DishCard` component in a single-card layout (not the side-by-side pairwise layout)
- [x] 4.4 Wire tapping a star to `starsStore.set(dish.id, stars)`, push onto the session undo stack, then advance to the next queued dish with a fade transition
- [x] 4.5 Implement "skip" that advances without recording, keeping the skipped dish in the queue for future sessions (session-local skip set only)
- [x] 4.6 Implement session undo that pops the last rating from the session stack, calls `starsStore.clear(dishId)`, and returns the flow to that dish
- [x] 4.7 Implement the "all done" state shown when `getQueue()` is empty, with links to `/ranking` and `/game`
- [x] 4.8 Add the progress counter `rated / total` in the header area
- [x] 4.9 Bind keyboard shortcuts on `(pointer: fine)` devices: digits `1`-`9` rate 1-9, `0` rates 10, `Space` skips, `Backspace` undoes
- [x] 4.10 Add top-chrome navigation controls: start-side link to `/ranking`, end-side link to `/game`

## 5. Star-based leaderboard at `/ranking`

- [x] 5.1 Rewrite `src/routes/ranking/+page.svelte` to render the star-based leaderboard instead of the Elo leaderboard
- [x] 5.2 Load `starsStore.list()` and the catalog, join them into rated rows sorted by `stars` descending with a stable tiebreaker on `timestamp` descending
- [x] 5.3 Render the rated section above a labeled divider and an unrated section below with every catalog dish that has no rating
- [x] 5.4 Implement the inline `StarEditor` that expands when a rated row is tapped, showing the 1-10 selector and a "clear rating" control
- [x] 5.5 Wire `StarEditor` selection to `starsStore.set()` and clearing to `starsStore.clear()`, re-sorting the list on change
- [x] 5.6 Replace the existing Elo export/import buttons with star export/import buttons calling `starsStore.export()` / `starsStore.import()`
- [x] 5.7 Update the back control to point to `/` (home), and add a secondary link to `/game/results` for users who want the game leaderboard

## 6. Game results at `/game/results`

- [x] 6.1 Create `src/routes/game/results/+page.svelte` by copying the original Elo-rendering logic from the pre-change `/ranking/+page.svelte` (uses `deriveRatings` from `ratingsStore` events and the catalog)
- [x] 6.2 Render the confident / under-sampled split by match count with a labeled divider
- [x] 6.3 Keep the existing `ratingsStore.export()` / `ratingsStore.import()` controls on this route
- [x] 6.4 Add a top-end back control linking to `/game`

## 7. Shared navigation components

- [x] 7.1 Extract a reusable `NavButton.svelte` used by all four routes (`/`, `/ranking`, `/game`, `/game/results`) with consistent pill styling to avoid drift
- [x] 7.2 Update all four routes to use `NavButton` for their header chrome

## 8. Verification

- [x] 8.1 Type check passes: `npm run check` with 0 errors and 0 warnings
- [x] 8.2 Production build passes: `npm run build` completes successfully
- [x] 8.3 Automated check: after `starsStore.set` of valid integer 1–10 values, `list()` length equals the number of unique dish ids set
- [x] 8.4 Automated check: `starsStore.set` rejects `0`, `11`, `7.5`, and non-number inputs
- [x] 8.5 Automated check: rating queue returns the highest-popularity unrated dish first and omits rated dishes
- [ ] 8.6 Manual pass: open `/`, confirm a popular unrated dish is shown, tap a star, confirm advance
- [ ] 8.7 Manual pass: open `/ranking`, confirm star-sorted list, tap a row to re-rate and to clear
- [ ] 8.8 Manual pass: open `/game`, confirm pairwise comparison unchanged and twin-pair filter still active
- [ ] 8.9 Manual pass: open `/game/results`, confirm Elo leaderboard renders and is unaffected by star ratings
- [ ] 8.10 Manual pass: verify the two stores are independent — clearing stars does not change `/game/results`, and clearing the event log does not change `/ranking`
