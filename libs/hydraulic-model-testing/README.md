# @epanet-js/hydraulic-model-testing

Test-only helpers for building [`@epanet-js/hydraulic-model`](../hydraulic-model)
assets in unit tests. **Not for production use** — install it as a
`devDependency` and import it only from test files. The explicit package name
keeps these test builders clearly distinct from the production `AssetFactory` /
`initializeModelFactories`.

It is a **no-build source package** (same convention as the other `@epanet-js/*`
libs). It depends on `@epanet-js/hydraulic-model` (one-way — the lib does not
depend on this package).

## What you can do with it

- **`buildJunction` / `buildPipe` / `buildPump` / `buildReservoir`** — construct a
  single asset with sensible test defaults (see `testDefaults`), a fresh id, and
  an auto label. Pass partial build data to override fields, e.g.
  `buildPipe({ diameter: 12, length: 0.1 })`.
- **`buildCustomerPoint(id, options)`** — construct a `CustomerPoint`.
- **`testDefaults`** — the `DefaultsSpec` the builders use (mirrors today's
  `presets.LPS` defaults). Exposed so tests can reference or extend it.

```ts
import { buildPipe } from "@epanet-js/hydraulic-model-testing";

const pipe = buildPipe(); // diameter 300, length 1000, roughness 130
```
