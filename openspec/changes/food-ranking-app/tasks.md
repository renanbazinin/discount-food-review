## 1. Project scaffold

- [x] 1.1 Initialize a SvelteKit + TypeScript project at the repo root, coexisting with the existing `openspec/` and `data/` directories
- [x] 1.2 Add Tailwind CSS with RTL logical-property usage and configure `app.html` with `<html lang="he" dir="rtl">`
- [x] 1.3 Self-host the Assistant (Hebrew) webfont under `static/fonts/` and wire it into Tailwind's font family config
- [x] 1.4 Configure the SvelteKit static adapter so `data/restaurants.json` and `data/images/` are served as static assets
- [x] 1.5 Add npm scripts: `dev`, `build`, `preview`, and `scrape`

## 2. Data contracts

- [x] 2.1 Define TypeScript types for `Dish`, `Restaurant`, `CatalogDataset`, and `MatchEvent` in `src/lib/types.ts`
- [x] 2.2 Define the `RatingsStore` interface in `src/lib/stores/ratings-store.ts` with fully-async method signatures: `listEvents`, `recordMatch`, `undoLast`, `export`, `import`, `clear`

## 3. Scraper tool

- [x] 3.1 Create `data/restaurants.config.json` seeded with the 5 existing restaurant ids and Hebrew names
- [x] 3.2 Implement `scripts/scrape.ts` that reads the config, fetches `https://www.10bis.co.il/NextApi/getRestaurantMenu?restaurantId={id}` for each entry, handles per-restaurant failures without aborting, and parses the JSON
- [x] 3.3 Implement the category-level skip list (`פופולרי`, `תוספות`, `שתייה`, `משקאות`, `קינוחים`, `רטבים`, `ממרחים`, `מרקים`, `ילדים`, `ראשונות`) as a shared module used by the scraper
- [x] 3.4 Implement the generic-container category patterns (`תפריט`, `Take Away`, `טלבנק`, `Grab&Go`) and the dish-level drinks/sides/desserts filter applied inside them
- [x] 3.5 Implement cross-category dedup by `dishId`, keeping the first occurrence
- [x] 3.6 Implement the טלבנק twin-splitter: for every name containing `טלבנק`, emit `{dishId}-t` (original, `orderMethod: "telbank"`) and `{dishId}-r` (cleaned name, `orderMethod: "regular"`) with a shared `rootId`
- [x] 3.7 Implement image download to `data/images/{dishId}.{ext}`, handling per-image failures by setting `image: null`
- [x] 3.8 Implement the run report: per-restaurant, per-category kept/skipped/total output to stdout
- [x] 3.9 Write `data/restaurants.json` in the documented shape and verify the scraper reproduces the existing exploration dataset

## 4. Catalog loader

- [x] 4.1 Implement `src/lib/catalog/load.ts` that fetches `data/restaurants.json` once at app startup and returns a parsed `CatalogDataset`
- [x] 4.2 Derive `rootId` on every dish by stripping `-t` / `-r` suffixes and cache it on the dish record
- [x] 4.3 Implement `getById(id)`, `areTwins(a, b)`, and `allDishes()` accessors on the catalog module

## 5. Ratings store — LocalStorage adapter

- [x] 5.1 Implement `LocalStorageRatingsStore` satisfying `RatingsStore` under a single key (e.g. `ratings:events:v1`)
- [x] 5.2 Make every method async and return the documented result types
- [x] 5.3 Implement `undoLast()` by dropping the tail of the event array
- [x] 5.4 Implement `export()`/`import()` with shape validation that rejects malformed payloads without touching the existing log
- [x] 5.5 Wire the adapter into a single app-wide accessor so no component imports `localStorage` directly

## 6. Elo ranking engine

- [x] 6.1 Implement standard Elo update with K=32 in `src/lib/ranking/elo.ts`
- [x] 6.2 Implement popularity-seeded priors: min-max normalize `popularity` across the catalog into [1400, 1600], with 1500 as the fallback when all values are equal
- [x] 6.3 Implement a pure `deriveRatings(events, catalog)` function that replays the event log from priors and returns a `Map<dishId, Rating>` with `{ elo, matches }`
- [x] 6.4 Memoize `deriveRatings` at the module level and invalidate on event-log changes

## 7. Pair selection

- [x] 7.1 Implement a pair selector that, with probability 0.3, picks the least-seen dish and pairs it with a random dish within ±100 Elo
- [x] 7.2 Otherwise pick two dishes whose Elo ratings are within ±75, widening the window if no valid pair exists
- [x] 7.3 Apply the twin-pair filter: never emit a pair where the two dishes share a `rootId`; re-roll until a valid pair is produced
- [x] 7.4 Deprioritize dishes flagged via "never seen it" in the coverage branch

## 8. Comparison screen UI

- [x] 8.1 Build the comparison route `src/routes/+page.svelte` that loads the catalog, current events, and shows the next pair
- [x] 8.2 Build the `DishCard` component with full-bleed image, bottom gradient overlay, dish name, restaurant name, and price
- [x] 8.3 Implement the missing-image typographic card variant, with a background color derived deterministically from the restaurant id
- [x] 8.4 Implement single-tap pick: tap a card → `recordMatch` via the store → next pair with a fade transition, no confirmation
- [x] 8.5 Implement "skip" and "never seen it" secondary controls
- [x] 8.6 Bind `←` / `→` keyboard shortcuts on devices where `matchMedia('(pointer: fine)')` matches, mapped for RTL: `←` picks right, `→` picks left
- [x] 8.7 Add a single top-start control that navigates to the ranking route

## 9. Ranking screen UI

- [x] 9.1 Build the ranking route `src/routes/ranking/+page.svelte` that derives ratings and sorts dishes in descending Elo
- [x] 9.2 Split the list into "confident" (matches ≥ 3) and "under-sampled" (matches < 3) sections with a labeled divider
- [x] 9.3 Render each entry with dish name, restaurant name, price, and rounded Elo rating
- [x] 9.4 Add an "export" button that downloads `await store.export()` as a JSON file
- [x] 9.5 Add an "import" button that opens a file picker, shows a replace-log confirmation, and calls `store.import()` on confirm
- [x] 9.6 Add a back control that returns to the comparison screen

## 10. Verification

- [ ] 10.1 Manual pass on a mobile viewport: confirm RTL layout, card tap, keyboard-shortcut absence on touch, and transitions
- [ ] 10.2 Manual pass on desktop: confirm side-by-side cards, `←`/`→` shortcuts, and ranking screen layout
- [x] 10.3 Verify twin dishes never appear as a pair across 100 consecutive generated pairs
- [x] 10.4 Verify export → clear → import round-trip preserves the event log exactly
- [x] 10.5 Verify the scraper reproduces the existing `data/restaurants.json` 1:1 from the 5-restaurant seed config
- [x] 10.6 Verify adding a new restaurant id to `data/restaurants.config.json`, rerunning `npm run scrape`, and reloading the app makes the new dishes appear in the comparison pool
