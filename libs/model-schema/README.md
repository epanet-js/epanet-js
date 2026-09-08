# @epanet-js/model-schema

The rules a model value has to satisfy — type, finiteness, nullability, enum
membership — expressed once, keyed by the name the **model** uses.

It is a **no-build source package** — the `.ts` is consumed directly by the
importing app's bundler (the same convention as the other `@epanet-js/*`
workspace libraries). Its only dependency is `zod`, plus the entity list from
[`@epanet-js/change-set`](../change-set/AGENTS.md).

## Why it exists

The same rule used to be written twice and checked once.

- The enum tuples (`pipeStatuses`, `valveKinds`, `tankMixingModels`, …) were
  byte-identical copies in `@epanet-js/hydraulic-model` and `@epanet-js/ejsdb`.
- A change set was validated **nowhere**. The flatbuffer format is
  self-describing rather than field-typed, so a string in a number field
  round-trips as a string; the only type check on the path was the Zod row parse
  in the DB worker, which runs after the model has already been mutated and
  never sees a scenario's stored delta at all.

Row schemas could not be reused for that check: they are keyed by *column* and
run on *post-transform* values (`isActive` is a boolean cell but a `0|1` column;
`coordinates` is one cell but two columns). What both sides genuinely share is
the rule underneath — so that is what lives here.

## What you can do with it

- **`enums.ts`** — the enum tuples, importing nothing. `hydraulic-model`
  re-exports them, `ejsdb` builds its `z.enum`s from them.
- **`cells.ts`** — the atoms (`numberCell`, `nullableNumber`, `intCell`,
  `textCell`, `flagCell`, `positionCell`, `pathCell`, …). `ejsdb`'s row schemas
  compose these, so a number is finite on both sides.
- **`controls.ts`, `pipe-library.ts`, `raw-controls.ts`,
  `custom-attributes.ts`** — the value schemas for the four things persisted as a
  single JSON column. They describe a model value and know nothing about a row,
  which is why they live here; `@epanet-js/ejsdb` re-exports them so its schema
  surface is unchanged, and `@epanet-js/ejsdb-mappers` reads them through it.
- **`fields.ts`** — `fieldSchemas`, one entry per entity kind, and
  `schemaForField(entity, field)` which also resolves `custom-<id>` attributes by
  prefix. `fieldSchemas` is a `Record<EntityKind, …>`, so a new entity kind is a
  **type error** until it is given a table.

## The three states

A change-set cell has three states, and a validator has to honour all of them
(see [`@epanet-js/change-set`](../change-set/AGENTS.md)):

- **Absent** (`undefined`) — always allowed, never checked. It means "untouched",
  or "this property is not on this entity".
- **Null** — allowed only where the schema says `.nullable()`, mirroring
  `number | null` in the domain type.
- **Present** — must parse.

So `diameter: number | null` is `numberCell.nullable()` and `minorLoss?: number`
is `numberCell`, with the absent case handled by the caller's skip rather than by
`.optional()`.

## Whole values

Six entities have no fields of their own: the whole value rides in one `$value`
cell. Three take the DB's own schema unchanged, because the cell is exactly what
the column stores — `allControls` is `controlsSchema`, `pipeLibrary` is
`pipeLibrarySchema`, `rawControls` is `rawControlsSchema`.

The other three are transformed on the way to a row, so the cell needs its own
shape built from the same parts:

- **`junctionDemand` / `customerDemand`** — the cell is the model's
  `{ baseDemand, patternId? }[]`. The DB turns it into one row per demand with an
  owner column and an ordinal, so the row schema describes something that does
  not exist yet at this point.
- **`customAttributesDefinition`** — the cell is flat, keyed `<assetType>/<id>`,
  because a `Map` cannot ride in a whole value. The DB regroups it by asset type
  before parsing. The attribute shape itself is shared.

What still has no schema here is what the database alone guards: its `NOT NULL`
and `CHECK` constraints, and the columns a cell is fanned out into.
