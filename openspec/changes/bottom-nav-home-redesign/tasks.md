## 1. Bottom tab bar

- [x] 1.1 Create `src/lib/ui/BottomTabBar.svelte` with three tabs (home `/`, rate `/rate`, game `/game`), each rendered as a link element
- [x] 1.2 Compute the active tab from `$page.url.pathname` using strict equality for `/` and `/rate` and a prefix match (`=== '/game' || startsWith('/game/')`) for game
- [x] 1.3 Style the active tab with the accent color and inactive tabs at 60% white opacity; equal-width columns via `flex-1`, minimum 44px tap-target height
- [x] 1.4 Add RTL-correct visual order: home tab at the visual start (right edge), game tab at the visual end (left edge)
- [x] 1.5 On click of the currently-active tab, prevent navigation and call `window.scrollTo({ top: 0, behavior: 'smooth' })`
- [x] 1.6 Position the tab bar `fixed bottom-0 inset-x-0` with background, top border, and bottom padding that accounts for `env(safe-area-inset-bottom)`

## 2. Root layout integration

- [x] 2.1 Mount `<BottomTabBar />` in `src/routes/+layout.svelte` so it renders once and persists across route changes
- [x] 2.2 Wrap the `{@render children()}` slot in a container that applies `pb-[calc(env(safe-area-inset-bottom)+80px)]` so page content clears the tab bar
- [x] 2.3 Verify the tab bar appears on `/`, `/rate`, `/game`, and `/game/results` via a dev-server smoke test

## 3. Move star-rating flow to `/rate`

- [x] 3.1 Create `src/routes/rate/+page.svelte` by copying the current `src/routes/+page.svelte` contents verbatim
- [x] 3.2 Remove the in-header `NavButton` links to `/ranking` and `/game` from the new `/rate/+page.svelte` — keep only the progress counter in the header
- [x] 3.3 Apply copy polish on `/rate`: prompt `מה דעתך?` instead of `כמה כוכבים?`, skip label `אולי אחר כך`, undo label `חזור אחורה`, all-done headline `הכל דורג! 🎉 יפה מאוד.`
- [x] 3.4 Delete the old `src/routes/+page.svelte` (it will be rewritten in group 4 as the home-ranking-hero view)

## 4. Rewrite `/` as home-ranking-hero

- [x] 4.1 Create the new `src/routes/+page.svelte` loading catalog + stars list, same as the previous `/ranking/+page.svelte` but structured around a hero + list composition
- [x] 4.2 Implement hero card component inline: show top-rated dish image (or typographic fallback), name, restaurant, price, current stars, and the label `המנה האהובה שלך`
- [x] 4.3 Wire tapping the hero to the same inline `StarEditor` expansion used for list rows, reusing `StarSelector` and the clear action
- [x] 4.4 Implement the empty state: headline `עוד לא דירגת אף מנה`, sub `בחר מנה ותן לה כוכבים — זה לוקח 30 שניות.`, CTA button `בואו נתחיל ←` linking to `/rate`, small inline SVG illustration
- [x] 4.5 Render the ranked list below the hero using the same row structure as the previous `/ranking` view
- [x] 4.6 Apply copy polish: divider `מנות שעוד לא דירגת · {N}`, export `שמור גיבוי`, import `שחזר מגיבוי`
- [x] 4.7 Remove all in-header nav links; keep only the title, export, and import controls in the header

## 5. Loading skeleton

- [x] 5.1 Add `.skeleton` keyframes and utility class to `src/app.css` using a Tailwind-friendly shimmer gradient
- [x] 5.2 On `/`, render a hero-sized skeleton and 4 list-row skeletons while `catalog` or `ratings` are still loading, replacing the bare `טוען…` message
- [x] 5.3 On `/rate`, replace `טוען…` with a single card skeleton while loading
- [x] 5.4 On `/game` and `/game/results`, replace `טוען…` with comparable skeletons

## 6. Delete `/ranking` route

- [x] 6.1 Delete `src/routes/ranking/+page.svelte`
- [x] 6.2 Delete the empty `src/routes/ranking/` directory if nothing else lives there

## 7. Clean game routes

- [x] 7.1 Remove `NavButton` home / rate / ranking links from `src/routes/game/+page.svelte`'s header; keep only the title and the sub-nav `תוצאות ←` link to `/game/results`
- [x] 7.2 Remove `NavButton` home / rate / ranking links from `src/routes/game/results/+page.svelte`'s header; keep only the title and the sub-nav back to `/game`
- [x] 7.3 Apply copy polish: `שמור גיבוי` / `שחזר מגיבוי` on the results page export/import

## 8. Visual polish pass

- [x] 8.1 Bump header title typography from `text-base font-bold` to `text-lg font-extrabold tracking-tight` on all four routes
- [x] 8.2 Increase list-row vertical padding from `p-3` to `p-3.5` and gap from `gap-3` to `gap-3.5`
- [x] 8.3 Ensure every button and icon-button has a minimum height of 44 css px (including export/import on home and results)
- [x] 8.4 Adjust card background colors to the slightly warmer `rgba(255,247,238,.04)` variant where current cards use the bare white/5

## 9. Verification

- [x] 9.1 `npm run check` passes with 0 errors and 0 warnings
- [x] 9.2 `npm run build` completes successfully
- [x] 9.3 Dev-server smoke test: `/`, `/rate`, `/game`, `/game/results` all return 200; `/ranking` returns 404 (or a SvelteKit fallback)
- [x] 9.4 Automated check: on each of the four real routes, the DOM contains a single bottom-tab-bar element (queried via a stable class or data attribute)
- [x] 9.5 Automated check: active-tab logic returns the correct tab for inputs `/`, `/rate`, `/game`, `/game/results`, `/unknown`
- [ ] 9.6 Manual pass on mobile viewport (~390×844 in DevTools): confirm tab bar sticks to bottom, tap targets are comfortable, home hero renders, empty state renders when stars are cleared
- [ ] 9.7 Manual pass on desktop: confirm tab bar still renders, still works with keyboard navigation, doesn't overlap content on tall screens
- [ ] 9.8 Manual pass: verify scroll-to-top on re-tap of the active tab works on `/` after scrolling the list
