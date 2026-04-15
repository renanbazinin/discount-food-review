## 1. Audit current state

- [x] 1.1 Reproduce the clipped-label bug on `/rate` in a 360px-wide mobile emulator by navigating the queue until a long-named dish appears (confirmed from source: `truncate` on `<h2>` single-lines the dish name regardless of width)
- [x] 1.2 Scan `data/restaurants.json` for the longest dish names to understand the worst-case wrap length the layout must accommodate (2-line clamp with `text-lg` accommodates observed names; `line-clamp-2` still ellipses the extreme outlier)

## 2. Overlay markup + Tailwind changes in `src/routes/rate/+page.svelte`

- [x] 2.1 Replace `truncate` on the dish name `<h2>` with a 2-line clamp (`line-clamp-2`) and responsive text size (`text-lg sm:text-xl`), keep `leading-tight` and `font-extrabold`
- [x] 2.2 Keep `truncate` on the restaurant name `<p>` but reduce the mobile font size (`text-xs sm:text-sm`)
- [x] 2.3 Restructure the overlay inner row so it stacks on narrow viewports and goes back to a row on `sm:` and up: `flex-col sm:flex-row sm:items-end sm:justify-between`, keeping the price pill as its own block so it never overlaps the labels when the name wraps
- [x] 2.4 Reduce overlay padding on mobile (`p-3 sm:p-4`) and lower the gradient top-padding to `pt-16 sm:pt-20` so the fade still covers a two-line title block
- [x] 2.5 Apply the same label structure to the emoji/gradient fallback branch so imageless cards match (2-line dish name, 1-line restaurant, no overflow)

## 3. Verify no layout regressions

- [ ] 3.1 In the dev server, test `/rate` at 320×568, 360×640, 390×844, and desktop widths; confirm image card, star selector, and footer all stay on-screen without page scroll
- [ ] 3.2 Confirm long dish names wrap to two lines without being clipped and that the price pill stays visible and aligned
- [ ] 3.3 Confirm short dish names still render cleanly without extra whitespace or layout shift
- [ ] 3.4 Verify the imageless (gradient + emoji) fallback still renders correctly for dishes with no `image`
- [x] 3.5 Run `npm run check` and fix any `svelte-check` errors introduced by markup/class changes (passed: 0 errors, 0 warnings)
