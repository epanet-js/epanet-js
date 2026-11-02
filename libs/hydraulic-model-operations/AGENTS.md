# @epanet-js/hydraulic-model-operations

The operations that change a `HydraulicModel`, and the change-set builder and
applier they rely on.

## Operations build change sets

An operation is a pure function `(model, data) => ChangeSet`. It reads the
model, builds intents, and never mutates. How intents resolve, why they must all
read the same unmutated model, and how a change set is applied and reversed is
in [`src/change-sets/AGENTS.md`](./src/change-sets/AGENTS.md).

Stateful creation concerns — `AssetFactory`, `CustomerPointFactory`,
`LabelManager` — are not part of `HydraulicModel` (the app keeps them in
`modelFactoriesAtom`), and reach an operation through its `data` argument. Do
not widen the `ModelOperation` signature to carry them: only the operations that
create something need one, and every caller would otherwise have to hold them.
