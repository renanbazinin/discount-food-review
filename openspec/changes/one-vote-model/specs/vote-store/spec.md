## ADDED Requirements

### Requirement: VotesStore interface
The system SHALL define a `VotesStore` interface in `src/lib/stores/votes-store.ts` with the following methods:

- `getLeaderboard(): Promise<VoteCount[]>`
- `vote(dishId: string): Promise<MyVote>`
- `unvote(): Promise<void>`
- `getMyVote(): MyVote | null`

Where `VoteCount = { dishId: string; count: number }` and `MyVote = { voteId: string; dishId: string; timestamp: number }`.

#### Scenario: Interface has four methods
- **WHEN** the `VotesStore` interface is inspected
- **THEN** it defines exactly the four methods above with the stated signatures

### Requirement: HTTP adapter for network methods
The system SHALL provide a class `HttpVotesStore implements VotesStore` in `src/lib/stores/http-votes-store.ts` whose network methods (`getLeaderboard`, `vote`, `unvote`) call the `/api/leaderboard` and `/api/votes` endpoints documented by the votes-api capability.

#### Scenario: getLeaderboard maps to GET
- **WHEN** `getLeaderboard()` is called
- **THEN** a `fetch('/api/leaderboard')` is issued and the parsed JSON array is returned

#### Scenario: vote with no existing vote maps to POST with dishId only
- **WHEN** `vote("abc-r")` is called with no prior vote in localStorage
- **THEN** a `POST /api/votes` is issued with body `{ dishId: "abc-r" }` (no `oldVoteId`) and the parsed server response is returned

#### Scenario: vote with existing vote maps to POST with oldVoteId
- **WHEN** `vote("xyz-r")` is called while localStorage holds a prior vote with `voteId: "abc-123"`
- **THEN** a `POST /api/votes` is issued with body `{ dishId: "xyz-r", oldVoteId: "abc-123" }` and the parsed server response is returned

#### Scenario: unvote maps to DELETE
- **WHEN** `unvote()` is called while localStorage holds a prior vote with `voteId: "abc-123"`
- **THEN** a `fetch('/api/votes/abc-123', { method: 'DELETE' })` is issued

#### Scenario: unvote without prior vote is a no-op
- **WHEN** `unvote()` is called with no prior vote in localStorage
- **THEN** no network request is issued and the method resolves with `undefined`

### Requirement: localStorage ownership
The adapter SHALL own the `vote:v1` localStorage key. On successful `vote`, the adapter SHALL write the new `MyVote` to localStorage. On successful `unvote`, the adapter SHALL remove the key. `getMyVote()` SHALL read and return the current value from localStorage (or `null`).

#### Scenario: Vote writes localStorage
- **WHEN** `vote("abc-r")` resolves with `{ voteId: "new", dishId: "abc-r", timestamp: 123 }`
- **THEN** `localStorage.getItem('vote:v1')` returns a JSON string that parses to `{ voteId: "new", dishId: "abc-r", timestamp: 123 }`

#### Scenario: Unvote clears localStorage
- **WHEN** `unvote()` resolves successfully
- **THEN** `localStorage.getItem('vote:v1')` returns `null`

#### Scenario: getMyVote reads localStorage
- **WHEN** localStorage contains a valid `vote:v1` JSON string and `getMyVote()` is called
- **THEN** it returns the parsed `MyVote` object

#### Scenario: getMyVote with invalid storage
- **WHEN** localStorage contains a malformed `vote:v1` value (non-JSON, wrong shape)
- **THEN** `getMyVote()` returns `null` without throwing

### Requirement: Errors on non-2xx
The HTTP adapter's network methods SHALL throw an `Error` whose message includes the HTTP status code and the response body text whenever the underlying `fetch` returns a non-2xx response. localStorage SHALL NOT be updated on network failure.

#### Scenario: 503 from server
- **WHEN** `vote("abc-r")` is called and the server returns `503`
- **THEN** the method rejects with an `Error` whose message contains `503`, and `localStorage.getItem('vote:v1')` is unchanged from its pre-call value

#### Scenario: 400 invalid dishId
- **WHEN** `vote("unknown")` is called and the server returns `400 { error: "Unknown dish" }`
- **THEN** the method rejects with an `Error` whose message contains `400` and `Unknown dish`, and localStorage is unchanged

### Requirement: Module-level singleton
The adapter file SHALL export a module-level `votesStore: VotesStore = new HttpVotesStore()` singleton. UI components SHALL import `votesStore` from this file exclusively.

#### Scenario: UI imports the singleton
- **WHEN** `src/routes/+page.svelte` is inspected
- **THEN** it imports `votesStore` from `$lib/stores/http-votes-store` (not from a LocalStorage adapter, not via `new HttpVotesStore()` directly)

### Requirement: Graceful handling of stale localStorage
If `getMyVote()` returns a vote whose `voteId` no longer exists in the database (the server's 503/400 response logic does not handle this directly — it surfaces only when the client tries to `vote` or `unvote`), the next successful `vote` call SHALL succeed normally and overwrite localStorage. `unvote` against a stale vote SHALL also succeed (server returns `204` for unknown `voteId`) and clear localStorage.

#### Scenario: Stale vote change
- **WHEN** the client has `{ voteId: "stale", dishId: "x" }` in localStorage, the database has no record of `"stale"`, and the user calls `vote("y")`
- **THEN** the server's delete is a no-op, the insert succeeds, the response is `201` with a new `voteId`, and localStorage is updated to the new vote

#### Scenario: Stale unvote
- **WHEN** the client has `{ voteId: "stale", dishId: "x" }` in localStorage and the user calls `unvote()`
- **THEN** `DELETE /api/votes/stale` returns `204`, localStorage is cleared, and no error surfaces
