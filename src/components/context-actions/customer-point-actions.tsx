import { Link1Icon, LinkBreak1Icon } from "@radix-ui/react-icons";
import type {
  Action,
  ActionProps,
} from "src/components/context-actions/action-item";
import { ActionItem } from "./action-item";
import { useCallback } from "react";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { useAtomValue, useSetAtom } from "jotai";
import { selectionAtom, dataAtom, modeAtom, Mode } from "src/state/jotai";
import { disconnectCustomers } from "src/hydraulic-model/model-operations";
import { usePersistence } from "src/lib/persistence/context";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";

export function useCustomerPointActions(
  customerPoint: CustomerPoint | undefined,
  _source: ActionProps["as"],
): Action[] {
  const { hydraulicModel } = useAtomValue(dataAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const setMode = useSetAtom(modeAtom);

  const isReconnecting = customerPoint?.connection !== null;

  const onConnect = useCallback(() => {
    if (!customerPoint) return Promise.resolve();

    const eventName = isReconnecting
      ? "customerPointActions.clickedReconnect"
      : "customerPointActions.clickedConnect";

    userTracking.capture({
      name: eventName,
      count: 1,
    });

    setMode({ mode: Mode.CONNECT_CUSTOMER_POINTS });
    return Promise.resolve();
  }, [customerPoint, userTracking, setMode, isReconnecting]);

  const onDisconnect = useCallback(() => {
    if (!customerPoint) return Promise.resolve();

    userTracking.capture({
      name: "customerPointActions.clickedDisconnect",
      count: 1,
    });

    const moment = disconnectCustomers(hydraulicModel, {
      customerPointIds: [customerPoint.id],
    });
    transact(moment);
    return Promise.resolve();
  }, [customerPoint, hydraulicModel, transact, userTracking]);

  const connectAction = {
    label: isReconnecting
      ? translate("contextActions.customerPoints.reconnect")
      : translate("contextActions.customerPoints.connect"),
    applicable: true,
    icon: <Link1Icon />,
    onSelect: onConnect,
  };

  const disconnectAction = {
    label: translate("contextActions.customerPoints.disconnect"),
    applicable: customerPoint?.connection !== null,
    icon: <LinkBreak1Icon />,
    onSelect: onDisconnect,
  };

  return [connectAction, disconnectAction];
}

export function CustomerPointActions({ as }: { as: ActionProps["as"] }) {
  const selection = useAtomValue(selectionAtom);
  const data = useAtomValue(dataAtom);

  const customerPoint =
    selection.type === "singleCustomerPoint"
      ? data.hydraulicModel.customerPoints.get(selection.id)
      : undefined;

  const actions = useCustomerPointActions(customerPoint, as);

  if (selection.type !== "singleCustomerPoint") return null;

  return (
    <>
      {actions
        .filter((action) => action.applicable)
        .map((action, i) => (
          <ActionItem as={as} key={i} action={action} />
        ))}
    </>
  );
}
