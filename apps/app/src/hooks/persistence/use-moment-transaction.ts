import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { nanoid } from "nanoid";
import type { Moment } from "src/lib/persistence/moment";
import {
  stagingModelDerivedAtom,
  momentLogDerivedAtom,
  sessionHistoryDerivedAtom,
} from "src/state/derived-branch-state";
import { worktreeAtom } from "src/state/scenarios";
import { historyPendingAtom } from "src/state/transactions";
import { dialogAtom } from "src/state/dialog";
import { modeAtom, MODE_INFO } from "src/state/mode";
import { trackMoment } from "src/lib/persistence/shared";
import {
  applyChange,
  applyMoment,
  processMoment,
} from "src/lib/persistence/transaction-helpers";
import { toChangeSet } from "src/hydraulic-model/change-sets";
import type { ChangeSet } from "@epanet-js/change-set";
import { timedSync, timedWithSync } from "@epanet-js/ejsdb";
import {
  applyChangeSetToDb,
  applyMomentToDb,
  buildMomentPayload,
} from "src/lib/db";
import type { ApplyMomentPayload } from "@epanet-js/ejsdb";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { captureError, captureWarning } from "src/infra/error-tracking";
import {
  findOrphanLinkConnections,
  findStoreInconsistencies,
  findTopologyConnectionMismatches,
  type OrphanLinkConnection,
} from "src/hydraulic-model/validate-moment-integrity";
import {
  writeQueue,
  type WriteFailureHandler,
} from "src/lib/persistence/write-queue";
import { useWriteFailureHandler } from "src/hooks/persistence/use-write-failure-handler";

const maxReportedIds = 20;

const buildOrphanReport = (
  moment: Moment,
  orphanLinks: OrphanLinkConnection[],
) => {
  const linkTypes = [...new Set(orphanLinks.map((o) => o.linkType))];
  const causes = [...new Set(orphanLinks.map((o) => o.cause))];
  const missingNodeIds = [
    ...new Set(orphanLinks.flatMap((o) => o.missingNodeIds)),
  ];
  const deletedByMoment = new Set(moment.deleteAssets ?? []);

  return {
    note: moment.note,
    linkType: linkTypes.length === 1 ? linkTypes[0] : linkTypes,
    cause: causes.length === 1 ? causes[0] : causes,
    orphanCount: orphanLinks.length,
    linkIds: orphanLinks.slice(0, maxReportedIds).map((o) => o.linkId),
    missingNodeIds: missingNodeIds.slice(0, maxReportedIds),
    missingNodesDeletedByMoment: missingNodeIds
      .filter((id) => deletedByMoment.has(id))
      .slice(0, maxReportedIds),
  };
};

const reportAppliedIntegrity = (get: Getter, moment: Moment) => {
  const storeInconsistencies = findStoreInconsistencies(
    get(stagingModelDerivedAtom),
    moment,
  );
  if (storeInconsistencies.length > 0) {
    captureWarning(
      `Model integrity (store desync) after "${moment.note}": ` +
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
    moment,
  );
  if (connectionMismatches.length > 0) {
    captureWarning(
      `Model integrity (topology desync) after "${moment.note}": ` +
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

const reportOrphanLinks = (get: Getter, moment: Moment) => {
  const orphanLinks = findOrphanLinkConnections(
    get(stagingModelDerivedAtom),
    moment,
  );
  if (orphanLinks.length === 0) return;

  captureWarning(`Model integrity (orphan link connection)`, undefined, {
    "model operation": {
      ...buildOrphanReport(moment, orphanLinks),
      mode: MODE_INFO[get(modeAtom).mode].name,
    },
  });
};

const rejectChange = (set: Setter, error: unknown): false => {
  captureError(error instanceof Error ? error : new Error(String(error)));
  set(dialogAtom, { type: "changeNotApplied" });
  return false;
};

const transactWithChangeSet = (
  get: Getter,
  set: Setter,
  moment: Moment,
  willPersist: boolean,
  onWriteFailure: WriteFailureHandler,
): boolean => {
  let changeSet: ChangeSet;
  try {
    const hydraulicModel = get(stagingModelDerivedAtom);
    changeSet = timedWithSync(
      "changeSet:build",
      () => toChangeSet(hydraulicModel, processMoment(moment, hydraulicModel)),
      (built) => ({
        note: moment.note,
        records: built.records.length,
        bytes: built.byteLength,
      }),
    );
  } catch (error) {
    return rejectChange(set, error);
  }

  reportOrphanLinks(get, moment);

  trackMoment(moment);
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
    { note: moment.note },
  );

  reportAppliedIntegrity(get, moment);

  sessionHistory.append(changeSet, newStateId);
  set(sessionHistoryDerivedAtom, sessionHistory);

  if (willPersist) {
    writeQueue.enqueue(
      () => applyChangeSetToDb(changeSet, "forward"),
      onWriteFailure,
    );
  }

  return true;
};

const transactWithMoment = (
  get: Getter,
  set: Setter,
  moment: Moment,
  willPersist: boolean,
  onWriteFailure: WriteFailureHandler,
): boolean => {
  let payload: ApplyMomentPayload | undefined;
  if (willPersist) {
    try {
      payload = timedSync("moment:build", () => buildMomentPayload(moment), {
        note: moment.note,
      });
    } catch (error) {
      return rejectChange(set, error);
    }
  }

  reportOrphanLinks(get, moment);

  trackMoment(moment);
  const newStateId = nanoid();
  const momentLog = get(momentLogDerivedAtom).copy();

  const reverseMoment = timedSync(
    "moment:apply",
    () => applyMoment(get, set, newStateId, moment, stagingModelDerivedAtom),
    { note: moment.note },
  );

  reportAppliedIntegrity(get, moment);

  momentLog.append(moment, reverseMoment, newStateId);

  if (payload) {
    writeQueue.enqueue(() => applyMomentToDb(payload), onWriteFailure);
  }

  set(momentLogDerivedAtom, momentLog);

  return true;
};

export const useMomentTransaction = () => {
  const onWriteFailure = useWriteFailureHandler();
  const isChangeSetsOn = useFeatureFlag("FLAG_CHANGE_SETS");

  const transact = useAtomCallback(
    useCallback(
      (get: Getter, set: Setter, moment: Moment) => {
        if (get(historyPendingAtom)) {
          captureWarning(
            `Edit "${moment.note}" rejected: a history action is pending`,
          );
          return false;
        }

        const worktree = get(worktreeAtom);
        const willPersist = worktree.activeBranchId === worktree.mainId;

        return isChangeSetsOn
          ? transactWithChangeSet(get, set, moment, willPersist, onWriteFailure)
          : transactWithMoment(get, set, moment, willPersist, onWriteFailure);
      },
      [onWriteFailure, isChangeSetsOn],
    ),
  );

  return { transact };
};
