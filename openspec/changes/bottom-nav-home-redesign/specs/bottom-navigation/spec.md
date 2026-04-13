## ADDED Requirements

### Requirement: Persistent bottom tab bar
The app SHALL render a single bottom tab bar from the root layout on every route. The tab bar SHALL be positioned fixed at the bottom of the viewport and SHALL NOT be duplicated or re-mounted on route changes.

#### Scenario: Tab bar visible on every route
- **WHEN** the user navigates between `/`, `/rate`, `/game`, and `/game/results`
- **THEN** the bottom tab bar is visible on every one of those routes

#### Scenario: Tab bar does not re-mount
- **WHEN** the user navigates between routes
- **THEN** the tab bar DOM element persists without being unmounted and remounted

### Requirement: Three tabs mapping to top-level routes
The tab bar SHALL contain exactly three tabs: a home tab linking to `/`, a rate tab linking to `/rate`, and a game tab linking to `/game`. Each tab SHALL be a link element with an accessible label in Hebrew.

#### Scenario: Tap home tab
- **WHEN** the user taps the home tab from any route
- **THEN** the browser navigates to `/`

#### Scenario: Tap rate tab
- **WHEN** the user taps the rate tab from any route
- **THEN** the browser navigates to `/rate`

#### Scenario: Tap game tab
- **WHEN** the user taps the game tab from any route
- **THEN** the browser navigates to `/game`

### Requirement: Pathname-driven active state
The tab bar SHALL highlight the active tab based on the current pathname. The pathname-to-tab mapping SHALL be: `/` → home, `/rate` → rate, and any pathname equal to `/game` or starting with `/game/` → game.

#### Scenario: Home active on root
- **WHEN** the current pathname is `/`
- **THEN** the home tab is visually highlighted and the other two tabs are not

#### Scenario: Rate active on `/rate`
- **WHEN** the current pathname is `/rate`
- **THEN** the rate tab is visually highlighted and the other two tabs are not

#### Scenario: Game active on `/game`
- **WHEN** the current pathname is `/game`
- **THEN** the game tab is visually highlighted

#### Scenario: Game active on `/game/results`
- **WHEN** the current pathname is `/game/results`
- **THEN** the game tab is visually highlighted

#### Scenario: No tab active on unknown route
- **WHEN** the current pathname is some route that does not match any of the three patterns
- **THEN** no tab is visually highlighted

### Requirement: Scroll-to-top on re-tap of active tab
When the user taps the tab that corresponds to the current route, the viewport SHALL scroll smoothly to the top of the page.

#### Scenario: Re-tap home
- **WHEN** the user is on `/` scrolled halfway down the ranking list and taps the home tab
- **THEN** the page scrolls smoothly to the top without navigating away from `/`

### Requirement: Safe-area aware layout
The tab bar and the page content SHALL respect `env(safe-area-inset-bottom)` so that on devices with a home indicator (iOS) the tab bar does not sit behind the indicator and the page content does not clip behind the tab bar.

#### Scenario: iOS safe area
- **WHEN** the app is opened in an iOS browser with a non-zero safe-area-inset-bottom
- **THEN** the tab bar is visually above the home indicator and the main content has bottom padding equal to the tab bar height plus the safe-area inset

#### Scenario: No safe-area inset
- **WHEN** the app is opened in a browser where `env(safe-area-inset-bottom)` resolves to 0
- **THEN** the layout renders without gaps below the tab bar and without the tab bar clipping content

### Requirement: Tab targets meet minimum tap-target size
Each of the three tabs SHALL occupy an equal one-third of the tab bar width and SHALL have a minimum tap-target height of 44 css pixels.

#### Scenario: Tap anywhere within a tab column
- **WHEN** the user taps any part of a tab column (icon, label, or empty space in between)
- **THEN** the tap is registered as a tap on that tab

### Requirement: In-header navigation is removed
Route headers SHALL NOT contain links to other top-level routes once the tab bar is present. Route headers MAY contain per-route controls (export, import, progress, sub-navigation within the same tab).

#### Scenario: Home header has no nav links
- **WHEN** the user views the home route
- **THEN** the page header shows only the page title and any home-specific controls (e.g. export/import), and does not contain links to `/rate` or `/game`

#### Scenario: Game has sub-nav to results
- **WHEN** the user views `/game`
- **THEN** the page may contain a link to `/game/results` because that is a sub-route within the game tab

### Requirement: RTL tab order
In RTL layout, the tab bar SHALL render the home tab at the visual start (right edge) and the game tab at the visual end (left edge), with the rate tab between them.

#### Scenario: RTL visual order
- **WHEN** the app is rendered with `dir="rtl"`
- **THEN** the home tab is at the right edge of the tab bar and the game tab is at the left edge
