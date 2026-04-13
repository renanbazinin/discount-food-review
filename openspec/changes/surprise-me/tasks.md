## 1. Selection logic

- [x] 1.1 Create `src/lib/stars/surprise.ts` exporting `pickSurprise(dishes, aggregates, opts)` where `opts = { minRatings, excludeId }`
- [x] 1.2 Compute the eligible set: dishes whose aggregate has `ratingCount >= minRatings` AND `averageStars >= p75` of the rated population
- [x] 1.3 Fallback path: if fewer than 4 rated dishes exist, eligible set = all dishes with `ratingCount >= 1`
- [x] 1.4 Return a uniformly random dish from the eligible set, excluding `excludeId` unless it is the only option
- [x] 1.5 Return `null` when there are zero eligible dishes so the caller can hide the button

## 2. SurpriseCard component

- [x] 2.1 Create `src/lib/ui/SurpriseCard.svelte` — props: `dish`, `agg`, `myStars`, `onReroll`, `onClose`
- [x] 2.2 Render a centered card overlay with a dimmed backdrop (fixed position, above the leaderboard, below the bottom tab bar)
- [x] 2.3 Card contents: dish image (or name fallback), name, restaurant + price, average stars + count, user's own star if any
- [x] 2.4 Two controls: `הפתע שוב` button and an `×` close button; backdrop click also closes
- [x] 2.5 Mark the root as `role="dialog"` with `aria-modal="true"` and an `aria-label`; trap focus inside the card while open
- [x] 2.6 Close on Escape key when `(pointer: fine)` matches

## 3. Home integration

- [x] 3.1 In `src/routes/+page.svelte`, add a small `הפתע אותי` pill button to the header, to the left of the `N / M` counter
- [x] 3.2 Hide the button entirely when `pickSurprise(...)` would return `null` (no eligible dishes yet)
- [x] 3.3 On click, compute a pick via `pickSurprise` and store it in a `surprise = $state<Row | null>(null)` plus a `lastSurpriseId` for the reroll exclusion
- [x] 3.4 Render `SurpriseCard` when `surprise` is set
- [x] 3.5 Reroll handler picks again with `excludeId = surprise.dish.id`; updates `surprise` and `lastSurpriseId`
- [x] 3.6 Close handler sets `surprise = null`; `lastSurpriseId` persists for the session so reopening the overlay doesn't immediately repeat

## 4. Verification

- [x] 4.1 Type check passes: `npm run check` with 0 errors and 0 warnings
- [x] 4.2 Production build passes: `npm run build` completes successfully
- [ ] 4.3 Manual: with no ratings in the database, the button is hidden
- [ ] 4.4 Manual: with 1–3 rated dishes, the button appears and picks from any rated dish
- [ ] 4.5 Manual: with ≥4 rated dishes, picked dishes have `averageStars >= p75`
- [ ] 4.6 Manual: reroll does not immediately repeat the prior pick (unless only one is eligible)
- [ ] 4.7 Manual: opening the overlay does not change scroll position of the underlying leaderboard
- [ ] 4.8 Manual: closing the overlay (`×`, backdrop, Escape) returns focus to the surprise button
