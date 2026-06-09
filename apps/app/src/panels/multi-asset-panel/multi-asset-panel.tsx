import { useMemo, useCallback } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { pluralize } from "src/lib/utils";
import { CollapsibleSection, SectionList } from "src/components/form/fields";
import { MultiAssetActions } from "./actions";
import { Asset, AssetId } from "src/hydraulic-model";
import {
  Tank,
  type CurveType,
  type PatternType,
} from "@epanet-js/hydraulic-model";
import { AssetTypeSections, CustomerPointSection } from "./sections";
import { computeCustomerPointsStats } from "./customer-point-stats";
import { SelectOnlyButton } from "./select-only-button";
import { useAtom, useAtomValue } from "jotai";
import { projectSettingsAtom } from "src/state/project-settings";
import {
  simulationDerivedAtom,
  simulationResultsDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
import type { CustomerPoint } from "@epanet-js/hydraulic-model";
import { modelFactoriesAtom } from "src/state/model-factories";
import { multiAssetPanelCollapseAtom } from "src/state/layout";
import { selectionAtom } from "src/state/selection";
import { computeAssetsStats } from "./asset-stats";
import { BATCH_EDITABLE_PROPERTIES } from "./batch-edit-property-config";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { useUserTracking } from "src/infra/user-tracking";
import { changeProperty } from "src/hydraulic-model/model-operations";
import type { ChangeableProperty } from "src/hydraulic-model/model-operations/change-property";
import { activateAssets } from "src/hydraulic-model/model-operations/activate-assets";
import { deactivateAssets } from "src/hydraulic-model/model-operations/deactivate-assets";
import { useSelection } from "src/selection";
import { useShowPumpLibrary } from "src/commands/show-pump-library";
import { useShowPatternsLibrary } from "src/commands/show-patterns-library";

export function MultiAssetPanel({
  selectedAssets,
  selectedCustomerPoints,
  readonly = false,
}: {
  selectedAssets: Asset[];
  selectedCustomerPoints: CustomerPoint[];
  readonly?: boolean;
}) {
  const { formatting, units } = useAtomValue(projectSettingsAtom);
  const translate = useTranslate();
  const simulationState = useAtomValue(simulationDerivedAtom);
  const simulationResults = useAtomValue(simulationResultsDerivedAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { labelManager } = useAtomValue(modelFactoriesAtom);
  const hasSimulation = simulationState.status !== "idle";
  const [collapseState, setCollapseState] = useAtom(
    multiAssetPanelCollapseAtom,
  );
  const { transact } = useModelTransaction();
  const userTracking = useUserTracking();
  const showPumpLibrary = useShowPumpLibrary();
  const showPatternsLibrary = useShowPatternsLibrary();
  const { data: multiAssetData, counts: assetCounts } = useMemo(() => {
    return computeAssetsStats(
      selectedAssets,
      units,
      formatting,
      hydraulicModel,
      simulationResults,
    );
  }, [selectedAssets, units, formatting, hydraulicModel, simulationResults]);

  const customerPointData = useMemo(
    () =>
      computeCustomerPointsStats(
        selectedCustomerPoints,
        hydraulicModel.demands,
        hydraulicModel.patterns,
        units,
        formatting,
      ),
    [
      selectedCustomerPoints,
      hydraulicModel.demands,
      hydraulicModel.patterns,
      units,
      formatting,
    ],
  );

  const assetIdsByType = useMemo(() => {
    const map: Record<Asset["type"], Asset["id"][]> = {
      junction: [],
      pipe: [],
      pump: [],
      valve: [],
      reservoir: [],
      tank: [],
    };
    for (const asset of selectedAssets) {
      map[asset.type].push(asset.id);
    }
    return map;
  }, [selectedAssets]);

  const tankEditableProperties = useMemo(() => {
    const hasCurveTanks = assetIdsByType.tank.some((id) => {
      const tank = hydraulicModel.assets.get(id) as Tank;
      return !!tank.volumeCurveId;
    });
    if (hasCurveTanks) {
      const { minLevel, maxLevel, diameter, minVolume, ...rest } =
        BATCH_EDITABLE_PROPERTIES.tank;
      return rest;
    }
    return BATCH_EDITABLE_PROPERTIES.tank;
  }, [assetIdsByType.tank, hydraulicModel.assets]);

  const showSelectOnly =
    Object.values(assetCounts).filter((c) => c > 0).length > 1;

  const handleBatchPropertyChange = useCallback(
    (
      assetType: Asset["type"],
      modelProperty: ChangeableProperty,
      value: number | string | boolean,
    ) => {
      const assetIds = assetIdsByType[assetType];
      const moment =
        modelProperty === "isActive"
          ? value
            ? activateAssets(hydraulicModel, { assetIds })
            : deactivateAssets(hydraulicModel, { assetIds })
          : changeProperty(hydraulicModel, {
              assetIds,
              property: modelProperty,
              value,
            });
      transact(moment);
      userTracking.capture({
        name: "assetProperty.batchEdited",
        type: assetType,
        property: modelProperty,
        newValue: typeof value === "boolean" ? Number(value) : value,
        count: assetIds.length,
      });
    },
    [hydraulicModel, assetIdsByType, transact, userTracking],
  );

  const selection = useAtomValue(selectionAtom);
  const { selectAssets, selectCustomerPoints } = useSelection(selection);

  const handleSelectAssets = useCallback(
    (assetIds: AssetId[], property: string, assetType: Asset["type"]) => {
      userTracking.capture({
        name: "selection.narrowedToPropertyValue",
        type: assetType,
        property,
        count: assetIds.length,
      });
      selectAssets(assetIds);
    },
    [selectAssets, userTracking],
  );

  const handleSelectCustomerPoints = useCallback(
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

  const handleOpenLibrary = useCallback(
    (
      library: "curves" | "patterns" | "pumps",
      filterByType?: CurveType | PatternType,
    ) => {
      if (library === "pumps") {
        showPumpLibrary({
          source: "pump",
          initialSection: filterByType as "pump" | "efficiency" | undefined,
        });
      } else if (library === "patterns") {
        showPatternsLibrary({
          source: filterByType === "qualitySourceStrength" ? "quality" : "pump",
          initialSection: filterByType as PatternType | undefined,
        });
      }
    },
    [showPumpLibrary, showPatternsLibrary],
  );

  const isMultiCpSelectionOn = useFeatureFlag("FLAG_MULTI_CP_SELECTION");

  return (
    <SectionList
      padding={3}
      header={
        isMultiCpSelectionOn ? (
          <HeaderNew
            assetCount={selectedAssets.length}
            customerPointCount={selectedCustomerPoints.length}
          />
        ) : (
          <HeaderDeprecated selectedCount={selectedAssets.length} />
        )
      }
      overflow={true}
    >
      {assetCounts.junction > 0 && (
        <CollapsibleSection
          title={`${translate("junction")} (${assetCounts.junction})`}
          open={collapseState.junction}
          onOpenChange={(open) =>
            setCollapseState((prev) => ({ ...prev, junction: open }))
          }
          action={
            showSelectOnly ? (
              <SelectOnlyButton
                assetType="junction"
                assetIds={assetIdsByType.junction}
              />
            ) : undefined
          }
        >
          <AssetTypeSections
            sections={multiAssetData.junction}
            editableProperties={BATCH_EDITABLE_PROPERTIES.junction}
            hasSimulation={hasSimulation}
            onPropertyChange={(p, v) =>
              handleBatchPropertyChange("junction", p, v)
            }
            readonly={readonly}
            onSelectAssets={(ids, p) => handleSelectAssets(ids, p, "junction")}
            patterns={hydraulicModel.patterns}
            labelManager={labelManager}
            onOpenLibrary={handleOpenLibrary}
          />
        </CollapsibleSection>
      )}

      {assetCounts.pipe > 0 && (
        <CollapsibleSection
          title={`${translate("pipe")} (${assetCounts.pipe})`}
          open={collapseState.pipe}
          onOpenChange={(open) =>
            setCollapseState((prev) => ({ ...prev, pipe: open }))
          }
          action={
            showSelectOnly ? (
              <SelectOnlyButton
                assetType="pipe"
                assetIds={assetIdsByType.pipe}
              />
            ) : undefined
          }
        >
          <AssetTypeSections
            sections={multiAssetData.pipe}
            editableProperties={BATCH_EDITABLE_PROPERTIES.pipe}
            hasSimulation={hasSimulation}
            onPropertyChange={(p, v) => handleBatchPropertyChange("pipe", p, v)}
            readonly={readonly}
            onSelectAssets={(ids, p) => handleSelectAssets(ids, p, "pipe")}
          />
        </CollapsibleSection>
      )}

      {assetCounts.pump > 0 && (
        <CollapsibleSection
          title={`${translate("pump")} (${assetCounts.pump})`}
          open={collapseState.pump}
          onOpenChange={(open) =>
            setCollapseState((prev) => ({ ...prev, pump: open }))
          }
          action={
            showSelectOnly ? (
              <SelectOnlyButton
                assetType="pump"
                assetIds={assetIdsByType.pump}
              />
            ) : undefined
          }
        >
          <AssetTypeSections
            sections={multiAssetData.pump}
            editableProperties={BATCH_EDITABLE_PROPERTIES.pump}
            hasSimulation={hasSimulation}
            onPropertyChange={(p, v) => handleBatchPropertyChange("pump", p, v)}
            readonly={readonly}
            onSelectAssets={(ids, p) => handleSelectAssets(ids, p, "pump")}
            curves={hydraulicModel.curves}
            patterns={hydraulicModel.patterns}
            labelManager={labelManager}
            onOpenLibrary={handleOpenLibrary}
          />
        </CollapsibleSection>
      )}

      {assetCounts.valve > 0 && (
        <CollapsibleSection
          title={`${translate("valve")} (${assetCounts.valve})`}
          open={collapseState.valve}
          onOpenChange={(open) =>
            setCollapseState((prev) => ({ ...prev, valve: open }))
          }
          action={
            showSelectOnly ? (
              <SelectOnlyButton
                assetType="valve"
                assetIds={assetIdsByType.valve}
              />
            ) : undefined
          }
        >
          <AssetTypeSections
            sections={multiAssetData.valve}
            editableProperties={BATCH_EDITABLE_PROPERTIES.valve}
            hasSimulation={hasSimulation}
            onPropertyChange={(p, v) =>
              handleBatchPropertyChange("valve", p, v)
            }
            readonly={readonly}
            onSelectAssets={(ids, p) => handleSelectAssets(ids, p, "valve")}
          />
        </CollapsibleSection>
      )}

      {assetCounts.reservoir > 0 && (
        <CollapsibleSection
          title={`${translate("reservoir")} (${assetCounts.reservoir})`}
          open={collapseState.reservoir}
          onOpenChange={(open) =>
            setCollapseState((prev) => ({ ...prev, reservoir: open }))
          }
          action={
            showSelectOnly ? (
              <SelectOnlyButton
                assetType="reservoir"
                assetIds={assetIdsByType.reservoir}
              />
            ) : undefined
          }
        >
          <AssetTypeSections
            sections={multiAssetData.reservoir}
            editableProperties={BATCH_EDITABLE_PROPERTIES.reservoir}
            onPropertyChange={(p, v) =>
              handleBatchPropertyChange("reservoir", p, v)
            }
            readonly={readonly}
            onSelectAssets={(ids, p) => handleSelectAssets(ids, p, "reservoir")}
            patterns={hydraulicModel.patterns}
            labelManager={labelManager}
            onOpenLibrary={handleOpenLibrary}
          />
        </CollapsibleSection>
      )}

      {assetCounts.tank > 0 && (
        <CollapsibleSection
          title={`${translate("tank")} (${assetCounts.tank})`}
          open={collapseState.tank}
          onOpenChange={(open) =>
            setCollapseState((prev) => ({ ...prev, tank: open }))
          }
          action={
            showSelectOnly ? (
              <SelectOnlyButton
                assetType="tank"
                assetIds={assetIdsByType.tank}
              />
            ) : undefined
          }
        >
          <AssetTypeSections
            sections={multiAssetData.tank}
            editableProperties={tankEditableProperties}
            hasSimulation={hasSimulation}
            onPropertyChange={(p, v) => handleBatchPropertyChange("tank", p, v)}
            readonly={readonly}
            onSelectAssets={(ids, p) => handleSelectAssets(ids, p, "tank")}
            curves={hydraulicModel.curves}
            patterns={hydraulicModel.patterns}
            labelManager={labelManager}
            onOpenLibrary={handleOpenLibrary}
          />
        </CollapsibleSection>
      )}

      {isMultiCpSelectionOn && selectedCustomerPoints.length > 0 && (
        <CollapsibleSection
          title={`${translate("customerPoints")} (${selectedCustomerPoints.length})`}
          open={collapseState.customerPoint}
          onOpenChange={(open) =>
            setCollapseState((prev) => ({ ...prev, customerPoint: open }))
          }
        >
          <CustomerPointSection
            sections={customerPointData}
            onSelectCustomerPoints={handleSelectCustomerPoints}
          />
        </CollapsibleSection>
      )}
    </SectionList>
  );
}

const HeaderDeprecated = ({ selectedCount }: { selectedCount: number }) => {
  const translate = useTranslate();

  return (
    <div className="px-4 pt-4 pb-3">
      <div className="flex items-start justify-between">
        <span className="font-semibold mt-1">
          {translate("selection")} (
          <span className="text-nowrap">
            {pluralize(translate, "asset", selectedCount)})
          </span>
        </span>
        <MultiAssetActions />
      </div>
    </div>
  );
};

const HeaderNew = ({
  assetCount,
  customerPointCount,
}: {
  assetCount: number;
  customerPointCount: number;
}) => {
  const translate = useTranslate();
  const totalCount = assetCount + customerPointCount;

  return (
    <div className="px-4 pt-4 pb-3">
      <div className="flex items-start justify-between">
        <span className="font-semibold mt-1">
          {translate("selection")} (
          <span className="text-nowrap">
            {pluralize(translate, "asset", totalCount)})
          </span>
        </span>
        <MultiAssetActions />
      </div>
    </div>
  );
};
