## ADDED Requirements

### Requirement: RatingsStore interface
The system SHALL define a `RatingsStore` interface in `src/lib/stores/ratings-store.ts` with the following async methods:

- `getLeaderboard(): Promise<RatingAggregate[]>`
- `getMyRatings(): Promise<MyRating[]>`
- `rate(dishId: string, stars: number): Promise<MyRating>`
- `clear(dishId: string): Promise<void>`

Where `RatingAggregate = { dishId: string; averageStars: number; ratingCount: number }` and `MyRating = { dishId: string; stars: number; timestamp: number }`.

#### Scenario: Interface has four methods
- **WHEN** the `RatingsStore` interface is inspected
- **THEN** it defines exactly the four methods above with the stated signatures

### Requirement: HTTP adapter
The system SHALL provide `HttpRatingsStore implements RatingsStore` in `src/lib/stores/http-ratings-store.ts` whose methods call the corresponding endpoints (`GET /api/leaderboard`, `GET /api/ratings`, `PUT /api/ratings/[dishId]`, `DELETE /api/ratings/[dishId]`).

#### Scenario: getLeaderboard maps to GET
- **WHEN** `getLeaderboard()` is called
- **THEN** a `fetch('/api/leaderboard', { headers: { 'x-user-id': <id> } })` is issued and the parsed JSON array is returned

#### Scenario: getMyRatings maps to GET
- **WHEN** `getMyRatings()` is called
- **THEN** a `fetch('/api/ratings', { headers: { 'x-user-id': <id> } })` is issued and the parsed JSON array is returned

#### Scenario: rate maps to PUT with body
- **WHEN** `rate("abc-r", 7)` is called
- **THEN** a `fetch('/api/ratings/abc-r', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-user-id': <id> }, body: '{"stars":7}' })` is issued and the parsed JSON response is returned

#### Scenario: clear maps to DELETE
- **WHEN** `clear("abc-r")` is called
- **THEN** a `fetch('/api/ratings/abc-r', { method: 'DELETE', headers: { 'x-user-id': <id> } })` is issued and the method resolves with `undefined`

### Requirement: Anonymous browser identity via localStorage
The HTTP adapter SHALL maintain a persistent anonymous user identity stored in localStorage under the key `user:v1` as a bare string UUID. The identity SHALL be lazily created on first access: if the key is missing, empty, or fails shape validation (not a non-empty string of reasonable length), a new UUID SHALL be generated and persisted.

#### Scenario: First access with empty localStorage
- **WHEN** the adapter is instantiated and any method is called, with `localStorage.getItem('user:v1')` returning `null`
- **THEN** a new UUID is generated, written to `localStorage` under `user:v1`, and used as the `x-user-id` for the request

#### Scenario: Subsequent access reuses id
- **WHEN** the adapter has previously created an id and is called again in the same session
- **THEN** the same id is read from localStorage and reused — no new UUID is generated

#### Scenario: Corrupted localStorage value
- **WHEN** `localStorage.getItem('user:v1')` returns an invalid value (empty string, non-string, array, object)
- **THEN** a new UUID is generated, the bad value is overwritten, and the new id is used

### Requirement: `x-user-id` header on every request
Every `fetch` call made by the HTTP adapter SHALL include an `x-user-id` header carrying the current browser's anonymous UUID, including the `GET /api/leaderboard` call even though its response is public.

#### Scenario: Leaderboard carries header
- **WHEN** `getLeaderboard()` issues its fetch
- **THEN** the request headers include `x-user-id: <valid uuid>`

#### Scenario: All four methods carry header
- **WHEN** any of the four store methods issues a fetch
- **THEN** every request carries the same `x-user-id` header

### Requirement: Module-level singleton
The adapter file SHALL export a module-level `ratingsStore: RatingsStore = new HttpRatingsStore()` singleton. UI components SHALL import `ratingsStore` from this file exclusively and SHALL NOT instantiate `HttpRatingsStore` directly.

#### Scenario: UI imports the singleton
- **WHEN** `src/routes/+page.svelte` or `src/routes/rate/+page.svelte` is inspected
- **THEN** it imports `ratingsStore` from `$lib/stores/http-ratings-store` (not from `votes-store` or `local-storage-*-store`)

### Requirement: Errors on non-2xx
Each HTTP adapter method SHALL throw an `Error` whose message includes the HTTP status code and the response body text whenever the underlying `fetch` returns a non-2xx response. The adapter SHALL NOT swallow errors or return stale data on failure.

#### Scenario: 503 response
- **WHEN** `rate("abc-r", 7)` is called and the server returns `503`
- **THEN** the method rejects with an `Error` whose message contains `503`

#### Scenario: 400 validation error
- **WHEN** `rate("abc-r", 11)` is called and the server returns `400`
- **THEN** the method rejects with an `Error` whose message contains `400`
