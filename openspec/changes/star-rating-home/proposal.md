## Why

The existing app opens directly on the pairwise comparison screen, which is fun but requires many taps before the user has a usable ranking, and it produces relative (Elo) scores rather than absolute ones. The user wants the first interaction to be low-friction and directly expressive: open the app, see one dish, give it a 1–10 star rating, move to the next dish. The pairwise comparison is still valuable — it becomes a "mini-game" reachable from a secondary route, with its own result screen, so the two modes can coexist without competing for the home slot.

## What Changes

- **Home route (`/`) becomes the star-rating flow.** Shows one dish at a time. User picks a rating from 1 to 10 stars. Previous star persists. Skip advances without rating.
- **Rating queue strategy**: unrated dishes appear first, sorted by `dishPopularityScore` descending so high-signal dishes surface first. Once every dish is rated, the queue is empty and the flow shows a gentle "all done" state with a link to the leaderboard and to the mini-game.
- **Main leaderboard (`/ranking`) is now star-based**: dishes sorted by user star rating descending, unrated dishes collapsed into an "unrated" section below the divider. Tapping a rated row opens an inline star editor to change or clear the rating.
- **Pairwise comparison moves to `/game`.** It keeps the exact behavior we already built (one-tap pick, Elo update, pair selection with twin filter, skip, never-seen-it).
- **Pairwise game gets its own results view at `/game/results`** showing the Elo leaderboard that used to live on `/ranking`. The game and its results are fully self-contained and do not read from or write to star ratings.
- **New `StarsStore` interface** with a LocalStorage adapter today and a MongoDB adapter later. Shape and lifecycle mirror `RatingsStore` (fully async, single app-wide accessor, export/import).
- **Star ratings and pairwise events are stored independently** in two separate localStorage keys. Neither influences the other.
- **Top-level navigation chrome** gains a visible link between the star-rating home and the mini-game so the user can discover the game without having to know the URL. The game's route has a reciprocal link back to home.

## Capabilities

### New Capabilities

- `star-rating`: 1–10 star rating flow over the dish catalog, including the rating-queue strategy, the home-screen single-dish view, the star selector UI, and the star-based leaderboard at `/ranking`. Supersedes the previous `ranking-view` capability's role as the main leaderboard.
- `stars-store`: persistence interface for per-dish star ratings, with a LocalStorage adapter now and a MongoDB adapter pluggable later. Stores the latest star per dish plus a timestamp; the same dish can be re-rated any number of times.
- `game-results`: the Elo leaderboard view at `/game/results`, rendering the derived ratings from the pairwise event log. Takes over the "leaderboard for the pairwise game" role that the previous `ranking-view` capability implicitly covered.

### Modified Capabilities

<!-- None in spec-delta form: the previous change (food-ranking-app) is not yet archived, so there are no canonical specs to MODIFY against. The routing relocations (pairwise moves from `/` to `/game`, leaderboard moves from `/ranking` Elo to `/ranking` star + `/game/results` Elo) are captured in this change's tasks and design. Spec reconciliation happens at archive time. -->

## Impact

- **Affected routes**: `/+page.svelte` is rewritten from the pairwise comparison to the star-rating flow. The existing pairwise comparison file and its logic move to `/game/+page.svelte`. The existing `/ranking/+page.svelte` is rewritten to render star-based rankings with re-rate controls. A new route `/game/results/+page.svelte` is added for the Elo leaderboard.
- **Affected modules**: no changes to `pair-select`, `elo`, `rate`, `local-storage-store`, or the catalog loader. New `stars/stars-store.ts` interface + `stars/local-storage-stars-store.ts` adapter. New `stars/queue.ts` for the rating-queue ordering.
- **No new runtime dependencies.** No backend. No schema changes to `data/restaurants.json` or the scraper.
- **Backward compatibility**: users with prior match-event history under the existing localStorage key (`ratings:events:v1`) keep that history untouched; it is only read by `/game`. Users with no history start fresh in the star-rating flow. No migration is needed because stars and events live in different keys.
- **Later MongoDB swap**: the new `StarsStore` is designed exactly like `RatingsStore` so the same later effort swaps both stores in one pass.
