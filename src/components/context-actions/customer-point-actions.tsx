import type {
  Action,
  ActionProps,
} from "src/components/context-actions/action-item";
import { ActionItem } from "./action-item";
import { useCallback } from "react";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { useAtomValue } from "jotai";
import { selectionAtom, stagingModelAtom } from "src/state/jotai";
import { useTranslate } from "src/hooks/use-translate";
import {
  useConnectCustomerPoints,
  useDisconnectCustomerPoints,
  connectCustomersShortcut,
  disconnectCustomersShortcut,
} from "src/commands/customer-point-actions";
import { ConnectIcon, DisconnectIcon } from "src/icons";

export function useCustomerPointActions(
  customerPoint: CustomerPoint | undefined,
  source: ActionProps["as"],
): Action[] {
  const translate = useTranslate();
  const connectCustomerPoints = useConnectCustomerPoints();
  const disconnectCustomerPoints = useDisconnectCustomerPoints();

  const isReconnecting = customerPoint?.connection !== null;

  const onConnect = useCallback(() => {
    if (!customerPoint) return Promise.resolve();

    const eventSource = source === "context-item" ? "context-menu" : "toolbar";
    connectCustomerPoints({ source: eventSource });
    return Promise.resolve();
  }, [customerPoint, connectCustomerPoints, source]);

  const onDisconnect = useCallback(() => {
    if (!customerPoint) return Promise.resolve();

    const eventSource = source === "context-item" ? "context-menu" : "toolbar";
    disconnectCustomerPoints({ source: eventSource });
    return Promise.resolve();
  }, [customerPoint, disconnectCustomerPoints, source]);

  const connectAction = {
    label: isReconnecting
      ? translate("contextActions.customerPoints.reconnect")
      : translate("contextActions.customerPoints.connect"),
    applicable: true,
    icon: <ConnectIcon />,
    onSelect: onConnect,
    shortcut: connectCustomersShortcut,
  };

  const disconnectAction = {
    label: translate("contextActions.customerPoints.disconnect"),
    applicable: customerPoint?.connection !== null,
    icon: <DisconnectIcon />,
    onSelect: onDisconnect,
    shortcut: disconnectCustomersShortcut,
  };

  return [connectAction, disconnectAction];
}

export function CustomerPointActions({ as }: { as: ActionProps["as"] }) {
  const selection = useAtomValue(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelAtom);

  const customerPoint =
    selection.type === "singleCustomerPoint"
      ? hydraulicModel.customerPoints.get(selection.id)
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
