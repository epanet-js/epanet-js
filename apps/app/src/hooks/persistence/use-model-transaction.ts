import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { nanoid } from "nanoid";
import type { ChangeSet } from "@epanet-js/change-set";
import { timedSync } from "@epanet-js/ejsdb";
import {
  stagingModelDerivedAtom,
  sessionHistoryDerivedAtom,
} from "src/state/derived-branch-state";
import { worktreeAtom } from "src/state/scenarios";
import { modeAtom, MODE_INFO } from "src/state/mode";
import { historyPendingAtom } from "src/state/transactions";
import { applyChange } from "src/lib/persistence/transaction-helpers";
import { persistBranchChange } from "src/lib/persistence/persist-branch-change";
import { trackChangeSet } from "src/lib/persistence/shared";
import { captureError, captureWarning } from "src/infra/error-tracking";
import { dialogAtom } from "src/state/dialog";
import type { AssetId } from "@epanet-js/hydraulic-model";
import {
  findOrphanLinkConnections,
  findStoreInconsistencies,
  findTopologyConnectionMismatches,
  type OrphanLinkConnection,
} from "src/hydraulic-model/validate-change-set-integrity";
import {
  writeQueue,
  type WriteFailureHandler,
} from "src/lib/persistence/write-queue";
import { useWriteFailureHandler } from "src/hooks/persistence/use-write-failure-handler";

const maxReportedIds = 20;

const deletedAssetIds = (changeSet: ChangeSet): Set<AssetId> => {
  const ids = new Set<AssetId>();
  for (const entry of changeSet.entries()) {
    if (entry.kind === "delete") ids.add(entry.id as AssetId);
  }
  return ids;
};

const buildOrphanReport = (
  changeSet: ChangeSet,
  orphanLinks: OrphanLinkConnection[],
) => {
  const linkTypes = [...new Set(orphanLinks.map((o) => o.linkType))];
  const causes = [...new Set(orphanLinks.map((o) => o.cause))];
  const missingNodeIds = [
    ...new Set(orphanLinks.flatMap((o) => o.missingNodeIds)),
  ];
  const deletedByChangeSet = deletedAssetIds(changeSet);

  return {
    note: changeSet.name,
    linkType: linkTypes.length === 1 ? linkTypes[0] : linkTypes,
    cause: causes.length === 1 ? causes[0] : causes,
    orphanCount: orphanLinks.length,
    linkIds: orphanLinks.slice(0, maxReportedIds).map((o) => o.linkId),
    missingNodeIds: missingNodeIds.slice(0, maxReportedIds),
    missingNodesDeletedByMoment: missingNodeIds
      .filter((id) => deletedByChangeSet.has(id))
      .slice(0, maxReportedIds),
  };
};

const reportOrphanLinks = (get: Getter, changeSet: ChangeSet) => {
  const orphanLinks = findOrphanLinkConnections(
    get(stagingModelDerivedAtom),
    changeSet,
  );
  if (orphanLinks.length === 0) return;

  captureWarning(`Model integrity (orphan link connection)`, undefined, {
    "model operation": {
      ...buildOrphanReport(changeSet, orphanLinks),
      mode: MODE_INFO[get(modeAtom).mode].name,
    },
  });
};

const reportAppliedIntegrity = (get: Getter, changeSet: ChangeSet) => {
  const storeInconsistencies = findStoreInconsistencies(
    get(stagingModelDerivedAtom),
    changeSet,
  );
  if (storeInconsistencies.length > 0) {
    captureWarning(
      `Model integrity (store desync) after "${changeSet.name}": ` +
        storeInconsistencies
          .map(
            (i) =>
              `id=${i.id} kind=${i.kind} ` +
              `assets=${i.inAssets} index=${i.inAssetIndex} ` +
              `topology=${i.inTopology}`,
          )
          .join("; "),
    );
  }

  const connectionMismatches = findTopologyConnectionMismatches(
    get(stagingModelDerivedAtom),
    changeSet,
  );
  if (connectionMismatches.length > 0) {
    captureWarning(
      `Model integrity (topology desync) after "${changeSet.name}": ` +
        connectionMismatches
          .slice(0, maxReportedIds)
          .map(
            (m) =>
              `id=${m.linkId} assets=${m.assetConnections.join(",")} ` +
              `topology=${m.topologyConnections.join(",")}`,
          )
          .join("; "),
    );
  }
};

export const isHistoryPending = (get: Getter, note: string): boolean => {
  if (!get(historyPendingAtom)) return false;
  captureWarning(`Edit "${note}" rejected: a history action is pending`);
  return true;
};

export const rejectChange = (set: Setter, error: unknown): false => {
  captureError(error instanceof Error ? error : new Error(String(error)));
  set(dialogAtom, { type: "changeNotApplied" });
  return false;
};

export const commitChangeSet = (
  get: Getter,
  set: Setter,
  changeSet: ChangeSet,
  onWriteFailure: WriteFailureHandler,
): void => {
  const newStateId = nanoid();
  const sessionHistory = get(sessionHistoryDerivedAtom).copy();

  timedSync(
    "changeSet:apply",
    () =>
      applyChange(
        get,
        set,
        newStateId,
        changeSet,
        "forward",
        stagingModelDerivedAtom,
      ),
    { note: changeSet.name },
  );

  sessionHistory.append(changeSet, newStateId);
  set(sessionHistoryDerivedAtom, sessionHistory);

  const worktree = get(worktreeAtom);
  writeQueue.enqueue(
    () => persistBranchChange(worktree, changeSet, "forward"),
    onWriteFailure,
  );
};

export const useModelTransaction = () => {
  const onWriteFailure = useWriteFailureHandler();

  const transact = useAtomCallback(
    useCallback(
      (
        get: Getter,
        set: Setter,
        build: () => ChangeSet | null,
      ): ChangeSet | null => {
        let changeSet: ChangeSet | null;
        try {
          changeSet = build();
        } catch (error) {
          rejectChange(set, error);
          return null;
        }
        if (!changeSet) return null;

        if (isHistoryPending(get, changeSet.name)) return null;

        reportOrphanLinks(get, changeSet);

        trackChangeSet(changeSet);
        commitChangeSet(get, set, changeSet, onWriteFailure);

        reportAppliedIntegrity(get, changeSet);
        return changeSet;
      },
      [onWriteFailure],
    ),
  );

  return { transact };
};
