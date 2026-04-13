## ADDED Requirements

### Requirement: Home route is the star-rating flow
The app SHALL render the star-rating flow at the root route `/`. On opening the app, the user SHALL see a single-dish view with a 1–10 star selector, with no intermediate onboarding or landing page.

#### Scenario: Cold open
- **WHEN** a new user opens the app for the first time
- **THEN** the home route is the star-rating flow, a single dish is visible, and a row of 10 star-selector buttons is present

#### Scenario: Returning open with partial ratings
- **WHEN** a returning user reopens the app after rating some dishes
- **THEN** the home route is still the star-rating flow and the current dish shown is the next unrated dish in queue order

### Requirement: Rating queue is unrated-first by popularity
The star-rating flow SHALL present dishes in a queue consisting of all dishes that currently have no star rating, sorted by `popularity` descending and then by `id` ascending for stable order. Dishes with a rating SHALL NOT appear in the queue.

#### Scenario: Popular unrated dish first
- **WHEN** the user opens the app and no dishes have been rated yet
- **THEN** the first dish shown is the dish with the highest `popularity` value in the catalog

#### Scenario: After rating
- **WHEN** the user rates the currently visible dish
- **THEN** the next dish shown is the unrated dish with the next-highest `popularity`

#### Scenario: Rated dish does not reappear
- **WHEN** a dish has a star rating recorded via the home flow
- **THEN** it does not reappear in the home flow queue until its rating is explicitly cleared

### Requirement: 1–10 integer star selector
The star selector SHALL present exactly 10 tappable controls labeled `1` through `10`, each recording an integer rating when activated. Fractional ratings SHALL NOT be supported.

#### Scenario: Tap records rating
- **WHEN** the user taps the `7` control on a dish with no prior rating
- **THEN** `stars-store.set(dishId, 7)` is called and the screen advances to the next dish

#### Scenario: Valid range
- **WHEN** any `set(dishId, stars)` call is made via the selector
- **THEN** `stars` is an integer in the inclusive range `[1, 10]`

### Requirement: Advance on rating with no confirmation
After a rating is recorded, the flow SHALL transition to the next dish without showing any confirmation dialog, toast, or modal.

#### Scenario: Immediate advance
- **WHEN** the user taps a star control
- **THEN** no confirmation UI appears and the next dish is presented within a short transition

### Requirement: Skip advances without recording
The flow SHALL expose a "skip" action that advances to the next queued dish without recording a rating. A skipped dish SHALL remain in the unrated queue and SHALL NOT be moved to the end.

#### Scenario: Skip preserves queue position
- **WHEN** the user skips the currently visible dish
- **THEN** no rating is recorded and the next dish in the queue is shown

#### Scenario: Skipped dish still available
- **WHEN** the user skips every dish until the queue wraps (or the session ends) and then reopens the app
- **THEN** the previously skipped dishes still appear in the queue in their popularity order

### Requirement: Session undo
The flow SHALL expose an "undo" action that reverts the most recent rating recorded during the current session. The undo stack SHALL NOT persist across page reloads.

#### Scenario: Undo after rating
- **WHEN** the user rates a dish and then activates "undo"
- **THEN** the most recently rated dish's rating is cleared via `stars-store.clear(dishId)` and the flow returns to that dish

#### Scenario: Undo across reload
- **WHEN** the user rates a dish, reloads the page, and then activates "undo"
- **THEN** nothing happens because the session undo stack is empty; the previously rated dish keeps its rating

### Requirement: All-done state
When the queue is empty because every dish in the catalog has a rating, the home route SHALL show an "all done" state with links to the star-based leaderboard and to the mini-game, and SHALL NOT show a star selector.

#### Scenario: All dishes rated
- **WHEN** the user has rated every dish in the catalog
- **THEN** the home route shows a short "all done" message, a link to `/ranking`, and a link to `/game`

#### Scenario: Clearing a rating re-enters the queue
- **WHEN** from the all-done state the user navigates to `/ranking`, clears a single dish's rating, and returns to `/`
- **THEN** that dish is the next dish shown in the queue

### Requirement: Progress indicator
The home route SHALL display a small unobtrusive counter in the form `rated / total` somewhere above or below the current dish view.

#### Scenario: Counter reflects state
- **WHEN** the user has rated 12 dishes out of a 79-dish catalog
- **THEN** the counter shows "12 / 79"

### Requirement: Desktop keyboard shortcuts
On devices where `matchMedia('(pointer: fine)')` matches, the home route SHALL bind digit keys `1`-`9` to rate 1–9 stars, `0` to rate 10 stars, `Space` to skip, and `Backspace` to undo. On touch-primary devices the home route SHALL NOT register these listeners.

#### Scenario: Digit key rates
- **WHEN** the app is open on a desktop browser and the user presses `7`
- **THEN** the currently visible dish is rated 7 stars and the flow advances

#### Scenario: Zero key means ten
- **WHEN** the user presses `0`
- **THEN** the currently visible dish is rated 10 stars

#### Scenario: Touch device
- **WHEN** the app is open on a phone with touch as the primary pointer
- **THEN** keydown listeners for star shortcuts are not registered

### Requirement: Home-to-game navigation
The home route SHALL expose a visible control linking to `/game` (the mini-game) and a visible control linking to `/ranking` (the star leaderboard).

#### Scenario: Navigate to game
- **WHEN** the user taps the game control on the home route
- **THEN** the browser navigates to `/game`

#### Scenario: Navigate to ranking
- **WHEN** the user taps the ranking control on the home route
- **THEN** the browser navigates to `/ranking`

### Requirement: Star-based leaderboard at `/ranking`
The route `/ranking` SHALL render the star-based leaderboard, sorting dishes by current star rating descending. Unrated dishes SHALL appear below a labeled divider. Each rated entry SHALL display the dish name, restaurant name, price, and star rating.

#### Scenario: Rated dishes on top
- **WHEN** the user has rated some dishes and views `/ranking`
- **THEN** rated dishes appear at the top sorted by stars descending, followed by a divider, followed by unrated dishes

#### Scenario: Empty state
- **WHEN** the user views `/ranking` with no ratings recorded
- **THEN** the rated section is empty and the unrated section contains every dish

### Requirement: Inline re-rate from leaderboard
Each rated entry on `/ranking` SHALL support being activated to reveal an inline star editor exposing the same 1–10 selector plus a "clear rating" control. Selecting a new value SHALL update the store and collapse the row. Clearing SHALL remove the rating and move the row below the divider.

#### Scenario: Change a rating
- **WHEN** the user taps a row showing "8 stars" and then taps "6" in the inline editor
- **THEN** the store records a new rating of 6 for that dish, the row re-sorts, and the editor collapses

#### Scenario: Clear a rating
- **WHEN** the user taps a row showing "8 stars" and then activates "clear rating"
- **THEN** the store removes that dish's rating and the row moves into the unrated section

### Requirement: Export and import star ratings
The ranking route SHALL expose an "export" control that downloads the current star ratings as a JSON file via `stars-store.export()`, and an "import" control that replaces the current star ratings from a user-selected JSON file after confirmation.

#### Scenario: Export
- **WHEN** the user activates "export"
- **THEN** a JSON file download begins whose contents equal `await starsStore.export()`

#### Scenario: Import with confirmation
- **WHEN** the user activates "import", selects a JSON file, and confirms the replacement prompt
- **THEN** `starsStore.import()` is called with the file contents and the leaderboard re-renders from the new ratings
