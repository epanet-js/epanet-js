# network-review module

The model-review checks. Five of them, four living here and one next door in
`src/lib/model-attributes-validation/`. The panels that render them are in
`src/panels/network-review/`.

| Check | Blocking | Execution |
|---|---|---|
| `modelAttributesValidation` | yes | main thread, time-sliced |
| `orphanAssets` | yes | worker, index + topology buffers |
| `connectivityTrace` | yes | worker, model buffers |
| `proximityAnomalies` | no | worker, model buffers |
| `crossingPipes` | no | worker, model buffers |

**Blocking** checks gate the simulation — `runBlockingChecks` in
`blocking-checks.ts`, consumed by `run-simulation.tsx`. The other two are review
tools only.

The gate is **advisory**. Two of the three blocking checks run in workers, so
they sit on the critical path of every Run and they can genuinely fail. When one
throws, `run-simulation.tsx` reports it to Sentry and offers the same review /
run-anyway choice it offers for real findings — it does not propagate. A broken
check must never become the reason a model cannot be simulated.

---

## Execution model

Checks run over every asset in the model. On a large network that is long enough
to freeze the UI, so the work leaves the main thread. Two shapes exist, and which
one a check uses is determined by whether its inputs can be reduced to numbers.

### Buffer-encoded checks (four of the five)

The model is a `Map` of asset class instances wrapping GeoJSON features. Handing
that to a worker means a structured clone of every feature on every run — the
payload is deep, and cloning it costs roughly what the check itself costs.

So each check first encodes the slice of the model it needs into flat binary
buffers, then **transfers** them:

```ts
await workerAPI.findSubNetworks(
  Comlink.transfer(data, hydraulicModelTransferables(data)),
);
```

Transfer moves ownership of the `ArrayBuffer`s rather than copying them, so the
hand-off is O(1) regardless of network size. This is the whole reason the
encoding layer exists — it is not premature optimisation, it is what makes the
worker boundary affordable.

Every call site uses the `"array"` default. Encoding as `SharedArrayBuffer` is
ruled out app-wide — see the *Workers and buffer encoding* section of
`guidelines/performance.md` for why.

The buffers hold **dense indices**, not asset ids. `IdMapper` assigns each
encoded asset a contiguous index so records can be addressed positionally at a
fixed stride. `buildBuffers()` returns `nodeIdsLookup` / `linkIdsLookup` for the
reverse mapping; every caller destructures them **out** of the payload before
transferring, because they are plain arrays that stay on the main thread and are
used to decode results back into `AssetId`s:

```ts
const { nodeIdsLookup, linkIdsLookup, ...data } = encoder.buildBuffers();
```

That is why `HydraulicModelBuffers` is `Omit<EncodedHydraulicModel, "nodeIdsLookup" | "linkIdsLookup">`.

### Main-thread check (attribute validation)

`validateModelAttributes` is the exception, and it is a structural one rather
than an oversight. Its rules are **closures**: `firstFailure` calls
`rule.accessor(entity, model)`, `rule.appliesWhen(entity, model)` and
`rule.check(value, entity, model)`. Accessors read arbitrary asset properties,
and predicates reach into model-level state such as `model.pipeMaterials`.

Functions cannot cross the worker boundary, and encoding the inputs would mean
encoding essentially the entire model plus its materials — the thing buffers
exist to avoid. So the check stays on the main thread and keeps the UI responsive
by yielding instead, via `createTimeSlicer()` from `src/infra/yield-to-main`:
it awaits `yieldToMain()` whenever a 50 ms slice elapses, using
`scheduler.postTask` where available and falling back to `setTimeout`.

**Do not try to move this check into a worker** without first restructuring rules
into data rather than functions.

## Worker conventions

Every worker-backed check follows the same shape (see
`connectivity-trace/run-check.ts` for the reference implementation):

- A **named** worker — `new Worker(url, { type: "module", name: "…" })` — so it
  is identifiable in devtools.
- Wrapped with `Comlink.wrap<…WorkerAPI>`; the API interface lives in `worker.ts`
  beside the implementation (orphan assets splits it into `worker-api.ts` so the
  fallback can import it without spawning a worker).
- Errors wrapped in `enrichWorkerError(name, e)`, which prefixes the message with
  `[worker:<name>]` and preserves `AbortError` untouched.
- `signal` abort → `worker.terminate()`, and `terminate()` again in `finally`.
- An **inline fallback** when `canUseWorker()` is false (tests, SSR): the same
  `find*` function runs against the same buffers. Keep both paths working; the
  test suites exercise the inline one.

Use `canUseWorker()` (singular). `canUseWorkers()` (plural) additionally requires
`bufferType === "shared"` and is currently unused.

Cancellation is uniform: a cancelled check throws
`new DOMException("Operation cancelled", "AbortError")`, and callers swallow that
name rather than surfacing it.

## Selective encoding

`HydraulicModelEncoder` takes an `EncodingOptions` set per check and encodes only
what was asked for. Unrequested buffers are sized zero, so they cost nothing.

| Check | `nodes` | `links` |
|---|---|---|
| Connectivity trace | `types`, `connections` | `types`, `connections`, `bounds` |
| Proximity anomalies | `bounds`, `connections` | `connections`, `geoIndex` |
| Crossing pipes | `geoIndex` | `connections`, `bounds`, `geoIndex` |

⚠️ On **nodes**, `"bounds"` gates *position* encoding, not bounds — both
`buildEmptyBuffers` and `encodeNodePosition` key the positions buffer off
`nodes.has("bounds")`. There is no separate node-positions flag. Rename with care;
this trips people up.

`geoIndex` builds a Flatbush spatial index, which is what the two geometric
checks query.

Orphan assets does **not** use this encoder. It goes through `AssetIndexEncoder`
and `TopologyEncoder`, which are **shared with area-selection and trace** and
must therefore not grow network-review-specific behaviour.

---

## The rule that governs every check

**Every check runs on the active topology.** Inactive assets — `isActive === false` —
are excluded from all five, because `build-inp` excludes them from the INP. The
review and the solver must reason about the same network.

There is deliberately **no setting to include inactive assets**, and adding one
would be a regression.

### Where the filtering happens

| Check | Filtered in |
|---|---|
| Connectivity, proximity, crossing | `HydraulicModelEncoder.prepareMappings` |
| Orphan assets | `ActiveAssetIndex` / `ActiveTopology` adapters wrapping the inputs |
| Attribute validation | the asset loop in `model-attributes-validation/run-check.ts` |

`HydraulicModelEncoder` is used only by this module, so it filters
unconditionally — no option flag is needed and none should be added.

Orphan assets cannot filter inside its encoders, because `AssetIndexEncoder` and
`TopologyEncoder` are shared with area selection and trace. It filters the
**inputs** instead, via the `ActiveAssetIndex` / `ActiveTopology` adapters — see
*The transferable encoders are shared* in `src/hydraulic-model/AGENTS.md` for the
pattern and its alignment constraints. The upshot here is that
`findOrphanAssets` stays pure topology logic with no concept of activity, and the
same adapters serve the inline fallback path.

Do **not** replace this with post-filtering of the results: a pump whose
neighbours' other links are all disabled is orphaned in the active topology but
not in the full one, so the filtering has to happen before traversal.

### Why there is no toggle

Including inactive assets is not an alternative view; it is a wrong answer, and
for connectivity trace it is wrong in the direction that matters.

A disabled link that is a **cut edge** is a bridge in the check's graph and a gap
in the solver's. Take `Reservoir -P1- J1 -P2(disabled)- J2 -P3- J3`: tracing
through P2 yields one subnetwork with a supply source, so the check reports green
— while the INP omits P2 and keeps J2 and J3, which then have no path to any
source. The check clears a model that cannot solve.

`deactivateAssets` does not prevent this. Its cascade deactivates an endpoint
node only when that node loses its *last* active link, so it fires for dead-end
stubs and never for a bridging link with active links on both sides — precisely
the case that breaks connectivity.

Orphan assets and attribute validation only ever produced false positives
(blocking on assets never written to the INP), so filtering there removes noise
rather than changing verdicts.

If latent problems in disabled parts of a model ever need surfacing, the only
coherent place for an opt-in is **attribute validation**, which judges assets
individually — including them can add findings but can never mask one. It is
incoherent for connectivity trace, which reasons about paths.

### Do not guard against active links with inactive endpoints

It is tempting to skip an active link whose endpoint node is inactive, so the
encoder cannot fail on it. Do not.

That state is unconstructible today — `deactivateAssets` is the only code in the
repo that sets `isActive: false`, it operates on links only, `activateAssets`
turns endpoints back on with their link, and `change-property` explicitly refuses
`isActive`. But were it to occur, `build-inp` would write the link and omit the
node, producing an INP referencing an undefined node. Skipping the link would
hide that silently.

Instead the encoder lets `OrphanLinkConnectionError` fire. Its details carry
`startIsActive` / `endIsActive` so the report distinguishes a missing node from
an inactive one.

Note `prepareMappings` also skips **orphan links** (a link whose endpoint is not
a node), which is a different condition — that guard predates the activity rule
and exists so a broken model still reviews rather than throwing.

---

## Result caching

Blocking-check results are cached in `reviewResultsAtom`, keyed by `modelVersion`
only, and that cache is **shared** between the review panels and the
pre-simulation gate. `useReviewChecks().ensureFresh()` runs only what the cache
cannot answer, so a review already done in the panel does not re-spawn workers
when the user hits run.

Anything that makes a check produce different results for the same model version
must therefore become part of the cache key, or the panel and the gate will
disagree. This is a large part of why per-check options are expensive here, and
why the active-topology rule is unconditional rather than a setting.

## Adding a check

1. Add it to `CheckType` in `types.ts` and export from the barrel.
2. Decide the execution shape: buffers + worker if its inputs reduce to numbers,
   main-thread time-slicing if it needs rule closures or the live model.
3. Follow the worker conventions above, including the inline fallback.
4. Filter inactive assets, and confirm the result matches what `build-inp` emits.
5. If it should block simulations, add it to `blockingChecks`, extend
   `BlockingCheckResult`, `ReviewResults`, and `useReviewChecks`, and give it a
   rule id in `topologyRuleIds`.
6. Add `networkReview.<checkType>.*` translation keys — `useCheckHeader`,
   `ToolDescription` and `EmptyState` derive their copy from the check type.
