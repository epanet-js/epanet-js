# @epanet-js/worktree

The vocabulary for the set of branches a project is edited through, and the
contract an implementation of branch operations registers against.

It is a **no-build source package** — the `.ts` is consumed directly by the
importing app's bundler (the same convention as the other `@epanet-js/*`
workspace libraries). It has no dependencies.

## What it holds

- **`Worktree` / `Branch`** — a project's branches, which branch is active, and
  which one is main. `initializeWorktree()` returns a worktree containing only
  main, which is the shape an app that edits a single model stays in.
- **`BranchingRules`** — the interface for creating, switching, renaming and
  deleting branches other than main. It is deliberately not tied to one kind of
  branch: an implementation decides where a new branch comes from, how it is
  named, what happens to main while it exists, and which branch succeeds a
  deleted one. Every method takes a worktree and returns the next one, plus the
  branch the caller should act on (`created`, `activated`, `nextActive`). An
  implementation holds no state and reaches nothing outside the worktree, so
  what the host does in response — seeding a branch's state, activating it,
  dropping it — stays with the host. The default export `nullBranchingRules`
  implements the interface as no-ops with `isAvailable: false`, so an app with
  no implementation registered keeps a main-only worktree.

  Note that `Worktree` still names its non-main branches `scenarios` and counts
  them with `highestScenarioNumber`. That is the vocabulary of the only
  implementation today; a second kind of branching would need those fields
  generalised.

## Usage

```ts
import {
  initializeWorktree,
  nullBranchingRules,
  type BranchingRules,
} from "@epanet-js/worktree";

let rules: BranchingRules = nullBranchingRules;

const { worktree: next, created } = rules.createBranch(worktree);
if (created) {
  // the host seeds and activates `created`, then commits `next`
}
```
