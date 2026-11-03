import type {
  Action,
  ActionProps,
} from "src/components/context-actions/action-item";
import { useCallback } from "react";
import { CustomerPoint } from "@epanet-js/hydraulic-model";
import { useTranslate } from "src/hooks/use-translate";
import {
  useConnectCustomerPoints,
  useDisconnectCustomerPoints,
  connectCustomersShortcut,
  disconnectCustomersShortcut,
} from "src/commands/customer-point-actions";
import { ConnectIcon, DisconnectIcon, DeleteIcon } from "src/icons";
import { useDeleteSelection } from "src/commands/delete-selection";
import { useIsDrawingAvailable } from "src/hooks/use-is-drawing-available";

export function useCustomerPointActions(
  customerPoint: CustomerPoint | undefined,
  source: ActionProps["as"],
): Action[] {
  const translate = useTranslate();
  const connectCustomerPoints = useConnectCustomerPoints();
  const disconnectCustomerPoints = useDisconnectCustomerPoints();
  const deleteSelection = useDeleteSelection();
  const isDrawingAvailable = useIsDrawingAvailable();

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
    applicable: isDrawingAvailable,
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

  const onDelete = useCallback(() => {
    if (!customerPoint) return Promise.resolve();

    const eventSource = source === "context-item" ? "context-menu" : "toolbar";
    deleteSelection({ source: eventSource });
    return Promise.resolve();
  }, [customerPoint, deleteSelection, source]);

  const deleteAction: Action = {
    label: translate("delete"),
    applicable: true,
    priority: 1,
    variant: "danger-quiet",
    icon: <DeleteIcon />,
    onSelect: onDelete,
  };

  return [connectAction, disconnectAction, deleteAction];
}
