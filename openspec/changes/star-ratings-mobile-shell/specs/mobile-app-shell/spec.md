## ADDED Requirements

### Requirement: Persistent bottom tab bar rendered from the root layout
The app SHALL render a single bottom tab bar from the root layout on every route. The tab bar SHALL be positioned fixed at the bottom of the viewport and SHALL NOT be duplicated or re-mounted on route changes.

#### Scenario: Tab bar visible on both routes
- **WHEN** the user navigates between `/` and `/rate`
- **THEN** the bottom tab bar is visible on both routes

#### Scenario: Tab bar does not re-mount on nav
- **WHEN** the user navigates between routes
- **THEN** the tab bar DOM element persists without being unmounted and remounted

### Requirement: Two tabs with inline SVG icons
The tab bar SHALL contain exactly two tabs: a home tab linking to `/` with a trophy SVG icon and the label `דירוג`, and a rate tab linking to `/rate` with a star SVG icon and the label `דרג`. The icons SHALL be hand-authored inline SVG components and SHALL NOT depend on any icon library.

#### Scenario: No external icon dependency
- **WHEN** `package.json` is inspected after implementation
- **THEN** no icon library (lucide, heroicons, @iconify/*, etc.) appears in `dependencies` or `devDependencies`

#### Scenario: Tab bar has two tabs
- **WHEN** the DOM is inspected on any route
- **THEN** the tab bar contains exactly two tab links (home and rate)

### Requirement: Pathname-driven active state
The active tab SHALL be determined by the current pathname: `/` → home, `/rate` → rate. Any other pathname leaves no tab highlighted.

#### Scenario: Home active on root
- **WHEN** the current pathname is `/`
- **THEN** the home tab is visually highlighted with the accent color and the rate tab is not

#### Scenario: Rate active on /rate
- **WHEN** the current pathname is `/rate`
- **THEN** the rate tab is visually highlighted and the home tab is not

### Requirement: Scroll-to-top on re-tap of active tab
When the user taps the tab corresponding to the current route, the viewport SHALL scroll smoothly to the top of the page and SHALL NOT trigger a re-navigation.

#### Scenario: Re-tap home after scrolling
- **WHEN** the user is on `/` scrolled down the leaderboard and taps the home tab
- **THEN** the page scrolls smoothly to the top without navigating away from `/`

### Requirement: Equal-width tabs with 44px minimum tap target
Each tab SHALL occupy an equal one-half of the tab bar width and SHALL have a minimum tap-target height of 44 css pixels (56px recommended).

#### Scenario: Tap anywhere in a tab column
- **WHEN** the user taps any part of a tab column (icon, label, or negative space)
- **THEN** the tap is registered as a tap on that tab

### Requirement: Safe-area aware layout
The tab bar and main content SHALL respect `env(safe-area-inset-bottom)` so that iOS home-indicator devices do not clip the bar or overlap content.

#### Scenario: iOS safe area
- **WHEN** the app is opened in an iOS browser with a non-zero `safe-area-inset-bottom`
- **THEN** the tab bar sits visually above the home indicator and main content has bottom padding equal to the tab bar height plus the safe-area inset

### Requirement: Responsive max-width container
The root layout SHALL wrap page content in a centered container with `max-width: 520px` (or equivalent) and `width: 100%`. On viewports wider than 520px the container SHALL center horizontally with no margins on mobile viewports smaller than that.

#### Scenario: Mobile viewport (360px)
- **WHEN** the viewport is 360px wide
- **THEN** content fills the viewport width without horizontal scroll

#### Scenario: Desktop viewport (1440px)
- **WHEN** the viewport is 1440px wide
- **THEN** content is centered in a 520px column, with the background extending to the full viewport width

### Requirement: Tab bar respects the same max-width
The tab bar SHALL be visually constrained to the same max-width as the main content on desktop viewports. On mobile viewports (≤520px) it SHALL span the full viewport width.

#### Scenario: Mobile viewport
- **WHEN** the viewport is 360px wide
- **THEN** the tab bar spans the full viewport width

#### Scenario: Desktop viewport
- **WHEN** the viewport is 1440px wide
- **THEN** the tab bar is centered and approximately 520px wide, not stretched across the full viewport

### Requirement: No route headers contain cross-tab navigation
Route headers SHALL NOT contain nav links to other top-level routes. Cross-route navigation is owned by the tab bar exclusively. Route headers MAY contain the page title, per-route controls (export/import, progress counter), and sub-navigation within the same route.

#### Scenario: Home header has no nav links
- **WHEN** the user views `/`
- **THEN** the page header shows only the title and home-specific controls, and does not contain links to `/rate`
