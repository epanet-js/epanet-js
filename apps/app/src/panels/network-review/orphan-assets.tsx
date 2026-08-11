import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { AssetType, HydraulicModel } from "src/hydraulic-model";
import { Asset, AssetId } from "@epanet-js/hydraulic-model";
import {
  JunctionIcon,
  PipeIcon,
  PumpIcon,
  ReservoirIcon,
  TankIcon,
  ValveIcon,
} from "src/icons";
import { useUserTracking } from "src/infra/user-tracking";
import { findOrphanAssets } from "src/lib/network-review/orphan-assets";
import { useSelection } from "src/selection";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import {
  CheckType,
  EmptyState,
  LoadingState,
  ToolDescription,
  ToolHeader,
  useCheckHeader,
  useLoadingStatus,
  VirtualizedIssuesList,
} from "./common";

export const OrphanAssets = ({ onGoBack }: { onGoBack: () => void }) => {
  const userTracking = useUserTracking();
  const { orphanAssets, checkOrphanAssets, isLoading, isReady } =
    useCheckOrphanAssets();
  const selection = useAtomValue(selectionAtom);
  const { selectAsset, isSelected, clearSelection } = useSelection(selection);
  const zoomTo = useZoomTo();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const [selectedOrphanAssetId, setSelectedOrphanAssetId] = useState<
    number | null
  >(null);

  const lastIssuesCount = useRef(0);

  useEffect(
    function recomputeOrphanAssets() {
      const abortController = new AbortController();
      void checkOrphanAssets(abortController.signal);
      return () => {
        abortController.abort();
      };
    },
    [checkOrphanAssets],
  );

  const selectOrphanAsset = useCallback(
    (assetId: AssetId | null) => {
      if (assetId === null) {
        setSelectedOrphanAssetId(null);
        clearSelection();
        return;
      }

      const fullAsset = hydraulicModel.assets.get(assetId);
      if (!fullAsset) {
        setSelectedOrphanAssetId(null);
        return;
      }
      setSelectedOrphanAssetId(assetId);
      selectAsset(assetId);
      zoomTo([fullAsset]);
    },
    [hydraulicModel, selectAsset, zoomTo, clearSelection],
  );

  useEffect(() => {
    const selectedAssetId = orphanAssets.find((assetId) => isSelected(assetId));

    if (selectedAssetId === undefined) {
      setSelectedOrphanAssetId(null);
    } else
      setSelectedOrphanAssetId((prev) =>
        prev === selectedAssetId ? prev : selectedAssetId,
      );
  }, [orphanAssets, isSelected]);

  useEffect(() => {
    const issuesCount = orphanAssets.length;
    if (lastIssuesCount.current !== issuesCount) {
      lastIssuesCount.current = issuesCount;
      userTracking.capture({
        name: "networkReview.orphanAssets.changed",
        count: issuesCount,
      });
    }
  }, [orphanAssets, userTracking]);

  const headerProps = useCheckHeader(
    CheckType.orphanAssets,
    orphanAssets.length,
    onGoBack,
  );

  return (
    <div className="absolute inset-0 flex flex-col">
      <ToolHeader
        {...headerProps}
        autoFocus={orphanAssets.length === 0 && !isLoading}
      />
      <div className="relative grow flex flex-col">
        {isReady ? (
          <>
            {orphanAssets.length > 0 ? (
              <OrphanAssetsList
                orphanAssets={orphanAssets}
                onClick={selectOrphanAsset}
                selectedOrphanAsset={selectedOrphanAssetId}
                onGoBack={onGoBack}
                hydraulicModel={hydraulicModel}
              />
            ) : (
              <>
                <ToolDescription checkType={CheckType.orphanAssets} />
                <EmptyState checkType={CheckType.orphanAssets} />
              </>
            )}
            {isLoading && <LoadingState overlay />}
          </>
        ) : (
          <>
            <ToolDescription checkType={CheckType.orphanAssets} />
            <LoadingState />
          </>
        )}
      </div>
    </div>
  );
};

const OrphanAssetsList = ({
  orphanAssets,
  onClick,
  selectedOrphanAsset,
  onGoBack,
  hydraulicModel,
}: {
  orphanAssets: AssetId[];
  onClick: (assetId: AssetId | null) => void;
  selectedOrphanAsset: number | null;
  onGoBack: () => void;
  hydraulicModel: HydraulicModel;
}) => {
  return (
    <VirtualizedIssuesList
      items={orphanAssets}
      selectedItemId={selectedOrphanAsset}
      onSelect={onClick}
      getItemId={(assetId) => assetId}
      renderItem={(_index, assetId, selectedId, onClick) => {
        const asset = hydraulicModel.assets.get(assetId);
        if (!asset) return null;

        return (
          <OrphanAssetItem
            asset={asset}
            selectedId={selectedId}
            onClick={onClick}
          />
        );
      }}
      checkType={CheckType.orphanAssets}
      onGoBack={onGoBack}
    />
  );
};

const iconByAssetType: { [key in AssetType]: React.ReactNode } = {
  junction: <JunctionIcon />,
  tank: <TankIcon />,
  reservoir: <ReservoirIcon />,
  valve: <ValveIcon />,
  pump: <PumpIcon />,
  pipe: <PipeIcon />,
};

const OrphanAssetItem = ({
  asset,
  onClick,
  selectedId,
}: {
  asset: Asset;
  onClick: (assetId: AssetId) => void;
  selectedId: number | null;
}) => {
  const translate = useTranslate();
  const isSelected = selectedId === asset.id;

  return (
    <Button
      onClick={() => onClick(asset.id)}
      onMouseDown={(e) => e.preventDefault()}
      variant={"quiet/list"}
      aria-label={translate(
        "networkReview.orphanAssets.issueLabel",
        translate(asset.type),
        asset.label,
      )}
      aria-selected={isSelected}
      tabIndex={-1}
      className="group w-full"
    >
      <div className="grid grid-cols-[auto_1fr] gap-x-2 items-start p-1 pr-0 text-size-base w-full">
        <div className="pt-[.125rem]">{iconByAssetType[asset.type]}</div>
        <div className="text-size-base text-left">{asset.label}</div>
      </div>
    </Button>
  );
};

const deferToAllowRender = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

const useCheckOrphanAssets = () => {
  const [orphanAssets, setOrphanAssets] = useState<AssetId[]>([]);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { startLoading, finishLoading, isLoading } = useLoadingStatus();
  const isReady = useRef(false);

  const checkOrphanAssets = useCallback(
    async (signal?: AbortSignal) => {
      startLoading();
      await deferToAllowRender();

      if (signal?.aborted) return;

      try {
        const result = await findOrphanAssets(hydraulicModel, signal);

        if (!signal?.aborted) {
          setOrphanAssets(result);
          finishLoading();
          isReady.current = true;
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        finishLoading();
        throw error;
      }
    },
    [hydraulicModel, startLoading, finishLoading],
  );

  return {
    checkOrphanAssets,
    orphanAssets,
    isLoading,
    isReady: isReady.current,
  };
};
