# ejsdb

`@epanet-js/ejsdb` is the persistence layer for epanet-js projects. It stores a
hydraulic model in an in-memory SQLite database (via
[`@sqlite.org/sqlite-wasm`](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm))
and serializes it to a single file for save/load. A project file is just the
SQLite database serialized to bytes.

The database runs inside a Web Worker so that queries and (de)serialization never
block the UI thread. The worker is reached through
[Comlink](https://www.npmjs.com/package/comlink), so the consuming app calls the
worker API as if it were a set of local async functions.

## What it does

- **Owns the on-disk file format.** Tables, columns, and the JSON blobs stored in
  string columns define how a saved `.ejs` project is laid out on disk.
- **Migrates old files forward.** On open it reads `PRAGMA user_version`, runs any
  pending migrations from `src/migrations/`, and reports whether the file was
  already current, migrated, too new for this app version, or corrupt.
- **Validates row shapes.** Zod schemas in `src/schema/` parse every row read from
  and written to the database, acting as a runtime safety net against format drift.

## Architecture

```
consumer app
   │  Comlink (typed RPC)
   ▼
Web Worker  ── worker.ts ── worker-api.ts  (the DbWorkerApi: open/save/query/export)
   │
   ▼
SQLite (WASM, in-memory)  ◀── migrations/ apply on open ──▶ exportDb() → bytes (the project file)
```

Key pieces:

- `src/index.ts` — public entry point; re-exports the API, worker accessor,
  schemas, and `APP_VERSION`.
- `src/worker-api.ts` — the `DbWorkerApi` implementation: `newDb`, `openDb`,
  `exportDb`, per-table getters (`getJunctions`, `getPipes`, …), bulk setters
  (`setAllAssets`, …), and `applyChangeSet` for incremental edits.
- `src/get-worker.ts` — lazily spawns the worker and wraps it with Comlink.
  Provides test hooks (`setWorkerForTest`, `resetWorkerForTest`).
- `src/migrations/` — sequential, forward-only `NNNN_*.sql` files plus an `index.ts`
  array. `APP_VERSION` is derived from the number of migrations.
- `src/schema/` — Zod row schemas per table and `enums.ts`, the wire-format
  vocabulary for enum-typed columns.

## Usage

```ts
import { getWorker } from "@epanet-js/ejsdb";

const db = getWorker();

// New project
await db.newDb();

// Open a saved project file
const result = await db.openDb(fileBytes); // { status: "ok" | "migrated" | "too-new" | "corrupt" | ... }

// Read the model
const pipes = await db.getPipes();

// Persist back to a file
const bytes = await db.exportDb();
```

## Scripts

```sh
pnpm test          # vitest
pnpm lint          # eslint
pnpm check-types   # tsc --noEmit
```

## ⚠️ Changing the file format

This library owns a format that every previously-saved project file depends on.
Any change to a table, column, Zod row schema, or persisted JSON blob shape is a
**file-format change** and requires a migration. Read
[`AGENTS.md`](./AGENTS.md) before making any change here.
