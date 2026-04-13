## ADDED Requirements

### Requirement: Configurable restaurant list
The scraper SHALL read the list of 10bis restaurants to fetch from a single configuration file at `data/restaurants.config.json`, containing an array of `{id: number, name: string}` entries.

#### Scenario: Adding a new restaurant
- **WHEN** the user appends a new `{id, name}` entry to `data/restaurants.config.json` and runs the scraper
- **THEN** the scraper fetches that restaurant's menu and includes its main courses in the regenerated `data/restaurants.json` without requiring any code change

#### Scenario: Missing config file
- **WHEN** the scraper runs and `data/restaurants.config.json` does not exist
- **THEN** the scraper exits with a non-zero code and a message telling the user to create the file

### Requirement: 10bis menu fetch via NextApi
The scraper SHALL fetch each restaurant's menu from `https://www.10bis.co.il/NextApi/getRestaurantMenu?restaurantId={id}` with a standard browser user-agent header and parse the JSON response.

#### Scenario: Successful fetch
- **WHEN** the scraper requests a valid restaurant id
- **THEN** it receives HTTP 200 with a JSON body whose `Data.categoriesList` contains the restaurant's categories and dishes

#### Scenario: Non-2xx response for a restaurant
- **WHEN** the scraper receives a non-2xx response or a malformed JSON body for a single restaurant
- **THEN** it logs the failure, skips that restaurant, and continues processing the remaining restaurants without aborting the whole run

### Requirement: Category-level main-course classifier
The scraper SHALL classify categories via a Hebrew keyword allowlist: categories whose names match any skip pattern (e.g. `פופולרי`, `תוספות`, `שתייה`, `משקאות`, `קינוחים`, `רטבים`, `ממרחים`, `מרקים`, `ילדים`, `ראשונות`) SHALL be fully excluded from the output.

#### Scenario: Drinks category is skipped
- **WHEN** a restaurant has a category named `שתייה` containing 9 dishes
- **THEN** none of those 9 dishes appear in the output for that restaurant

#### Scenario: Popular dishes are deduplicated
- **WHEN** a restaurant has a `מנות פופולריות` category whose entries duplicate dishes from other categories
- **THEN** the `מנות פופולריות` category is skipped entirely and the duplicated dishes appear exactly once in the output (from their original category)

### Requirement: Dish-level filter in generic-container categories
The scraper SHALL treat categories whose names match any generic-container pattern (e.g. `תפריט`, `Take Away`, `טלבנק`, `Grab&Go`) as generic containers and SHALL apply a dish-name filter to remove drinks, sides, and desserts from their dish lists while keeping the remaining main-course dishes.

#### Scenario: Drinks dropped from a generic takeaway category
- **WHEN** a `תפריט טלבנק בלבד` category contains both `פאד קפאו בקר טלבנק` and `פחית קולה`
- **THEN** `פאד קפאו בקר טלבנק` is kept and `פחית קולה` is dropped

#### Scenario: Sides dropped from a diner meals category
- **WHEN** a generic-container category contains `צ'יפס` or `טבעות בצל`
- **THEN** those dish entries are dropped from the output

### Requirement: Cross-category dedup by dish id
The scraper SHALL dedupe dishes by their `dishId`, keeping the first occurrence encountered while iterating categories in order.

#### Scenario: Dish appears in two categories
- **WHEN** the same `dishId` appears in both a "Popular" category and a "Takeaway" category
- **THEN** the dish appears exactly once in the output for that restaurant

### Requirement: טלבנק twin-splitting
The scraper SHALL, for every dish whose name contains the substring `טלבנק`, emit two entries in the output: one preserving the original name and marked `orderMethod: "telbank"` with id `{dishId}-t`, and one with the טלבנק marker stripped and marked `orderMethod: "regular"` with id `{dishId}-r`. Both entries SHALL share the same `dishId` as their `rootId`.

#### Scenario: Telbank dish is split
- **WHEN** the scraper processes a dish named `סטייק טונה ✡️ "טלבנק"` with dishId 12345
- **THEN** the output contains an entry `{id: "12345-t", name: "סטייק טונה ✡️ \"טלבנק\"", orderMethod: "telbank", rootId: "12345"}` and an entry `{id: "12345-r", name: "סטייק טונה ✡️", orderMethod: "regular", rootId: "12345"}`

#### Scenario: Non-telbank dish is not split
- **WHEN** the scraper processes a dish whose name does not contain `טלבנק`
- **THEN** the output contains exactly one entry for it with `orderMethod: "regular"` and `id == rootId == dishId`

### Requirement: Image download
The scraper SHALL download every dish's `dishImageUrl` to `data/images/{dishId}.{ext}` (where `ext` is inferred from the URL, defaulting to `.jpg`) and SHALL record the relative path on the dish entry as `image`. Dishes without a `dishImageUrl` SHALL have `image: null`.

#### Scenario: Image present
- **WHEN** a dish has `dishImageUrl` pointing to a JPG
- **THEN** the file is saved at `data/images/{dishId}.jpg` and the dish entry's `image` field is `"images/{dishId}.jpg"`

#### Scenario: Image missing
- **WHEN** a dish has a null or empty `dishImageUrl`
- **THEN** no file is written and the dish entry's `image` field is `null`

#### Scenario: Image download fails
- **WHEN** a single image fetch times out or returns a non-2xx response
- **THEN** the scraper logs the failure, sets `image: null` for that dish, and continues without aborting the run

### Requirement: Output dataset shape
The scraper SHALL write a single `data/restaurants.json` file with the shape `{ restaurants: [ { id, name, dishes: [ { id, rootId, name, description, price, image, imageUrl, category, popularity, isPopular, orderMethod } ] } ] }`.

#### Scenario: Regenerating the dataset
- **WHEN** the scraper runs successfully against a 5-restaurant config
- **THEN** `data/restaurants.json` is overwritten with the shape above and contains exactly the dishes that passed the classifier, and the file parses as valid UTF-8 JSON

### Requirement: Run report
The scraper SHALL print a per-restaurant report showing, for each category, whether it was skipped or kept and how many dishes were kept out of the total, so the user can spot classifier drift on new restaurants.

#### Scenario: Eyeballing a new restaurant
- **WHEN** a newly-added restaurant has a category whose name doesn't match any allowlist pattern
- **THEN** the run report shows that category with its kept/total counts, letting the user decide whether to update the allowlists
