## ADDED Requirements

### Requirement: Pairwise comparison at `/game`
The pairwise comparison screen SHALL be served at the route `/game`. Opening `/game` SHALL present two dish cards using the same interaction rules that were previously in effect at the root route (one-tap pick, Elo update, twin-pair filter, skip, never-seen-it, desktop keyboard shortcuts).

#### Scenario: Game route renders
- **WHEN** the user navigates to `/game`
- **THEN** the pairwise comparison screen is shown with two dish cards that are not twins

#### Scenario: Root route is no longer the game
- **WHEN** the user navigates to `/`
- **THEN** the pairwise comparison screen is not shown; the star-rating flow is shown instead

### Requirement: Game navigation chrome
The `/game` route SHALL expose a visible control linking back to the home route (`/`) and a visible control linking to `/game/results`.

#### Scenario: Back to home
- **WHEN** the user taps the home control on `/game`
- **THEN** the browser navigates to `/`

#### Scenario: Open results
- **WHEN** the user taps the results control on `/game`
- **THEN** the browser navigates to `/game/results`

### Requirement: Elo leaderboard at `/game/results`
The route `/game/results` SHALL render the Elo leaderboard derived from the pairwise match event log: dishes sorted by current Elo rating descending, with "confident" dishes (matches ≥ 3) separated from "under-sampled" dishes (matches < 3) by a labeled divider, and each entry showing dish name, restaurant name, price, and rounded Elo rating.

#### Scenario: After some matches
- **WHEN** the user records several pairwise matches and opens `/game/results`
- **THEN** the list is sorted by Elo descending and the confident/under-sampled divider is visible at the threshold

#### Scenario: No matches yet
- **WHEN** the user opens `/game/results` with an empty event log
- **THEN** all dishes appear in the under-sampled section sorted by the popularity-seeded prior rating

### Requirement: Results-to-game navigation
The `/game/results` route SHALL expose a visible control linking back to `/game`.

#### Scenario: Back to game
- **WHEN** the user taps the back control on `/game/results`
- **THEN** the browser navigates to `/game`

### Requirement: Game results are isolated from stars
The `/game/results` view SHALL compute rankings only from the `RatingsStore` event log and SHALL NOT read from `StarsStore`. Conversely, the `/ranking` view SHALL NOT read from `RatingsStore`.

#### Scenario: Stars do not affect game leaderboard
- **WHEN** the user has 50 star ratings recorded but 0 pairwise matches
- **THEN** `/game/results` shows every dish in the under-sampled section ordered only by popularity priors, identical to what it would show with 0 star ratings

#### Scenario: Matches do not affect star leaderboard
- **WHEN** the user has 0 star ratings but 50 pairwise matches recorded
- **THEN** `/ranking` shows every dish in the unrated section, identical to what it would show with 0 pairwise matches

### Requirement: Export game results
The `/game/results` route SHALL expose an export control that downloads the event log via `ratingsStore.export()` as a JSON file, and an import control that replaces the event log via `ratingsStore.import()` after a user confirmation.

#### Scenario: Export the event log
- **WHEN** the user activates "export" on `/game/results`
- **THEN** a JSON file download begins whose contents equal `await ratingsStore.export()`

#### Scenario: Import with confirmation
- **WHEN** the user activates "import" on `/game/results`, selects a JSON file, and confirms the replacement prompt
- **THEN** `ratingsStore.import()` is called with the file contents and the leaderboard re-renders
