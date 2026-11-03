# selection module

## Naming: `Sel`, not `Selection`

The type is deliberately not called `Selection`: `window.Selection` is a built-in DOM type, so a forgotten import resolves silently to the DOM one and the errors surface far downstream. Don't "clean this up".

## Untouched kinds keep their array reference

`Sel` is one id list per `Category`. An operation that changes one kind returns the other kinds' arrays as they were, and an empty result is `SELECTION_NONE`. The map updater and the derived atoms detect per-kind changes by reference, so rebuilding an untouched list makes them redo work for it — no error, no failing test, just a slower map.

## Outside this module, go through `USelection`

Import only from `src/selection`, and build or read selections only through `USelection` — never construct the per-kind object or index its arrays directly. ESLint blocks imports of the module's internal files and object literals with `asset` and `customerPoint` keys.

## Don't detach `USelection` methods

Methods call each other through `this`. Destructuring one (`const { isNone } = USelection`) or passing it bare as a callback (`ids.filter(USelection.isZoneSelected)`) type-checks, then throws at runtime.
