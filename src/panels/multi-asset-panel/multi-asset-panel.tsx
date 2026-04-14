import { useMemo, useCallback } from "react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useTranslate } from "src/hooks/use-translate";
import { pluralize, formatCapitalize } from "src/lib/utils";
import { IWrappedFeature } from "src/types";
import { CollapsibleSection, SectionList } from "src/components/form/fields";
import { MultiAssetActions } from "./actions";
import { Asset, AssetId } from "src/hydraulic-model";
import { Tank } from "src/hydraulic-model/asset-types/tank";
import { AssetTypeSections } from "./asset-type-sections";
import { SelectOnlyButton } from "./select-only-button";
import { useAtom, useAtomValue } from "jotai";
import { projectSettingsAtom } from "src/state/project-settings";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
import { multiAssetPanelCollapseAtom } from "src/state/layout";
import { selectionAtom } from "src/state/selection";
import { simulationAtom, simulationResultsAtom } from "src/state/simulation";
import { simulationSettingsAtom } from "src/state/simulation-settings";
import {
  simulationDerivedAtom,
  simulationResultsDerivedAtom,
  simulationSettingsDerivedAtom,
} from "src/state/derived-branch-state";
import { computeMultiAssetData } from "./data";
import { BATCH_EDITABLE_PROPERTIES } from "./batch-edit-property-config";
import { usePersistence } from "src/lib/persistence";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { useUserTracking } from "src/infra/user-tracking";
import { changeProperty } from "src/hydraulic-model/model-operations";
import type { ChangeableProperty } from "src/hydraulic-model/model-operations/change-property";
import { activateAssets } from "src/hydraulic-model/model-operations/activate-assets";
import { deactivateAssets } from "src/hydraulic-model/model-operations/deactivate-assets";
import { useSelection } from "src/selection/use-selection";
import { useShowPumpLibrary } from "src/commands/show-pump-library";
import { useShowPatternsLibrary } from "src/commands/show-patterns-library";
import type { CurveType } from "src/hydraulic-model/curves";
import type { PatternType } from "src/hydraulic-model/patterns";

export function MultiAssetPanel({
  selectedFeatures,
  readonly = false,
}: {
  selectedFeatures: IWrappedFeature[];
  readonly?: boolean;
}) {
  const { formatting, units } = useAtomValue(projectSettingsAtom);
  const translate = useTranslate();
  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");
  const simulationState = useAtomValue(
    isStateRefactorOn ? simulationDerivedAtom : simulationAtom,
  );
  const simulationResults = useAtomValue(
    isStateRefactorOn ? simulationResultsDerivedAtom : simulationResultsAtom,
  );
  const hydraulicModel = useAtomValue(
    isStateRefactorOn ? stagingModelDerivedAtom : stagingModelAtom,
  );
  const { labelManager } = useAtomValue(modelFactoriesAtom);
  const hasSimulation = simulationState.status !== "idle";
  const [collapseState, setCollapseState] = useAtom(
    multiAssetPanelCollapseAtom,
  );
  const rep = usePersistence();
  const transactDeprecated = rep.useTransactDeprecated();
  const { transact: transactNew } = useModelTransaction();
  const transact = isStateRefactorOn ? transactNew : transactDeprecated;
  const userTracking = useUserTracking();
  const showPumpLibrary = useShowPumpLibrary();
  const showPatternsLibrary = useShowPatternsLibrary();
  const isWaterAgeOn = useFeatureFlag("FLAG_WATER_AGE");
  const isWaterChemicalOn = useFeatureFlag("FLAG_WATER_CHEMICAL");
  const simulationSettings = useAtomValue(
    isStateRefactorOn ? simulationSettingsDerivedAtom : simulationSettingsAtom,
  );
  const { data: multiAssetData, counts: assetCounts } = useMemo(() => {
    const assets = selectedFeatures as Asset[];
    return computeMultiAssetData(
      assets,
      units,
      formatting,
      hydraulicModel,
      simulationResults,
      {
        waterAge: isWaterAgeOn,
        waterChemical: isWaterChemicalOn,
      },
    );
  }, [
    selectedFeatures,
    units,
    formatting,
    hydraulicModel,
    simulationResults,
    isWaterAgeOn,
    isWaterChemicalOn,
  ]);

  const labelOverrides = useMemo(() => {
    const name = formatCapitalize(
      simulationSettings.qualityChemicalName || translate("chemical"),
    );
    const unit = simulationSettings.qualityMassUnit ?? "";
    return {
      chemicalConcentration: translate("chemicalConcentration", name, unit),
      initialChemicalConcentration: translate(
        "initialChemicalConcentration",
        name,
        unit,
      ),
    };
  }, [
    translate,
    simulationSettings.qualityChemicalName,
    simulationSettings.qualityMassUnit,
  ]);

  const assetIdsByType = useMemo(() => {
    const map: Record<Asset["type"], Asset["id"][]> = {
      junction: [],
      pipe: [],
      pump: [],
      valve: [],
      reservoir: [],
      tank: [],
    };
    for (const feature of selectedFeatures) {
      const asset = feature as Asset;
      map[asset.type].push(asset.id);
    }
    return map;
  }, [selectedFeatures]);

  const junctionEditableProperties = useMemo(() => {
    const {
      initialChemicalConcentration,
      chemicalSourceType,
      chemicalSourceStrength,
      chemicalSourcePattern,
      ...rest
    } = BATCH_EDITABLE_PROPERTIES.junction!;
    return isWaterChemicalOn ? BATCH_EDITABLE_PROPERTIES.junction! : rest;
  }, [isWaterChemicalOn]);

  const pipeEditableProperties = useMemo(() => {
    const { bulkReactionCoeff, wallReactionCoeff, ...rest } =
      BATCH_EDITABLE_PROPERTIES.pipe!;
    return isWaterChemicalOn ? BATCH_EDITABLE_PROPERTIES.pipe! : rest;
  }, [isWaterChemicalOn]);

  const reservoirEditableProperties = useMemo(() => {
    const {
      initialChemicalConcentration,
      chemicalSourceType,
      chemicalSourceStrength,
      chemicalSourcePattern,
      ...rest
    } = BATCH_EDITABLE_PROPERTIES.reservoir!;
    return isWaterChemicalOn ? BATCH_EDITABLE_PROPERTIES.reservoir! : rest;
  }, [isWaterChemicalOn]);

  const tankEditableProperties = useMemo(() => {
    const hasCurveTanks = assetIdsByType.tank.some((id) => {
      const tank = hydraulicModel.assets.get(id) as Tank;
      return !!tank.volumeCurveId;
    });
    const base = hasCurveTanks
      ? (() => {
          const { minLevel, maxLevel, diameter, minVolume, ...rest } =
            BATCH_EDITABLE_PROPERTIES.tank!;
          return rest;
        })()
      : BATCH_EDITABLE_PROPERTIES.tank!;
    if (!isWaterChemicalOn) {
      const {
        initialChemicalConcentration,
        bulkReactionCoeff,
        chemicalSourceType,
        chemicalSourceStrength,
        chemicalSourcePattern,
        ...rest
      } = base;
      return rest;
    }
    return base;
  }, [assetIdsByType.tank, hydraulicModel, isWaterChemicalOn]);

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
  const { selectAssets } = useSelection(selection);

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

  return (
    <SectionList
      padding={3}
      header={<Header selectedCount={selectedFeatures.length} />}
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
            labelOverrides={labelOverrides}
            sections={multiAssetData.junction}
            editableProperties={junctionEditableProperties}
            hasSimulation={hasSimulation}
            onPropertyChange={(p, v) =>
              handleBatchPropertyChange("junction", p, v)
            }
            readonly={readonly}
            onSelectAssets={(ids, p) => handleSelectAssets(ids, p, "junction")}
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
            labelOverrides={labelOverrides}
            sections={multiAssetData.pipe}
            editableProperties={pipeEditableProperties}
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
            labelOverrides={labelOverrides}
            sections={multiAssetData.pump}
            editableProperties={BATCH_EDITABLE_PROPERTIES.pump!}
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
            labelOverrides={labelOverrides}
            sections={multiAssetData.valve}
            editableProperties={BATCH_EDITABLE_PROPERTIES.valve!}
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
            labelOverrides={labelOverrides}
            sections={multiAssetData.reservoir}
            editableProperties={reservoirEditableProperties}
            onPropertyChange={(p, v) =>
              handleBatchPropertyChange("reservoir", p, v)
            }
            readonly={readonly}
            onSelectAssets={(ids, p) => handleSelectAssets(ids, p, "reservoir")}
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
            labelOverrides={labelOverrides}
            sections={multiAssetData.tank}
            editableProperties={tankEditableProperties}
            hasSimulation={hasSimulation}
            onPropertyChange={(p, v) => handleBatchPropertyChange("tank", p, v)}
            readonly={readonly}
            onSelectAssets={(ids, p) => handleSelectAssets(ids, p, "tank")}
          />
        </CollapsibleSection>
      )}
    </SectionList>
  );
}

const Header = ({ selectedCount }: { selectedCount: number }) => {
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
