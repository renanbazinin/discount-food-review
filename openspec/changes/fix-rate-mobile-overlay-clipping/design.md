## Context

The `/rate` screen (`src/routes/rate/+page.svelte`) shows one dish at a time as a full-bleed image card. The card height is constrained to `100dvh - 120px` minus the progress header, star selector, and footer. A dark gradient overlay sits at the bottom of the card with:

```
<h2 class="truncate text-xl font-extrabold ...">{current.name}</h2>
<p class="truncate text-sm text-white/70">{current.restaurantName}</p>
<div class="shrink-0 ...">₪{price}</div>
```

Two problems on small phones:
1. `truncate` is single-line ellipsis. Long Hebrew dish names (e.g. multi-word descriptive names from 10bis) get cut mid-word even when there is plenty of vertical room.
2. The price pill competes with the label row via `flex items-end justify-between gap-3`. When the dish name grows, the flex row does not wrap, so the name loses more characters instead of pushing the pill down.

The result users report: "the text is cut from screen" — specifically, dish name is unreadable for some items.

## Goals / Non-Goals

**Goals:**
- Dish name on `/rate` is fully readable on phones down to ~320px viewport width, wrapping to up to 2 lines instead of ellipsing.
- Restaurant name remains visible (1 line, ellipsis acceptable) below the dish name.
- Price pill stays visible and never overlaps the label.
- Layout remains stable: star selector and navigation footer stay on-screen on short viewports (e.g. iPhone SE at `667px` tall).
- Works for both image cards and the emoji/gradient fallback card.

**Non-Goals:**
- No redesign of the queue, star selector, or rating semantics.
- No changes to desktop layout beyond what naturally follows from responsive classes.
- No new image processing, cropping, or server-side work.

## Decisions

**1. Replace `truncate` with `line-clamp-2` on the dish name, keep `truncate` on restaurant name.**
Rationale: the dish name is the critical piece of information; two lines are enough for essentially all 10bis dish names observed in `data/restaurants.json`. The restaurant name is secondary and safe to ellipsize. Alternative considered: unlimited wrap — rejected because it could push the price off and eat into the image.

**2. Stack name + price vertically on narrow widths; keep the current row layout on `sm:` and wider.**
Use `flex-col sm:flex-row sm:items-end sm:justify-between` for the overlay inner row and move the price pill above the labels on mobile (or inline at the end of the title row). This guarantees the name block owns the full width of the card on phones. Alternative considered: shrinking the price pill — rejected because Hebrew price formatting is already compact.

**3. Responsive typography: `text-lg sm:text-xl` for dish name, `text-xs sm:text-sm` for restaurant, slightly reduced overlay padding on mobile (`p-3 sm:p-4`).**
Rationale: Frees vertical room for the second line on small screens while preserving current desktop look.

**4. Grow the gradient upward when the label wraps.**
The current gradient uses `pt-20` to fade out. Keep that, but ensure the overlay block uses `min-h-[...]` sized to the label content so a two-line name does not punch through the gradient's top edge. Practically: remove fixed `pt-20` in favor of `pt-16 sm:pt-20` and rely on the label block's natural height.

**5. Shrink the card's minimum image area on very short viewports.**
The outer `<main>` uses `h-[calc(100dvh-120px)]`. Keep it, but set the image card to `flex-1 min-h-0` (already the case) and do not introduce a fixed aspect ratio — the image `object-cover` already fills whatever height remains. No change needed here beyond verifying the footer + star selector do not overflow.

## Risks / Trade-offs

- **[Risk]** `line-clamp-2` still clips names longer than two lines. → **Mitigation:** manual review of `data/restaurants.json` during implementation; if any dish name would clip at 2 lines in a 320px card at `text-lg`, raise to `line-clamp-3` for mobile only.
- **[Risk]** Stacking price above the label on narrow widths changes the visual hierarchy. → **Mitigation:** keep the price pill right-aligned inside its own row so it still reads as secondary metadata.
- **[Risk]** Two-line overlay eats into the image. → Accepted: readability of the label is more important than preserving pixels of food photo, and the affected area is already the darkened gradient.
- **[Trade-off]** No new spec surface beyond this one capability; future changes to `/rate` layout will need to extend `rate-queue-mobile-shell`.
