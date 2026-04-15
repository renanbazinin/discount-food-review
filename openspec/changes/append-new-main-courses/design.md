## Context

`data/restaurants.json` is the single source of truth for the dish catalog. It is built offline by `scripts/scrape.ts`, bundled into the server build via a static import in `src/lib/server/catalog.ts`, and referenced at runtime by `dishId` in MongoDB `ratings` documents. 10bis menu URLs churn: items get added and removed over time. The user wants to pick up new main courses without touching any existing entry — because rewriting or dropping a dish would silently orphan real user ratings.

The current `scripts/scrape.ts` flow is a full rebuild:
1. Read `data/restaurants.config.json`
2. For each restaurant id, fetch `getRestaurantMenu`, filter categories and dishes via `scripts/classifier.ts`, download images, dedupe by dish id and by normalized name.
3. Overwrite `data/restaurants.json` end-to-end.

We need a second mode that unions new results into the existing file instead of overwriting it.

## Goals / Non-Goals

**Goals:**
- Append newly-listed main courses from 10bis to `data/restaurants.json` for the six restaurants already in `data/restaurants.config.json`.
- Guarantee zero changes to existing dish entries: same `id`, `rootId`, `name`, `description`, `price`, `image`, `imageUrl`, `category`, `popularity`, `isPopular`, `orderMethod`.
- Keep the same main-course filtering rules the full scrape uses, so only main courses (not sides/drinks) get appended.
- Make the append behavior opt-in via a CLI flag so the default `npm run scrape` remains a full rebuild for anyone who wants that.

**Non-Goals:**
- Refreshing prices, images, or popularity scores of existing dishes. (If 10bis changed a price, we intentionally keep the stale value — the trade-off for rating-id stability.)
- Removing dishes that 10bis has delisted. Existing entries stay even if the upstream menu no longer returns them.
- Adding new restaurants. The restaurant set still comes from `data/restaurants.config.json`.
- Any runtime/server/API/UI change. This is a build-time tooling change only.
- Backfilling a migration table or similar — there is nothing to migrate; existing rows already match by `dishId`.

## Decisions

### Decision: Append mode lives in `scripts/scrape.ts` behind a CLI flag

Add a `--append` flag (parsed from `process.argv`) to the existing script rather than creating a second script.

- **Rationale**: The filtering pipeline (category skips, generic-category dish filter, telbank cleanup, per-restaurant name dedupe, image download) is non-trivial and must stay byte-identical between modes to guarantee that "a dish would have been kept by the full scrape" and "a dish is appended by append mode" always agree. Two scripts would drift.
- **Alternative considered**: A separate `scripts/scrape-append.ts`. Rejected — duplication risk.
- **Alternative considered**: Always union (no flag, `npm run scrape` becomes non-destructive by default). Rejected — the user asked for append as an additive action; preserving a clean "wipe and rebuild" escape hatch is valuable when we *do* want to reset.

### Decision: Identity key is the numeric 10bis `dishId`

A dish is "already known" iff its numeric 10bis `dishId` (stringified, which is what the catalog stores as `id` / `rootId`) is present in the existing `data/restaurants.json` under the same restaurant.

- **Rationale**: `dishId` is what MongoDB ratings reference; it is the only identifier that matters for user data integrity. It is also what 10bis itself uses as a stable key.
- **Alternative considered**: Matching by normalized name. Rejected — name-level dedupe is already applied *within* a scrape run as a secondary pass (see `scripts/scrape.ts:165-174`), but it is not reliable across time: 10bis sometimes tweaks a dish name (e.g. spelling, spacing, emoji) without changing `dishId`. Keying on name would cause false "new" entries.

### Decision: Scope of the "existing set" is per-restaurant, not global

We build a `Set<string>` of existing dish ids per restaurant and compare the incoming dish list against that set. A dish with the same 10bis id under a *different* restaurant would be appended (this effectively cannot happen in practice, but the scoping keeps the logic simple and local).

- **Rationale**: Restaurants are independent in the JSON structure; per-restaurant scoping mirrors that.

### Decision: Cross-restaurant name dedupe is not enforced

The existing scrape's per-restaurant name dedupe runs on the *newly fetched* batch only. We do not re-run it against the full historical set. If 10bis adds a new dish id whose name happens to collide with an existing dish in the same restaurant, we will append it as a new entry.

- **Rationale**: Keeps append semantics simple and predictable: "id not in file → append." Expected frequency is near zero, and the downside is a duplicate-looking leaderboard row, not data loss.
- **Mitigation**: The implementer will log a warning when this happens so a human can manually dedupe if needed.

### Decision: Append mode only downloads images for new dishes

Existing `data/images/<dishId>.<ext>` files are never overwritten. New dishes go through the same `downloadImage()` path that the full scrape uses.

- **Rationale**: `downloadImage()` already short-circuits if the file exists (see `scripts/scrape.ts:83`). Append mode gets this behavior for free — we simply never reach `downloadImage()` for dish ids that are already known, so there is no re-fetch and no risk of corrupting existing files.

### Decision: Write strategy — read, merge in memory, write once

Load the existing `data/restaurants.json`, run the full fetch+filter pipeline per restaurant to produce a candidate `OutRestaurant[]`, then for each incoming restaurant merge its new-only dishes onto the existing restaurant's `dishes` array. Write the merged object back with `JSON.stringify(..., null, 2)` exactly once at the end.

- **Rationale**: Matches the existing script's single-write idiom. No partial-state file on disk if something fails mid-run.
- **Ordering**: New dishes are appended at the end of each restaurant's existing `dishes` array. Existing order is preserved so that any tooling or manual review that relies on array position is unaffected.

## Risks / Trade-offs

- **Stale prices / images on existing dishes** → Accepted. Price and image drift is less harmful than losing rating-id stability. Document in proposal so it is a known trade-off, not a surprise.
- **Delisted dishes stay in the catalog forever** → Accepted and intentional. A separate manual cleanup (outside this change) can remove dishes once their ratings are reconciled, but that is out of scope.
- **Filter rules change later** → If `classifier.ts` is updated to exclude a category that used to be included, existing dishes in that category will *not* be retroactively removed by append mode. A full `npm run scrape` (no flag) is still the way to apply such changes.
- **Accidental full-rebuild run overwrites intentional manual edits** → There are no manual edits to `data/restaurants.json` today; if that changes, a pre-write diff or backup step would be warranted. Out of scope for now.
- **New dish whose id collides with nothing but whose name duplicates an existing entry** → Append anyway, log a warning, leave resolution to a human. See decision above.

## Migration Plan

No runtime migration. Rollout is:

1. Implement `--append` in `scripts/scrape.ts` (and optionally add an `npm run scrape:append` alias).
2. Run `npm run scrape -- --append` locally.
3. Inspect the diff on `data/restaurants.json` — every existing line should be unchanged; only new dish objects (and possibly new closing-brace punctuation) should appear in the diff.
4. Verify new image files exist under `data/images/` for the appended dish ids.
5. Commit the updated `data/restaurants.json` and new images together.
6. Deploy as a normal build — no DB migration, no feature flag.

Rollback: `git revert` the commit. Because no existing dish ids were touched, reverting cannot orphan any MongoDB rating — it only re-hides the newly appended ones.
