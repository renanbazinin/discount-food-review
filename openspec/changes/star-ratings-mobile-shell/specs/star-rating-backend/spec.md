## ADDED Requirements

### Requirement: Ratings collection replaces votes collection
The DB module SHALL use a `ratings` collection in the `food-ranking` database for all per-user per-dish star ratings. It SHALL NOT use a `votes` collection. On first connect, the DB module SHALL attempt to drop the legacy `votes` collection via `db.collection('votes').drop()` inside a try/catch that swallows "collection not found" errors.

#### Scenario: Fresh cluster
- **WHEN** the singleton initializes against a fresh cluster with no `votes` collection
- **THEN** the drop attempt fails silently, the `ratings` collection is created lazily on first write, and `getCollections()` resolves normally

#### Scenario: Cluster with stale votes collection
- **WHEN** the singleton initializes against a cluster where the `votes` collection still exists from the prior one-vote model
- **THEN** the drop succeeds and the collection is removed from the database

### Requirement: Rating document shape
Documents in the `ratings` collection SHALL have the shape `{ _id: ObjectId, userId: string, dishId: string, stars: number, timestamp: number }`. The `stars` field SHALL be an integer in `[1, 10]`. The collection SHALL NOT store any additional identifying fields.

#### Scenario: Inspect a rating document
- **WHEN** any rating document is inspected
- **THEN** it contains exactly the five fields above, with `stars` being an integer 1–10

### Requirement: Indexes ensured on first connect
On first connect, the DB module SHALL create the following indexes via idempotent `createIndex` calls before returning to callers:

- `ratings`: unique compound index on `{ userId: 1, dishId: 1 }`
- `ratings`: non-unique index on `{ dishId: 1 }`

#### Scenario: Indexes do not exist
- **WHEN** the singleton initializes against a fresh database
- **THEN** both indexes are created before `getCollections()` resolves

#### Scenario: Indexes already exist
- **WHEN** the singleton initializes against a database where both indexes are already present
- **THEN** `createIndex` is still called, the calls are no-ops, and `getCollections()` resolves normally

### Requirement: Leaderboard endpoint returns aggregates
The route `GET /api/leaderboard` SHALL return an array of `{ dishId, averageStars, ratingCount }` objects, one per dish that currently has at least one rating, computed via a Mongo `$group` aggregation over the `ratings` collection using `$avg` for `averageStars` and `$sum: 1` for `ratingCount`.

#### Scenario: Leaderboard with ratings
- **WHEN** the database contains three ratings for `dish-a` averaging 8 and two ratings for `dish-b` averaging 10
- **THEN** the response is `200` with a JSON array containing `{ dishId: "dish-a", averageStars: 8, ratingCount: 3 }` and `{ dishId: "dish-b", averageStars: 10, ratingCount: 2 }` in any order

#### Scenario: Empty leaderboard
- **WHEN** the ratings collection is empty and the route is called
- **THEN** the response is `200` with `[]`

#### Scenario: Zero-count dishes absent
- **WHEN** the leaderboard is returned
- **THEN** no entry with `ratingCount: 0` appears — the client is responsible for merging zero-count dishes from the catalog

### Requirement: My-ratings endpoint
The route `GET /api/ratings` SHALL return the caller's own ratings as an array of `{ dishId, stars, timestamp }`, scoped by the `x-user-id` request header.

#### Scenario: Caller has ratings
- **WHEN** the caller's `x-user-id` is `"alice"` and alice has three ratings in the database
- **THEN** the response is `200` with an array of length 3 containing only alice's rating records

#### Scenario: Caller has no ratings
- **WHEN** the caller's `x-user-id` is a fresh UUID not present in the database
- **THEN** the response is `200` with `[]`

### Requirement: Upsert rating endpoint
The route `PUT /api/ratings/[dishId]` SHALL accept a JSON body `{ stars: number }`, validate `stars` is an integer in `[1, 10]`, validate the `dishId` path parameter against the static catalog, and upsert the document for the caller's `x-user-id` and the path `dishId` with an atomic `updateOne(..., { $set: { stars, timestamp } }, { upsert: true })`. It SHALL return the upserted `{ dishId, stars, timestamp }` with status `200`.

#### Scenario: New rating
- **WHEN** the caller has no existing rating for `dish-a` and calls `PUT /api/ratings/dish-a` with body `{ "stars": 7 }`
- **THEN** a new document is inserted with `userId: <caller>, dishId: "dish-a", stars: 7, timestamp: <now>`, and the response is `200` with `{ dishId: "dish-a", stars: 7, timestamp: <now> }`

#### Scenario: Update existing rating
- **WHEN** the caller already has a rating of 7 for `dish-a` and calls `PUT /api/ratings/dish-a` with body `{ "stars": 4 }`
- **THEN** the existing document is updated in place (`stars` becomes 4, `timestamp` refreshed) with no new document inserted, and the response is `200`

#### Scenario: Invalid stars value
- **WHEN** any caller calls `PUT /api/ratings/dish-a` with body `{ "stars": 11 }` or `{ "stars": 7.5 }` or `{ "stars": "seven" }`
- **THEN** the response is `400` with `{ error: <message> }` and no write occurs

#### Scenario: Unknown dishId
- **WHEN** the caller calls `PUT /api/ratings/unknown-id` for a dishId not in the static catalog
- **THEN** the response is `400` with `{ error: <message> }` and no write occurs

### Requirement: Clear rating endpoint
The route `DELETE /api/ratings/[dishId]` SHALL remove the document scoped by the caller's `x-user-id` and the path `dishId` if it exists, and SHALL return `204` regardless of whether a document was removed.

#### Scenario: Existing rating
- **WHEN** the caller has a rating for `dish-a` and calls `DELETE /api/ratings/dish-a`
- **THEN** the document is removed and the response is `204`

#### Scenario: No rating to remove
- **WHEN** the caller has no rating for `dish-a` and calls `DELETE /api/ratings/dish-a`
- **THEN** the response is `204` with no error

### Requirement: Missing x-user-id header
Every API route under `/api/ratings*` and `/api/leaderboard` SHALL return `400` with `{ error: <message> }` when the `x-user-id` header is missing, empty, or not a non-empty string. This includes the public `GET /api/leaderboard` — every request must identify itself.

#### Scenario: No header on any route
- **WHEN** any request to `/api/leaderboard`, `/api/ratings`, `/api/ratings/[dishId]` is made with no `x-user-id` header
- **THEN** the response is `400` with a body containing `error`

### Requirement: Mongo failure handling
Every API endpoint SHALL catch connection-layer failures and return `503` with `{ error: <message> }`. Other unexpected errors SHALL return `500` with `{ error: <message> }`.

#### Scenario: Mongo unreachable
- **WHEN** the Mongo connect call rejects during a request
- **THEN** the response is `503` with a body containing `error`

### Requirement: Per-user scoping
Every ratings endpoint SHALL scope its read or write to the user id resolved from `x-user-id` and SHALL NOT touch documents belonging to other users. The public leaderboard endpoint SHALL aggregate across all users.

#### Scenario: Per-user read isolation
- **WHEN** alice has 5 ratings and bob has 3 ratings, and bob calls `GET /api/ratings`
- **THEN** the response contains bob's 3 ratings and none of alice's

#### Scenario: Leaderboard aggregates across all users
- **WHEN** alice has rated `dish-a` as 8 and bob has rated `dish-a` as 6, and anyone calls `GET /api/leaderboard`
- **THEN** the response contains an entry for `dish-a` with `averageStars: 7, ratingCount: 2`
