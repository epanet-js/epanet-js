import { Link1Icon, LinkBreak1Icon } from "@radix-ui/react-icons";
import type {
  Action,
  ActionProps,
} from "src/components/context-actions/action-item";
import { ActionItem } from "./action-item";
import { useCallback } from "react";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { useAtomValue } from "jotai";
import { selectionAtom, dataAtom } from "src/state/jotai";
import { useTranslate } from "src/hooks/use-translate";
import {
  useConnectCustomerPoints,
  useDisconnectCustomerPoints,
  connectCustomersShortcut,
  disconnectCustomersShortcut,
} from "src/commands/customer-point-actions";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { Link2, Link2Off } from "lucide-react";

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

  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");

  const connectAction = {
    label: isReconnecting
      ? translate("contextActions.customerPoints.reconnect")
      : translate("contextActions.customerPoints.connect"),
    applicable: true,
    icon: isLucideIconsOn ? <Link2 size={16} /> : <Link1Icon />,
    onSelect: onConnect,
    shortcut: connectCustomersShortcut,
  };

  const disconnectAction = {
    label: translate("contextActions.customerPoints.disconnect"),
    applicable: customerPoint?.connection !== null,
    icon: isLucideIconsOn ? <Link2Off size={16} /> : <LinkBreak1Icon />,
    onSelect: onDisconnect,
    shortcut: disconnectCustomersShortcut,
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
