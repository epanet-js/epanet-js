# Persistence & Validation Guidelines

Every DB-backed data type is persisted as part of the on-disk SQLite project file. Two invariants keep that file trustworthy:

1. The DB must never receive data that fails its Zod schema.
2. The in-memory Jotai model and the DB must never diverge.

The rule that enforces both: **validate, then save.** Serialize-and-validate a change against its schema _before_ applying it to the in-memory atom; if validation fails, reject the change and leave the model untouched. The **only** exception is import, which is allowed to validate _while_ saving (see below).

## The building blocks

| Piece | Where | Responsibility |
|---|---|---|
| `serializeX` validator | `src/lib/db/mappers/*/to-rows.ts`, `@epanet-js/ejsdb-mappers` | `schema.safeParse` → throw a descriptive error. The single source of truth for "is this valid?" |
| `saveX` command | `src/lib/db/commands/save-*.ts` | Persist to the worker. Always serializes (validates) at the write boundary |
| `use-*-transaction` hook | `src/hooks/persistence/use-*-transaction.ts` | Validate **before** the atom update, then set the atom, then `saveX` |
| `changeNotApplied` dialog | `src/dialogs/change-not-applied.tsx` (type in `src/state/dialog.ts`) | The standard "we couldn't apply your change — save your work, try again, contact us" error |

`serializeX` is reused everywhere — the `saveX` write boundary, the transaction hook, and import all call the same validator, so "valid" means the same thing on every path.

## Validate, then save (default)

User-initiated edits that mutate a persisted atom go through a persistence transaction hook. The hook validates first; on failure it captures the error, shows `changeNotApplied`, and returns `false` **without** touching the atom. Only once validation passes does it set the atom and persist.

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

Consumers stay thin — compute the next value, delegate persistence to the hook, and bail if it was rejected:

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

Reference hooks: `use-project-settings-transaction.ts`, `use-zones-transaction.ts`, `use-simulation-settings-transaction.ts`, `use-model-transaction.ts` (assets/moments).

## Validate while saving — import only

`importProject` (`src/lib/db/commands/import-project.ts`) is the single allowed exception. It writes a whole project — settings, zones, assets, controls, simulation settings — to a fresh DB in one command, validating each piece only at the write boundary (`saveX` / `serializeX` / `toRows` throw on invalid data). There is no in-memory model to gate at that point: `loadModel` applies state to memory **after** the import succeeds, so a failed import never reaches the atoms.

Because import throws instead of showing its own dialog, the **caller** catches the error and surfaces it:

- `src/dialogs/create-new.tsx` → `changeNotApplied` (a creation/edit the user can retry)
- `src/commands/import-inp.tsx` → `projectOpenFailed` (opening an external file)

Do not copy this "validate while saving" shape into interactive edit paths — those have a live atom to protect, so they must validate first.

## The write queue, recovery & rebuild

Interactive writes go through one global serial queue (`writeQueue`), enqueued fire-and-forget *after* the atom is set, and sharing a single failure path (`useWriteFailureHandler`). Whole-project writes — `importProject`, `openProject`, `newProject`, and the settings write inside file-save — are deliberately **not** queued: they replace or read the DB themselves, so the shared failure path would be circular.

**Marking the project as unsaved** is *not* done at this boundary — undo and redo write here too, and marking on them would report unsaved changes after the user undid back to the saved state. A new persisted type either travels in a `Moment` (covered by the model's `version`) or stamps `projectDataVersionAtom` in its transaction hook; anything else silently never counts as an unsaved change.

### The DB can vanish, so it has to be rebuildable

OPFS is not durable. The browser may evict the origin under storage pressure, and the pool's file handles can be invalidated out-of-band by an antivirus scan or a cloud-sync client. Neither is preventable from here, so the **saved project file** is the durable artifact and the DB is a working store plus crash recovery.

Two independent facts live in `src/state/session-recovery.ts`: `dbStorageModeAtom` says *where* the DB is (`opfs` / `memory`), `dbAvailabilityAtom` says whether it currently *works*. The mode is decided at boot and can be `memory` from the first frame. **Memory mode is degraded in exactly one way — there is no crash recovery**; writes, reads and saving to a file are unaffected, so nothing else should branch on it. `sessionRecoveryActiveAtom` is derived from the mode; set the mode, never it.

### When a queued write fails

Memory and the DB have diverged, and the error says which side is at fault:

- **The DB is unreadable** — the storage went away and memory is still correct → **rebuild**: regenerate the DB from memory (`rebuildDbFromMemory`). Never read through a DB that has reported itself unreadable; that re-enters the same failure.
- **A readable DB refused the write** — something invalid got past validate-then-save, so the app is already inconsistent and memory is *not* the side to trust → **recovery**: reload the model from the DB (`recover()`), dropping the refused change. This is blunt — it reloads the whole project, so scenarios and undo history go with it.

Only the first response in a session runs; later failures are absorbed, or a broken DB would respond on every edit. A rebuild retries OPFS on a fresh pool, and once that has failed it stops asking for the rest of the session — a project load is the next thing that resets it. Memory is the fallback, which cannot fail for storage reasons. The rebuild is attempted **once** automatically, and only **consecutive** failures count: a write succeeding after a rebuild proves the DB recovered, so the count starts again. Two failures back-to-back mean rebuilding did not fix it and a third attempt will not either, so the session goes terminal instead. *Try again* in that dialog is a user action and is not capped. **It writes the DB and nothing else** — app state is already the thing being written out, so unlike a project load it must not reset it. The user is told about a lost backup only when the session actually had one, not on every rebuild that lands in memory. If the rebuild fails outright the session is terminal: a blocking dialog goes up and asks the user to reload. It needs no edit-gating of its own — see the shortcut rule in [ux-patterns.md](./ux-patterns.md).

### What is reported, and what the user sees

Nothing is reported when storage works — a healthy boot is the overwhelming majority, and an event per page load buys nothing the failure paths do not already say. The steps are Sentry **breadcrumbs**, so they cost nothing and still tell the whole story on whatever event does fire. Two things are captured: a **warning once per session** when storage degrades and has to be rebuilt, carrying where it ended up and whether crash recovery was lost — that is how we count degraded sessions — and an **error** if the rebuild fails, carrying a `DB Storage` snapshot (`collectDbDiagnostics`) that separates an evicted origin from a full disk from a revoked handle, which `SQLITE_IOERR` alone cannot.

The user sees nothing while it works. A rebuild that lands in memory holds its progress dialog open to say crash recovery is gone. **Known gap:** a *startup* fallback to memory says nothing at all — a persistent indicator was built and then pulled pending team agreement.

### In tests

Every test starts with a stub DB worker (`test/setup.ts`) whose write commands resolve and whose reads throw — so a queued write from an edit under test never fails for want of a database. A test that needs a real one calls `useInProcessDb()`, which drains the queue before closing the DB so a fire-and-forget write cannot outlive it.

## Adding a new persisted type

1. Define the Zod row/object schema in `@epanet-js/ejsdb` (`src/schema/*.ts`). Adding or changing a persisted shape is a **file-format change** — follow `public/libs/ejsdb/AGENTS.md` (it requires a paired migration).
2. Add a `serializeX` validator and a `saveX` command in `src/lib/db/`.
3. Add a `use-*-transaction.ts` hook mirroring the reference shape above.
4. Route every interactive edit of that type through the hook — never `setAtom` + `saveX` inline.
5. Let `importProject` validate it at the write boundary; make sure the import caller surfaces failures.

## When to Override

- **Import / whole-project writes** — the documented exception: validate while saving, caller shows the error. Trusted load paths (`loadModel` reading already-persisted, already-valid DB data) do not re-validate or pop a dialog.
- A genuinely non-persisted atom (UI-only state that never hits the DB) doesn't need a transaction hook.

## Integration with Other Guidelines

- See [architecture.md](./architecture.md) for the Command → Lib → State layering (`persistence/` is the React-coupled exception that owns these hooks).
- See [`../../../libs/ejsdb/AGENTS.md`](../../../libs/ejsdb/AGENTS.md) for file-format / migration rules when changing a schema or persisted JSON shape.
