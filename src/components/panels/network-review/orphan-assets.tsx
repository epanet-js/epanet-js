import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { AssetType } from "src/hydraulic-model";
import {
  JunctionIcon,
  PipeIcon,
  PumpIcon,
  ReservoirIcon,
  TankIcon,
  ValveIcon,
} from "src/icons";
import { useUserTracking } from "src/infra/user-tracking";
import {
  findOrphanAssets,
  OrphanAsset,
} from "src/lib/network-review/orphan-assets";
import { useSelection } from "src/selection";
import { dataAtom, selectionAtom } from "src/state/jotai";
import {
  CheckType,
  EmptyState,
  LoadingState,
  ToolDescription,
  ToolHeader,
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
  const { hydraulicModel } = useAtomValue(dataAtom);
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
    (orphanAsset: OrphanAsset | null) => {
      if (!orphanAsset) {
        setSelectedOrphanAssetId(null);
        clearSelection();
        return;
      }

      const fullAsset = hydraulicModel.assets.get(orphanAsset.assetId);
      if (!fullAsset) {
        setSelectedOrphanAssetId(null);
        return;
      }
      setSelectedOrphanAssetId(orphanAsset.assetId);
      selectAsset(orphanAsset.assetId);
      zoomTo([fullAsset]);
    },
    [hydraulicModel, selectAsset, zoomTo, clearSelection],
  );

  useEffect(() => {
    const selectedOrphanAsset = orphanAssets.find((orphanAsset) =>
      isSelected(orphanAsset.assetId),
    );

    if (!selectedOrphanAsset) {
      setSelectedOrphanAssetId(null);
    } else
      setSelectedOrphanAssetId((prev) =>
        prev === selectedOrphanAsset.assetId
          ? prev
          : selectedOrphanAsset.assetId,
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

  return (
    <div className="absolute inset-0 flex flex-col">
      <ToolHeader
        checkType={CheckType.orphanAssets}
        onGoBack={onGoBack}
        itemsCount={orphanAssets.length}
        autoFocus={orphanAssets.length === 0 && !isLoading}
      />
      <div className="relative flex-grow flex flex-col">
        {isReady ? (
          <>
            {orphanAssets.length > 0 ? (
              <OrphanAssetsList
                orphanAssets={orphanAssets}
                onClick={selectOrphanAsset}
                selectedOrphanAsset={selectedOrphanAssetId}
                onGoBack={onGoBack}
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
}: {
  orphanAssets: OrphanAsset[];
  onClick: (issue: OrphanAsset | null) => void;
  selectedOrphanAsset: number | null;
  onGoBack: () => void;
}) => {
  return (
    <VirtualizedIssuesList
      items={orphanAssets}
      selectedItemId={selectedOrphanAsset}
      onSelect={onClick}
      getItemId={(issue) => issue.assetId}
      renderItem={(_index, orphanAsset, selectedId, onClick) => (
        <OrphanAssetItem
          orphanAsset={orphanAsset}
          selectedId={selectedId}
          onClick={onClick}
        />
      )}
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
  orphanAsset,
  onClick,
  selectedId,
}: {
  orphanAsset: OrphanAsset;
  onClick: (orphanAsset: OrphanAsset) => void;
  selectedId: string | number | null;
}) => {
  const translate = useTranslate();
  const isSelected = selectedId === orphanAsset.assetId;

  return (
    <Button
      onClick={() => onClick(orphanAsset)}
      onMouseDown={(e) => e.preventDefault()}
      variant={"quiet/list"}
      role="button"
      aria-label={translate(
        "networkReview.orphanAssets.issueLabel",
        translate(orphanAsset.type),
        orphanAsset.label,
      )}
      aria-checked={isSelected}
      aria-expanded={isSelected ? "true" : "false"}
      aria-selected={isSelected}
      tabIndex={-1}
      className="group w-full"
    >
      <div className="grid grid-cols-[auto_1fr] gap-x-2 items-start p-1 pr-0 text-sm w-full">
        <div className="pt-[.125rem]">{iconByAssetType[orphanAsset.type]}</div>
        <div className="text-sm text-left">{orphanAsset.label}</div>
      </div>
    </Button>
  );
};

const deferToAllowRender = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

const useCheckOrphanAssets = () => {
  const [orphanAssets, setOrphanAssets] = useState<OrphanAsset[]>([]);
  const { hydraulicModel } = useAtomValue(dataAtom);
  const { startLoading, finishLoading, isLoading } = useLoadingStatus();
  const isReady = useRef(false);

  const checkOrphanAssets = useCallback(
    async (signal?: AbortSignal) => {
      startLoading();
      await deferToAllowRender();

      try {
        const result = await findOrphanAssets(hydraulicModel, "array", signal);

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
