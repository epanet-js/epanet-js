# session module — ejsdb's second database

`ejsdb` owns **two** SQLite databases, with opposite contracts. Know which one you are editing.

| | `main.sqlite3` | `session.sqlite3` (this directory) |
|---|---|---|
| Contract | the on-disk project file format — see [`../AGENTS.md`](../AGENTS.md) | disposable; no format to preserve |
| Migrations | forward-only, immutable once shipped | edit and renumber freely; recreate on any surprise |
| Reaches a saved `.ejs` | yes, it *is* the file | never |
| Holds | user data | undo/redo changesets for the current session |

It lives beside the project db in the same OPFS sahpool and is `ATTACH`ed to the project connection
as schema `sess`.

## Why it belongs to ejsdb rather than a package of its own

Not merely convenience. A changeset stores a table name, a column count, and values by ordinal —
**no column names** — so its bytes are uninterpretable except against one specific version of
`main`'s schema. The data is a diff of this package's own tables, and `session_meta.app_version` (a
fact about `../migrations`) is what keeps that honest. Splitting the blob from the only schema that
can read it would be a seam through the middle of one thing.

Three mechanics follow from the same place: `sqlite3session_create(db, "main", …)` needs the project
connection's own handle; a multi-megabyte changeset must not cross a worker boundary on every edit;
and writing the history row inside `applyMoment`'s transaction is what makes "a history row exists
iff the write committed" structural rather than reconciled.

**The extraction trigger**, should it ever arrive: something session-scoped that is *not* a
projection of `main`'s schema — UI state, drafts, anything the app would read directly. That has no
business next to `history`, and it is the signal to give it its own store rather than a table here.
Do not let `session_meta` become a dumping ground; it exists to describe this database, not to host
unrelated state.

## Lifecycle

- **Destroyed on every whole-db swap** — `newDb`, `openDb`, `importProject` — and reclaimed with the
  pool directory when a tab's session lock dies.
- **Never exported.** `exportDb()` calls `sqlite3_js_db_export(db.pointer)` with no schema argument,
  so it exports `main` only.
- **On any version surprise, drop and recreate.** `ensureSessionDb` rebuilds from scratch when
  `sess.user_version` is not `SESSION_VERSION`, or when `session_meta.app_version` no longer matches
  `APP_VERSION`.

The `app_version` check is not decoration: after a project migration an old changeset applies as a
silent no-op, or reintroduces pre-migration values. Wiping is the enforcement.

## The file must be created by `importDb`, never by `ATTACH`

The sahpool VFS stores each file's open-flags in its header, and on every pool install
`getAssociatedPath` **silently discards** any file whose flags do not intersect
`PERSISTENT_FILE_TYPES` (`SQLITE_OPEN_MAIN_DB | MAIN_JOURNAL | SUPER_JOURNAL | WAL`). A database
created by `ATTACH` does not qualify, so it survives inside its own tab and then vanishes the moment
another context installs that pool — which is exactly what session recovery does. The symptom is
`File not found: /session.sqlite3` and a `Removing file with unexpected flags` console warning.

So `initSessionDb()` seeds the file with `poolUtil.importDb(SESSION_DB_PATH, …)` — the only API that
stamps `SQLITE_OPEN_MAIN_DB` — using a valid empty database, and `ATTACH` then opens the existing
file. `xOpen` only writes the header when it *creates* a file, so the persistent flags stay put.

The same rule is why `ensureSessionDb` rebuilds **in place** (`dropAllObjects` + `build`) instead of
unlinking and re-attaching: deleting the file would send the next `ATTACH` back down the
non-persistent path.

## `removeVfs()` deletes the pool directory — use `pauseVfs()`

Despite the name, `SAHPoolUtil.removeVfs()` does not merely unregister the VFS: it calls
`removeEntry(vfsRootDir, { recursive: true })` and **destroys the pool's data**. Any code that
temporarily installs another tab's pool — `exportDbFromPool`, `restoreSessionFromPool` — must finish
with `pauseVfs()` instead, which unregisters and releases the access handles while leaving the files
alone. `unpauseVfs()` reacquires them; the pool object is cached by VFS name, so a second install in
the same session returns the paused instance rather than a fresh one.

Reclaiming a dead tab's directory belongs to `cleanupStaleDbPools`, which knows which pools are still
offered for recovery. A `removeVfs()` in a read path silently takes that decision away, and the
symptom is a later read of the same pool reporting it as empty.

## Every DDL statement must be schema-qualified

Migrations run through the `sess.` alias on the project connection, so an unqualified
`CREATE TABLE` lands **in the project file**. That failure is silent and permanent.

`session-db.integration.test.ts` asserts `main`'s `sqlite_master` is unchanged after session
migration and after a capture. That test is the enforcement — keep it passing, and qualify every
`CREATE`/`DROP`/`ALTER` you add.

DML uses `db.exec` with binds, never the `stmtCache` in `../worker-api.ts`: a cached statement
referencing `sess.` would outlive a detach.

## Initialization is explicit, and failure is swallowed

The session db is created where the project db is: `initSessionDb()` runs inside `createNewDb`,
`openDb` and the non-`newDb` branch of `importProject`. It attaches, runs the ladder and seeds
`session_meta` in one place, so a write never has to consider migrations. Whether it runs at all
comes from a single switch — `configure({ sessionHistory })` — set by the app from the feature flag.
Do not add a second switch on the write path; the argument `applyMoment` takes describes *what kind
of write this is*, not whether the feature is on.

**Both init and capture failures are caught, not thrown.** They disable capture for the rest of the
process and are recorded on `sessionHistoryFailure()`, which the app reports as a warning after
every project load and includes in `storageDiagnostics()`. This is deliberate: a debug-flagged side
channel must never cost the caller its project write, and a capture that threw mid-transaction would
roll the user's edit back. `private/feature-flags.md` records when that stops being true.

## Capture is opt-in per transaction

`withTransaction` takes a capture argument. The session object must be created inside the same
synchronous block as `BEGIN IMMEDIATE … COMMIT` — a session created before an `await` could span
another queued call's transaction.

`sqlite3session_create(db, "main", …)` does not see writes to an attached database, so the history
INSERT cannot record itself and no table filter is needed.
