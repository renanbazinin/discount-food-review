## ADDED Requirements

### Requirement: Dish label readability on mobile

The `/rate` queue card SHALL display the current dish's name in full or with at most a 2-line clamp on viewports 320px wide and up, without single-line ellipsis truncation of the dish name.

#### Scenario: Long dish name on a narrow phone
- **WHEN** the viewport is 360px wide and the current dish has a name that would overflow one line at the mobile title font size
- **THEN** the dish name SHALL wrap onto a second line inside the image overlay
- **AND** no characters of the dish name SHALL be hidden behind the price pill or the edges of the card

#### Scenario: Very long dish name
- **WHEN** a dish name still overflows two lines at the mobile title font size
- **THEN** the text SHALL be clamped with an ellipsis at the end of the second line rather than cut off mid-character without indication

### Requirement: Restaurant name and price remain visible

The overlay on `/rate` SHALL always show the restaurant name (one line, ellipsis allowed) and the price pill without either element being clipped off-screen on mobile viewports 320px and up.

#### Scenario: Long restaurant name
- **WHEN** the restaurant name exceeds the available width
- **THEN** it SHALL be truncated with an ellipsis on a single line
- **AND** it SHALL remain vertically aligned below the dish name

#### Scenario: Price pill never overlaps the label
- **WHEN** the dish name wraps to two lines
- **THEN** the price pill SHALL remain fully visible and SHALL NOT overlap the dish name or restaurant name

### Requirement: Card layout stays within the viewport

The `/rate` screen SHALL keep the image card, star selector, and navigation footer simultaneously visible on mobile viewports with height down to 640px, without requiring the user to scroll the page to reach the star selector.

#### Scenario: Short mobile viewport
- **WHEN** the viewport is 360×640 with the `/rate` page loaded and a dish ready to rate
- **THEN** the image card, the "מה דעתך?" prompt, the star selector, and the navigation footer SHALL all be visible without page scroll
- **AND** the overlay label block SHALL be positioned against the bottom edge of the image card with readable contrast

### Requirement: Fallback (imageless) card parity

When a dish has no image and the gradient + emoji fallback is rendered, the same responsive label rules SHALL apply: the dish name wraps to at most 2 lines, the restaurant name truncates to 1 line, and no element leaves the card bounds on mobile.

#### Scenario: Fallback card with long name on mobile
- **WHEN** a dish without an image is shown on a 360px-wide viewport
- **THEN** the dish name SHALL wrap within the card
- **AND** no emoji, text, or price element SHALL extend past the card's rounded edges
