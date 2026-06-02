# @epanet-js/quantity

Units and unit conversion for epanet-js. A small, dependency-light package
shared across the apps and libraries so that "a value with a unit" means the
same thing everywhere.

It is a **no-build source package** — the `.ts` is consumed directly by the
importing app's bundler (the same convention as the other `@epanet-js/*`
workspace libraries).

## What you can do with it

Import everything from the package root (`@epanet-js/quantity`):

- **`Unit`** — the vocabulary of supported units (`"m"`, `"l/s"`, `"psi"`,
  `"m^3/h"`, … and `null` for unitless). Use it to type any field that carries a
  unit.
- **`Quantity`** — a `{ value, unit }` pair: a number together with its `Unit`.
- **`convertTo(quantity, targetUnit)`** — convert a `Quantity` to another unit,
  returning the plain number. Handles the custom water-column units (`mwc`,
  `fwc`) on top of [`js-quantities`](https://github.com/gentooboontoo/js-quantities).
- **Type helpers** — `QuantitySpec` (a default value + unit + optional decimals),
  `QuantityMap<T>` / `QuantityOrNumberMap<T>` (map every key of `T` to a
  `Quantity`), and `QuantitiesSpec<T>` (map every key of `T` to a `QuantitySpec`).

```ts
import { convertTo, type Quantity } from "@epanet-js/quantity";

const head: Quantity = { value: 10, unit: "mwc" };
convertTo(head, "psi"); // ≈ 14.22
```
