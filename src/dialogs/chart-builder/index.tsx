import { useState, useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { selectionAtom } from "src/state/selection";
import { dialogAtom } from "src/state/dialog";
import {
  stagingModelDerivedAtom,
  simulationDerivedAtom,
} from "src/state/derived-branch-state";
import {
  AckDialogAction,
  BaseDialog,
  SimpleDialogActions,
} from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { PropertySelectionStep } from "./steps/property-selection-step";
import { classifyAssetTypes, getAvailableProperties } from "./property-config";
import type { AssetType } from "src/hydraulic-model/asset-types";
import type { QuickGraphAssetType } from "src/state/quick-graph";

interface ChartBuilderDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChartBuilderWizard({
  isOpen,
  onClose,
}: ChartBuilderDialogProps) {
  const translate = useTranslate();
  const selection = useAtomValue(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const simulation = useAtomValue(simulationDerivedAtom);
  const setDialog = useSetAtom(dialogAtom);

  const qualityType = useMemo(() => {
    if ("epsResultsReader" in simulation && simulation.epsResultsReader) {
      return simulation.epsResultsReader.qualityType;
    }
    return null;
  }, [simulation]);

  const selectedAssetIds = useMemo(() => {
    if (selection.type === "single") return [selection.id];
    if (selection.type === "multi") return [...selection.ids];
    return [];
  }, [selection]);

  const assetTypes = useMemo(
    () =>
      selectedAssetIds.flatMap((id) => {
        const asset = hydraulicModel.assets.get(id);
        return asset ? [asset.type as AssetType] : [];
      }),
    [selectedAssetIds, hydraulicModel.assets],
  );

  const classification = useMemo(
    () => classifyAssetTypes(assetTypes),
    [assetTypes],
  );

  const defaultNodeProp = useMemo(
    () =>
      getAvailableProperties(
        classification.nodeTypes as QuickGraphAssetType[],
        null,
      )[0]?.value ?? null,
    [classification.nodeTypes],
  );
  const defaultLinkProp = useMemo(
    () =>
      getAvailableProperties(
        classification.linkTypes as QuickGraphAssetType[],
        null,
      )[0]?.value ?? null,
    [classification.linkTypes],
  );

  const [nodeProperty, setNodeProperty] = useState<string | null>(
    defaultNodeProp,
  );
  const [linkProperty, setLinkProperty] = useState<string | null>(
    defaultLinkProp,
  );

  const canBuild =
    (!classification.hasNodes || nodeProperty !== null) &&
    (!classification.hasLinks || linkProperty !== null);

  const chartTitle = useMemo(() => {
    const parts: string[] = [];
    if (nodeProperty && classification.hasNodes) {
      const opts = getAvailableProperties(
        classification.nodeTypes as QuickGraphAssetType[],
        qualityType,
      );
      const found = opts.find((o) => o.value === nodeProperty);
      if (found) parts.push(translate(found.labelKey));
    }
    if (linkProperty && classification.hasLinks) {
      const opts = getAvailableProperties(
        classification.linkTypes as QuickGraphAssetType[],
        qualityType,
      );
      const found = opts.find((o) => o.value === linkProperty);
      if (found) parts.push(translate(found.labelKey));
    }
    return parts.join(" — ");
  }, [classification, nodeProperty, linkProperty, qualityType, translate]);

  const handleBuild = () => {
    setDialog({
      type: "chartBuilderChart",
      selectedAssetIds,
      nodeProperty,
      linkProperty,
      chartTitle,
    });
  };

  return (
    <BaseDialog
      title={translate("chartBuilder.selectionTitle")}
      size="xs"
      isOpen={isOpen}
      onClose={onClose}
      footer={
        selectedAssetIds.length === 0 ? (
          <AckDialogAction label={translate("understood")} onAck={onClose} />
        ) : (
          <SimpleDialogActions
            action={translate("chartBuilder.buildChart")}
            onAction={handleBuild}
            onClose={onClose}
            isDisabled={!canBuild}
            autoFocusSubmit={false}
          />
        )
      }
    >
      <div className="px-4 py-4">
        {selectedAssetIds.length === 0 ? (
          <p className="text-sm text-gray-700">
            {translate("chartBuilder.noAssets")}
          </p>
        ) : (
          <PropertySelectionStep
            selectedAssetIds={selectedAssetIds}
            nodeProperty={nodeProperty}
            linkProperty={linkProperty}
            onNodePropertyChange={setNodeProperty}
            onLinkPropertyChange={setLinkProperty}
          />
        )}
      </div>
    </BaseDialog>
  );
}
