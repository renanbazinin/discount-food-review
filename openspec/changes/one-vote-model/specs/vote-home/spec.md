## ADDED Requirements

### Requirement: Single-screen app at `/`
The app SHALL have exactly one user-facing route, `/`, which renders the home-vote screen. Navigating to any other path SHALL result in a standard SvelteKit fallback (the SPA fallback HTML) without specialized routes for rate, game, ranking, or results.

#### Scenario: Home is the only route
- **WHEN** the user navigates to `/`
- **THEN** the home-vote screen is rendered

#### Scenario: Removed routes are gone
- **WHEN** the user navigates to `/rate`, `/game`, `/game/results`, or `/ranking`
- **THEN** SvelteKit returns its fallback response; no custom page exists at those paths

### Requirement: Hero card shows the user's current vote
When `votesStore.getMyVote()` returns a non-null value, the home screen SHALL render a hero card at the top of the page showing the dish's image (or typographic fallback), name, restaurant, price, and the dish's current global vote count. The hero SHALL be labeled `הבחירה שלך`.

#### Scenario: User has voted
- **WHEN** the user's localStorage holds a vote for `dish-x` and the leaderboard has loaded
- **THEN** the hero card displays `dish-x` with its image, name, restaurant, price, the label `הבחירה שלך`, and the current vote count for that dish

#### Scenario: Hero reflects global count, not just own vote
- **WHEN** the user voted for `dish-x` and 16 other votes exist for `dish-x`
- **THEN** the hero card shows a count of 17 (the user's own vote is included)

### Requirement: Empty state when no vote
When `votesStore.getMyVote()` returns `null`, the home screen SHALL render a friendly empty state in the hero position with a headline (`עדיין לא הצבעת`), a short hint (`בחר את המנה הכי טובה מהרשימה למטה`), and a small illustration. The empty state SHALL NOT include a separate CTA button because the leaderboard list below is itself the CTA.

#### Scenario: No vote
- **WHEN** the user opens the app for the first time
- **THEN** the hero position shows the empty-state headline, hint, and illustration — not a dish card

### Requirement: Leaderboard list of voted dishes
Below the hero, the home screen SHALL render a ranked list of every dish that has at least one vote, sorted by `count` descending. Ties SHALL be broken by `popularity` descending (from the static catalog). Each entry SHALL show the rank position, dish image (or typographic fallback), name, restaurant, price, and count.

#### Scenario: Ranked list
- **WHEN** dishes A, B, C have vote counts 5, 3, 3 (with A > B > C by popularity)
- **THEN** the list renders in order [A (5), B (3), C (3)]

#### Scenario: Tie broken by popularity
- **WHEN** dishes B and C both have count 3, and B has higher popularity than C
- **THEN** B appears before C in the list

### Requirement: Unvoted dishes section
Below a labeled divider `מנות שעדיין לא הצביעו · {N}`, the home screen SHALL render every dish with zero votes, sorted by `popularity` descending, with muted styling (lower opacity than the voted section).

#### Scenario: Unvoted dishes rendered
- **WHEN** the catalog contains 79 dishes and 12 of them have votes
- **THEN** the unvoted section shows 67 dishes with the divider label showing `67`

#### Scenario: All dishes voted
- **WHEN** every dish in the catalog has at least one vote
- **THEN** the unvoted section is hidden (no divider, no empty list)

### Requirement: Tap any row to vote or change vote
Tapping any row in either the voted section or the unvoted section SHALL cast the user's vote for that dish (if they have no current vote) or change the user's vote from their current dish to the tapped dish. Tapping the hero card SHALL also trigger a change-vote interaction for whichever dish is tapped as the replacement.

#### Scenario: First vote
- **WHEN** the user has no vote and taps a dish row
- **THEN** `votesStore.vote(dishId)` is called, on success the hero card updates to show the tapped dish, and the leaderboard re-sorts with the tapped dish's count incremented

#### Scenario: Change vote
- **WHEN** the user has a vote for `dish-a` and taps the row for `dish-b`
- **THEN** `votesStore.vote("dish-b")` is called (which internally passes the old `voteId`), on success the hero updates, `dish-a`'s count decrements, and `dish-b`'s count increments

#### Scenario: Tap current vote (toggle unvote)
- **WHEN** the user has a vote for `dish-a` and taps the hero card for `dish-a`
- **THEN** `votesStore.unvote()` is called, on success the hero reverts to the empty state, and `dish-a`'s count decrements

### Requirement: Optimistic UI with rollback
When a vote action is taken, the home screen SHALL update the in-memory counts and the hero immediately, before the network round-trip completes. On network or server failure, the UI SHALL revert to its pre-action state and surface an error toast.

#### Scenario: Successful optimistic update
- **WHEN** the user taps a dish and the server responds `201`
- **THEN** the UI reflects the new vote immediately on tap, and no visible re-render happens when the response arrives (aside from storing the server's `voteId`)

#### Scenario: Failed optimistic update
- **WHEN** the user taps a dish and the server responds `503`
- **THEN** the in-memory counts and the hero are reverted to their pre-tap state, and an error banner is shown to the user

### Requirement: Loading skeleton
While the leaderboard is loading, the home screen SHALL render a shimmer skeleton placeholder in place of the hero card and the first several list rows, reusing the `.skeleton` CSS class already present in `src/app.css`.

#### Scenario: Cold load
- **WHEN** the app is opened and `getLeaderboard()` has not yet resolved
- **THEN** the page shows a shimmering hero-sized placeholder and at least 5 shimmering list-row placeholders

#### Scenario: Skeleton replaced
- **WHEN** `getLeaderboard()` resolves
- **THEN** the skeleton is replaced by the real hero and list without layout shift

### Requirement: Friendly Hebrew copy
The home screen SHALL use warm Hebrew copy for its labels and empty states:

- Header title: `דירוג אוכל` or similar app title (unchanged)
- Hero label (voted): `הבחירה שלך`
- Hero count suffix: `הצביעו`
- Empty-state headline: `עדיין לא הצבעת`
- Empty-state hint: `בחר את המנה הכי טובה מהרשימה למטה`
- Voted section heading (optional, can be visual only): `הדירוג`
- Unvoted divider label: `מנות שעדיין לא הצביעו · {N}`
- Error banner: `משהו השתבש — נסה שוב`

#### Scenario: Copy verbatim
- **WHEN** the home screen is rendered in each of its states (voted, unvoted, loading, error)
- **THEN** the visible Hebrew strings match the copy above

### Requirement: No bottom tab bar
The root layout SHALL NOT render a bottom tab bar. The previous `BottomTabBar` component SHALL be deleted.

#### Scenario: Layout renders without tab bar
- **WHEN** `+layout.svelte` is rendered
- **THEN** no `<nav>` tab bar element is present in the DOM

### Requirement: No server-side rendering of pages
The root layout SHALL set `ssr = false` and SHALL NOT set `prerender = true`. Pages render entirely client-side; the server only handles `/api/*` routes.

#### Scenario: No prerender directive
- **WHEN** `src/routes/+layout.ts` is inspected
- **THEN** it exports `ssr = false` and does not export `prerender`
