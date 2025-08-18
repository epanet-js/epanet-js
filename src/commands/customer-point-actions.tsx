import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { selectionAtom, dataAtom, modeAtom, Mode } from "src/state/jotai";
import { disconnectCustomers } from "src/hydraulic-model/model-operations";
import { usePersistence } from "src/lib/persistence/context";
import { useUserTracking } from "src/infra/user-tracking";

export const connectCustomersShortcut = "alt+c";
export const disconnectCustomersShortcut = "alt+d";

export const useConnectCustomerPoints = () => {
  const selection = useAtomValue(selectionAtom);
  const data = useAtomValue(dataAtom);
  const userTracking = useUserTracking();
  const setMode = useSetAtom(modeAtom);

  const connectCustomerPoints = useCallback(
    ({
      source: _source,
    }: {
      source: "shortcut" | "toolbar" | "context-menu";
    }) => {
      if (selection.type !== "singleCustomerPoint") return;

      const customerPoint = data.hydraulicModel.customerPoints.get(
        selection.id,
      );
      if (!customerPoint) return;

      const isReconnecting = customerPoint.connection !== null;
      const eventName = isReconnecting
        ? "customerPointActions.clickedReconnect"
        : "customerPointActions.clickedConnect";

      userTracking.capture({
        name: eventName,
        count: 1,
      });

      setMode({ mode: Mode.CONNECT_CUSTOMER_POINTS });
    },
    [selection, data, userTracking, setMode],
  );

  return connectCustomerPoints;
};

export const useDisconnectCustomerPoints = () => {
  const selection = useAtomValue(selectionAtom);
  const data = useAtomValue(dataAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();
  const userTracking = useUserTracking();

  const disconnectCustomerPoints = useCallback(
    ({
      source: _source,
    }: {
      source: "shortcut" | "toolbar" | "context-menu";
    }) => {
      if (selection.type !== "singleCustomerPoint") return;

      const customerPoint = data.hydraulicModel.customerPoints.get(
        selection.id,
      );
      if (!customerPoint) return;

      userTracking.capture({
        name: "customerPointActions.clickedDisconnect",
        count: 1,
      });

      const moment = disconnectCustomers(data.hydraulicModel, {
        customerPointIds: [customerPoint.id],
      });
      transact(moment);
    },
    [selection, data, transact, userTracking],
  );

  return disconnectCustomerPoints;
};
