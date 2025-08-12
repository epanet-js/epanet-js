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

export function useCustomerPointActions(
  customerPoint: CustomerPoint | undefined,
  _source: ActionProps["as"],
): Action[] {
  const onConnect = useCallback(() => {
    return Promise.resolve();
  }, []);

  const onDisconnect = useCallback(() => {
    return Promise.resolve();
  }, []);

  const connectAction = {
    label: "Connect",
    applicable: customerPoint?.connection === null,
    icon: <Link1Icon />,
    onSelect: onConnect,
  };

  const disconnectAction = {
    label: "Disconnect",
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
