## Why

The current app navigates via small pill buttons in the top header, which is functional but doesn't match phone-app conventions and makes cross-screen flow feel clunky. More importantly, the home route (`/`) is a *task* — the star-rating flow — which means opening the app lands the user in "work mode" rather than "see my results." The user wants the ranking to be the first thing they see when the app loads, and wants navigation between modes to be always-visible and one-tap, the way native apps handle it.

A short round of UX polish goes with this: warmer copy, a real hero area at the top of home, better empty states, bigger touch targets. The goal is for the app to stop feeling like a prototype and start feeling like something a person would actually open daily.

## What Changes

- **Introduce a persistent bottom tab bar** rendered from the root layout so it's visible on every route. Three tabs: 🏆 דירוג (home), ⭐ דרג (rate), 🎮 משחק (game). Tapping a tab navigates; the active tab is highlighted based on the current pathname.
- **Swap `/` and `/rate`**: `/` now renders the star-based ranking (previously at `/ranking`) and `/rate` now renders the star-rating flow (previously at `/`). The route `/ranking` is retired — or kept as an alias that redirects to `/` — to keep the URL space clean.
- **Home (`/`) gains a hero area** above the leaderboard list. The hero shows the user's current #1 rated dish as a large card with the dish name, restaurant, price, and a friendly "המנה האהובה שלך" label. When no dishes have been rated, the hero becomes a warm empty state inviting the user to start rating, with a prominent CTA that navigates to `/rate`.
- **`/game/results` counts as the "game" tab** — the active-tab indicator highlights 🎮 משחק whenever the pathname starts with `/game`.
- **Visual polish pass** across all routes: warmer Hebrew copy, slightly softer palette, larger tap targets where the current layout has small buttons, loading skeletons instead of bare `טוען…` text, and friendlier empty states on both the home hero and the ranking list.
- **Bottom-safe-area padding**: the main content of every route gets bottom padding equal to the tab bar height plus `env(safe-area-inset-bottom)` so the tab bar never overlaps content and iOS home-bar gestures don't conflict with taps.
- **Remove the in-header ranking/game/home links** now that the tab bar owns cross-screen navigation, so the header gets quieter and the eye can rest on the content instead of the chrome.

## Capabilities

### New Capabilities

- `bottom-navigation`: a persistent bottom tab bar component rendered from the root layout, with three tabs mapping to home/rate/game, pathname-driven active state, safe-area awareness, and the route contract that `/`, `/rate`, and `/game` (plus `/game/*`) are the three top-level destinations.
- `home-ranking-hero`: the redesigned home route at `/` consisting of a hero card showing the current top-rated dish (or a warm empty state), followed by the star-based leaderboard list with inline re-rate. Covers loading skeletons, empty states, and the friendlier visual language.

### Modified Capabilities

<!-- None in spec-delta form: neither prior change (food-ranking-app, star-rating-home) is archived yet, so there are no canonical specs in openspec/specs/ to MODIFY against. The route relocations (/ ↔ /rate) and the removal of in-header nav links are captured in this change's tasks. Spec reconciliation happens at archive time. -->

## Impact

- **Affected routes**: `/+page.svelte` is rewritten from the star-rating flow to the ranking+hero view (it essentially swaps contents with the previous `/ranking` route). A new `/rate/+page.svelte` is created with the contents of the previous `/+page.svelte`. The old `/ranking/+page.svelte` is deleted — an alias can be provided via a 2-line redirect if we care about URL stability, but since no external links exist to `/ranking`, the simpler move is to delete it.
- **Affected layout**: `src/routes/+layout.svelte` gains a persistent `BottomTabBar` component and wraps the page slot in a bottom-padded container. A new `$lib/ui/BottomTabBar.svelte` is added.
- **Affected components**: `NavButton` is still used, but every route's header is simplified to show only the route title and page-specific controls (export/import, undo). All header-level navigation pills are removed.
- **Affected styling**: Tailwind config gains a few semantic color tokens for "warm" surfaces (slightly lighter dark, a gentler accent), a bottom-safe-area utility via Tailwind's arbitrary-value support, and a `.skeleton` shimmer utility. No new dependencies.
- **No changes to**: the scrape tool, `data/restaurants.json`, the Elo engine, `RatingsStore`, `StarsStore`, the queue module, the catalog loader, or the pairwise game logic. Purely a shell + navigation + home-view change.
- **Backward compatibility for users**: existing users who bookmarked `/ranking` will see a 404 unless we add the alias. Since this is a personal/local tool, we skip the alias. Users with stored ratings keep them — the stores are unchanged.
