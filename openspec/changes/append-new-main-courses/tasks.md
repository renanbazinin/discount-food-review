## 1. CLI flag plumbing

- [x] 1.1 Parse `process.argv` in `scripts/scrape.ts` to detect an `--append` flag and expose it as a boolean inside `main()`.
- [x] 1.2 Log the active mode at the top of the run (`mode: full-rebuild` vs `mode: append`) so it is obvious in CI/manual output which path executed.
- [x] 1.3 Add a `scrape:append` convenience script to `package.json` that runs `tsx scripts/scrape.ts --append` (or equivalent), while leaving the existing `scrape` script untouched.

## 1a. Tighten main-course filters (applies to both modes)

- [x] 1a.1 In `scripts/classifier.ts`, add `'טלבנק'` and `'GTG'` to `CATEGORY_SKIP_PATTERNS` and remove `'טלבנק'` from `GENERIC_CATEGORY_PATTERNS` — these categories should be skipped entirely, not just name-filtered.
- [x] 1a.2 Make `isSkippedCategory` match case-insensitively for Latin characters so `GTG`, `gtg`, and `Gtg` all match. Hebrew patterns are unaffected since Hebrew has no case.
- [x] 1a.3 Add a dish-level skip for any dish name still containing `טלבנק` as a safety net (covers cases where a טלבנק-marked dish slips in from a non-skipped category). Existing `cleanTelbankName` / `containsTelbank` helpers stay, but `processRestaurant` should now skip rather than clean.
- [x] 1a.4 Confirm existing dishes already in `data/restaurants.json` are NOT affected: append mode preserves them by id regardless of these filter changes.

## 2. Load existing catalog in append mode

- [x] 2.1 When `--append` is set, read and `JSON.parse` the current `data/restaurants.json` into the `{ restaurants: OutRestaurant[] }` shape before fetching anything.
- [x] 2.2 Build a `Map<number, Set<string>>` keyed by restaurant id → set of existing dish ids (stringified), so lookups during the merge are O(1) per dish.
- [x] 2.3 If the file is missing or unparseable, fail loudly with a clear error (append mode requires a base file — do not silently fall back to full rebuild).

## 3. Non-destructive merge in `processRestaurant`

- [x] 3.1 Refactor `processRestaurant` (or wrap it) so that in append mode it receives the per-restaurant "existing ids" set and the existing `OutRestaurant` record.
- [x] 3.2 Inside the category loop, after all existing filters (`isSkippedCategory`, `isGenericCategory` + `isSkippedDish`, telbank cleanup) decide a dish is a keeper, additionally skip the dish if its `dishId` is already in the existing-ids set — do NOT call `downloadImage()` for skipped dishes.
- [x] 3.3 Apply the existing per-batch name dedupe only to the *newly fetched* dishes, not against the historical set (documented in design.md §Decisions).
- [x] 3.4 Return the merged dish list as `[...existingDishes, ...newlyAppendedDishes]` so existing ordering is preserved and new items land at the end.
- [x] 3.5 Log a per-restaurant summary line of the form `append  <restId>  <name>  +N new  (M existing kept)` so the operator can eyeball the diff before committing.
- [x] 3.6 Emit a warning (but still append) when a newly-fetched dish has a name that collides with an existing dish in the same restaurant — this matches the design decision to prefer id-based identity over name-based.

## 4. Write-out and safety

- [x] 4.1 In append mode, after every restaurant has been processed, write the merged `{ restaurants }` object to `data/restaurants.json` in a single `writeFileSync` call (mirrors the existing full-rebuild write).
- [x] 4.2 Confirm that `downloadImage()`'s existing short-circuit (`if (existsSync(abs)) return rel;`) means no existing image file is re-fetched or overwritten — add a code comment pointing at the guarantee, do not add new logic.
- [x] 4.3 Print a final summary: `==> append mode: +X new dishes across Y restaurants (Z total dishes now in catalog)`.

## 5. Validation

- [x] 5.1 Run `npm run check` to make sure the script still typechecks.
- [x] 5.2 Run `npm run scrape -- --append` locally and inspect `git diff data/restaurants.json`: every existing dish object must be byte-identical; only additions should appear in the diff.
- [x] 5.3 Spot-check that the number of newly-appended dishes matches the restaurant-by-restaurant summary printed in step 3.5.
- [x] 5.4 Verify the new image files exist under `data/images/` for each appended dish id (or that the dish legitimately has no `dishImageUrl`).
- [ ] 5.5 Run `npm run build` to confirm the bundled catalog still loads without errors.
- [ ] 5.6 Sanity-check the leaderboard in `npm run dev` — existing dishes keep their ratings; new dishes appear unrated.

## 6. Documentation

- [x] 6.1 Update `CLAUDE.md` Commands section to mention `npm run scrape -- --append` (or `npm run scrape:append`) and explain when to use it vs the full rebuild.
- [ ] 6.2 Commit `data/restaurants.json` and any new `data/images/*` files together in a single commit that references this change name.
