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
import { applyMomentToDb, buildMomentPayload } from "src/lib/db";
import type { ApplyMomentPayload } from "@epanet-js/ejsdb";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { captureError, captureWarning } from "src/infra/error-tracking";
import {
  findOrphanLinkConnections,
  findStoreInconsistencies,
  findTopologyConnectionMismatches,
  type OrphanLinkConnection,
} from "src/hydraulic-model/validate-moment-integrity";
import { writeQueue } from "src/lib/persistence/write-queue";
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
        const willPersist =
          worktree.activeBranchId === worktree.mainId && !isChangeSetsOn;

        let payload: ApplyMomentPayload | undefined;
        if (willPersist) {
          try {
            payload = buildMomentPayload(moment);
          } catch (error) {
            captureError(
              error instanceof Error ? error : new Error(String(error)),
            );
            set(dialogAtom, { type: "changeNotApplied" });
            return false;
          }
        }

        const orphanLinks = findOrphanLinkConnections(
          get(stagingModelDerivedAtom),
          moment,
        );
        if (orphanLinks.length > 0) {
          captureWarning(
            `Model integrity (orphan link connection)`,
            undefined,
            {
              "model operation": {
                ...buildOrphanReport(moment, orphanLinks),
                mode: MODE_INFO[get(modeAtom).mode].name,
              },
            },
          );
        }

        trackMoment(moment);
        const newStateId = nanoid();

        if (isChangeSetsOn) {
          const sessionHistory = get(sessionHistoryDerivedAtom).copy();
          const hydraulicModel = get(stagingModelDerivedAtom);
          const changeSet = toChangeSet(
            hydraulicModel,
            processMoment(moment, hydraulicModel),
          );

          applyChange(
            get,
            set,
            newStateId,
            changeSet,
            "forward",
            stagingModelDerivedAtom,
          );

          reportAppliedIntegrity(get, moment);

          sessionHistory.append(changeSet, newStateId);
          set(sessionHistoryDerivedAtom, sessionHistory);

          return true;
        }

        const momentLog = get(momentLogDerivedAtom).copy();

        const reverseMoment = applyMoment(
          get,
          set,
          newStateId,
          moment,
          stagingModelDerivedAtom,
        );

        reportAppliedIntegrity(get, moment);

        momentLog.append(moment, reverseMoment, newStateId);

        if (payload) {
          writeQueue.enqueue(() => applyMomentToDb(payload), onWriteFailure);
        }

        set(momentLogDerivedAtom, momentLog);

        return true;
      },
      [onWriteFailure, isChangeSetsOn],
    ),
  );

  return { transact };
};
