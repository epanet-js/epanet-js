import { useCallback, useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { Maybe } from "purify-ts/Maybe";
import { projectSettingsAtom } from "src/state/project-settings";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
import { selectionAtom } from "src/state/selection";
import type { PropertyComparison } from "src/hooks/use-asset-comparison";
import { useCustomerPointComparison } from "src/hooks/use-customer-point-comparison";
import { useCustomerPointActions } from "src/components/context-actions/customer-point-actions";
import { ActionButton } from "src/components/action-button";
import { SectionList } from "src/components/form/fields";
import { SectionWrapper } from "./asset-panel/ui-components";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { ZoomToIcon } from "src/icons";
import { BBox } from "src/types";
import { TextRow, QuantityRow } from "./asset-panel/ui-components";
import { DemandCategoriesEditor } from "./asset-panel/demands-editor";
import { EditableTextField } from "src/components/form/editable-text-field";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import {
  getCustomerPointDemands,
  calculateAverageDemand,
  Demand,
} from "src/hydraulic-model/demands";
import {
  changeDemandAssignment,
  changeCustomerPointLabel,
} from "src/hydraulic-model/model-operations";
import { MAX_CUSTOMER_POINT_LABEL_LENGTH } from "src/hydraulic-model/customer-points";
import { convertTo } from "src/quantity";

export function CustomerPointPanel() {
  const selection = useAtomValue(selectionAtom);
  const { labelManager } = useAtomValue(modelFactoriesAtom);
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { transact } = useModelTransaction();
  const zoomTo = useZoomTo();
  const { units } = useAtomValue(projectSettingsAtom);
  const customerPoint =
    selection.type === "singleCustomerPoint"
      ? hydraulicModel.customerPoints.get(selection.id)
      : undefined;

  const customerPointId = customerPoint?.id;
  useEffect(() => {
    if (customerPointId != null) {
      userTracking.capture({ name: "customerPointPanel.opened" });
    }
  }, [customerPointId, userTracking]);

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
      const oldCount = getCustomerPointDemands(
        hydraulicModel.demands,
        customerPoint.id,
      ).length;
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
      userTracking.capture({
        name: "customerPointDemands.edited",
        oldCount,
        newCount: newDemands.length,
      });
    },
    [
      customerPoint,
      hydraulicModel,
      perDayUnit,
      flowUnit,
      transact,
      userTracking,
    ],
  );

  const [labelError, setLabelError] = useState<string | null>(null);

  const handleLabelChange = useCallback(
    (newLabel: string): boolean => {
      if (!customerPoint) return false;
      const oldLabel = customerPoint.label;
      if (newLabel === oldLabel) {
        setLabelError(null);
        return false;
      }

      const isAvailable = labelManager.isLabelAvailable(
        newLabel,
        "customerPoint",
        customerPoint.id,
      );
      if (!isAvailable) {
        setLabelError(translate("labelDuplicate"));
        userTracking.capture({
          name: "customerPointActions.labelDuplicate",
          newLabel,
        });
        return true;
      }

      const moment = changeCustomerPointLabel(hydraulicModel, {
        customerPointId: customerPoint.id,
        newLabel,
      });
      transact(moment);
      userTracking.capture({
        name: "customerPointActions.labelChanged",
        oldLabel,
        newLabel,
      });
      setLabelError(null);
      return false;
    },
    [
      customerPoint,
      hydraulicModel,
      labelManager,
      transact,
      translate,
      userTracking,
    ],
  );

  const clearLabelError = useCallback(() => {
    setLabelError(null);
  }, []);

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
          <div className="min-w-0 flex-1">
            <EditableTextField
              label={customerPoint.label}
              value={customerPoint.label}
              onChangeValue={handleLabelChange}
              onReset={clearLabelError}
              onDirty={clearLabelError}
              hasError={!!labelError}
              allowedChars={/(?![\s;])[\x00-\xFF]/}
              maxByteLength={MAX_CUSTOMER_POINT_LABEL_LENGTH}
              styleOptions={{
                padding: "sm",
                ghostBorder: true,
                fontWeight: "semibold",
                textSize: "sm",
              }}
            />
          </div>
          <div className="flex gap-1 h-8 shrink-0">
            <ActionButton
              action={{
                icon: <ZoomToIcon />,
                applicable: true,
                label: translate("zoomTo"),
                onSelect: function doZoomTo() {
                  const [lng, lat] = customerPoint.coordinates;
                  userTracking.capture({ name: "customerPointPanel.zoomTo" });
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
        {labelError && (
          <span className="text-xs text-orange-600 dark:text-orange-400 block mt-1 pl-1">
            {labelError}
          </span>
        )}
        <span className="text-sm text-gray-500 pl-1">
          {translate("customer")}
        </span>
      </div>
      <SectionList padding={3}>
        {connection && (
          <SectionWrapper
            title={translate("connections")}
            section="connections"
          >
            <TextRow name="pipe" value={pipe ? pipe.label : ""} />
            <TextRow name="junction" value={junction ? junction.label : ""} />
          </SectionWrapper>
        )}
        <SectionWrapper
          title={translate("demands")}
          section="demands"
          hasChanged={demandComparison.hasChanged}
        >
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
            comparison={demandComparison}
            readOnly={true}
          />
        </SectionWrapper>
      </SectionList>
    </div>
  );
}
