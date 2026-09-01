# ejsdb module — read this before changing anything

> # ⚠️ DANGER ⚠️
>
> **This directory owns the on-disk file format.**
>
> User projects are saved as SQLite blobs (`exportDb` → file). Every saved
> file in the wild MUST keep opening forever. A "small" change to a table,
> column, Zod row schema, or JSON-blob shape — without a paired SQL
> migration — silently corrupts every existing project file.
>
> **If you are an AI agent and you are about to make a change that matches
> the list below, STOP. Tell the user, prominently, with the word DANGER,
> that this is a file-format change. Do not bury it in a longer message.
> Do not proceed until the user has acknowledged the file-format
> implication and explicitly asked for it.**

## Changes that REQUIRE a migration

Any of these breaks file compatibility unless a migration ships with it:

- Editing `src/migrations/0001_initial.sql` or any other shipped `NNNN_*.sql` file
- Adding, removing, renaming, or retyping a column in any table
- Adding or removing a table
- Changing constraints, indexes, or `PRAGMA user_version` semantics
- Editing bulk-insert column lists in `src/worker-api.ts` (they must match the table schema exactly)
- Editing row-shape Zod schemas in `src/schema/*.ts` (they must match the columns)
- Changing the shape of any JSON blob persisted as a string column. Today these are:
  - `raw_controls.data` (raw controls JSON)
  - `controls.data` (controls JSON)
  - `simulation_settings.data`
  - `project.settings`
  - `project.pipe_library`
  - `pumps.curve_points`
  - `patterns.multipliers`
  - `curves.points`
  - `pipes.coords`, `pumps.coords`, `valves.coords`

If your change is in the list, it is a file-format change. Migration required.

## Changes that do NOT require a migration

These are safe — they don't touch the format:

- Refactors that preserve the column set and row shape
- Reorganizing files in the consuming `src/lib/db/mappers/` while keeping their outputs identical
- New commands in `src/lib/db/commands/` that read/write existing tables in their established shape
- Adding or restructuring tests
- Performance tweaks (chunk sizes, prepared-statement caches, query rewrites that return the same data)

When in doubt, ask. Do not assume.

## Migration procedure

1. Add a new SQL file `src/migrations/NNNN_short_description.sql` (next sequential number, zero-padded to 4)
2. Append it to the `migrations` array in `src/migrations/index.ts` — `APP_VERSION` derives from `migrations.length`, so order matters
3. Update the matching Zod schema in `src/schema/*.ts`
4. Update consuming mapping code in `src/lib/db/mappers/**` and any column lists in `src/worker-api.ts`
5. **Verify the migrated-open path works**: open a saved file produced by the previous version; `openDb` should return `status: "migrated"` and `fetchProject` should return a coherent model. Add or extend an integration test (see `src/lib/db/commands/open.integration.test.ts` for the round-trip template) to lock this in
6. Migrations are forward-only and immutable once shipped. Never edit a previously-shipped `NNNN_*.sql` file. If a shipped migration is wrong, write the next-numbered one to fix it

## Why this is here

The migration runner lives in `src/worker-api.ts:openDb` — it reads `PRAGMA user_version`, runs anything in `src/migrations/` past that point, and reports `status: "migrated"`. The mechanism is in place; what's missing is a loud, agent-facing reminder that this directory is not like the rest of the codebase. Routine refactor instincts will silently break user data here.

## Enums in `src/schema/enums.ts` are wire-format vocabulary, not domain types

The literal tuples in `src/schema/enums.ts` (e.g. `pipeStatuses`, `pumpDefinitionTypes`) define **what these columns can contain on disk**. They are intentionally independent of the parallel domain enums in `src/hydraulic-model/asset-types/*`. Neither side imports from the other; the consumer app's mapper in `src/lib/db/mappers/` is the only place that bridges them.

Today the two sides happen to share value names by convention, so the mapper's cast (`row.initial_status as PipeStatus`) compiles trivially. The day they diverge, that cast errors and the mapper writes a real translation.

### Pattern for widening either side

When a column's allowed values need to change, follow the two-step pattern from commits `90e9c58e` + `881b66a1` (pump `definition_type` migration). Format moves first, alone; domain catches up later:

1. **Format-side commit.** Add the new value(s) to `src/schema/enums.ts`. Write the SQL migration. Update the Zod schema (still references `src/schema/enums.ts`). In `src/lib/db/mappers/`, add a bridge function that maps the new format value(s) to the still-unchanged domain enum. Production is stable here.
2. **Domain-side commit.** Widen the domain enum in `src/hydraulic-model/asset-types/*`. Delete the mapper bridge — the cast is identity again.

The Zod schema rejecting unknown values at save time is the runtime safety net for any accidental drift between the two sides.
