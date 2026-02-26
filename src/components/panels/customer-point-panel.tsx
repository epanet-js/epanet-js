import { useCallback, useMemo } from "react";
import { useAtomValue } from "jotai";
import { Maybe } from "purify-ts/Maybe";
import { dataAtom, selectionAtom, stagingModelAtom } from "src/state/jotai";
import { useCustomerPointActions } from "src/components/context-actions/customer-point-actions";
import { ActionButton } from "src/components/panels/asset-panel/actions/action-button";
import { Section } from "src/components/form/fields";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { ZoomToIcon } from "src/icons";
import { BBox } from "src/types";
import {
  TextRow,
  QuantityRow,
} from "src/components/panels/asset-panel/ui-components";
import { DemandCategoriesEditor } from "src/components/panels/asset-panel/demands-editor";
import { useTranslate } from "src/hooks/use-translate";
import { usePersistence } from "src/lib/persistence";
import {
  getCustomerPointDemands,
  calculateAverageDemand,
  Demand,
} from "src/hydraulic-model/demands";
import { changeDemandAssignment } from "src/hydraulic-model/model-operations";
import { convertTo } from "src/quantity";

export function CustomerPointPanel() {
  const selection = useAtomValue(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const translate = useTranslate();
  const rep = usePersistence();
  const transact = rep.useTransact();
  const zoomTo = useZoomTo();
  const {
    modelMetadata: { quantities },
  } = useAtomValue(dataAtom);

  const customerPoint =
    selection.type === "singleCustomerPoint"
      ? hydraulicModel.customerPoints.get(selection.id)
      : undefined;

  const actions = useCustomerPointActions(customerPoint, "root");

  const flowUnit = quantities.getUnit("customerDemand");
  const perDayUnit = quantities.getUnit("customerDemandPerDay");

  const storedDemands = useMemo(
    () =>
      customerPoint
        ? getCustomerPointDemands(hydraulicModel.demands, customerPoint.id)
        : [],
    [customerPoint, hydraulicModel.demands],
  );

  const demandsInPerDay = useMemo(
    () =>
      storedDemands.map((d) => ({
        ...d,
        baseDemand: convertTo(
          { value: d.baseDemand, unit: flowUnit },
          perDayUnit,
        ),
      })),
    [storedDemands, flowUnit, perDayUnit],
  );

  const averageDemandInPerDay = useMemo(
    () =>
      convertTo(
        {
          value: calculateAverageDemand(storedDemands, hydraulicModel.patterns),
          unit: flowUnit,
        },
        perDayUnit,
      ),
    [storedDemands, hydraulicModel.patterns, flowUnit, perDayUnit],
  );

  const handleDemandsChange = useCallback(
    (newDemandsInPerDay: Demand[]) => {
      if (!customerPoint) return;
      const newDemands = newDemandsInPerDay.map((d) => ({
        ...d,
        baseDemand: convertTo(
          { value: d.baseDemand, unit: perDayUnit },
          flowUnit,
        ),
      }));
      const moment = changeDemandAssignment(hydraulicModel, [
        { customerPointId: customerPoint.id, demands: newDemands },
      ]);
      transact(moment);
    },
    [customerPoint, hydraulicModel, perDayUnit, flowUnit, transact],
  );

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
            <ActionButton
              action={{
                icon: <ZoomToIcon />,
                applicable: true,
                label: translate("zoomTo"),
                onSelect: function doZoomTo() {
                  const [lng, lat] = customerPoint.coordinates;
                  return Promise.resolve(
                    zoomTo(Maybe.of([lng, lat, lng, lat] as BBox)),
                  );
                },
              }}
            />
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
        {connection && (
          <Section title={translate("connections")}>
            <TextRow name="pipe" value={pipe ? pipe.label : ""} />
            <TextRow name="junction" value={junction ? junction.label : ""} />
          </Section>
        )}
        <Section title={translate("demands")}>
          <DemandCategoriesEditor
            demands={demandsInPerDay}
            patterns={hydraulicModel.patterns}
            onDemandsChange={handleDemandsChange}
          />
          <QuantityRow
            name="customerDemand"
            value={averageDemandInPerDay}
            unit={perDayUnit}
            decimals={quantities.getDecimals("customerDemandPerDay")}
            readOnly={true}
          />
        </Section>
      </div>
    </div>
  );
}
