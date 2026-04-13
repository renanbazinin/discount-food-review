## ADDED Requirements

### Requirement: Ranking screen reachable from comparison
The app SHALL expose a single always-visible control on the pairwise comparison screen that navigates to the ranking screen, and a reciprocal control on the ranking screen to return.

#### Scenario: Open the ranking
- **WHEN** the user taps the ranking control from the comparison screen
- **THEN** the ranking screen is shown

#### Scenario: Return to comparison
- **WHEN** the user taps the back control from the ranking screen
- **THEN** the comparison screen is shown with the same pair state it had before navigation

### Requirement: Ranked list of confident dishes
The ranking screen SHALL show dishes in descending order of current Elo rating, and SHALL visually separate "confident" dishes (those with at least 3 recorded match events) from "under-sampled" dishes (those with fewer than 3) with a clear divider and a label on the divider indicating the threshold.

#### Scenario: Mixed confidence set
- **WHEN** the ranking is viewed with some dishes having 5+ events and others having 0-2 events
- **THEN** the 5+-event dishes appear in the top section sorted by Elo, followed by a divider, followed by the under-sampled dishes

#### Scenario: All under-sampled
- **WHEN** the ranking is viewed before any match has been recorded
- **THEN** the under-sampled section shows the full catalog sorted by the popularity-seeded prior rating

### Requirement: Ranking entry shows dish, restaurant, and rating
Each entry on the ranking screen SHALL display the dish name, the restaurant name, the current price, and the current Elo rating (rounded to the nearest integer).

#### Scenario: Entry contents
- **WHEN** a dish with name "המבורגר אנטריקוט", price 40, restaurant "דיינר", and rating 1642.7 is rendered
- **THEN** the entry shows "המבורגר אנטריקוט", "דיינר", "₪40", and "1643"

### Requirement: Export and import controls
The ranking screen SHALL expose an "export" action that downloads the current event log as a JSON file and an "import" action that replaces the current event log from a user-selected JSON file after confirmation.

#### Scenario: Export
- **WHEN** the user taps "export"
- **THEN** the browser downloads a file whose contents equal `await ratingsStore.export()`

#### Scenario: Import with confirmation
- **WHEN** the user taps "import", selects a JSON file, and confirms the replacement prompt
- **THEN** `ratingsStore.import()` is called with the file contents and the ranking re-renders from the new event log

#### Scenario: Import cancelled
- **WHEN** the user taps "import" and dismisses the confirmation prompt
- **THEN** no change is made to the event log
