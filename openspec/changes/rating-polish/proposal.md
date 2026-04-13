## Why

The app's core interaction — tapping a dish to rate it — works, but has three small frictions that compound because the user repeats this interaction dozens of times per session:

1. **On `/`, the inline expansion pushes rows below it down.** Tapping row 14 shifts row 15 out of view; the user loses their place on the leaderboard.
2. **There's no visual confirmation that a rating landed.** The average silently updates. With optimistic UI already in place, the lack of feedback makes the state change feel ambiguous.
3. **On `/rate`, undo is a desktop-only `Backspace` plus a tiny footer button.** Thumbs-on-phone users have no natural gesture for "oops, go back."

None of these are blockers, but they are the interactions the user does most. Sharpening them is the highest-yield polish work available without adding features.

## What Changes

### 1. Bottom sheet for inline rating on `/`

- **Replace the inline `slide`-down rating panel** (currently rendered under the tapped row and under the hero) with a single shared **bottom sheet** that slides up from the bottom of the viewport, above the bottom tab bar.
- Sheet contents: dish name + restaurant (compact header), the existing `StarSelector`, the existing `נקה דירוג` action when the user already has a rating.
- Backdrop tap, a drag-down gesture (touch only), or an `×` button closes it. Escape closes on `(pointer: fine)`.
- Only one sheet open at a time; tapping another row while a sheet is open swaps contents without a close-then-open flicker.
- The underlying leaderboard does **not scroll** when the sheet opens — scroll position is preserved exactly.
- The hero card and the row `RatingRow` components are unchanged structurally; only the `openId`-driven expansion blocks are removed in favor of the sheet.

### 2. Shimmer confirmation on the average after a rating

- When `onRate` succeeds (optimistic path, not waiting for the server), the affected row's `averageStars` text runs a **one-shot ~450ms shimmer/highlight** (accent color fade-in → fade-out) so the user sees that the number they're looking at is the one that just changed.
- The hero card's average gets the same treatment when rated from the hero.
- Pure CSS keyframe + a Svelte `{#key}` re-mount hook tied to `(dishId, averageStars)`; no JS animation loop, no timers that need cleanup on unmount.
- Disabled under `prefers-reduced-motion`.

### 3. Swipe-to-undo on `/rate`

- After a rating is recorded on `/rate`, the user can **swipe left-to-right (RTL natural direction: right-to-left visually = "back")** anywhere on the main card area to undo the last rating.
- The gesture uses `pointerdown` / `pointermove` / `pointerup` on the dish card container — no library. Threshold: 60px horizontal travel with < 30px vertical, within 600ms.
- On successful undo it calls the existing `undo()` function (no new code path) and shows the dish again.
- Keyboard `Backspace` continues to work on desktop, unchanged.
- The footer `חזור אחורה` button stays as a fallback and for discoverability; after the first successful swipe-undo, a one-shot hint badge appears next to the button for that session ("or swipe ←").

## Non-goals

- **Long-press to clear a rating.** Too ambiguous with scroll gestures; kept as an explicit button inside the sheet.
- **Swipe gestures on the `/` leaderboard.** Only `/rate` gets swipe-undo; the home page keeps tap-only to avoid conflicting with vertical scroll.
- **Reordering, filtering, or any change to what is shown.** This change is purely about how existing interactions feel.
- **Haptics.** The `Vibration` API is inconsistent across iOS Safari; not worth the branch logic.

## Capabilities

### Modified Capabilities

- `star-rating`: the home screen's inline rating UI is replaced by a bottom-sheet; the average-stars text gains a post-rate shimmer affordance. Rating storage, queue ordering, and leaderboard contents are unchanged.
- `rate-queue` *(or the relevant `/rate` capability — reconcile at archive time)*: adds a swipe-to-undo gesture on the current-dish card.

## Impact

- **Affected files**:
  - `src/routes/+page.svelte` — remove the two inline expansion blocks (hero + row), wire a single `RateSheet` component bound to `openId`
  - `src/routes/rate/+page.svelte` — attach pointer handlers to the dish card wrapper, add the session-only hint state
  - New: `src/lib/ui/RateSheet.svelte` — bottom-sheet shell reusing the existing `StarSelector` and clear button
  - New: `src/lib/ui/ShimmerNumber.svelte` *(or an inline class — decide during implementation based on reuse count)*
  - `src/app.css` or a component-scoped `<style>` — the shimmer keyframe, the `prefers-reduced-motion` guard, and the bottom-sheet transform/transition rules
- **No changes** to API routes, MongoDB, catalog, queue ordering, or `BottomTabBar`.
- **No new runtime dependencies.**
- **Accessibility**: the sheet is `role="dialog"` with `aria-modal="true"` and focus trap; swipe-undo does not replace any existing affordance, it augments it.
