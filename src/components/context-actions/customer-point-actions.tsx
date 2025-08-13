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
import { disconnectCustomers } from "src/hydraulic-model/model-operations";
import { usePersistence } from "src/lib/persistence/context";
import { useTranslate } from "src/hooks/use-translate";

export function useCustomerPointActions(
  customerPoint: CustomerPoint | undefined,
  _source: ActionProps["as"],
): Action[] {
  const { hydraulicModel } = useAtomValue(dataAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();
  const translate = useTranslate();

  const onConnect = useCallback(() => {
    return Promise.resolve();
  }, []);

  const onDisconnect = useCallback(() => {
    if (!customerPoint) return Promise.resolve();

    const moment = disconnectCustomers(hydraulicModel, {
      customerPointIds: [customerPoint.id],
    });
    transact(moment);
    return Promise.resolve();
  }, [customerPoint, hydraulicModel, transact]);

  const connectAction = {
    label: translate("contextActions.customerPoints.connect"),
    applicable: customerPoint?.connection === null,
    icon: <Link1Icon />,
    onSelect: onConnect,
  };

  const disconnectAction = {
    label: translate("contextActions.customerPoints.disconnect"),
    applicable: customerPoint?.connection !== null,
    icon: <LinkBreak1Icon />,
    onSelect: onDisconnect,
    variant: "danger-quiet",
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
