import { useCallback } from "react";
import { useAtom, useAtomValue } from "jotai";
import type { CustomerPoint } from "@epanet-js/hydraulic-model";
import { CollapsibleSection } from "src/components/form/fields";
import { RingSpinner } from "src/components/ring-spinner";
import { useTranslate } from "src/hooks/use-translate";
import { useAsyncCompute } from "src/hooks/use-async-compute";
import { projectSettingsAtom } from "src/state/project-settings";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { multiAssetPanelCollapseAtom } from "src/state/layout";
import { selectionAtom } from "src/state/selection";
import { useSelection } from "src/selection";
import { useUserTracking } from "src/infra/user-tracking";
import { computeCustomerPointsStats } from "./customer-point-stats";
import { CustomerPointSection } from "./sections";

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
  const userTracking = useUserTracking();

  const { data, isLoading } = useAsyncCompute(
    computeCustomerPointsStats,
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

  return (
    <CollapsibleSection
      title={`${translate("customerPoints")} (${customerPoints.length})`}
      open={collapseState.customerPoint}
      onOpenChange={(open) =>
        setCollapseState((prev) => ({ ...prev, customerPoint: open }))
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
          />
        )
      )}
    </CollapsibleSection>
  );
}
