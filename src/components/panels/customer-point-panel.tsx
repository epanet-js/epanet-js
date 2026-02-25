import { useAtomValue } from "jotai";
import { selectionAtom, stagingModelAtom } from "src/state/jotai";
import { useCustomerPointActions } from "src/components/context-actions/customer-point-actions";
import { ActionButton } from "src/components/panels/asset-panel/actions/action-button";
import { Section } from "src/components/form/fields";
import { TextRow } from "src/components/panels/asset-panel/ui-components";
import { useTranslate } from "src/hooks/use-translate";

export function CustomerPointPanel() {
  const selection = useAtomValue(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const translate = useTranslate();

  const customerPoint =
    selection.type === "singleCustomerPoint"
      ? hydraulicModel.customerPoints.get(selection.id)
      : undefined;

  const actions = useCustomerPointActions(customerPoint, "root");

  if (!customerPoint) return null;

  const connection = customerPoint.connection;
  const pipe = connection ? hydraulicModel.assets.get(connection.pipeId) : null;
  const junction = connection
    ? hydraulicModel.assets.get(connection.junctionId)
    : null;

  return (
    <div className="flex flex-col flex-grow overflow-hidden">
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
      <div className="flex flex-col gap-3 p-4">
        <Section title={translate("connections")}>
          <TextRow name="pipe" value={pipe ? pipe.label : ""} />
          <TextRow name="junction" value={junction ? junction.label : ""} />
        </Section>
      </div>
    </div>
  );
}
