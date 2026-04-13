## Why

After the previous changes shipped a private 1–10 star tracker and a pairwise mini-game, the user has decided the app should become a very different thing: a single-screen "pick your favorite main course" app where every person gets exactly one vote. The database stores anonymous per-vote records, the leaderboard is public and shared across all users of the deployment, and localStorage tracks which dish this browser voted for so the user can change their mind without double-counting. The pairwise mini-game and the star-rating flow are removed — the whole app collapses to one interaction on one screen.

The motivation is clarity. A one-vote model gives everyone who opens the app the same question and the same answer ("what's the favorite main course on 10bis, right now?"). The previous private-ranking models asked each user to do a lot of work for a result nobody else ever saw. This is the opposite: zero-friction voting, shared outcome, one screen.

## What Changes

- **Remove the star-rating flow entirely.** Delete `/rate` and all supporting code: `StarsStore`, `LocalStorageStarsStore`, `StarSelector`, `src/lib/stars/queue.ts`, every `StarRating`-related type.
- **Remove the pairwise mini-game entirely.** Delete `/game` and `/game/results` routes and all supporting code: `RatingsStore`, `LocalStorageRatingsStore`, `src/lib/ranking/*`, `pair-select.ts`, `elo.ts`, `rate.ts` (ranking module, not the route), `DishCard.svelte`, `MatchEvent` type.
- **Remove the bottom tab bar.** With only one screen, navigation is trivially the screen itself. Delete `BottomTabBar.svelte` and drop it from the root layout.
- **Introduce a single screen at `/`** showing a hero card for the current user's vote (or an empty-state CTA), followed by a vote leaderboard listing every dish in the catalog with its global vote count, sorted by count descending. Tapping any row casts or changes the user's vote.
- **Switch the app from a pure-static SvelteKit build to `@sveltejs/adapter-node`** so the app can host server-side API routes. Browsers cannot speak the MongoDB wire protocol; a Node-side proxy layer is required.
- **Introduce a MongoDB Atlas backend** with a single `votes` collection storing anonymous per-vote records `{ voteId, dishId, timestamp }`. Leaderboard reads are a group-by-dishId aggregation query. Writes are atomic single-document inserts and deletes.
- **Introduce a `VotesStore` interface** and a client-side `HttpVotesStore` adapter that talks to the new API routes and owns the localStorage contract for "which dish this browser voted for." The local-state half is sync (it's just a localStorage read); the network half is async.
- **No user authentication.** Anti-abuse is honor-system only: one vote per browser via localStorage. Users who clear site data or open an incognito window can vote again. Acceptable for the small friends-and-family audience this is designed for.
- **No per-user identity in the database.** The `votes` collection stores no `userId`, no IP, no device fingerprint. Every document is literally `{ voteId, dishId, timestamp }`. Privacy-respecting by construction.
- **Adopt the friendlier visual language** the previous change added (hero card, empty state with bowl illustration, skeleton loading, warmer copy) and reuse it verbatim on the new single screen.

## Capabilities

### New Capabilities

- `one-vote-persistence`: MongoDB connection lifecycle, the `food-ranking` database, the `votes` collection with its indexes, env-based configuration, and the long-lived MongoClient singleton. Owns everything server-side under `src/lib/server/`.
- `votes-api`: the small REST surface at `/api/leaderboard`, `/api/votes`, and `/api/votes/[voteId]` that the client adapter consumes.
- `vote-store`: the client-side `VotesStore` interface and `HttpVotesStore` adapter, including the localStorage contract `vote:v1` storing `{ voteId, dishId, timestamp }` for the current browser's vote.
- `vote-home`: the single-screen home route at `/` composed of a hero card (current user's vote or empty state), a leaderboard list sorted by vote count descending, and the tap-to-vote interaction that casts or changes the vote.

### Modified Capabilities

<!-- None in spec-delta form: prior changes are not yet archived, so there are no canonical specs in openspec/specs/ to MODIFY against. The demolition of star-rating, pairwise-ranking, game-results, ranking-view, bottom-navigation, home-ranking-hero, ratings-store, stars-store, and dish-catalog (partial — catalog is kept, the store parts are removed) is captured in this change's tasks. Spec reconciliation happens at archive time when the previous changes are finally archived alongside this one. -->

## Impact

- **Major deletions** (captured as tasks):
  - Routes: `src/routes/rate/`, `src/routes/game/`, `src/routes/game/results/`
  - Lib: `src/lib/stars/`, `src/lib/ranking/`, `src/lib/stores/local-storage-store.ts`, `src/lib/stores/local-storage-stars-store.ts`, `src/lib/stores/ratings-store.ts`, `src/lib/stores/stars-store.ts`, `src/lib/ui/DishCard.svelte`, `src/lib/ui/StarSelector.svelte`, `src/lib/ui/BottomTabBar.svelte`, `src/lib/ui/NavButton.svelte`
  - Types: `MatchEvent`, `StarRating`, `Rating`, `OrderMethod` (kept on the dish shape) in `src/lib/types.ts`
- **New runtime dependencies**: `mongodb` (^6, the official Node driver) and `@sveltejs/adapter-node` (replacing `@sveltejs/adapter-static`).
- **New environment variables**: `MONGODB_URI` (required, read via `$env/static/private`). Build fails loudly if missing.
- **Deployment story changes**: the app is no longer a pure static site. It needs a Node host (Vercel, Render, Fly, a VPS). Local `npm run dev` is unchanged.
- **New files**:
  - `src/lib/server/db.ts` — MongoClient singleton, collection accessors, index creation
  - `src/routes/api/leaderboard/+server.ts` — GET, returns aggregated counts
  - `src/routes/api/votes/+server.ts` — POST, casts or changes a vote
  - `src/routes/api/votes/[voteId]/+server.ts` — DELETE, removes a vote
  - `src/lib/stores/votes-store.ts` — interface
  - `src/lib/stores/http-votes-store.ts` — HTTP adapter + localStorage-vote tracker + module-level singleton
  - `src/lib/ui/VoteCard.svelte` — the hero card component
  - `src/lib/ui/DishRow.svelte` — compact row component used by the leaderboard list
  - `.env.example` — placeholder `MONGODB_URI` and setup comment
- **Modified files**:
  - `package.json` — dep swap (add `mongodb`, `@sveltejs/adapter-node`; remove `@sveltejs/adapter-static`)
  - `svelte.config.js` — adapter-node import + call
  - `src/routes/+layout.svelte` — remove `BottomTabBar` mount, remove tab-bar padding wrapper
  - `src/routes/+layout.ts` — remove `prerender = true`; keep `ssr = false`
  - `src/routes/+page.svelte` — fully rewritten as the new single-screen vote home
  - `src/lib/types.ts` — trimmed to `Dish`, `Restaurant`, `CatalogDataset`, `VoteCount`, `MyVote`
- **User-visible behavior changes**:
  - Opening the app goes straight to the voting screen. There are no other screens.
  - A user's previous star ratings and Elo history (in localStorage) become unreachable through the UI — they remain in the browser's storage but are never read. The app's localStorage footprint changes from `stars:v1` and `ratings:events:v1` to a single new key `vote:v1`.
  - The leaderboard shows vote counts that reflect every user who has hit this deployment and voted. This is a shared surface for the first time in the app's history.

## Prerequisites the user must complete before end-to-end testing

- **Create the MongoDB Atlas database user** via the Atlas web console (Database Access → Add New Database User, password auth, "Read and write to any database"). The automation cannot do this without Atlas API credentials this environment does not have.
- **Allow the dev IP** in Atlas Network Access (`0.0.0.0/0` for development).
- **Create a local `.env` file** at the project root (already gitignored) with `MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster0.rsn8ez5.mongodb.net/food-ranking?retryWrites=true&w=majority&appName=Cluster0` substituting the real credentials.

These three steps are documented as Group 1 in `tasks.md` as user-action items, not implementation tasks. The code can be built and type-checked with a dummy URI before the user completes them; only the end-to-end smoke tests require a real connection.
