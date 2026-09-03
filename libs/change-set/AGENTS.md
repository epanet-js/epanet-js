# @epanet-js/change-set

The wire format for a **ChangeSet**: one operation's worth of model change,
carrying both directions.

This package owns the format and nothing else. It does not know what a
hydraulic model is and it cannot apply a change to one. The builder (which reads
a model to fill in `before`) and the applier (which writes a change set into one)
belong in the app, because they need the asset classes; this package stays
ignorant of them on purpose.

## The one idea

A change set holds `before` and `after` for every field it touches. There is no
separate "reverse" object: applying backwards means reading the `before` column
instead of the `after` column and swapping create with delete. **Undo is a
direction argument, not a second data structure.**

This is why an operation can produce the whole thing up front, without mutating
anything and without the database being involved.

## Records in, columns out

The API speaks in `ChangeRecord` — one entity, one kind, a `before` bag and an
`after` bag. The columnar layout on the wire is an encoding detail that neither
the builder nor the applier sees.

Entities that are not property bags — a control, a demand list, the pipe library
— have no fields to name, so their whole value travels as a single JSON cell
under `WHOLE_VALUE` (`$value`). Entities keyed by a string rather than a number
(a control by nanoid, a custom attribute by `<assetType>/<id>`) are listed in
`stringKeyed` in `codec.ts` and ride in the op's `keys` vector instead of `ids`.

The compression that layout buys is real: a column whose entries are all
identical collapses to a single entry, so "set diameter to 300 on 5000 pipes"
stores one value rather than five thousand. `decode` expands it again, so readers
never deal with the broadcast case.

**Entities only share an op when their field sets match exactly.** A column holds
one value per id; mixing field sets would leave holes that read back as "unset
this property", which is a different and silently wrong model. If you change the
grouping in `codec.ts`, keep that invariant.

## Three states, not two

`Presence` distinguishes `Present`, `Null` and `Absent`. The domain has optional
properties (`minorLoss?: number`), and an undo that turns an absent property into
an explicit `null` leaves a different model behind. Collapsing those two into one
is the kind of bug that only shows up as a diff against a saved file weeks later.

## One record per entity, and the order rule is load-bearing

`mergeRecords` keeps the **first** `before` and the **last** `after` per field,
and both `ChangeSet.of` and `squash` go through it. So a change set can never
hold two records for the same entity.

That is not tidiness. Forward-apply would survive duplicates — last one wins —
but **undo would not**: reversing both records lands the entity on the second
record's `before` instead of its original value.

The same rule across a run of change sets is what makes "update then delete"
restore the value from before the update rather than the intermediate one the
delete happened to see. The full transition table — including create-then-delete
cancelling out and delete-then-create reading as an update — is exercised in
`src/codec.test.ts`.

A squashed set is no longer any single operation, so it does not keep an
operation name. Undo/redo works on unsquashed sets for exactly that reason.

## Versioning and migrations

A change set carries the schema revision that wrote it (`version`, defaulting to
1 — the field was appended, so every buffer written before it existed reads back
as 1, which is what it is).

Flatbuffers already makes the *buffer* compatible: fields are only appended, so
today's reader reads every buffer ever written. A migration is for the layer
above that — the **meaning** that changed. A property renamed, a value re-scaled,
one entity kind split into two. That is why migrations are functions over the
decoded `ChangeRecord[]`, not over bytes.

`src/versioning.ts` is the only file to edit:

```ts
export const migrations: ChangeSetMigration[] = [];
```

`CURRENT_VERSION` derives from the list, the way ejsdb's `APP_VERSION` derives
from its SQL migrations — the list is the only thing to keep right. Add a step,
and everything stored below it migrates the next time it is read.

**Entries here are permanent.** A change set at version 1 is brought forward by
running every step above 1 in order; deleting one orphans every file that stopped
at that version. `migrateChangeSet` refuses a chain with a hole in it and refuses
a change set written by a build newer than this one — both are unreadable data,
not a bad change, so they stop the read rather than being skipped.

The result is **re-encoded, not patched**: the bytes that come back are what a
current build would have written for the same change, so nothing downstream needs
to know it was ever older.

### Exercising the flow

**The shipped list is empty, and nothing test-shaped ships in it.** A
commented-out entry would be one careless uncomment away from a migration
reaching production, so there is deliberately nothing here to uncomment. To drive
the flow end to end, patch a step in locally and delete it before you commit:

```ts
// src/versioning.ts — local only, never committed
export const migrations: ChangeSetMigration[] = [
  {
    to: 2,
    describe: "test: tag the operation name",
    migrate: (decoded) => ({
      name: `${decoded.name} [v2]`,
      records: decoded.records,
    }),
  },
];
```

`CURRENT_VERSION` becomes 2, and anything stored at 1 migrates the next time it
is read. Tagging the operation name is the right transform to test with: nothing
applies a name, so it is the one change that cannot leave a different model
behind — what it proves is the plumbing, not a schema change. Delete the entry
and the chain is empty again.

A real step is the same shape but rewrites the records, and both sides have to
move together: `before` and `after` are the same field seen from two ends, so
renaming one and not the other makes undo restore a property that no longer
exists. `src/migrate.test.ts` has a worked rename, and drives `migrateWith` with
a chain of its own rather than the shipped list — so the tests never depend on
what is in `migrations`.

Who runs the migration and when is the app's business, not this package's.

## Regenerating the schema

`schema/change-set.fbs` is the source of truth. **`src/generated/` is committed**,
so `check-types`, `test`, CI and anyone building this repo need no `flatc` at
all. You only run codegen if you edit the schema.

```sh
pnpm --filter @epanet-js/change-set codegen
```

### Installing flatc

`flatc` is not installed by `pnpm install` — it is a native binary you put on
your PATH yourself. Download the release matching the `flatbuffers` version this
package pins (see `dependencies` in `package.json`, currently **25.9.23**) from
<https://github.com/google/flatbuffers/releases>, then:

```sh
flatc --version   # must print the same version as the pinned runtime
```

**The compiler and the runtime move together, and this is the trap worth
knowing.** A mismatched `flatc` does not fail: it emits code that today's runtime
decodes incorrectly, which surfaces much later as confusing data rather than an
error. `scripts/codegen.mjs` therefore refuses to run unless `flatc --version`
equals the pinned dependency exactly — the pin is deliberately exact (no caret)
for the same reason.

### What the script does

1. Checks `flatc` is present and its version matches the pinned runtime; exits
   with a clear message if not.
2. Runs `flatc --ts -o src/generated schema/change-set.fbs`.
3. Strips the `.js` extension flatc writes on its relative imports. This package
   ships raw `.ts` consumed by the importing app's bundler, where those
   extensions do not resolve.

### Checking it worked

```sh
pnpm --filter @epanet-js/change-set codegen
git diff --stat public/libs/change-set/src/generated   # unchanged schema → no diff
pnpm --filter @epanet-js/change-set test
```

An empty diff means the committed output still reproduces from the schema. If you
*did* change the schema, commit the regenerated files alongside it — a schema and
its generated code must never land separately.

**Ids are `[int]`, deliberately.** `AssetId` is a JS number and a `[long]` decodes
to `bigint`, which would force a conversion at every id boundary.
