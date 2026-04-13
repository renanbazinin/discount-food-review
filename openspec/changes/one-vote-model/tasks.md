## 1. User-action prerequisites (must complete before end-to-end tests)

- [ ] 1.1 Atlas console → Database Access → Add New Database User: password auth, username `food-ranking-app`, autogenerate and save the password, "Read and write to any database" privileges
- [ ] 1.2 Atlas console → Network Access → Add IP Address → "Allow Access from Anywhere" (`0.0.0.0/0`) for dev
- [ ] 1.3 Create `.env` at the project root (already gitignored) with `MONGODB_URI=mongodb+srv://food-ranking-app:<PASSWORD>@cluster0.rsn8ez5.mongodb.net/food-ranking?retryWrites=true&w=majority&appName=Cluster0`
- [ ] 1.4 Confirm `.env` is not listed by `git status`

## 2. Demolish the old surfaces

- [x] 2.1 Delete `src/routes/rate/` (the star-rating flow)
- [x] 2.2 Delete `src/routes/game/` and `src/routes/game/results/` (the pairwise game + results)
- [x] 2.3 Delete `src/lib/stars/` directory (the rating queue module)
- [x] 2.4 Delete `src/lib/ranking/` directory (`elo.ts`, `rate.ts`, `pair-select.ts`)
- [x] 2.5 Delete `src/lib/stores/ratings-store.ts`, `src/lib/stores/local-storage-store.ts`, `src/lib/stores/stars-store.ts`, `src/lib/stores/local-storage-stars-store.ts`
- [x] 2.6 Delete `src/lib/ui/DishCard.svelte`, `src/lib/ui/StarSelector.svelte`, `src/lib/ui/BottomTabBar.svelte`, `src/lib/ui/NavButton.svelte`
- [x] 2.7 Delete the old `src/routes/+page.svelte` (will be rewritten in group 5)
- [x] 2.8 Grep the `src/` tree to confirm no remaining imports reference any deleted module

## 3. Adapter and dependency swap

- [x] 3.1 In `package.json` remove `@sveltejs/adapter-static` and add `@sveltejs/adapter-node` (^5) plus `mongodb` (^6)
- [x] 3.2 Run `npm install`
- [x] 3.3 Edit `svelte.config.js`: replace the static-adapter import and call with `import adapter from '@sveltejs/adapter-node'` and `adapter: adapter()`; keep `kit.files.assets = 'data'`
- [x] 3.4 Edit `src/routes/+layout.ts`: remove `export const prerender = true` and keep `export const ssr = false`
- [x] 3.5 Edit `src/routes/+layout.svelte`: remove the `<BottomTabBar />` mount and remove the bottom-safe-area padding wrapper; it becomes a minimal layout that just renders the page slot and imports `app.css`

## 4. Environment configuration

- [x] 4.1 Create `.env.example` at the project root with a placeholder `MONGODB_URI=...` and a one-line comment pointing at the Atlas console setup steps
- [x] 4.2 Confirm `.gitignore` already excludes `.env*`

## 5. Server: DB module + API routes

- [x] 5.1 Create `src/lib/server/db.ts`: read `MONGODB_URI` via `$env/static/private`, construct a lazy singleton `MongoClient`, select database `food-ranking`, expose `getCollections(): Promise<{ votes }>`
- [x] 5.2 Implement `ensureIndexes(db)` in the same file, creating `votes({ dishId: 1 })` and `votes({ voteId: 1 }, { unique: true })`; call it in the first-init path
- [x] 5.3 Define the `VoteDoc` type in the same file: `{ _id: ObjectId, voteId: string, dishId: string, timestamp: number }`
- [x] 5.4 Create a small server-side catalog loader at `src/lib/server/catalog.ts` that reads `data/restaurants.json` from the filesystem once at module load and exposes a `hasDish(dishId: string): boolean` predicate for validation
- [x] 5.5 Create `src/routes/api/leaderboard/+server.ts` with a `GET` handler that calls `getCollections()`, runs `votes.aggregate([{ $group: { _id: '$dishId', count: { $sum: 1 } } }]).toArray()`, normalizes to `[{ dishId, count }]`, and returns it as JSON with `200`
- [x] 5.6 Create `src/routes/api/votes/+server.ts` with a `POST` handler that: validates the body (`dishId` required, known via `hasDish`); if `oldVoteId` present, issues `votes.deleteOne({ voteId: oldVoteId })`; generates a new `voteId` via `crypto.randomUUID()`; inserts the new doc with server-set `timestamp`; returns `201` with the new `{ voteId, dishId, timestamp }`
- [x] 5.7 Create `src/routes/api/votes/[voteId]/+server.ts` with a `DELETE` handler that calls `votes.deleteOne({ voteId })` and returns `204` regardless of `deletedCount`
- [x] 5.8 In every handler, wrap Mongo calls in a try/catch that maps connect failures to `503 { error: 'Database unreachable' }` and other errors to `500 { error: string }`
- [x] 5.9 In every handler, validation failures return `400 { error: string }`

## 6. Client: VotesStore interface + HTTP adapter

- [x] 6.1 Create `src/lib/stores/votes-store.ts` with the interface `VotesStore` and the supporting types `VoteCount` and `MyVote`
- [x] 6.2 Create `src/lib/stores/http-votes-store.ts` implementing `HttpVotesStore`:
  - `getLeaderboard()` → `fetch('/api/leaderboard')`
  - `getMyVote()` → sync `localStorage.getItem('vote:v1')` parse with shape validation, returns `null` on malformed or missing
  - `vote(dishId)` → reads current from `getMyVote()`; `fetch('/api/votes', { method: 'POST', body: JSON.stringify({ dishId, oldVoteId: current?.voteId }) })`; on success writes the returned `MyVote` to localStorage
  - `unvote()` → reads current from `getMyVote()`; if none, resolves immediately; otherwise `fetch('/api/votes/{voteId}', { method: 'DELETE' })`; on success removes the localStorage entry
- [x] 6.3 Throw `Error` with status and body on non-2xx responses; do NOT update localStorage on failure
- [x] 6.4 Export module-level singleton `votesStore: VotesStore = new HttpVotesStore()`

## 7. Types and UI components

- [x] 7.1 Trim `src/lib/types.ts` to `Dish`, `Restaurant`, `CatalogDataset`, `VoteCount`, `MyVote` (remove `MatchEvent`, `StarRating`, `Rating`, `OrderMethod` if not referenced; keep `OrderMethod` if it's still a field on `Dish`)
- [x] 7.2 Create `src/lib/ui/VoteCard.svelte` — the hero component. Props: `{ dish: Dish; count: number; onChange: () => void }`. Renders image (or typographic fallback), name, restaurant, price, count with label `הצביעו`, and the badge `הבחירה שלך`. Tappable → calls `onChange`
- [x] 7.3 Create `src/lib/ui/DishRow.svelte` — compact leaderboard row. Props: `{ rank: number | null; dish: Dish; count: number; isMyVote: boolean; onPick: () => void }`. Rank position, small image, name, restaurant+price, count, highlight border when `isMyVote`. Tappable → calls `onPick`

## 8. Rewrite `/` as the single-screen vote home

- [x] 8.1 Create the new `src/routes/+page.svelte` that loads the catalog, calls `votesStore.getLeaderboard()`, and reads `votesStore.getMyVote()` synchronously on mount
- [x] 8.2 Compose a `counts: Map<string, number>` derived from the leaderboard response, defaulting to 0 for dishes not in the response
- [x] 8.3 Render the loading skeleton (hero + 5 rows) while the leaderboard is loading
- [x] 8.4 Render the `VoteCard` hero when `myVote` is non-null, or the empty-state illustration + headline + hint when `null`
- [x] 8.5 Render the "voted" section: dishes with `counts[id] > 0`, sorted by count desc then popularity desc, each row via `DishRow` with `isMyVote` set when the dish matches `myVote.dishId`
- [x] 8.6 Render the "unvoted" section: dishes with `counts[id] === 0`, sorted by popularity desc, each row via `DishRow` with muted styling, under the divider `מנות שעדיין לא הצביעו · {N}`
- [x] 8.7 Wire `onPick(dishId)`:
  - Immediately optimistic: update `counts` (`counts[dishId]++`, and `counts[myVote.dishId]--` if changing), update `myVote` to a temporary `{ voteId: '', dishId, timestamp: Date.now() }` so the hero re-renders
  - Call `votesStore.vote(dishId)` in the background; on success replace `myVote` with the server-returned record; on failure revert the optimistic changes and show an error banner
- [x] 8.8 Wire the "tap current vote to unvote" path on the hero: call `votesStore.unvote()` with the same optimistic pattern
- [x] 8.9 Apply the friendly copy verbatim: `הבחירה שלך`, `הצביעו`, `עדיין לא הצבעת`, `בחר את המנה הכי טובה מהרשימה למטה`, divider label, error banner

## 9. Verification

- [x] 9.1 `npm run check` passes with 0 errors and 0 warnings
- [x] 9.2 With a dummy `MONGODB_URI` in `.env`, `npm run build` completes successfully
- [x] 9.3 Search the production client bundle under `build/client/` for the literal `MONGODB_URI` value: it MUST NOT appear
- [x] 9.4 With a dummy URI, `npm run dev` boots, the home route renders the loading skeleton, and the first `GET /api/leaderboard` returns `503` (expected — the dummy URI can't connect)
- [x] 9.5 Automated check: construct a mocked `HttpVotesStore`, confirm `getMyVote()` is synchronous and returns `null` for missing / malformed storage, and that `vote()` writes the correct localStorage shape
- [x] 9.6 With a real `MONGODB_URI` in `.env`, `npm run dev` boots and `GET /api/leaderboard` returns `200 []` for a fresh database
- [x] 9.7 End-to-end: open `/`, see the empty state, tap a dish row, confirm the hero updates, reload, confirm the vote persists
- [x] 9.8 End-to-end: change vote by tapping a different dish row, confirm the old dish's count decrements, the new dish's count increments, and the hero updates
- [x] 9.9 End-to-end: tap the hero (current vote) to unvote, confirm the empty state returns and the dish's count decrements
- [x] 9.10 End-to-end: from a second browser (or incognito), open `/`, see the shared leaderboard reflecting the first browser's votes, cast a different vote, confirm the first browser sees both on reload
- [ ] 9.11 Manual pass: confirm the app has exactly one route by navigating to `/rate`, `/game`, `/ranking` and seeing the SvelteKit fallback (not a custom page)
- [ ] 9.12 Manual pass: confirm no bottom tab bar is present anywhere in the UI
