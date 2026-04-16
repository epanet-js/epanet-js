import type { IPersistenceWithSnapshots } from "src/lib/persistence/ipersistence";
import { worktreeAtom } from "src/state/scenarios";
import { type SimulationState } from "src/state/simulation";
import { Store } from "src/state";

export class Persistence implements IPersistenceWithSnapshots {
  private store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  syncSnapshotSimulation(
    simulation: SimulationState,
    options?: { updateSourceId?: boolean },
  ): void {
    const worktree = this.store.get(worktreeAtom);
    const snapshot = worktree.snapshots.get(worktree.activeSnapshotId);
    if (!snapshot) return;

    const updatedSnapshots = new Map(worktree.snapshots);
    updatedSnapshots.set(worktree.activeSnapshotId, {
      ...snapshot,
      simulation,
      ...(options?.updateSourceId && {
        simulationSourceId: worktree.activeSnapshotId,
      }),
    });

    this.store.set(worktreeAtom, { ...worktree, snapshots: updatedSnapshots });
  }
}
