## Context

The `food-ranking-app` change shipped a phone-first Hebrew/RTL SvelteKit app with a pairwise comparison as the home screen and an Elo-based leaderboard at `/ranking`. Storage is an async `RatingsStore` interface backed by an append-only match-event log in `localStorage` (key `ratings:events:v1`). 79 dishes across 5 restaurants are loaded from a static `data/restaurants.json`.

The user now wants the first screen to be a 1–10 star rating flow that walks through dishes one at a time, with the pairwise comparison demoted to a "mini-game" at its own route. Both modes should coexist. Star ratings and pairwise matches are treated as independent signals and persisted independently.

## Goals / Non-Goals

**Goals:**
- Opening the app lands on a single-dish star-rating screen. One tap on a star (1–10) records the rating and advances to the next dish.
- The rating queue surfaces unrated dishes first in descending `popularity` order, then ends on an "all done" state once every dish has been rated.
- Users can re-rate or clear any dish at any time from the `/ranking` leaderboard. Re-rating replaces the previous star, not append a history.
- The pairwise comparison and its Elo leaderboard continue to work unchanged, now at `/game` and `/game/results`.
- Star and Elo ratings are two completely separate persistence stores. Neither reads the other.
- The `StarsStore` interface matches the shape of `RatingsStore` (fully async, single-adapter accessor, import/export) so the MongoDB swap is a single effort across both stores.
- Navigation between home and the mini-game is discoverable from both directions.

**Non-Goals:**
- A star-rating history log. Only the latest star per dish is stored.
- Merging stars and Elo into a combined score. Explicitly out of scope.
- Onboarding, tutorial screens, or first-run walkthroughs.
- A separate "unrated queue" view. Unrated dishes live in the home flow until rated.
- Cross-device sync. Stars use `localStorage` until the MongoDB adapter lands.
- Migrating any existing match-event data. This change only adds a second store.

## Decisions

### Routing: `/` is stars, `/game` is pairwise

```
/                  ← star-rating flow (new home)
/ranking           ← star-based leaderboard (rewritten, same URL)
/game              ← pairwise comparison (relocated from /)
/game/results      ← Elo leaderboard for the mini-game (new)
```

**Why:** Keeping `/ranking` as the *main* ranking (now star-based) preserves URL muscle memory for the user. The mini-game's Elo leaderboard becomes a sub-view of `/game` rather than the home-side ranking, which matches its conceptual demotion. Moving the pairwise code into `/game/+page.svelte` is a literal file move — no logic changes.

**Alternatives considered:**
- **Keep `/ranking` = Elo, add `/stars` for star leaderboard.** Rejected: the app's primary ranking concept is now stars, so `/ranking` should hold it. Inventing `/stars` splits the user's mental model.
- **Single combined leaderboard merging stars and Elo.** Rejected: the two signals measure different things (absolute preference vs. relative preference) and combining them is a modelling trap.

### Rating scale: 1–10 integer stars, no half-steps

**Why:** The user said "1 to 10" explicitly. Integer steps map cleanly to tap targets on mobile (a row of 10 circular buttons fits on a standard phone width at ~32px each with spacing). Half-stars would add UX complexity (tap vs. drag) without a matching signal gain for a personal tracker.

**Storage shape:**
```ts
interface StarRating {
  dishId: string;
  stars: number;     // integer 1..10
  timestamp: number;
}
```

Only the latest rating per `dishId` is kept. Re-rating a dish replaces the existing entry in place. The store uses a record keyed by `dishId` for O(1) lookup, not an array; this is a deliberate departure from the event-log shape of `RatingsStore` because star ratings are *state*, not events — there is no useful replay.

### `StarsStore` interface

```ts
interface StarsStore {
  list(): Promise<StarRating[]>;          // all current ratings
  get(dishId: string): Promise<StarRating | null>;
  set(dishId: string, stars: number): Promise<StarRating>; // 1..10, replaces
  clear(dishId: string): Promise<void>;   // remove a specific rating
  clearAll(): Promise<void>;
  export(): Promise<string>;              // JSON of the full map
  import(json: string): Promise<void>;    // replaces all ratings
}
```

Every method is async, matching `RatingsStore`. LocalStorage key: `stars:v1`. Shape: `Record<string, StarRating>`.

**Why state-shaped storage instead of an event log:**
Unlike pairwise matches — where replay semantics matter for the Elo algorithm — star ratings are direct expressions of current preference. An event log would need a reducer that just takes the latest by `(dishId, timestamp)`, making the complexity pure overhead. A `Record<dishId, StarRating>` is the simplest structure that correctly models the thing.

### Rating queue strategy

The queue is a virtual ordered list computed on demand:

```
queue =  unrated dishes, sorted by popularity DESC, then by id ASC for stability
```

Rated dishes are not in the queue. If the user re-rates a dish from `/ranking`, they don't re-enter the queue — editing from the leaderboard is the re-rating path. The queue becomes empty exactly when every dish has a star rating; at that point the home screen shows an "all done" state with a link to `/ranking` and to `/game`.

**Alternatives considered:**
- **Round-robin across restaurants.** Surfaces variety early but buries the most popular dishes; rejected because popularity is the strongest a-priori signal we have for "rate this first."
- **Random order.** Fine, but feels lazy on a minimalist app where the first dish shapes the session mood.
- **Let the user choose the order.** Too many choices; the whole point of a queue is to remove choice from the flow.

### Star selector UI

```
┌─────────────────────────────────────────────┐
│                                             │
│          [ full-bleed dish card ]           │
│            name · restaurant · ₪            │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│     כמה כוכבים?                             │
│                                             │
│  [1] [2] [3] [4] [5] [6] [7] [8] [9] [10]   │
│                                             │
│   דלג                   lastly: "all done"  │
│                                             │
└─────────────────────────────────────────────┘
```

- The star row is ten pill buttons, each a tap target ≥44×44 css px.
- Tapping a number records the rating immediately (no confirmation), then the whole screen does a quick fade-out → next dish fade-in (~220ms), consistent with the existing pairwise transition.
- `skip` advances without recording.
- On desktop (`matchMedia('(pointer: fine)').matches`), digit keys `1`-`9` map to stars 1-9 and `0` maps to 10. `Space` skips. `Backspace` undoes the last rating. On touch devices, no keyboard listeners.
- Progress is shown as an unobtrusive counter (`12 / 79`) at the top of the screen. No progress bar — the minimalist principle.

### Re-rate from the leaderboard

Tapping a row on `/ranking` flips it open to an inline star editor (same 10 pill buttons, plus a "clear rating" action). Selecting a new value updates the store and collapses the row; clearing removes the rating and moves the dish to the "unrated" section.

**Why inline instead of a modal:** modals break the minimalist feel and cover context. An inline flip keeps the user in the same visual place.

### Undo the last rating

The home flow exposes an "undo" action (backspace on desktop, a secondary button on phone) that reverts the most recent rating written in this *session*. Undo is not time-travel across sessions — once the page is reloaded, the session undo stack is cleared. Server-side crash undo beyond session is out of scope.

**Why session-only undo:** storing an undo log across sessions is persistence complexity we don't need. The `/ranking` inline re-rate already covers long-term correction. Session undo is just a safety net for fat-finger taps in the immediate flow.

### Navigation between modes

- Home screen has a small top-end control: `משחק ←` linking to `/game`.
- Home screen has a top-start control: `דירוג →` linking to `/ranking` (star-based).
- `/game` has a top-end `בית →` back to home.
- `/game` has a top-start `תוצאות ←` to `/game/results`.
- `/game/results` has a top-end back to `/game`.
- `/ranking` (star-based) has a top-end `בית →` back to home.

All of these are plain anchor tags with the same pill styling as the existing controls.

### Import/export scope

Each store exports and imports its own slice. The `/ranking` page's export button produces a star-only JSON; the `/game/results` page's export button produces an event-log JSON. There is no combined backup in v1.

**Why:** the two stores are deliberately independent. A single combined backup would imply they belong together, which contradicts the decision. A future MongoDB schema can still colocate them per-user without forcing the frontend to pretend they are one blob.

## Risks / Trade-offs

- **Doubling the number of persistence stores** — every future refactor (Mongo adapter, schema change, migration tool) costs 2× → mitigated by giving both stores identical interface shapes and colocating their adapters under `src/lib/stores/`. Effort stays tight because the patterns are literally the same.
- **Users who've already built up Elo history will find their home screen "reset"** — when they reopen the app, home is blank-slate star rating. Their Elo history is still alive under `/game/results` but they have to know to navigate. Mitigated by the top-end "משחק" control on the home screen and a one-line hint on first empty-state render.
- **Integer 1–10 scale risks clustering** (users gravitate to 7–8 because "above average") → accepted for v1. Observable from the distribution in `/ranking`; if the top quartile all looks like 8s after a few weeks of use, we revisit in a follow-up change with a pairwise-as-tiebreaker flow.
- **Popularity-descending queue biases the user toward rating the most popular dishes first** and may leave obscure dishes perpetually unrated → accepted; those dishes stay in the queue indefinitely and eventually surface.
- **Re-rating doesn't keep history** → accepted; the user doesn't want a timeline view of their preferences. If they ever do, it's an additive change to the stars store.
- **Two separate exports instead of one combined file** may confuse users who expect "the backup" → documented in the ranking screen's export button tooltip/label; acceptable for a personal tool.

## Migration Plan

1. Move the existing `src/routes/+page.svelte` verbatim to `src/routes/game/+page.svelte`. No logic changes.
2. Create the new `/game/results/+page.svelte` from the existing `/ranking/+page.svelte`'s Elo rendering logic (copy, then the old `/ranking` gets replaced).
3. Write the new `/+page.svelte` with the star-rating flow.
4. Rewrite `/ranking/+page.svelte` to render the star-based leaderboard with inline re-rate controls.
5. Add the new `stars-store.ts` interface and `local-storage-stars-store.ts` adapter.
6. Verify via manual QA that: (a) pairwise game at `/game` still works unchanged; (b) the home flow lands on an unrated popular dish; (c) rating advances the queue; (d) re-rating from `/ranking` works; (e) both game and star leaderboards are reachable from both directions.
7. No data migration. Existing users see their old Elo history only at `/game/results`; their star flow starts empty.

## Open Questions

- **"All done" state** — when every dish is rated, what does the home show? Proposal default: a static message with links to `/ranking` and `/game`. Alternative: auto-redirect to `/ranking`. Going with the static message because auto-redirect feels like the app is "over."
- **Does undo work on touch devices?** Proposal default: yes, as a small secondary button in the footer, next to "skip." If it feels clutter-y in practice we drop it from touch and keep it desktop-only on Backspace.
- **Does the `/ranking` page surface the rating distribution** (how many 10s, 9s, etc.)? Proposal default: no — just the sorted list. Distribution is a future follow-up if it turns out to be useful.
