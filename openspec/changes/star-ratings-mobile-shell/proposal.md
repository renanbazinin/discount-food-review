## Why

The app shipped one-vote-per-user with a Mongo backend. The user has now decided that a single forced-choice vote is too blunt — they want the richer 1–10 per-dish rating back — but they want to keep the Mongo-backed shared data model, and they want the whole app to finally feel like a real mobile application (fully responsive on any width, bottom tab bar with proper icons, inline interactions, no jank). They also want the home leaderboard itself to be a *voting surface*, not just a read-only display — tapping any dish row on the leaderboard should open the star selector right there, so you can adjust ratings you care about without leaving the page. The separate rate flow still exists as the fast path for working through dishes you've never touched.

The motivation is to combine the best of everything we've built so far: the warm friendly UI, the Mongo backend that already works, the per-dish 1–10 scale, and a genuinely native-feeling shell.

## What Changes

- **Data model swap.** The `votes` collection (anonymous single-pick) is abandoned. A new `ratings` collection stores per-browser per-dish 1–10 star ratings. Documents have the shape `{ userId, dishId, stars, timestamp }` with a unique compound index on `(userId, dishId)` so writes are atomic upserts.
- **Anonymous browser identity.** On first load, the client generates a UUID and stores it under `user:v1` in localStorage. Every API request sends it in an `x-user-id` header. This is the same honor-system model as before — clear site data or open incognito to get a new identity — acceptable for the friends-and-family audience.
- **Aggregate leaderboard.** `/api/leaderboard` returns `[{ dishId, averageStars, ratingCount }]` computed via a Mongo `$group` aggregation across all users. Home displays dishes sorted by `averageStars` descending, with a minimum-count tiebreaker so a single 10-star rating can't trivially top the leaderboard.
- **Per-user rating retrieval.** `/api/ratings` (GET) returns the calling browser's own ratings as `[{ dishId, stars, timestamp }]` so the home screen can render "your rating" on every row.
- **Per-user upsert and clear.** `PUT /api/ratings/[dishId]` with body `{ stars }` upserts the rating for the caller; `DELETE /api/ratings/[dishId]` clears it.
- **Inline rate on the leaderboard.** Tapping any row on the home screen expands the row inline to reveal the 10-star selector and a "clear rating" control. Same pattern as the earlier `star-rating-home` `/ranking` view, now on home and backed by Mongo.
- **Dedicated rate flow at `/rate`.** A single-dish-at-a-time flow that queues unrated dishes by `popularity` descending and lets the user rate 1–10 with one tap, advance to next, undo in session, skip. Same behavior as the earlier `star-rating-home` `/` screen, restored with the Mongo backend.
- **Bottom tab bar with inline SVG icons.** Two tabs: 🏆 **דירוג** (home, leaderboard + inline rate) and ⭐ **דרג** (rate flow). Icons are hand-authored inline SVGs inside a reusable `TabBarIcon` component; no icon library dependency. Active-tab highlighting and re-tap-scroll-to-top preserved from the prior bottom-nav work.
- **Fully responsive shell.** A centered max-width container (~520px on desktop, fluid on mobile) holds all content. The tab bar respects the same max-width so the layout reads as "mobile app in a window" on desktop. Works from ~320px up to any width. `env(safe-area-inset-*)` respected on iOS.
- **Friendly UX language retained.** Hero on home showing the user's current top personal pick, warm Hebrew copy, shimmer skeleton loading states, rounded cards with soft shadows. Everything from the prior bottom-nav-home-redesign change that still applies.

## Capabilities

### New Capabilities

- `star-rating-backend`: server-side Mongo `ratings` collection, index strategy, aggregation query for the leaderboard, and the `x-user-id`-scoped API routes under `/api/ratings` and `/api/leaderboard`. Owns everything under `src/lib/server/` plus the new route files.
- `rating-store-client`: client-side `RatingsStore` interface, `HttpRatingsStore` adapter, and the localStorage-backed `userId` lifecycle. Owns the request-header injection pattern.
- `mobile-app-shell`: responsive container, bottom tab bar with inline SVG icons, root-layout composition, safe-area handling, and the re-tap-scroll-to-top behavior.
- `rating-screens`: the home route (aggregate leaderboard with inline rate, hero for the user's top personal pick, empty state, skeleton loading) and the rate route (queue-driven one-dish-at-a-time 1–10 flow with skip, undo, all-done state).

### Modified Capabilities

<!-- None in spec-delta form: prior changes are not archived, so there are no canonical specs in openspec/specs/ to MODIFY against. The demolition of the one-vote model (votes collection, VotesStore, HttpVotesStore, VoteCard, single-vote UI) is captured in this change's tasks. Spec reconciliation happens at archive time. -->

## Impact

- **Files deleted:**
  - `src/lib/stores/votes-store.ts`, `src/lib/stores/http-votes-store.ts`
  - `src/lib/ui/VoteCard.svelte`, `src/lib/ui/DishRow.svelte`
  - `src/routes/api/votes/+server.ts`, `src/routes/api/votes/[voteId]/+server.ts`
  - `src/routes/api/leaderboard/+server.ts` (replaced with a ratings-aware version)
  - `src/routes/+page.svelte` (rewritten)
- **Files rewritten:**
  - `src/lib/server/db.ts` — switch from `votes` collection + indexes to `ratings` collection + indexes; drop the old `votes` collection on first connect as a one-shot cleanup (idempotent: `dropCollection` ignores "not found" errors).
  - `src/lib/types.ts` — replace `VoteCount`/`MyVote` types with `RatingAggregate` and `MyRating` types.
  - `src/routes/+layout.svelte` — restore a bottom tab bar mount and a centered responsive container.
- **Files added:**
  - `src/lib/stores/ratings-store.ts` — interface
  - `src/lib/stores/http-ratings-store.ts` — HTTP adapter + userId localStorage management + module-level singleton
  - `src/routes/api/ratings/+server.ts` — GET list per user
  - `src/routes/api/ratings/[dishId]/+server.ts` — PUT upsert, DELETE clear
  - `src/routes/api/leaderboard/+server.ts` — GET aggregate (avg, count) per dish
  - `src/routes/rate/+page.svelte` — the dedicated rate flow
  - `src/lib/ui/BottomTabBar.svelte` — bottom tab bar with inline SVG icons, active highlight, scroll-to-top
  - `src/lib/ui/StarSelector.svelte` — 10 pill buttons, reused from the prior star-rating-home design
  - `src/lib/ui/RatingRow.svelte` — leaderboard row with avg, count, and the user's own star
  - `src/lib/ui/AppShell.svelte` or equivalent wrapper — optional, may fold directly into `+layout.svelte`
  - `src/lib/stars/queue.ts` — the unrated-first-by-popularity queue (restored from star-rating-home)
- **Schema change in Mongo:**
  - Add `ratings` collection with unique compound index on `{ userId: 1, dishId: 1 }` plus a non-unique index on `{ dishId: 1 }` for the aggregation.
  - Drop the `votes` collection on first connect (one-shot cleanup during `ensureIndexes`).
- **No new runtime dependencies.** `mongodb` and `@sveltejs/adapter-node` are already installed. `@types/node` is already installed. No icon library — inline SVGs.
- **No new env variables.** `MONGODB_URI` unchanged.
- **Backward compatibility:** the prior one-vote-model's `user:v1` localStorage key stored `{ voteId, dishId, timestamp }`. This change repurposes the same key to store the anonymous userId (a plain string UUID, or `{ userId }` object — see design.md). The old value is shape-validated; if the stored value is not a valid user-id record, it's overwritten with a fresh UUID. No migration UI needed.
