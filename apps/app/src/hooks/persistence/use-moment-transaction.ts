import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import type { Moment } from "src/lib/persistence/moment";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { modeAtom, MODE_INFO } from "src/state/mode";
import { trackMoment } from "src/lib/persistence/shared";
import { processMoment } from "src/lib/persistence/transaction-helpers";
import { toChangeSet } from "src/hydraulic-model/change-sets";
import type { ChangeSet } from "@epanet-js/change-set";
import { timedWithSync } from "@epanet-js/ejsdb";
import { captureWarning } from "src/infra/error-tracking";
import {
  findOrphanLinkConnections,
  findStoreInconsistencies,
  findTopologyConnectionMismatches,
  type OrphanLinkConnection,
} from "src/hydraulic-model/validate-moment-integrity";
import type { WriteFailureHandler } from "src/lib/persistence/write-queue";
import { useWriteFailureHandler } from "src/hooks/persistence/use-write-failure-handler";
import {
  commitChangeSet,
  isHistoryPending,
  rejectChange,
} from "src/hooks/persistence/use-model-transaction";

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

const transactWithChangeSet = (
  get: Getter,
  set: Setter,
  moment: Moment,
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
        records: built.size,
        bytes: built.byteLength,
      }),
    );
  } catch (error) {
    return rejectChange(set, error);
  }

  reportOrphanLinks(get, moment);

  trackMoment(moment);
  commitChangeSet(get, set, changeSet, onWriteFailure);

  reportAppliedIntegrity(get, moment);

  return true;
};

export const useMomentTransaction = () => {
  const onWriteFailure = useWriteFailureHandler();

  const transact = useAtomCallback(
    useCallback(
      (get: Getter, set: Setter, moment: Moment) => {
        if (isHistoryPending(get, moment.note)) return false;

        return transactWithChangeSet(get, set, moment, onWriteFailure);
      },
      [onWriteFailure],
    ),
  );

  return { transact };
};
