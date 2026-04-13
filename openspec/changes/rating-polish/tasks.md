## 1. Bottom sheet on `/`

- [ ] 1.1 Create `src/lib/ui/RateSheet.svelte` — props: `open`, `dish`, `agg`, `myStars`, `busy`, `onRate(stars)`, `onClear()`, `onClose()`
- [ ] 1.2 Render as a fixed-position container anchored to the bottom of the viewport, above the bottom tab bar, with a dimmed backdrop covering the rest of the screen
- [ ] 1.3 Contents: compact header (dish name + restaurant + price), `StarSelector` (current = myStars), `נקה דירוג` button when `myStars != null`
- [ ] 1.4 Mark as `role="dialog"` with `aria-modal="true"`, `aria-labelledby` pointing to the header; trap focus inside while open
- [ ] 1.5 Close on: backdrop click, `×` button, Escape (desktop), drag-down gesture > 80px (touch)
- [ ] 1.6 Svelte transitions: `fly` from `y: 100%` on open, reverse on close, both ~220ms; backdrop `fade`
- [ ] 1.7 In `src/routes/+page.svelte`, remove the inline expansion `{#if openId === ...}` blocks (hero and both lists); instead render a single `<RateSheet>` driven by `openId`
- [ ] 1.8 When `openId` switches from one dish to another while the sheet is open, contents swap without closing (no backdrop flash, no re-mount of the transition)
- [ ] 1.9 Verify the leaderboard `scrollTop` is unchanged across open / rate / close cycles

## 2. Shimmer confirmation

- [ ] 2.1 Add a keyframe `@keyframes shimmer-pop` in the app or a scoped style — brief accent-color background fade with text-color contrast, ~450ms
- [ ] 2.2 Wrap `.shimmer-on-change` class behind `@media (prefers-reduced-motion: no-preference)` so reduced-motion users see nothing
- [ ] 2.3 In `RatingRow.svelte`, apply the shimmer to the `avgFormatted` element using `{#key averageStars}` so it re-mounts (and re-plays the animation) on change
- [ ] 2.4 Apply the same treatment to the hero card's average text in `+page.svelte`
- [ ] 2.5 Confirm that the shimmer fires on the row the user just rated (where the value changed) and **not** on every row when the leaderboard reloads with unchanged values
- [ ] 2.6 Confirm it fires correctly when a previously-unrated dish gets its first rating (0 → new avg is still a change)

## 3. Swipe-to-undo on `/rate`

- [ ] 3.1 Add pointer state to `src/routes/rate/+page.svelte`: `pointerStartX`, `pointerStartY`, `pointerStartTime`
- [ ] 3.2 Attach `onpointerdown` / `onpointermove` / `onpointerup` / `onpointercancel` to the dish card wrapper (not the whole `<main>`, to avoid conflicting with star-selector taps)
- [ ] 3.3 On `pointerup`, if `|dx| >= 60` AND `dx > 0` (LTR positive = swipe right; in RTL Hebrew this is the natural "back" direction visually) AND `|dy| < 30` AND `elapsed < 600ms`, call `undo()` and consume the event
- [ ] 3.4 Do nothing when `undoStack` is empty — the swipe is a no-op, not an error
- [ ] 3.5 Add a `hintSwipeUndo = $state(false)` flag; set it `true` after the first successful swipe-undo in the session; render a small inline hint next to the `חזור אחורה` button that reads `או החלק ←`; never re-show after one session
- [ ] 3.6 Ensure the gesture does not fire inside `StarSelector` buttons (child clicks take priority via `event.target` check against `closest('[role="radio"]')`)
- [ ] 3.7 Keyboard `Backspace` path is left exactly as-is

## 4. Verification

- [ ] 4.1 Type check passes: `npm run check` with 0 errors and 0 warnings
- [ ] 4.2 Production build passes: `npm run build` completes successfully
- [ ] 4.3 Manual: on `/`, tap a mid-list row — sheet opens from the bottom, leaderboard scroll position unchanged
- [ ] 4.4 Manual: on `/`, tap row A → sheet opens; tap row B while open → sheet contents swap in place, no close animation, no backdrop flash
- [ ] 4.5 Manual: on `/`, rate a dish from the sheet — sheet closes, the row's average text shimmers once
- [ ] 4.6 Manual: on `/`, enable `prefers-reduced-motion` in the OS — rating a dish still updates the number, but no shimmer animation plays
- [ ] 4.7 Manual: on `/rate`, rate a dish, swipe right on the next dish's card — previous rating is undone, the previous dish returns
- [ ] 4.8 Manual: on `/rate`, attempt a swipe when `undoStack` is empty — nothing happens, no error state
- [ ] 4.9 Manual: on `/rate`, tapping a star button does not trigger the swipe handler (pointer handler ignores clicks on `[role="radio"]`)
- [ ] 4.10 Manual: on `/rate`, after the first successful swipe-undo, the hint `או החלק ←` appears next to the undo button and persists for the rest of the session
