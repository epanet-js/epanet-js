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
import { customAttributesDefinitionAtom } from "src/state/custom-attributes";
import { getAttributeIds } from "@epanet-js/custom-attributes";
import type { ApplyMomentPayload } from "@epanet-js/ejsdb";
import { captureError, captureWarning } from "src/infra/error-tracking";
import {
  findOrphanLinkConnections,
  findStoreInconsistencies,
} from "src/hydraulic-model/validate-moment-integrity";

export const useModelTransaction = () => {
  const transact = useAtomCallback(
    useCallback((get: Getter, set: Setter, moment: Moment) => {
      const momentLog = get(momentLogDerivedAtom).copy();
      const mapSyncMoment = get(mapSyncMomentAtom);
      const isTruncatingHistory = momentLog.nextRedo() !== null;

      const worktree = get(worktreeAtom);
      const willPersist = worktree.activeBranchId === worktree.mainId;

      let payload: ApplyMomentPayload | undefined;
      if (willPersist) {
        try {
          payload = buildMomentPayload(
            moment,
            getAttributeIds(get(customAttributesDefinitionAtom)),
          );
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
        const linkTypes = [...new Set(orphanLinks.map((o) => o.linkType))];
        const causes = [...new Set(orphanLinks.map((o) => o.cause))];
        captureWarning(`Model integrity (orphan link connection)`, undefined, {
          "model operation": {
            note: moment.note,
            mode: MODE_INFO[get(modeAtom).mode].name,
            linkType: linkTypes.length === 1 ? linkTypes[0] : linkTypes,
            cause: causes.length === 1 ? causes[0] : causes,
          },
        });
      }

      trackMoment(moment);
      const newStateId = nanoid();

      const reverseMoment = applyMoment(
        get,
        set,
        newStateId,
        moment,
        stagingModelDerivedAtom,
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

      if (payload) {
        void applyMomentToDb(payload).catch(captureError);
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
    }, []),
  );

  return { transact };
};
