import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import {
  selectionAtom,
  modeAtom,
  Mode,
  stagingModelAtom,
} from "src/state/jotai";
import { disconnectCustomers } from "src/hydraulic-model/model-operations";
import { usePersistence } from "src/lib/persistence";
import { useUserTracking } from "src/infra/user-tracking";

export const connectCustomersShortcut = "shift+c";
export const disconnectCustomersShortcut = "shift+d";

export const useConnectCustomerPoints = () => {
  const selection = useAtomValue(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const userTracking = useUserTracking();
  const setMode = useSetAtom(modeAtom);

  const connectCustomerPoints = useCallback(
    ({ source }: { source: "shortcut" | "toolbar" | "context-menu" }) => {
      if (selection.type !== "singleCustomerPoint") return;

      const customerPoint = hydraulicModel.customerPoints.get(selection.id);
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
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();
  const userTracking = useUserTracking();

  const disconnectCustomerPoints = useCallback(
    ({ source }: { source: "shortcut" | "toolbar" | "context-menu" }) => {
      if (selection.type !== "singleCustomerPoint") return;

      const customerPoint = hydraulicModel.customerPoints.get(selection.id);
      if (!customerPoint) return;

      userTracking.capture({
        name: "customerPointActions.disconnected",
        count: 1,
        source,
      });

      const moment = disconnectCustomers(hydraulicModel, {
        customerPointIds: [customerPoint.id],
      });
      transact(moment);
    },
    [selection, hydraulicModel, transact, userTracking],
  );

  return disconnectCustomerPoints;
};
