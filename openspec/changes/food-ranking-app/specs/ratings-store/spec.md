## ADDED Requirements

### Requirement: Append-only match event log
The `RatingsStore` SHALL persist ratings exclusively as an append-only sequence of match events, where each event has the shape `{ id: string, winnerId: string, loserId: string, timestamp: number }`. The store SHALL NOT persist derived Elo ratings.

#### Scenario: Recording a match
- **WHEN** `recordMatch(winnerId, loserId)` is called
- **THEN** a new event is appended to the log with a monotonically unique `id`, the provided `winnerId` and `loserId`, and the current timestamp, and the method resolves with that event

#### Scenario: Reading events
- **WHEN** `listEvents()` is called after N matches have been recorded
- **THEN** it resolves with an array of exactly N events in the order they were recorded

### Requirement: Async contract for all methods
Every method on `RatingsStore` SHALL return a `Promise`, including methods on the LocalStorage adapter, so that the interface matches the eventual MongoDB adapter and no call sites need changes when the backend is swapped.

#### Scenario: LocalStorage adapter is async
- **WHEN** any method on the LocalStorage adapter is called
- **THEN** it returns a `Promise` resolving to the documented result type

### Requirement: Undo the last match
The `RatingsStore` SHALL expose `undoLast()` which removes the most recently appended event from the log and resolves with the removed event, or `null` if the log was empty.

#### Scenario: Undo after a match
- **WHEN** `undoLast()` is called after one match has been recorded
- **THEN** the event is removed from the log, the method resolves with that event, and a subsequent `listEvents()` resolves with an empty array

#### Scenario: Undo on empty log
- **WHEN** `undoLast()` is called with an empty log
- **THEN** it resolves with `null` and the log is unchanged

### Requirement: Export and import
The `RatingsStore` SHALL expose `export(): Promise<string>` returning a JSON string of the full event array, and `import(json: string): Promise<void>` that replaces the current event log with the parsed array after validating its shape.

#### Scenario: Round-trip
- **WHEN** `export()` is called, then the log is cleared, then `import(exported)` is called with the exported string
- **THEN** a subsequent `listEvents()` resolves with the same events that were present before export

#### Scenario: Invalid import payload
- **WHEN** `import()` is called with a JSON string that does not parse or does not match the event shape
- **THEN** the method rejects with an error and the existing log is unchanged

### Requirement: UI uses only the interface
The UI and ranking logic SHALL access persistence exclusively through the `RatingsStore` interface and SHALL NOT reference `window.localStorage`, `IndexedDB`, or any storage primitive directly.

#### Scenario: Swapping adapters
- **WHEN** the app's root wiring replaces the LocalStorage adapter with a different `RatingsStore` implementation
- **THEN** no UI component, route, or ranking module requires any change to compile or run
