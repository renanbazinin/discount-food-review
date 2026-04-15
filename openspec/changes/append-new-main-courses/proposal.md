## Why

The dish catalog in `data/restaurants.json` is a snapshot from when `npm run scrape` was last run against the six 10bis restaurants in `data/restaurants.config.json`. Since then, 10bis has added and removed items on those menus. We want to pick up the newly-added main courses without disturbing existing dish ids — user ratings in MongoDB reference `dishId`, so deleting or re-keying a dish would orphan real rating data.

## What Changes

- Add a non-destructive "append" mode to the scrape script: re-fetch all six restaurants, union the freshly-scraped dishes with the current `data/restaurants.json`, and only write entries that are genuinely new.
- Preserve every existing dish entry as-is (same id, name, image path, popularity, category) even if 10bis has since removed it from the live menu. No deletions, no re-ordering of existing records.
- Match "existing vs new" by `dishId` (the 10bis numeric id, which is already the catalog `id` / `rootId`). A dish whose id is already in the file is skipped entirely — we do not overwrite its fields.
- Keep the current main-course filtering rules (`isSkippedCategory`, `isGenericCategory` + `isSkippedDish`, telbank cleanup, per-restaurant name dedupe) so only new *main courses* get appended — sides, drinks, extras stay excluded.
- Download images only for the newly-appended dishes; existing `data/images/<id>.*` files are left untouched.
- Expose this as a flag on the existing script (e.g. `npm run scrape -- --append`) rather than a second script, so the default `npm run scrape` behavior stays unchanged for anyone who wants a full rebuild.

## Capabilities

### New Capabilities
- `catalog-scrape`: offline tool behavior for refreshing `data/restaurants.json` from 10bis menu endpoints, including an append mode that preserves existing dish ids.

### Modified Capabilities
*(none — no spec-level requirements change; runtime app behavior is identical, only the offline scrape tool gains an append mode)*

## Impact

- `scripts/scrape.ts` — new append path that loads the existing `data/restaurants.json`, builds an id-set per restaurant, and skips already-known dish ids when merging.
- `package.json` — optional convenience script (`scrape:append`) or documented `npm run scrape -- --append` usage.
- `data/restaurants.json` — grows by a handful of entries per restaurant; existing entries untouched.
- `data/images/` — new image files for appended dishes only.
- No server, API, DB, or UI changes. MongoDB `ratings` documents remain valid because every existing `dishId` still resolves to the same catalog entry.
- `CLAUDE.md` note about the catalog being a static bundled import still holds — the file is still regenerated offline and imported at build time.
