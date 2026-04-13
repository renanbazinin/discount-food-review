## Context

After `food-ranking-app` and `star-rating-home`, the app has four routes (`/`, `/ranking`, `/game`, `/game/results`), two independent stores, and a working pairwise mode plus a working star mode. Navigation happens via small pill buttons in each route's top header — the user manually chooses which link lives where, and the layout has no persistent chrome. The home route is the star-rating flow, which is a task, not a view.

The user now wants: (a) a persistent bottom tab bar so navigation is one tap from anywhere; (b) the home route to land on the ranking instead of the task flow; (c) a round of general polish to make the app feel warmer and more friendly. This is a shell/UX change with no changes to ranking logic, persistence, or data.

## Goals / Non-Goals

**Goals:**
- The app has a single, always-visible bottom tab bar rendered from the root layout. All routes share it.
- Three tabs cover the full app: **home/ranking**, **rate**, **game**. Each tab corresponds to one top-level route and handles its sub-routes by pathname prefix matching.
- Opening the app lands on the ranking view, not on a task flow. The first thing the user sees is their current top dish and their list.
- The home view has a clear visual hero (current #1 dish) distinct from the list beneath it.
- Empty states are friendly, not empty. A user who hasn't rated anything gets an inviting CTA to start rating, not a blank screen.
- Touch targets are ≥44×44 css px everywhere. Small 24×24 export/import buttons on existing routes get enlarged.
- iOS safe-area insets don't clip the tab bar or content. Android gesture bars don't fight taps.
- All in-header cross-route links are removed; the tab bar owns navigation.

**Non-Goals:**
- A side drawer, a top tab bar, or any secondary nav surface. One bottom bar, three tabs, full stop.
- Dark/light theme toggle. Dark stays.
- A full visual rebrand. Softer dark palette, warmer copy, better empty states — not a new font, new color system, or new layout grid.
- Any change to `RatingsStore`, `StarsStore`, the Elo engine, the queue, the scraper, or the catalog.
- URL aliasing for the old `/ranking` route. We delete it clean.
- Animation libraries. Existing Svelte transitions cover everything we need.
- Icon packs. Tab icons are emoji (🏆 ⭐ 🎮) or simple inline SVGs — no dependency.

## Decisions

### Route contract

```
/              ← home / ranking (star leaderboard + hero)
/rate          ← star-rating flow (moved from /)
/game          ← pairwise comparison
/game/results  ← Elo leaderboard sub-route of the game tab
```

The pathname-to-tab mapping is:

```
/              → home tab
/rate          → rate tab
/game*         → game tab  (i.e. /game AND /game/results)
anything else  → no tab highlighted
```

`/ranking` is deleted. Not aliased. If future user feedback asks for URL stability we add a redirect in one line.

### Tab bar structure

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              [ page content ]                       │
│                                                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│   🏆              ⭐              🎮                │
│  דירוג           דרג             משחק               │
└─────────────────────────────────────────────────────┘
```

- Height: 64px + `env(safe-area-inset-bottom)`.
- Position: `fixed bottom-0 inset-x-0`.
- Background: a slightly lighter tone than the page background with a 1px top border for separation.
- Each tab is a link (`<a>`), not a button, so right-click / middle-click / long-press behave natively.
- Tapping the tab for the current route does nothing (or scrolls to top on home — see "scroll-to-top" below).
- Active tab: icon is full-opacity + accent color, label is the accent color, inactive tabs use muted white at ~60% opacity.
- All three tabs are equal-width via `flex-1`. Tap target area is the whole tab column, not just the icon.
- In RTL, the visual order is 🏆 · ⭐ · 🎮 from right to left (home on the start side, game on the end side). This matches the mental model: "home on the right, game on the left" for Hebrew users.

**Alternatives considered:**
- **FAB (floating action button) for the rate action.** Familiar from WhatsApp-style apps but breaks the "three equal tabs" clarity and creates a second visual focus competing with the hero card on home. Rejected.
- **Top tab bar.** Takes vertical space on phone where vertical is scarce, and pulls focus away from the content. Rejected.
- **Bottom bar with 4 tabs** (home, rate, game, game-results). Too many for what they are — `/game/results` is a detail of the game tab, not a peer of it. Rejected.

### Active-tab resolution

```ts
function activeTab(pathname: string): 'home' | 'rate' | 'game' | null {
  if (pathname === '/') return 'home';
  if (pathname === '/rate') return 'rate';
  if (pathname.startsWith('/game')) return 'game';
  return null;
}
```

Implemented in the `BottomTabBar` component via SvelteKit's `$page` store so it reacts on navigation without re-rendering from scratch.

### Scroll-to-top on active-tab re-tap

When the user taps the active tab — e.g. is already on `/` and taps the 🏆 tab again — the page scrolls smoothly to the top. Standard native-app convention. Implemented with a click handler that checks `currentTab === this.tab` and calls `window.scrollTo({ top: 0, behavior: 'smooth' })`.

**Why:** it's a free UX win, costs 3 lines of code, and users expect it without being told.

### Home view composition

```
┌─────────────────────────────────────────────┐
│ דירוג אוכל           [12/79]    ייצוא ייבוא │   header
├─────────────────────────────────────────────┤
│                                             │
│    ┌────────────────────────────────┐       │
│    │                                │       │
│    │     [ top dish image hero ]    │       │   hero card
│    │                                │       │   (taps to re-rate)
│    │     המנה האהובה שלך ⭐ 10      │       │
│    │     המבורגר אנטריקוט           │       │
│    │     דיינר · ₪40                │       │
│    └────────────────────────────────┘       │
│                                             │
├─────────────────────────────────────────────┤
│ 2.  [image]  לברק שום שחור     ₪40   ⭐ 9   │
│ 3.  [image]  קבב קצבים         ₪40   ⭐ 9   │   list
│ 4.  [image]  פיצה פונגי        ₪40   ⭐ 8   │
│ ...                                         │
│ ── טרם דורג (56) ──                         │
│ ?   [image]  ...                            │
├─────────────────────────────────────────────┤
│  🏆         ⭐          🎮                   │   tab bar
└─────────────────────────────────────────────┘
```

**Hero rules:**
- Shown only when at least one dish is rated.
- Always shows the current `#1` — same sort as the list (stars desc, timestamp desc tiebreaker).
- Tapping the hero expands the inline star editor on that dish, same as tapping a row in the list. This avoids a dedicated "edit top dish" flow.
- If the top dish is tied with others (multiple 10s, multiple 9s, etc.), pick the one with the most recent `timestamp` so the hero feels fresh; no "tied" badge, no carousel.
- The hero uses a larger image (aspect `4/3`) and bigger typography than the list rows.

**Empty state:**
- Shown when zero dishes are rated.
- Large friendly message: "עוד לא דירגת אף מנה" and a subheading: "בחר מנה ותן לה כוכבים - זה לוקח 30 שניות".
- Prominent CTA button: "בואו נתחיל ←" linking to `/rate`.
- No list visible below — the empty state is the whole page content.
- Illustration: a simple inline SVG (a stylized bowl with steam, ~120px). No image asset dependency.

**Loading state:**
- Replace the current bare `טוען…` with a shimmer skeleton: one large card block for the hero plus 4 list-row skeletons. Pure CSS animation via Tailwind arbitrary properties. Prevents layout shift when data loads.

### Rate route at `/rate`

Contents identical to the previous `/+page.svelte` (the star-rating flow). The only changes:
- Header no longer contains nav pills. Just the progress counter and optional undo/skip moved to a cleaner spot.
- Bottom content padding accounts for the tab bar.
- Copy polish: the "כמה כוכבים?" prompt becomes friendlier ("מה דעתך?"), the all-done state gets an illustration and a warmer message.

### Game routes

`/game` and `/game/results` lose their header nav pills. The game tab in the bottom bar covers cross-route navigation. Within the game, a small `תוצאות ←` link inside the game header remains because it's a sub-navigation between peers within the same tab.

### Visual polish system

- **Palette tweaks**: page background stays `#0a1220`, but card backgrounds move from `rgba(255,255,255,.05)` to a slightly warmer `rgba(255,247,238,.04)` for a less clinical feel. Accent color stays `#ff5a3c` but gets a companion `#ffb199` for secondary highlights.
- **Typography**: header titles go from `font-bold text-base` to `font-extrabold text-lg tracking-tight` for more personality.
- **Spacing**: list rows get `py-3` → `py-3.5` and `gap-3` → `gap-3.5`. Small but noticeable.
- **Touch targets**: all export/import buttons and secondary controls become ≥44px min height. Icon-only buttons get a min-width to match.
- **Shadows**: no external libs; use Tailwind's built-in `shadow-lg`/`shadow-2xl` on the hero card.
- **Skeleton shimmer**: defined once in `app.css` as a CSS keyframe animation; `.skeleton` class applies it.
- **Copy**: every Hebrew string that currently says something bare (e.g. `טוען…`, `סיימת לדרג הכל 🎉`) gets a friendlier variant. The copy table lives in the design doc below and is applied verbatim in the tasks.

### Copy table

| Place | Before | After |
|---|---|---|
| Loading | `טוען…` | shimmer skeleton, no text |
| All-done on rate | `סיימת לדרג הכל 🎉` | `הכל דורג! 🎉  יפה מאוד.` |
| Rate prompt | `כמה כוכבים?` | `מה דעתך?` |
| Rate button skip | `דלג` | `אולי אחר כך` |
| Rate button undo | `בטל` | `חזור אחורה` |
| Ranking divider | `טרם דורג (N)` | `מנות שעוד לא דירגת · {N}` |
| Home hero label | (new) | `המנה האהובה שלך` |
| Home empty title | (new) | `עוד לא דירגת אף מנה` |
| Home empty sub | (new) | `בחר מנה ותן לה כוכבים — זה לוקח 30 שניות.` |
| Home empty CTA | (new) | `בואו נתחיל ←` |
| Export | `ייצוא` | `שמור גיבוי` |
| Import | `ייבוא` | `שחזר מגיבוי` |
| Game back | `← למשחק` | (removed — tab bar owns this) |

### Bottom content padding

Every route's `<main>` gets `pb-[calc(env(safe-area-inset-bottom)+80px)]` so content clears the 64px tab bar plus safe area plus a 16px breathing gap. Implemented as a single Tailwind arbitrary utility used in the root layout's wrapper, not per route — prevents drift.

### Where the tab bar lives

```
src/routes/+layout.svelte
  └── <div class="pb-[calc(env(safe-area-inset-bottom)+80px)]">
        {@render children()}
      </div>
      <BottomTabBar />
```

This ensures the tab bar exists exactly once in the DOM and doesn't re-mount on every navigation, which is important for preserving any internal state (none today, but future-proof).

## Risks / Trade-offs

- **Users who bookmarked `/ranking`** → small personal-use tool, acceptable loss. If we ever get real users, add a 2-line redirect at `/ranking/+page.ts` that calls `redirect(307, '/')`.
- **Hero card on home adds vertical space** that competes with the list on short screens → mitigated by making the hero ~40% of viewport on phone, list scrolls below it. On tall phones the hero + 3-4 list rows fit above the fold, which is fine.
- **Pathname-based active-tab** is wrong if a future route like `/games` appears (would match `/game` prefix) → mitigated by using strict equality for `/` and `/rate`, and `pathname === '/game' || pathname.startsWith('/game/')` for game.
- **Safe-area insets are iOS-specific and Android browsers may ignore them** → that's fine; they degrade to 0 and the tab bar sits on top of the gesture bar without breaking.
- **Emoji as icons is kitsch to some designers** → accepted; they render without a dependency, RTL-safely, and match the food-app vibe. Swappable for inline SVGs in a future change if someone cares.
- **Removing in-header nav removes discoverability of `/game/results`** within the game tab → mitigated by keeping a single "תוצאות ←" link inside the game page itself (sub-nav within a tab).

## Migration Plan

1. Create `BottomTabBar.svelte` with the three tabs and active-state logic.
2. Edit `src/routes/+layout.svelte` to mount `BottomTabBar` and wrap children in the safe-area padding container.
3. Create `src/routes/rate/+page.svelte` by moving the entire current `src/routes/+page.svelte` verbatim, then applying the header simplification + copy polish.
4. Rewrite `src/routes/+page.svelte` to be the home-ranking-hero view (previously the rewritten `/ranking` content from `star-rating-home`, now with a hero section on top, empty state, skeletons, and friendly copy).
5. Delete `src/routes/ranking/+page.svelte` and its parent directory (`ranking/`).
6. Edit `/game/+page.svelte` and `/game/results/+page.svelte` to drop in-header cross-route nav pills, keep only the sub-nav `תוצאות ↔ משחק` link between the two, and apply the copy polish.
7. Extend `app.css` with the `.skeleton` shimmer animation.
8. Extend `tailwind.config.js` with warmer card tokens if needed (optional — plain Tailwind colors may suffice).
9. Run `npm run check` and `npm run build`.
10. Manual QA: mobile viewport + desktop, confirm tab bar is sticky, active state is correct on all four real routes, home hero renders and is tappable, empty state renders when stars are cleared.

## Open Questions

- **Scroll-to-top on active-tab re-tap** is a nice-to-have. Default to implementing it because it's cheap; if it feels jarring we rip it out.
- **Tab bar labels in Hebrew** — going with `דירוג` / `דרג` / `משחק`. The similarity between `דירוג` (home/ranking) and `דרג` (rate as verb) is a mild risk for phone users scanning quickly; open to `הטופ שלי` for home if the user prefers something less ambiguous, but that's longer and doesn't fit the single-word tab convention.
- **Should the home hero be tappable for re-rate, or read-only?** Default is tappable (same as a row in the list). If this causes accidental re-rates we downgrade to read-only in a follow-up.
