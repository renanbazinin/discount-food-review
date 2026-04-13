## ADDED Requirements

### Requirement: Record-shaped star storage
The `StarsStore` SHALL persist star ratings as a keyed record from `dishId` to `{ dishId, stars, timestamp }`, storing at most one rating per dish. The store SHALL NOT keep a history of prior ratings.

#### Scenario: Set then get
- **WHEN** `set("123-r", 7)` is called and then `get("123-r")` is called
- **THEN** the second call resolves with `{ dishId: "123-r", stars: 7, timestamp: <a number> }`

#### Scenario: Replace overwrites
- **WHEN** `set("123-r", 7)` is called and then `set("123-r", 4)` is called
- **THEN** `get("123-r")` resolves with `stars: 4` and the earlier rating is not retrievable

### Requirement: Validation of star range
The `set` method SHALL reject non-integer stars and values outside the inclusive range `[1, 10]`.

#### Scenario: Fractional rating rejected
- **WHEN** `set("123-r", 7.5)` is called
- **THEN** the method rejects with an error and the store is unchanged

#### Scenario: Out-of-range rating rejected
- **WHEN** `set("123-r", 11)` or `set("123-r", 0)` is called
- **THEN** the method rejects with an error and the store is unchanged

### Requirement: Async contract for all methods
Every method on `StarsStore` SHALL return a `Promise`, including methods on the LocalStorage adapter, so that the interface matches the eventual MongoDB adapter and no call sites need changes when the backend is swapped.

#### Scenario: LocalStorage adapter is async
- **WHEN** any method on the LocalStorage adapter is called
- **THEN** it returns a `Promise` resolving to the documented result type

### Requirement: List and clear
The `StarsStore` SHALL expose `list()` returning an array of all current ratings, `clear(dishId)` removing a specific dish's rating, and `clearAll()` removing every rating.

#### Scenario: List reflects writes
- **WHEN** three distinct dishes are rated via `set`
- **THEN** `list()` resolves with an array of length 3 containing those three ratings

#### Scenario: Clear removes one
- **WHEN** `clear("123-r")` is called on a rated dish
- **THEN** `get("123-r")` resolves with `null` and `list()` no longer includes that dish

#### Scenario: Clear all
- **WHEN** `clearAll()` is called
- **THEN** `list()` resolves with an empty array

### Requirement: Export and import
The `StarsStore` SHALL expose `export(): Promise<string>` returning a JSON string of the full ratings state, and `import(json: string): Promise<void>` that replaces the current ratings with the parsed state after validating its shape.

#### Scenario: Round-trip
- **WHEN** `export()` is called, then `clearAll()` is called, then `import(exported)` is called with the exported string
- **THEN** a subsequent `list()` resolves with the same ratings that were present before export

#### Scenario: Invalid import payload
- **WHEN** `import()` is called with a JSON string that does not parse or whose entries do not match the rating shape
- **THEN** the method rejects with an error and the existing ratings are unchanged

### Requirement: Independence from ratings store
The `StarsStore` and the pairwise `RatingsStore` SHALL NOT share a backing key, event log, or derived cache. Writes to one SHALL have no effect on the other.

#### Scenario: Star write does not affect pairwise log
- **WHEN** `starsStore.set("123-r", 9)` is called
- **THEN** `ratingsStore.listEvents()` returns the same list it returned before the call

#### Scenario: Pairwise match does not affect stars
- **WHEN** `ratingsStore.recordMatch("a", "b")` is called
- **THEN** `starsStore.list()` returns the same list it returned before the call

### Requirement: UI uses only the interface
The UI and star-rating logic SHALL access star persistence exclusively through the `StarsStore` interface and SHALL NOT reference `window.localStorage`, `IndexedDB`, or any storage primitive directly.

#### Scenario: Swapping adapters
- **WHEN** the app's root wiring replaces the LocalStorage adapter with a different `StarsStore` implementation
- **THEN** no UI component, route, or rating module requires any change to compile or run
