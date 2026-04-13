## Context

This is a greenfield project. The repo currently contains only `openspec/` and an exploration artifact at `data/restaurants.json` (79 main-course dishes across 5 Hebrew-language 10bis restaurants) plus `data/images/` (43 downloaded JPGs). During exploration we confirmed that 10bis exposes a public JSON endpoint at `https://www.10bis.co.il/NextApi/getRestaurantMenu?restaurantId={id}` that returns categorized dishes with name, description, price, image URL, and a `dishPopularityScore` signal. The page HTML itself is a Next.js SPA shell and is not usable for scraping.

The user wants a phone-first, Hebrew/RTL ranking app that is "minimalist but great." Storage today is `localStorage`; a MongoDB backend will be added later by the same user. The menu set will grow over time as the user adds more 10bis restaurant IDs.

## Goals / Non-Goals

**Goals:**
- One-tap pairwise comparison is the primary interaction. The app opens to a comparison, not a leaderboard.
- Hebrew/RTL is the default rendering direction. No language toggle, no LTR fallback needed.
- A single `RatingsStore` interface owns all persistence. The UI never reads from `localStorage` directly, and the same interface will later be satisfied by a MongoDB-backed adapter with zero UI changes.
- Ratings are derived from an append-only match-event log, not stored as mutable state. This makes undo trivial, migration safe, and replay possible.
- The scrape tool is a standalone script, runnable on demand, that regenerates `data/restaurants.json` from a `data/restaurants.config.json` list of `{id, name}` entries.
- The app works fully offline after first load. No network calls at runtime.
- Desktop is supported as a progressive enhancement: the same components, responsive breakpoint for side-by-side cards, and `←` / `→` keyboard shortcuts for pick-left / pick-right.

**Non-Goals:**
- Multi-user accounts, authentication, or shared leaderboards.
- A MongoDB adapter (shape the interface for it, don't build it).
- A scraper UI inside the app. Running the scraper is a developer action.
- Dish descriptions on screen (the field stays in the data for future use).
- Menu re-fetching from inside the app at runtime.
- Cross-device sync beyond manual export/import of the event log as JSON.
- Detecting broken classifiers automatically. The scraper prints a report and the human eyeballs it.

## Decisions

### Stack: SvelteKit + TypeScript + Tailwind CSS

**Why:** Svelte's built-in transition primitives make the card fade/swap feel polished with near-zero code, which matters disproportionately for a minimalist UI where the transition *is* the feedback. SvelteKit gives us routing, static adapter, and a clean project layout out of the box. Tailwind's logical properties (`ps-*`, `pe-*`, `ms-*`, `me-*`) make RTL a non-event.

**Alternatives considered:**
- **Vite + React + TS + Tailwind** — safe, familiar, larger ecosystem; rejected because it requires more code for the same visual result and Svelte's transitions are a material UX win here.
- **Astro with an island** — smallest bundle, but Elo state and pairwise flow are client-heavy, so the island would swallow most of the page and Astro's static-first model stops paying.
- **Plain HTML + JS, no build step** — tempting, but TypeScript for the `RatingsStore` interface and the future Mongo adapter is worth the build step.

### Ranking: Elo with popularity-seeded priors

**Why:** Elo converges fast on small datasets, produces an absolute score for the leaderboard, and is trivial to update incrementally per match event. Seeding from `dishPopularityScore` (raw number from the 10bis API, min-max normalized to a 1400–1600 window) means the very first comparison already has informed priors — the app feels smart from round 1 instead of showing meaningless random orderings until ~20 votes.

**Formula:** standard Elo, K=32, expected score `1 / (1 + 10^((r_b - r_a) / 400))`, applied to winner/loser after each match.

**Alternatives considered:**
- **Bradley-Terry / TrueSkill** — more statistically sound, but over-engineered for a personal leaderboard and harder to debug.
- **Glicko-2** — adds rating deviation which is useful for "how confident are we" but doubles interface complexity for marginal UX gain at this scale.
- **Plain win-count ranking** — too coarse; indistinguishable scores above the first few items.

### Persistence: append-only event log, derived state in memory

**Why:** Storing match events (`{id, winnerId, loserId, timestamp}`) instead of ratings means: (a) undo is trivial — drop the last event and re-derive; (b) the schema is stable across any ranking-algorithm change; (c) a MongoDB adapter can store events as documents with no translation layer; (d) export/import is a single JSON array. Derived state (current Elo ratings) is recomputed on app start and after each match event; at 79 dishes and realistic match counts (<10k events ever) this is microseconds.

**Alternatives considered:**
- **Store ratings directly** — faster reads at tiny scale, but breaks undo, forces a migration every time the algorithm changes, and couples persistence to one specific ranking scheme.
- **Snapshot + log hybrid** — premature; revisit if replay ever exceeds 50ms.

### Storage interface: one contract, two adapters (one now)

```ts
interface RatingsStore {
  listEvents(): Promise<MatchEvent[]>
  recordMatch(winnerId: string, loserId: string): Promise<MatchEvent>
  undoLast(): Promise<MatchEvent | null>
  export(): Promise<string>           // JSON string of the event array
  import(json: string): Promise<void> // replaces the event log
  clear(): Promise<void>
}
```

All methods are async even in the LocalStorage adapter — matches Mongo's shape so the future swap is a literal file swap. The app uses `RatingsStore` only; never `window.localStorage` directly.

**Why async now:** avoids a later breaking rename of every call site when the Mongo adapter arrives. Cost is one `await` per call, invisible to the user.

### Twin-pair filter

Dishes with the same root ID (e.g. `123456-t` and `123456-r`) are variants of the same dish (טלבנק vs. cleaned) and must never be matched against each other in the pairwise screen. Implementation: before offering a pair, check that `dishA.rootId !== dishB.rootId`. `rootId` is derived by stripping `-t` / `-r` suffixes at load time and cached on the dish object.

### Pair selection strategy

1. With probability 0.3, pick the dish with the fewest match events so far and pair it with a random neighbor within ±100 Elo.
2. Otherwise, pick two dishes whose Elo ratings are within ±75 of each other ("close matches produce more information").
3. Always apply the twin-pair filter.
4. If no valid pair exists under the rating constraint, widen the window until one does.

This biases toward both *coverage* (every dish gets seen) and *informativeness* (close matches).

### Scrape tool

A standalone Node/TypeScript script at `scripts/scrape.ts`, runnable via `npm run scrape`. Inputs: `data/restaurants.config.json` (array of `{id, name}`). Outputs: `data/restaurants.json` (dish dataset) and `data/images/<dishId>.<ext>` (downloaded images). The script encapsulates the classifier we iterated on during exploration — category-level skip list, dish-level drink/side/dessert filter inside generic-container categories, `dishId` dedup, and טלבנק twin-splitting into `-t` / `-r` variants.

The scraper prints a per-restaurant "kept X of Y" report every run so new category names that fall outside the allowlist surface immediately as outlier line items the user can eyeball.

**Why Node/TS instead of Python:** keeps the toolchain monolithic. Python exists during exploration only.

### RTL, fonts, and typography

- `<html lang="he" dir="rtl">` at the root, set once in `app.html`.
- Tailwind with `dir="rtl"` on body; use logical properties exclusively (`ps-*`, `pe-*`, `ms-*`, `me-*`, `start-*`, `end-*`). No `left-*`/`right-*` anywhere in app code.
- Hebrew font: Assistant (Google Fonts) as primary, with system-ui fallback. Self-hosted for offline support.
- Latin runs inside Hebrew (prices, G&G, M/L, restaurant names in English) render via natural Unicode bidi; no special handling needed once the container direction is RTL.

### Images and missing-image fallback

43 of 79 dishes have images; 36 do not (notably the salad bar and some טלבנק-only items). Rather than a generic placeholder icon, missing-image cards render as **typographic cards**: the dish name set large on a colored background derived hashdeterministically from the restaurant id. This turns a data gap into a deliberate stylistic choice and keeps the pairwise screen visually consistent.

Images are stored as static files under `data/images/` and served by SvelteKit's static adapter. No image processing pipeline, no CDN.

## Risks / Trade-offs

- **10bis API is undocumented and could change** → scraper is standalone and rerun on demand; if it breaks, the existing `data/restaurants.json` continues to work offline. No runtime dependency on 10bis.
- **Classifier is keyword-based in Hebrew and will miss edge cases in new restaurants** → scraper prints a kept/skipped report every run; the user eyeballs it and updates the allowlists. Explicitly chosen over an LLM classifier to keep the tool self-contained, free, and deterministic.
- **LocalStorage has a ~5MB cap** → match events at ~80 bytes each give room for ~60k events before the cap, roughly three orders of magnitude past realistic personal use. Not a concern for v1.
- **Elo with popularity priors might look "already ranked" on first open** → accepted trade-off; the alternative (cold start) feels broken to new users. The first 5-10 user votes reshape the top of the list quickly because Elo is responsive.
- **Near-duplicate טלבנק triples** (e.g. a dish that naturally exists in both G&G and טלבנק forms, plus the scraper's cleaned variant) → accepted for v1, documented as a known quirk. Can be addressed in a follow-up change by fuzzy-matching dish names within a restaurant.
- **Async interface imposes a small ergonomic tax today for future flexibility** → one `await` per call; trivial cost, no runtime penalty in the LocalStorage adapter.
- **Pair selection could starve a dish if it keeps losing and falls outside every ±75 window** → the 0.3 least-seen fallback guarantees coverage; verified by invariant: every dish's match count rises monotonically given enough rounds.

## Migration Plan

Greenfield project — no migration. First deploy is:
1. Scaffold the SvelteKit app in place (coexists with `openspec/` and `data/`).
2. Move the existing `data/restaurants.json` into the app's static-assets path (or configure SvelteKit to serve `data/` directly).
3. First run of the scraper validates it reproduces the existing dataset.
4. Local dev only for v1. No deployment target defined.

## Open Questions

- **Landing screen**: comparison-first (activity bias) or leaderboard-first (output bias)? Leaning comparison-first based on phone-primary usage, but the user did not explicitly pick. Captured as the default; revisit if it feels wrong in practice.
- **Export/import format**: plain JSON array of match events is assumed. If a future Mongo adapter stores richer metadata per event (device, session id, etc.), the export shape may need a versioned wrapper. Not a v1 concern, but worth flagging.
- **Deployment target**: none chosen. Local dev is sufficient for v1. Static hosting (Vercel/Netlify/GitHub Pages) is all that would ever be needed and can be decided later.
