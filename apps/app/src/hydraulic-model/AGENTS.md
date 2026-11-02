# hydraulic-model module

The app side of the in-memory domain model: the `HydraulicModel` container and
the worker-transferable encodings. The operations that change the model, and the
change-set builder and applier, are in
[`@epanet-js/hydraulic-model-operations`](../../../../libs/hydraulic-model-operations/AGENTS.md).

## References are unidirectional

Assets never store references to other assets. The source stores the target's
ID and a lookup answers the reverse query: links know their nodes and `Topology`
answers "which links touch this node"; customer points know their pipe and
junction and `CustomerPointsLookup` answers "which customer points hang off this
junction".

Do not add the reverse field "for convenience". Customer points outnumber
junctions 100–10,000 to one (10k–1M+ in a utility network), so an operation that
updated the junction on every customer-point edit would put the junction — and
everything keyed off it — into every change set. A new cross-asset relationship
gets a lookup, not a field on the target.

## Most of the model lives in `@epanet-js/hydraulic-model`

The asset/value layer — asset classes, factories, label manager, curves,
patterns, customer points and their lookup, custom attributes, demands,
controls, and the ngraph `Topology` — is in `public/libs/hydraulic-model/`.
Change those there, not here. Import them from the bare package name (there are
no subpaths); this directory's `index.ts` re-exports them so existing
`src/hydraulic-model` imports keep working.

`topology/` exists on **both** sides and they are not the same thing: the
package holds the `Topology` class and its queries, this directory holds only
the worker-transferable encoding (`topologyEncoder`, `topologyView`,
`topology-transferable`).

## The transferable encoders are shared — wrap their inputs

`AssetIndexEncoder` (`asset-index-transferable.ts`) and `TopologyEncoder`
(`topology/topologyEncoder.ts`) are used by **orphan assets, area selection and
trace**. Do not add feature-specific behaviour to them.

When a consumer needs a different view of the model, wrap the **inputs** instead.
Both encoders take `AssetIndexQueries` / `TopologyQueries`, so an adapter
implementing those interfaces can hide or reshape assets without the encoders
knowing. `@epanet-js/hydraulic-model`'s `active-only-queries.ts` does exactly that: `ActiveAssetIndex`
and `ActiveTopology` present an active-only view, which is how the network review
checks exclude inactive assets.

Such an adapter **must renumber densely from zero**. `AssetIndexEncoder` writes
positionally (`addAtIndex`) using the index yielded by `iterate*`, while
`TopologyEncoder` writes sequentially (`add`); the two agree only when the
yielded indices are dense and ascending. Preserving the underlying indices while
skipping entries misaligns the buffers silently.

The live `AssetIndex` index is **ordinal, not stable** — it is derived as `i++`
over a Set, so removing an asset renumbers everything after it. Never persist or
cache one of these indices across a mutation.
