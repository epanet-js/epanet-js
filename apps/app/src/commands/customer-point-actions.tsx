import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { modeAtom, Mode } from "src/state/mode";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import {
  disconnectCustomers,
  disconnectCustomersDeprecated,
} from "src/hydraulic-model/model-operations";
import { useUserTracking } from "src/infra/user-tracking";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const connectCustomersShortcut = "shift+c";
export const disconnectCustomersShortcut = "shift+d";

export const useConnectCustomerPoints = () => {
  const selection = useAtomValue(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const userTracking = useUserTracking();
  const setMode = useSetAtom(modeAtom);

  const connectCustomerPoints = useCallback(
    ({ source }: { source: "shortcut" | "toolbar" | "context-menu" }) => {
      const selectedCustomerPointId =
        USelection.singleCustomerPointId(selection);
      if (selectedCustomerPointId === null) return;

      const customerPoint = hydraulicModel.customerPoints.get(
        selectedCustomerPointId,
      );
      if (!customerPoint) return;

      const isReconnecting = customerPoint.connection !== null;
      const eventName = isReconnecting
        ? "customerPointActions.reconnectStarted"
        : "customerPointActions.connectStarted";

      userTracking.capture({
        name: eventName,
        count: 1,
        source,
      });

      setMode({ mode: Mode.CONNECT_CUSTOMER_POINTS });
    },
    [selection, hydraulicModel, userTracking, setMode],
  );

  return connectCustomerPoints;
};

export const useDisconnectCustomerPoints = () => {
  const selection = useAtomValue(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { transact } = useMomentTransaction();
  const { transact: transactChangeSet } = useModelTransaction();
  const isOpsChangeSetsOn = useFeatureFlag("FLAG_OPS_CHANGE_SETS");
  const userTracking = useUserTracking();

  const disconnectCustomerPoints = useCallback(
    ({ source }: { source: "shortcut" | "toolbar" | "context-menu" }) => {
      const customerPointIds = USelection.getCustomerPointIds(selection);

      userTracking.capture({
        name: "customerPointActions.disconnected",
        count: customerPointIds.length,
        source,
      });

      if (isOpsChangeSetsOn) {
        transactChangeSet(() =>
          disconnectCustomers(hydraulicModel, { customerPointIds }),
        );
      } else {
        transact(
          disconnectCustomersDeprecated(hydraulicModel, { customerPointIds }),
        );
      }
    },
    [
      selection,
      hydraulicModel,
      isOpsChangeSetsOn,
      transact,
      transactChangeSet,
      userTracking,
    ],
  );

  return disconnectCustomerPoints;
};
