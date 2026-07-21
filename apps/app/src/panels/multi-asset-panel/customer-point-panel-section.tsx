import { useCallback, useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import type { CustomerPoint } from "@epanet-js/hydraulic-model";
import { CollapsibleSection } from "src/components/form/fields";
import { RingSpinner } from "src/components/ring-spinner";
import { useTranslate } from "src/hooks/use-translate";
import { useAsyncCompute } from "src/hooks/use-async-compute";
import { projectSettingsAtom } from "src/state/project-settings";
import {
  selectedAssetsDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
import { multiAssetPanelCollapseAtom } from "src/state/layout";
import { selectionAtom } from "src/state/selection";
import { useSelection } from "src/selection";
import { useUserTracking } from "src/infra/user-tracking";
import {
  computeCustomerPointsStats,
  computeCustomerPointsSummary,
  type CustomerPointPropertySummarySections,
} from "./customer-point-stats";
import { CustomerPointSection } from "./sections";
import { SelectOnlyCustomerPointsButton } from "./select-only-button";
import { MultiCustomerPointCustomAttributesSection } from "./multi-customer-point-custom-attributes-section";

export function CustomerPointPanelSection({
  customerPoints,
}: {
  customerPoints: CustomerPoint[];
}) {
  const translate = useTranslate();
  const { units, formatting } = useAtomValue(projectSettingsAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const [collapseState, setCollapseState] = useAtom(
    multiAssetPanelCollapseAtom,
  );
  const selection = useAtomValue(selectionAtom);
  const { selectCustomerPoints } = useSelection(selection);
  const selectedAssets = useAtomValue(selectedAssetsDerivedAtom);
  const userTracking = useUserTracking();

  const customerPointIds = useMemo(
    () => customerPoints.map((cp) => cp.id),
    [customerPoints],
  );
  const showSelectOnly = selectedAssets.length > 0;

  const { data, isLoading } = useAsyncCompute<
    [
      CustomerPoint[],
      typeof hydraulicModel.demands,
      typeof hydraulicModel.patterns,
      typeof units,
      typeof formatting,
    ],
    CustomerPointPropertySummarySections
  >(
    computeCustomerPointsSummary,
    [
      customerPoints,
      hydraulicModel.demands,
      hydraulicModel.patterns,
      units,
      formatting,
    ],
    collapseState.customerPoint,
  );

  const handleSelect = useCallback(
    (ids: number[], property: string) => {
      userTracking.capture({
        name: "selection.narrowedToPropertyValue",
        type: "customerPoint",
        property,
        count: ids.length,
      });
      selectCustomerPoints(ids);
    },
    [selectCustomerPoints, userTracking],
  );

  const handleRequestDetails = useCallback(
    (property: string) =>
      computeCustomerPointsStats(
        customerPoints,
        hydraulicModel.demands,
        hydraulicModel.patterns,
        units,
        formatting,
      ).then((sections) => {
        for (const stats of [sections.connections, sections.demands]) {
          const found = stats.find((s) => s.property === property);
          if (found) return found;
        }
        return null;
      }),
    [
      customerPoints,
      hydraulicModel.demands,
      hydraulicModel.patterns,
      units,
      formatting,
    ],
  );

  return (
    <CollapsibleSection
      title={`${translate("customerPoints")} (${customerPoints.length})`}
      open={collapseState.customerPoint}
      onOpenChange={(open) =>
        setCollapseState((prev) => ({ ...prev, customerPoint: open }))
      }
      action={
        showSelectOnly ? (
          <SelectOnlyCustomerPointsButton customerPointIds={customerPointIds} />
        ) : undefined
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <RingSpinner />
        </div>
      ) : (
        data && (
          <CustomerPointSection
            sections={data}
            onSelectCustomerPoints={handleSelect}
            onRequestDetails={handleRequestDetails}
            customAttributes={
              <MultiCustomerPointCustomAttributesSection
                customerPointIds={customerPointIds}
                onSelectCustomerPoints={handleSelect}
              />
            }
          />
        )
      )}
    </CollapsibleSection>
  );
}
