## ADDED Requirements

### Requirement: Home route renders the star ranking
The route `/` SHALL render the star-based ranking view: a hero card for the current top-rated dish (or an empty state) followed by the star-sorted list of rated dishes and an unrated section below a labeled divider.

#### Scenario: Cold open with ratings
- **WHEN** the user opens the app with at least one rated dish
- **THEN** the home route shows a hero card for the top-rated dish followed by the ranked list

#### Scenario: Cold open without ratings
- **WHEN** the user opens the app with zero rated dishes
- **THEN** the home route shows a friendly empty state with a CTA linking to `/rate` and no list

### Requirement: Hero shows current #1
The hero card SHALL always display the current top-rated dish, sorted by `stars` descending with a stable tiebreaker on `timestamp` descending. It SHALL display the dish image (or the typographic fallback for missing images), the dish name, the restaurant name, the price, and the current star rating.

#### Scenario: Single clear top
- **WHEN** the user has rated dish A with 10 stars and dish B with 8 stars
- **THEN** the hero card displays dish A with its 10-star rating

#### Scenario: Tied top with timestamp tiebreaker
- **WHEN** the user has rated dish A with 10 stars, then dish B with 10 stars
- **THEN** the hero card displays dish B (the most recent 10-star dish)

### Requirement: Hero is tappable for re-rate
Tapping the hero card SHALL expand or trigger an inline star editor that allows changing the hero dish's rating or clearing it, using the same `StarsStore.set` / `StarsStore.clear` operations as the list rows.

#### Scenario: Re-rate from hero
- **WHEN** the user taps the hero card for a dish rated 10 and then selects 7 in the editor
- **THEN** the dish's rating is updated to 7, the hero re-computes to the new #1 dish, and the editor collapses

#### Scenario: Clear from hero
- **WHEN** the user taps the hero card and activates "clear rating"
- **THEN** the dish's rating is removed, the hero re-computes to the new #1 (or the empty state if no ratings remain), and the cleared dish moves into the unrated section

### Requirement: Empty state for home with zero ratings
When `starsStore.list()` returns an empty array, the home route SHALL render an empty state containing a short headline in Hebrew, a one-line hint, a call-to-action button, and a simple illustration. The empty state SHALL NOT render the hero card, the list, or the unrated section.

#### Scenario: Empty state contents
- **WHEN** the user opens the home route with no ratings recorded
- **THEN** a headline reading `עוד לא דירגת אף מנה`, a hint sub-line, a button labeled `בואו נתחיל ←` linking to `/rate`, and a small illustration are visible

#### Scenario: CTA navigates to rate
- **WHEN** the user taps the CTA button in the empty state
- **THEN** the browser navigates to `/rate`

### Requirement: Loading skeleton
While the catalog or ratings are loading, the home route SHALL render a shimmer skeleton placeholder in place of the hero card and the first few list rows, and SHALL NOT render a plain text `טוען…` message.

#### Scenario: Loading state visible
- **WHEN** the user opens the home route and `loadCatalog()` or `starsStore.list()` has not yet resolved
- **THEN** the page shows a shimmering hero-sized placeholder and at least three shimmering list-row placeholders

#### Scenario: Skeleton replaced by content
- **WHEN** the catalog and ratings resolve
- **THEN** the skeleton is replaced by the real hero and list without layout shift

### Requirement: List rows below the hero
Below the hero, the home route SHALL render the same star-sorted list and inline re-rate editor that the `star-rating` capability requires for a ranking view, including the labeled divider between rated and unrated sections.

#### Scenario: List shows rated then unrated
- **WHEN** the user has rated some dishes and views the home route
- **THEN** rated dishes appear below the hero sorted by stars descending, followed by a labeled divider, followed by unrated dishes

#### Scenario: Hero dish appears in list
- **WHEN** the user has at least two rated dishes
- **THEN** the hero dish appears both in the hero card AND as the first entry in the ranked list

### Requirement: Friendlier copy throughout
The home route SHALL use the friendlier Hebrew copy defined by this change (`המנה האהובה שלך`, `עוד לא דירגת אף מנה`, `בואו נתחיל ←`, `מנות שעוד לא דירגת · {N}`, `שמור גיבוי`, `שחזר מגיבוי`) rather than the terser strings used before this change.

#### Scenario: Hero label
- **WHEN** the hero card is visible
- **THEN** it displays the label `המנה האהובה שלך` above the dish name

#### Scenario: Divider label
- **WHEN** the unrated section is visible with N unrated dishes
- **THEN** the divider label reads `מנות שעוד לא דירגת · {N}` where `{N}` is the count

### Requirement: Export and import are home controls
The export and import actions SHALL remain available on the home route, located in the page header area, operating on `starsStore` as before the redesign.

#### Scenario: Export available from home
- **WHEN** the user taps the export control on the home route
- **THEN** a file download of `await starsStore.export()` begins

#### Scenario: Import available from home
- **WHEN** the user taps the import control on the home route, selects a file, and confirms
- **THEN** `starsStore.import()` is called with the file contents and the home view re-renders
