## Context

The app is a SvelteKit SPA with `@sveltejs/adapter-static`, `ssr: false`, and four routes (`/`, `/rate`, `/game`, `/game/results`). It has two independent localStorage-backed stores, a pairwise Elo engine, a star-rating flow, a bottom tab bar, and a dish catalog loaded from a static JSON file. The dish catalog is 79 main courses across 5 Hebrew-language 10bis restaurants, scraped offline, and is shared unchanged by this change.

The user has decided the app should become a shared one-vote "favorite main course" app — one screen, one interaction, anonymous votes, Mongo-backed leaderboard, honor-system identity via localStorage. This collapses the app's surface area by about 70% and replaces the data model entirely.

## Goals / Non-Goals

**Goals:**
- The app has exactly one screen. Opening the app shows your current vote (or an empty state), the leaderboard, and a tap-to-vote interaction.
- MongoDB Atlas is the authoritative store for vote records. Every reader sees the same leaderboard.
- Every vote record in Mongo is anonymous — `{ voteId, dishId, timestamp }`. No user id, no IP, no fingerprint.
- The current browser's vote lives in `localStorage` under `vote:v1` as `{ voteId, dishId, timestamp }`. Changing a vote is one round-trip to the server plus one localStorage write.
- The network layer throws clear errors on failure; the UI already has the error-state plumbing to render them.
- The `mongodb` driver is isolated to `src/lib/server/` and cannot be imported from client code (SvelteKit enforces this for `$lib/server/`).
- The build fails loudly at build time if `MONGODB_URI` is missing.
- The app works in local dev, as a `node build` process, and on any Node host.
- Visual language stays the friendly one from the previous change: hero card, warm copy, empty state illustration, skeleton loading.

**Non-Goals:**
- User accounts, authentication, password reset, magic links. Anti-abuse is explicitly honor-system.
- Offline mode. The app needs network. If Mongo is unreachable, the user sees a clear error.
- Migration of existing localStorage data (stars or pairwise events). Those keys are abandoned. A future change could surface "you had 12 ratings in the old app, here's a JSON of them" but it's out of scope.
- Preserving the pairwise game as a parked/hidden route. Full deletion. The code can be recovered from git if someone ever wants it back.
- Multi-region Mongo, sharding, replica-set tuning, or any infrastructure concern beyond a default Atlas free-tier cluster.
- Search, filter, or restaurant-grouping on the leaderboard. Single flat list. Can be revisited if 79 dishes feels like too many to scroll.
- Rate limiting the API at all (no IP limiting, no vote-cooldown, nothing). Honor system, documented.
- Changing the dish catalog or the scraper.

## Decisions

### Adapter swap: static → node

Replace `@sveltejs/adapter-static` with `@sveltejs/adapter-node` in `svelte.config.js`. Drop `prerender = true` from `src/routes/+layout.ts`. Keep `ssr = false` so pages are still client-rendered; the Node adapter just also serves the dynamic `/api/*` routes.

**Why:** browsers cannot speak the Mongo wire protocol, so a server runtime is required. The Node adapter is the lightest SvelteKit adapter that hosts server-side endpoints. Vercel/Netlify/etc. adapters would also work but add platform coupling. `@sveltejs/adapter-node` is portable across any Node host including self-hosted.

The dish dataset under `data/` continues to be served as a static asset because `kit.files.assets = "data"` is orthogonal to the adapter choice.

### Schema: one anonymous collection

```ts
// votes collection in the food-ranking database
interface VoteDoc {
  _id: ObjectId;           // Mongo-generated
  voteId: string;          // client-generated UUID, unique
  dishId: string;          // matches catalog id, includes -t / -r suffix
  timestamp: number;       // ms since epoch, server-set at insert time
}
```

**Indexes:**
- `{ dishId: 1 }` non-unique — speeds up the leaderboard group-by aggregation.
- `{ voteId: 1 }` unique — enforces that vote ids are globally distinct and makes "delete by voteId" an indexed point lookup.

That's the entire schema. No user id. No compound keys. No joins. No references.

**Why per-vote records instead of per-dish counters (Option B over Option A):** counters are simpler on paper but they destroy future analytics — you can never ask "how did votes distribute across restaurants?" or "was there a burst of voting last Tuesday?" once the data is gone. Per-vote records are strictly more expressive at the cost of one aggregation query per leaderboard read. At the app's scale (79 dishes, a realistic ceiling of low thousands of votes over the app's lifetime) the aggregation cost is measured in microseconds. The expressiveness is permanent.

**Why `voteId` instead of using Mongo's `_id` as the public id:** the client needs to know its own vote's identifier to tell the server "delete this specific vote" or "replace this specific vote with a new one for dish X." Mongo's `_id` works functionally but is awkward to round-trip through JSON (it's an `ObjectId`, not a string). A separate client-generated `voteId` is simpler and matches the pattern we already used for event ids in the old pairwise store.

### Leaderboard query

```js
db.votes.aggregate([
  { $group: { _id: '$dishId', count: { $sum: 1 } } }
])
```

Returns `[{ _id: dishId, count: n }, ...]` for every dish that has at least one vote. The API handler normalizes to `[{ dishId, count }, ...]` and returns it. The client merges this with the local dish catalog to render rows for every dish, including dishes with 0 votes (which are absent from the aggregation result).

**Performance:** at 79 dishes and tens-to-hundreds of vote documents, the aggregation is well under a millisecond. No caching, no materialized view, no precomputed counts. If votes ever climb into the tens of thousands we add a cached-per-minute layer; until then, correctness over complexity.

### Vote lifecycle

```
 FIRST VOTE
 ──────────
   client: POST /api/votes  { dishId: "X" }
           (no oldVoteId — no current vote)
   server: voteId = uuid();
           insert { voteId, dishId: "X", timestamp: now() }
           return { voteId, dishId: "X", timestamp }
   client: localStorage['vote:v1'] = { voteId, dishId: "X", timestamp }

 CHANGE VOTE
 ───────────
   client: POST /api/votes  { dishId: "Y", oldVoteId: "abc" }
   server: deleteOne { voteId: "abc" }
           voteId = uuid();
           insert { voteId, dishId: "Y", timestamp: now() }
           return { voteId, dishId: "Y", timestamp }
   client: localStorage['vote:v1'] = { voteId: new, dishId: "Y", timestamp }

 UNVOTE
 ──────
   client: DELETE /api/votes/abc
   server: deleteOne { voteId: "abc" }; return 204
   client: localStorage.removeItem('vote:v1')
```

**Atomicity of change-vote:** two writes (delete old + insert new). Not wrapped in a transaction. Mongo transactions on Atlas free tier are supported but add dependency on replica-set config and complicate the code. At honor-system scale, the ~1ms window where a user's old vote is deleted before the new one is inserted is invisible to other observers of the leaderboard and harmless if it happens mid-aggregation (one dish's count briefly undercounts, the next request recovers).

**If the client's `oldVoteId` points to a doc that no longer exists** (e.g. someone cleared the database): the server's `deleteOne` is a no-op (returns `deletedCount: 0`), the insert still runs. The client's localStorage is updated to the new vote. No error surfaces. This is the correct behavior — the old vote genuinely doesn't exist anymore.

**If the client has a stale `voteId` in localStorage** (server was wiped, client keeps its old vote id): first request succeeds but the server stores a brand-new record and the client replaces localStorage correctly. No migration glue needed.

### API surface

```
GET    /api/leaderboard      → 200 [{ dishId, count }]
POST   /api/votes            → 201 { voteId, dishId, timestamp }    (cast or change)
DELETE /api/votes/[voteId]   → 204                                  (unvote)
```

Three routes. That's the entire network contract.

**Why not `PUT /api/votes/[voteId]` for change-vote?** The `voteId` is consumed (deleted) and a new one is created on every change, so `PUT` doesn't match the semantics. `POST /api/votes` with an optional `oldVoteId` in the body matches the "produce a new resource, optionally superseding an old one" reality.

**Error codes:**
- `400` — invalid body (missing `dishId`, unknown `dishId`, wrong types).
- `503` — Mongo unreachable at the connection layer.
- `500` — any other unexpected server error, with `{ error: string }`.
- No `404` on unvote of a non-existent `voteId` — it's a `204`, because the client's desired end state (that vote is gone) is achieved.

### Client store interface

```ts
interface VotesStore {
  // network
  getLeaderboard(): Promise<VoteCount[]>;
  vote(dishId: string): Promise<MyVote>;      // cast or change, based on current localStorage
  unvote(): Promise<void>;
  // local — reads localStorage, no network
  getMyVote(): MyVote | null;
}

interface VoteCount {
  dishId: string;
  count: number;
}

interface MyVote {
  voteId: string;
  dishId: string;
  timestamp: number;
}
```

**Why `getMyVote()` is synchronous** when everything else is async: it's a pure localStorage read, it runs in microseconds, and every UI component that renders "is this the user's pick?" needs the answer *before* the network round-trip resolves. Making it async would force every render path to be wrapped in an extra load state with no benefit. The rest of the interface stays async because it involves the network.

**Module-level singleton:** `http-votes-store.ts` exports `votesStore: VotesStore = new HttpVotesStore()`. UI imports it from there. Same pattern as the previous stores.

### Home composition

```
┌─────────────────────────────────────────┐
│  דירוג אוכל                              │   header (title only)
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │   [ my vote: hero image ]       │   │   hero card:
│  │                                 │   │   "הבחירה שלך"
│  │   המבורגר אנטריקוט              │   │   + tappable to change
│  │   דיינר · ₪40 · 17 הצביעו       │   │
│  └─────────────────────────────────┘   │
│                                         │
├─ הדירוג ────────────────────────────────┤
│ 1. 🥇 [img] המבורגר אנטריקוט  17 קולות │
│ 2. 🥈 [img] לברק שום שחור     14 קולות │
│ 3. 🥉 [img] קבב קצבים         12 קולות │
│ 4.    [img] פיצה פונגי         9 קולות │   leaderboard list
│ ...                                    │
├─ מנות שעדיין לא הצביעו — 40 ───────────┤
│  ?   [img] ...                         │   unvoted dishes (muted)
└─────────────────────────────────────────┘
```

**Rules:**
- **Hero**: shown when the user has a vote in localStorage. Displays the dish image (or typographic fallback), name, restaurant, price, and the current global count for that dish. Labeled "הבחירה שלך". Tappable — tap opens a brief "change my vote?" interaction (below).
- **Empty state** when the user has no vote: hero position shows a friendly "עדיין לא הצבעת" headline + short hint + inline illustration. No CTA button is needed because the leaderboard below is tappable and that's the CTA.
- **Leaderboard section**: all dishes with vote count > 0, sorted by count descending, ties broken by `popularity` descending (the scraped 10bis signal — gives deterministic ordering instead of jitter).
- **Unvoted section**: below a labeled divider `מנות שעדיין לא הצביעו · {N}`. All dishes with zero votes, sorted by `popularity` descending. Muted opacity.
- **Tap behavior**: tapping any row in either section casts the user's vote for that dish (or changes it if they already have one). Immediate UI feedback: the tapped row animates a +1 count, the old row (if any) animates a −1, the leaderboard re-sorts, the hero updates.
- **No explicit "unvote" button on the hero** — the user clears their vote by tapping their current hero dish again (toggle semantics). This is optional; if clarity matters more than minimalism we add a small "לבטל" link. Flagging as an open question.
- **Loading state**: shimmer skeleton for the hero + 5 list rows, same CSS class as the previous change.

### Optimistic UX

**Yes**, but carefully. When the user taps a dish:
1. Immediately write the new vote to localStorage.
2. Immediately update the in-memory counts map (`counts[new]++`, `counts[old]--` if applicable).
3. Fire `POST /api/votes` in the background.
4. If the server responds successfully, update localStorage with the server-returned `voteId` and do nothing visible.
5. If the server responds with a 4xx/5xx, revert the optimistic update, show an error toast, roll back localStorage to the previous state.

**Why:** a single-tap vote interaction that waits 300-500ms for a round-trip before responding feels broken. Optimistic update with rollback is the standard pattern and is cheap here because the failure domain is small (network or Mongo hiccup).

### Connection lifecycle

Lazy singleton `MongoClient` cached at module scope in `src/lib/server/db.ts`. First call to `getCollections()` constructs, connects, creates indexes, caches. Subsequent calls return the cached accessor. No per-request connection churn. No shutdown hook (host owns process lifecycle).

### Env config

```
# .env (gitignored)
MONGODB_URI=mongodb+srv://USER:PASS@cluster0.rsn8ez5.mongodb.net/food-ranking?retryWrites=true&w=majority&appName=Cluster0
```

Loaded via `$env/static/private` in `db.ts`. Server-only at the bundler level. Build fails with a clear message if missing. `.env.example` ships in the repo with the placeholder.

No `LOCAL_USER` variable — there's no user concept in this data model.

### Honor-system abuse, acknowledged

A motivated user can open incognito, clear site data, or use a different browser to vote multiple times. This is **accepted** because:
- The audience is the user and a handful of friends, already agreed.
- Server-side rate limits (IP-based) don't cost much to add but aren't required for this audience.
- Real identity (auth) is a much bigger change and was explicitly ruled out.

If the app is ever shared beyond that audience, the `proposal.md` of the successor change should flag this as a prerequisite revisit.

## Risks / Trade-offs

- **Deploy story changes to Node** → accepted; pure-static hosting is no longer viable. Local dev is unchanged.
- **Losing all existing localStorage data** (prior stars, prior pairwise events) → accepted; it was personal, not shared, and the user is explicitly moving away from that model.
- **No rate limiting** → honor system is intentional. Documented. Not fine if the audience expands.
- **Optimistic UI with rollback adds a small amount of state machinery** → worth it for the one interaction that defines the app's feel.
- **Two-write change-vote without a transaction** → invisible at this scale; the worst case is one dish's count briefly off by 1 mid-aggregation. Not worth a transaction today.
- **Collapsing the app to one screen removes optionality** → that's the point. If we want a second screen later (e.g. analytics) we add it, but the default is "one thing, well."
- **Deleting the pairwise game burns a lot of working code** → recoverable from git. If the user ever wants it back, a new change pulls the files from history. We are not trying to avoid deletion for its own sake.
- **The `mongodb` Node driver is ~3 MB installed** → only on the server bundle. Client bundle unaffected (SvelteKit's bundler excludes `$lib/server/`).

## Migration Plan

1. **User completes Atlas prerequisites** (Group 1 of tasks.md): create DB user, allowlist IP, drop URI in `.env`.
2. **Delete the old surfaces** (routes `/rate`, `/game`, `/game/results`; lib files for stars, ranking, old stores, old UI components). Tasks group 2.
3. **Swap adapter + deps** (`adapter-static` → `adapter-node`, add `mongodb`). Tasks group 3.
4. **Implement the server** (`db.ts`, three API routes). Tasks group 4.
5. **Implement the client** (`VotesStore`, `HttpVotesStore`, the two new UI components, the rewritten `+page.svelte`, the simplified `+layout.svelte`). Tasks group 5.
6. **Trim `types.ts`** to the kept types. Tasks group 6.
7. **Verify**: type check, build with dummy URI, smoke test against a real URI if the user has completed Group 1. Tasks group 7.

There is no rollback plan because there is no deploy being rolled back — this is local development. If the change doesn't work, we fix it forward.

## Open Questions

- **Explicit "unvote" button on the hero?** Default: no, toggle semantics (tap current vote again to unvote). If user finds this confusing we add a small "לבטל הבחירה" link.
- **Server-side dishId validation?** Default: yes — reject votes for unknown dishIds with `400`. Costs reading the static dish catalog at server startup. Alternative is to trust the client completely; not worth the brittleness.
- **Should the unvoted-dishes section be lazy-loaded** or always rendered? 40-50 unvoted rows at startup is trivial for 79 dishes. Rendering it all unconditionally is fine today; revisit only if the catalog grows past a few hundred dishes.
- **Show the current global total ("127 people voted")** somewhere in the header? Default: not yet; we can add it as a small header pill later if the user wants the social proof.
