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
