# change-sets — the app side of the change format

The format lives in
[`@epanet-js/change-set`](../../../../../libs/change-set/AGENTS.md). This
directory connects it to the model: the **builder** (`changeSet()` + intents)
that reads a `HydraulicModel` to fill in `before`, and the **applier**
(`applyChangeSet`) that writes a change set into one. Both need the asset
classes, which is why they are here and not in the package. Nothing here maps
rows — the DB worker turns records into rows (`@epanet-js/ejsdb`), without
consulting the model.

**Nothing reads the model during apply.** A change set is complete before
anything mutates; that is what makes it undoable, persistable and squashable.

## Records are validated as they are built

`changeSet()` runs `validateRecords` against
[`@epanet-js/model-schema`](../../../../../libs/model-schema/README.md) before
`ChangeSet.of` encodes anything. It is the only check: the format is
self-describing rather than field-typed, the DB worker writes rows without
re-checking, and a scenario stores its delta unchecked. Rejecting at build time
leaves the model untouched — the validate-then-save shape from
[`guidelines/persistence.md`](../../../guidelines/persistence.md).

**Absent** is never checked (untouched, or not on this entity). **Null** is
allowed only where the field schema is `.nullable()`. **Present** must parse. A
field with no schema throws, so a new persisted property is a failing test rather
than a value that silently never reaches the file.

A **whole value** is the one cell whose parsed result is kept: it is stored as a
single JSON column, so keeping the parse is what strips undeclared keys and fixes
key order.

## Every intent reads the same unmutated model

Operations compose (`moveNode` uses `splitPipe`), and every intent resolves
against the same snapshot, so each `before` is the original value and intent
order only decides which `after` wins. Resolving mid-way and reading the model
again breaks this, and undo restores an intermediate value.

## Intent order inside an operation is load-bearing

`ChangeSet.of` merges records per entity — first `before`, last `after` — so the
order an operation lists its intents in decides the outcome, and it is
**asymmetric**:

- **Assets: never `dropAssets` and `putAssets` the same id.** Nothing checks,
  and it corrupts silently: the put reads the unmutated model so it is a
  diff-only `update`; merged with the drop's full `before`, every field the diff
  omits decodes as removed. An operation that keeps an asset's identity puts it
  and never drops it.
- **Customer points: put before drop.** An id in both must end up *deleted*;
  putting first folds update-then-delete into a `delete`.
- **`setAsset` / `setCustomerPoint` after puts**, so the set's `after` wins while
  the merge keeps the put's `before`.

## Direction is the whole of undo

There is no reverse change set. `applyChangeSet(model, cs, "reverse")` reads
`before` instead of `after` and swaps create with delete. If you find yourself
computing an inverse, something has gone wrong.

Apply order is fixed by `CREATE_RANK` in `apply.ts`, not stored: creates run
outermost-first so a link never exists without its nodes, deletes run in the
mirror order. A new entity kind is a type error until it has a rank — place it
deliberately; a create that lands before what it points at has no other guard.

## The applier's contract

`applyChangeSet` mutates **the model and the label manager, and nothing else.**
It does not touch the id generator, re-sort assets, or set `version`; those
belong to `applyChange` in `src/lib/persistence/transaction-helpers.ts`.

- **Build assets with the constructor, never `AssetFactory`.** The factory would
  mint an id, register a label on the shared `LabelManager`, and coerce
  `undefined → null` — all wrong when reconstructing a value that already
  existed.
- **Keep the applier ignorant of the id generator.** Applying a `create` supplies
  an explicit id, so `idGenerator.totalGenerated` (which `AssetIndex.maxAssetId`
  reads) does not advance. That is harmless for ids an operation minted; replaying
  a *stored* delta into a fresh model is the id-pools work's problem and cannot be
  fixed in here.
- **Rebuild, don't alias.** The applier rebuilds an asset from the field bag
  rather than storing the caller's object. The rebuild is what makes the map and
  panels re-render, and it keeps the undo stack from aliasing live objects.
- **De-register the old label whenever `label` changes**, for nodes as well as
  links; limiting it to links leaks a renamed node's old registration.
- **A restored asset keeps its `at`.** `at` is the fractional ordering key
  `sortAssets` reads, and it lives on the asset rather than in
  `feature.properties`, so `assetToFields` / `buildAssetFromFields` name it
  explicitly. Drop it and a rebuilt asset gets the `"any"` default and sorts by
  id — undoing a delete would no longer return it to its row.
  `use-undoable-transactions.test.tsx` pins it.

## Field bags

- **`diffFields` walks the union of both sides**, not just `next`. A put carries
  a whole asset, so a field the replacement no longer has must be recorded as
  removed (`after[field] = undefined` → `Presence.Absent`), or the model silently
  keeps a value the operation dropped.
- A key **missing** from a bag means untouched; a key **present with
  `undefined`** means the property is not on the entity.
- Customer points need a hand-written mapping: `listProperties()` returns only
  `label`, so `coordinates` and `connection` are named explicitly. The connection
  travels whole — nothing else could reconstruct the snap point.
- An owner with no demands reads as `[]`, not absent.

## Controls and the custom-attributes definition travel whole

Curves and patterns are diffed per entity by `diffKeyed`. Controls and the
custom-attributes definition are not, because each is persisted as a single
JSON column (`controls.data`, `project.custom_attributes_definition`): rewriting
one needs every member. They travel as one whole-collection record each
(`allControls`, `customAttributesDefinition`), like `pipeLibrary` and
`rawControls`. Give either real rows and per-entity records come back — which is
why `stringKeyed` and the `keys` vector survive unused in `@epanet-js/change-set`.

A `Map` in a whole-value cell `JSON.stringify`s to `{}` and loses everything,
silently. The custom-attributes definition is nested `Map`s, so
`customAttributesToPlain` / `customAttributesFromPlain` flatten it. Nothing else
may put a `Map` in a whole value.

## `operations.test.ts` covers the format, not the operations

It is organised by **what this directory supports** — every entity kind and
every intent — using the cheapest operation that reaches each one, and asserts
forward effect and reverse round-trip. The structural operations (`splitPipe`,
`mergeNodes`, `replaceNode`, `replaceLink`, `addLink`, `moveNode`,
`applyCustomerPointAllocation`) have no case here: they reach the same intents,
and their own contracts are proved in their own tests.

Testing traps:

- `src/__helpers__/model-snapshot.ts` maps `undefined` to a sentinel, because
  `toEqual` treats `{a: undefined}` and `{}` as equal — exactly the distinction
  `Presence` exists to protect.
- `withoutIndexOrder` is for round-trip assertions **only**: delete-then-put
  moves an asset to the end of the index's insertion order.
- A fixture must pass **one** `idGenerator` to both `buildTestFactories()` and
  `HydraulicModelBuilder.with()`, or an operation mints an id the builder already
  used.
