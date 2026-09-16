# @epanet-js/id-generator

Tiny shared utility for generating unique numeric ids, used across the epanet-js
apps and libraries (assets, customer points, labels, …).

It is a **no-build source package** — the `.ts` is consumed directly by the
importing app's bundler (the same convention as the other `@epanet-js/*`
workspace libraries). It has no dependencies.

## What you can do with it

Import from the package root (`@epanet-js/id-generator`):

- **`IdGenerator`** — the interface every id source implements:
  `newId(): number` and `get totalGenerated(): number`. Accept this type when a
  component should be handed an id source rather than creating its own.
- **`ConsecutiveIdsGenerator`** — the default implementation: hands out
  sequential integers (optionally seeded with a starting value), and reports how
  many it has generated.

```ts
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";

const ids = new ConsecutiveIdsGenerator();
ids.newId(); // 1
ids.newId(); // 2
```

## Id pools

Ids are drawn per **pool** — `asset`, `pattern`, `curve`, `zone`. Assets share
one pool because nodes and links are keyed in a single space; everything else is
keyed in its own map, so a pattern and a curve may both be `7`.

- **`PooledIdGenerator`** — `newId(pool)`, `totalGenerated(pool)`, and
  `forPool(pool)`, which returns a plain `IdGenerator` bound to that pool so
  existing consumers can be handed one without changing their signature.
- **`IdPoolsGenerator`** — a `ConsecutiveIdsGenerator` per pool. Its `seeds` are
  a complete `Record<IdPool, number>`: a pool that silently starts at 0 hands
  out an id something already holds, so there is no default.
- **`sharedIdPools(generator)`** — every pool aliases one generator, so all four
  draw from a single sequence. Use it where the caller has one generator and no
  per-pool seeds.

```ts
const pools = new IdPoolsGenerator({ asset: 42, pattern: 7, curve: 0, zone: 0 });
pools.newId("asset"); // 43
pools.newId("pattern"); // 8
```
