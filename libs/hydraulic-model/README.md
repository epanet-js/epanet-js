# @epanet-js/hydraulic-model

The in-memory hydraulic **asset model** for epanet-js: the typed asset classes,
the value types that hang off them (curves, patterns, customer points), label
generation, and the factories that build assets with correct defaults and ids.

This is the foundational layer used to *construct and describe* a network. The
heavier runtime concerns (topology graph, model operations, spatial/asset
indexes, persistence) currently live in the app and build on top of this package.

It is a **no-build source package** — the `.ts` is consumed directly by the
importing app's bundler, the same convention as the other `@epanet-js/*`
workspace libraries. Import everything from the package root
(`@epanet-js/hydraulic-model`).

## What you can do with it

- **Assets** — the typed classes and their property/quantity types:
  `Junction`, `Reservoir`, `Tank` (nodes) and `Pipe`, `Pump`, `Valve` (links),
  plus `BaseAsset`, the `Asset`/`NodeAsset`/`LinkAsset` unions, `AssetType`,
  status/kind vocabularies, and type guards. Geometry is GeoJSON-based.
- **Factories** — build assets and customer points with defaults, generated ids,
  and auto labels: `AssetFactory`, `CustomerPointFactory`, the `ModelFactories`
  container, and `initializeModelFactories(...)`. Factories take an injected
  `IdGenerator` ([`@epanet-js/id-generator`](../id-generator)) and a
  `DefaultsSpec`, so callers stay in control of id sequencing and default values.
- **Customer points** — the `CustomerPoint` type/collection and
  `CustomerPointsLookup` (the reverse, unidirectional lookup from an asset to its
  customer points).
- **Curves & patterns** — `ICurve`/`Curves` and `Pattern`/`Patterns` value types
  plus their helpers (validation, cloning, default points, next-id, …).
- **Labels** — `LabelManager` for unique, per-type, auto-generated asset labels.
- **Custom attributes** — user-defined attributes per asset type: the
  `CustomAttribute`/`CustomAttributesDefinition` types and their helpers
  (`getAttributes`/`setAttributes`, `isCustomProperty`, label validation).
  Attribute *values* are stored on the assets themselves, under property keys
  prefixed `custom-`.

```ts
import {
  initializeModelFactories,
  type DefaultsSpec,
} from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";

const factories = initializeModelFactories({
  idGenerator: new ConsecutiveIdsGenerator(),
  labelManager,
  defaults,
});
const junction = factories.assetFactory.createJunction({ coordinates: [0, 0] });
```

## Depends on

[`@epanet-js/geometry`](../geometry), [`@epanet-js/quantity`](../quantity),
[`@epanet-js/id-generator`](../id-generator), and `@turf/length` /
`geojson`.
