## Context

The current app is a SvelteKit app with `@sveltejs/adapter-node`, a `votes` collection in MongoDB Atlas, and a single-screen one-vote-per-user UI. The user has decided to change course: bring back the per-dish 1–10 star rating (from the earlier `star-rating-home` change), keep the Mongo backend (from `one-vote-model`), make the app feel like a real native mobile app (responsive container, bottom tab bar with icons, two tabs), and let the user rate dishes *inline on the leaderboard* (the home view is both a read surface and a write surface).

This is a structural redesign but not a full rewrite. The SvelteKit scaffolding, the scraper, the catalog loader, the adapter-node plumbing, the `.env` setup, the `src/lib/server/db.ts` singleton pattern, and the Tailwind + RTL visual language all carry forward. The swap is on the data model (votes → ratings), the API surface, the client store, and the UI.

## Goals / Non-Goals

**Goals:**
- Per-browser anonymous identity via a UUID in localStorage. Every API request carries `x-user-id`.
- MongoDB `ratings` collection `{ userId, dishId, stars, timestamp }` with a unique `(userId, dishId)` compound index so writes are upserts.
- A `/api/leaderboard` aggregation returning `{ dishId, averageStars, ratingCount }` sorted by `averageStars` descending, with a minimum-count tiebreaker.
- Two top-level routes: `/` (home / leaderboard with inline rate) and `/rate` (dedicated queue flow).
- Bottom tab bar on every route with two tabs, inline SVG icons (no library), active-state, re-tap-scroll-to-top, safe-area padding.
- Responsive shell: centered max-width container (~520px desktop, fluid mobile), feels like a phone on a desktop screen.
- Home screen has: hero for the user's own top-rated dish, aggregate leaderboard below, inline star selector when a row is tapped, friendly empty/loading states.
- Rate screen has: queue of unrated dishes by popularity descending, one-dish-at-a-time 1–10 selector, advance on rate, skip, session undo, all-done state.
- Optimistic UI on both screens: rate immediately updates the in-memory counts, avg, and the user's own star; server round-trip is background; failure rolls back and shows an error banner.
- Zero new runtime dependencies.

**Non-Goals:**
- Real user authentication. Honor-system identity only.
- Write-through localStorage cache / offline mode. Network required.
- Migration of existing `votes` documents into `ratings` documents. The one-vote data is abandoned.
- Per-user exports / imports (can revisit later; the Mongo backing makes single-user backup/restore less important).
- An explicit "my ratings" view. The home screen already surfaces "your rating" on every row and in the hero.
- Any animation library. Svelte built-in transitions cover everything.
- A separate icon library. Two inline SVGs cover the bar.

## Decisions

### Data model — swap `votes` for `ratings`

```ts
// food-ranking.ratings (new)
interface RatingDoc {
  _id: ObjectId;
  userId: string;     // client-generated UUID, stored in localStorage
  dishId: string;     // matches catalog id, includes -t / -r suffix
  stars: number;      // integer 1..10
  timestamp: number;  // server-set on upsert
}
```

**Indexes:**
- `{ userId: 1, dishId: 1 }` **unique** — enforces one rating per (user, dish) and lets writes be atomic upserts via `updateOne({ userId, dishId }, { $set: ... }, { upsert: true })`.
- `{ dishId: 1 }` non-unique — speeds up the aggregation for the leaderboard.

**Leaderboard aggregation:**
```js
db.ratings.aggregate([
  { $group: { _id: '$dishId', averageStars: { $avg: '$stars' }, ratingCount: { $sum: 1 } } }
])
```

Returns one document per rated dish. The API normalizes to `[{ dishId, averageStars, ratingCount }]`. The client fills in zero-count entries from the static catalog.

**Why `$avg` instead of storing a precomputed mean:** correctness. A precomputed mean needs a write lock and a careful formula on update — if a user changes a 7 to a 10, you need the old value to recompute cleanly. Storing per-rating docs and aggregating on read is strictly correct, trivially cheap at this scale (tens to low thousands of documents), and future-proof for any other analytics we ever want to run.

**Cleanup of the old `votes` collection:** on first connect, `db.collection('votes').drop()` is attempted inside a try/catch that swallows "collection not found." After this change deploys once, the old collection is gone from Atlas forever. No user data was migrated; the one-vote documents are discarded intentionally.

### Anonymous browser identity

Key: `user:v1` in localStorage. Shape: a bare string UUID. Shape-validate on read (non-empty string of reasonable length), regenerate if invalid or missing.

**Why a bare string** instead of an object `{ userId: "..." }`: simpler, smaller, no accidental shape drift when we inevitably want to add fields later and panic about backward compat. An object adds zero value today. If we ever need to store more (e.g. display name) we bump to `user:v2` and migrate.

**Regeneration rules:** if localStorage has no value, write a new UUID. If localStorage has a value that fails shape validation (empty, non-string, crazy length), overwrite with a new UUID. If localStorage has a valid value, use it.

**Request injection:** the `HttpRatingsStore` adds `x-user-id: <uuid>` to every fetch's headers. A tiny helper `getUserId()` exported from the store file reads or lazily creates the id.

**Server-side resolution:** `src/lib/server/userId.ts` exports `getUserId(event: RequestEvent): string` that reads the `x-user-id` header, validates it's a non-empty string of sane length, and either returns it or throws a 400. If we were running this for real we'd use a signed cookie or real auth, but for honor-system friends-and-family the header is fine.

### API surface

```
GET    /api/leaderboard                    → 200 [{ dishId, averageStars, ratingCount }]
GET    /api/ratings                        → 200 [{ dishId, stars, timestamp }]       (caller's ratings)
PUT    /api/ratings/[dishId]               → 200 { dishId, stars, timestamp }         (upsert)
DELETE /api/ratings/[dishId]               → 204                                       (clear)
```

Every endpoint reads `x-user-id` via `getUserId(event)` and scopes queries to that id. Leaderboard is public (aggregate across all users) but it still reads the header and returns 400 on missing — callers must identify themselves even just to read the shared leaderboard, so that the client always sends the same header uniformly. No exception paths.

**Status codes:**
- `200` for `GET` and successful `PUT`.
- `204` for `DELETE` regardless of whether a doc existed (idempotent).
- `400` for missing/invalid `x-user-id`, invalid `stars` value, unknown `dishId`, or malformed body.
- `503` for Mongo connection failures.
- `500` for other unexpected errors.

**Validation of `stars`:** integer in `[1, 10]`. Anything else → 400 before touching Mongo.

**Validation of `dishId`:** reuse the existing `hasDish` server-side catalog loader from `src/lib/server/catalog.ts` that was built for the one-vote model. Unknown dishes → 400.

### Client store

```ts
interface RatingsStore {
  getLeaderboard(): Promise<RatingAggregate[]>;
  getMyRatings(): Promise<MyRating[]>;
  rate(dishId: string, stars: number): Promise<MyRating>;
  clear(dishId: string): Promise<void>;
}

interface RatingAggregate {
  dishId: string;
  averageStars: number;
  ratingCount: number;
}

interface MyRating {
  dishId: string;
  stars: number;
  timestamp: number;
}
```

**Why four methods and not more:** the home screen needs `getLeaderboard` + `getMyRatings`; the rate screen needs `getMyRatings` + `rate`; both need `clear`. That's the whole surface. No bulk import, no export, no listEvents. If exports become valuable later they're a clean additive change.

**Module-level singleton:** `httpRatingsStore` exported from `src/lib/stores/http-ratings-store.ts`. Components import `ratingsStore` from there exclusively (we'll name the export `ratingsStore` to match convention, even though the class is `HttpRatingsStore`).

**Header injection:** an internal `fetchJson()` helper wraps `fetch`, adds the `x-user-id` header lazily (reads or generates the id on first call), and maps non-2xx responses to thrown `Error`s containing the status code and body text. No UI changes to error handling — the existing error-banner paths on home and rate handle them.

**Request body for PUT:**
```ts
await fetch(`/api/ratings/${encodeURIComponent(dishId)}`, {
  method: 'PUT',
  headers: { 'content-type': 'application/json', 'x-user-id': getUserId() },
  body: JSON.stringify({ stars })
});
```

### Leaderboard sort order

Primary: `averageStars` descending.
Secondary (tiebreaker): `ratingCount` descending — if two dishes average the same, the more-rated one wins, reflecting "more people agree this is good."
Tertiary: `popularity` descending from the static catalog — stable order when the first two are equal.

**Why the `ratingCount` tiebreaker matters:** without it, a dish with a single 10-star rating from one user beats a dish with fifty 9.8-star ratings from the crowd. The average alone is fragile. Sorting by average first and count second gives the cleanest "best" signal at this scale.

**Future-proofing:** if the app ever grows beyond the friends-and-family scope we'd introduce a **minimum-count threshold** (e.g. "dishes with fewer than 3 ratings are hidden from the top section") and a "rising" section below it. Out of scope for now — at ≤ 5 users a min-count threshold would just hide everything.

### Home composition

```
┌────────────────────────────────────────┐
│ דירוג אוכל                              │   header (title only)
├────────────────────────────────────────┤
│ ┌────────────────────────────────┐     │
│ │  [hero image]                  │     │
│ │  ★ המנה האהובה שלך              │     │   hero (user's top-rated)
│ │  המבורגר אנטריקוט               │     │   — tap to expand inline rate
│ │  דיינר · ₪40 · ⭐ 9              │     │
│ └────────────────────────────────┘     │
│ ── הדירוג של כולם ─────────────────────│
│ 1. 🥇 [img] לברק שום שחור              │
│    דיינר · ₪40 · 8.7 (מתוך 3)  ⭐ 10   │   row: name, restaurant/price,
│                                        │   avg, count, your rating
│ 2. 🥈 [img] המבורגר אנטריקוט           │   — tap to expand inline rate
│    דיינר · ₪40 · 8.5 (מתוך 4)  ⭐ 9    │
│ ...                                    │
│ ── מנות שעדיין לא דורגו · 40 ──────────│
│ ?   [img] ...                          │   unrated section
├────────────────────────────────────────┤
│        🏆                  ⭐           │   bottom tab bar
│       דירוג                דרג          │
└────────────────────────────────────────┘
```

**Hero rules:**
- Shown when `myRatings` is non-empty. Picks the user's highest-rated dish (ties broken by most recent timestamp).
- Shows the user's own star rating *and* the current global average, so the user always sees both "what I think" and "what the crowd thinks" in one glance.
- Tappable — tap expands an inline star selector directly below the hero, with the current value highlighted and a "נקה דירוג" clear button.
- If the user has no ratings yet, hero position shows a friendly empty state with a tiny bowl illustration and a prompt to try the Rate tab.

**Leaderboard rules:**
- All dishes with at least one rating, sorted by `averageStars` desc then `ratingCount` desc then `popularity` desc.
- Each row shows: rank, image, name, restaurant, price, `average (count)`, and the user's own star rating (or a muted "לא דירגת" if they haven't rated it).
- Tap any row → row expands in place to show a `StarSelector` with the user's current value highlighted, plus a "נקה דירוג" clear control.
- Top 3 get 🥇 🥈 🥉 medals.

**Unrated section:**
- All dishes with zero ratings in the aggregation response, sorted by catalog `popularity` desc.
- Muted opacity.
- Same inline-rate behavior as the leaderboard rows.

**Optimistic inline rate:**
- Tap row → open the editor → tap a star → optimistic: increment `count`, recompute `averageStars` locally (tricky — see below), set the user's own rating.
- Fire `PUT /api/ratings/[dishId]`.
- On success, replace the optimistic local average with the server's next leaderboard response (fetched in the background and diffed).
- On failure, revert to the pre-tap state and surface an error banner.

**Recomputing the average locally:**
The optimistic update needs to produce a sensible average immediately. Two cases:
- **New rating** (user had no rating for this dish): `newAvg = (oldAvg * oldCount + stars) / (oldCount + 1)`, `newCount = oldCount + 1`.
- **Change rating** (user had an old value for this dish): `newAvg = (oldAvg * oldCount - oldUserStars + stars) / oldCount`, `newCount = oldCount` (unchanged).
- **Clear rating**: `newAvg = oldCount === 1 ? 0 : (oldAvg * oldCount - oldUserStars) / (oldCount - 1)`, `newCount = oldCount - 1`.

These formulas are exact as long as we know the user's previous star value (which we track in `myRatings`). On the next background `getLeaderboard()` the server-truth replaces the optimistic values; if the drift is tiny (it should be zero) no visible change. If the server disagrees by more than a rounding tick, the user briefly sees a snap — acceptable.

**Skeleton loading:** shimmer skeleton for the hero + 5 list rows while data loads.

### Rate screen composition

```
┌────────────────────────────────────────┐
│                     4 / 79              │   header (progress)
├────────────────────────────────────────┤
│                                        │
│      [ current dish image hero ]       │
│                                        │
│     המבורגר אנטריקוט                    │
│     דיינר · ₪40                        │
│                                        │
│     מה דעתך?                            │
│                                        │
│   [1][2][3][4][5][6][7][8][9][10]      │   10 star pill buttons
│                                        │
│     אולי אחר כך   ·   חזור אחורה        │
├────────────────────────────────────────┤
│        🏆                  ⭐           │   bottom tab bar
└────────────────────────────────────────┘
```

**Behavior:**
- On mount, load catalog + `getMyRatings()`.
- Compute the queue = unrated dishes (not present in `myRatings`), sorted by `popularity` desc (stable order by `id`).
- Show the first queued dish. Tap a star → PUT the rating, advance to the next queued dish. No confirmation.
- "אולי אחר כך" (skip): session-local set, excludes the current dish from the queue for this session only, advance to next.
- "חזור אחורה" (undo): pops the session undo stack, `clear()` the last rated dish, show it again.
- Desktop keyboard shortcuts on `(pointer: fine)` devices: `1`–`9` rate 1–9, `0` rates 10, `Space` skips, `Backspace` undoes.
- All-done state: when the queue is empty, show a warm "הכל דורג! 🎉" headline and a link to `/` (home). The bottom tab bar stays visible, so tapping 🏆 is always an exit.

**Shared components with home:** `StarSelector` (10 pill buttons), the typographic-fallback card logic for missing dish images. `StarSelector` is reintroduced from the earlier `star-rating-home` design, unchanged.

### Bottom tab bar with inline SVG icons

```svelte
<nav class="fixed inset-x-0 bottom-0 z-40 ...">
  <ul class="mx-auto flex max-w-[520px]">
    <li class="flex-1"><a href="/"><TrophyIcon /> דירוג</a></li>
    <li class="flex-1"><a href="/rate"><StarIcon /> דרג</a></li>
  </ul>
</nav>
```

- Two tabs. Equal width (`flex-1`). Minimum 56px tap target height.
- Inline SVG icons defined as simple Svelte components that take a `filled` prop (or use CSS currentColor + the parent's color class). The icons are a trophy for home and a star outline for rate.
- Active state: accent color on icon + label; inactive: 55% white.
- Re-tap active tab → `window.scrollTo({ top: 0, behavior: 'smooth' })`.
- Bottom padding: `env(safe-area-inset-bottom)` for iOS home-indicator safety.
- Constrained to the same max-width as the content (so on a wide desktop, the tab bar is a floating pill-shape at the bottom of the centered content column, not a full-width ribbon — reinforces the "mobile app in a window" read).

**Why constrain the tab bar width on desktop:** two reasons. First, a tab bar with two tabs stretched across a 1920px screen has each tap target ~960px wide, which looks absurd and makes the app feel broken. Second, pinning the bar to the content width makes the whole page read as a single cohesive phone-shape panel on desktop, which matches the user's "mobile app" ask.

### Responsive shell

```svelte
<!-- src/routes/+layout.svelte -->
<div class="mx-auto w-full max-w-[520px] min-h-dvh pb-[calc(env(safe-area-inset-bottom)+88px)]">
  {@render children()}
</div>
<BottomTabBar />
```

- `max-w-[520px]` centers content on wide screens. 520px ≈ ~iPhone 14 Pro Max in portrait, comfortable for phone app feel.
- Bottom padding clears the tab bar height (72px) + safe area + a small breathing gap.
- The main body background stays the existing dark `#0a1220` (from `app.css`). On desktop the outside of the max-width container is the same color, so no visible "frame" — it just reads as "content is centered."
- No media queries for the core layout. The `max-w` is the whole story for responsiveness.
- Individual components use Tailwind's responsive utilities only where needed (e.g. text size scaling, image sizing), not for wholesale layout changes.

**Alternative considered:** a wider layout on desktop (e.g. 2-column grid with list on the left and detail on the right). Rejected because it's a different app, not a wider version of the same one. The user asked for "mobile app feel," and the phone-in-a-window pattern is the most honest interpretation.

### Friendlier copy retained

All the warm copy from `bottom-nav-home-redesign` stays:
- Skeleton instead of "טוען…"
- `מה דעתך?` on rate
- `אולי אחר כך` / `חזור אחורה` for skip/undo
- `המנה האהובה שלך` on the hero
- `מנות שעדיין לא דורגו · {N}` on the unrated divider

New copy for the aggregate context:
- Leaderboard section header: `הדירוג של כולם`
- Count suffix on a row: `(מתוך {N})` — "out of N"
- "Your rating" indicator: `⭐ {stars}` or `לא דירגת` when absent

### Migration of the old localStorage

The prior `one-vote-model` used `vote:v1` to store `{ voteId, dishId, timestamp }`. That key is abandoned and deliberately **not** cleaned up — we don't touch it, and it remains orphaned in the user's browser storage. Negligible cost, and removes one source of "did the migration work?" anxiety.

The new key is `user:v1` — a bare UUID string. On first load the store reads it, and if missing or invalid, writes a fresh one.

## Risks / Trade-offs

- **Optimistic UI with exact average recomputation** is slightly finicky but gives the user a feel of instant response. The formulas above are exact given the user's previous rating is known locally. Mitigation: always `getMyRatings()` on mount so we know our own priors, and refresh `getLeaderboard()` in the background after any action to reconcile.
- **Honor-system identity** is unchanged from the one-vote model. A user who clears localStorage gets a new identity and can re-rate everything. Accepted.
- **Dropping the `votes` collection** on first connect is destructive but the user agreed the one-vote data is abandoned. One-shot, idempotent. Documented.
- **Max-width 520px on desktop leaves a lot of unused space.** Accepted as the cost of mobile-app feel. If it grates, a wider two-pane layout is a clean follow-up change.
- **Inline rate on the leaderboard + dedicated rate flow** creates two paths to the same state. Minor duplication of logic in `+page.svelte` and `/rate/+page.svelte`. Mitigated by sharing the `StarSelector` component and the optimistic-update helpers.
- **Aggregation on every leaderboard read** is cheap now but can balloon. Not an issue under a few thousand ratings. If it ever matters we cache the aggregation in memory on the server with a short TTL (one line of code). Not worth doing today.
- **The tiebreaker `ratingCount desc` can feel weird** when one dish has average 8.5 from 10 users and another dish has 10.0 from 1 user — the first wins, even though the second has the maximum rating. This is correct at scale but can look "wrong" at N=5. Accepted; revisit if it's confusing in practice.

## Migration Plan

1. **Demolish** the one-vote surface: delete `votes-store.ts`, `http-votes-store.ts`, `VoteCard.svelte`, `DishRow.svelte`, `src/routes/api/votes/*`, `src/routes/+page.svelte`.
2. **Rewrite** `src/lib/server/db.ts`: swap `votes` for `ratings`, add the new indexes, attempt a one-shot `votes.drop()` inside the first-connect path.
3. **Add** the server-side `userId` resolver in `src/lib/server/userId.ts` reading the `x-user-id` header.
4. **Add** the three API routes: `/api/leaderboard`, `/api/ratings`, `/api/ratings/[dishId]`.
5. **Add** the client store: `ratings-store.ts` interface, `http-ratings-store.ts` adapter with the `user:v1` localStorage lifecycle and header injection.
6. **Reintroduce** `src/lib/stars/queue.ts` (unrated-first by popularity), `StarSelector.svelte`.
7. **Add** `BottomTabBar.svelte` with inline SVG trophy + star icons.
8. **Rewrite** `src/routes/+layout.svelte` with the responsive container + tab bar mount.
9. **Write** the new `src/routes/+page.svelte` (home with hero + leaderboard + inline rate).
10. **Write** `src/routes/rate/+page.svelte` (queue flow).
11. **Trim `types.ts`** to the new shapes (`RatingAggregate`, `MyRating`, `VoteCount`/`MyVote` removed).
12. **Verify** type check + build + live Mongo smoke test. Run the server, rate a dish from `/rate`, verify it shows on `/` with the correct average, adjust it from `/`, verify persistence across refresh, verify second browser sees the shared leaderboard.

No data migration. The `votes` collection is dropped on first connect and its data is intentionally lost. The orphan `vote:v1` localStorage keys are left in place in any existing browsers.

## Open Questions

- **Minimum rating count threshold** on the leaderboard to avoid single-rating dishes dominating — default: not yet, the tiebreaker handles it acceptably at this scale. Add later if the top of the list feels wrong.
- **Show per-user rating count in the header** (e.g. "12 / 79")? Default: yes, small and unobtrusive, same as the previous rate-flow progress counter, now on both home and rate.
- **Drop the orphan `vote:v1` localStorage** on first load, just to be tidy? Default: no, it's 40 bytes and removing code for it adds complexity. Leave alone.
- **Should the hero on home always show the user's top-rated dish, or switch to the global leader if the user hasn't rated anything?** Default: show the global leader when the user hasn't rated, with a "זה מה שכולם אוהבים הכי הרבה" label; show the user's top pick when they have. This keeps the hero position productive for new users.
