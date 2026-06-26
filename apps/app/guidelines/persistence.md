# Persistence & Validation Guidelines

Every DB-backed data type is persisted as part of the on-disk SQLite project file. Two invariants
keep that file trustworthy:

1. The DB must never receive data that fails its Zod schema.
2. The in-memory Jotai model and the DB must never diverge.

The rule that enforces both: **validate, then save.** Serialize-and-validate a change against its
schema _before_ applying it to the in-memory atom; if validation fails, reject the change and leave
the model untouched. The **only** exception is import, which is allowed to validate _while_ saving
(see below).

## The building blocks

| Piece | Where | Responsibility |
|---|---|---|
| `serializeX` validator | `src/lib/db/mappers/*/to-rows.ts`, `@epanet-js/ejsdb-mappers` | `schema.safeParse` → throw a descriptive error. The single source of truth for "is this valid?" |
| `saveX` command | `src/lib/db/commands/save-*.ts` | Persist to the worker. Always serializes (validates) at the write boundary |
| `use-*-transaction` hook | `src/hooks/persistence/use-*-transaction.ts` | Validate **before** the atom update, then set the atom, then `saveX` |
| `changeNotApplied` dialog | `src/dialogs/change-not-applied.tsx` (type in `src/state/dialog.ts`) | The standard "we couldn't apply your change — save your work, try again, contact us" error |

`serializeX` is reused everywhere — the `saveX` write boundary, the transaction hook, and import all
call the same validator, so "valid" means the same thing on every path.

## Validate, then save (default)

User-initiated edits that mutate a persisted atom go through a persistence transaction hook. The hook
validates first; on failure it captures the error, shows `changeNotApplied`, and returns `false`
**without** touching the atom. Only once validation passes does it set the atom and persist.

```typescript
// src/hooks/persistence/use-zones-transaction.ts — the reference shape
export const useZonesTransaction = () => {
  const setZones = useSetAtom(zonesAtom);
  const setDialog = useSetAtom(dialogAtom);

  const transact = useCallback(
    async (next: Zones): Promise<boolean> => {
      try {
        serializeZones(next); // validate BEFORE applying
      } catch (error) {
        captureError(error instanceof Error ? error : new Error(String(error)));
        setDialog({ type: "changeNotApplied" });
        return false; // model untouched, nothing persisted
      }
      setZones(next);
      await saveZones(next);
      return true;
    },
    [setZones, setDialog],
  );

  return { transact };
};
```

Consumers stay thin — compute the next value, delegate persistence to the hook, and bail if it was
rejected:

```typescript
const { transact } = useZonesTransaction();
const applied = await transact(nextZones);
if (!applied) return; // changeNotApplied is already showing
```

```typescript
// ❌ Avoid: the atom is updated before (or without) validation, so the UI can hold a value the DB
// will later reject — the model and DB diverge.
setZones(nextZones);
await saveZones(nextZones);
```

Reference hooks: `use-project-settings-transaction.ts`, `use-zones-transaction.ts`,
`use-simulation-settings-transaction.ts`, `use-model-transaction.ts` (assets/moments).

## Validate while saving — import only

`importProject` (`src/lib/db/commands/import-project.ts`) is the single allowed exception. It writes a
whole project — settings, zones, assets, controls, simulation settings — to a fresh DB in one command,
validating each piece only at the write boundary (`saveX` / `serializeX` / `toRows` throw on invalid
data). There is no in-memory model to gate at that point: `loadModel` applies state to memory **after**
the import succeeds, so a failed import never reaches the atoms.

Because import throws instead of showing its own dialog, the **caller** catches the error and surfaces
it:

- `src/dialogs/create-new.tsx` → `changeNotApplied` (a creation/edit the user can retry)
- `src/commands/import-inp.tsx` → `projectOpenFailed` (opening an external file)

Do not copy this "validate while saving" shape into interactive edit paths — those have a live atom to
protect, so they must validate first.

## Adding a new persisted type

1. Define the Zod row/object schema in `@epanet-js/ejsdb` (`src/schema/*.ts`). Adding or changing a
   persisted shape is a **file-format change** — follow `public/libs/ejsdb/AGENTS.md` (it requires a
   paired migration).
2. Add a `serializeX` validator and a `saveX` command in `src/lib/db/`.
3. Add a `use-*-transaction.ts` hook mirroring the reference shape above.
4. Route every interactive edit of that type through the hook — never `setAtom` + `saveX` inline.
5. Let `importProject` validate it at the write boundary; make sure the import caller surfaces failures.

## When to Override

- **Import / whole-project writes** — the documented exception: validate while saving, caller shows the
  error. Trusted load paths (`loadModel` reading already-persisted, already-valid DB data) do not
  re-validate or pop a dialog.
- A genuinely non-persisted atom (UI-only state that never hits the DB) doesn't need a transaction hook.

## Integration with Other Guidelines

- See [architecture.md](./architecture.md) for the Command → Lib → State layering (`persistence/` is the
  React-coupled exception that owns these hooks).
- See [`../../../libs/ejsdb/AGENTS.md`](../../../libs/ejsdb/AGENTS.md) for file-format / migration rules
  when changing a schema or persisted JSON shape.
