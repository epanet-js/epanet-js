import { useMemo, useCallback } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { pluralize } from "src/lib/utils";
import { IWrappedFeature } from "src/types";
import { Quantities } from "src/model-metadata/quantities-spec";
import { CollapsibleSection, SectionList } from "src/components/form/fields";
import { MultiAssetActions } from "./actions";
import { Asset, AssetId } from "src/hydraulic-model";
import { AssetTypeSections } from "./asset-type-sections";
import { SelectOnlyButton } from "./select-only-button";
import { useAtom, useAtomValue } from "jotai";
import {
  simulationAtom,
  simulationResultsAtom,
  multiAssetPanelCollapseAtom,
  stagingModelAtom,
  selectionAtom,
} from "src/state/jotai";
import { computeMultiAssetData } from "./data";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useSelection } from "src/selection/use-selection";
import { useUserTracking } from "src/infra/user-tracking";

export function MultiAssetPanel({
  selectedFeatures,
  quantitiesMetadata,
  readonly: _readonly = false,
}: {
  selectedFeatures: IWrappedFeature[];
  quantitiesMetadata: Quantities;
  readonly?: boolean;
}) {
  const translate = useTranslate();
  const simulationState = useAtomValue(simulationAtom);
  const simulationResults = useAtomValue(simulationResultsAtom);
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const hasSimulation = simulationState.status !== "idle";
  const [collapseState, setCollapseState] = useAtom(
    multiAssetPanelCollapseAtom,
  );

  const { data: multiAssetData, counts: assetCounts } = useMemo(() => {
    const assets = selectedFeatures as Asset[];
    return computeMultiAssetData(
      assets,
      quantitiesMetadata,
      hydraulicModel,
      simulationResults,
    );
  }, [selectedFeatures, quantitiesMetadata, hydraulicModel, simulationResults]);

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

  const isNarrowSelectionEnabled = useFeatureFlag("FLAG_NARROW_SELECTION");
  const showSelectOnly =
    isNarrowSelectionEnabled &&
    Object.values(assetCounts).filter((c) => c > 0).length > 1;

  const selection = useAtomValue(selectionAtom);
  const { selectAssets } = useSelection(selection);
  const userTracking = useUserTracking();

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

  const onSelectAssets = isNarrowSelectionEnabled
    ? handleSelectAssets
    : undefined;

  return (
    <SectionList header={<Header selectedCount={selectedFeatures.length} />}>
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
            hasSimulation={hasSimulation}
            onSelectAssets={
              onSelectAssets && ((ids, p) => onSelectAssets(ids, p, "junction"))
            }
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
            hasSimulation={hasSimulation}
            onSelectAssets={
              onSelectAssets && ((ids, p) => onSelectAssets(ids, p, "pipe"))
            }
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
            hasSimulation={hasSimulation}
            onSelectAssets={
              onSelectAssets && ((ids, p) => onSelectAssets(ids, p, "pump"))
            }
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
            hasSimulation={hasSimulation}
            onSelectAssets={
              onSelectAssets && ((ids, p) => onSelectAssets(ids, p, "valve"))
            }
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
            onSelectAssets={
              onSelectAssets &&
              ((ids, p) => onSelectAssets(ids, p, "reservoir"))
            }
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
            hasSimulation={hasSimulation}
            onSelectAssets={
              onSelectAssets && ((ids, p) => onSelectAssets(ids, p, "tank"))
            }
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
