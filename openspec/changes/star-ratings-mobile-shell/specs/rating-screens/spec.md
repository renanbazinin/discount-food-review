## ADDED Requirements

### Requirement: Home route composition
The route `/` SHALL render, in order from top to bottom: a compact header with the app title, a hero area, a rated-dishes leaderboard list, and an unrated-dishes section below a labeled divider. The content SHALL be wrapped in the responsive max-width container from the mobile-app-shell capability.

#### Scenario: Order of sections
- **WHEN** the home route is rendered with at least one rating and the catalog loaded
- **THEN** the DOM contains, in this order: header, hero area, rated leaderboard list, divider, unrated section

### Requirement: Hero shows user's top-rated dish when they have ratings
When `getMyRatings()` returns a non-empty array, the hero area SHALL display the user's highest-rated dish (ties broken by most recent `timestamp`) with the label `המנה האהובה שלך`, the dish image (or typographic fallback), name, restaurant, price, the user's own star value, AND the current global `averageStars` and `ratingCount` for that dish.

#### Scenario: User has ratings
- **WHEN** the user has rated dish A 10 stars and dish B 8 stars and the leaderboard has loaded
- **THEN** the hero displays dish A with the user's "10" and the current global `averageStars`/`ratingCount` for dish A

### Requirement: Hero shows global leader when user has no ratings
When `getMyRatings()` returns an empty array but the leaderboard has at least one entry, the hero area SHALL display the globally top-rated dish (sorted by the leaderboard order) with the label `מה שכולם אוהבים הכי הרבה` (or similar) and the same image/name/restaurant/price layout. The hero SHALL NOT show a user-star value in this state.

#### Scenario: New user with global leader present
- **WHEN** the user has no ratings and dish A is the global leader with averageStars 9.1, ratingCount 4
- **THEN** the hero displays dish A with the global label and shows the global average + count

### Requirement: Hero empty state when nothing rated at all
When `getMyRatings()` is empty AND the leaderboard is empty, the hero area SHALL render a friendly empty state with a bowl illustration, headline, and a short hint directing the user to the rate tab.

#### Scenario: Brand new cluster
- **WHEN** nobody has rated anything and the user opens the app
- **THEN** the hero shows the bowl illustration and empty-state copy rather than a dish card

### Requirement: Leaderboard list sorting
The home leaderboard list SHALL contain all dishes with `ratingCount > 0`, sorted primarily by `averageStars` descending, secondarily by `ratingCount` descending, and tertiarily by catalog `popularity` descending.

#### Scenario: Avg tiebreaker by count
- **WHEN** dish A has averageStars 8, ratingCount 5 and dish B has averageStars 8, ratingCount 3
- **THEN** A appears before B in the list

#### Scenario: Count tiebreaker by popularity
- **WHEN** dish A and dish B both have averageStars 8 and ratingCount 3, and A has higher catalog popularity than B
- **THEN** A appears before B

### Requirement: Row shows avg, count, and user's own star
Each row in the leaderboard list SHALL display the dish name, restaurant name, price, global `averageStars` (formatted with one decimal), `ratingCount` (formatted as `(מתוך N)`), and the user's own star value (or a muted indicator when the user has not rated that dish).

#### Scenario: User has rated the row
- **WHEN** the row is for dish A, which has averageStars 8.3 with 4 raters, and the user rated it 9
- **THEN** the row displays `8.3 (מתוך 4)` and a star value of 9 highlighted in accent color

#### Scenario: User has not rated the row
- **WHEN** the row is for dish A and the user has no rating for it
- **THEN** the row displays the global average and count, and a muted indicator (not a number) in the user-star slot

### Requirement: Top 3 get medal icons
The first three entries in the rated-list section SHALL display a 🥇 / 🥈 / 🥉 medal icon next to their rank number.

#### Scenario: Gold on rank 1
- **WHEN** a user views the leaderboard with at least one rated dish
- **THEN** the first entry shows a 🥇 icon

### Requirement: Unrated section below divider
Below a labeled divider `מנות שעדיין לא דורגו · {N}`, the home screen SHALL render every dish in the catalog that has `ratingCount === 0`, sorted by catalog `popularity` descending, with muted styling.

#### Scenario: Unrated section visible
- **WHEN** the catalog has 79 dishes and 12 dishes have at least one rating
- **THEN** the unrated section shows 67 dishes with the divider label reading `67`

#### Scenario: All dishes rated
- **WHEN** every dish has at least one rating in the aggregation response
- **THEN** the unrated section is absent (no divider, no list)

### Requirement: Inline rate on any row
Tapping any row (rated or unrated) SHALL expand that row in place to reveal a `StarSelector` component with the 10 pill buttons for values 1–10, the user's current value highlighted if they have one, and a clear-rating control. Selecting a value SHALL call `ratingsStore.rate(dishId, stars)`. Activating clear SHALL call `ratingsStore.clear(dishId)`.

#### Scenario: Expand a row
- **WHEN** the user taps a leaderboard row
- **THEN** the row expands to show the `StarSelector` with the user's current rating highlighted (if any) and a clear-rating control

#### Scenario: Select a star
- **WHEN** the user taps the "7" button in an expanded row's selector
- **THEN** `ratingsStore.rate(dishId, 7)` is called and the expanded editor collapses

#### Scenario: Clear a rating
- **WHEN** the user activates the clear-rating control on an expanded row
- **THEN** `ratingsStore.clear(dishId)` is called, the editor collapses, and the row moves below the divider if the user was its only rater

### Requirement: Hero tap expands inline editor
Tapping the hero card SHALL expand an inline star selector directly below the hero, with the same behavior as a leaderboard row.

#### Scenario: Expand hero editor
- **WHEN** the user taps the hero card for a dish they've rated
- **THEN** an inline star selector appears below the hero with the current value highlighted

### Requirement: Optimistic update with rollback
When the user rates or clears from any row or the hero, the UI SHALL update `averageStars`, `ratingCount`, and the user's own rating immediately in memory using exact recomputation formulas, then issue the server request in the background. On server success, the optimistic state is preserved (or reconciled with the next `getLeaderboard` fetch). On server failure, the UI SHALL revert to the pre-action state and surface an error banner.

#### Scenario: Successful rate
- **WHEN** the user rates a dish and the server returns `200`
- **THEN** the UI reflects the new average, count, and user-star immediately on tap, and no visible snap occurs when the response arrives

#### Scenario: Failed rate
- **WHEN** the user rates a dish and the server returns `503`
- **THEN** the UI reverts to the pre-action average, count, and user-star, and an error banner is shown

### Requirement: Loading skeleton
While the catalog, leaderboard, or my-ratings are loading, the home route SHALL render a shimmer skeleton in place of the hero and the first several list rows, reusing the `.skeleton` CSS class.

#### Scenario: Cold load
- **WHEN** the user opens `/` and any of the three loads has not yet resolved
- **THEN** the page shows a hero-sized shimmer placeholder and at least 5 list-row shimmer placeholders

### Requirement: Rate route single-dish queue flow
The route `/rate` SHALL render a dedicated queue-driven rating flow: a header with a progress counter `{rated}/{total}`, a single-dish card for the current queued dish, a `StarSelector` with 10 pill buttons, a "skip" action labeled `אולי אחר כך`, and an "undo" action labeled `חזור אחורה` for reverting the most recent rating in the session.

#### Scenario: Progress counter
- **WHEN** the user has rated 12 dishes in a 79-dish catalog
- **THEN** the header shows `12 / 79`

#### Scenario: Skip action
- **WHEN** the user taps `אולי אחר כך` on the current dish
- **THEN** no rating is recorded and the next queued dish is shown

#### Scenario: Undo in session
- **WHEN** the user rates a dish and then taps `חזור אחורה`
- **THEN** `ratingsStore.clear(dishId)` is called for the most recently rated dish and that dish is shown again

#### Scenario: All-done state
- **WHEN** every dish has a rating from this user
- **THEN** the rate route shows an "all done" state with a 🎉 headline and a link to `/`

### Requirement: Rate queue strategy
The rate queue SHALL consist of all dishes the caller has not rated, sorted by catalog `popularity` descending with a stable tiebreaker on `id`. Dishes the caller has already rated SHALL NOT appear in the queue unless the caller clears them.

#### Scenario: Popular unrated first
- **WHEN** the queue is computed with no prior ratings
- **THEN** the first dish shown is the highest-popularity dish in the catalog

#### Scenario: Rated dish excluded
- **WHEN** the user has rated dish A and the queue is computed
- **THEN** dish A does not appear in the queue

### Requirement: Keyboard shortcuts on fine-pointer devices
On devices where `matchMedia('(pointer: fine)')` matches, the rate route SHALL bind `1`–`9` to rate 1–9 stars, `0` to rate 10 stars, `Space` to skip, and `Backspace` to undo.

#### Scenario: Digit key rates
- **WHEN** the app is open on a desktop browser and the user presses `7` on `/rate`
- **THEN** the currently visible dish is rated 7 stars and the flow advances
