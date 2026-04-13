## ADDED Requirements

### Requirement: Catalog loads from static dataset
The app SHALL load the dish catalog once at startup from the static `data/restaurants.json` file and SHALL NOT fetch restaurant or menu data from any network endpoint at runtime.

#### Scenario: App startup
- **WHEN** the app is opened
- **THEN** it reads `data/restaurants.json` from static assets, parses it, and exposes the dishes and restaurants to the rest of the app

#### Scenario: Offline use
- **WHEN** the app is opened with no network connection after its first load
- **THEN** the catalog is still available and the comparison screen works normally

### Requirement: Root-id derivation
The app SHALL, when loading each dish, compute and cache a `rootId` derived by stripping `-t` or `-r` suffixes from the dish id. Dishes with no such suffix SHALL have `rootId === id`.

#### Scenario: Telbank variant
- **WHEN** a dish is loaded with id `"12345-t"`
- **THEN** its `rootId` is `"12345"`

#### Scenario: Plain dish
- **WHEN** a dish is loaded with id `"67890"`
- **THEN** its `rootId` is `"67890"`

### Requirement: Dish lookup
The catalog SHALL expose a synchronous `getById(id)` lookup that returns the full dish entry or `undefined`.

#### Scenario: Known id
- **WHEN** `getById("12345-t")` is called for a loaded dish
- **THEN** it returns that dish's full record

#### Scenario: Unknown id
- **WHEN** `getById` is called with an id not present in the dataset
- **THEN** it returns `undefined`

### Requirement: Twin detection
The catalog SHALL expose an `areTwins(dishA, dishB)` predicate that returns `true` if and only if the two dishes share the same `rootId`.

#### Scenario: Telbank pair
- **WHEN** `areTwins` is called with dishes `"12345-t"` and `"12345-r"`
- **THEN** it returns `true`

#### Scenario: Unrelated dishes
- **WHEN** `areTwins` is called with dishes from different restaurants
- **THEN** it returns `false`

### Requirement: All-dishes iteration
The catalog SHALL expose an `allDishes()` accessor that returns the flat list of every dish across every restaurant, in a stable order suitable for indexing into arrays.

#### Scenario: Flat iteration
- **WHEN** `allDishes()` is called after loading a 5-restaurant dataset containing 79 dishes
- **THEN** it returns an array of length 79
