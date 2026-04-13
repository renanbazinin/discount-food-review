## ADDED Requirements

### Requirement: Leaderboard endpoint
The route `GET /api/leaderboard` SHALL return an array of `{ dishId, count }` objects, one per dish that currently has at least one vote, computed via a Mongo `$group` aggregation over the `votes` collection.

#### Scenario: Leaderboard with votes
- **WHEN** the database contains 5 votes for `dish-a`, 3 votes for `dish-b`, and 0 votes for everything else, and the route is called
- **THEN** the response is `200` with a JSON array containing `[{ dishId: "dish-a", count: 5 }, { dishId: "dish-b", count: 3 }]` in any order

#### Scenario: Empty leaderboard
- **WHEN** the votes collection is empty and the route is called
- **THEN** the response is `200` with `[]`

#### Scenario: Zero-vote dishes are absent
- **WHEN** the leaderboard is returned
- **THEN** no entry with `count: 0` appears in the response — zero-vote dishes are the client's responsibility to derive from the catalog

### Requirement: Cast or change vote endpoint
The route `POST /api/votes` SHALL accept a JSON body `{ dishId: string, oldVoteId?: string }`. On a successful call, the server SHALL: if `oldVoteId` is provided, delete the existing vote document with that `voteId`; then insert a new vote document with a server-generated `voteId`, the provided `dishId`, and a server-set `timestamp`; and return the new vote as `{ voteId, dishId, timestamp }` with status `201`.

#### Scenario: First vote
- **WHEN** the user posts `{ dishId: "abc-r" }` with no `oldVoteId`
- **THEN** a new vote document is inserted and the response is `201` with body `{ voteId: <generated>, dishId: "abc-r", timestamp: <now> }`

#### Scenario: Change vote
- **WHEN** the user posts `{ dishId: "xyz-r", oldVoteId: "abc-123" }` where `abc-123` is the client's current vote id
- **THEN** the document with `voteId: "abc-123"` is deleted, a new document with a new `voteId` and `dishId: "xyz-r"` is inserted, and the response is `201` with the new `{ voteId, dishId: "xyz-r", timestamp }`

#### Scenario: Change vote where oldVoteId is stale
- **WHEN** the user posts a valid `dishId` with an `oldVoteId` that does not exist in the database (e.g. the database was wiped or the old vote was deleted elsewhere)
- **THEN** the delete is a no-op, the insert proceeds normally, and the response is still `201` with the new vote

#### Scenario: Invalid body — missing dishId
- **WHEN** the user posts `{}` or a body missing `dishId`
- **THEN** the response is `400` with `{ error: <message> }` and nothing is inserted or deleted

#### Scenario: Invalid body — unknown dishId
- **WHEN** the user posts `{ dishId: "does-not-exist" }` for a dishId not in the static catalog
- **THEN** the response is `400` with `{ error: <message> }` and nothing is inserted or deleted

### Requirement: Unvote endpoint
The route `DELETE /api/votes/[voteId]` SHALL remove the vote document with the path-parameter `voteId` if it exists, and SHALL return `204` regardless of whether a document was removed.

#### Scenario: Delete an existing vote
- **WHEN** the user calls `DELETE /api/votes/abc-123` and a document with that `voteId` exists
- **THEN** the document is removed and the response is `204` with no body

#### Scenario: Delete a non-existent vote
- **WHEN** the user calls `DELETE /api/votes/unknown-id`
- **THEN** the response is `204` with no body and no error

### Requirement: Server-side dishId validation
Every endpoint that accepts a `dishId` in its input SHALL validate that the id exists in the static catalog loaded server-side, and SHALL reject unknown ids with `400`.

#### Scenario: Known dishId
- **WHEN** a `POST /api/votes` body carries a `dishId` present in the catalog
- **THEN** validation passes and the write proceeds

#### Scenario: Unknown dishId
- **WHEN** a `POST /api/votes` body carries a `dishId` not present in the catalog
- **THEN** the response is `400` with `{ error: <message> }`

### Requirement: Mongo failure handling
Every endpoint SHALL catch connection-layer failures to MongoDB and return `503` with `{ error: <message> }`. Other unexpected errors SHALL return `500` with `{ error: <message> }`.

#### Scenario: Mongo unreachable
- **WHEN** the Mongo connect call rejects during a request
- **THEN** the response is `503` with a body containing `error`

#### Scenario: Unexpected error
- **WHEN** a query throws an unexpected error
- **THEN** the response is `500` with a body containing `error`

### Requirement: No rate limiting
The API routes SHALL NOT rate-limit requests by IP, cookie, or any other mechanism in v1. Anti-abuse is out of scope and is explicitly documented as honor-system.

#### Scenario: Rapid votes from one client
- **WHEN** a single client sends 100 `POST /api/votes` requests in rapid succession
- **THEN** the server accepts every request (subject only to Mongo's natural throughput), and no rate-limit response code is returned
