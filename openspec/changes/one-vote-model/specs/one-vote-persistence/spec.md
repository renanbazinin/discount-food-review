## ADDED Requirements

### Requirement: Server-only MongoDB connection module
The system SHALL expose a server-only module at `src/lib/server/db.ts` that owns the MongoDB connection lifecycle. The module SHALL NOT be importable from any client file; SvelteKit's bundler enforces this for paths under `src/lib/server/`.

#### Scenario: Server route imports the module
- **WHEN** a `+server.ts` route handler imports from `$lib/server/db`
- **THEN** the import resolves at build time and the module runs server-side at request time

#### Scenario: Client component attempts to import
- **WHEN** any file under `src/routes/+page.svelte` or `src/lib/ui/` attempts to import from `$lib/server/db`
- **THEN** the SvelteKit build fails with an error stating that server-only modules cannot be imported from client code

### Requirement: Lazy singleton MongoClient
The DB module SHALL construct exactly one `MongoClient` per server process, lazily on the first call to its public accessor, and SHALL cache the client at module scope for the lifetime of the process.

#### Scenario: First call initializes the client
- **WHEN** the first call to `getCollections()` occurs after process start
- **THEN** a new `MongoClient` is created from `MONGODB_URI`, `client.connect()` is awaited, indexes are ensured, and the client is cached

#### Scenario: Subsequent calls reuse the cached client
- **WHEN** subsequent calls to `getCollections()` occur in the same process
- **THEN** the cached collections are returned without constructing a new client and without calling `connect()` again

### Requirement: Connection URI from server-only env
The connection URI SHALL be read from `MONGODB_URI` via `$env/static/private`. The URI SHALL NOT be hardcoded in source, SHALL NOT be exposed via `$env/static/public` or `$env/dynamic/public`, and SHALL NOT appear in any client bundle.

#### Scenario: Build with URI present
- **WHEN** `MONGODB_URI` is set in the environment at build time
- **THEN** the build succeeds and the value is inlined into the server bundle only

#### Scenario: Build with URI missing
- **WHEN** `MONGODB_URI` is not set at build time
- **THEN** the build fails with a clear error message naming the missing variable

#### Scenario: Client bundle does not contain URI
- **WHEN** the production client bundle under `build/client/` is searched
- **THEN** the literal value of `MONGODB_URI` does not appear in any client-side file

### Requirement: Database and collection
The DB module SHALL use a database named `food-ranking` and SHALL expose a single `votes` collection.

#### Scenario: First connection
- **WHEN** the singleton initializes for the first time
- **THEN** `client.db('food-ranking')` is selected and a typed `votes` collection accessor is returned

### Requirement: Vote document shape
Documents in the `votes` collection SHALL have the shape `{ _id: ObjectId, voteId: string, dishId: string, timestamp: number }`. The collection SHALL NOT store any user id, IP, or device fingerprint — every document is literally anonymous.

#### Scenario: Inspect a vote document
- **WHEN** any vote document in the collection is inspected
- **THEN** it contains only the four fields above — no `userId`, no `ip`, no `fingerprint`, no `session`, no other identifying data

### Requirement: Indexes ensured on first connect
On first connect, the DB module SHALL create the following indexes via idempotent `createIndex` calls before returning to callers:

- `votes`: non-unique index on `{ dishId: 1 }`
- `votes`: unique index on `{ voteId: 1 }`

#### Scenario: Indexes do not exist
- **WHEN** the singleton initializes against a fresh database
- **THEN** both indexes are created before `getCollections()` resolves

#### Scenario: Indexes already exist
- **WHEN** the singleton initializes against a database where both indexes are already present
- **THEN** `createIndex` is still called, the calls are no-ops, and `getCollections()` resolves normally

### Requirement: No per-request connection churn
Connection setup work SHALL run at most once per server process. Per-request handlers SHALL NOT construct new clients, call `connect`, or call `createIndex`.

#### Scenario: 100 sequential requests
- **WHEN** 100 sequential `GET /api/leaderboard` requests hit the same server process
- **THEN** exactly one `MongoClient` instance is constructed and exactly one set of `createIndex` calls is made

### Requirement: `.env.example` shipped
The repository SHALL contain an `.env.example` file at the project root with a placeholder value for `MONGODB_URI` and a one-line comment pointing at the Atlas console setup steps. The real `.env` SHALL remain gitignored.

#### Scenario: Example file present
- **WHEN** a developer clones the repo
- **THEN** `.env.example` is present at the project root with the placeholder variable

#### Scenario: Real env file is gitignored
- **WHEN** a developer creates `.env` with a real connection string
- **THEN** `git status` does not list `.env` as a tracked or untracked file
