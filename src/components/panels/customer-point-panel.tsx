import { useCallback, useMemo } from "react";
import { useAtomValue } from "jotai";
import { Maybe } from "purify-ts/Maybe";
import { dataAtom } from "src/state/data";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { selectionAtom } from "src/state/selection";
import type { PropertyComparison } from "src/hooks/use-asset-comparison";
import { useCustomerPointComparison } from "src/hooks/use-customer-point-comparison";
import { useCustomerPointActions } from "src/components/context-actions/customer-point-actions";
import { ActionButton } from "src/components/panels/asset-panel/actions/action-button";
import { SectionLegacy } from "src/components/form/fields";
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
    modelMetadata: { quantities, units },
  } = useAtomValue(dataAtom);
  const customerPoint =
    selection.type === "singleCustomerPoint"
      ? hydraulicModel.customerPoints.get(selection.id)
      : undefined;

  const actions = useCustomerPointActions(customerPoint, "root");

  const flowUnit = units.customerDemand;
  const perDayUnit = units.customerDemandPerDay;

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

  const { isNew, getDemandComparison } = useCustomerPointComparison(
    customerPoint?.id,
  );

  const averageDemand = useMemo(
    () => calculateAverageDemand(storedDemands, hydraulicModel.patterns),
    [storedDemands, hydraulicModel.patterns],
  );

  const averageDemandInPerDay = useMemo(
    () => convertTo({ value: averageDemand, unit: flowUnit }, perDayUnit),
    [averageDemand, flowUnit, perDayUnit],
  );

  const demandComparisonRaw = getDemandComparison(averageDemand);
  const demandComparison: PropertyComparison<number> =
    demandComparisonRaw.hasChanged && demandComparisonRaw.baseValue != null
      ? {
          hasChanged: true,
          baseValue: convertTo(
            { value: demandComparisonRaw.baseValue, unit: flowUnit },
            perDayUnit,
          ),
        }
      : { hasChanged: demandComparisonRaw.hasChanged };

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
      <div className="px-3 pt-4 pb-3 relative">
        {isNew && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500 rounded-full" />
        )}
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
        <span className="text-sm text-gray-500 pl-1">
          {translate("customer")}
        </span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        {connection && (
          <SectionLegacy title={translate("connections")}>
            <TextRow name="pipe" value={pipe ? pipe.label : ""} />
            <TextRow name="junction" value={junction ? junction.label : ""} />
          </SectionLegacy>
        )}
        <SectionLegacy title={translate("demands")}>
          <div className="relative flex flex-col gap-2">
            {demandComparison.hasChanged && (
              <div className="absolute -left-4 top-0 bottom-0 w-1 bg-purple-500 rounded-full" />
            )}
            <DemandCategoriesEditor
              demands={demandsInPerDay}
              patterns={hydraulicModel.patterns}
              onDemandsChange={handleDemandsChange}
              comparison={demandComparison}
            />
            <QuantityRow
              name="customerDemand"
              value={averageDemandInPerDay}
              unit={perDayUnit}
              decimals={quantities.getDecimals("customerDemandPerDay")}
              comparison={demandComparison}
              readOnly={true}
            />
          </div>
        </SectionLegacy>
      </div>
    </div>
  );
}
