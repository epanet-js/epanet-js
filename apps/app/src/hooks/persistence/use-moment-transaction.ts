import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { nanoid } from "nanoid";
import type { Moment } from "src/lib/persistence/moment";
import { mapSyncMomentAtom } from "src/state/map";
import {
  stagingModelDerivedAtom,
  momentLogDerivedAtom,
} from "src/state/derived-branch-state";
import { worktreeAtom } from "src/state/scenarios";
import { dialogAtom } from "src/state/dialog";
import { modeAtom, MODE_INFO } from "src/state/mode";
import { trackMoment } from "src/lib/persistence/shared";
import {
  applyMoment,
  computeSyncMoment,
} from "src/lib/persistence/transaction-helpers";
import { applyMomentToDb, buildMomentPayload } from "src/lib/db";
import type { ApplyMomentPayload } from "@epanet-js/ejsdb";
import { captureError, captureWarning } from "src/infra/error-tracking";
import { handleError } from "src/infra/errors";
import { opfsUnavailableErrors } from "src/infra/storage";
import {
  findOrphanLinkConnections,
  findStoreInconsistencies,
  findTopologyConnectionMismatches,
  type OrphanLinkConnection,
} from "src/hydraulic-model/validate-moment-integrity";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
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

export const useMomentTransaction = () => {
  const isQueueOn = useFeatureFlag("FLAG_TRANSACTIONS_QUEUE");
  const isChangeTrackerOn = useFeatureFlag("FLAG_CHANGE_TRACKER");
  const onWriteFailure = useWriteFailureHandler();

  const transact = useAtomCallback(
    useCallback(
      (get: Getter, set: Setter, moment: Moment) => {
        const momentLog = get(momentLogDerivedAtom).copy();
        const mapSyncMoment = get(mapSyncMomentAtom);
        const isTruncatingHistory = momentLog.nextRedo() !== null;

        const worktree = get(worktreeAtom);
        const willPersist = worktree.activeBranchId === worktree.mainId;

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

        const reverseMoment = applyMoment(
          get,
          set,
          newStateId,
          moment,
          stagingModelDerivedAtom,
          isChangeTrackerOn,
        );

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

        if (payload) {
          if (isQueueOn) {
            writeQueue.enqueue(() => applyMomentToDb(payload), onWriteFailure);
          } else {
            void applyMomentToDb(payload).catch((error) =>
              handleError(error, {
                as: "Moment transaction: db write failed",
                warn: opfsUnavailableErrors,
                onUnexpected: "capture",
              }),
            );
          }
        }

        momentLog.append(moment, reverseMoment, newStateId);

        const newMapSyncMoment = computeSyncMoment(
          mapSyncMoment,
          momentLog,
          isTruncatingHistory,
        );

        set(momentLogDerivedAtom, momentLog);
        set(mapSyncMomentAtom, newMapSyncMoment);

        return true;
      },
      [isQueueOn, isChangeTrackerOn, onWriteFailure],
    ),
  );

  return { transact };
};
