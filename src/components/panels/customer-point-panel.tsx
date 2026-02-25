import { useAtomValue } from "jotai";
import { selectionAtom, stagingModelAtom } from "src/state/jotai";
import { useCustomerPointActions } from "src/components/context-actions/customer-point-actions";
import { ActionButton } from "src/components/panels/asset-panel/actions/action-button";

export function CustomerPointPanel() {
  const selection = useAtomValue(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelAtom);

  const customerPoint =
    selection.type === "singleCustomerPoint"
      ? hydraulicModel.customerPoints.get(selection.id)
      : undefined;

  const actions = useCustomerPointActions(customerPoint, "root");

  if (!customerPoint) return null;

  return (
    <div className="px-3 pt-4 pb-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold p-1 truncate">
          {customerPoint.label}
        </span>
        <div className="flex gap-1 h-8 shrink-0">
          {actions
            .filter((action) => action.applicable)
            .map((action, i) => (
              <ActionButton key={i} action={action} />
            ))}
        </div>
      </div>
      <span className="text-sm text-gray-500 pl-1">Customer</span>
    </div>
  );
}
