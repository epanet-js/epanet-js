# selection module

The current selection state — what the user has clicked/lassoed on the map or
in the data grid. A discriminated union (`Sel`) plus a namespace of helpers
(`USelection`) that operate on it. Selection lives on `dataAtom`, exposed via
`selectionAtom` / `selectedFeaturesAtom`.

## Naming: `Sel`, not `Selection`

The type is **deliberately** abbreviated. `window.Selection` is a built-in DOM
type; if you call it `Selection` and forget to import, TypeScript happily
resolves it to the DOM one and you get bizarre downstream errors. Keep the
`Sel*` prefix on every variant and the `USelection` namespace name. Don't
"clean this up."

## The `Sel` union — what each variant represents

- **`{ type: "none" }`** — nothing selected.
- **`SelSingle`** — one entity. Carries `kind: Category` (currently `"asset"`
  or `"customerPoint"`) and a numeric `id`. Both kinds share this shape; the
  `kind` discriminant tells you which map (`assets` or `customerPoints`) to
  look the id up in.
- **`SelMulti`** — many entities, bucketed by kind:
  `ids: { asset?: number[]; customerPoint?: number[] }`. A multi-selection
  can hold both assets and customer points at once (heterogeneous).

`Category` is the extensible enum of selectable entity kinds. To add a new
kind (e.g. `"zone"`) you change one line in [types.ts](./types.ts) and the
multi-selection bucket shape generalises automatically.

## Encapsulation: outside this module, talk to `USelection` only

External code (anywhere outside `src/selection/`) MUST NOT:

- Import sub-types like `SelMulti` / `SelSingle`. Only `Sel` and `Category`
  are re-exported from `src/selection`. Sub-types are deliberately hidden.
- Construct `Sel` literals — e.g. `{ type: "single", kind: "asset", id }`,
  `{ type: "multi", ids: { ... } }`, `setSelection({ type: "none" })`. Use
  the USelection constructors: `USelection.none()`, `USelection.single(id)`,
  `USelection.singleCustomerPoint(id)`, `USelection.fromIds(assetIds)`,
  `USelection.fromKindedIds(assetIds, cpIds)`.
- Destructure `Sel` shape — `selection.type === "..."`, `selection.ids`,
  `selection.kind`, `selection.id`. Use predicates and accessors:
  `USelection.isNone`, `isSingleAsset`, `isSingleCustomerPoint`,
  `getAssetIds`, `getCustomerPointIds`, `countByKind`, `isSelected`,
  `isCustomerPointSelected`, `describe` (for logs/telemetry).

These rules are enforced by ESLint
([.eslintrc.js](../../.eslintrc.js)): `no-restricted-imports` blocks
imports of `src/selection/types` (and `src/selection/selection`,
`src/selection/use-selection`) from outside the module, and a
`no-restricted-syntax` rule blocks `{ type: "single" | "multi", ... }`
object literals. Test files, `src/__helpers__/**`, and the selection
module itself are exempt via overrides.

## `USelection` is a namespace object, not a class

`USelection` is a plain object with methods, called as `USelection.fn(sel, …)`.
Inside, methods call peers via `this.fn(…)`. Don't refactor it into a class
or split it into free functions — call sites (a lot of them, throughout the
app) rely on this shape.

## Switch on `selection.type` exhaustively (inside the module)

When you add or modify a `Sel` variant, **every switch on `selection.type` in
this file must handle it**. TypeScript catches most of these via
exhaustiveness; audit any `default` branches by hand. Targets when extending:
`getAssetIds`, `getCustomerPointIds`, `getSelectedFeatures`, `isSelected`,
`removeFeatureFromSelection`, `clearInvalidIds`, `asSingle`, `describe`.

## `SELECTION_NONE` is a shared singleton

`SELECTION_NONE` is a single shared `{ type: "none" }` object, exported
alongside `USelection`. Operations that "clear" the selection return this
singleton so referential-equality checks in React/Jotai selectors stay
cheap. Don't construct new `{ type: "none" }` literals ad hoc — use
`USelection.none()`.

## Upcoming feature: selection sets

A planned feature: the user can save the current selection under a name and
recall it later ("Critical Pumps", "North Zone", etc.).

**Confirmed design constraints** (these are decided, not open):

1. **Membership is many-to-many.** One asset can belong to multiple saved
   sets at once.
2. **Customer points participate too.** A saved set holds both asset ids and
   customer-point ids; the data shape must accommodate both, not just assets.
3. **Sets are separate state.** The store will be something along the lines of
   `Map<setId, { name, assetIds: Set<number>, customerPointIds: Set<number> }>`,
   sitting alongside the hydraulic model — *not* a property on individual
   assets/customer points.

**Implications for this module when the feature lands:**

- Add a new `Sel` variant (working name: `SelSavedSet { type: "savedSet";
  id: string }`) for "the user has activated a saved set."
- `getAssetIds` and `getSelectedFeatures` will need a branch that resolves
  the set id → its stored asset ids.
- Add `USelection.savedSet(id)` / `isSavedSet(sel)` constructors and
  predicates — keep all branching inside this module.
- Keep customer-point ids on a separate access path inside the saved-set
  branch — don't try to unify them with asset ids in a single list.
