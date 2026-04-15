## Why

On the `/rate` queue screen, dish cards overlay name + restaurant + price on top of the image. On narrow mobile viewports some dish names (long Hebrew strings) get hard-truncated by `truncate` (single-line ellipsis) and long restaurant names also vanish, so the user cannot actually read what they are rating. The card is height-capped by `100dvh - 120px`, and the overlay sits at the bottom with no responsive type scaling, so for some items the label is effectively cut off the screen.

## What Changes

- Replace the single-line `truncate` on dish name/restaurant in the `/rate` image overlay with a bounded multi-line clamp (2 lines for the dish name, 1 line for the restaurant) that stays readable on small screens.
- Scale overlay typography and padding responsively so labels fit inside the card on phones (down to ~320px wide) without colliding with the price pill or the swipe area.
- Ensure the overlay background gradient height adapts to the label block so the text always has sufficient contrast even when it wraps to two lines.
- Keep the card layout stable: the image area may shrink slightly to accommodate the overlay, but the layout must not push the star selector or footer off-screen on short viewports.

## Capabilities

### New Capabilities
- `rate-queue-mobile-shell`: Responsive layout requirements for the `/rate` queue card, specifically how dish metadata is rendered on top of the dish image on mobile.

### Modified Capabilities
<!-- None: there are no existing spec files under openspec/specs/, so this change introduces the first spec for this surface. -->

## Impact

- `src/routes/rate/+page.svelte` — overlay markup and Tailwind classes for the dish label block.
- No API, DB, or data changes. No new dependencies.
- Purely visual; does not affect rating submission, queue ordering, or storage.
