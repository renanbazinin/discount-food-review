## Why

The app answers "what's best overall" but not "what should I order right now?" — the actual lunchtime question. Scrolling the leaderboard works, but it requires a decision the user came to the app to avoid. A one-tap "הפתע אותי" button on the home screen turns the leaderboard into a decision-maker: pick from dishes that are already validated (top quartile), surface one at random, let the user reroll or commit. Keeps the app minimal — it's one button — while closing the biggest missing job-to-be-done.

## What Changes

- **New "הפתע אותי" button on `/` (home).** Compact pill, placed in the header row next to the `N / M` counter, visible only when there is at least one eligible dish (see below).
- **Eligibility rule**: a dish is eligible if it has at least `MIN_RATINGS = 2` global ratings and its `averageStars` is in the top quartile of all rated dishes (`>= p75`). If fewer than 4 rated dishes exist, the threshold falls back to "any dish with `ratingCount >= 1`". This keeps the feature useful from day one without recommending single-vote flukes once the data is there.
- **Reveal UX**: tapping the button opens a lightweight overlay card (not a full modal, not a route change) showing the picked dish — image, name, restaurant, price, current average + count, and the user's own rating if any. Two controls: `הפתע שוב` (reroll) and close (tap outside or an `×` button). No navigation, no tab change.
- **Reroll never repeats** the same dish twice in a row unless only one dish is eligible. Session-local memory only.
- **Accessibility**: overlay is a `role="dialog"` with focus trap; Escape closes on desktop; backdrop click closes on touch.
- **No backend changes**, no new API routes, no schema changes. The home page already holds the full leaderboard in memory (`aggregates` + `catalog`), so selection is pure client-side filtering + `Math.random()`.

## Capabilities

### New Capabilities

- `surprise-pick`: random top-quartile dish selection on the home screen, including the eligibility rule, the reveal overlay, and the no-repeat reroll.

### Modified Capabilities

- `star-rating`: the home screen (`/`) gains the surprise-pick entry point in its header. Leaderboard content and inline rating flow are unchanged.

## Impact

- **Affected files**: `src/routes/+page.svelte` (add button + overlay state), one new component `src/lib/ui/SurpriseCard.svelte` for the overlay, one new helper `src/lib/stars/surprise.ts` for the pick function (pure, easy to unit-check).
- **No changes** to `/rate`, the API routes, MongoDB indexes, the scraper, or `BottomTabBar`.
- **No new runtime dependencies.**
- **Minimalism check**: one new button, one overlay, no new tab, no settings. Fits inside the "every pixel earns its place" framing.
