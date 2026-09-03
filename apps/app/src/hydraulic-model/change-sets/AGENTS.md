# change-sets — the app side of the change format

The format itself lives in
[`@epanet-js/change-set`](../../../../../libs/change-set/AGENTS.md). This
directory connects it to the model: the **builder** that reads a `HydraulicModel`
to fill in `before`, and the **applier** that writes a change set into one. Both
need the asset classes, which is why they are here and not in the package.

Nothing in the app runs this code yet. The live edit path is still moments; the
switch is a later slice.

## The shape of an edit

    operation → ModelMoment → toChangeSet() → ChangeSet → applyChangeSet()

An operation describes the state it wants. `toChangeSet` resolves that against
the model, reading every `before` in one pass. `applyChangeSet` writes it,
forwards or backwards.

**Nothing reads the model during apply.** That is the property the whole design
rests on: a change set is complete before anything mutates, which is what makes
it undoable, persistable and squashable.

## Direction is the whole of undo

There is no reverse change set. `applyChangeSet(model, cs, "reverse")` reads the
`before` column instead of `after` and swaps create with delete. If you find
yourself computing an inverse, something has gone wrong.

## Every intent reads the same unmutated model

Operations are pure and they compose (`moveNode` uses `splitPipe`). Because every
intent resolves against the same snapshot, each `before` is already the original
value, so intent order only decides which `after` wins.

If you make an operation resolve mid-way and then read the model again, this
stops being true and undo will restore an intermediate value.

## Intent order in `from-moment.ts` is load-bearing

It reproduces the order `applyMomentToModel` applies a moment in, which is
**asymmetric** and easy to get backwards:

- **Assets: drop before put.** The moment applier deletes assets before putting
  them, so an id in both `deleteAssets` and `putAssets` ends up *present*.
  Emitting `dropAssets` first makes `mergeRecords` fold delete-then-create into
  an `update`, which is the same outcome.
- **Customer points: put before drop.** The moment applier does the opposite for
  customer points — puts at step 8, deletes at step 9 — so an id in both ends up
  *deleted*. Emitting `putCustomerPoints` first folds update-then-delete into a
  `delete`.
- Patches come after puts, so the patch's `after` wins while `mergeRecords` keeps
  the put's `before`.

Get either of these backwards and the entity survives when it should not, or
vice versa. The differential test is what catches it.

## One record per entity, per change set

`ChangeSet.of` runs `mergeRecords` before encoding, so a change set can never
hold two records for the same entity — first `before`, last `after`.

The old applier needed a debug-only `assertNoPutPatchOverlap` to catch an
operation that touched an asset twice. That case is now handled by construction.

## Apply order is fixed, not stored

Creates run outermost-first (the pipe library and raw controls, then custom
attributes, curves and patterns, then nodes, then links, then customer points,
controls and demands) and deletes run in the mirror order, so a link never exists
without its nodes mid-apply. Reversing needs no reordering — same order, other
column.

`CREATE_RANK` in `apply.ts` is an exhaustive `Record<EntityKind, number>`, so a
new entity kind is a **type error** until it is given a position. Place it
deliberately; a create that lands before the thing it points at has no other
guard.

## `diffFields` walks the union, not just the next side

A put carries a whole asset, so a field the replacing asset no longer has must be
recorded as removed — otherwise the new path silently keeps a value the moment
path drops. Walking only `next` misses that. The removal travels as
`after[field] = undefined`, which encodes as `Presence.Absent`.

## Build assets with the constructor, never the factory

`buildAssetFromFields` uses a per-kind `Record<AssetEntityKind, …>` of
constructors. It must not go through `AssetFactory`, which would:

- mint an id when one is supplied, leaving `idGenerator.totalGenerated` stale,
- register a label as a side effect on the shared `LabelManager`, and
- coerce `undefined → null` through `orNull()` for some fields.

All three are wrong for an applier, which is reconstructing a value that already
existed rather than creating a new one.

## The applier's contract

`applyChangeSet` mutates **the model and the label manager, and nothing else.**
It does not touch the id generator, does not re-sort assets, and does not set
`version`. Those belong to the caller, exactly as they do for the moment applier
today (see `applyMoment` in `src/lib/persistence/transaction-helpers.ts`).

`ApplyReport.touchedEntities` is what a caller needs to decide what to
re-instantiate — the two conditionals in `applyMoment` that today read the moment
directly. `touchedAssetIds` is what the map's edition tracker needs.

## The id generator is not this directory's problem

Applying a `create` supplies an explicit id, so nothing advances
`idGenerator.totalGenerated`, and `AssetIndex.maxAssetId` reads exactly that.

There is no regression while change sets only carry ids an operation already
minted — undo and redo of a minted id never needed to advance it. It becomes real
only when a *stored* delta is replayed into a model whose generator has never seen
those ids. That is what the id-pools work exists for, and the fix cannot live
inside `applyChangeSet` anyway. Keep the applier ignorant of the generator.

## Keyed collections are diffed, not stored whole

Curves, patterns, controls and custom attributes reach operations as whole
replacement collections, because that is how the dialogs edit them.
`diffKeyed` turns them into per-entity records.

That is not only a size win over the moment path (which costs every curve on both
sides of a one-curve edit). A `Map` in a `WHOLE_VALUE` cell would
`JSON.stringify` to `{}` and lose everything, silently. Only `pipeLibrary` (an
array) and `rawControls` (a plain object) are whole-value singletons, and both are
JSON-safe.

## Three strategies, by worked example

**Assets and customer points — the whole entity, flattened to a field bag.**
`assetToFields` spreads `feature.properties` and pulls `coordinates` off the
geometry, skipping `type` (it rides on the entity kind).

```json
{ "entity": "pipe", "id": 3, "kind": "create", "before": {},
  "after": { "connections": [1,2], "coordinates": [[0,0],[10,0]],
             "diameter": 200, "initialStatus": "open", "isActive": true,
             "label": "P1", "length": 10, "roughness": 130 } }
```

`after` also carries `minorLoss`, `material`, `year` and the reaction
coefficients as `undefined` — the factory writes those keys, and they encode as
`Presence.Absent`. A key missing from the bag means untouched; a key present with
`undefined` means the property is not on the entity.

Customer points take the same shape but need a hand-written mapping:
`listProperties()` returns only `["label"]`, so `coordinates` and `connection` are
named explicitly. The connection travels as a JSON cell — nothing else in the
change set could reconstruct the snap point.

```json
{ "entity": "customerPoint", "id": 6, "kind": "create", "before": {},
  "after": { "connection": { "pipeId": 3, "junctionId": 1, "snapPoint": [5,0] },
             "coordinates": [5,1], "label": "CP1" } }
```

**Keyed collections — whole collection in, only what moved out.** A dialog hands
over the entire `Patterns` map; `diffKeyed` emits one record for the pattern that
changed and nothing for the rest.

```json
{ "entity": "pattern", "id": 21, "kind": "create", "before": {},
  "after": { "label": "PAT2", "multipliers": [0.5,1.5], "type": "demand" } }
```

**Owner-keyed and singleton values — one opaque `$value`.** A demand list has no
identity of its own, so the record is keyed by its owner and the whole `Demand[]`
rides in one cell. An owner with no demands reads as `[]`, not absent.

```json
{ "entity": "junctionDemand", "id": 1, "kind": "update",
  "before": { "$value": [] },
  "after":  { "$value": [{ "baseDemand": 5, "patternId": 21 }] } }
```

`pipeLibrary` and `rawControls` are the same idea with no owner either, so they
sit at a synthetic `id: 0`.

## Known differences from the moment path

These are deliberate. They are asserted by `differential.test.ts`, which runs
each operation down both paths and compares the resulting models.

- **Instance identity.** The moment applier stores the caller's `Asset` object;
  this one rebuilds from the field bag. The rebuild is what makes the map and the
  panels re-render, and it removes the aliasing between the undo stack and live
  model objects.
- **Label registration on a re-put node.** `putAsset` in the moment applier only
  de-registers the old label when the old version was a link already in the
  topology, so re-putting a *node* with a changed label leaks the old
  registration. This path de-registers whenever `label` is among the changed
  fields. Do not reproduce the leak.
- **`mergeMoments` drops `putPipeMaterials` and `putCustomAttributesDefinition`.**
  Not a difference — it happens upstream, so both paths see the same merged
  moment. It is a latent bug that disappears when operations emit records
  directly.

## What the differential test covers

`differential.test.ts` runs an operation down both paths and compares the
resulting models, in both directions. It is organised by **the items this
directory supports** — every entity kind and every `ModelMoment` field — using the
cheapest operation that reaches each one, not by enumerating operations.

That split is deliberate. What can be wrong here is the *format and the two
appliers*: whether a customer point's connection survives a rebuild, whether a
whole-collection replacement diffs down correctly, whether an optional key comes
back absent rather than explicitly `undefined`. An operation's own contract —
that `splitPipe` produces the right four pipes — is the operation's to prove, in
its own test, when it changes.

So the elaborate structural operations (`splitPipe`, `mergeNodes`, `replaceNode`,
`replaceLink`, `addLink`, `moveNode`, `applyCustomerPointAllocation`) have no case
here. They exercise the same moment fields the simple operations already cover,
and a fixture elaborate enough to drive them proves something about the operation
rather than about this directory.

## Testing notes

- `src/__helpers__/model-snapshot.ts` canonicalises a whole model into a sorted,
  JSON-safe shape. It maps `undefined` to a sentinel, because `toEqual` treats
  `{a: undefined}` and `{}` as equal and that is exactly the distinction
  `Presence` exists to protect.
- `withoutIndexOrder` compares `AssetIndex` membership rather than position. Use
  it **only** for round-trip assertions: deleting an asset and putting it back
  moves it to the end of the index's insertion order. The moment path does this
  too, so it is pre-existing undo behaviour, not a regression. Forward
  comparisons keep the full ordered snapshot.
- A fixture must pass **one** `idGenerator` to both `buildTestFactories()` and
  `HydraulicModelBuilder.with()`. Two generators mint the same ids, so an
  operation that creates an asset collides with one the builder already made.
