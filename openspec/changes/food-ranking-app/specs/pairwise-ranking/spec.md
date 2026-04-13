## ADDED Requirements

### Requirement: Primary screen is pairwise comparison
The app SHALL open on the pairwise comparison screen by default, showing two dishes side-by-side (on desktop) or stacked (on phone), with no intermediate landing page, onboarding, or menu.

#### Scenario: Cold open
- **WHEN** the user opens the app for the first time
- **THEN** the pairwise comparison screen is the first content shown, and two dishes are already visible

#### Scenario: Returning open
- **WHEN** the user reopens the app after previous use
- **THEN** the pairwise comparison screen is still the first content shown

### Requirement: One tap records a pick
The app SHALL treat a single tap or click on either of the two visible dish cards as the user's pick, SHALL record a match event via the `RatingsStore` with that dish as winner and the other as loser, and SHALL then present the next pair without any confirmation prompt.

#### Scenario: Picking the left card
- **WHEN** the user taps the left dish card
- **THEN** a match event is recorded with that dish as winner and the right dish as loser, and a new pair of dishes is shown immediately

#### Scenario: No confirmation prompt
- **WHEN** the user taps a dish card
- **THEN** no confirmation dialog, toast, or modal appears between the pick and the next pair

### Requirement: Elo update on each match
The app SHALL update Elo ratings for the two dishes in a match using the standard Elo formula with K=32 immediately after each match event is recorded.

#### Scenario: Winner rating increases
- **WHEN** a match is recorded where the winner had a lower prior Elo rating than the loser
- **THEN** the winner's rating increases and the loser's rating decreases by the same amount

#### Scenario: Evenly matched
- **WHEN** two dishes with identical Elo ratings are compared
- **THEN** the winner's rating increases by 16 and the loser's rating decreases by 16 (K/2)

### Requirement: Popularity-seeded priors
The app SHALL, when computing Elo ratings for a dish with no match events yet, use an initial rating derived by min-max normalizing the dish's `popularity` field across the full catalog into the range [1400, 1600].

#### Scenario: Popular dish starts higher
- **WHEN** the catalog contains dishes with `popularity` values ranging from 0 to 1276, and the dish with popularity 1276 has no match events
- **THEN** its initial Elo rating is 1600

#### Scenario: Unseen dish in flat-popularity set
- **WHEN** every dish in the catalog has `popularity` equal to 0
- **THEN** every dish's initial Elo rating is 1500 (the midpoint)

### Requirement: Pair selection with coverage and close-match bias
The app SHALL select each next pair via a selection strategy that, with probability 0.3, picks the dish with the fewest match events so far and pairs it with a random dish within ±100 Elo; otherwise, picks two dishes whose Elo ratings are within ±75 of each other.

#### Scenario: Under-sampled dish surfaces
- **WHEN** one dish has zero match events while all others have at least five, and the selection roll lands in the 0.3 coverage branch
- **THEN** the zero-event dish is one of the two dishes shown in the next pair

#### Scenario: Close-match branch
- **WHEN** the selection roll lands in the 0.7 close-match branch
- **THEN** the two dishes shown have Elo ratings within 75 points of each other (possibly after widening the window if needed)

### Requirement: Twin-pair filter
The app SHALL never present a pair of dishes that share the same `rootId` in the pairwise screen. If the selection strategy produces such a pair, the app SHALL re-roll until it produces a non-twin pair.

#### Scenario: Telbank variants never face off
- **WHEN** the pair selector initially picks `"12345-t"` and `"12345-r"`
- **THEN** the app discards that pair and selects a different pair before rendering

### Requirement: Skip and "never seen it"
The app SHALL offer a "skip" action (no match event recorded, move to next pair) and a "never seen it" action (no match event recorded, the un-seen dish is deprioritized in subsequent coverage-branch selections).

#### Scenario: Skip
- **WHEN** the user taps "skip"
- **THEN** no match event is recorded and a new pair is presented

#### Scenario: Never seen it
- **WHEN** the user taps "never seen it" on the left dish
- **THEN** no match event is recorded, a new pair is presented, and subsequent coverage-branch selections deprioritize the left dish

### Requirement: Keyboard shortcuts on devices with fine pointers
The app SHALL, on devices where the primary pointer is "fine" (desktop mice/trackpads), bind `←` (ArrowLeft) to picking the right-hand card and `→` (ArrowRight) to picking the left-hand card, matching the RTL visual order, and SHALL NOT bind those keys on touch-primary devices.

#### Scenario: Desktop arrow key
- **WHEN** the app is open on a desktop browser and the user presses `←`
- **THEN** the right-hand card is picked as if it had been clicked

#### Scenario: Touch device
- **WHEN** the app is open on a phone with touch as the primary pointer
- **THEN** no keyboard listeners are registered
