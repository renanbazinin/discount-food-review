## ADDED Requirements

### Requirement: Scrape script SHALL support a non-destructive append mode

The `scripts/scrape.ts` CLI SHALL accept an `--append` flag. When the flag is passed, the script SHALL load the existing `data/restaurants.json`, fetch fresh menus for every restaurant listed in `data/restaurants.config.json`, apply the same main-course filtering rules used by the default full-rebuild mode, and write back a merged catalog that contains every existing dish unchanged plus any newly-seen dishes appended at the end of their restaurant's `dishes` array.

#### Scenario: Flag is absent — default full rebuild behavior
- **WHEN** the user runs `npm run scrape` with no `--append` flag
- **THEN** the script overwrites `data/restaurants.json` with a freshly-built catalog containing only what the current fetch returned, matching the behavior that exists before this change

#### Scenario: Flag is present and 10bis has added new main courses
- **WHEN** the user runs `npm run scrape -- --append` and at least one restaurant's live menu contains a dish whose numeric `dishId` is not present in the existing `data/restaurants.json` for that restaurant, and that dish passes the main-course filters
- **THEN** the script appends the new dish object to the end of that restaurant's `dishes` array, downloads its image to `data/images/<dishId>.<ext>`, and leaves every pre-existing dish object byte-identical

#### Scenario: Flag is present and a live dish already exists in the catalog
- **WHEN** the user runs `npm run scrape -- --append` and a fetched dish's `dishId` already appears in `data/restaurants.json` under the same restaurant
- **THEN** the script SHALL skip that dish entirely, MUST NOT overwrite any of its fields (name, description, price, image, imageUrl, category, popularity, isPopular, orderMethod), and MUST NOT re-download its image

#### Scenario: Flag is present and a previously-catalogued dish has been delisted upstream
- **WHEN** the user runs `npm run scrape -- --append` and a dish that exists in `data/restaurants.json` is no longer returned by the live 10bis menu
- **THEN** the script SHALL leave that dish untouched in the merged output — append mode MUST NOT remove any existing entry

#### Scenario: GTG and טלבנק categories are excluded in both modes
- **WHEN** the scrape runs (append or full-rebuild) and 10bis returns a category whose name contains `GTG` (case-insensitive) or `טלבנק`
- **THEN** the script SHALL skip the entire category — no dishes from it are added to the catalog — and the skip SHALL also apply at the dish level if a `טלבנק`-marked dish appears under a different category

#### Scenario: Flag is present and 10bis returns a sides/drinks/extras item
- **WHEN** the user runs `npm run scrape -- --append` and a new dish id belongs to a category or dish-name pattern that the existing filters (`isSkippedCategory`, `isGenericCategory` + `isSkippedDish`) exclude from the full-rebuild mode
- **THEN** the script SHALL apply the same exclusion in append mode so that only main courses are appended

### Requirement: Append mode SHALL preserve rating-id stability

Append mode MUST guarantee that every `dishId` referenced by existing MongoDB `ratings` documents still resolves to a catalog entry after the run. The script SHALL NOT rename, re-key, delete, or reorder any existing dish entry while in append mode.

#### Scenario: Existing dish ids remain resolvable
- **WHEN** append mode completes successfully
- **THEN** for every dish `id` present in `data/restaurants.json` before the run, an entry with the same `id` SHALL still be present after the run under the same restaurant, with identical field values
